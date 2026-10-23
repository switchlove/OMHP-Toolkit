// The page script (src/page.js) is injected into the site as a string, so neither lint nor
// `node --check` sees inside it. Pull it out of the built userscript and make sure it parses.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

test("the injected page script parses", () => {
    const built = fs.readFileSync(path.join(__dirname, "..", "omhp-toolkit.user.js"), "utf8");
    const start = built.indexOf("var code = `");
    const end = built.indexOf("`;", start);
    assert.ok(start !== -1 && end !== -1, "found the page script in the built file");
    // ${...} are filled in by the userscript at run time; any value will do for parsing
    const code = built.slice(start + "var code = `".length, end).replace(/\$\{[^}]*\}/g, "0");
    assert.doesNotThrow(() => new vm.Script(code, { filename: "page-script.js" }));
});
