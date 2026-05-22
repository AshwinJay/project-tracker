# Plan

## Pending

### Bug fixes / behaviour

### UX clarity / simplification


- **Unsaved indicator + snapshot-before-save prompt**: see [docs/PLAN-SNAPSHOT-SAVE.md](PLAN-SNAPSHOT-SAVE.md)

### Larger features


- **Capacity, slippage, and buffer — unified model**: schedule pressure currently comes from three disconnected sources (scope Changes, late-running scopes in Timeline, and a manually entered slippage field in Project Settings) with no shared calculation and no capacity model underneath. The goal is one authoritative number for slippage, derived from first principles, surfaced clearly.
  - **Single slippage source**: derive slippage automatically — from approved Changes with schedule impact, from scopes running behind their hill position, and from capacity shortfalls (see below) — rather than requiring manual entry; keep the override field only as an escape hatch
  - **Capacity model**: each team member has a weekly availability (e.g. 80% = 4 days/week) that can vary by date range (vacations, part-time periods); availability entries live in Project Settings per member
  - **Demand from scopes**: derive person-weeks of committed demand from each scope's `startWeek`→`endWeek` and owner; when committed demand exceeds available capacity in a given week, surface the shortfall as predicted slippage days feeding the same buffer calculation
  - **Unified buffer panel**: replace the current Schedule Buffer section with a single panel showing all inputs (capacity shortfalls, scope overruns, approved Changes) and the derived buffer remaining; make it obvious why the number moves
  - **Over-allocation view**: a Timeline overlay or dedicated view showing available vs. committed days per member per week; highlight over-allocated weeks and show how many buffer days each shortfall consumes at current pace

