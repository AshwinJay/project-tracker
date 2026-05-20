# Project Tracker — Architecture

## Overview

Single-page app that combines seven project management views into one interconnected state:

- **Hill Chart** (from Basecamp/Shape Up) — qualitative confidence signal per scope
- **Burndown Chart** — quantitative remaining-work-over-time tracking
- **Schedule Buffer** — explicit padding tracking with auto-calculated consumption
- **Risk Register** — probability × impact matrix with mitigation plans
- **Change Log** — scope change tracking with schedule impact that feeds the buffer
- **Timeline/Gantt** — horizontal bar view of scope time windows with overflow detection
- **Snapshots** — full-state checkpoints with comparison, trend charts, and Markdown export

The views share state — approving a change in the change log moves the buffer bar; scope overflow flags appear across the hill chart list, timeline header, and burndown reference line; snapshot overlay lines appear on the burndown when the toggle is enabled.

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

  snapshots: [{              // append-only; never mutated after creation
    schemaVersion: number,   // positive integer; v1 is current
    id: string,              // "snap_<ms-timestamp>"
    timestamp: string,       // ISO-8601, e.g. "2026-05-18T10:30:00.000Z"
    label: string,           // user-provided, e.g. "Week 3 Checkpoint"
    project: { ...copy },    // full copy of project at capture time
    scopes:  [ ...copy ],    // full copy of scopes
    risks:   [ ...copy ],    // full copy of risks
    changes: [ ...copy ],    // full copy of changes
    burnActuals: object,     // { [week]: percentRemaining } — used for burndown overlay
  }],
}
```

Snapshots default to `[]` for existing saves — no `localStorage` key change was needed. Each snapshot is approximately the same size as the current state blob; 50 snapshots ≈ 250 KB, well within `localStorage` limits.

### Derived Values (not stored)

Computed at render time from the persisted state above:

- `totalWeeks` = `ceil((endDate - startDate) / 7days)`
- `maxWeeks` = `max(totalWeeks, max(scopes[].endWeek))`
- `scopeChangeDays.net` = sum of `parseImpactDays(change.impact)` for approved changes
- `scopeChangeDays.adds` / `.saves` = positive / absolute-negative sums
- `bufferUsed` = `max(0, scopeChangeDays.net + slippageDays)`
- `bufferRemaining` = `max(0, bufferDays - bufferUsed)`
- `overflowScopes` = scopes where `endWeek > totalWeeks` **and** `hill < 1` (100%-complete scopes are excluded even if their end week is in the past)
- `statusCounts` = count of scopes per status value
- `burndownData` = ideal line (100→0 over totalWeeks) + actual points up to currentWeek
- `curRem` = `burnActuals[curW]` — remaining work % at current week as a float; `null` if no scopes
- `remColor` = theme color keyed to `curRem` threshold: green ≤33%, amber 34–66%, red >66%
- `snapTrendData` = per-snapshot rows for Recharts trend charts (from `buildSnapTrendData`)
- Risk severity: `"critical"` if both prob+impact are high, `"elevated"` if either is high, otherwise `"moderate"`

## Views

### Hill Chart
- SVG, 640×210 viewBox
- Hill curve: `y = H - sin(normalizedX × π) × amplitude` — symmetric, peak at x=0.5
- Dots draggable via pointer events: `onPointerDown` on dot, `onPointerMove` on SVG, `onPointerUp`/`onPointerLeave` to release. ClientX → SVG coords → 0–1 hill value; Y is always derived from X
- During drag, the last history entry is updated in-place (not appended) so dragging doesn't pollute sparkline data
- 📸 Snapshot opens a label modal; on confirm, appends the current hill value to each scope's `history[]` and pushes a full-state snapshot to `snapshots[]`
- Below the chart: scope list sorted by hill position descending, with sparklines, percentage, status pill, edit/delete
- Scopes past their end week show `(→WN)` in amber — only for incomplete scopes (`hill < 1`); 100%-complete scopes show no deadline warning

### Timeline
- CSS Grid: scope name column + one column per week up to `maxWeeks`
- Weeks beyond `totalWeeks` render with red styling; first out-of-bounds week is labelled "Deadline"
- Each scope bar spans `startWeek`→`endWeek`; fill within each cell is proportional to hill progress relative to that week
- Current week has an orange vertical marker and a "NOW" sub-label in the column header; incomplete overflow scopes show ⚠ (100%-complete scopes do not)
- Start (W1) and end (`totalWeeks`) week markers are pinned in the header row with "START" / "END" sub-labels
- Horizontally scrollable (`overflowX: auto`) so wide cycles don't clip
- Status filter pill bar (on-track / at-risk / blocked) hides rows by status; active filter is toggled in/out of the `tlFilter` state array

### Burndown
- Recharts `AreaChart`; horizontally scrollable for long cycles
- Ideal line: dashed, linear 100%→0% over `totalWeeks`; fixed so the line always reaches exactly 0% at the last week
- Actual line: solid, derived from `buildBurnActuals(snapshots, scopes, curW)` — week 1 is anchored at 100%, the current week is derived from the live scope average hill, snapshot weeks provide intermediate breakpoints, and all weeks in between are linearly interpolated. Returns raw floats (no rounding) so any hill drag updates the line immediately with no dead band. Updates live as `curW` or scope hill values change.
- Header stat: **"W{curW}: X% remaining"** — `Math.round(burnActuals[curW])`; color-coded green (≤33%), amber (34–66%), red (>66%). Updates in real-time as hills change, making the hill-to-burndown connection visible without needing to read the chart.
- Tooltip rounds display values to integers (`Math.round`) and suppresses null entries (future weeks have no actual data).
- Reference lines for current week ("Now") and deadline (when `maxWeeks > totalWeeks`)
- **Snapshot overlay**: when snapshots exist, a toggle button appears. Enabling it renders each snapshot's `burnActuals` as a faint dashed `<Area>` behind the current actuals line, showing how burn rate has shifted across checkpoints.

### Risks
- Card list, left border colored by severity (red/amber/blue)
- Severity auto-derived from prob × impact (see formula above)

### Changes
- Card list; status pills cycle on tap: pending → approved → rejected
- Net approved impact shown in header; feeds buffer bar in real time
- Tab label shows ` ●` when any change has `status === "pending"`
- **+ Change modal**: "Affected Scope" is a `<select>` populated from the live `scopes[]` array (scope name as value); includes a blank "— select scope —" placeholder option

### Snapshots
Tab with a pill-style sub-nav: **List** | **Compare** | **Trends**.

**List view**
- Rows are newest-first; each shows label, formatted timestamp, scope count, at-risk/blocked count, and buffer remaining labelled **"at capture"** to distinguish it from the live buffer
- **"Copy md"** button: copies a full Markdown status report to the clipboard via `navigator.clipboard`; button flashes "✓ Copied" for 1.5 s then resets. Produced by `buildSnapSummaryMd(snap)` in `logic.js`.
- **"Compare →"** button: navigates to Compare with that snapshot pre-selected as the baseline
- **"Restore"** button: applies the snapshot back to live state — see restore UX below
- Delete button with a one-click confirmation
- **"↓ Download JSON"** button: exports the full `snapshots[]` array as `snapshots.json` via `URL.createObjectURL` / `<a download>`

**Restore UX**

Clicking **Restore** runs `validateSnapshot` on the snapshot immediately.

- **Valid snapshot**: a confirmation modal opens — "Restore `"label"`? This will replace your current project, scopes, risks, and changes." Confirming calls `applyRestore`, which sets all four state atoms (`project`, `scopes`, `risks`, `changes`) from the snapshot and flashes "✓ Restored" on the button for 1.5 s using the shared `copiedId` state (key `"__restored__" + snap.id`). Current state is not touched until the user confirms.

- **Invalid snapshot**: a failure modal opens with two sections:
  - *Errors* — bullet list of all validation errors from `validateSnapshot` (field-level, e.g. `scopes[2]: hill must be 0–1, got 1.4`)
  - *Partial restore summary* — what `buildPartialRestore` would apply vs. skip: project settings (with any live fallbacks noted), valid scope count, risks, and change log. Skipped scopes are listed individually.
  - Two action buttons: **Restore partial** (applies only the valid portions) and **Abort** (closes without touching state).

`buildPartialRestore(snap, live)` returns `{ project, scopes, risks, changes, skipped[] }`:
- `project`: `snap.project` merged over `live.project`; any missing required field falls back to the live value and is noted in `skipped`
- `scopes`: `snap.scopes` filtered to valid entries; invalid entries are noted in `skipped`
- `risks` / `changes`: `snap.risks` / `snap.changes` if they are arrays (filtering out non-objects); otherwise the live array is used and noted in `skipped`

After either a full or partial restore the `copiedId` flash fires on the originating Restore button.

**Compare view**
- Two dropdowns: left always a snapshot, right a snapshot or "Current State"
- Five stat tiles: scopes added, scopes removed, buffer remaining (A→B), slippage (A→B), at-risk+blocked (A→B); color-coded green/amber/red
- Scope-by-scope diff: union of both scope sets, one row per scope; changed rows first, unchanged collapsed behind a "Show N unchanged" toggle
- Risk diff: added/removed risks (by title match)
- Change-log diff: new entries and status changes between the two states
- **"Copy summary"** button: copies a change-narrative Markdown diff to the clipboard. Produced by `buildDiffSummaryMd(...)` in `logic.js`.

**Trends view**
- Requires at least one snapshot; shows an empty state otherwise
- Scope count line chart (Recharts `LineChart`): X = snapshot label, Y = total scope count
- Buffer remaining line chart: X = snapshot label, Y = buffer remaining in days
- Status distribution stacked bar chart (Recharts `BarChart`): on-track / at-risk / blocked per snapshot
- All chart data comes from `buildSnapTrendData(snapshots)` in `logic.js`

## Pure Logic (`src/lib/logic.js`)

All computation lives in a UMD module loaded as a global before the Babel block. Key functions:

| Function | Purpose |
|---|---|
| `weeksFrom(start, end)` | Total weeks in cycle |
| `fmtD(iso)` | ISO date → "May 5" display string |
| `parseImpactDays(str)` | "+3d" / "-2d" → integer |
| `computeScopeChangeDays(changes)` | Sums approved change impacts |
| `computeBuffer(bufferDays, slippageDays, netDays)` | Buffer used/remaining/overrun |
| `makeBurndown(totalW, curW, actuals)` | Ideal + actual data points for Recharts |
| `buildBurnActuals(snapshots, scopes, curW)` | Derives `{ week → remainingPct }` map: anchors W1 at 100%, uses snapshot scope averages for past weeks, live scopes for curW, linear interpolation for gaps. All values are raw floats — rounding only happens at display time |
| `riskSeverity(prob, impact)` | "critical" / "elevated" / "moderate" |
| `cycleStatus(status)` | Advances scope status through the cycle |
| `cycleCStatus(status)` | Advances change status through the cycle |
| `computeStatusCounts(scopes)` | Count per status value |
| `computeOverScopes(scopes, totalWeeks)` | Incomplete scopes (`hill < 1`) with `endWeek > totalWeeks` — 100%-complete scopes are excluded |
| `addScope / editScope / snapshotScopes / updateHill` | Pure scope state mutations |
| `validateSnapshot(obj)` | Returns `{ valid, errors[] }` — checks required fields, types, value ranges |
| `migrateSnapshot(obj)` | Version-keyed migration stub; identity for v1 |
| `filterValidSnapshots(arr)` | Runs migrate+validate on load; drops invalid entries with a console warning |
| `buildPartialRestore(snap, live)` | Returns `{ project, scopes, risks, changes, skipped[] }` — extracts the safely restorable subset from an invalid snapshot, falling back to live state for broken sections |
| `diffScopes(stateA, stateB)` | Union diff of two scope arrays — added/removed/changed per scope |
| `diffRisks(stateA, stateB)` | Added/removed risks by title match |
| `diffChanges(stateA, stateB)` | Added entries and status changes in the change log |
| `buildSnapTrendData(snapshots)` | Per-snapshot rows for Recharts trend charts |
| `buildSnapSummaryMd(snap)` | Markdown status report from a single snapshot |
| `buildDiffSummaryMd(labelA, labelB, scopeDiffs, bufA, bufB, atRA, atRB, rDiff, cDiff)` | Markdown change-narrative diff |

## Buffer System

```
bufferUsed = scopeChangeDays.net (auto, from change log) + slippageDays (manual)
```

Both sources are shown separately in the breakdown so teams can distinguish "we added scope" from "we underestimated." When `bufferUsed > bufferDays` the bar turns red and shows the overrun amount.

## UI Patterns

- **Themes**: Light/dark objects (`LT` / `DKT`), auto-detected from system preference, manually togglable. All colors reference the theme — no hardcoded values in components.
- **Typography**: DM Sans (body) + DM Mono (numbers/data) via Google Fonts `<link>`.
- **Modals**: Overlay with backdrop-click-to-close. Used for project settings, add/edit scope, add risk, add change, snapshot label, snapshot restore (confirm and failure/partial).
- **Persistence**: Single JSON blob to localStorage on every state change. Loaded once on mount. Key: `project-tracker-v6`.
- **Snapshot load guard**: on mount, each entry in `snapshots[]` is run through `migrateSnapshot` then `validateSnapshot` (both in `src/lib/logic.js`). Invalid entries are dropped with a console warning — they never reach React state.
- **Clipboard copy feedback**: a shared `copiedId` state drives the "✓ Copied" flash on all copy buttons; auto-resets after 1.5 s via `setTimeout`.
- **Summary tiles**: five tiles below the header — On Track, At Risk, Blocked, Buffer (left/overrun), Past Deadline. "Past Deadline" shows the count of incomplete scopes whose `endWeek > totalWeeks`; it is amber when non-zero, muted when zero. 100%-complete scopes (`hill === 1`) are never counted as past deadline.

## Deferred / Out of Scope

- **Automatic scheduled snapshots** (e.g. every Sunday) — requires a background timer or service worker
- **Multi-device sync** — planned via Automerge/Yjs CRDT over a shared drive
- **Bandwidth planning** — per-member availability modelling, over-allocation detection

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
│   ├── Snapshots/
│   │   ├── SnapshotList.jsx
│   │   ├── SnapshotCompare.jsx
│   │   └── SnapshotTrends.jsx
│   └── ui/              # Modal, Field, Pill, Sparkline, HelpBanner, Button
├── hooks/
│   ├── useProjectData.js
│   └── useTheme.js
└── lib/
    ├── theme.js
    ├── defaults.js
    ├── buffer.js
    ├── snapshots.js
    └── dates.js
```
