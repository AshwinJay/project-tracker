// Copyright 2026 Ashwin Jayaprakash
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    var lib = factory();
    Object.keys(lib).forEach(function(k) { root[k] = lib[k]; });
  }
})(typeof window !== 'undefined' ? window : global, function() {

  /* ─── Date / week helpers ─── */

  function weeksFrom(s, e) {
    try {
      var w = Math.ceil((new Date(e) - new Date(s)) / (7 * 864e5));
      return isNaN(w) ? 8 : Math.max(1, w);
    } catch(x) { return 8; }
  }

  function fmtD(iso) {
    try { return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {month:"short", day:"numeric"}); }
    catch(x) { return iso; }
  }

  /* ─── Impact / buffer ─── */

  function parseImpactDays(str) {
    var n = parseInt(String(str || "").replace(/[^\-\d]/g, ""), 10);
    return isNaN(n) ? 0 : n;
  }

  function computeScopeChangeDays(changes) {
    var approved = (changes || []).filter(function(c) { return c.status === "approved"; });
    var adds = 0, saves = 0, net = 0;
    approved.forEach(function(c) {
      var d = parseImpactDays(c.impact);
      net += d;
      if (d > 0) adds += d;
      if (d < 0) saves += Math.abs(d);
    });
    return { adds: adds, saves: saves, net: net };
  }

  function computeBuffer(bufferDays, slippageDays, netDays) {
    var bD = bufferDays || 0, bSl = slippageDays || 0, bSc = netDays || 0;
    var bufferUsed = Math.max(0, bSc + bSl);
    var bufferRem = Math.max(0, bD - bufferUsed);
    var bufferPct = bD > 0 ? (bufferUsed / bD) * 100 : 0;
    var bufferOver = bufferUsed > bD;
    return { bufferUsed: bufferUsed, bufferRem: bufferRem, bufferPct: bufferPct, bufferOver: bufferOver };
  }

  /* ─── Burndown ─── */

  function makeBurndown(totalW, curW, actuals) {
    var maxW = totalW;
    var keys = Object.keys(actuals);
    for (var k = 0; k < keys.length; k++) { maxW = Math.max(maxW, Number(keys[k])); }
    return Array.from({length: maxW}, function(_, i) {
      var w = i + 1;
      var a = w <= curW ? (actuals[w] !== undefined ? actuals[w] : null) : null;
      return {
        day: "W" + w,
        ideal: Math.max(0, Math.round(100 - (100 / Math.max(totalW - 1, 1)) * i)),
        actual: a
      };
    });
  }

  function buildBurnActuals(snapshots, scopes, curW) {
    if (!curW || curW < 1) return {};
    var known = {};
    (snapshots || []).forEach(function(snap) {
      var w = snap && snap.project && snap.project.currentWeek;
      if (!w || !Array.isArray(snap.scopes) || snap.scopes.length === 0) return;
      var avg = snap.scopes.reduce(function(s, sc) { return s + (sc.hill || 0); }, 0) / snap.scopes.length;
      known[w] = 100 - avg * 100;
    });
    if (Array.isArray(scopes) && scopes.length > 0) {
      var avg = scopes.reduce(function(s, sc) { return s + (sc.hill || 0); }, 0) / scopes.length;
      known[curW] = 100 - avg * 100;
    }
    if (Object.keys(known).length === 0) return {};
    // Anchor week 1 at 100% if no earlier data point exists
    var minW = Math.min.apply(null, Object.keys(known).map(Number));
    if (minW > 1) known[1] = 100;
    var knownWeeks = Object.keys(known).map(Number).sort(function(a, b) { return a - b; });
    // Fill every week 1..curW by linear interpolation between known points
    var result = {};
    for (var w = 1; w <= curW; w++) {
      if (known[w] !== undefined) { result[w] = known[w]; continue; }
      var lo = null, hi = null;
      for (var i = 0; i < knownWeeks.length; i++) {
        if (knownWeeks[i] < w) lo = knownWeeks[i];
        if (knownWeeks[i] > w && hi === null) hi = knownWeeks[i];
      }
      if (lo !== null && hi !== null) {
        var t = (w - lo) / (hi - lo);
        result[w] = known[lo] * (1 - t) + known[hi] * t;
      } else {
        result[w] = lo !== null ? known[lo] : known[hi];
      }
    }
    return result;
  }

  /* ─── Risk ─── */

  function riskSeverity(prob, impact) {
    if (prob === "high" && impact === "high") return "critical";
    if (prob === "high" || impact === "high") return "elevated";
    return "moderate";
  }

  /* ─── Status cycling ─── */

  var STATUS_ORDER = ["on-track", "at-risk", "blocked"];
  var CHANGE_STATUS_ORDER = ["pending", "approved", "rejected"];

  function cycleStatus(status) {
    var idx = STATUS_ORDER.indexOf(status);
    return STATUS_ORDER[(idx < 0 ? 0 : idx + 1) % STATUS_ORDER.length];
  }

  function cycleCStatus(status) {
    var idx = CHANGE_STATUS_ORDER.indexOf(status);
    return CHANGE_STATUS_ORDER[(idx < 0 ? 0 : idx + 1) % CHANGE_STATUS_ORDER.length];
  }

  /* ─── Timeline filter ─── */

  function toggleTlFilter(filter, status) {
    var f = filter || [];
    if (f.indexOf(status) >= 0) {
      return f.filter(function(x) { return x !== status; });
    }
    return f.concat([status]);
  }

  /* ─── Scope derived values ─── */

  function computeStatusCounts(scopes) {
    var c = { "on-track": 0, "at-risk": 0, "blocked": 0 };
    (scopes || []).forEach(function(s) { if (c[s.status] !== undefined) c[s.status]++; });
    return c;
  }

  function computeOverScopes(scopes, totalWeeks) {
    return (scopes || []).filter(function(s) { return s.endWeek > totalWeeks && s.hill < 1; });
  }

  /* ─── Snapshot schema ─── */

  var SCOPE_STATUSES = ["on-track", "at-risk", "blocked"];
  var SNAPSHOT_REQUIRED = ["id", "timestamp", "label", "schemaVersion", "project", "scopes", "risks", "changes"];
  var PROJECT_REQUIRED  = ["startDate", "endDate", "currentWeek", "bufferDays"];
  var RISK_LEVELS       = ["low", "medium", "high"];
  var CHANGE_STATUSES   = ["pending", "approved", "rejected"];

  /* ─── Project file schema (v1) ─── */

  var PROJECT_FILE_SCHEMA = {
    schemaVersion: { type: "positiveInteger", required: true },
    project: {
      type: "object", required: true,
      fields: {
        title:       { type: "string" },
        cycle:       { type: "string" },
        startDate:   { type: "string", required: true },
        endDate:     { type: "string", required: true },
        currentWeek: { type: "number", required: true },
        bufferDays:  { type: "number", required: true },
        slippageDays:{ type: "number" }
      }
    },
    scopes: {
      type: "array",
      itemFields: {
        id:        { type: "string", required: true },
        name:      { type: "string", required: true },
        hill:      { type: "number", required: true, min: 0, max: 1 },
        status:    { type: "enum",   required: true, values: SCOPE_STATUSES },
        owner:     { type: "string" },
        startWeek: { type: "number" },
        endWeek:   { type: "number" },
        history:   { type: "array"  }
      }
    },
    risks: {
      type: "array",
      itemFields: {
        id:         { type: "string", required: true },
        title:      { type: "string", required: true },
        prob:       { type: "enum",   required: true, values: RISK_LEVELS },
        impact:     { type: "enum",   required: true, values: RISK_LEVELS },
        mitigation: { type: "string" },
        owner:      { type: "string" }
      }
    },
    changes: {
      type: "array",
      itemFields: {
        id:     { type: "string", required: true },
        title:  { type: "string", required: true },
        impact: { type: "string", required: true },
        status: { type: "enum",   required: true, values: CHANGE_STATUSES },
        date:   { type: "string" },
        scope:  { type: "string" }
      }
    },
    snapshots: { type: "array" }
  };

  function _validateItemArray(arr, key, itemFields, errors) {
    if (arr === undefined) return;
    if (!Array.isArray(arr)) { errors.push(key + " must be an array"); return; }
    arr.forEach(function(item, i) {
      var pfx = key + "[" + i + "]";
      if (!item || typeof item !== "object") { errors.push(pfx + ": not an object"); return; }
      Object.keys(itemFields).forEach(function(f) {
        var spec = itemFields[f];
        var val = item[f];
        var absent = (val === undefined || val === null || val === "");
        if (spec.required && absent) { errors.push(pfx + ": missing " + f); return; }
        if (absent) return;
        if (spec.type === "number" && spec.min !== undefined) {
          if (typeof val !== "number" || val < spec.min || val > spec.max)
            errors.push(pfx + ": " + f + " must be 0–1, got " + val);
        }
        if (spec.type === "enum" && spec.values.indexOf(val) < 0)
          errors.push(pfx + ": invalid " + f + " \"" + val + "\"");
      });
    });
  }

  function validateProjectFile(obj) {
    var errors = [];
    if (!obj || typeof obj !== "object") {
      return { valid: false, errors: ["not an object"] };
    }
    if (typeof obj.schemaVersion !== "number" ||
        obj.schemaVersion < 1 ||
        obj.schemaVersion !== Math.floor(obj.schemaVersion)) {
      errors.push("schemaVersion must be a positive integer");
    }
    if (!obj.project || typeof obj.project !== "object") {
      errors.push("missing: project");
    } else {
      var pFields = PROJECT_FILE_SCHEMA.project.fields;
      Object.keys(pFields).forEach(function(f) {
        if (pFields[f].required && (obj.project[f] === undefined || obj.project[f] === null))
          errors.push("missing: project." + f);
      });
    }
    _validateItemArray(obj.scopes,   "scopes",   PROJECT_FILE_SCHEMA.scopes.itemFields,   errors);
    _validateItemArray(obj.risks,    "risks",     PROJECT_FILE_SCHEMA.risks.itemFields,    errors);
    _validateItemArray(obj.changes,  "changes",   PROJECT_FILE_SCHEMA.changes.itemFields,  errors);
    if (obj.snapshots !== undefined && !Array.isArray(obj.snapshots))
      errors.push("snapshots must be an array");
    return { valid: errors.length === 0, errors: errors };
  }

  function migrateProjectFile(obj) {
    if (!obj || typeof obj !== "object") return obj;
    // v1 is current — no migrations exist yet
    return obj;
  }

  function validateSnapshot(obj) {
    var errors = [];
    if (!obj || typeof obj !== "object") {
      return { valid: false, errors: ["not an object"] };
    }
    SNAPSHOT_REQUIRED.forEach(function(f) {
      if (obj[f] === undefined || obj[f] === null) errors.push("missing: " + f);
    });
    if (typeof obj.schemaVersion !== "number" ||
        obj.schemaVersion < 1 ||
        obj.schemaVersion !== Math.floor(obj.schemaVersion)) {
      if (errors.indexOf("missing: schemaVersion") < 0) {
        errors.push("schemaVersion must be a positive integer");
      }
    }
    if (obj.project && typeof obj.project === "object") {
      PROJECT_REQUIRED.forEach(function(f) {
        if (obj.project[f] === undefined || obj.project[f] === null) {
          errors.push("missing: project." + f);
        }
      });
    }
    if (obj.scopes !== undefined && !Array.isArray(obj.scopes)) {
      errors.push("scopes must be an array");
    } else if (Array.isArray(obj.scopes)) {
      obj.scopes.forEach(function(s, i) {
        if (!s || typeof s !== "object") {
          errors.push("scopes[" + i + "]: not an object");
          return;
        }
        if (!s.id)   errors.push("scopes[" + i + "]: missing id");
        if (!s.name) errors.push("scopes[" + i + "]: missing name");
        if (typeof s.hill !== "number" || s.hill < 0 || s.hill > 1) {
          errors.push("scopes[" + i + "]: hill must be 0–1, got " + s.hill);
        }
        if (SCOPE_STATUSES.indexOf(s.status) < 0) {
          errors.push("scopes[" + i + "]: invalid status \"" + s.status + "\"");
        }
      });
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function migrateSnapshot(obj) {
    if (!obj || typeof obj !== "object") return obj;
    // v1 is current — no migrations exist yet
    return obj;
  }

  function filterValidSnapshots(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function(s) {
      return migrateSnapshot(s);
    }).filter(function(s) {
      var result = validateSnapshot(s);
      if (!result.valid) {
        try { console.warn("[snapshot] skipping invalid entry", s && s.id, result.errors); } catch(x) {}
      }
      return result.valid;
    });
  }

  function buildPartialRestore(snap, live) {
    var skipped = [];

    // project: merge snap over live, fall back to live for any missing required field
    var project;
    if (!snap || typeof snap !== "object" || !snap.project || typeof snap.project !== "object") {
      skipped.push("project: missing — using current state");
      project = live.project;
    } else {
      project = Object.assign({}, live.project, snap.project);
      PROJECT_REQUIRED.forEach(function(f) {
        if (snap.project[f] === undefined || snap.project[f] === null) {
          skipped.push("project." + f + ": missing — kept current value");
          project[f] = live.project[f];
        }
      });
    }

    // scopes: filter to valid entries only, drop invalid with a note
    var scopes;
    if (!snap || !Array.isArray(snap.scopes)) {
      skipped.push("scopes: not an array — using current state");
      scopes = live.scopes;
    } else {
      scopes = snap.scopes.filter(function(s, i) {
        if (!s || typeof s !== "object") {
          skipped.push("scopes[" + i + "]: not an object — skipped");
          return false;
        }
        var errs = [];
        if (!s.id)   errs.push("missing id");
        if (!s.name) errs.push("missing name");
        if (typeof s.hill !== "number" || s.hill < 0 || s.hill > 1) errs.push("hill must be 0–1");
        if (SCOPE_STATUSES.indexOf(s.status) < 0) errs.push("invalid status");
        if (errs.length > 0) {
          skipped.push("scopes[" + i + "] \"" + (s.name || s.id || "?") + "\": " + errs.join(", ") + " — skipped");
          return false;
        }
        return true;
      });
    }

    // risks: use snap array if present, otherwise fall back to live
    var risks;
    if (!snap || !Array.isArray(snap.risks)) {
      skipped.push("risks: not an array — using current state");
      risks = live.risks;
    } else {
      risks = snap.risks.filter(function(r) { return r && typeof r === "object"; });
    }

    // changes: use snap array if present, otherwise fall back to live
    var changes;
    if (!snap || !Array.isArray(snap.changes)) {
      skipped.push("changes: not an array — using current state");
      changes = live.changes;
    } else {
      changes = snap.changes.filter(function(c) { return c && typeof c === "object"; });
    }

    return { project: project, scopes: scopes, risks: risks, changes: changes, skipped: skipped };
  }

  /* ─── Snapshot diff ─── */

  function fmtSnapTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("en-US", {weekday:"short",month:"short",day:"numeric",year:"numeric"}) +
             " · " + d.toLocaleTimeString("en-US", {hour:"numeric",minute:"2-digit"});
    } catch(x) { return iso; }
  }

  function diffScopes(stateA, stateB) {
    var sA = stateA.scopes || [], sB = stateB.scopes || [];
    var mA = {}, mB = {};
    sA.forEach(function(s) { mA[s.id] = s; });
    sB.forEach(function(s) { mB[s.id] = s; });
    var seen = {}, ids = [];
    sA.forEach(function(s) { if (!seen[s.id]) { seen[s.id] = true; ids.push(s.id); } });
    sB.forEach(function(s) { if (!seen[s.id]) { seen[s.id] = true; ids.push(s.id); } });
    return ids.map(function(id) {
      var a = mA[id] || null, b = mB[id] || null;
      var changed = !!(a && b && (a.status !== b.status || a.hill !== b.hill ||
                       a.endWeek !== b.endWeek || a.startWeek !== b.startWeek));
      return { id: id, name: (b || a).name, a: a, b: b,
               added: !a && !!b, removed: !!a && !b, changed: changed };
    });
  }

  function diffRisks(stateA, stateB) {
    var rA = stateA.risks || [], rB = stateB.risks || [];
    var titlesA = rA.map(function(r) { return r.title; });
    var titlesB = rB.map(function(r) { return r.title; });
    return {
      countA: rA.length,
      countB: rB.length,
      added:   rB.filter(function(r) { return titlesA.indexOf(r.title) < 0; }),
      removed: rA.filter(function(r) { return titlesB.indexOf(r.title) < 0; })
    };
  }

  function diffChanges(stateA, stateB) {
    var cA = stateA.changes || [], cB = stateB.changes || [];
    var mA = {};
    cA.forEach(function(c) { mA[c.id] = c; });
    return {
      added:         cB.filter(function(c) { return !mA[c.id]; }),
      statusChanged: cB.filter(function(c) { return mA[c.id] && mA[c.id].status !== c.status; })
    };
  }

  /* ─── Snapshot export (Markdown) ─── */

  function buildSnapSummaryMd(snap) {
    var p = snap.project || {};
    var scopes = snap.scopes || [];
    var risks = snap.risks || [];
    var changes = snap.changes || [];
    var scd = computeScopeChangeDays(changes);
    var buf = computeBuffer(p.bufferDays || 0, p.slippageDays || 0, scd.net);
    var counts = computeStatusCounts(scopes);
    var lines = [];
    lines.push("## Project Status — W" + (p.currentWeek || "?") + " · " + (snap.label || ""));
    lines.push("");
    var projectLine = [p.title, p.cycle].filter(Boolean).join(" · ");
    if (projectLine) lines.push("**Project:** " + projectLine);
    lines.push("**Snapshot:** " + (snap.label || ""));
    if (p.startDate && p.endDate) {
      lines.push("**Period:** " + fmtD(p.startDate) + " → " + fmtD(p.endDate));
    }
    lines.push("");
    lines.push("### Scope health");
    lines.push("| Status | Count |");
    lines.push("|---|---|");
    lines.push("| On track | " + counts["on-track"] + " |");
    lines.push("| At risk | " + counts["at-risk"] + " |");
    lines.push("| Blocked | " + counts["blocked"] + " |");
    lines.push("");
    lines.push("### Buffer");
    lines.push("Planned: " + (p.bufferDays || 0) + "d · Used: " + buf.bufferUsed + "d · Remaining: **" + buf.bufferRem + "d**");
    if (scopes.length > 0) {
      lines.push("");
      lines.push("### Scopes");
      lines.push("| Scope | Owner | Status | Progress |");
      lines.push("|---|---|---|---|");
      scopes.forEach(function(s) {
        lines.push("| " + s.name + " | " + (s.owner || "—") + " | " + s.status + " | " + Math.round(s.hill * 100) + "% |");
      });
    }
    if (risks.length > 0) {
      lines.push("");
      lines.push("### Active risks");
      risks.forEach(function(r) {
        var sev = riskSeverity(r.prob, r.impact);
        lines.push("- [" + sev + "] " + r.title + (r.owner ? " — owner: " + r.owner : ""));
      });
    }
    return lines.join("\n");
  }

  function buildDiffSummaryMd(labelA, labelB, scopeDiffs, bufA, bufB, atRA, atRB, rDiff, cDiff) {
    var lines = [];
    lines.push("## Change summary: " + labelA + " → " + labelB);
    lines.push("");
    var changed = [];
    (scopeDiffs || []).forEach(function(d) {
      if (d.added) {
        changed.push("- **" + d.name + "** added (" + d.b.status + ", W" + d.b.startWeek + "–W" + d.b.endWeek + ")");
      } else if (d.removed) {
        changed.push("- **" + d.name + "** removed");
      } else if (d.changed) {
        var parts = [];
        if (d.a.status !== d.b.status) parts.push("moved from " + d.a.status + " → " + d.b.status);
        if (d.a.endWeek !== d.b.endWeek) parts.push("end date slipped W" + d.a.endWeek + "→W" + d.b.endWeek);
        if (parts.length > 0) changed.push("- **" + d.name + "** " + parts.join("; "));
      }
    });
    ((rDiff && rDiff.added) || []).forEach(function(r) { changed.push("- Risk added: " + r.title); });
    ((rDiff && rDiff.removed) || []).forEach(function(r) { changed.push("- Risk removed: " + r.title); });
    ((cDiff && cDiff.added) || []).forEach(function(c) { changed.push("- Change added: " + c.title + " (" + c.impact + ")"); });
    ((cDiff && cDiff.statusChanged) || []).forEach(function(c) { changed.push("- " + c.title + ": → " + c.status); });
    lines.push("### What changed");
    if (changed.length > 0) {
      changed.forEach(function(l) { lines.push(l); });
    } else {
      lines.push("No changes.");
    }
    lines.push("");
    var bufDelta = (bufB.bufferRem || 0) - (bufA.bufferRem || 0);
    lines.push("### Buffer: " + (bufA.bufferRem || 0) + "d → " + (bufB.bufferRem || 0) + "d (" + (bufDelta >= 0 ? "+" : "") + bufDelta + "d)");
    var arDelta = (atRB || 0) - (atRA || 0);
    lines.push("### At-risk + blocked: " + (atRA || 0) + " → " + (atRB || 0) + (arDelta !== 0 ? " (" + (arDelta > 0 ? "+" : "") + arDelta + ")" : ""));
    return lines.join("\n");
  }

  /* ─── Snapshot trend data ─── */

  function buildSnapTrendData(snapshots) {
    return (snapshots || []).map(function(s) {
      var scd = computeScopeChangeDays(s.changes);
      var buf = computeBuffer(s.project.bufferDays, s.project.slippageDays || 0, scd.net);
      var lbl = s.label || "";
      var shortLabel = lbl.length > 14 ? lbl.slice(0, 14) + "…" : lbl;
      return {
        label: shortLabel,
        fullLabel: lbl,
        scopes: (s.scopes || []).length,
        ontrack: (s.scopes || []).filter(function(x) { return x.status === "on-track"; }).length,
        atrisk:  (s.scopes || []).filter(function(x) { return x.status === "at-risk";  }).length,
        blocked: (s.scopes || []).filter(function(x) { return x.status === "blocked";  }).length,
        buffer: buf.bufferRem
      };
    });
  }

  /* ─── Scope state mutations (pure) ─── */

  function addScope(scopes, form, curW, totalWeeks, id) {
    var newScope = {
      id: id || ("s" + Date.now()),
      name: form.name || "New Scope",
      hill: 0.05,
      status: "on-track",
      owner: ((form.owner || "??").slice(0, 2)).toUpperCase(),
      startWeek: parseInt(form.startWeek, 10) || curW,
      endWeek: parseInt(form.endWeek, 10) || totalWeeks,
      history: [0.05]
    };
    return (scopes || []).concat([newScope]);
  }

  function editScope(scopes, form) {
    return (scopes || []).map(function(s) {
      if (s.id !== form.id) return s;
      return Object.assign({}, s, {
        name: form.name || s.name,
        owner: ((form.owner || s.owner).slice(0, 2)).toUpperCase(),
        startWeek: parseInt(form.startWeek, 10) || s.startWeek,
        endWeek: parseInt(form.endWeek, 10) || s.endWeek,
        status: form.status || s.status
      });
    });
  }

  function snapshotScopes(scopes) {
    return (scopes || []).map(function(s) {
      return Object.assign({}, s, { history: (s.history || []).concat([s.hill]) });
    });
  }

  function updateHill(scopes, id, val) {
    return (scopes || []).map(function(s) {
      if (s.id !== id) return s;
      var rounded = Math.round(val * 100) / 100;
      var h = (s.history || []).slice();
      h[h.length - 1] = rounded;
      return Object.assign({}, s, { hill: rounded, history: h });
    });
  }

  return {
    weeksFrom: weeksFrom,
    fmtD: fmtD,
    parseImpactDays: parseImpactDays,
    makeBurndown: makeBurndown,
    buildBurnActuals: buildBurnActuals,
    computeScopeChangeDays: computeScopeChangeDays,
    computeBuffer: computeBuffer,
    riskSeverity: riskSeverity,
    cycleStatus: cycleStatus,
    cycleCStatus: cycleCStatus,
    toggleTlFilter: toggleTlFilter,
    computeStatusCounts: computeStatusCounts,
    computeOverScopes: computeOverScopes,
    addScope: addScope,
    editScope: editScope,
    snapshotScopes: snapshotScopes,
    updateHill: updateHill,
    PROJECT_FILE_SCHEMA: PROJECT_FILE_SCHEMA,
    validateProjectFile: validateProjectFile,
    migrateProjectFile: migrateProjectFile,
    validateSnapshot: validateSnapshot,
    migrateSnapshot: migrateSnapshot,
    filterValidSnapshots: filterValidSnapshots,
    buildPartialRestore: buildPartialRestore,
    fmtSnapTime: fmtSnapTime,
    diffScopes: diffScopes,
    diffRisks: diffRisks,
    diffChanges: diffChanges,
    buildSnapSummaryMd: buildSnapSummaryMd,
    buildDiffSummaryMd: buildDiffSummaryMd,
    buildSnapTrendData: buildSnapTrendData
  };
});
