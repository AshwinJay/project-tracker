# Project Tracker

## Running

Open `src/index.html` in a browser (`file://` works, no build step).

## Key files

- `src/index.html` — entire app: React components, state, themes, modals
- `src/vendor/` — local UMD bundles: React 18, ReactDOM, Recharts, prop-types, Babel standalone
- `docs/ARCHITECTURE.md` — full technical reference

## Gotchas

- `prop-types` must load before `Recharts.js` — Recharts' dev UMD build calls `PropTypes.shape()` at init and throws without it
- localStorage key is `project-tracker-v6`; changing it drops all saved data

## Keeping docs in sync

When making changes, update the relevant doc:

- **README.md** — intro and view list only; keep it brief
- **ARCHITECTURE.md** — the main reference; update when the data model, derived values, views, buffer logic, or component structure changes
- **CLAUDE.md** — this file; bare bones only (how to run, key files, gotchas, doc guidance)
- **PLAN.md** — add items when new work is identified; mark done items with `` `effort: done` ``
