# Snapshot Reports — Implementation Plan

## Goal

Turn the existing "📸 Snapshot" button (which only appends a hill value to each scope's `history` array) into a full project-state checkpoint system with comparison views, trend charts, and exportable stakeholder summaries.

---

## Current state (baseline)

- `snapshot()` function exists in `App` — appends `s.hill` to `s.history[]` for sparklines only
- No full-state capture, no timestamp, no label, no list
- `scopes[].history` is the only time-series data stored
- Persisted state key: `project-tracker-v6`

---

## Phase 0 — Schema foundation (prerequisite from item 2) `effort: done`

**Goal:** Establish a versioned, validated snapshot structure before any snapshots are written. This is the minimum slice of the "Snapshot schema, versioning, and validation" plan item that must exist first — the full item 2 work (restore failure UX, field-level error display, partial restore) is a separate effort built on top of this.

### 0.1 Add `schemaVersion` to the snapshot object

Every snapshot gets a `schemaVersion: 1` field (integer). This is the anchor for all future migrations.

### 0.2 `validateSnapshot(obj)` in `logic.js`

A pure function that checks:
- Required top-level fields present: `id`, `timestamp`, `label`, `schemaVersion`, `project`, `scopes`, `risks`, `changes`
- `schemaVersion` is a positive integer
- `project` has `startDate`, `endDate`, `currentWeek`, `bufferDays`
- `scopes` is an array; each entry has `id`, `name`, `hill` (0–1), `status` (valid enum)

Returns `{ valid: boolean, errors: string[] }`. Tested in `logic.test.js`.

### 0.3 `migrateSnapshot(obj)` stub in `logic.js`

A pure function keyed by version: `if (obj.schemaVersion === 1) return obj` (identity for now). The pattern is in place for future v1→v2 migrations without touching call sites.

### 0.4 Load-time guard

On `loadData`, run each entry in `snapshots[]` through `migrateSnapshot` then `validateSnapshot`. Skip (and log to console) any that fail validation — don't crash or drop the whole array. The user never sees an error for this in Phase 0; that UX is part of item 2.

### 0.5 Deliverable

A stable, versioned snapshot schema is in place. Phase 1 can write snapshots with confidence they'll survive a future format change.

**Effort:** Small — two pure functions + tests, one guard in `loadData`.

---

## Phase 1 — Data model + full-state capture

**Goal:** Every snapshot stores a complete, timestamped copy of project state. Depends on Phase 0.

### 1.1 Snapshot schema

Add a top-level `snapshots` array to the persisted blob:

```js
{
  project: {...},
  scopes: [...],
  risks: [...],
  changes: [...],
  snapshots: [          // NEW — append only, never mutated after creation
    {
      schemaVersion: 1,            // set by Phase 0; enables future migrations
      id: "snap_<ms-timestamp>",   // e.g. "snap_1716000000000"
      timestamp: "<ISO-8601>",     // e.g. "2026-05-18T10:30:00.000Z"
      label: string,               // user-provided, defaults to "Week N — <date>"
      project: { ...full copy },
      scopes:  [ ...full copy ],
      risks:   [ ...full copy ],
      changes: [ ...full copy ],
      burnActuals: { [week]: number }, // captured at snapshot time; needed for Phase 4 overlay
    }
  ]
}
```

Key points:
- No `localStorage` key change — `snapshots` defaults to `[]` for existing data, so old saves load fine
- Snapshots are immutable after creation (never patched in-place)
- Each snapshot is ~the same size as the current state blob; 50 snapshots ≈ 250 KB — well within localStorage limits

### 1.2 State changes in `App`

- Add `useState([])` for `snapshots`, loaded/saved alongside the rest
- Update `loadData` / `saveData` calls to include `snapshots`
- Keep `scopes[].history` appending in `snapshot()` for sparklines — just also capture the full state

### 1.3 Upgrade `snapshot()` with a label modal

Replace the fire-and-forget `snapshot()` click handler with a two-step flow:

1. Click 📸 → opens a small modal (`modal === "snapshot"`)
2. Modal shows: auto-generated label (e.g. "Week 3 — May 18") in an editable text field + "Save Snapshot" button
3. On confirm: append hill values to `history[]` (existing behaviour) **and** push a full-state snapshot to `snapshots[]`

### 1.4 Deliverable

After Phase 1, every 📸 click saves a named, full-fidelity, versioned checkpoint. No UI to view them yet, but data is accumulating correctly and is safe to migrate forward.

**Effort:** Small — one new `useState`, one new modal, one upgraded function.

---

## Phase 2 — Snapshot list & management

**Goal:** Surface the snapshot history as a browsable list with basic management actions.

### 2.1 New "Snapshots" tab

Add `{id: "snapshots", label: "Snapshots (" + snapshots.length + ")"}` to the tab bar (between "Changes" and any future tabs).

### 2.2 Snapshot list view

Each row shows:
- Label + timestamp (formatted as "Mon May 18, 2026 · 10:30 AM")
- Scope count, buffer consumed, how many at-risk/blocked
- "Compare →" button (see Phase 3)
- Delete button (with a brief confirmation)

Snapshots are listed newest-first.

### 2.3 "Compare vs. current" shortcut

One-click option on each snapshot row: compare that snapshot against the **live** current state. This is the most common workflow (how has the project changed since last week's checkpoint?).

### 2.4 Deliverable

After Phase 2, users can see all snapshots, understand what each one captured at a glance, and delete ones they no longer need.

**Effort:** Small-medium — new tab content, list rendering, delete handler.

---

## Phase 3 — Diff / comparison view

**Goal:** Side-by-side structured diff between any two snapshots (or a snapshot vs. current state).

### 3.1 Selection UI

From the Snapshots list, the user picks "Compare →" on one snapshot, then the tab enters a two-panel header:

```
Compare:  [Week 2 — May 11 ▾]  vs.  [Current State ▾]   ← dropdowns
```

Both dropdowns list all snapshots + "Current State" as an option. "Current State" is always an option in the right-hand dropdown.

### 3.2 Diff summary bar

Five stat tiles at the top:

| Metric | Value |
|---|---|
| Scopes added | +N |
| Scopes removed | −N |
| Buffer remaining | X → Y days (Δ) |
| Slippage | X → Y days |
| At-risk / blocked | N → M |

Color-coded: green = improved, amber/red = worse.

### 3.3 Scope-by-scope diff table

One row per scope (union of both snapshots' scope sets):

| Scope | Status | Hill % | Start | End | Change |
|---|---|---|---|---|---|
| Auth | on-track → at-risk | 40% → 62% | W1 | W5 → W6 | end slipped |
| Payments _(new)_ | on-track | — → 20% | W3 | W7 | added |
| Old Feature _(removed)_ | — | 80% → — | W2 | W4 | removed |

Rows are grouped: changed first, then unchanged (collapsed by default with a "Show N unchanged" toggle).

### 3.4 Risk diff

Simple before/after risk count, plus any risks that were added or removed (by title match).

### 3.5 Changes diff

List of change-log entries that were added or whose status changed between the two snapshots.

### 3.6 Deliverable

After Phase 3, teams can do a structured sprint retrospective directly in the tool.

**Effort:** Medium — new component, diff logic (pure functions, testable), comparison state.

---

## Phase 4 — Trend charts

**Goal:** Visualise project health over the full snapshot history.

All charts live in a "Trends" sub-section within the Snapshots tab (a secondary pill-style sub-nav: `List | Trends`).

### 4.1 Scope count over time

Line chart: X = snapshot timestamp, Y = total scope count. Shows scope creep (or scope reduction) trend.

### 4.2 Status distribution over time

Stacked bar chart: X = snapshot, Y = count. Three bars per snapshot: on-track (green), at-risk (amber), blocked (red). Instantly shows if the project is getting healthier or more stressed.

### 4.3 Burndown overlay across snapshots

In the existing Burndown tab, add an option: "Overlay snapshots." When enabled, each snapshot's `burnActuals` at the time it was taken is drawn as a faint dashed line behind the current actuals line. This shows how the actual burn rate has shifted across snapshots.

> **Note:** This requires storing `burnActuals` in each snapshot. Add it to the Phase 1 schema:
> `burnActuals: { [week]: percentRemaining }` — captured from current state at snapshot time.

### 4.4 Buffer trend

Line chart: X = snapshot, Y = buffer remaining (days). Shows buffer erosion over the cycle.

### 4.5 Deliverable

After Phase 4, the trend view answers the core question: "Is this project getting better or worse sprint over sprint?"

**Effort:** Medium — four Recharts components, all from existing data already captured in Phase 1 (+ `burnActuals` addition to schema).

---

## Phase 5 — Export

**Goal:** One-click stakeholder update from a snapshot or diff.

### 5.1 Snapshot summary export (Markdown)

"Copy summary" button on any snapshot. Produces clipboard-ready Markdown:

```markdown
## Project Status — Week 3 · May 18, 2026

**Project:** Acme · Platform Rebuild (Cycle 4)
**Snapshot:** Week 3 Checkpoint
**Period:** W1 May 5 → W8 Jun 27

### Scope health
| Status | Count |
|---|---|
| On track | 5 |
| At risk | 2 |
| Blocked | 1 |

### Buffer
Planned: 10 days · Used: 4 days · Remaining: **6 days**

### Scopes
| Scope | Owner | Status | Progress |
|---|---|---|---|
| Auth | MR | on-track | 62% |
...

### Active risks
- [elevated] Scope creep from stakeholder feedback — owner: MR
```

### 5.2 Diff export (Markdown)

Same "Copy summary" button on the diff view. Produces a change-oriented narrative:

```markdown
## Change summary: Week 2 → Week 3

### What changed
- **Auth** moved from on-track → at-risk; end date slipped W5→W6
- **Payments** added (on-track, W3–W7)

### Buffer: 8d → 6d (−2d)
### At-risk + blocked: 1 → 3
```

### 5.3 JSON export

"Download JSON" button on the Snapshots list exports the full `snapshots[]` array as a `.json` file (via `URL.createObjectURL` / `<a download>`). Useful for archiving or importing into another tool.

### 5.4 Deliverable

After Phase 5, teams can paste a weekly status update into Slack/email in seconds.

**Effort:** Small — string template functions (pure, testable), Clipboard API, one blob download.

---

## Implementation order & dependencies

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
                                        ↘
                                         Phase 5 (can start after Phase 3)
```

Phase 0 (schema foundation) is the prerequisite for everything — it ensures snapshots written in Phase 1 are safe to compare and migrate later. Phase 1 is the data foundation for all UI phases. Phases 3–5 can be built in parallel once Phase 2 is done.

The remaining item 2 work (restore failure UX, field-level validation messages, partial restore) builds on Phase 0 and is planned separately.

---

## Changes to existing files

| File | Change |
|---|---|
| `src/index.html` | Phases 1–5: new state, new tab, new components, new modals |
| `src/lib/logic.js` | Phase 0: `validateSnapshot`, `migrateSnapshot`; Phase 3: diff functions |
| `tests/logic.test.js` | Phase 0: validator tests; Phase 3: diff function tests |
| `docs/ARCHITECTURE.md` | After Phase 1: document snapshot schema and new state field |
| `PLAN.md` | Mark `Snapshot schema` done after Phase 0; mark `Snapshot reports` done after Phase 5 |

---

## Out of scope for this plan

- Automatic scheduled snapshots (e.g. every Sunday) — requires a background timer or service worker; deferred
- Snapshot import / restore (applying a snapshot back to live state) — covered by the "Snapshot schema, versioning, and validation" plan item (restore failure UX, partial restore)
- Full item 2 work: field-level validation error display, restore failure diff, partial restore offer — builds on Phase 0 and is planned separately
- Cloud sync or sharing snapshots across devices — part of the CRDT sync plan item
