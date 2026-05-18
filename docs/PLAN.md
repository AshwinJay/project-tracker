# Project Tracker — Plan

Future work, roughly ordered by impact. Each item is tagged with effort and which part of the system it touches.

---

## Data & Persistence

### Replace artifact storage with a real backend
`effort: medium` `area: infra`

Currently uses `window.storage` (Claude artifact key-value store). For production, move to one of:
- Local-first with SQLite/IndexedDB + sync (good for offline, fits the "personal tool" feel)
- Supabase/Firebase for multi-user
- Plain filesystem with JSON (simplest for a self-hosted tool)

The data model is already a single serializable blob, so migration is straightforward — just swap the `load()` and `save()` functions.

### Multi-project support
`effort: medium` `area: data model`

Currently single-project. Add a project list/switcher so you can track multiple cycles or workstreams. Data model becomes `projects: [{ id, ...projectData }]` with a selected project ID.

### Undo/redo
`effort: medium` `area: state`

State changes (drag, status cycle, add/delete) should be undoable. Implement a simple history stack of state snapshots, or use a reducer pattern with action replay.

### Import/export
`effort: small` `area: data`

Export full state as JSON for backup or sharing. Import to restore. Could also support CSV export of the change log and risk register for stakeholder reporting.

---

## Hill Chart

### Drag on mobile/touch
`effort: small` `area: hill chart`

Touch dragging works via pointer events but needs testing and refinement on actual mobile devices. May need to increase hit target size for dots and add haptic feedback.

### Hill chart history playback
`effort: medium` `area: hill chart`

Use the sparkline history data to animate the hill chart over time — a scrubber that shows where dots were at each snapshot. This makes weekly standups more visual: "here's where we were last week, here's where we are now."

### Scope grouping / swimlanes
`effort: medium` `area: hill chart, data model`

Group scopes by workstream, team, or theme. Show them in separate hill charts or as color-coded lanes within one chart. Useful when tracking 15+ scopes.

### Confidence annotations
`effort: small` `area: hill chart`

Let users add a short note when moving a dot: "blocked on API response from vendor" or "prototype validated, moving to build." These become a log attached to the scope, visible on hover or in a detail panel.

---

## Timeline

### Drag to resize scope time windows
`effort: medium` `area: timeline`

Let users grab the left/right edge of a timeline bar to adjust start/end weeks directly, instead of opening the edit modal. More natural for planning.

### Dependency arrows
`effort: large` `area: timeline, data model`

Allow scopes to declare dependencies on other scopes. Show as arrows on the timeline. Flag when a dependency's end week is after the dependent's start week (scheduling conflict). This starts to approach Gantt chart territory — be careful not to over-engineer.

### Critical path highlighting
`effort: large` `area: timeline, data model`

With dependencies in place, calculate and highlight the critical path — the longest chain of dependent scopes that determines the minimum project duration. Changes to critical-path scopes have the highest deadline risk.

### Milestone markers
`effort: small` `area: timeline`

Add milestone events (demos, stakeholder reviews, launches) as diamond markers on the timeline. These aren't scopes — they're fixed dates that scopes need to finish before.

---

## Burndown

### Auto-calculate from hill chart data
`effort: medium` `area: burndown, hill chart`

The burndown actual line is currently hardcoded sample data. It should be derived from scope progress:
- Each scope has a weight (could be story points, or just equal weight)
- Remaining work = sum of `(1 - scope.hill) * scope.weight` across all scopes
- Each snapshot records a data point
- This makes the burndown a true reflection of hill chart movement

### Burnup chart alternative
`effort: small` `area: burndown`

Some teams prefer burnup (work completed going up) over burndown (work remaining going down). Burnup also makes scope additions visible as the "total work" line rising, which connects nicely to the change log. Offer as a toggle.

### Projected completion line
`effort: small` `area: burndown`

Extrapolate the actual line's trend to show when the project will likely finish at current velocity. Compare against the deadline. This is the most actionable thing a burndown can tell you.

### Velocity tracking
`effort: medium` `area: burndown`

Track how many hill-chart percentage points move per week. Show as a secondary metric. Declining velocity is an early warning signal, often more useful than the absolute burndown position.

---

## Buffer

### Auto-calculate slippage from burndown gap
`effort: medium` `area: buffer, burndown`

Once the burndown is auto-calculated from hill data, slippage can be derived too:
- Expected progress at current week (from ideal line) vs actual progress
- Convert the percentage gap to days using total scheduled duration
- This removes the need for manual slippage entry

### Buffer burn rate
`effort: small` `area: buffer`

Show how fast buffer is being consumed per week. If you've used 5 of 12 buffer days in 6 weeks, that's 0.83d/week — project to see if buffer will last. Display as a small trend indicator.

### Buffer alerts / thresholds
`effort: small` `area: buffer`

Configurable thresholds (e.g. 50%, 75%, 90%) that change the buffer bar color and optionally trigger notifications. Currently hardcoded at 50% (amber) and 70% (red).

---

## Risks

### Risk matrix visualization
`effort: small` `area: risks`

Add a 3×3 probability/impact grid view as an alternative to the card list. Dots in the grid, colored by scope. Quick visual of risk concentration.

### Risk-to-scope linking
`effort: small` `area: risks, data model`

Link risks to specific scopes (currently free-text owner only). When a scope is at-risk or blocked, surface its linked risks. When a risk is mitigated, prompt to review the scope's status.

### Risk trend tracking
`effort: medium` `area: risks`

Track when risk probability/impact changes over time. A risk that escalates from medium→high should be visible as a trend, not just its current state.

---

## Change Log

### Link changes to scopes as foreign keys
`effort: small` `area: changes, data model`

Currently the "affected scope" is free text. Make it a dropdown/selector tied to actual scope IDs. This enables filtering the change log by scope and showing change history on scope detail views.

### Auto-update buffer on approval
`effort: done` `area: buffer, changes`

Already implemented — approved changes feed the buffer automatically.

### Change request workflow
`effort: medium` `area: changes`

Add optional fields: requestor, justification, reviewer, decision date. This turns the change log into a lightweight change control board (CCB). Useful for teams with stakeholder governance requirements.

### Impact categories
`effort: small` `area: changes`

Beyond schedule impact (+3d), track effort impact (story points or person-days) and cost impact. Different dimensions of "how big is this change."

---

## UX & Polish

### Collapsible help banners
`effort: small` `area: ui`

Help banners are useful on first use but take up space for experienced users. Add a dismiss/collapse toggle that persists.

### Keyboard shortcuts
`effort: small` `area: ui`

`1-5` to switch tabs, `n` to add new item in current tab, `?` to toggle help, `⌘z` for undo.

### Responsive / mobile layout
`effort: medium` `area: ui`

The current layout works on desktop but the 4-column summary cards and timeline grid need responsive breakpoints for mobile. The hill chart SVG scales fine but the scope list needs a compact mode.

### Onboarding / empty state
`effort: small` `area: ui`

When starting fresh (no data), show a guided setup flow instead of empty panels: set your project name, define your first few scopes, set your buffer. Currently you get sample data and a reset button, which is fine for a prototype but not for production.

### Print / PDF export
`effort: medium` `area: ui`

Generate a one-page project status summary suitable for stakeholder updates: hill chart snapshot, buffer status, top risks, recent changes. Export as PDF or formatted for print.

### Real-time collaboration
`effort: large` `area: infra`

Multiple team members editing the same tracker simultaneously. Requires conflict resolution (CRDTs or operational transforms), presence indicators, and a real-time backend. This is a significant architecture change — evaluate whether it's worth it vs. a simpler "one editor at a time" model.

---

## Integrations

### Slack/Teams status bot
`effort: medium` `area: integrations`

Post weekly status summaries to a channel: hill chart screenshot, buffer %, top risks, pending changes awaiting approval.

### Jira/Linear/GitHub Issues sync
`effort: large` `area: integrations`

Map scopes to epics or labels in an issue tracker. Pull completion data to auto-update hill positions based on ticket closure rates. This is appealing but complex — the hill chart's value is that it captures *confidence*, not just ticket counts.

### Calendar integration
`effort: small` `area: integrations`

Sync milestone dates and cycle start/end to Google Calendar or Outlook. Surface upcoming milestones in the tracker.

---

## Stretch / Experimental

### AI-powered risk detection
`effort: large` `area: ai`

Analyze the combination of burndown trajectory, scope change velocity, and risk register to surface warnings: "Reporting Engine has been blocked for 2 weeks and is on the critical path — this is likely to cause a 3-day overrun."

### Monte Carlo simulation
`effort: large` `area: analytics`

Use historical velocity data and remaining scope to run simulations and produce probability distributions for completion date. "80% chance of finishing by June 20, 50% chance by June 15."

### Retrospective view
`effort: medium` `area: analytics`

After a cycle completes, show a retrospective dashboard: how accurate were initial estimates, how much buffer was consumed, which risks materialized, how many changes were approved. Feed learnings into the next cycle's planning.
