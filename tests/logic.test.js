"use strict";

const {
  weeksFrom,
  fmtD,
  parseImpactDays,
  makeBurndown,
  computeScopeChangeDays,
  computeBuffer,
  riskSeverity,
  cycleStatus,
  cycleCStatus,
  toggleTlFilter,
  computeStatusCounts,
  computeOverScopes,
  addScope,
  editScope,
  snapshotScopes,
  updateHill,
  validateSnapshot,
  migrateSnapshot,
  filterValidSnapshots,
  diffScopes,
  diffRisks,
  diffChanges,
  buildSnapTrendData,
  buildSnapSummaryMd,
  buildDiffSummaryMd,
} = require("../src/lib/logic");

// ── Sample fixtures ──────────────────────────────────────────────────────────

const DEF_SCOPES = [
  {id:"s1",name:"Auth & Permissions",hill:.82,status:"on-track",owner:"MR",startWeek:1,endWeek:5,history:[.1,.25,.4,.58,.72,.82]},
  {id:"s2",name:"Data Pipeline",hill:.55,status:"on-track",owner:"KL",startWeek:1,endWeek:7,history:[.08,.15,.28,.38,.48,.55]},
  {id:"s3",name:"Dashboard UI",hill:.35,status:"at-risk",owner:"JT",startWeek:2,endWeek:8,history:[.05,.12,.18,.24,.35]},
  {id:"s4",name:"Notifications",hill:.18,status:"on-track",owner:"AS",startWeek:3,endWeek:9,history:[.04,.09,.18]},
  {id:"s5",name:"Reporting Engine",hill:.68,status:"blocked",owner:"DP",startWeek:1,endWeek:6,history:[.1,.22,.38,.55,.65,.68]},
  {id:"s6",name:"API v2 Migration",hill:.92,status:"on-track",owner:"MR",startWeek:1,endWeek:4,history:[.2,.4,.6,.78,.88,.92]},
  {id:"s7",name:"Search & Filters",hill:.45,status:"on-track",owner:"KL",startWeek:2,endWeek:10,history:[.05,.15,.28,.38,.45]},
];

// c1(+2d approved), c2(+3d approved), c3(-4d approved), c4(+5d pending), c5(+1d rejected)
const DEF_CHANGES = [
  {id:"c1",date:"May 02",title:"Add export-to-CSV",impact:"+2d",status:"approved",scope:"Reporting Engine"},
  {id:"c2",date:"May 06",title:"SSO requirement added",impact:"+3d",status:"approved",scope:"Auth & Permissions"},
  {id:"c3",date:"May 10",title:"Remove legacy widget support",impact:"-4d",status:"approved",scope:"Dashboard UI"},
  {id:"c4",date:"May 14",title:"Real-time collab editing",impact:"+5d",status:"pending",scope:"Dashboard UI"},
  {id:"c5",date:"May 16",title:"Webhook retry logic",impact:"+1d",status:"rejected",scope:"Notifications"},
];


// ── weeksFrom ────────────────────────────────────────────────────────────────

describe("weeksFrom", () => {
  test("project cycle: May 5 to Jun 27 → 8 weeks", () => {
    expect(weeksFrom("2026-05-05", "2026-06-27")).toBe(8);
  });

  test("same day → minimum 1", () => {
    expect(weeksFrom("2026-05-05", "2026-05-05")).toBe(1);
  });

  test("exactly 7 days → 1 week", () => {
    expect(weeksFrom("2026-05-05", "2026-05-12")).toBe(1);
  });

  test("8 days → 2 weeks", () => {
    expect(weeksFrom("2026-05-05", "2026-05-13")).toBe(2);
  });

  test("14 days → 2 weeks", () => {
    expect(weeksFrom("2026-05-05", "2026-05-19")).toBe(2);
  });

  test("15 days → 3 weeks", () => {
    expect(weeksFrom("2026-05-05", "2026-05-20")).toBe(3);
  });

  test("invalid date → fallback 8", () => {
    expect(weeksFrom("not-a-date", "also-bad")).toBe(8);
  });
});


// ── fmtD ─────────────────────────────────────────────────────────────────────

describe("fmtD", () => {
  test("May date", () => {
    expect(fmtD("2026-05-05")).toBe("May 5");
  });

  test("December date", () => {
    expect(fmtD("2026-12-25")).toBe("Dec 25");
  });

  test("January date", () => {
    expect(fmtD("2026-01-01")).toBe("Jan 1");
  });

  test("double-digit day", () => {
    expect(fmtD("2026-06-27")).toBe("Jun 27");
  });
});


// ── parseImpactDays ───────────────────────────────────────────────────────────

describe("parseImpactDays", () => {
  test("+3d → 3", () => { expect(parseImpactDays("+3d")).toBe(3); });
  test("-2d → -2", () => { expect(parseImpactDays("-2d")).toBe(-2); });
  test("+0d → 0", () => { expect(parseImpactDays("+0d")).toBe(0); });
  test("bare integer string → number", () => { expect(parseImpactDays("5d")).toBe(5); });
  test("large negative", () => { expect(parseImpactDays("-10d")).toBe(-10); });
  test("no digits → 0", () => { expect(parseImpactDays("abc")).toBe(0); });
  test("empty string → 0", () => { expect(parseImpactDays("")).toBe(0); });
  test("null/undefined coerced → 0", () => { expect(parseImpactDays(null)).toBe(0); });
});


// ── makeBurndown ──────────────────────────────────────────────────────────────

describe("makeBurndown", () => {
  const actuals = {1:100, 2:92, 3:81, 4:73, 5:62, 6:48};

  test("returns one entry per week up to totalWeeks", () => {
    const data = makeBurndown(8, 6, actuals);
    expect(data.length).toBe(8);
  });

  test("week labels are W1..W8", () => {
    const data = makeBurndown(8, 6, actuals);
    expect(data.map(d => d.day)).toEqual(["W1","W2","W3","W4","W5","W6","W7","W8"]);
  });

  test("ideal starts at 100 and ends at 0", () => {
    const data = makeBurndown(8, 6, actuals);
    expect(data[0].ideal).toBe(100);
    expect(data[data.length - 1].ideal).toBe(0);
  });

  test("ideal is non-increasing", () => {
    const data = makeBurndown(8, 6, actuals);
    for (let i = 1; i < data.length; i++) {
      expect(data[i].ideal).toBeLessThanOrEqual(data[i - 1].ideal);
    }
  });

  test("actual filled for weeks <= curW using actuals map", () => {
    const data = makeBurndown(8, 6, actuals);
    expect(data[0].actual).toBe(100);
    expect(data[5].actual).toBe(48);
  });

  test("actual is null for weeks > curW", () => {
    const data = makeBurndown(8, 6, actuals);
    expect(data[6].actual).toBeNull();
    expect(data[7].actual).toBeNull();
  });

  test("actual is null for curW week with no actuals entry", () => {
    const data = makeBurndown(8, 4, {1:100, 2:90});
    // weeks 3 and 4 are <= curW but not in actuals
    expect(data[2].actual).toBeNull();
    expect(data[3].actual).toBeNull();
  });

  test("extends beyond totalWeeks when actuals has later keys", () => {
    const data = makeBurndown(4, 5, {1:100, 2:80, 3:60, 4:40, 5:20});
    expect(data.length).toBe(5);
    expect(data[4].day).toBe("W5");
    expect(data[4].actual).toBe(20);
  });

  test("totalW=1 edge case: ideal is 100 for that single week", () => {
    const data = makeBurndown(1, 1, {1:100});
    expect(data.length).toBe(1);
    expect(data[0].ideal).toBe(100);
    expect(data[0].actual).toBe(100);
  });
});


// ── computeScopeChangeDays ────────────────────────────────────────────────────

describe("computeScopeChangeDays", () => {
  test("DEF_CHANGES: only approved c1(+2), c2(+3), c3(-4) count", () => {
    const result = computeScopeChangeDays(DEF_CHANGES);
    expect(result.net).toBe(1);   // 2+3-4
    expect(result.adds).toBe(5);  // 2+3
    expect(result.saves).toBe(4); // abs(-4)
  });

  test("empty array → zeroes", () => {
    const result = computeScopeChangeDays([]);
    expect(result).toEqual({ adds: 0, saves: 0, net: 0 });
  });

  test("all pending/rejected → zeroes", () => {
    const changes = [
      {impact:"+5d", status:"pending"},
      {impact:"+1d", status:"rejected"},
    ];
    expect(computeScopeChangeDays(changes)).toEqual({ adds: 0, saves: 0, net: 0 });
  });

  test("all positive approved → saves=0, net=adds", () => {
    const changes = [
      {impact:"+2d", status:"approved"},
      {impact:"+3d", status:"approved"},
    ];
    const result = computeScopeChangeDays(changes);
    expect(result).toEqual({ adds: 5, saves: 0, net: 5 });
  });

  test("all negative approved → adds=0, net is negative", () => {
    const changes = [
      {impact:"-4d", status:"approved"},
      {impact:"-2d", status:"approved"},
    ];
    const result = computeScopeChangeDays(changes);
    expect(result).toEqual({ adds: 0, saves: 6, net: -6 });
  });
});


// ── computeBuffer ─────────────────────────────────────────────────────────────

describe("computeBuffer", () => {
  test("normal case: 12d buffer, 4d slippage, 1d net scope → 5d used, 7d remaining", () => {
    const r = computeBuffer(12, 4, 1);
    expect(r.bufferUsed).toBe(5);
    expect(r.bufferRem).toBe(7);
    expect(r.bufferOver).toBe(false);
    expect(r.bufferPct).toBeCloseTo(41.67, 1);
  });

  test("overrun: 12d buffer, 4d slippage, 9d net → 13d used, 0 remaining, overrun", () => {
    const r = computeBuffer(12, 4, 9);
    expect(r.bufferUsed).toBe(13);
    expect(r.bufferRem).toBe(0);
    expect(r.bufferOver).toBe(true);
  });

  test("bufferDays=0 → bufferPct=0, no divide-by-zero", () => {
    const r = computeBuffer(0, 0, 0);
    expect(r.bufferPct).toBe(0);
    expect(r.bufferOver).toBe(false);
  });

  test("negative net (scope savings) reduces consumed, not below 0", () => {
    const r = computeBuffer(12, 2, -5);
    // bufferUsed = max(0, -5+2) = max(0, -3) = 0
    expect(r.bufferUsed).toBe(0);
    expect(r.bufferRem).toBe(12);
  });

  test("exactly at limit is not overrun", () => {
    const r = computeBuffer(10, 5, 5);
    expect(r.bufferUsed).toBe(10);
    expect(r.bufferOver).toBe(false);
    expect(r.bufferRem).toBe(0);
  });

  test("one over limit is overrun", () => {
    const r = computeBuffer(10, 5, 6);
    expect(r.bufferOver).toBe(true);
  });
});


// ── riskSeverity ──────────────────────────────────────────────────────────────

describe("riskSeverity", () => {
  test("high + high → critical", () => {
    expect(riskSeverity("high", "high")).toBe("critical");
  });

  test("high + medium → elevated", () => {
    expect(riskSeverity("high", "medium")).toBe("elevated");
  });

  test("high + low → elevated", () => {
    expect(riskSeverity("high", "low")).toBe("elevated");
  });

  test("medium + high → elevated", () => {
    expect(riskSeverity("medium", "high")).toBe("elevated");
  });

  test("low + high → elevated", () => {
    expect(riskSeverity("low", "high")).toBe("elevated");
  });

  test("medium + medium → moderate", () => {
    expect(riskSeverity("medium", "medium")).toBe("moderate");
  });

  test("low + low → moderate", () => {
    expect(riskSeverity("low", "low")).toBe("moderate");
  });

  test("medium + low → moderate", () => {
    expect(riskSeverity("medium", "low")).toBe("moderate");
  });

  test("low + medium → moderate", () => {
    expect(riskSeverity("low", "medium")).toBe("moderate");
  });
});


// ── cycleStatus ───────────────────────────────────────────────────────────────

describe("cycleStatus", () => {
  test("on-track → at-risk", () => {
    expect(cycleStatus("on-track")).toBe("at-risk");
  });

  test("at-risk → blocked", () => {
    expect(cycleStatus("at-risk")).toBe("blocked");
  });

  test("blocked → on-track", () => {
    expect(cycleStatus("blocked")).toBe("on-track");
  });

  test("full cycle returns to start", () => {
    const s0 = "on-track";
    const s1 = cycleStatus(s0);
    const s2 = cycleStatus(s1);
    const s3 = cycleStatus(s2);
    expect(s3).toBe(s0);
  });
});


// ── cycleCStatus ──────────────────────────────────────────────────────────────

describe("cycleCStatus", () => {
  test("pending → approved", () => {
    expect(cycleCStatus("pending")).toBe("approved");
  });

  test("approved → rejected", () => {
    expect(cycleCStatus("approved")).toBe("rejected");
  });

  test("rejected → pending", () => {
    expect(cycleCStatus("rejected")).toBe("pending");
  });

  test("full cycle returns to start", () => {
    const s0 = "pending";
    const s1 = cycleCStatus(s0);
    const s2 = cycleCStatus(s1);
    const s3 = cycleCStatus(s2);
    expect(s3).toBe(s0);
  });
});


// ── toggleTlFilter ────────────────────────────────────────────────────────────

describe("toggleTlFilter", () => {
  test("removes a status that is present", () => {
    const result = toggleTlFilter(["on-track","at-risk","blocked"], "at-risk");
    expect(result).toEqual(["on-track","blocked"]);
  });

  test("adds a status that is absent", () => {
    const result = toggleTlFilter(["on-track","blocked"], "at-risk");
    expect(result).toEqual(["on-track","blocked","at-risk"]);
  });

  test("removes from single-item array → empty array", () => {
    expect(toggleTlFilter(["on-track"], "on-track")).toEqual([]);
  });

  test("adds to empty array", () => {
    expect(toggleTlFilter([], "blocked")).toEqual(["blocked"]);
  });

  test("does not mutate the original array", () => {
    const original = ["on-track","at-risk"];
    toggleTlFilter(original, "at-risk");
    expect(original).toEqual(["on-track","at-risk"]);
  });
});


// ── computeStatusCounts ───────────────────────────────────────────────────────

describe("computeStatusCounts", () => {
  test("DEF_SCOPES: 5 on-track, 1 at-risk, 1 blocked", () => {
    const counts = computeStatusCounts(DEF_SCOPES);
    expect(counts["on-track"]).toBe(5);
    expect(counts["at-risk"]).toBe(1);
    expect(counts["blocked"]).toBe(1);
  });

  test("empty array → all zero", () => {
    expect(computeStatusCounts([])).toEqual({ "on-track": 0, "at-risk": 0, "blocked": 0 });
  });

  test("all same status", () => {
    const scopes = [
      {status:"at-risk"}, {status:"at-risk"}, {status:"at-risk"},
    ];
    const counts = computeStatusCounts(scopes);
    expect(counts["at-risk"]).toBe(3);
    expect(counts["on-track"]).toBe(0);
    expect(counts["blocked"]).toBe(0);
  });
});


// ── computeOverScopes ─────────────────────────────────────────────────────────

describe("computeOverScopes", () => {
  test("DEF_SCOPES with totalWeeks=8: s4(endWeek=9) and s7(endWeek=10) overflow", () => {
    const over = computeOverScopes(DEF_SCOPES, 8);
    const ids = over.map(s => s.id);
    expect(ids).toContain("s4");
    expect(ids).toContain("s7");
    expect(ids).not.toContain("s1");
    expect(ids).not.toContain("s3");
  });

  test("no overflow → empty array", () => {
    expect(computeOverScopes(DEF_SCOPES, 12)).toEqual([]);
  });

  test("tight budget → all overflow", () => {
    const over = computeOverScopes(DEF_SCOPES, 1);
    expect(over.length).toBe(DEF_SCOPES.length);
  });

  test("empty scopes → empty array", () => {
    expect(computeOverScopes([], 8)).toEqual([]);
  });
});


// ── addScope ──────────────────────────────────────────────────────────────────

describe("addScope", () => {
  const base = [{id:"s1",name:"Existing",hill:.5,status:"on-track",owner:"AB",startWeek:1,endWeek:4,history:[.5]}];

  test("appends a new scope", () => {
    const result = addScope(base, {name:"New",owner:"cd",startWeek:"2",endWeek:"6"}, 3, 8, "s-test");
    expect(result.length).toBe(2);
    expect(result[1].id).toBe("s-test");
  });

  test("owner is uppercased and truncated to 2 chars", () => {
    const result = addScope([], {name:"X",owner:"abcd"}, 1, 8, "id1");
    expect(result[0].owner).toBe("AB");
  });

  test("new scope always starts at hill=0.05 with history=[0.05]", () => {
    const result = addScope([], {name:"X",owner:"AB",startWeek:"1",endWeek:"4"}, 1, 8, "id1");
    expect(result[0].hill).toBe(0.05);
    expect(result[0].history).toEqual([0.05]);
    expect(result[0].status).toBe("on-track");
  });

  test("startWeek/endWeek parsed from form strings", () => {
    const result = addScope([], {name:"X",owner:"AB",startWeek:"3",endWeek:"7"}, 1, 8, "id1");
    expect(result[0].startWeek).toBe(3);
    expect(result[0].endWeek).toBe(7);
  });

  test("missing name falls back to 'New Scope'", () => {
    const result = addScope([], {owner:"AB"}, 1, 8, "id1");
    expect(result[0].name).toBe("New Scope");
  });

  test("missing owner falls back to '??'", () => {
    const result = addScope([], {name:"X"}, 1, 8, "id1");
    expect(result[0].owner).toBe("??");
  });

  test("does not mutate original array", () => {
    const original = [...base];
    addScope(base, {name:"New",owner:"AB"}, 1, 8, "id2");
    expect(base).toEqual(original);
  });
});


// ── editScope ─────────────────────────────────────────────────────────────────

describe("editScope", () => {
  const scopes = [
    {id:"s1",name:"Alpha",hill:.5,status:"on-track",owner:"AB",startWeek:1,endWeek:4,history:[.3,.5]},
    {id:"s2",name:"Beta", hill:.3,status:"at-risk", owner:"CD",startWeek:2,endWeek:6,history:[.1,.3]},
  ];

  test("updates name, owner, startWeek, endWeek, status by id", () => {
    const result = editScope(scopes, {
      id:"s1", name:"Alpha Updated", owner:"xy", startWeek:"2", endWeek:"5", status:"at-risk"
    });
    const updated = result.find(s => s.id === "s1");
    expect(updated.name).toBe("Alpha Updated");
    expect(updated.owner).toBe("XY");
    expect(updated.startWeek).toBe(2);
    expect(updated.endWeek).toBe(5);
    expect(updated.status).toBe("at-risk");
  });

  test("leaves other scopes unchanged", () => {
    const result = editScope(scopes, {id:"s1", name:"New Name", owner:"AB", startWeek:"1", endWeek:"4", status:"on-track"});
    const s2 = result.find(s => s.id === "s2");
    expect(s2).toEqual(scopes[1]);
  });

  test("preserves hill and history", () => {
    const result = editScope(scopes, {id:"s1", name:"Alpha Updated", owner:"AB", startWeek:"1", endWeek:"4", status:"on-track"});
    const updated = result.find(s => s.id === "s1");
    expect(updated.hill).toBe(0.5);
    expect(updated.history).toEqual([.3, .5]);
  });

  test("does not mutate original array or scope objects", () => {
    const orig = JSON.stringify(scopes);
    editScope(scopes, {id:"s1", name:"X", owner:"AB", startWeek:"1", endWeek:"4", status:"on-track"});
    expect(JSON.stringify(scopes)).toBe(orig);
  });
});


// ── snapshotScopes ────────────────────────────────────────────────────────────

describe("snapshotScopes", () => {
  test("appends current hill to each scope's history", () => {
    const scopes = [
      {id:"s1",hill:.6,history:[.2,.4]},
      {id:"s2",hill:.3,history:[.1,.2,.3]},
    ];
    const result = snapshotScopes(scopes);
    expect(result[0].history).toEqual([.2, .4, .6]);
    expect(result[1].history).toEqual([.1, .2, .3, .3]);
  });

  test("hill value itself is unchanged", () => {
    const scopes = [{id:"s1",hill:.75,history:[.5]}];
    const result = snapshotScopes(scopes);
    expect(result[0].hill).toBe(.75);
  });

  test("works with empty history", () => {
    const scopes = [{id:"s1",hill:.4,history:[]}];
    const result = snapshotScopes(scopes);
    expect(result[0].history).toEqual([.4]);
  });

  test("does not mutate original scopes", () => {
    const scopes = [{id:"s1",hill:.6,history:[.2,.4]}];
    const orig = JSON.stringify(scopes);
    snapshotScopes(scopes);
    expect(JSON.stringify(scopes)).toBe(orig);
  });
});


// ── updateHill ────────────────────────────────────────────────────────────────

describe("updateHill", () => {
  test("updates hill to rounded value for matching id", () => {
    const scopes = [{id:"s1",hill:.5,history:[.2,.4,.5]}];
    const result = updateHill(scopes, "s1", 0.7333);
    expect(result[0].hill).toBe(0.73);
  });

  test("updates last history entry in-place (does not append)", () => {
    const scopes = [{id:"s1",hill:.5,history:[.2,.4,.5]}];
    const result = updateHill(scopes, "s1", 0.65);
    expect(result[0].history).toEqual([.2, .4, 0.65]);
    expect(result[0].history.length).toBe(3); // unchanged length
  });

  test("leaves other scopes untouched", () => {
    const scopes = [
      {id:"s1",hill:.5,history:[.5]},
      {id:"s2",hill:.3,history:[.3]},
    ];
    const result = updateHill(scopes, "s1", 0.8);
    expect(result[1]).toEqual(scopes[1]);
  });

  test("does not mutate original array", () => {
    const scopes = [{id:"s1",hill:.5,history:[.5]}];
    const orig = JSON.stringify(scopes);
    updateHill(scopes, "s1", 0.7);
    expect(JSON.stringify(scopes)).toBe(orig);
  });

  test("rounding: 0.125 → 0.13", () => {
    const scopes = [{id:"s1",hill:.5,history:[.5]}];
    const result = updateHill(scopes, "s1", 0.125);
    expect(result[0].hill).toBe(0.13);
  });
});


// ── validateSnapshot ──────────────────────────────────────────────────────────

const VALID_SNAPSHOT = {
  schemaVersion: 1,
  id: "snap_1716000000000",
  timestamp: "2026-05-18T10:30:00.000Z",
  label: "Week 3 Checkpoint",
  project: {
    title: "Acme",
    cycle: "Cycle 4",
    startDate: "2026-05-05",
    endDate: "2026-06-27",
    currentWeek: 3,
    bufferDays: 10,
    slippageDays: 0,
  },
  scopes: [
    {id:"s1", name:"Auth", hill:0.5, status:"on-track", owner:"MR", startWeek:1, endWeek:5, history:[0.1,0.3,0.5]},
  ],
  risks: [],
  changes: [],
};

describe("validateSnapshot", () => {
  test("valid snapshot returns valid=true and no errors", () => {
    const r = validateSnapshot(VALID_SNAPSHOT);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  test("null input → invalid with 'not an object'", () => {
    const r = validateSnapshot(null);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("not an object");
  });

  test("non-object input (string) → invalid", () => {
    const r = validateSnapshot("oops");
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("not an object");
  });

  test("missing id → error listed", () => {
    const snap = {...VALID_SNAPSHOT, id: undefined};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("missing: id");
  });

  test("missing timestamp → error listed", () => {
    const snap = {...VALID_SNAPSHOT, timestamp: null};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("missing: timestamp");
  });

  test("missing label → error listed", () => {
    const snap = {...VALID_SNAPSHOT, label: undefined};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("missing: label");
  });

  test("missing schemaVersion → error listed", () => {
    const snap = {...VALID_SNAPSHOT, schemaVersion: undefined};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("missing: schemaVersion");
  });

  test("schemaVersion=0 → invalid (must be positive)", () => {
    const snap = {...VALID_SNAPSHOT, schemaVersion: 0};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("schemaVersion"))).toBe(true);
  });

  test("schemaVersion=-1 → invalid", () => {
    const snap = {...VALID_SNAPSHOT, schemaVersion: -1};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
  });

  test("schemaVersion=1.5 (float) → invalid", () => {
    const snap = {...VALID_SNAPSHOT, schemaVersion: 1.5};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("schemaVersion"))).toBe(true);
  });

  test("schemaVersion as string → invalid", () => {
    const snap = {...VALID_SNAPSHOT, schemaVersion: "1"};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
  });

  test("missing project → error listed", () => {
    const snap = {...VALID_SNAPSHOT, project: null};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("missing: project");
  });

  test("project missing startDate → error listed", () => {
    const snap = {...VALID_SNAPSHOT, project: {...VALID_SNAPSHOT.project, startDate: undefined}};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("missing: project.startDate");
  });

  test("project missing endDate → error listed", () => {
    const snap = {...VALID_SNAPSHOT, project: {...VALID_SNAPSHOT.project, endDate: null}};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("missing: project.endDate");
  });

  test("project missing currentWeek → error listed", () => {
    const snap = {...VALID_SNAPSHOT, project: {...VALID_SNAPSHOT.project, currentWeek: undefined}};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("missing: project.currentWeek");
  });

  test("project missing bufferDays → error listed", () => {
    const snap = {...VALID_SNAPSHOT, project: {...VALID_SNAPSHOT.project, bufferDays: undefined}};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("missing: project.bufferDays");
  });

  test("scopes not an array → error listed", () => {
    const snap = {...VALID_SNAPSHOT, scopes: "not-array"};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("scopes must be an array");
  });

  test("empty scopes array is valid", () => {
    const snap = {...VALID_SNAPSHOT, scopes: []};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(true);
  });

  test("scope missing id → error listed", () => {
    const snap = {...VALID_SNAPSHOT, scopes: [{...VALID_SNAPSHOT.scopes[0], id: undefined}]};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("missing id"))).toBe(true);
  });

  test("scope missing name → error listed", () => {
    const snap = {...VALID_SNAPSHOT, scopes: [{...VALID_SNAPSHOT.scopes[0], name: ""}]};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("missing name"))).toBe(true);
  });

  test("scope hill < 0 → error listed", () => {
    const snap = {...VALID_SNAPSHOT, scopes: [{...VALID_SNAPSHOT.scopes[0], hill: -0.1}]};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("hill must be 0–1"))).toBe(true);
  });

  test("scope hill > 1 → error listed", () => {
    const snap = {...VALID_SNAPSHOT, scopes: [{...VALID_SNAPSHOT.scopes[0], hill: 1.01}]};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
  });

  test("scope hill=0 and hill=1 are valid boundaries", () => {
    const atZero = {...VALID_SNAPSHOT, scopes: [{...VALID_SNAPSHOT.scopes[0], hill: 0}]};
    const atOne  = {...VALID_SNAPSHOT, scopes: [{...VALID_SNAPSHOT.scopes[0], hill: 1}]};
    expect(validateSnapshot(atZero).valid).toBe(true);
    expect(validateSnapshot(atOne).valid).toBe(true);
  });

  test("scope hill as string → error listed", () => {
    const snap = {...VALID_SNAPSHOT, scopes: [{...VALID_SNAPSHOT.scopes[0], hill: "0.5"}]};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
  });

  test("scope invalid status → error listed", () => {
    const snap = {...VALID_SNAPSHOT, scopes: [{...VALID_SNAPSHOT.scopes[0], status: "unknown"}]};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("invalid status"))).toBe(true);
  });

  test("all three valid statuses are accepted", () => {
    ["on-track", "at-risk", "blocked"].forEach(function(st) {
      const snap = {...VALID_SNAPSHOT, scopes: [{...VALID_SNAPSHOT.scopes[0], status: st}]};
      expect(validateSnapshot(snap).valid).toBe(true);
    });
  });

  test("multiple errors are all collected (no short-circuit)", () => {
    const snap = {...VALID_SNAPSHOT, id: undefined, timestamp: null, label: undefined};
    const r = validateSnapshot(snap);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });

  test("scope as non-object in array → error listed", () => {
    const snap = {...VALID_SNAPSHOT, scopes: ["not-a-scope"]};
    const r = validateSnapshot(snap);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes("not an object"))).toBe(true);
  });
});


// ── migrateSnapshot ───────────────────────────────────────────────────────────

describe("migrateSnapshot", () => {
  test("v1 snapshot is returned unchanged", () => {
    const snap = {...VALID_SNAPSHOT};
    const result = migrateSnapshot(snap);
    expect(result).toEqual(snap);
  });

  test("returns the same object reference (no unnecessary copy)", () => {
    const result = migrateSnapshot(VALID_SNAPSHOT);
    expect(result).toBe(VALID_SNAPSHOT);
  });

  test("null input returns null without throwing", () => {
    expect(() => migrateSnapshot(null)).not.toThrow();
    expect(migrateSnapshot(null)).toBeNull();
  });

  test("non-object input is returned as-is", () => {
    expect(migrateSnapshot("bad")).toBe("bad");
    expect(migrateSnapshot(42)).toBe(42);
  });
});


// ── filterValidSnapshots ──────────────────────────────────────────────────────

describe("filterValidSnapshots", () => {
  const good1 = {...VALID_SNAPSHOT, id: "snap_1"};
  const good2 = {...VALID_SNAPSHOT, id: "snap_2", label: "Week 4"};
  const bad   = {id: "snap_bad", schemaVersion: "oops"};

  test("returns only valid snapshots from a mixed array", () => {
    const result = filterValidSnapshots([good1, bad, good2]);
    expect(result).toHaveLength(2);
    expect(result.map(s => s.id)).toEqual(["snap_1", "snap_2"]);
  });

  test("empty array → empty array", () => {
    expect(filterValidSnapshots([])).toEqual([]);
  });

  test("non-array input → empty array", () => {
    expect(filterValidSnapshots(null)).toEqual([]);
    expect(filterValidSnapshots(undefined)).toEqual([]);
    expect(filterValidSnapshots("oops")).toEqual([]);
  });

  test("all valid → all returned", () => {
    const result = filterValidSnapshots([good1, good2]);
    expect(result).toHaveLength(2);
  });

  test("all invalid → empty array", () => {
    const result = filterValidSnapshots([bad, {foo: "bar"}]);
    expect(result).toEqual([]);
  });

  test("does not mutate the input array", () => {
    const arr = [good1, bad];
    const orig = arr.length;
    filterValidSnapshots(arr);
    expect(arr.length).toBe(orig);
  });
});

// ── diffScopes ────────────────────────────────────────────────────────────────

describe("diffScopes", () => {
  const s1 = {id:"s1",name:"Auth",hill:0.5,status:"on-track",startWeek:1,endWeek:5};
  const s2 = {id:"s2",name:"Payments",hill:0.2,status:"on-track",startWeek:2,endWeek:7};

  test("identical scopes → all unchanged", () => {
    const result = diffScopes({scopes:[s1]}, {scopes:[s1]});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({id:"s1",added:false,removed:false,changed:false});
  });

  test("scope in B only → added", () => {
    const result = diffScopes({scopes:[]}, {scopes:[s1]});
    expect(result[0]).toMatchObject({id:"s1",added:true,removed:false,changed:false});
  });

  test("scope in A only → removed", () => {
    const result = diffScopes({scopes:[s1]}, {scopes:[]});
    expect(result[0]).toMatchObject({id:"s1",added:false,removed:true,changed:false});
  });

  test("status change → changed", () => {
    const sB = {...s1, status:"at-risk"};
    const result = diffScopes({scopes:[s1]}, {scopes:[sB]});
    expect(result[0]).toMatchObject({changed:true});
  });

  test("hill change → changed", () => {
    const sB = {...s1, hill:0.8};
    const result = diffScopes({scopes:[s1]}, {scopes:[sB]});
    expect(result[0]).toMatchObject({changed:true});
  });

  test("endWeek change → changed", () => {
    const sB = {...s1, endWeek:6};
    const result = diffScopes({scopes:[s1]}, {scopes:[sB]});
    expect(result[0]).toMatchObject({changed:true});
  });

  test("union of ids: A has s1, B has s1+s2 → both present", () => {
    const result = diffScopes({scopes:[s1]}, {scopes:[s1,s2]});
    expect(result).toHaveLength(2);
    const r2 = result.find(d => d.id === "s2");
    expect(r2).toMatchObject({added:true});
  });

  test("changed rows come before unchanged in typical sort order", () => {
    const sChanged = {...s1, status:"blocked"};
    const result = diffScopes({scopes:[s1,s2]}, {scopes:[sChanged,s2]});
    const s1Row = result.find(d => d.id === "s1");
    const s2Row = result.find(d => d.id === "s2");
    expect(s1Row.changed).toBe(true);
    expect(s2Row.changed).toBe(false);
  });

  test("empty both sides → empty array", () => {
    expect(diffScopes({scopes:[]}, {scopes:[]})).toEqual([]);
  });

  test("missing scopes key treated as empty", () => {
    const result = diffScopes({}, {scopes:[s1]});
    expect(result[0]).toMatchObject({added:true});
  });
});

// ── diffRisks ─────────────────────────────────────────────────────────────────

describe("diffRisks", () => {
  const r1 = {id:"r1", title:"Data loss"};
  const r2 = {id:"r2", title:"Scope creep"};

  test("identical risks → no added/removed", () => {
    const d = diffRisks({risks:[r1]}, {risks:[r1]});
    expect(d.added).toHaveLength(0);
    expect(d.removed).toHaveLength(0);
    expect(d.countA).toBe(1);
    expect(d.countB).toBe(1);
  });

  test("risk in B only → added", () => {
    const d = diffRisks({risks:[]}, {risks:[r1]});
    expect(d.added).toHaveLength(1);
    expect(d.added[0].title).toBe("Data loss");
    expect(d.removed).toHaveLength(0);
  });

  test("risk in A only → removed", () => {
    const d = diffRisks({risks:[r1]}, {risks:[]});
    expect(d.removed).toHaveLength(1);
    expect(d.removed[0].title).toBe("Data loss");
    expect(d.added).toHaveLength(0);
  });

  test("both added and removed", () => {
    const d = diffRisks({risks:[r1]}, {risks:[r2]});
    expect(d.added[0].title).toBe("Scope creep");
    expect(d.removed[0].title).toBe("Data loss");
  });

  test("counts reflect actual array lengths", () => {
    const d = diffRisks({risks:[r1,r2]}, {risks:[r1]});
    expect(d.countA).toBe(2);
    expect(d.countB).toBe(1);
  });

  test("missing risks key treated as empty", () => {
    const d = diffRisks({}, {risks:[r1]});
    expect(d.countA).toBe(0);
    expect(d.added).toHaveLength(1);
  });
});

// ── diffChanges ───────────────────────────────────────────────────────────────

describe("diffChanges", () => {
  const c1 = {id:"c1", title:"Add CSV export", status:"pending"};
  const c2 = {id:"c2", title:"SSO requirement", status:"approved"};

  test("no changes between identical states", () => {
    const d = diffChanges({changes:[c1,c2]}, {changes:[c1,c2]});
    expect(d.added).toHaveLength(0);
    expect(d.statusChanged).toHaveLength(0);
  });

  test("new entry in B → added", () => {
    const d = diffChanges({changes:[c1]}, {changes:[c1,c2]});
    expect(d.added).toHaveLength(1);
    expect(d.added[0].id).toBe("c2");
  });

  test("status change in B → statusChanged", () => {
    const c1Approved = {...c1, status:"approved"};
    const d = diffChanges({changes:[c1]}, {changes:[c1Approved]});
    expect(d.statusChanged).toHaveLength(1);
    expect(d.statusChanged[0].status).toBe("approved");
  });

  test("entry removed from B → not in added or statusChanged", () => {
    const d = diffChanges({changes:[c1,c2]}, {changes:[c1]});
    expect(d.added).toHaveLength(0);
    expect(d.statusChanged).toHaveLength(0);
  });

  test("both added and status-changed entries", () => {
    const c1Approved = {...c1, status:"approved"};
    const d = diffChanges({changes:[c1]}, {changes:[c1Approved,c2]});
    expect(d.added).toHaveLength(1);
    expect(d.statusChanged).toHaveLength(1);
  });

  test("missing changes key treated as empty", () => {
    const d = diffChanges({}, {changes:[c1]});
    expect(d.added).toHaveLength(1);
    expect(d.statusChanged).toHaveLength(0);
  });
});

// ── buildSnapTrendData ────────────────────────────────────────────────────────

describe("buildSnapTrendData", () => {
  const makeSnap = (overrides) => Object.assign({
    scopes: [
      {status:"on-track"}, {status:"on-track"}, {status:"at-risk"}, {status:"blocked"}
    ],
    changes: [
      {status:"approved", impact:"+3d"}, {status:"approved", impact:"-1d"}
    ],
    project: {bufferDays:10, slippageDays:2},
    label: "Week 3 — May 18"
  }, overrides);

  test("returns one row per snapshot", () => {
    const result = buildSnapTrendData([makeSnap(), makeSnap({label:"Week 4"})]);
    expect(result).toHaveLength(2);
  });

  test("empty array returns empty array", () => {
    expect(buildSnapTrendData([])).toEqual([]);
  });

  test("null/undefined returns empty array", () => {
    expect(buildSnapTrendData(null)).toEqual([]);
    expect(buildSnapTrendData(undefined)).toEqual([]);
  });

  test("counts scope statuses correctly", () => {
    const [row] = buildSnapTrendData([makeSnap()]);
    expect(row.scopes).toBe(4);
    expect(row.ontrack).toBe(2);
    expect(row.atrisk).toBe(1);
    expect(row.blocked).toBe(1);
  });

  test("computes buffer remaining from project + changes", () => {
    // bufferDays=10, slippageDays=2, net approved=+2d → used=4, rem=6
    const [row] = buildSnapTrendData([makeSnap()]);
    expect(row.buffer).toBe(6);
  });

  test("buffer is 0 when overrun", () => {
    const snap = makeSnap({project:{bufferDays:2, slippageDays:0}});
    // net approved = +2d → used=2, rem=0
    const [row] = buildSnapTrendData([snap]);
    expect(row.buffer).toBe(0);
  });

  test("label is truncated at 14 chars with ellipsis", () => {
    const snap = makeSnap({label:"This label is definitely too long"});
    const [row] = buildSnapTrendData([snap]);
    expect(row.label).toBe("This label is …");
    expect(row.fullLabel).toBe("This label is definitely too long");
  });

  test("label under 14 chars is preserved as-is", () => {
    const snap = makeSnap({label:"Short"});
    const [row] = buildSnapTrendData([snap]);
    expect(row.label).toBe("Short");
    expect(row.fullLabel).toBe("Short");
  });

  test("empty scopes array gives all-zero counts", () => {
    const snap = makeSnap({scopes:[]});
    const [row] = buildSnapTrendData([snap]);
    expect(row.scopes).toBe(0);
    expect(row.ontrack).toBe(0);
    expect(row.atrisk).toBe(0);
    expect(row.blocked).toBe(0);
  });

  test("empty changes gives full buffer remaining", () => {
    const snap = makeSnap({changes:[], project:{bufferDays:8, slippageDays:0}});
    const [row] = buildSnapTrendData([snap]);
    expect(row.buffer).toBe(8);
  });
});

// ── buildSnapSummaryMd ────────────────────────────────────────────────────────

describe("buildSnapSummaryMd", () => {
  const baseSnap = {
    label: "Week 3 — May 18",
    timestamp: "2026-05-18T10:00:00.000Z",
    project: {
      title: "Acme · Platform Rebuild",
      cycle: "Cycle 4",
      startDate: "2026-05-05",
      endDate: "2026-06-27",
      currentWeek: 3,
      bufferDays: 10,
      slippageDays: 2,
    },
    scopes: [
      {id:"s1", name:"Auth", owner:"MR", status:"on-track", hill:0.62},
      {id:"s2", name:"Payments", owner:"KL", status:"at-risk", hill:0.30},
      {id:"s3", name:"Reports", owner:"DP", status:"blocked", hill:0.10},
    ],
    risks: [
      {id:"r1", title:"3rd-party deprecation", prob:"high", impact:"high", owner:"DP"},
      {id:"r2", title:"Designer capacity", prob:"medium", impact:"medium", owner:"JT"},
    ],
    changes: [
      {id:"c1", title:"SSO requirement", impact:"+3d", status:"approved"},
      {id:"c2", title:"Remove legacy widget", impact:"-1d", status:"approved"},
    ],
  };

  test("includes heading with current week and label", () => {
    const md = buildSnapSummaryMd(baseSnap);
    expect(md).toContain("W3");
    expect(md).toContain("Week 3 — May 18");
  });

  test("includes project title and cycle", () => {
    const md = buildSnapSummaryMd(baseSnap);
    expect(md).toContain("Acme · Platform Rebuild");
    expect(md).toContain("Cycle 4");
  });

  test("includes scope health table with correct counts", () => {
    const md = buildSnapSummaryMd(baseSnap);
    expect(md).toContain("| On track | 1 |");
    expect(md).toContain("| At risk | 1 |");
    expect(md).toContain("| Blocked | 1 |");
  });

  test("computes buffer correctly in output", () => {
    // bufferDays=10, slippageDays=2, net approved=+2d → used=4, rem=6
    const md = buildSnapSummaryMd(baseSnap);
    expect(md).toContain("Planned: 10d");
    expect(md).toContain("Used: 4d");
    expect(md).toContain("Remaining: **6d**");
  });

  test("includes scopes table with owner, status, progress", () => {
    const md = buildSnapSummaryMd(baseSnap);
    expect(md).toContain("| Auth | MR | on-track | 62% |");
    expect(md).toContain("| Payments | KL | at-risk | 30% |");
    expect(md).toContain("| Reports | DP | blocked | 10% |");
  });

  test("includes active risks with severity and owner", () => {
    const md = buildSnapSummaryMd(baseSnap);
    expect(md).toContain("[critical] 3rd-party deprecation — owner: DP");
    expect(md).toContain("[moderate] Designer capacity — owner: JT");
  });

  test("omits scopes section when scopes array is empty", () => {
    const snap = {...baseSnap, scopes: []};
    const md = buildSnapSummaryMd(snap);
    expect(md).not.toContain("### Scopes");
  });

  test("omits risks section when risks array is empty", () => {
    const snap = {...baseSnap, risks: []};
    const md = buildSnapSummaryMd(snap);
    expect(md).not.toContain("### Active risks");
  });

  test("handles missing project title/cycle gracefully", () => {
    const snap = {...baseSnap, project: {...baseSnap.project, title: undefined, cycle: undefined}};
    const md = buildSnapSummaryMd(snap);
    expect(md).not.toContain("**Project:**");
    expect(md).toContain("**Snapshot:**");
  });

  test("handles missing startDate/endDate — omits period line", () => {
    const snap = {...baseSnap, project: {...baseSnap.project, startDate: undefined, endDate: undefined}};
    const md = buildSnapSummaryMd(snap);
    expect(md).not.toContain("**Period:**");
  });

  test("owner missing falls back to em-dash", () => {
    const snap = {...baseSnap, scopes: [{id:"s1", name:"Widget", owner: undefined, status:"on-track", hill:0.5}]};
    const md = buildSnapSummaryMd(snap);
    expect(md).toContain("| Widget | — |");
  });
});

// ── buildDiffSummaryMd ────────────────────────────────────────────────────────

describe("buildDiffSummaryMd", () => {
  const bufA = {bufferRem: 8, bufferUsed: 2};
  const bufB = {bufferRem: 6, bufferUsed: 4};
  const emptyRDiff = {added:[], removed:[]};
  const emptyCDiff = {added:[], statusChanged:[]};

  const scopeAdded = {
    id:"s99", name:"Payments", added:true, removed:false, changed:false, a:null,
    b:{status:"on-track", startWeek:3, endWeek:7},
  };
  const scopeRemoved = {
    id:"s88", name:"Legacy API", added:false, removed:true, changed:true, a:{status:"on-track"}, b:null,
  };
  const scopeChanged = {
    id:"s1", name:"Auth", added:false, removed:false, changed:true,
    a:{status:"on-track", endWeek:5}, b:{status:"at-risk", endWeek:6},
  };

  test("heading includes both labels", () => {
    const md = buildDiffSummaryMd("Week 2", "Week 3", [], bufA, bufB, 1, 2, emptyRDiff, emptyCDiff);
    expect(md).toContain("Week 2 → Week 3");
  });

  test("reports added scope", () => {
    const md = buildDiffSummaryMd("A", "B", [scopeAdded], bufA, bufB, 0, 0, emptyRDiff, emptyCDiff);
    expect(md).toContain("**Payments** added (on-track, W3–W7)");
  });

  test("reports removed scope", () => {
    const md = buildDiffSummaryMd("A", "B", [scopeRemoved], bufA, bufB, 0, 0, emptyRDiff, emptyCDiff);
    expect(md).toContain("**Legacy API** removed");
  });

  test("reports status change and end-week slip", () => {
    const md = buildDiffSummaryMd("A", "B", [scopeChanged], bufA, bufB, 0, 0, emptyRDiff, emptyCDiff);
    expect(md).toContain("moved from on-track → at-risk");
    expect(md).toContain("end date slipped W5→W6");
  });

  test("reports added and removed risks", () => {
    const rDiff = {added:[{title:"New vendor risk"}], removed:[{title:"Old risk"}]};
    const md = buildDiffSummaryMd("A", "B", [], bufA, bufB, 0, 0, rDiff, emptyCDiff);
    expect(md).toContain("Risk added: New vendor risk");
    expect(md).toContain("Risk removed: Old risk");
  });

  test("reports added changes and status changes", () => {
    const cDiff = {added:[{title:"SSO requirement", impact:"+3d"}], statusChanged:[{title:"Widget", status:"approved"}]};
    const md = buildDiffSummaryMd("A", "B", [], bufA, bufB, 0, 0, emptyRDiff, cDiff);
    expect(md).toContain("Change added: SSO requirement (+3d)");
    expect(md).toContain("Widget: → approved");
  });

  test("buffer line shows correct values and delta", () => {
    const md = buildDiffSummaryMd("A", "B", [], bufA, bufB, 0, 0, emptyRDiff, emptyCDiff);
    expect(md).toContain("### Buffer: 8d → 6d (-2d)");
  });

  test("buffer delta positive shows + sign", () => {
    const md = buildDiffSummaryMd("A", "B", [], bufB, bufA, 0, 0, emptyRDiff, emptyCDiff);
    expect(md).toContain("### Buffer: 6d → 8d (+2d)");
  });

  test("at-risk line shows correct values", () => {
    const md = buildDiffSummaryMd("A", "B", [], bufA, bufB, 1, 3, emptyRDiff, emptyCDiff);
    expect(md).toContain("### At-risk + blocked: 1 → 3 (+2)");
  });

  test("at-risk no change omits delta", () => {
    const md = buildDiffSummaryMd("A", "B", [], bufA, bufB, 2, 2, emptyRDiff, emptyCDiff);
    expect(md).toMatch(/At-risk \+ blocked: 2 → 2$/m);
  });

  test("no changes shows 'No changes.'", () => {
    const md = buildDiffSummaryMd("A", "B", [], bufA, bufB, 0, 0, emptyRDiff, emptyCDiff);
    expect(md).toContain("No changes.");
  });

  test("unchanged scopes are not reported", () => {
    const unchanged = {id:"s1", name:"Auth", added:false, removed:false, changed:false, a:{status:"on-track"}, b:{status:"on-track"}};
    const md = buildDiffSummaryMd("A", "B", [unchanged], bufA, bufB, 0, 0, emptyRDiff, emptyCDiff);
    expect(md).not.toContain("**Auth**");
    expect(md).toContain("No changes.");
  });

  test("null/undefined rDiff and cDiff are handled gracefully", () => {
    expect(() => buildDiffSummaryMd("A", "B", [], bufA, bufB, 0, 0, null, null)).not.toThrow();
  });
});
