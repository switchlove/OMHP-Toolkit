// Tests for src/lib.js, the toolkit's pure helpers. Run with `npm test` (node --test).
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// lib.js is a plain script (it's joined into the userscript by build.js), so run it in a
// sandbox and use the functions it declares
const lib = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "src", "lib.js"), "utf8"), lib);

// Arrays and objects made inside the sandbox aren't deepStrictEqual to ours (another
// realm's prototypes), so compare plain copies
const plain = (x) => JSON.parse(JSON.stringify(x));
const same = (actual, expected) => assert.deepEqual(plain(actual), expected);

const MIN = 60000;

test("short", () => {
    assert.equal(lib.short(0), "0");
    assert.equal(lib.short(999), "999");
    assert.equal(lib.short(1000), "1K");
    assert.equal(lib.short(243400), "243K");
    assert.equal(lib.short(1000000), "1M");
    assert.equal(lib.short(1500000), "1.5M");
});

test("fmt", () => {
    assert.equal(lib.fmt(1234567.4), "1,234,567");
    assert.equal(lib.fmt(0), "0");
});

test("dur", () => {
    assert.equal(lib.dur(0), "0m");
    assert.equal(lib.dur(59.4), "59m");
    assert.equal(lib.dur(59.6), "1h 00m");
    assert.equal(lib.dur(187), "3h 07m");
});

test("today", () => {
    assert.equal(lib.today(new Date(2026, 0, 5)), "2026-01-05");
    assert.equal(lib.today(new Date(2026, 11, 31)), "2026-12-31");
});

test("titleWith: after the attack count, replacing an earlier part", () => {
    let t = lib.titleWith("(3/5) ONE MILLION HP", "[72% ~39m]");
    assert.equal(t, "(3/5) [72% ~39m] ONE MILLION HP");
    t = lib.titleWith(t, "[71% ~38m]");
    assert.equal(t, "(3/5) [71% ~38m] ONE MILLION HP");
    t = lib.titleWith(t, "[FOG]");
    assert.equal(t, "(3/5) [FOG] ONE MILLION HP");
    assert.equal(lib.titleWith(t, ""), "(3/5) ONE MILLION HP");
});

test("titleWith: no attack count, and a flashing world event", () => {
    let t = lib.titleWith("ONE MILLION HP", "[50%]");
    assert.equal(t, "[50%] ONE MILLION HP");
    assert.equal(lib.titleWith(t, "[49%]"), "[49%] ONE MILLION HP");
    assert.equal(lib.titleWith("(!) FOG EVENT", "[50%]"), "(!) FOG EVENT");
});

test("sessionCounts", () => {
    const extra = { dmg: 10, hits: 1, crits: 0 };
    same(lib.sessionCounts({ base: null, extra: extra }, { dmg: 500, hits: 5, crits: 1 }),
        { dmg: 10, hits: 1, crits: 0 });
    same(lib.sessionCounts({ base: { dmg: 100, hits: 2, crits: 0 }, extra: extra }, { dmg: 500, hits: 5, crits: 1 }),
        { dmg: 410, hits: 4, crits: 1 });
    // No reading yet: only what was counted from the screen
    same(lib.sessionCounts({ base: { dmg: 1, hits: 1 }, extra: extra }, null), { dmg: 10, hits: 1, crits: 0 });
});

test("dropRate", () => {
    assert.equal(lib.dropRate(3, 250), "1.2%");
    assert.equal(lib.dropRate(1, 1000), "0.10%");
    assert.equal(lib.dropRate(30, 100), "30%");
});

test("rateOver and etaMinutes", () => {
    const now = 20 * MIN;
    // Losing 1,000 HP a minute for 20 minutes, from 100,000
    const samples = [];
    for (let m = 0; m <= 20; m++) samples.push({ t: m * MIN, hp: 100000 - m * 1000 });
    const r = lib.rateOver(samples, now, 5);
    assert.equal(r.minutes, 5);
    assert.equal(r.perMin, 1000);
    same(lib.etaMinutes(samples, now, [1, 5, 15]), [80, 80, 80]);
    // Under half a minute of samples: nothing yet
    assert.equal(lib.rateOver([{ t: now - 10000, hp: 5 }, { t: now, hp: 4 }], now, 5), null);
    // Holding (or healing): no estimate from that window
    same(lib.etaMinutes([{ t: 0, hp: 500 }, { t: 10 * MIN, hp: 600 }], 10 * MIN, [5]), []);
    assert.equal(lib.rateOver([], now, 5), null);
});

test("thinPoints keeps the recent half whole", () => {
    const pts = Array.from({ length: 10 }, (_, i) => [i]);
    assert.equal(lib.thinPoints(pts, 20), pts);
    same(lib.thinPoints(pts, 8).map((p) => p[0]), [0, 2, 4, 5, 6, 7, 8, 9]);
});

test("pct", () => {
    assert.equal(lib.pct(0.48), "48%");
    assert.equal(lib.pct(0.096), "9.6%");
    assert.equal(lib.pct(0.0012), "0.12%");
    assert.equal(lib.pct(0.0000001), "<0.001%");
    assert.equal(lib.pct(0), "0%");
    assert.equal(lib.pct(1), "100%");
});

test("outcomeKey and outcomeLabel", () => {
    assert.equal(lib.outcomeKey("item", "legendary"), "legendary");
    assert.equal(lib.outcomeKey("attacks", null, 5), "attacks:5");
    assert.equal(lib.outcomeKey("ultimate"), "ultimate");
    assert.equal(lib.outcomeLabel("legendary"), "LEGENDARY");
    assert.equal(lib.outcomeLabel("boss_unique"), "BOSS UNIQUE");
    assert.equal(lib.outcomeLabel("attacks:1"), "+1 BONUS ATTACK");
    assert.equal(lib.outcomeLabel("attacks:5"), "+5 BONUS ATTACKS");
    assert.equal(lib.outcomeLabel("attacks:2-3"), "+2–3 BONUS ATTACKS");
    assert.equal(lib.outcomeLabel("box"), "A CHEST");
    assert.equal(lib.outcomeLabel("next_crit:2"), "2 CRIT CHARGES");
    assert.equal(lib.outcomeLabel("shards:12"), "12 SHARDS");
    assert.equal(lib.outcomeLabel("shards:5-20"), "5–20 SHARDS");
});

test("seasonRecords", () => {
    const rec = { hit: { v: 900, d: "2026-11-02" }, day: { v: 5e6, d: "2026-11-12" }, share: { v: 3, d: "2026-11-13", seq: 1 } };
    const s2 = lib.seasonRecords(rec, "2026-11-13", "SEASON 1");
    // the day the season starts counts as the new season
    same(s2, { season: "2026-11-13", share: { v: 3, d: "2026-11-13", seq: 1 },
        past: { "SEASON 1": { hit: { v: 900, d: "2026-11-02" }, day: { v: 5e6, d: "2026-11-12" } } } });
    // once is enough: a record set later stays
    s2.hit = { v: 120, d: "2026-11-14" };
    assert.equal(lib.seasonRecords(s2, "2026-11-13", "SEASON 1"), s2);
    // nothing to file away: no past season
    same(lib.seasonRecords({}, "2026-11-13", "SEASON 1"), { season: "2026-11-13", past: {} });
});

test("ledgerOut", () => {
    const keys = ["common", "rare", "shards:5-20"];
    // an amount counts under the stated range it falls in; items as they are
    same(lib.ledgerOut({ common: 3, "shards:12": 2, "shards:20": 1 }, keys), { common: 3, "shards:5-20": 3 });
    // out of range: on its own, unless the bare kind is listed
    same(lib.ledgerOut({ "shards:40": 1 }, keys), { "shards:40": 1 });
    same(lib.ledgerOut({ "shards:40": 1 }, ["shards"]), { shards: 1 });
    // an amount the odds list exactly stays put
    same(lib.ledgerOut({ "attacks:5": 2 }, ["attacks:5"]), { "attacks:5": 2 });
});

test("mergeOdds", () => {
    same(lib.mergeOdds([]), []);
    same(lib.mergeOdds([["attacks:1", 0.5], ["rare", 0.5]]), [["attacks:1", 0.5], ["rare", 0.5]]);
    // The SCROLL BOX: one stated row per scroll, all keyed the same
    same(lib.mergeOdds([["scroll:1", 0.25], ["epic", 0.5], ["scroll:1", 0.25]]), [["scroll:1", 0.5], ["epic", 0.5]]);
});

test("hhmm", () => {
    assert.equal(lib.hhmm(new Date(2026, 0, 5, 9, 7).getTime()), "09:07");
});

test("shrinkPoints keeps the first and last, evenly spread", () => {
    const pts = Array.from({ length: 11 }, (_, i) => [i]);
    same(lib.shrinkPoints(pts, 3).map((p) => p[0]), [0, 5, 10]);
    same(lib.shrinkPoints(pts, 20).map((p) => p[0]), pts.map((p) => p[0]));
});

test("themeCode and parseThemeCode round-trip", () => {
    const vars = { bg: "#0B1020", "bg-2": "#121a30", fg: "#dfe6f5", dim: "#7f8aa6", faint: "#2c3550" };
    const code = lib.themeCode(vars, "#FFB000");
    assert.equal(code, "OMHP1-0b1020-121a30-dfe6f5-7f8aa6-2c3550-ffb000");
    same(lib.parseThemeCode(" " + code + " "), {
        vars: { bg: "#0b1020", "bg-2": "#121a30", fg: "#dfe6f5", dim: "#7f8aa6", faint: "#2c3550" }, accent: "#ffb000"
    });
    // With the mist colour as a seventh
    const misty = lib.themeCode(Object.assign({ mist: "#6A7FB4" }, vars), "#ffb000");
    assert.equal(misty, code + "-6a7fb4");
    assert.equal(lib.parseThemeCode(misty).vars.mist, "#6a7fb4");
    assert.equal(lib.parseThemeCode(code).vars.mist, undefined);
    assert.equal(lib.parseThemeCode("OMHP1-0b1020-121a30"), null);
    assert.equal(lib.parseThemeCode("hello"), null);
    assert.equal(lib.parseThemeCode(null), null);
});

test("snapPos: to the view's edges and to another box", () => {
    // Near the left and top edges
    same(lib.snapPos(6, 8, 100, 50, [], 1000, 800, 10), { x: 0, y: 0 });
    // Near the right edge; too far from the bottom to snap
    same(lib.snapPos(895, 400, 100, 50, [], 1000, 800, 10), { x: 900, y: 400 });
    // Flush against another box's right side, lined up with its top
    same(lib.snapPos(305, 103, 100, 50, [{ x: 100, y: 100, w: 200, h: 200 }], 1000, 800, 10), { x: 300, y: 100 });
    // Out of reach: stays put
    same(lib.snapPos(500, 500, 100, 50, [{ x: 100, y: 100, w: 200, h: 200 }], 1000, 800, 10), { x: 500, y: 500 });
});

test("tileRects: a grid filling the area", () => {
    same(lib.tileRects(0, { x: 0, y: 0, w: 100, h: 100 }, 0), []);
    same(lib.tileRects(1, { x: 10, y: 20, w: 300, h: 200 }, 8), [{ x: 10, y: 20, w: 300, h: 200 }]);
    same(lib.tileRects(3, { x: 0, y: 0, w: 208, h: 108 }, 8), [
        { x: 0, y: 0, w: 100, h: 50 }, { x: 108, y: 0, w: 100, h: 50 }, { x: 0, y: 58, w: 100, h: 50 }
    ]);
});

test("bucketColumns: carries values forward, your damage per column, fog", () => {
    // [time, hp, phase, online, your lifetime damage]
    const pts = [[0, 100, 1, 5, 1000], [10, 90, 1, 6, 1010], [30, 70, 2, 7, 1050]];
    const c = lib.bucketColumns(pts, [[15, 25]], 0, 40, 4, Infinity);
    same(c.vals, [90, 90, 70, 70]);
    same(c.phases, [1, 1, 2, 2]);
    same(c.online, [6, 6, 7, 7]);
    same(c.mine, [null, 0, 40, 0]);
    same(c.fogCols, [false, true, true, false]);
});

test("bucketColumns: nothing after the replay cutoff", () => {
    const pts = [[0, 100, 1, null, null], [30, 70, 1, null, null]];
    const c = lib.bucketColumns(pts, [[35, 40]], 0, 40, 4, 15);
    same(c.vals, [100, 100, null, null]);
    same(c.fogCols, [false, false, false, false]);
});

test("packPoints / unpackPoints: a round trip", () => {
    const pts = [
        [1700000000000, 1000, 1, 5, 500],
        [1700000005000, 990, 1, 6, 510],
        [1700000010000, 980, null, null, null],
        [1700000015000, 970, 2, 7, 530]
    ];
    const packed = lib.packPoints(pts);
    same(packed, { t: 1700000000, s: [[0, 1000, 1, 5, 500], [5, 990, 1, 6, 10], [5, 980], [5, 970, 2, 7, 530]] });
    same(lib.unpackPoints(packed), pts);
});

test("packPoints / unpackPoints: nothing yet", () => {
    same(lib.unpackPoints(lib.packPoints([])), []);
});

test("titleWith: a FOG countdown is replaced too", () => {
    assert.equal(lib.titleWith("(3/5) [FOG 1:42] ONE MILLION HP", "[50%]"), "(3/5) [50%] ONE MILLION HP");
    assert.equal(lib.titleWith("(3/5) [72% ~39m · MERCHANT 1:42] ONE MILLION HP", ""), "(3/5) ONE MILLION HP");
});

test("pinNews", () => {
    const seen = { 369: "NEW", 368: "NEW", 300: "IN PROGRESS" };
    same(lib.pinNews(seen, seen), { fresh: 0, changed: 0 });
    // a new ticket, one moved on, one gone (hidden or deleted)
    same(lib.pinNews(seen, { 370: "NEW", 369: "COMPLETED", 368: "NEW" }), { fresh: 1, changed: 1 });
    same(lib.pinNews({}, { a: "" }), { fresh: 1, changed: 0 });
    // an id that's also an Object method name is still new
    same(lib.pinNews({}, { constructor: "" }), { fresh: 1, changed: 0 });
});

test("eventLabel", () => {
    assert.equal(lib.eventLabel("merchant"), "MERCHANT");
    assert.equal(lib.eventLabel("laststand"), "LAST STAND");
    assert.equal(lib.eventLabel("big_deal"), "BIG DEAL");
    assert.equal(lib.eventLabel("second_wind"), "2ND WIND");
    assert.equal(lib.eventLabel("second_wind", 2), "2ND WIND");
    assert.equal(lib.eventLabel("second_wind", 3), "3RD WIND");
    assert.equal(lib.eventLabel("second_wind", 4), "4TH WIND");
});

test("clockDur", () => {
    assert.equal(lib.clockDur(0), "0:00");
    assert.equal(lib.clockDur(102000), "1:42");
    assert.equal(lib.clockDur(3723000), "1:02:03");
    assert.equal(lib.clockDur(-5000), "0:00");
});

test("eventColumns", () => {
    same(lib.eventColumns([[10, 25, "merchant"]], 0, 40, 4, Infinity), [null, "merchant", "merchant", null]);
    same(lib.eventColumns([[10, 25, "merchant"]], 0, 40, 4, 15), [null, "merchant", null, null]);
});

test("streakDays", () => {
    assert.equal(lib.streakDays(["2026-10-24", "2026-10-25", "2026-10-26"], "2026-10-26"), 3);
    assert.equal(lib.streakDays(["2026-10-24", "2026-10-26"], "2026-10-26"), 1);
    assert.equal(lib.streakDays([], "2026-10-26"), 0);
});

test("durSecs", () => {
    assert.equal(lib.durSecs("1d 2h 3m"), 86400 + 7200 + 180);
    assert.equal(lib.durSecs("2h 3m"), 7380);
    assert.equal(lib.durSecs("3m 4s"), 184);
    assert.equal(lib.durSecs("ENDED"), null);
    assert.equal(lib.durSecs(""), null);
});

test("pollOrder", () => {
    const polls = [
        { id: 3, open: true, left: 600, total: null },
        { id: 5, open: true, left: 60, total: 4 },
        { id: 1, open: false, left: null, total: 30 },
        { id: 4, open: false, left: null, total: 2 },
        { id: 2, open: true, left: 3600, total: 9 }
    ];
    same(lib.pollOrder(polls, "new"), [5, 4, 3, 2, 1]);
    same(lib.pollOrder(polls, "ending"), [5, 3, 2, 4, 1]);
    same(lib.pollOrder(polls, "votes"), [1, 2, 5, 4, 3]);
});
