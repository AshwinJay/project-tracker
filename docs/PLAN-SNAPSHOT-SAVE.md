# Plan: Unsaved Changes Indicator + Snapshot-Before-Save Prompt

## Context

**Two distinct concepts:**
- **Unsaved** = state has changed since the last file write (Save / Save As / Open). The existing sessionBanner covers "never saved to a file at all"; this indicator covers "you've changed things since your last save."
- **Unsnapshotted** = state has changed since the last snapshot. Snapshots are weekly milestones for Trends/Compare; saves are frequent throughout the week.

**Intended workflow:** user makes incremental changes → saves frequently → at week-end takes a snapshot → saves again to persist the snapshot. The app should guide this by (a) showing a dot when unsaved, and (b) offering to take a snapshot before saving when there are unsnapshotted changes.

---

## New state

```js
// JSON of state at the last file save/open — used to detect dirty
var [lastSavedJson, setLastSavedJson] = useState(null);

// "save" | "saveAs" | null — set when user confirms "snapshot then save"
var [pendingSaveAction, setPendingSaveAction] = useState(null);
```

---

## Computed values (useMemo)

### `isDirty`
Truthy only when a file is associated (`fileName` is set) and current state differs from what was last written:

```js
var isDirty = useMemo(function() {
  if (!fileName || !lastSavedJson) return false;
  return JSON.stringify({project, scopes, risks, changes, snapshots}) !== lastSavedJson;
}, [fileName, lastSavedJson, project, scopes, risks, changes, snapshots]);
```

### `hasUnsnapshottedChanges`
Checks whether anything meaningful changed since the last snapshot. Excludes `history` from scopes (it's appended at snapshot time and would always differ):

```js
var hasUnsnapshottedChanges = useMemo(function() {
  if (!snapshots.length) return false;
  var last = snapshots[snapshots.length - 1];
  function strip(s) { var c = Object.assign({}, s); delete c.history; return c; }
  return (
    JSON.stringify(project) !== JSON.stringify(last.project) ||
    JSON.stringify(scopes.map(strip)) !== JSON.stringify(last.scopes.map(strip)) ||
    JSON.stringify(risks) !== JSON.stringify(last.risks) ||
    JSON.stringify(changes) !== JSON.stringify(last.changes)
  );
}, [snapshots, project, scopes, risks, changes]);
```

---

## Modified functions

### `_applyFileData` (~line 349)
After the existing `setSessionBanner(false)`, record the baseline for dirty tracking:
```js
setLastSavedJson(JSON.stringify({
  project: migrated.project || project,
  scopes: migrated.scopes || scopes,
  risks: migrated.risks || risks,
  changes: migrated.changes || changes,
  snapshots: migrated.snapshots ? filterValidSnapshots(migrated.snapshots) : snapshots
}));
```

### `saveFile` (~line 382)
Before writing, check for unsnapshotted changes and prompt. If no prompt needed (or user skips snapshot), write and update baseline:

```
function saveFile() {
  if (hasUnsnapshottedChanges) {
    setPendingSaveAction("save");
    setModal("confirmSnapshotSave");
    return;
  }
  _doSaveFile();
}

function _doSaveFile() {
  // ... existing write logic ...
  // on success: setLastSavedJson(JSON.stringify({project,scopes,risks,changes,snapshots}));
}
```

`setPendingSaveAction(null)` is called after the write regardless of path.

### `saveFileAs` (~line 389)
Same pattern as `saveFile` — intercept to check `hasUnsnapshottedChanges`, then in the `.then()` success callback: `setLastSavedJson(JSON.stringify({...}))`.

### `saveSnapshot` (~line 339)
After `setModal(null)` at the end, consume the pending save action:
```js
if (pendingSaveAction === "saveAs") { setPendingSaveAction(null); saveFileAs(); }
else if (pendingSaveAction === "save") { setPendingSaveAction(null); _doSaveFile(); }
```

### `newProject` / `loadDemo`
Add `setLastSavedJson(null)` and `setPendingSaveAction(null)` alongside the existing `setFileName(null)`.

---

## New modal: `"confirmSnapshotSave"`

A small confirm dialog shown when saving with unsnapshotted changes. Three actions:
- **Snapshot & Save** — calls `openSnapshot()` (which sets the label and opens the snapshot modal); `pendingSaveAction` stays set so `saveSnapshot` triggers the save afterwards
- **Save without Snapshot** — `setPendingSaveAction(null)`, call `_doSaveFile()` directly
- **Cancel** — `setPendingSaveAction(null)`, `setModal(null)`

UI copy: *"You have changes since your last snapshot. Take a snapshot to capture this state in Trends before saving?"*

---

## UI changes

### Filename display (~line 490)
Show a dot when `isDirty`:
```jsx
{fileName && (
  <span style={{...existing...}} title={fileName}>
    {isDirty && <span style={{color: t.amber}}>● </span>}
    {fileName}
  </span>
)}
```

### File menu Save button (~line 469)
Highlight when dirty — amber dot prefix on the "Save" label:
```jsx
<button onClick={saveFile} style={{color: isDirty ? t.amber : undefined}}>
  {isDirty && "● "}Save
</button>
```

### Snapshot buttons
Show an amber dot when `hasUnsnapshottedChanges` — on both the floating Hill Chart button (~line 559) and the File menu item (~line 477):
```jsx
{hasUnsnapshottedChanges && <span style={{color:"#f59e0b",marginRight:4}}>●</span>}
Snapshot
```

---

## Files to modify

- `src/index.html` only — two new state vars, two new memos, modified `_applyFileData` / `saveFile` / `saveFileAs` / `saveSnapshot` / `newProject` / `loadDemo`, one new modal block, three UI tweaks

---

## Verification

1. Open file → make a scope change → amber dot appears next to filename and on Save menu item
2. Save → dot disappears
3. Make another change → dot reappears → click Save → "Snapshot & Save?" modal appears (because no snapshot of these changes)
4. Click "Save without Snapshot" → saves immediately, dot disappears
5. Make a change → Save → modal → click "Snapshot & Save" → snapshot label modal opens → confirm → snapshot saved → file saved → both dots gone
6. Snapshot button shows amber dot when changes exist since last snapshot; dot disappears after taking a snapshot
7. New project / load demo → no dots, no dirty state
