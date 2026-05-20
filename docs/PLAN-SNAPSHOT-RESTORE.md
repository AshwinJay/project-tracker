# Plan: Snapshot restore UX

The snapshot schema foundation (`validateSnapshot`, `migrateSnapshot`, `filterValidSnapshots`) is done. What's missing is:
1. A **Restore** button in the snapshot list
2. The success path (valid snapshot → confirm → apply)
3. The failure path (invalid snapshot → field-level errors → partial restore or abort)

---

## Step 1 — New `logic.js` function: `buildPartialRestore`

Add `buildPartialRestore(snap, live)` that accepts a (possibly invalid) snapshot and the current live state, and returns what can safely be restored plus a list of skipped items:

```js
// Returns { project, scopes, risks, changes, skipped[] }
// project: snap.project merged over live (missing fields fall back to live values)
// scopes:  snap.scopes filtered to only valid entries
// risks:   snap.risks filtered to non-null objects (or live.risks if not an array)
// changes: snap.changes filtered to non-null objects (or live.changes if not an array)
// skipped: human-readable strings, e.g. "scopes[2]: hill must be 0–1"
```

Partial semantics:
- `project` missing entirely → `skipped` notes it, use `live.project` unchanged
- `project.bufferDays` missing → use `live.project.bufferDays` as fallback, restore other fields
- `scopes[i]` invalid → drop that scope, add a note to `skipped`
- `risks` / `changes` not an array → keep `live.risks` / `live.changes`

Export it the same way as other logic functions.

---

## Step 2 — Tests for `buildPartialRestore`

Add test cases in `tests/logic.test.js` covering:
- Fully valid snapshot → full restore, no skipped
- Missing `project.bufferDays` → project restored with live fallback, noted in skipped
- `scopes[1]` with bad `hill` value → that scope dropped, others restored
- `risks` is not an array → live risks kept, noted in skipped
- Snapshot is `null` → all live values returned, everything noted as skipped

---

## Step 3 — UI state

Add to the main `App` component:

```js
const [restoreModal, setRestoreModal] = useState(null);
// null | { snap }                      ← valid path: show confirm
// null | { snap, errors, partial }     ← invalid path: show failure+partial offer
```

One state atom covers both modals — the presence of `errors` distinguishes the two cases.

---

## Step 4 — "Restore" button in snapshot list rows

Add alongside the existing Copy md / Compare / Delete buttons:

```jsx
{!isPendDel && <button onClick={() => handleRestoreClick(snap)}>Restore</button>}
```

`handleRestoreClick(snap)`:
1. Run `validateSnapshot(snap)`
2. If valid → `setRestoreModal({ snap })` (opens confirm modal)
3. If invalid → `setRestoreModal({ snap, errors: result.errors, partial: buildPartialRestore(snap, { project, scopes, risks, changes }) })` (opens failure modal)

---

## Step 5 — Restore confirmation modal (valid path)

Simple overlay modal:

> **Restore snapshot**
> Restore *"Week 3 Checkpoint"*? This will replace your current project, scopes, risks, and changes.
>
> [Restore]  [Cancel]

On confirm:
```js
setProject(snap.project);
setScopes(snap.scopes);
setRisks(snap.risks);
setChanges(snap.changes);
setRestoreModal(null);
setCopiedId("__restored__");   // reuse the flash mechanism with a distinct id
```

Use the existing `copiedId` / `setTimeout` pattern to flash "✓ Restored" on the Restore button for 1.5 s.

---

## Step 6 — Restore failure modal (invalid path)

Overlay modal with three sections:

**Section A — Errors** (why the snapshot failed):
```
Could not fully restore "Week 3 Checkpoint":
• scopes[2]: hill must be 0–1, got 1.4
• project.bufferDays: missing
```

**Section B — Partial restore summary**:
```
Partial restore would apply:
  ✓ Project settings (bufferDays from current state)
  ✓ 4 of 5 scopes
  ✓ Risks
  ✓ Change log
  ✗ scopes[2] "Auth service" — skipped (invalid hill)
```

**Section C — Actions**:

> [Restore partial]  [Abort]

"Restore partial" applies `partial.project / .scopes / .risks / .changes` then closes the modal with the same "✓ Restored" flash.

"Abort" closes the modal without touching state.

---

## Step 7 — Docs

- **`ARCHITECTURE.md`**: move Snapshot restore out of Deferred, document the restore button, both modal paths, `buildPartialRestore`, and the "Restore" flash mechanism
- **`PLAN.md`**: remove the first item once the feature ships

---

## Scope summary

| File | Change |
|---|---|
| `src/lib/logic.js` | Add `buildPartialRestore` (export it) |
| `tests/logic.test.js` | ~10 new test cases for `buildPartialRestore` |
| `src/index.html` | `restoreModal` state; `handleRestoreClick`; Restore button; two modals |
| `docs/ARCHITECTURE.md` | Document restore UX, move out of Deferred |
| `docs/PLAN.md` | Remove item 1 when done |

No new files needed. No new dependencies. The partial restore logic is pure and testable in isolation.
