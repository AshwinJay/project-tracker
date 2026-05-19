# Project Tracker

## Running

Open `src/index.html` in a browser (`file://` works, no build step).

## Key files

- `src/index.html` — entire app: React components, state, themes, modals
- `src/lib/logic.js` — pure logic functions (UMD); shared by the browser app and the test suite
- `src/vendor/` — local UMD bundles: React 18, ReactDOM, Recharts, prop-types, Babel standalone
- `docs/ARCHITECTURE.md` — full technical reference

## Testing

```
npm install   # first time only
npm test      # runs Jest (88 tests in tests/logic.test.js)
```

Tests cover all pure logic: date helpers, burndown generation, buffer math, risk severity, status cycling, timeline filter, and all scope state mutations.

## Gotchas

- `prop-types` must load before `Recharts.js` — Recharts' dev UMD build calls `PropTypes.shape()` at init and throws without it
- localStorage key is `project-tracker-v6`; changing it drops all saved data
- Pure logic lives in `src/lib/logic.js` (loaded as a global before the Babel block); do not re-define those functions inside the Babel script

## Keeping docs in sync

When making changes, update the relevant doc:

- **README.md** — intro and view list only; keep it brief
- **ARCHITECTURE.md** — the main reference; update when the data model, derived values, views, buffer logic, or component structure changes
- **CLAUDE.md** — this file; bare bones only (how to run, key files, gotchas, doc guidance)
- **docs/PLAN.md** — add items when new work is identified; mark done items with `` `effort: done` ``
