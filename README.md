# Project Tracker

A project management tool that combines the signals that predict whether a project will land on time into one interconnected view, instead of spreading them across separate tools.

## Views

- **Hill Chart** — confidence signal per scope, draggable; captures whether the team knows what they're building yet
- **Burndown** — remaining work vs. ideal trajectory; the gap is schedule risk consuming buffer
- **Schedule Buffer** — padding tracked explicitly, consumed by scope changes (auto) + slippage (manual)
- **Change Log** — scope changes with schedule impact; approving a change immediately moves the buffer bar
- **Risk Register** — probability × impact matrix with mitigation plans and auto-derived severity
- **Timeline** — Gantt-style scope time windows with overflow detection and progress fill
- **Snapshots** — full-state checkpoints with comparison diffs, trend charts, and one-click Markdown export

## Running

Open `src/index.html` in a browser. No build step, no server required.

## Docs

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — data model, derived values, component design, buffer system, implementation notes
- **[docs/PLAN.md](docs/PLAN.md)** — planned improvements by area
