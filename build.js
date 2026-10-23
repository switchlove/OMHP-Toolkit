// Builds omhp-toolkit.user.js from src/: the userscript header, then every part inside
// one function, so they all share its scope (like one big file), with the stylesheet
// inlined as the `css` string.
//
//   node build.js          write omhp-toolkit.user.js
//   node build.js --check  exit 1 if omhp-toolkit.user.js isn't what src/ builds to
"use strict";

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src");
const OUT = path.join(__dirname, "omhp-toolkit.user.js");

// In load order. Top-level statements run in this order; everything else is
// function declarations, which moveSections() (main.js, last) starts once the page is ready.
const PARTS = [
    "constants.js",
    "lib.js",
    "style.css",
    "core.js",
    "sections.js",
    "page.js",
    "columns.js",
    "eta.js",
    "graph.js",
    "session.js",
    "menu.js",
    "fulltimer.js",
    "loot.js",
    "bosses.js",
    "pin.js",
    "windows.js",
    "shorttabs.js",
    "clock.js",
    "alerts.js",
    "shortcuts.js",
    "filters.js",
    "addons.js",
    "health.js",
    "main.js"
];

function read(name) {
    return fs.readFileSync(path.join(SRC, name), "utf8").replace(/\r\n/g, "\n");
}

// Indent every non-empty line
function indent(text, by) {
    return text.split("\n").map(function(line) { return line ? by + line : line; }).join("\n");
}

function build() {
    var out = read("header.js") + "(function() {\n";
    PARTS.forEach(function(name) {
        if (name.endsWith(".css")) out += "    var css = `\n" + indent(read(name), "        ") + "    `;\n";
        else out += indent(read(name), "    ");
    });
    return out + "})();\n";
}

var built = build();
if (process.argv.includes("--check")) {
    var current = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
    if (current !== built) {
        console.error("omhp-toolkit.user.js is out of date: run `node build.js` and commit it.");
        process.exit(1);
    }
    console.log("omhp-toolkit.user.js matches src/");
} else {
    fs.writeFileSync(OUT, built);
    console.log("built omhp-toolkit.user.js (" + built.split("\n").length + " lines)");
}
