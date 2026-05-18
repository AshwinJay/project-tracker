# Plan

## Pending

- Add status filter in Timeline to show/hide scopes by pill status (on-track, at-risk, blocked) `effort: done`
- **Bandwidth planning**: model available capacity per team member over time and compare against demand
  - Each member has a weekly/daily availability (e.g. 80% = 4 days/week) that can vary by date range (vacations, part-time periods)
  - Scope tasks can be assigned to members; derive "bandwidth needed" per member per week from those assignments
  - Surface as a new view (or overlay on Timeline): stacked bar or area chart showing available vs. committed hours/days per member per sprint/week
  - Flag over-allocation: highlight weeks where committed > available for any member
  - Allow per-member bandwidth entries in project settings (member, from-date, to-date, availability %)

## Done

- Make Timeline and Burndown charts horizontally (and vertically) scrollable, especially on smaller screens `effort: done`
- Add Start and End date week markers in Timeline `effort: done`
