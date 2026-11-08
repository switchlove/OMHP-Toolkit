// The site drift canary's offline parts (tools/canary.js); the live check runs daily in CI
const test = require("node:test");
const assert = require("node:assert/strict");
const canary = require("../tools/canary.js");

test("canary reads the changelog without running it", () => {
    const text = `export const CHANGELOG = [
  {
    date: "2026-11-03",
    title: "THE \\"BIG\\" ONE",
    items: [
      "#1 First, with a \\"quote\\".",
      "Second, [with] brackets.",
    ],
  },
  {
    date: "2026-11-01",
    items: [
      "No title.",
    ],
  },
];`;
    assert.deepEqual(canary.parseChangelog(text), [
        { date: "2026-11-03", title: 'THE "BIG" ONE', items: ['#1 First, with a "quote".', "Second, [with] brackets."] },
        { date: "2026-11-01", title: "", items: ["No title."] }
    ]);
});

test("canary knows an export when it sees one", () => {
    assert.equal(canary.exportsName("export const getAuction = (f) => 1;", "getAuction"), true);
    assert.equal(canary.exportsName("export async function loadRanks() {}", "loadRanks"), true);
    assert.equal(canary.exportsName("export { a, renderBag as b };", "renderBag"), true);
    assert.equal(canary.exportsName("const getDaily = 1; // export const getDailyX", "getDaily"), false);
});

test("canary finds what the page script uses", () => {
    const uses = canary.pageImports();
    assert.ok(uses["api.js"].has("getAuction"));
    assert.ok(uses["store.js"].has("on"));
    assert.ok(!uses["store.js"].has("js"));
    const ids = canary.usedIds();
    assert.ok(ids.includes("boss-dmg"));
    assert.ok(!ids.includes("col-left")); // the toolkit's own
});
