# Plan

## Pending

### Bug fixes / behaviour

- **Snapshot charts overflow horizontally**: the Scope Count and Buffer Remaining (days) charts in the Snapshots view scroll past the horizontal window boundary; constrain them to the viewport width

- **Snapshots Trends tab tooltip truncates text**: the tooltip/pop-up that appears over chart elements does not show the full label — the box is too small and cuts off the content; allow it to grow to fit or wrap the text

### UX clarity / simplification


- **Indicate unsnapshotted changes**: all edits auto-save to localStorage immediately, so there are no "unsaved changes" — but the user has no way to know whether their current state has diverged from the last snapshot. Show a subtle indicator (e.g. a dot on the Snapshots tab or a banner) when live state differs from the most recent snapshot. Clarify in the UI (tooltip or footer) that data is always auto-saved locally and snapshots are manual checkpoints for history and comparison.

- **Remove Reset button** *(addressed by PLAN-STORAGE.md — Reset replaced by Open / Save / Sample)*: remove the Reset button from the UI

### Larger features

- **File-based project storage**: make the `.json` file the source of truth instead of localStorage, so projects can be created fresh, saved explicitly, and shared freely — solving multi-project and multi-device use in one move. Active plan: `docs/PLAN-STORAGE.md`.
  - **Blank start** *(in progress)*: first load shows an empty project with placeholder prompts, not demo data; the user explicitly creates or opens a project
  - **Schema-aware demo file** *(in progress)*: `src/demo.json` with full project data and `schemaVersion`; validated by `validateProjectFile` in `logic.js`; usable for load, demo, test, and save
  - **Open / Save** *(in progress)*: toolbar actions to open a `.json` file (via `<input type="file">`) and save current state as a download
  - **Save As / File System Access API**: save back to the same open file; prompt "Reopen last file?" on reload instead of silently restoring from localStorage
  - **File as source of truth**: localStorage stays as a session cache only (prevents losing work between page refreshes); the open file is the explicit source of truth
  - **Multi-project**: multiple projects = multiple files; the OS file picker is the project picker — no in-app project list needed
  - **Multi-device / multi-author**: sharing a project means sharing the file (email, Drive, Dropbox, etc.); a "merge from file" action handles the collaborative case without requiring a CRDT layer
  - **Migration**: on first run, if localStorage holds existing data (`project-tracker-v6`), offer it as an unsaved project with a prompt to save it to a file

- **Capacity, slippage, and buffer — unified model**: schedule pressure currently comes from three disconnected sources (scope Changes, late-running scopes in Timeline, and a manually entered slippage field in Project Settings) with no shared calculation and no capacity model underneath. The goal is one authoritative number for slippage, derived from first principles, surfaced clearly.
  - **Single slippage source**: derive slippage automatically — from approved Changes with schedule impact, from scopes running behind their hill position, and from capacity shortfalls (see below) — rather than requiring manual entry; keep the override field only as an escape hatch
  - **Capacity model**: each team member has a weekly availability (e.g. 80% = 4 days/week) that can vary by date range (vacations, part-time periods); availability entries live in Project Settings per member
  - **Demand from scopes**: derive person-weeks of committed demand from each scope's `startWeek`→`endWeek` and owner; when committed demand exceeds available capacity in a given week, surface the shortfall as predicted slippage days feeding the same buffer calculation
  - **Unified buffer panel**: replace the current Schedule Buffer section with a single panel showing all inputs (capacity shortfalls, scope overruns, approved Changes) and the derived buffer remaining; make it obvious why the number moves
  - **Over-allocation view**: a Timeline overlay or dedicated view showing available vs. committed days per member per week; highlight over-allocated weeks and show how many buffer days each shortfall consumes at current pace

