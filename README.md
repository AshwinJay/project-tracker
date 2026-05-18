# Project Tracker

A project management tool that puts the signals that actually predict whether a project will land on time into a single view — instead of spreading them across five different tools.

## The Problem

Most project trackers are good at one thing. Jira tracks tickets. Basecamp's hill chart tracks confidence. A spreadsheet tracks your risk register. A burndown lives in its own dashboard. Buffer and scope changes live in someone's head or a Slack thread.

The result is that the PM is the only person who holds the full picture, and they maintain it by context-switching between tools and doing mental arithmetic to connect the dots. When stakeholders ask "are we on track?" the answer requires assembling information from multiple places, and by the time you've assembled it, it's already stale.

## What This Does

This tracker combines six concepts into one interconnected view:

**Hill Chart** — each scope of work sits on a curve. Left side means you're still figuring out the approach. Right side means it's known work and you're just executing. You drag dots to update. This captures something ticket counts can't: whether the team actually knows what they're building yet.

**Burndown** — the classic remaining-work-over-time chart. Shows the gap between where you planned to be and where you actually are. That gap is one of two things eating your buffer.

**Schedule Buffer** — explicit tracking of the padding built into your schedule. Buffer gets consumed from two sources, and the tracker shows both: scope changes (auto-calculated from the change log) and slippage (manual, based on the burndown gap). When the bar fills up, your deadline is at risk.

**Change Log** — every scope addition, removal, or modification gets logged with its schedule impact in days. Changes start as pending, get approved or rejected, and approved changes automatically feed the buffer calculation. This closes the loop between "stakeholder asked for a new feature" and "that's why we're behind."

**Risk Register** — what could go wrong, how likely, how bad, and what you're doing about it. Severity is auto-derived from the probability/impact combination.

**Timeline** — a Gantt-style view of scope time windows. Shows progress fill, flags scopes that extend past the cycle deadline, and highlights the current week.

The key idea is that these aren't separate views of separate data — they're interconnected. Approve a change and the buffer bar moves. A scope running past its time window shows up as overflow on the timeline, a warning in the header, and a deadline marker on the burndown. Everything that matters for "are we on track?" is visible without switching tools.

## Docs

**[ARCHITECTURE.md](./ARCHITECTURE.md)** — data model, derived value calculations, how each view works, component structure, hill chart math, buffer system logic. Start here if you're building or extending.

**[PLAN.md](./PLAN.md)** — future improvements organized by area and tagged with effort. Covers auto-calculating burndown from hill data, dependency tracking, mobile UX, integrations, and more.

## Current State

This is a working prototype built as a single React component (`project-tracker.jsx`). All data persists across sessions. It's fully interactive — draggable hill chart, editable scopes, clickable status pills, add/remove everything, configurable project settings with live buffer math preview.

It's not production software yet. The main gaps: single-file component that needs to be broken into modules, no backend (uses browser-level key-value storage), burndown data is sample data rather than derived from scope progress, and no multi-user support.

## Tech

React, Recharts (burndown only), custom SVG (hill chart, sparklines, timeline). No other dependencies. Light/dark theme with system preference detection.
