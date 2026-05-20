# Plan

## Pending

### Bug fixes / behaviour

- **"Past deadline" indicator: wrong logic and wrong location**: a scope marked 100% complete should be excluded from the "N scopes past deadline" count regardless of its end date — currently it stays in the count and its timeline row does not update to reflect completion. Additionally, move the count out of the header strip into a dedicated tile alongside Buffer Left, so deadline pressure is visible at a glance without cluttering the header.

- **Burndown chart: multiple issues**:
  - Hill Chart progress is not reflected in the burndown line — the chart does not appear to incorporate actual hill position data
  - "Overlay snapshots" button is a no-op — either wire it up to render snapshot burn lines or remove it
  - A number is displayed on the chart with no label or explanation — label it clearly or remove it
  - Changing the current week in Project Settings has no effect on the chart — it should re-derive from the updated week value

- **Snapshot charts overflow horizontally**: the Scope Count and Buffer Remaining (days) charts in the Snapshots view scroll past the horizontal window boundary; constrain them to the viewport width

### UX clarity / simplification

- **Consolidate slippage and schedule buffer UX**: schedule impact is currently spread across too many disconnected places — Slippage (Project Settings › Schedule Buffer), Scope add/edit (start/end week), Changes (add + approve), and implicit deadline warnings — with no clear explanation of how they relate. Goals:
  - Define one authoritative source for slippage (derived where possible, not manually entered)
  - Make it obvious when and why slippage grows: scope creep (Changes), late-running scopes (Timeline), or explicit override
  - Consolidate the Schedule Buffer section and slippage field into a single, well-labelled panel that explains inputs and shows derived impact
  - Audit every place a user can affect the schedule and ensure each feeds the same buffer/slippage calculation with a visible explanation
  - Note: the capacity-driven slippage from Bandwidth planning (below) should feed this same calculation once both features are built

- **Indicate unsnapshotted changes**: all edits auto-save to localStorage immediately, so there are no "unsaved changes" — but the user has no way to know whether their current state has diverged from the last snapshot. Show a subtle indicator (e.g. a dot on the Snapshots tab or a banner) when live state differs from the most recent snapshot. Clarify in the UI (tooltip or footer) that data is always auto-saved locally and snapshots are manual checkpoints for history and comparison.

- **Remove Reset button**: remove the Reset button from the UI

### Larger features

- **Bandwidth planning**: model available capacity per team member over time and surface how shortfalls flow through to slippage and buffer consumption
  - Each member has a weekly availability (e.g. 80% = 4 days/week) that can vary by date range (vacations, part-time periods)
  - Scope tasks are assigned to owners (already stored as 2-char initials); derive person-weeks of demand per scope from `startWeek`→`endWeek` and hill position
  - When committed demand exceeds available capacity for a member in a given week, surface the shortfall as predicted slippage days — feeds into the slippage/buffer model (see consolidation item above)
  - Surface as a new view or Timeline overlay: stacked bar or area chart of available vs. committed days per member per week
  - Flag over-allocation: highlight weeks where committed > available; show how many buffer days that consumes at current pace
  - Allow per-member availability entries in project settings (member, from-date, to-date, availability %)

- **Offline-first multi-device / multi-author sync via shared drive**: let multiple authors work offline and sync without a central server
  - Use [Automerge](https://automerge.org/) or [Yjs](https://docs.yjs.dev/) as the CRDT layer so concurrent edits merge automatically without conflicts
  - Persist the CRDT document (binary) alongside the current JSON in localStorage; on load, merge any document found in the shared location
  - Sync transport: a shared folder (e.g. Google Drive, iCloud Drive, Dropbox, or any mounted network drive) — each device writes its changes to a per-device file; peers read and merge on open or on a polling interval
  - No server required: the shared drive acts purely as a dumb file store; all merge logic runs in the browser
  - Conflict resolution UX: show a "remote changes detected" banner with a summary of what changed before auto-merging; allow manual review for destructive ops (task deletion, date resets)
  - Offline queue: changes made with no shared-drive access are queued in localStorage and flushed the next time the shared path is reachable
  - Snapshots are CRDT checkpoints that can be shared across devices the same way
