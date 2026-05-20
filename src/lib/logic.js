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
    return (scopes || []).filter(function(s) { return s.endWeek > totalWeeks; });
  }

  /* ─── Snapshot schema ─── */

  var SCOPE_STATUSES = ["on-track", "at-risk", "blocked"];
  var SNAPSHOT_REQUIRED = ["id", "timestamp", "label", "schemaVersion", "project", "scopes", "risks", "changes"];
  var PROJECT_REQUIRED  = ["startDate", "endDate", "currentWeek", "bufferDays"];

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
    validateSnapshot: validateSnapshot,
    migrateSnapshot: migrateSnapshot,
    filterValidSnapshots: filterValidSnapshots,
    fmtSnapTime: fmtSnapTime,
    diffScopes: diffScopes,
    diffRisks: diffRisks,
    diffChanges: diffChanges,
    buildSnapSummaryMd: buildSnapSummaryMd,
    buildDiffSummaryMd: buildDiffSummaryMd,
    buildSnapTrendData: buildSnapTrendData
  };
});
