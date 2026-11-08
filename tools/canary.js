#!/usr/bin/env node
// Site drift canary: checks the live onemillionhp.com against what the toolkit uses, and lists
// what's new in the game's changelog.
//
//   node tools/canary.js                  report (exit 1 if anything the toolkit uses is gone)
//   node tools/canary.js --since=2026-10-29   ...and the changelog days after that date
//   node tools/canary.js --github         also file GitHub issues (the daily workflow; needs
//                                         GITHUB_TOKEN and GITHUB_REPOSITORY)
//
// What it checks:
//   - every site module src/page.js imports still exists, and still exports each name the
//     page script uses from it (api.getAuction, store.on, ...)
//   - every element id the toolkit looks up (getElementById, "#id" selectors) is still in the
//     site's index.html or one of its modules
// The site's files are only read as text: nothing from them is run.

"use strict";

const fs = require("fs");
const path = require("path");

const SITE = "https://onemillionhp.com/";
const SRC = path.join(__dirname, "..", "src");
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === "--" + name || a.startsWith("--" + name + "="));
const value = (name) => (flag(name) || "").split("=")[1] || "";

async function get(url) {
    const res = await fetch(url, { headers: { "user-agent": "omhp-toolkit-canary" } });
    if (!res.ok) throw new Error(res.status + " " + url);
    return res.text();
}

// The modules the page script imports, and which of their exports it uses. Each import list
// (Promise.all([...]) or a lone import(...)) is paired with the names it's given in .then(...).
function pageImports() {
    const page = fs.readFileSync(path.join(SRC, "page.js"), "utf8");
    const aliases = {}; // alias -> module path
    const block = /Promise\.all\(\[([\s\S]*?)\]\)\s*\.then\(\(\[([^\]]*)\]\)|import\(\$\{JSON\.stringify\(base \+ "([^"]+)"[^)]*\)\}\)\s*\.then\(\((\w+)\)/g;
    let m;
    while ((m = block.exec(page))) {
        const mods = m[1] ? [...m[1].matchAll(/base \+ "([^"]+)"/g)].map((x) => x[1]) : [m[3]];
        const names = m[2] ? m[2].split(",").map((s) => s.trim()) : [m[4]];
        names.forEach((n, i) => {
            if (!n || !mods[i]) return;
            if (aliases[n] && aliases[n] !== mods[i]) throw new Error("page.js uses " + n + " for both " + aliases[n] + " and " + mods[i]);
            aliases[n] = mods[i];
        });
    }
    const uses = {}; // module path -> Set of export names
    for (const [alias, mod] of Object.entries(aliases)) {
        uses[mod] = uses[mod] || new Set();
        // Not the file names in the import paths ("ui/bag.js")
        for (const u of page.matchAll(new RegExp("(?<![\\w./\"'])" + alias + "\\.(\\w+)", "g"))) {
            if (u[1] !== "js") uses[mod].add(u[1]);
        }
    }
    return uses;
}

// Element ids the toolkit looks up by name (not the ones it makes itself, not built from variables)
function usedIds() {
    const ids = new Set(), own = new Set();
    for (const f of fs.readdirSync(SRC).filter((n) => n.endsWith(".js"))) {
        const text = fs.readFileSync(path.join(SRC, f), "utf8");
        for (const m of text.matchAll(/\.id = "([\w-]+)"/g)) own.add(m[1]);
        for (const m of text.matchAll(/getElementById\("([\w-]+)"\)/g)) ids.add(m[1]);
        for (const m of text.matchAll(/(?:querySelector(?:All)?|closest|matches)\(\s*["']([^"']+)["']/g)) {
            for (const id of m[1].matchAll(/#([a-z][\w-]*)/gi)) ids.add(id[1]);
        }
    }
    return [...ids].filter((id) => !id.startsWith("omhp-") && !own.has(id)).sort();
}

function exportsName(text, name) {
    const decl = new RegExp("export\\s+(?:const|let|var|class|function\\*?|async\\s+function)\\s+" + name + "\\b");
    const list = new RegExp("export\\s*\\{[^}]*\\b" + name + "\\b[^}]*\\}");
    return decl.test(text) || list.test(text);
}

// The site's whole module graph from main.js, as path -> text, so element ids created by any of
// its scripts count as present
async function siteFiles() {
    const index = await get(SITE);
    const v = (index.match(/js\/main\.js\?v=([0-9a-f]+)/) || [])[1];
    if (!v) throw new Error("no js/main.js?v= in the site's index.html");
    const files = {};
    const queue = ["main.js"];
    while (queue.length) {
        const rel = queue.shift();
        if (rel in files) continue;
        files[rel] = null;
        let text;
        try {
            text = await get(SITE + "js/" + rel + "?v=" + v);
        } catch {
            continue; // reported below if the toolkit needs it
        }
        files[rel] = text;
        const dir = path.posix.dirname(rel);
        for (const m of text.matchAll(/(?:from\s*|import\(\s*)"(\.{1,2}\/[^"?]+\.js)(?:\?v=[0-9a-f]+)?"/g)) {
            queue.push(path.posix.normalize(path.posix.join(dir, m[1])));
        }
    }
    return { index, v, files };
}

// The changelog's days, read as text: { date, title, items }
function parseChangelog(text) {
    const str = (s) => JSON.parse('"' + s + '"');
    const days = [];
    const day = /date:\s*"(\d{4}-\d\d-\d\d)"(?:,\s*title:\s*"((?:[^"\\]|\\.)*)")?,\s*items:\s*\[([\s\S]*?)\n\s*\]/g;
    let m;
    while ((m = day.exec(text))) {
        const items = [...m[3].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => str(x[1]));
        days.push({ date: m[1], title: m[2] ? str(m[2]) : "", items });
    }
    return days;
}

async function check() {
    const site = await siteFiles();
    const problems = [];
    const uses = pageImports();
    for (const [mod, names] of Object.entries(uses)) {
        const text = site.files[mod];
        if (text == null) {
            if (!(mod in site.files)) {
                try {
                    site.files[mod] = await get(SITE + "js/" + mod + "?v=" + site.v);
                } catch { /* missing */ }
            }
            if (site.files[mod] == null) {
                problems.push("module gone: js/" + mod);
                continue;
            }
        }
        for (const n of names) if (!exportsName(site.files[mod], n)) problems.push("js/" + mod + " no longer exports " + n);
    }
    const all = site.index + Object.values(site.files).filter(Boolean).join("\n");
    for (const id of usedIds()) {
        if (!all.includes('"' + id + '"') && !all.includes("'" + id + "'") && !all.includes("#" + id) && !all.includes("id=" + id)) {
            problems.push("element id gone: #" + id);
        }
    }
    let changelog = [];
    const cl = site.files["changelog-data.js"] ?? (await get(SITE + "js/changelog-data.js?v=" + site.v).catch(() => null));
    if (cl) changelog = parseChangelog(cl);
    else problems.push("changelog unreadable: js/changelog-data.js");
    return {
        v: site.v, modules: Object.keys(site.files).length, used: Object.keys(uses).length,
        ids: usedIds().length, problems, changelog
    };
}

function dayText(d) {
    return d.items.map((i) => "- " + i).join("\n");
}

// The daily workflow: one issue per new changelog day, and one "Site drift" issue for problems
async function github(report) {
    const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY;
    if (!token || !repo) throw new Error("--github needs GITHUB_TOKEN and GITHUB_REPOSITORY");
    const api = async (method, url, body) => {
        const res = await fetch("https://api.github.com/repos/" + repo + url, {
            method,
            headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "user-agent": "omhp-toolkit-canary" },
            body: body ? JSON.stringify(body) : undefined
        });
        if (!res.ok) throw new Error("GitHub " + method + " " + url + ": " + res.status + " " + (await res.text()));
        return res.json();
    };
    const issues = [];
    for (let page = 1; page <= 5; page++) {
        const got = await api("GET", "/issues?state=all&per_page=100&page=" + page);
        issues.push(...got.filter((i) => !i.pull_request));
        if (got.length < 100) break;
    }
    const titles = new Set(issues.map((i) => i.title));
    const filed = issues.filter((i) => i.title.startsWith("Game update "));
    const newestFiled = filed.map((i) => i.title.slice("Game update ".length, "Game update ".length + 10)).sort().pop() || "";
    // The first run files only the newest day; after that, every day newer than the last filed
    const fresh = newestFiled ? report.changelog.filter((d) => d.date > newestFiled) : report.changelog.slice(0, 1);
    for (const d of fresh.reverse()) {
        const title = "Game update " + d.date + (d.title ? ": " + d.title : "");
        if (titles.has(title)) continue;
        await api("POST", "/issues", {
            title,
            body: "New in the game's [ CHANGELOG ] (site `?v=" + report.v + "`):\n\n" + dayText(d) +
                "\n\nCheck whether any of this touches the toolkit."
        });
        console.log("filed: " + title);
    }
    if (!report.problems.length) return;
    const body = "The daily check found parts of the site the toolkit uses that are gone (site `?v=" + report.v + "`):\n\n" +
        report.problems.map((p) => "- " + p).join("\n");
    const marker = "<!-- drift:" + report.problems.join("|") + " -->";
    const open = issues.find((i) => i.title === "Site drift" && i.state === "open");
    if (!open) {
        await api("POST", "/issues", { title: "Site drift", body: body + "\n" + marker });
        console.log("filed: Site drift");
        return;
    }
    // Only comment when the problems have changed
    const comments = await api("GET", "/issues/" + open.number + "/comments?per_page=100");
    const last = comments.length ? comments[comments.length - 1].body : open.body;
    if (!last.includes(marker)) await api("POST", "/issues/" + open.number + "/comments", { body: body + "\n" + marker });
}

async function main() {
    const report = await check();
    console.log("site ?v=" + report.v + ": " + report.modules + " modules, " + report.used + " used by the toolkit, " +
        report.ids + " element ids checked");
    if (report.problems.length) {
        console.log("\nDRIFT:");
        report.problems.forEach((p) => console.log("  " + p));
    } else {
        console.log("no drift: everything the toolkit uses is still there");
    }
    const since = value("since");
    const days = since ? report.changelog.filter((d) => d.date > since) : report.changelog.slice(0, 2);
    console.log("\nCHANGELOG" + (since ? " after " + since : " (newest 2 days)") + ":");
    for (const d of days) console.log("\n" + d.date + (d.title ? " " + d.title : "") + "\n" + dayText(d));
    if (flag("github")) await github(report);
    process.exitCode = report.problems.length ? 1 : 0;
}

if (require.main === module) {
    main().catch((e) => {
        console.error(e.message || e);
        process.exitCode = 2;
    });
}

module.exports = { parseChangelog, exportsName, pageImports, usedIds };
