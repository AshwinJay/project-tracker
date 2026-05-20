# Plan

## Pending

- **Snapshot schema, versioning, and validation**: define a stable schema for snapshot data with forward/backward compatibility and robust error handling _(prerequisite for Snapshot reports below)_
  - Versioned schema (e.g. `schemaVersion` field) so older snapshots can be migrated forward on load `effort: done`
  - JSON Schema or hand-rolled validator that checks required fields, types, and value ranges before any snapshot is applied `effort: done`
  - Migration functions keyed by version pair (v1→v2, v2→v3, …) run automatically on import/restore `effort: done` _(stub in place; expands as versions are added)_
  - Load-time guard: invalid snapshots are silently dropped on load with a console warning `effort: done`
  - Validation errors surfaced to the user with field-level detail (not just "invalid snapshot") so partial data can still be recovered
  - On restore failure: keep current state intact, show diff of what failed, offer option to restore partial data or abort

- **Snapshot reports**: periodically save a snapshot of project state and generate reports from the history `effort: done`
  - Manually save snapshots with a label modal; full-state capture (project, scopes, risks, changes, burnActuals) `effort: done`
  - Snapshot list with per-row stats, delete, and "Compare →" shortcut `effort: done`
  - Compare view: any two snapshots (or vs. current state); 5-tile summary bar, scope/risk/change-log diffs `effort: done`
  - Trend charts: scope count, buffer remaining, status distribution over snapshot history `effort: done`
  - Burndown overlay: faint dashed lines per snapshot behind the current actuals `effort: done`
  - Markdown export: "Copy md" per snapshot and "Copy summary" on the diff view `effort: done`
  - JSON export: "↓ Download JSON" exports full snapshots array `effort: done`

- **Offline-first multi-device / multi-author sync via shared drive**: let multiple authors work offline and sync without a central server
  - Use [Automerge](https://automerge.org/) or [Yjs](https://docs.yjs.dev/) as the CRDT layer so concurrent edits from different devices merge automatically without conflicts
  - Persist the CRDT document (binary) alongside the current JSON in localStorage; on load, merge any document found in the shared location
  - Sync transport: a shared folder (e.g. Google Drive, iCloud Drive, Dropbox, or any mounted network drive) — each device writes its changes to a per-device file; peers read and merge on open or on a polling interval
  - No server required: the shared drive acts purely as a dumb file store; all merge logic runs in the browser
  - Conflict resolution UX: show a "remote changes detected" banner with a summary of what changed before auto-merging; allow manual review for destructive ops (task deletion, date resets)
  - Offline queue: changes made with no shared-drive access are queued in localStorage and flushed the next time the shared path is reachable
  - Interop with snapshot schema (above): snapshots are CRDT checkpoints that can be shared across devices the same way

- **Bandwidth planning**: model available capacity per team member over time and compare against demand
  - Each member has a weekly/daily availability (e.g. 80% = 4 days/week) that can vary by date range (vacations, part-time periods)
  - Scope tasks can be assigned to members; derive "bandwidth needed" per member per week from those assignments
  - Surface as a new view (or overlay on Timeline): stacked bar or area chart showing available vs. committed hours/days per member per sprint/week
  - Flag over-allocation: highlight weeks where committed > available for any member
  - Allow per-member bandwidth entries in project settings (member, from-date, to-date, availability %)

## Done

- Make Timeline and Burndown charts horizontally (and vertically) scrollable, especially on smaller screens `effort: done`
- Add Start and End date week markers in Timeline `effort: done`
- Add Timeline filter (show/hide tasks by status) and simplify project settings labels `effort: done`
- Fix Burndown ideal line not reaching 0 `effort: done`
- Extract pure logic to `src/lib/logic.js` and add Jest test suite (88 tests) `effort: done`
