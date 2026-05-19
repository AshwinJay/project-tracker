# Plan

## Pending

- **Snapshot reports**: periodically save a snapshot of project state and generate reports from the history
  - Manually or automatically save snapshots (e.g. end of sprint/week) with a timestamp
  - Report view: compare any two snapshots to surface key changes (scope added/removed, status shifts, buffer consumed, date slippage)
  - Charts: burndown overlay across snapshots, scope growth over time, risk trend (how many items moved to at-risk/blocked)
  - Exportable summary (copy to clipboard or download) for stakeholder updates

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
