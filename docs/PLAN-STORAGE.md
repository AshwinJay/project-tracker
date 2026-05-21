# Plan: File-based Project Storage

**Backlog item being addressed:**
> **File-based project storage** — make the `.json` file the source of truth instead of localStorage, so projects can be created fresh, saved explicitly, and shared freely.

**Sub-item in scope for this plan:**
> **Blank start** — first load shows an empty project with placeholder prompts, not demo data; plus a schema-aware validated demo file usable for load/demo/test/save.

---

## Decision: localStorage role

localStorage stays, but its role changes:
- **Before**: localStorage IS the storage; demo data is the fallback when empty.
- **After**: localStorage is a **session cache** — autosaves on every state change so a page refresh doesn't lose unsaved work. It is no longer the source of truth.
- On first load with no localStorage → blank project (no demo data).
- On first load with localStorage data → load it (your previous session's cache, as today).
- File open/save is the explicit source of truth going forward.

---

## Files to create / modify

### 1. `src/lib/logic.js` — add file-level validation

Add three new constants and two new functions after the existing `SCOPE_STATUSES` / `PROJECT_REQUIRED` block:

```js
var RISK_LEVELS     = ["low", "medium", "high"];
var CHANGE_STATUSES = ["pending", "approved", "rejected"];
```

**`validateProjectFile(obj)`** — validates the full project file:
- `schemaVersion`: positive integer
- `project`: object; required sub-fields `startDate`, `endDate`, `currentWeek`, `bufferDays`
- `scopes`: array; each item must have `id`, `name`, `hill` (0–1), `status` (enum)
- `risks`: array; each item must have `id`, `title`, `prob` (enum), `impact` (enum)
- `changes`: array; each item must have `id`, `title`, `impact`, `status` (enum)
- `snapshots`: optional array; presence checked but entries not re-validated here

**`migrateProjectFile(obj)`** — identity stub (v1 is current, no migrations yet)

Export both from the UMD module.

---

### 2. `src/demo.json` — canonical demo file (new)

All current demo data (`DEF_PROJECT`, `DEF_SCOPES`, `DEF_RISKS`, `DEF_CHANGES`) exported as a validated JSON file:

```json
{
  "schemaVersion": 1,
  "project": { "title": "Acme · Platform Rebuild", "cycle": "Cycle 4", "startDate": "2026-05-05", "endDate": "2026-06-27", "currentWeek": 6, "bufferDays": 12, "slippageDays": 4 },
  "scopes": [ ... 7 scopes ... ],
  "risks":  [ ... 4 risks ...  ],
  "changes":[ ... 5 changes .. ],
  "snapshots": []
}
```

This file is the canonical fixture for tests, demos, and file open. When the full Open/Save toolbar is implemented, users can load this via "Open".

---

### 3. `src/index.html` — blank start + file I/O

**Constants:**
- Rename `DEF_PROJECT / DEF_SCOPES / DEF_RISKS / DEF_CHANGES` → `DEMO_*` (signals "demo data", not "defaults")
- Add `BLANK_PROJECT = { title:"", cycle:"", startDate:"", endDate:"", currentWeek:1, bufferDays:0, slippageDays:0 }`
- Add `BLANK_SCOPES = []; BLANK_RISKS = []; BLANK_CHANGES = [];`

**State initialisation:**
- Change `useState(DEF_PROJECT)` → `useState(BLANK_PROJECT)` etc.
- Mount load from localStorage remains unchanged — overwrites blank state if prior session data exists

**New functions:**
- `loadDemo()` — sets state to `DEMO_*` constants (works from `file://`)
- `newProject()` — sets state to `BLANK_*` constants (replaces `resetAll`)
- `openFile()` — clicks the hidden `<input type="file">`
- `handleFileOpen(e)` — reads file, JSON.parse, `migrateProjectFile`, `validateProjectFile`, sets state or shows error
- `saveFile()` — builds `{ schemaVersion:1, project, scopes, risks, changes, snapshots }`, downloads as `<project-title>.json`

**Toolbar changes:**
- Remove `↺ Reset` button
- Add `Open` | `Save` | `Sample` buttons (Open → file picker, Save → download, Sample → loadDemo)

**Header guard:**
- `project.title || "Untitled Project"` in the `<h1>`
- Sub-line: if `startDate` is blank, show "Click ✎ to configure"; otherwise show the normal cycle/date/week line

**Empty scope list:**
- When `scopes.length === 0`, show a hint row: "No scopes yet — click + Scope to add one, or load a sample project."

**Hidden file input:**
- `<input ref={fileInputRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFileOpen}/>`

---

### 4. `tests/logic.test.js` — new tests

- Import `validateProjectFile`, `migrateProjectFile` from logic.js
- `const demoFile = require("../src/demo.json");`
- Add describe block `validateProjectFile`:
  - demo.json passes validation
  - missing `schemaVersion` → invalid
  - non-integer `schemaVersion` → invalid
  - missing `project` → invalid
  - missing required project field → invalid
  - `scopes` not array → invalid
  - scope with bad `hill` (out of range) → invalid
  - scope with invalid `status` → invalid
  - `risks` not array → invalid
  - risk with invalid `prob`/`impact` → invalid
  - `changes` not array → invalid
  - change with invalid `status` → invalid
  - `snapshots` missing (optional) → valid
  - empty `scopes`/`risks`/`changes` arrays → valid
- Add describe block `migrateProjectFile`:
  - identity for valid object
  - returns arg for null/non-object

---

## Build order

1. `src/lib/logic.js` — add constants + functions + exports
2. `src/demo.json` — create
3. `tests/logic.test.js` — add tests (run `npm test` to verify)
4. `src/index.html` — blank start + file I/O + toolbar + header guard + empty state

---

## Out of scope for this plan

The remaining backlog sub-items are deferred to follow-on plans:
- File System Access API (persist file handle, autosave back to open file)
- "Reopen last file" prompt on reload
- Migration path for existing localStorage data
- Multi-device merge-from-file action
