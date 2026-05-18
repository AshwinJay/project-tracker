# Project Tracker — Architecture

## What This Is

A single-page project tracker that combines several project management concepts into one view:

- **Hill Chart** (from Basecamp/Shape Up) — qualitative confidence signal showing whether work is in the "figuring it out" or "making it happen" phase
- **Burndown Chart** — quantitative remaining-work-over-time tracking
- **Schedule Buffer** — explicit padding tracking with auto-calculated consumption
- **Risk Register** — probability × impact matrix with mitigation plans
- **Change Log** — scope change tracking with schedule impact that feeds the buffer
- **Timeline/Gantt** — horizontal bar view of scope time windows with overflow detection

The key design insight is that these views are interconnected, not siloed:
- Approved changes in the change log automatically consume buffer
- Scopes that extend past the cycle deadline are flagged across hill chart, timeline, and burndown
- The buffer bar breaks down consumption into two visible sources (scope changes + slippage)
- Hill chart positions feed the timeline's progress fill

## Data Model

All state lives in a single persisted blob. No backend — uses key-value storage (currently `window.storage` in Claude artifacts, should be replaced with a real persistence layer).

```
{
  project: {
    title: string,           // "Acme · Platform Rebuild"
    cycle: string,           // "Cycle 4" — the named time-box
    startDate: string,       // ISO date "2026-05-05"
    endDate: string,         // ISO date "2026-06-27"
    currentWeek: number,     // manually set, positions the "Now" marker
    bufferDays: number,      // total planned buffer in days
    slippageDays: number,    // manual adjustment for work taking longer than estimated
  },

  scopes: [{
    id: string,              // unique, e.g. "s1" or "s1716000000000"
    name: string,            // "Auth & Permissions"
    hill: number,            // 0.0–1.0, position on the hill chart
    status: enum,            // "on-track" | "at-risk" | "blocked"
    owner: string,           // 2-char initials, e.g. "MR"
    startWeek: number,       // 1-indexed week within the cycle
    endWeek: number,         // can exceed totalWeeks (flagged as overflow)
    history: number[],       // array of hill positions over time, feeds sparklines
  }],

  risks: [{
    id: string,
    title: string,
    prob: enum,              // "low" | "medium" | "high"
    impact: enum,            // "low" | "medium" | "high"
    mitigation: string,
    owner: string,
  }],

  changes: [{
    id: string,
    date: string,            // display date, e.g. "May 06"
    title: string,           // what changed
    impact: string,          // "+3d" or "-2d" — parsed for buffer math
    status: enum,            // "pending" | "approved" | "rejected"
    scope: string,           // which scope this affects (free text, not a foreign key)
  }],
}
```

### Derived Values (not stored)

These are computed at render time, never persisted:

- `totalWeeks` = weeks between `project.startDate` and `project.endDate`
- `maxWeeks` = `max(totalWeeks, max(scopes[].endWeek))` — the actual display range
- `scopeChangeDays.net` = sum of `parseImpactDays(change.impact)` for all approved changes
- `scopeChangeDays.adds` = sum of positive approved impacts
- `scopeChangeDays.saves` = sum of absolute negative approved impacts
- `bufferUsed` = `max(0, scopeChangeDays.net + project.slippageDays)`
- `bufferRemaining` = `max(0, project.bufferDays - bufferUsed)`
- `bufferPct` = `bufferUsed / project.bufferDays * 100`
- `overflowScopes` = scopes where `endWeek > totalWeeks`
- `statusCounts` = count of scopes per status
- `burndownData` = generated array with ideal line (linear from 100→0 over totalWeeks) and actual data points up to currentWeek
- Risk severity = `(prob === "high" && impact === "high") ? "critical" : (prob === "high" || impact === "high") ? "elevated" : "moderate"`

## Views / Tabs

### Hill Chart
- SVG-based, 640×210 viewBox
- Hill curve: `y = sin(x * π)` mapped to the viewBox
- Dots are draggable via pointer events — constrained to move along the hill curve (x maps to 0–1 hill value, y is derived)
- Each dot shows owner initials, colored by status
- Below the chart: sorted scope list with sparklines, percentage, status pill, edit/delete controls
- Status pills cycle on tap: on-track → at-risk → blocked

### Timeline
- CSS Grid layout: scope names column + one column per week
- Weeks beyond `totalWeeks` are shown with red styling and ⚠ markers
- Each scope's bar spans `startWeek` to `endWeek`
- Fill within each week cell is proportional to hill progress relative to that position in the time window
- Current week has an orange vertical marker

### Burndown
- Recharts AreaChart
- Ideal line: linear from 100% to 0% over `totalWeeks` (dashed)
- Actual line: data points up to `currentWeek` (solid, with dots)
- Reference lines for "Now" (current week) and "Deadline" (if any scope exceeds totalWeeks)
- X-axis dynamically sized to `maxWeeks`

### Risks
- Card list, sorted by input order
- Left border colored by severity (critical=red, elevated=amber, moderate=blue)
- Shows probability, impact, owner, mitigation text
- Add/delete controls

### Changes
- Card list with date, title, affected scope, impact, status
- Status pills cycle on tap: pending → approved → rejected
- Net approved impact shown in header and feeds buffer bar
- Delete control per entry

## Buffer System

The buffer bar sits above all tabs as a persistent health indicator.

```
Buffer consumed = scope_change_net_days (auto) + slippage_days (manual)
```

- **Scope changes (auto)**: Sums `parseImpactDays()` across all approved changes. Approving/rejecting a change in the change log immediately updates the buffer. Positive impacts add to consumption, negative impacts reduce it.
- **Slippage (manual)**: Set in project settings. Represents time lost to work taking longer than estimated — the gap visible in the burndown chart. Updated periodically by the PM.
- **Breakdown display**: The buffer bar shows both sources separately so teams can distinguish "we added scope" from "we underestimated."
- **Overrun state**: When consumed > planned, the card shows negative remaining and a warning.

## UI Patterns

- **Theme**: Light/dark, auto-detects system preference, manual toggle. All colors defined in theme objects, no hardcoded values in components.
- **Typography**: DM Sans (body) + DM Mono (numbers/data). Loaded via Google Fonts.
- **Modals**: Overlay with backdrop click to close. Used for: project settings, add/edit scope, add risk, add change.
- **Help banners**: Each tab has a contextual banner explaining the view and interactions. Styled with left accent border.
- **Persistence**: Single key in storage, full state serialized as JSON. Loaded on mount, saved on every state change (debouncing would be good to add).
- **Fonts imported via**: `<link>` tag in component body (works in artifact context, should move to `<head>` in a real app).

## File Structure (Current)

Single-file React component. For a real implementation, break into:

```
src/
├── app.jsx                  # Root component, state management, persistence
├── components/
│   ├── HillChart.jsx        # SVG hill chart with drag
│   ├── ScopeList.jsx        # Scope rows with sparklines
│   ├── Timeline.jsx         # Gantt-style grid
│   ├── Burndown.jsx         # Recharts area chart
│   ├── RiskRegister.jsx     # Risk cards
│   ├── ChangeLog.jsx        # Change entries
│   ├── BufferBar.jsx        # Buffer indicator + breakdown
│   ├── SummaryCards.jsx     # Status count cards
│   └── ui/
│       ├── Modal.jsx
│       ├── Field.jsx
│       ├── Pill.jsx
│       ├── Sparkline.jsx
│       ├── HelpBanner.jsx
│       └── Button.jsx
├── hooks/
│   ├── useProjectData.js    # State + persistence logic
│   └── useTheme.js          # Dark/light theme
├── lib/
│   ├── theme.js             # Theme color objects
│   ├── defaults.js          # Default data
│   ├── buffer.js            # Buffer calculation logic
│   └── dates.js             # Week/date helpers
└── types.ts                 # TypeScript interfaces if using TS
```

## Dependencies

Current:
- React (useState, useEffect, useRef, useCallback, useMemo)
- Recharts (AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine)
- Google Fonts (DM Sans, DM Mono)

No other dependencies. The hill chart, sparklines, and timeline are all custom SVG/CSS — no charting library needed for those.

## Key Implementation Notes

- **Hill curve math**: `y = sin(normalizedX * π)` where normalizedX is 0–1 across the chart width. The hill is symmetric, with the peak at 0.5. This means 50% on the hill = the top of the curve = the transition point between "figuring out" and "executing."
- **Drag constraint**: Pointer events track clientX, convert to SVG coordinates, then to a 0–1 hill value. Y is always derived from X (dot stays on the curve). The drag uses `onPointerDown` on each dot, `onPointerMove` on the SVG, and `onPointerUp`/`onPointerLeave` to release.
- **Impact parsing**: `parseImpactDays("+3d")` strips non-numeric/non-minus characters and returns an integer. Handles both "+3d" and "-2d" formats.
- **Sparkline history**: Each scope stores an array of hill positions. The 📸 Snapshot button appends the current position to every scope's history. During drag, the last history entry is updated in place (not appended) so dragging doesn't create hundreds of history points.
- **Overflow detection**: Any scope with `endWeek > totalWeeks` is considered overflow. This triggers visual flags in the timeline (dashed red borders), hill chart list (week range annotation), header (count), and burndown (deadline reference line).
