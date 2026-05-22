# Plan

## Pending

### Bug fixes / behaviour

- **Snapshots Trends tab tooltip truncates text**: the tooltip/pop-up that appears over chart elements does not show the full label — the box is too small and cuts off the content; allow it to grow to fit or wrap the text

### UX clarity / simplification


- **Indicate unsnapshotted changes**: all edits write to localStorage immediately (session cache), so work is never lost on refresh — but the user has no way to know whether their current state has diverged from the last snapshot. Show a subtle indicator (e.g. a dot on the Snapshots tab or a banner) when live state differs from the most recent snapshot. Clarify in the UI (tooltip or footer) that localStorage auto-saves your session and snapshots are manual history checkpoints; the `.json` file (via File → Save) is the portable source of truth.

### Larger features


- **Capacity, slippage, and buffer — unified model**: schedule pressure currently comes from three disconnected sources (scope Changes, late-running scopes in Timeline, and a manually entered slippage field in Project Settings) with no shared calculation and no capacity model underneath. The goal is one authoritative number for slippage, derived from first principles, surfaced clearly.
  - **Single slippage source**: derive slippage automatically — from approved Changes with schedule impact, from scopes running behind their hill position, and from capacity shortfalls (see below) — rather than requiring manual entry; keep the override field only as an escape hatch
  - **Capacity model**: each team member has a weekly availability (e.g. 80% = 4 days/week) that can vary by date range (vacations, part-time periods); availability entries live in Project Settings per member
  - **Demand from scopes**: derive person-weeks of committed demand from each scope's `startWeek`→`endWeek` and owner; when committed demand exceeds available capacity in a given week, surface the shortfall as predicted slippage days feeding the same buffer calculation
  - **Unified buffer panel**: replace the current Schedule Buffer section with a single panel showing all inputs (capacity shortfalls, scope overruns, approved Changes) and the derived buffer remaining; make it obvious why the number moves
  - **Over-allocation view**: a Timeline overlay or dedicated view showing available vs. committed days per member per week; highlight over-allocated weeks and show how many buffer days each shortfall consumes at current pace

