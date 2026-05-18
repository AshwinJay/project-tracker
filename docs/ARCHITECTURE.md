# Project Tracker — Architecture

## Overview

Single-page app that combines six project management views into one interconnected state:

- **Hill Chart** (from Basecamp/Shape Up) — qualitative confidence signal per scope
- **Burndown Chart** — quantitative remaining-work-over-time tracking
- **Schedule Buffer** — explicit padding tracking with auto-calculated consumption
- **Risk Register** — probability × impact matrix with mitigation plans
- **Change Log** — scope change tracking with schedule impact that feeds the buffer
- **Timeline/Gantt** — horizontal bar view of scope time windows with overflow detection

The views share state — approving a change in the change log moves the buffer bar; scope overflow flags appear across the hill chart list, timeline header, and burndown reference line.

## Setup & Dependencies

All dependencies are vendored locally in `src/vendor/` — no CDN, no build step.

| File | Purpose |
|---|---|
| `react.production.min.js` | React 18 UMD |
| `react-dom.production.min.js` | ReactDOM 18 UMD |
| `prop-types.min.js` | Required by Recharts at init (must load before Recharts) |
| `Recharts.js` | Recharts 2.12.7 UMD dev build |
| `babel.min.js` | Babel standalone — compiles the inline `<script type="text/babel">` at runtime |

Recharts' dev UMD build calls `PropTypes.shape()` when defining component prop types. Without `prop-types` loaded first, it throws before setting `window.Recharts`, which makes the entire app fail silently.

## Data Model

All state lives in a single blob persisted to `localStorage` under key `project-tracker-v6`.

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
    name: string,
    hill: number,            // 0.0–1.0, position on the hill chart
    status: enum,            // "on-track" | "at-risk" | "blocked"
    owner: string,           // 2-char initials, e.g. "MR"
    startWeek: number,       // 1-indexed week within the cycle
    endWeek: number,         // can exceed totalWeeks (flagged as overflow)
    history: number[],       // hill positions over time, feeds sparklines
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
    title: string,
    impact: string,          // "+3d" or "-2d" — parsed for buffer math
    status: enum,            // "pending" | "approved" | "rejected"
    scope: string,           // which scope this affects (free text, not a foreign key)
  }],
}
```

### Derived Values (not stored)

Computed at render time from the persisted state above:

- `totalWeeks` = `ceil((endDate - startDate) / 7days)`
- `maxWeeks` = `max(totalWeeks, max(scopes[].endWeek))`
- `scopeChangeDays.net` = sum of `parseImpactDays(change.impact)` for approved changes
- `scopeChangeDays.adds` / `.saves` = positive / absolute-negative sums
- `bufferUsed` = `max(0, scopeChangeDays.net + slippageDays)`
- `bufferRemaining` = `max(0, bufferDays - bufferUsed)`
- `overflowScopes` = scopes where `endWeek > totalWeeks`
- `statusCounts` = count of scopes per status value
- `burndownData` = ideal line (100→0 over totalWeeks) + actual points up to currentWeek
- Risk severity: `"critical"` if both prob+impact are high, `"elevated"` if either is high, otherwise `"moderate"`

## Views

### Hill Chart
- SVG, 640×210 viewBox
- Hill curve: `y = H - sin(normalizedX × π) × amplitude` — symmetric, peak at x=0.5
- Dots draggable via pointer events: `onPointerDown` on dot, `onPointerMove` on SVG, `onPointerUp`/`onPointerLeave` to release. ClientX → SVG coords → 0–1 hill value; Y is always derived from X
- During drag, the last history entry is updated in-place (not appended) so dragging doesn't pollute sparkline data
- 📸 Snapshot appends the current hill value to each scope's `history` array
- Below the chart: scope list sorted by hill position descending, with sparklines, percentage, status pill, edit/delete

### Timeline
- CSS Grid: scope name column + one column per week up to `maxWeeks`
- Weeks beyond `totalWeeks` render with red styling
- Each scope bar spans `startWeek`→`endWeek`; fill within each cell is proportional to hill progress relative to that week
- Current week has an orange vertical marker; overflow scopes show ⚠

### Burndown
- Recharts `AreaChart`
- Ideal line: dashed, linear 100%→0% over `totalWeeks`
- Actual line: solid, data points up to `currentWeek` (currently hardcoded sample data — see PLAN.md)
- Reference lines for current week and deadline (when `maxWeeks > totalWeeks`)

### Risks
- Card list, left border colored by severity (red/amber/blue)
- Severity auto-derived from prob × impact (see formula above)

### Changes
- Card list; status pills cycle on tap: pending → approved → rejected
- Net approved impact shown in header; feeds buffer bar in real time

## Buffer System

```
bufferUsed = scopeChangeDays.net (auto, from change log) + slippageDays (manual)
```

Both sources are shown separately in the breakdown so teams can distinguish "we added scope" from "we underestimated." When `bufferUsed > bufferDays` the bar turns red and shows the overrun amount.

## UI Patterns

- **Themes**: Light/dark objects (`LT` / `DKT`), auto-detected from system preference, manually togglable. All colors reference the theme — no hardcoded values in components.
- **Typography**: DM Sans (body) + DM Mono (numbers/data) via Google Fonts `<link>`.
- **Modals**: Overlay with backdrop-click-to-close. Used for project settings, add/edit scope, add risk, add change.
- **Persistence**: Single JSON blob to localStorage on every state change. Loaded once on mount. Key: `project-tracker-v6`.

## Suggested Module Split

The app is currently one file (`src/index.html`). For a real implementation:

```
src/
├── app.jsx
├── components/
│   ├── HillChart.jsx
│   ├── ScopeList.jsx
│   ├── Timeline.jsx
│   ├── Burndown.jsx
│   ├── RiskRegister.jsx
│   ├── ChangeLog.jsx
│   ├── BufferBar.jsx
│   ├── SummaryCards.jsx
│   └── ui/              # Modal, Field, Pill, Sparkline, HelpBanner, Button
├── hooks/
│   ├── useProjectData.js
│   └── useTheme.js
└── lib/
    ├── theme.js
    ├── defaults.js
    ├── buffer.js
    └── dates.js
```
