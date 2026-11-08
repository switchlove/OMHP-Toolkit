// Per-account storage (accountSeen in src/core.js), run against a stand-in localStorage.
// core.js as a whole needs the page, so only its storage section is loaded.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const core = fs.readFileSync(path.join(__dirname, "..", "src", "core.js"), "utf8");
const code = core.slice(core.indexOf("function loadJSON"), core.indexOf("// This toolkit's saved data, biggest first"));

function run(store) {
    const ls = {
        data: Object.assign({}, store), full: false,
        getItem(k) { return k in this.data ? this.data[k] : null; },
        setItem(k, v) {
            if (this.full) throw new Error("full");
            this.data[k] = String(v);
        },
        removeItem(k) { delete this.data[k]; },
        get length() { return Object.keys(this.data).length; },
        key(i) { return Object.keys(this.data)[i]; }
    };
    const ctx = { localStorage: ls, reloaded: 0, setTimeout() {}, JSON, cleanUp: () => false };
    ctx.location = { reload() { ctx.reloaded++; } };
    vm.runInNewContext(code, ctx);
    return ctx;
}

test("accounts: the first account seen adopts the data", () => {
    const c = run({ "omhp.session": '{"a":1}' });
    c.accountSeen("A");
    assert.equal(c.localStorage.data["omhp.account"], '"A"');
    assert.equal(c.localStorage.data["omhp.session"], '{"a":1}');
    assert.equal(c.reloaded, 0);
});

test("accounts: stats wait until the player is known, settings don't", () => {
    const c = run({ "omhp.account": '"A"', "omhp.session": '{"a":1}' });
    c.save("omhp.session", { a: 2 });
    assert.equal(c.localStorage.data["omhp.session"], '{"a":1}');
    c.save("omhp.layout.theme", "X");
    assert.equal(c.localStorage.data["omhp.layout.theme"], '"X"');
    c.accountSeen("A");
    c.save("omhp.session", { a: 3 });
    assert.equal(c.localStorage.data["omhp.session"], '{"a":3}');
    assert.equal(c.reloaded, 0);
});

test("accounts: switching packs one away and unpacks the other", () => {
    let c = run({ "omhp.account": '"A"', "omhp.session": '{"a":1}', "omhp.loot": '{"l":1}', "omhp.layout.theme": '"X"' });
    c.accountSeen("B");
    let d = c.localStorage.data;
    assert.equal(c.reloaded, 1);
    assert.equal(d["omhp.account"], '"B"');
    assert.ok(!("omhp.session" in d));
    assert.equal(d["omhp.layout.theme"], '"X"'); // settings are shared
    assert.deepEqual(JSON.parse(d["omhp.acct.A"]), { "omhp.session": '{"a":1}', "omhp.loot": '{"l":1}' });

    d["omhp.session"] = '{"b":1}';
    c = run(d);
    c.accountSeen("A");
    d = c.localStorage.data;
    assert.equal(d["omhp.session"], '{"a":1}');
    assert.equal(d["omhp.loot"], '{"l":1}');
    assert.ok(!("omhp.acct.A" in d));
    assert.deepEqual(JSON.parse(d["omhp.acct.B"]), { "omhp.session": '{"b":1}' });
    assert.equal(d["omhp.account"], '"A"');
});

test("accounts: with no room to pack, nothing is removed", () => {
    const c = run({ "omhp.account": '"A"', "omhp.session": '{"a":1}' });
    c.localStorage.full = true;
    c.accountSeen("B");
    assert.equal(c.reloaded, 0);
    assert.equal(c.localStorage.data["omhp.session"], '{"a":1}');
    assert.equal(c.account.held, false);
});
