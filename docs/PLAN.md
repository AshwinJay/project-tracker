# Plan

## Pending

- **Snapshot schema — restore UX** _(partial; schema foundation is done)_
  - Validation errors surfaced to the user with field-level detail (not just "invalid snapshot") so partial data can still be recovered
  - On restore failure: keep current state intact, show diff of what failed, offer option to restore partial data or abort

- **Offline-first multi-device / multi-author sync via shared drive**: let multiple authors work offline and sync without a central server
  - Use [Automerge](https://automerge.org/) or [Yjs](https://docs.yjs.dev/) as the CRDT layer so concurrent edits from different devices merge automatically without conflicts
  - Persist the CRDT document (binary) alongside the current JSON in localStorage; on load, merge any document found in the shared location
  - Sync transport: a shared folder (e.g. Google Drive, iCloud Drive, Dropbox, or any mounted network drive) — each device writes its changes to a per-device file; peers read and merge on open or on a polling interval
  - No server required: the shared drive acts purely as a dumb file store; all merge logic runs in the browser
  - Conflict resolution UX: show a "remote changes detected" banner with a summary of what changed before auto-merging; allow manual review for destructive ops (task deletion, date resets)
  - Offline queue: changes made with no shared-drive access are queued in localStorage and flushed the next time the shared path is reachable
  - Interop with snapshot schema (above): snapshots are CRDT checkpoints that can be shared across devices the same way

- **Bandwidth planning**: model available capacity per team member over time and surface how shortfalls flow through to slippage and buffer consumption
  - Each member has a weekly availability (e.g. 80% = 4 days/week) that can vary by date range (vacations, part-time periods)
  - Scope tasks are assigned to owners (already stored as 2-char initials); derive person-weeks of demand per scope from `startWeek`→`endWeek` and hill position
  - **Buffer / slippage ladder**: when committed demand exceeds available capacity for a member in a given week, the shortfall is surfaced as predicted slippage days — this feeds directly into the existing `slippageDays` field and buffer bar so teams can see the capacity impact before it happens
  - Surface as a new view (or Timeline overlay): stacked bar or area chart of available vs. committed days per member per week
  - Flag over-allocation: highlight weeks where committed > available for any member; show how many days of buffer that over-allocation will consume at current pace
  - Allow per-member availability entries in project settings (member, from-date, to-date, availability %)

