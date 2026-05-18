# Project Tracker

Single-file React app (`src/index.html`) that combines hill chart, burndown, timeline, risk register, and change log into one interconnected view. All data persists to `localStorage`.

## Tech

- React 18 + Recharts via local UMD bundles in `src/vendor/`
- Babel standalone compiles the inline `<script type="text/babel">` at runtime — no build step
- No backend, no dependencies to install

## Running

Open `src/index.html` directly in a browser (`file://` works).

## Structure

- `src/index.html` — entire app (React components, data, themes, modals)
- `src/vendor/` — bundled dependencies (React, ReactDOM, Recharts, prop-types, Babel)
- `docs/ARCHITECTURE.md` — data model and component design
- `docs/PLAN.md` — planned improvements

## Key details

- `prop-types` must load before `Recharts.js` — Recharts' dev UMD build calls `PropTypes.shape()` at init
- localStorage key is `project-tracker-v6`; changing it resets all saved data
- All six views share the same state — approving a change in the Change Log immediately updates the buffer bar
