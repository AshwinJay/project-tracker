# Plan

## Pending

### Bug fixes / behaviour

- **Snapshot charts overflow horizontally**: the Scope Count and Buffer Remaining (days) charts in the Snapshots view scroll past the horizontal window boundary; constrain them to the viewport width

- **Snapshots Trends tab tooltip truncates text**: the tooltip/pop-up that appears over chart elements does not show the full label — the box is too small and cuts off the content; allow it to grow to fit or wrap the text

- **Edit scope: support moving completion %**: the Edit Scope modal should allow the user to set or adjust the completion percentage directly, not just through implicit state changes

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

- **Multi-project support**: the app currently stores a single project under the localStorage key `project-tracker-v6`; there is no way to work on more than one project or switch between them. Goals:
  - Allow users to create, name, and switch between multiple projects, each stored as a separate entry (or under a keyed namespace) in localStorage
  - Provide a project picker on load (or in the header) so users can select which project to open
  - Support saving the current project under a new name (Save As) and deleting projects that are no longer needed
  - Clarify the storage model in the UI: show the active project name prominently and make it obvious that data is local to the browser
  - Consider the migration path for existing data stored under `project-tracker-v6`

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
