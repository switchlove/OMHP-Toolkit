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
    assert.equal(lib.outcomeLabel("attacks:1"), "+1 ATTACK");
    assert.equal(lib.outcomeLabel("next_crit:2"), "2 CRIT CHARGES");
});

test("hhmm", () => {
    assert.equal(lib.hhmm(new Date(2026, 0, 5, 9, 7).getTime()), "09:07");
});

test("shrinkPoints keeps the first and last, evenly spread", () => {
    const pts = Array.from({ length: 11 }, (_, i) => [i]);
    same(lib.shrinkPoints(pts, 3).map((p) => p[0]), [0, 5, 10]);
    same(lib.shrinkPoints(pts, 20).map((p) => p[0]), pts.map((p) => p[0]));
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
