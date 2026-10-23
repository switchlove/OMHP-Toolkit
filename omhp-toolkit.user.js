// ==UserScript==
// @name         OMHP Toolkit
// @namespace    https://github.com/switchlove/OMHP-Toolkit
// @version      0.27
// @description  Three-column layout with pinned and pop-out panels, a boss HP graph with kill ETA and replay, session, loot and boss logs, alerts, chat filters, saved layouts and colour themes for One Million HP
// @author       switchlove
// @license      MIT
// @homepageURL  https://github.com/switchlove/OMHP-Toolkit
// @supportURL   https://github.com/switchlove/OMHP-Toolkit/issues
// @updateURL    https://raw.githubusercontent.com/switchlove/OMHP-Toolkit/main/omhp-toolkit.user.js
// @downloadURL  https://raw.githubusercontent.com/switchlove/OMHP-Toolkit/main/omhp-toolkit.user.js
// @match        https://onemillionhp.com/*
// @match        https://www.onemillionhp.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=onemillionhp.com
// @grant        none
// ==/UserScript==

// What this does:
//
// LAYOUT
//   - Widens the page to three columns: feed/chat/messages | boss | side panels.
//     Under 1300px wide the left column drops below everything else.
//   - Left column: ATTACKS, CHAT, MESSAGES, LOOT and BOSSES sections. Each one collapses,
//     moves up/down, pops out, and resizes by dragging its bottom edge.
//   - Drag the gaps between columns to resize them. Double-click any drag handle to reset.
//   - The boss column and the right column stay pinned in view while you scroll.
//   - Right column: a flat tab bar (every unlocked tab as a button, short labels, no
//     dropdowns). [PIN] keeps the open panel above the others (drag the line under it
//     to resize). [POP OUT] opens it in a floating window. BAG's loot-box cards are
//     smaller so more fit across, and in the same order as SHOP. RANKS (30s) and HISTORY (60s) refresh
//     while they're on screen.
//   - Floating windows can be dragged, resized, minimised and faded, and you can
//     have several open at once.
//   - Hides the clutter: the duplicate MESSAGES heading, the key hints and the
//     footer (the site's error line stays).
//
// BOSS
//   - An ASCII HP graph next to the boss art, covering the boss's whole life since
//     you first saw it (kept across reloads). It marks heals, phase changes, FOG, players
//     online and your own damage (those two on a scale at the right); hovering shows the
//     readout for that moment, and clicking a legend entry hides or shows it.
//   - Under the HP: HP/min, everyone's DMG/min, HP healed, and an estimated kill time
//     with a range (what the last 1 and 15 minutes say).
//   - [ALL] [1H] [15M] on the graph zoom in on the recent part of a long fight.
//   - BOSSES: every boss you've seen, with how long it lasted, your damage and share,
//     peak players online and HP healed; [GRAPH] opens its HP graph in a window.
//   - During the FOG event it uses the site's real data and never records the fake HP.
//
// FIGHT
//   - YOUR SHARE: your percentage of all the damage on this boss.
//   - SESSION (its own box under FIGHT): your damage today, per hour, attacks, best and
//     average hit, crit rate, shards earned and spent, shards per hour and time played.
//     Kept across reloads until [RESET] or a new day; [DAYS] shows the last 14 days.
//     Hover AVG HIT for the spread of your last 200 hits.
//   - FULL IN: time until every attack slot has refilled, and IDLE: how long today
//     your attacks sat full, recharging nothing.
//   - LOOT: what you found today, counted by rarity with drops per 100 attacks (kept like
//     SESSION, with [RESET]; hover for the last 30 days). [CHESTS] compares what your
//     box openings gave with the site's stated odds.
//
// TOP BAR
//   - [TOOLKIT]: highlight colour, themes (TERMINAL, MIDNIGHT, PHOSPHOR, PAPER), FEATURES
//     to switch parts of this script on or off (applies on reload), the loot alert
//     rarity, the shortcut keys, add-ons it found, saved LAYOUTs, and EXPORT / IMPORT
//     of everything as a backup file.
//   - Local time and how long the page has been open.
//   - The account button shows your badges and name instead of [LOGIN].
//   - A "⚠ N OFF" warning if parts of this script couldn't start (the site changed).
//
// MORE
//   - Alt shortcuts: Alt+1..9 picks a right-column tab, Alt+P pins, Alt+O pops out,
//     Alt+T opens [TOOLKIT].
//   - FILTER on ATTACKS and CHAT: hide lines with some words or names, highlight others.
//   - COMPACT (off by default): tighter lines and spacing everywhere.
//   - [REPLAY] on the HP graph plays the boss's history back from the start.
//   - STATS THEME: if Zephy's "1MHP Data Statistics" userscript is installed, its panel
//     takes on this page's theme and highlight colour.
//
// ALERTS
//   - The browser tab's title adds the boss's HP and kill estimate: "(3/5) [72% ~39m] ...".
//   - NOTIFY (off by default): desktop notifications while the tab is in the background
//     for full attacks, boss down / new boss, FOG, new messages and loot from a set rarity.
//
// Your layout, sizes, order, colours, features, HP history, session and loot are saved in
// localStorage. With the game open in several tabs, one records and the others follow it.

(function() {
    var LEFT_TABS = ["feed", "chat", "both", "dms"];
    var SECTIONS = [
        { key: "feed", panel: "panel-feed", title: "ATTACKS", scroller: "#feed" },
        { key: "chat", panel: "panel-chat", title: "CHAT", scroller: "#chat-list" },
        { key: "dms", panel: "panel-dms", title: "MESSAGES", scroller: "#panel-dms" },
        { key: "loot", panel: "omhp-loot", title: "LOOT", scroller: "#omhp-loot-list" }, // built by lootLog()
        { key: "bosses", panel: "omhp-bosses", title: "BOSSES", scroller: "#omhp-bosses-list" } // built by bossLog()
    ];
    var ORDER_KEY = "omhp.layout.order";
    var THEME_KEY = "omhp.layout.theme";
    var PIN_KEY = "omhp.layout.pinned";
    var THEMES = [
        { name: "TERMINAL", vars: null }, // the site's own colours
        { name: "MIDNIGHT", vars: { bg: "#0b1020", "bg-2": "#121a30", fg: "#dfe6f5", dim: "#7f8aa6", faint: "#2c3550" } },
        { name: "PHOSPHOR", vars: { bg: "#040904", "bg-2": "#0a140a", fg: "#b6ffb0", dim: "#5f9a5a", faint: "#1f3a1f" } },
        { name: "PAPER", vars: { bg: "#f4efe2", "bg-2": "#e9e2d0", fg: "#2a2620", dim: "#6e665a", faint: "#c9c0ab" } }
    ];
    var STORE_KEY = "omhp.layout.collapsed";
    var HEIGHTS_KEY = "omhp.layout.heights";
    var WIDTHS_KEY = "omhp.layout.widths";
    var ACCENT_KEY = "omhp.layout.accent";
    var ACCENTS = [
        { name: "AMBER", hex: "#ffb000" },
        { name: "GREEN", hex: "#9bff7a" },
        { name: "CYAN", hex: "#5fe0ff" },
        { name: "PINK", hex: "#ff6ad5" },
        { name: "RED", hex: "#ff5340" },
        { name: "VIOLET", hex: "#b28bff" },
        { name: "WHITE", hex: "#e8e1cb" }
    ];
    var ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    // The site's item rarities, lowest first (its r-* classes)
    var RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "godly", "ascended", "sovereign"];
    var NOTIFY_RARITY_KEY = "omhp.layout.notifyRarity";
    // What a layout is made of (presets, RESET): column sizes, section order and heights,
    // collapsed sections, the pinned panel and its height, pop-out windows
    var LAYOUT_KEYS = [ORDER_KEY, STORE_KEY, "omhp.layout.heights", "omhp.layout.widths", "omhp.layout.pinH", "omhp.layout.floats", PIN_KEY];
    var DAYS_KEY = "omhp.days";
    var PRESETS_KEY = "omhp.presets";

    // Pure helpers: they don't touch the page or storage, so test/lib.test.js runs them in Node.

    // 1234567 -> "1.2M", 243000 -> "243K"
    function short(n) {
        if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M";
        if (n >= 1e3) return Math.round(n / 1e3) + "K";
        return String(n);
    }

    function fmt(n) {
        return Math.round(n).toLocaleString("en-US");
    }

    // 42 -> "42m", 187 -> "3h 07m"
    function dur(mins) {
        mins = Math.round(mins);
        if (mins < 60) return mins + "m";
        return Math.floor(mins / 60) + "h " + String(mins % 60).padStart(2, "0") + "m";
    }

    // Local date as "YYYY-MM-DD" (now, or the date given), for things that start over each day
    function today(d) {
        d = d || new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    // A time as "14:32"
    function hhmm(t) {
        return new Date(t).toTimeString().slice(0, 5);
    }

    // The tab title with our part ("[72% ~39m]", "[FOG]", or "" for none) after the site's
    // attack count: "(3/5) ONE MILLION HP" -> "(3/5) [72% ~39m] ONE MILLION HP". A title a
    // world event is flashing ("(!) ...") is left as it is.
    var TITLE_PART = /\[(?:FOG|\d[\d.]*%[^\]]*)\] ?/;

    function titleWith(title, part) {
        if (/^\(!\)/.test(title)) return title;
        var plain = title.replace(TITLE_PART, "");
        if (!part) return plain;
        var m = plain.match(/^\(\d+\/\d+\)/);
        return m ? m[0] + " " + part + plain.slice(m[0].length) : part + " " + plain;
    }

    // SESSION's numbers: lifetime totals now (t) minus the first reading today (s.base), plus
    // what was counted from the screen without the site's data (s.extra)
    function sessionCounts(s, t) {
        var b = s.base;
        var d = t && b ? { dmg: t.dmg - b.dmg, hits: t.hits - b.hits, crits: (t.crits || 0) - (b.crits || 0) }
            : { dmg: 0, hits: 0, crits: 0 };
        return { dmg: d.dmg + s.extra.dmg, hits: d.hits + s.extra.hits, crits: d.crits + s.extra.crits };
    }

    // Drops per 100 attacks: 3 in 250 -> "1.2%"
    function dropRate(n, hits) {
        var pct = n / hits * 100;
        return (pct >= 10 ? pct.toFixed(0) : pct >= 1 ? pct.toFixed(1) : pct.toFixed(2)) + "%";
    }

    // A chance (0..1) the way the site's odds box writes it: 48% / 9.6% / 0.12% / <0.001%
    function pct(p) {
        var v = p * 100;
        if (v <= 0) return "0%";
        if (v < 0.001) return "<0.001%";
        if (v >= 99.95) return "100%";
        var digits = v >= 10 ? 0 : v >= 1 ? 1 : Math.min(3, 1 - Math.floor(Math.log10(v)));
        return Number(v.toFixed(digits)) + "%";
    }

    // The chest ledger's name for what a box gave: the rarity for an item ("legendary"),
    // otherwise the reward and its amount ("attacks:5", "ultimate")
    function outcomeKey(kind, rarity, amount) {
        if (kind === "item") return rarity || "item";
        return amount ? kind + ":" + amount : kind;
    }

    // ...and how it reads: "LEGENDARY", "+5 ATTACKS", "2 CRIT CHARGES", "ULTIMATE"
    function outcomeLabel(key) {
        var parts = key.split(":"), kind = parts[0], n = Number(parts[1]);
        if (kind === "attacks") return "+" + n + " ATTACK" + (n === 1 ? "" : "S");
        if (kind === "next_crit") return n + " CRIT CHARGE" + (n === 1 ? "" : "S");
        if (kind === "ultimate") return "ULTIMATE RECHARGE";
        if (kind === "scroll") return "A SCROLL";
        return kind.replace(/_/g, " ").toUpperCase();
    }

    // HP lost per minute over the last `mins` minutes of samples ({ t, hp }, oldest first), or
    // over all of them if they cover less; null when they cover under half a minute
    function rateOver(samples, now, mins) {
        if (!samples.length) return null;
        var from = samples[0];
        for (var i = samples.length - 1; i >= 0; i--) {
            if (now - samples[i].t > mins * 60000) break;
            from = samples[i];
        }
        var m = (now - from.t) / 60000;
        var hp = samples[samples.length - 1].hp;
        return m >= 0.5 ? { perMin: (from.hp - hp) / m, first: from, minutes: m } : null;
    }

    // Minutes left at each window's rate, for the windows where the boss is going down
    function etaMinutes(samples, now, windows) {
        var hp = samples.length ? samples[samples.length - 1].hp : 0;
        return windows.map(function(w) { return rateOver(samples, now, w); })
            .filter(function(r) { return r && r.perMin > 0; })
            .map(function(r) { return hp / r.perMin; });
    }

    // Long fights: past `max` points, keep every second point of the older half (the start
    // and the recent part stay)
    function thinPoints(points, max) {
        if (points.length <= max) return points;
        var half = Math.floor(points.length / 2);
        return points.slice(0, half).filter(function(p, i) { return i % 2 === 0; }).concat(points.slice(half));
    }

    // At most n points, picked evenly across the whole list (the first and last always kept)
    function shrinkPoints(points, n) {
        if (points.length <= n) return points.slice();
        var out = [];
        for (var i = 0; i < n; i++) out.push(points[Math.round(i * (points.length - 1) / (n - 1))]);
        return out;
    }

    // The HP graph's columns: for `cols` columns from t0 over `span` ms, the last reading in
    // each (gaps carry the previous one forward). points are [time, hp, phase, online, your
    // lifetime damage]; fog is [[start, end], ...]. Nothing after `cutoff` (the replay).
    // mine is your damage within each column; fogCols says which columns FOG covered.
    function bucketColumns(points, fog, t0, span, cols, cutoff) {
        var vals = [], phases = [], online = [], mine = [], fogCols = [];
        var j = 0, last = null, lastPhase = null, lastOnline = null, lastMine = null, prevMine = null;
        for (var c = 0; c < cols; c++) {
            var start = t0 + span * c / cols, end = t0 + span * (c + 1) / cols;
            fogCols.push(start <= cutoff && fog.some(function(f) { return f[0] <= end && f[1] >= start; }));
            if (start > cutoff) {
                vals.push(null);
                phases.push(null);
                online.push(null);
                mine.push(null);
                continue;
            }
            while (j < points.length && points[j][0] <= end) {
                last = points[j][1];
                if (points[j][2]) lastPhase = points[j][2];
                if (points[j][3] != null) lastOnline = points[j][3];
                if (points[j][4] != null) lastMine = points[j][4];
                j++;
            }
            vals.push(last);
            phases.push(lastPhase);
            online.push(lastOnline);
            mine.push(lastMine !== null && prevMine !== null && lastMine >= prevMine ? lastMine - prevMine : null);
            prevMine = lastMine;
        }
        return { vals: vals, phases: phases, online: online, mine: mine, fogCols: fogCols };
    }
    var css = `
        #app { max-width: 90%; }

        /* Feed, chat, messages | boss | side panels */
        @media (min-width: 1300px) {
            #app .columns {
                /* --omhp-l / --omhp-r are set when you drag the column gaps */
                grid-template-columns: var(--omhp-l, minmax(0, 1fr)) minmax(0, 1.2fr) var(--omhp-r, minmax(0, 1fr));
                position: relative;
            }
            #app .columns > .col-drag { display: block; }
            #col-left { position: sticky; top: 12px; max-height: calc(100vh - 24px); overflow-y: auto; }
            #app .col-main { position: sticky; } /* top is set by pinMain() */

            /* Right column: pinned, tab bar on top, the open panel scrolls under it */
            #app .col-side {
                position: sticky; top: 12px; max-height: calc(100vh - 24px);
                display: flex; flex-direction: column;
            }
            #app .col-side > #tabs { flex: none; z-index: 5; } /* dropdowns stay above the panel */
            #app .col-side > .panel {
                flex: 1 1 auto; min-height: 0;
                overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin;
            }

            /* A pinned column can't stay pinned past the bottom of its row, so the page
               mustn't scroll further than that: no space below the columns. The footer's
               error line floats at the bottom of the window instead. */
            #app { padding-bottom: 12px; }
            .foot {
                position: fixed; left: 0; right: 0; bottom: 4px; margin: 0;
                z-index: 40; pointer-events: none;
            }
            .foot > p { margin: 0; }
        }
        /* Narrower screens: the left column drops below everything else */
        @media (max-width: 1299px) {
            #col-left { order: 99; grid-column: 1 / -1; }
        }

        #col-left { padding-top: 4px; scrollbar-width: thin; }
        #col-left .panel { min-height: 0; }
        #col-left #feed { max-height: none; height: calc(25vh - 60px); min-height: 100px; }
        #col-left #chat-list { height: calc(50vh - 150px); min-height: 0; }
        #col-left #panel-dms { overflow-y: auto; scrollbar-width: thin; }

        .left-section + .left-section { margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--faint); }
        .left-toggle {
            display: block; width: 100%; text-align: left; background: none; border: 0; padding: 2px 0 6px;
            font: inherit; font-size: 12px; letter-spacing: .15em; color: var(--dim); cursor: pointer;
        }
        .left-toggle:hover, .left-toggle:focus-visible { color: var(--fg); outline: none; }
        .left-section.collapsed > .panel { display: none !important; }

        /* Drag to resize; double-click to reset */
        .left-resize { height: 8px; margin-top: 2px; cursor: ns-resize; touch-action: none; position: relative; }
        .left-resize::after {
            content: ""; position: absolute; left: 40%; right: 40%; top: 3px;
            border-top: 2px dotted var(--faint);
        }
        .left-resize:hover::after, .left-resize.dragging::after { border-top-color: var(--fg); }
        .left-section.collapsed > .left-resize { display: none; }

        /* These panels live on the left now, so hide the FEED menu on the right */
        #tabs .tab-group[data-group="feed"] { display: none !important; }

        /* Tidy up: the duplicate MESSAGES heading, the key hints, and the footer
           (except the line where the site shows errors) */
        #panel-dms > .panel-h:first-child { display: none; }
        .keys { display: none; }

        /* FIGHT: put the "26 / 26" attack count on its own line under the pips */
        #pips > span:last-child:not(.on):not(.off):not(.dim) { display: block; }

        /* Column gap handles: drag to resize, double-click to reset */
        .col-drag {
            display: none; position: absolute; top: 0; bottom: 0; width: 10px; margin-left: -5px;
            cursor: ew-resize; touch-action: none; z-index: 6;
        }
        .col-drag::after {
            content: ""; position: absolute; left: 4px; top: 40%; bottom: 40%;
            border-left: 2px dotted var(--faint);
        }
        .col-drag:hover::after, .col-drag.dragging::after { border-left-color: var(--fg); }

        /* Flat tab bar: every unlocked tab as a button, no dropdowns (FLAT TABS feature) */
        html.omhp-flattabs #tabs .tab-cat { display: none; }
        html.omhp-flattabs #tabs .tab-group { position: static; display: contents; }
        html.omhp-flattabs #tabs .tab-menu, html.omhp-flattabs #tabs .tab-menu[hidden] {
            display: flex !important; position: static; transform: none; flex-direction: row; flex-wrap: wrap;
            align-items: center; min-width: 0; padding: 0; margin: 0; background: none; border: 0; box-shadow: none;
        }
        html.omhp-flattabs #tabs .tab-menu button { padding: 2px 3px; font-size: 11px; letter-spacing: 0; }
        /* Short labels (see shortTabs): hide the site's text, show data-short instead */
        html.omhp-flattabs #tabs .tab-menu [role=tab][data-short] { font-size: 0; }
        html.omhp-flattabs #tabs .tab-menu [role=tab][data-short]::before { content: attr(data-short); font-size: 11px; }
        html.omhp-flattabs #tabs .tab-menu button.has-new:not([aria-selected="true"]) { color: var(--amber); }
        html.omhp-flattabs #tabs .tab-menu .tab-link { display: none; }
        /* One line per section (WORLD / YOU / LEADERBOARD / GAME); [PIN] [POP OUT] share the last */
        html.omhp-flattabs #tabs .tab-menu, html.omhp-flattabs #tabs .tab-menu[hidden] { flex: 0 0 100%; justify-content: center; }

        /* Boss kill ETA, HP sparkline, session damage, attacks-full timer */
        #omhp-eta { font-size: 12px; letter-spacing: .08em; margin-top: 2px; }

        /* Boss area split: ASCII art left, HP graph right */
        #omhp-boss-split { display: flex; gap: 10px; align-items: center; }
        #omhp-boss-split > #boss-stage { flex: 1 1 0; min-width: 0; }
        .omhp-graph { flex: 1 1 0; min-width: 0; text-align: left; overflow: hidden; }
        .omhp-graph-head { font-size: 11px; color: var(--dim); letter-spacing: .04em; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; white-space: nowrap; }
        .omhp-graph-plot { margin: 0; font-size: 11px; line-height: 1; letter-spacing: 0; white-space: pre; color: var(--faint); }
        .omhp-graph-plot .line { color: var(--red); }
        .omhp-graph-plot .fill { color: var(--red); opacity: .35; }
        .omhp-graph-plot .heal { color: var(--mythic); }
        .omhp-graph-plot .mark { color: var(--amber); }
        .omhp-graph-plot .online { color: var(--blue); }
        .omhp-graph-plot .mine { color: var(--green); }
        .omhp-graph-plot .fog { color: var(--dim); opacity: .6; }
        .omhp-graph { position: relative; }
        .omhp-graph-plot { cursor: crosshair; }
        /* Legend entries switch their series on and off */
        .omhp-graph-plot [data-series] { cursor: pointer; }
        .omhp-graph-plot [data-series]:hover { color: var(--fg); }
        .omhp-graph-plot .omhp-legend-off { opacity: .45; text-decoration: line-through; }
        .omhp-graph-cursor {
            position: absolute; width: 1px; background: var(--fg); opacity: .4; pointer-events: none;
        }
        .omhp-graph-tip {
            position: absolute; z-index: 2; pointer-events: none; white-space: pre;
            padding: 3px 6px; background: var(--bg-2); border: 1px solid var(--dim);
            color: var(--fg); font-size: 11px; line-height: 1.35; letter-spacing: .03em;
        }
        .omhp-graph-cursor[hidden], .omhp-graph-tip[hidden] { display: none; }
        .omhp-replay, .omhp-zoom { font-size: 10px; color: var(--faint); margin-left: 6px; letter-spacing: .04em; }
        .omhp-zoom { margin-left: 4px; }
        .omhp-zoom:first-of-type { margin-left: 8px; }
        .omhp-zoom.on { color: var(--fg); }
        .omhp-zoom:hover { color: var(--fg); }
        /* An old fight's graph (BOSSES > [GRAPH]) in its own window, filling it */
        .omhp-graph-win .omhp-float-body { padding: 6px 10px 10px; }
        .omhp-graph-win .omhp-graph { flex: 1 1 0; min-height: 0; }
        .omhp-replay:hover { color: var(--fg); }

        /* FILTER: hidden and highlighted lines in ATTACKS and CHAT, and the boxes to set them */
        #feed li.omhp-hide, #chat-list li.omhp-hide { display: none; }
        #feed li.omhp-mark, #chat-list li.omhp-mark {
            background: color-mix(in srgb, var(--amber) 12%, transparent); box-shadow: inset 2px 0 var(--amber);
        }
        .omhp-filter { display: grid; gap: 4px; margin: 0 0 6px; font-size: 10px; color: var(--dim); letter-spacing: .12em; }
        .omhp-filter label { display: flex; gap: 6px; align-items: center; }
        .omhp-filter-in {
            flex: 1; min-width: 0; padding: 2px 4px; background: var(--bg); color: var(--fg);
            border: 1px solid var(--faint); font: inherit; font-size: 11px; letter-spacing: 0;
        }
        .omhp-filter-in:focus { border-color: var(--dim); outline: none; }
        .omhp-menu-hint { color: var(--dim); font-size: 10px; letter-spacing: .04em; }

        /* COMPACT: tighter lines and spacing everywhere */
        html.omhp-compact body { font-size: 13px; }
        html.omhp-compact .feed li, html.omhp-compact .chat-list li { padding: 0; gap: 6px; }
        html.omhp-compact .feed .m { line-height: 1.2; }
        html.omhp-compact .box { padding: 8px; }
        html.omhp-compact .panel-h { margin-bottom: 4px; }
        html.omhp-compact .left-section + .left-section { margin-top: 4px; padding-top: 3px; }
        html.omhp-compact .left-toggle { padding: 0 0 3px; }
        /* SESSION: a box of its own under FIGHT, label / value cells */
        .omhp-sess-grid {
            display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 2px 16px;
            font-size: 12px; text-align: left;
        }
        .omhp-sess-cell { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; border-bottom: 1px dotted var(--faint); }
        .omhp-sess-cell[title] { cursor: help; }
        .omhp-sess-cell .k { color: var(--dim); font-size: 11px; letter-spacing: .1em; }
        .omhp-sess-cell .v { color: var(--fg); font-variant-numeric: tabular-nums; white-space: nowrap; }
        .omhp-sess-tools { margin-top: 6px; text-align: right; }

        /* STATS THEME: Zephy's "1MHP Data Statistics" userscript (#omhp-tracker), when it's
           installed, drawn in this page's theme and highlight colour instead of fixed amber */
        html.omhp-stats-theme #omhp-tracker {
            background: var(--bg); color: var(--fg); border-color: var(--dim); font-family: var(--font, monospace);
        }
        html.omhp-stats-theme #omhp-tracker-head {
            background: var(--bg-2); border-bottom-color: var(--faint); color: var(--amber); letter-spacing: .1em;
        }
        html.omhp-stats-theme #omhp-tracker-head:hover { background: var(--bg); }
        html.omhp-stats-theme #omhp-tracker .omhp-version-badge { color: var(--dim); background: var(--bg); border-color: var(--faint); }
        html.omhp-stats-theme #omhp-tracker .omhp-tab-bar,
        html.omhp-stats-theme #omhp-tracker .omhp-actions { border-color: var(--faint); }
        html.omhp-stats-theme #omhp-tracker .omhp-tab-btn { background: var(--bg-2); border-color: var(--faint); color: var(--dim); }
        html.omhp-stats-theme #omhp-tracker .omhp-tab-btn:hover { color: var(--fg); }
        html.omhp-stats-theme #omhp-tracker .omhp-tab-btn.active { background: var(--bg); border-color: var(--amber); color: var(--amber); }
        html.omhp-stats-theme #omhp-tracker .omhp-table th,
        html.omhp-stats-theme #omhp-tracker .omhp-table td { border-color: var(--faint); }
        html.omhp-stats-theme #omhp-tracker .omhp-table th { background: var(--bg-2); color: var(--fg); }
        html.omhp-stats-theme #omhp-tracker .omhp-cond-header {
            background: var(--bg-2); border-color: var(--faint); border-left-color: var(--amber); color: var(--fg);
        }
        html.omhp-stats-theme #omhp-tracker .omhp-cond-header:hover { background: var(--bg); border-color: var(--dim); border-left-color: var(--amber); }
        html.omhp-stats-theme #omhp-tracker .omhp-cond-agg { color: var(--dim); }
        html.omhp-stats-theme #omhp-tracker .omhp-cond-agg b,
        html.omhp-stats-theme #omhp-tracker .omhp-live-val { color: var(--fg); }
        html.omhp-stats-theme #omhp-tracker .omhp-toggle-sym { color: var(--amber); }
        html.omhp-stats-theme #omhp-tracker .omhp-act-btn { background: var(--bg-2); border-color: var(--amber); color: var(--amber); }
        html.omhp-stats-theme #omhp-tracker .omhp-act-btn:hover { background: var(--amber); color: var(--bg); }
        html.omhp-stats-theme #omhp-tracker .omhp-live-card { background: var(--bg-2); border-color: var(--faint); }
        html.omhp-stats-theme #omhp-tracker .omhp-live-card-title { color: var(--dim); border-bottom-color: var(--faint); }
        html.omhp-stats-theme #omhp-tracker .omhp-live-label { color: var(--dim); }
        /* Its colours written straight onto elements: values, and the faint "nothing yet" text */
        html.omhp-stats-theme #omhp-tracker [style*="#ffd45c"] { color: var(--fg) !important; }
        html.omhp-stats-theme #omhp-tracker [style*="#6d5b38"],
        html.omhp-stats-theme #omhp-tracker [style*="#665"] { color: var(--dim) !important; }
        /* Its rarity colours, as the site draws them (without the animations) */
        html.omhp-stats-theme #omhp-tracker .rar-common { color: #b9b2a0; }
        html.omhp-stats-theme #omhp-tracker .rar-uncommon { color: var(--green); }
        html.omhp-stats-theme #omhp-tracker .rar-rare { color: var(--blue); }
        html.omhp-stats-theme #omhp-tracker .rar-epic { color: #9a7bff; }
        html.omhp-stats-theme #omhp-tracker .rar-legendary { color: #ff9a1f; }
        html.omhp-stats-theme #omhp-tracker .rar-mythic { color: #ff3b5c; }
        html.omhp-stats-theme #omhp-tracker .rar-godly { color: #fff; text-shadow: 0 0 6px #ffd84d; }
        html.omhp-stats-theme #omhp-tracker .rar-ascended { color: #ff8fd8; text-shadow: none; }
        html.omhp-stats-theme #omhp-tracker .rar-boss-unique,
        html.omhp-stats-theme #omhp-tracker .rar-boss_unique,
        html.omhp-stats-theme #omhp-tracker .rar-unique { color: #bffcff; text-shadow: 0 0 6px #76f5ff; }

        /* Left column headers: collapse toggle + reorder arrows */
        .left-head { display: flex; align-items: center; gap: 2px; }
        .left-head .left-toggle { flex: 1; }
        .left-move {
            background: none; border: 0; padding: 0 3px 4px; font: inherit; font-size: 10px;
            color: var(--faint); cursor: pointer;
        }
        .left-move:hover, .left-move:focus-visible { color: var(--fg); outline: none; }

        /* LOOT section */
        .omhp-loot-sum { margin: 0 0 4px; }
        .omhp-rate { color: var(--faint); font-size: 10px; }
        /* [CHESTS]: the chest ledger, observed against stated odds */
        .omhp-chests { margin: 0 0 6px; font-size: 11px; }
        .omhp-chests[hidden] { display: none; }
        .omhp-chests-head { color: var(--dim); letter-spacing: .08em; margin-bottom: 2px; }
        .omhp-chests-box { color: var(--fg); margin-top: 6px; letter-spacing: .06em; }
        .omhp-chests-row { display: grid; grid-template-columns: minmax(0, 1fr) auto 8.5em; gap: 8px; padding-left: 1ch; }
        .omhp-chests-row .v { color: var(--fg); text-align: right; font-variant-numeric: tabular-nums; }
        .omhp-chests-row .dim { text-align: right; }
        #omhp-loot-list { max-height: none; height: 140px; overflow-y: auto; }

        /* Pinned right panel: on top, scrolls on its own; the tab bar switches the one below */
        #omhp-pinned {
            flex: 0 1 auto; max-height: 45%; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin;
            margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed var(--faint);
        }
        #omhp-pinned > .panel { min-height: 0; }
        /* Drag the line under the pinned panel to share the column's height; it has a set
           height once dragged */
        #omhp-pinned.sized { flex: none; max-height: none; }
        #omhp-pin-resize { flex: none; margin: -4px 0 4px; }
        #omhp-pin-resize[hidden] { display: none; }

        /* BAG: smaller loot-box cards so more fit across the right column */
        .col-side .box-row, .omhp-float .box-row { gap: 6px; }
        .col-side .box-card, .omhp-float .box-card { padding: 3px 5px; min-width: 0; }
        .col-side .box-card pre, .omhp-float .box-card pre { font-size: 10px; line-height: 1.05; margin: 0; }
        .col-side .box-card-actions, .omhp-float .box-card-actions { gap: 0; margin-top: 2px; }
        .col-side .box-card-actions .inline-btn, .omhp-float .box-card-actions .inline-btn {
            font-size: 11px; padding: 1px 2px; letter-spacing: 0;
        }
        #tabs .omhp-pin { font-size: 11px; padding: 2px 4px; margin-left: 6px; color: var(--dim); }
        #tabs .omhp-pin:hover { color: var(--fg); }

        /* Pop-out windows: [POP OUT] for the open right-hand panel, ⧉ on left sections */
        #tabs .omhp-popout { font-size: 11px; padding: 2px 4px; margin-left: 6px; color: var(--dim); }
        #tabs .omhp-popout:hover:not(:disabled) { color: var(--fg); }
        #tabs .omhp-popout:disabled { color: var(--faint); cursor: default; }
        .omhp-float {
            position: fixed; z-index: 60; display: flex; flex-direction: column;
            min-width: 300px; min-height: 200px; resize: both; overflow: hidden;
            background: var(--bg); border: 1px solid var(--dim); box-shadow: 0 10px 40px rgba(0,0,0,.7);
        }
        .omhp-float-bar {
            flex: none; display: flex; justify-content: space-between; align-items: center;
            padding: 4px 8px; background: var(--bg-2); border-bottom: 1px solid var(--faint);
            color: var(--amber); font-size: 12px; letter-spacing: .15em; cursor: move; user-select: none;
        }
        .omhp-float-body {
            flex: 1; min-height: 0; display: flex; flex-direction: column;
            overflow: auto; padding: 8px 12px 16px; scrollbar-width: thin;
        }
        .omhp-float-body > .panel { flex: 1 0 auto; min-height: 0; }
        .omhp-float-tools { display: flex; align-items: center; gap: 8px; }
        .omhp-float-op { width: 70px; height: 12px; accent-color: var(--amber); cursor: pointer; }
        .omhp-float.minimised { resize: none; min-height: 0; }
        .omhp-float.minimised > .omhp-float-body { display: none; }
        /* Lists that scroll on their own fill the window instead of keeping their column height */
        .omhp-float-body > #panel-feed, .omhp-float-body > #panel-chat, .omhp-float-body > #omhp-loot {
            flex: 1 1 0; display: flex; flex-direction: column; overflow: hidden;
        }
        .omhp-float-body #panel-chat > .chat, .omhp-float-body #panel-feed > .feed-wrap {
            flex: 1 1 0; min-height: 0; display: flex; flex-direction: column;
        }
        .omhp-float-body #chat-list, .omhp-float-body #feed, .omhp-float-body #omhp-loot-list {
            flex: 1 1 0; height: auto !important; max-height: none !important; min-height: 0;
        }
        /* DESIGN: the grid fills the window's width (the site's own sizing stops at 16px) */
        .omhp-float .design-canvas { font-size: var(--omhp-design-font, 13px) !important; }
        /* A left section whose panel is out in a window */
        .left-section.floated .left-toggle::after { content: " (popped out)"; color: var(--faint); }
        .left-section.floated > .left-resize { display: none; }

        /* [TOOLKIT] menu: a header, then one labelled row per setting */
        .omhp-accent-wrap { position: relative; display: inline-block; }
        .omhp-accent-pop {
            position: absolute; top: calc(100% + 6px); right: 0; z-index: 50;
            width: 340px; max-width: calc(100vw - 24px); padding: 0 0 8px;
            background: var(--bg-2); border: 1px solid var(--dim); box-shadow: 0 6px 18px rgba(0,0,0,.6);
            text-align: left; white-space: normal; font-size: 11px; letter-spacing: .04em;
        }
        .omhp-accent-pop[hidden] { display: none; }
        .omhp-menu-head {
            display: flex; justify-content: space-between; align-items: center;
            padding: 5px 10px; margin-bottom: 2px; border-bottom: 1px solid var(--faint);
            color: var(--amber); font-size: 12px; letter-spacing: .15em;
        }
        .omhp-menu-row { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 8px; padding: 7px 10px 0; }
        .omhp-menu-label { color: var(--faint); font-size: 10px; letter-spacing: .12em; padding-top: 2px; }
        .omhp-menu-body { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; min-width: 0; }
        .omhp-menu-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 8px; }
        .omhp-choice { font-size: 11px; color: var(--dim); padding: 1px 0; letter-spacing: .04em; text-align: left; }
        .omhp-choice:hover, .omhp-choice:focus-visible { color: var(--fg); }
        .omhp-choice.on { color: var(--fg); }
        .omhp-choice.on:not(.omhp-check) { text-decoration: underline; text-underline-offset: 3px; }
        .omhp-check::before { content: "[ ] "; color: var(--faint); white-space: pre; }
        .omhp-check.on::before { content: "[x] "; color: var(--amber); }
        .omhp-menu-note { padding: 4px 10px 0 96px; color: var(--amber); font-size: 10px; letter-spacing: .08em; }
        .omhp-menu-note[hidden] { display: none; }
        .omhp-del { color: var(--faint); margin-left: -7px; }
        .omhp-del:hover { color: var(--red); }
        .omhp-swatch {
            width: 16px; height: 16px; padding: 0; border: 1px solid var(--faint); cursor: pointer;
        }
        .omhp-swatch.on { outline: 2px solid var(--fg); outline-offset: 1px; }
        .omhp-reset { font-size: 10px; color: var(--faint); margin-left: 6px; }
        .omhp-reset:hover { color: var(--fg); }
        .omhp-health { color: var(--red); cursor: help; }
        #omhp-days { white-space: pre; font-size: 11px; line-height: 1.35; color: var(--dim); overflow-x: auto; margin-top: 4px; }
        #omhp-days[hidden] { display: none; }
        .foot { margin-top: 8px; }
        .foot > p:not(#err) { display: none; }
    `;

    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    function loadJSON(key, fallback) {
        try {
            var v = JSON.parse(localStorage.getItem(key));
            return v == null ? fallback : v;
        } catch (e) {
            return fallback;
        }
    }

    function loadSaved(key) {
        return loadJSON(key, {});
    }

    function save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            /* ignore */
        }
    }

    // One clock for the whole script: every(ms, fn) runs fn about every ms. With
    // { visible: true } it skips while this tab is in the background.
    var ticks = [];

    function every(ms, fn, opts) {
        ticks.push({ ms: ms, fn: fn, next: Date.now() + ms, visible: !!(opts && opts.visible) });
    }
    setInterval(function() {
        var now = Date.now();
        ticks.forEach(function(t) {
            if (now < t.next) return;
            t.next = now + t.ms;
            if (t.visible && document.hidden) return;
            try { t.fn(); } catch (e) { console.error("OMHP Toolkit:", e); }
        });
    }, 1000);

    // One watcher on the tab bar for everything that follows its labels (section badges,
    // short tab names): onTabsChange(fn) runs fn whenever a tab's text changes
    var tabWatchers = null;

    function onTabsChange(fn) {
        var tabs = document.getElementById("tabs");
        if (!tabs) return;
        if (!tabWatchers) {
            tabWatchers = [];
            new MutationObserver(function() {
                tabWatchers.forEach(function(f) { f(); });
            }).observe(tabs, { childList: true, characterData: true, subtree: true });
        }
        tabWatchers.push(fn);
    }

    // Features you can switch on/off in [TOOLKIT]: [key, label, on by default?]
    var FEATURES_KEY = "omhp.layout.features";
    var FEATURES = [
        ["graph", "HP GRAPH", true], ["eta", "ETA", true], ["share", "SHARE", true], ["session", "SESSION", true],
        ["full", "FULL IN", true], ["loot", "LOOT", true], ["clock", "CLOCK", true], ["flattabs", "FLAT TABS", true],
        ["account", "NAME", true], ["title", "TAB TITLE", true], ["bosses", "BOSS LOG", true], ["keys", "SHORTCUTS", true],
        ["filters", "FILTERS", true], ["compact", "COMPACT", false], ["stats", "STATS THEME", true], ["boxorder", "BOX ORDER", true],
        ["notify", "NOTIFY", false]
    ];
    var features = loadSaved(FEATURES_KEY);

    function isOn(name) {
        if (typeof features[name] === "boolean") return features[name];
        var f = FEATURES.filter(function(x) { return x[0] === name; })[0];
        return !f || f[2];
    }

    // LOOT and BOSSES are features you can switch off; the site's own sections always stay
    SECTIONS = SECTIONS.filter(function(s) { return isOn(s.key); });
    if (isOn("flattabs")) document.documentElement.classList.add("omhp-flattabs");
    if (isOn("compact")) document.documentElement.classList.add("omhp-compact");
    if (isOn("stats")) document.documentElement.classList.add("omhp-stats-theme");

    function applyAccent(hex) {
        if (hex) document.documentElement.style.setProperty("--amber", hex);
        else document.documentElement.style.removeProperty("--amber");
    }

    function applyTheme(name) {
        var root = document.documentElement.style;
        var theme = THEMES.filter(function(t) { return t.name === name; })[0];
        ["bg", "bg-2", "fg", "dim", "faint"].forEach(function(v) {
            if (theme && theme.vars) root.setProperty("--" + v, theme.vars[v]);
            else root.removeProperty("--" + v);
        });
    }

    // Before anything else paints, so there's no flash of the old colours
    applyTheme(loadJSON(THEME_KEY, null));
    applyAccent(loadJSON(ACCENT_KEY, null));

    // The boss's real HP/phase/number from the site's own data (see paintAccount), or null
    // if that isn't available yet. Falls back to the screen only when it isn't fogged.
    function trueBoss() {
        var el = document.getElementById("omhp-boss-data");
        if (el && el.dataset.boss) {
            try {
                var b = JSON.parse(el.dataset.boss);
                if (b && typeof b.hp === "number") return b;
            } catch (e) { /* fall through */ }
        }
        var bar = document.getElementById("hp-bar");
        if (bar && bar.classList.contains("fogged")) return null; // the screen is lying right now
        var num = ((document.getElementById("boss-num") || {}).textContent || "").match(/\d+/);
        var hp = numberIn(document.getElementById("hp-now"));
        if (!num || hp === null) return null;
        var ph = ((document.getElementById("phase") || {}).textContent || "").match(/PHASE\s+([IVX]+)/);
        return {
            seq: Number(num[0]), hp: hp, max: numberIn(document.getElementById("hp-max")),
            phase: ph ? ROMAN.indexOf(ph[1]) : null,
            dmg: numberIn(document.getElementById("g-damage")), alive: true
        };
    }

    // The site's own flag while the FOG world event is faking the HP readout
    function fogged() {
        var bar = document.getElementById("hp-bar");
        return !!(bar && bar.classList.contains("fogged"));
    }

    function numberIn(el) {
        var m = el && (el.textContent || "").replace(/,/g, "").match(/\d+/);
        return m ? Number(m[0]) : null;
    }

    // Append " :: el" to the top bar, with the spacing the site uses around its separators
    function addToBar(bar, el) {
        var sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "::";
        bar.appendChild(document.createTextNode(" "));
        bar.appendChild(sep);
        bar.appendChild(document.createTextNode(" "));
        bar.appendChild(el);
    }

    function notifyRarity() {
        var r = loadJSON(NOTIFY_RARITY_KEY, "legendary");
        return RARITIES.indexOf(r) === -1 ? "legendary" : r;
    }

    // A desktop notification, only while this tab is in the background (NOTIFY feature)
    function notify(text) {
        if (!isOn("notify") || !document.hidden || !window.Notification || Notification.permission !== "granted") return;
        try {
            new Notification("OMHP", { body: text, tag: "omhp-" + text, icon: "https://www.google.com/s2/favicons?sz=64&domain=onemillionhp.com" });
        } catch (e) {
            /* some browsers only allow notifications from a service worker */
        }
    }

    // The site's numbers for you (lifetime damage, hits, crits), published by the page
    // script (see paintAccount), or null
    function myTotals() {
        var el = document.getElementById("omhp-boss-data");
        if (!el || !el.dataset.me) return null;
        try {
            var t = JSON.parse(el.dataset.me);
            return typeof t.dmg === "number" && typeof t.hits === "number" ? t : null;
        } catch (e) {
            return null;
        }
    }

    // This toolkit's localStorage keys (the site keeps its own under omhp.* too, e.g. omhp.tab)
    function isOurKey(k) {
        return k.indexOf("omhp.layout.") === 0 ||
            ["omhp.session", "omhp.loot", "omhp.idle", "omhp.bosses", "omhp.bosscur", "omhp.bossgraphs", "omhp.chests", DAYS_KEY, PRESETS_KEY].indexOf(k) !== -1;
    }

    // Your attacks today, from the stored SESSION (see sessionStats), or 0
    function hitsToday() {
        var st = loadSaved("omhp.session");
        if (st.v !== 2 || st.day !== today()) return 0;
        var t = myTotals() || st.last;
        return (t && st.base ? t.hits - st.base.hits : 0) + ((st.extra && st.extra.hits) || 0);
    }

    // An earlier day's SESSION or LOOT totals, kept for 30 days (the DAYS table)
    function archiveDay(day, kind, data) {
        if (!day || day === today()) return;
        var days = loadSaved(DAYS_KEY);
        days[day] = days[day] || {};
        days[day][kind] = data;
        var out = {};
        Object.keys(days).sort().slice(-30).forEach(function(d) { out[d] = days[d]; });
        save(DAYS_KEY, out);
    }

    // With the game open in several tabs, one of them is the "leader": only it records the
    // HP history and the loot log, so nothing is counted twice. The others show what it saves.
    var TAB_ID = Math.random().toString(36).slice(2);
    var LEADER_KEY = "omhp.leader";

    var amLeader = false;

    // Every 5s: take the lock if it's free (or its tab stopped renewing it), renew it if it's
    // ours. Last write wins, so if two tabs claim at once, the next round settles it.
    function claimLeader() {
        var l = loadJSON(LEADER_KEY, null);
        amLeader = !(l && l.id !== TAB_ID && Date.now() - l.t < 15000);
        if (amLeader) save(LEADER_KEY, { id: TAB_ID, t: Date.now() });
    }

    // Whether this tab records (cheap: the 5s round above does the storage work)
    function isLeader() {
        return amLeader;
    }

    claimLeader();
    every(5000, claimLeader);
    window.addEventListener("pagehide", function() {
        var l = loadJSON(LEADER_KEY, null);
        if (l && l.id === TAB_ID) {
            try { localStorage.removeItem(LEADER_KEY); } catch (e) { /* ignore */ }
        }
    });

    // Run fn once at least minMs have passed and test() is true (checked every 100ms),
    // or after 5s regardless. The minimum gives the site time to restore its own state.
    function whenReady(minMs, test, fn) {
        var start = Date.now();
        (function check() {
            var waited = Date.now() - start;
            if (waited >= minMs && test() || waited > 5000) return fn();
            setTimeout(check, 100);
        })();
    }

    // The site has restored its remembered tab
    function tabsReady() {
        return !!document.querySelector('#tabs [role=tab][aria-selected="true"]');
    }

    // A small [RESET] link for the session and loot lines
    function resetButton(title, onClick) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn-text omhp-reset";
        b.textContent = "[RESET]";
        b.title = title;
        b.addEventListener("click", onClick);
        return b;
    }

    // Drag press that comes within 400ms of the last one counts as a double-click
    function makeDoublePress() {
        var last = 0;
        return function() {
            var now = Date.now();
            var isDouble = now - last < 400;
            last = isDouble ? 0 : now;
            return isDouble;
        };
    }

    function makeResizer(info, scroller, heights) {
        var handle = document.createElement("div");
        handle.className = "left-resize";
        handle.title = "drag to resize, double-click to reset";

        if (heights[info.key]) scroller.style.height = heights[info.key] + "px";

        var startY = 0;
        var startH = 0;
        var stuckToBottom = false;
        var lastDown = 0;

        function reset() {
            scroller.style.height = "";
            scroller.style.maxHeight = "";
            delete heights[info.key];
            save(HEIGHTS_KEY, heights);
        }

        handle.addEventListener("pointerdown", function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            // Two presses close together: reset (pointer capture can stop dblclick firing)
            var now = Date.now();
            if (now - lastDown < 400) {
                lastDown = 0;
                reset();
                return;
            }
            lastDown = now;
            handle.setPointerCapture(e.pointerId);
            handle.classList.add("dragging");
            startY = e.clientY;
            startH = scroller.offsetHeight;
            stuckToBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 4;
        });

        handle.addEventListener("pointermove", function(e) {
            if (!handle.classList.contains("dragging")) return;
            var h = Math.max(80, Math.min(window.innerHeight * 0.85, startH + e.clientY - startY));
            scroller.style.maxHeight = "none";
            scroller.style.height = Math.round(h) + "px";
            if (stuckToBottom) scroller.scrollTop = scroller.scrollHeight;
        });

        function endDrag() {
            if (!handle.classList.contains("dragging")) return;
            handle.classList.remove("dragging");
            heights[info.key] = scroller.offsetHeight;
            save(HEIGHTS_KEY, heights);
        }
        handle.addEventListener("pointerup", endDrag);
        handle.addEventListener("pointercancel", endDrag);

        return handle;
    }

    function tabButton(key) {
        return document.querySelector('#tabs [data-tab="' + key + '"]');
    }

    // The right-hand panel would be empty while one of the moved tabs is selected (or
    // the tab `except`, whose panel has left the column), so switch it to the first
    // other tab that's unlocked.
    function fixRightPanel(except) {
        var selected = document.querySelector('#tabs [role=tab][aria-selected="true"]');
        if (selected && selected.dataset.tab !== except && LEFT_TABS.indexOf(selected.dataset.tab) === -1) return;
        var tabs = document.querySelectorAll("#tabs [role=tab]");
        for (var i = 0; i < tabs.length; i++) {
            var k = tabs[i].dataset.tab;
            if (!tabs[i].hidden && k !== except && LEFT_TABS.indexOf(k) === -1) {
                tabs[i].click();
                return;
            }
        }
    }

    function buildSection(info, collapsed, heights) {
        var panel = document.getElementById(info.panel);
        // Look it up before the panel moves (see moveSections)
        var scroller = document.querySelector(info.scroller);
        var section = document.createElement("div");
        section.className = "left-section" + (collapsed[info.key] ? " collapsed" : "");
        section.dataset.key = info.key;

        var head = document.createElement("div");
        head.className = "left-head";
        var toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "left-toggle";
        head.appendChild(toggle);

        // Up/down arrows to reorder the sections (remembered)
        [["▲", "move up", -1], ["▼", "move down", 1]].forEach(function(a) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "left-move";
            b.textContent = a[0];
            b.title = a[1];
            b.addEventListener("click", function() {
                var col = section.parentElement;
                if (a[2] < 0 && section.previousElementSibling) col.insertBefore(section, section.previousElementSibling);
                if (a[2] > 0 && section.nextElementSibling) col.insertBefore(section.nextElementSibling, section);
                save(ORDER_KEY, Array.prototype.map.call(col.querySelectorAll(":scope > .left-section"), function(s) {
                    return s.dataset.key;
                }));
            });
            head.appendChild(b);
        });
        // FILTER (see lineFilters): opens the hide / highlight boxes under the header
        if (filterEditor && (info.key === "feed" || info.key === "chat")) {
            var fb = document.createElement("button");
            fb.type = "button";
            fb.className = "left-move";
            fb.textContent = "FILTER";
            fb.title = "hide or highlight lines in ATTACKS and CHAT";
            var editor = null;
            fb.addEventListener("click", function() {
                if (editor) {
                    editor.remove();
                    editor = null;
                    return;
                }
                editor = filterEditor();
                head.insertAdjacentElement("afterend", editor);
                editor.querySelector("input").focus();
            });
            head.appendChild(fb);
        }
        var pop = document.createElement("button");
        pop.type = "button";
        pop.className = "left-move";
        pop.textContent = "⧉";
        pop.title = "pop out into a window";
        pop.addEventListener("click", function() {
            if (popOutPanel) popOutPanel(info.key);
        });
        head.appendChild(pop);

        // Show the tab's badge in the header, e.g. "[ MESSAGES 2 ]" -> "MESSAGES 2"
        function paint() {
            var label = info.title;
            var btn = tabButton(info.key);
            if (btn) {
                var m = (btn.textContent || "").match(/^\[\s*\S+\s*(.*?)\s*\]$/);
                if (m && m[1]) label += " " + m[1];
            }
            var isCollapsed = section.classList.contains("collapsed");
            toggle.textContent = (isCollapsed ? "[+] " : "[-] ") + label;
            toggle.setAttribute("aria-expanded", String(!isCollapsed));
        }

        toggle.addEventListener("click", function() {
            section.classList.toggle("collapsed");
            collapsed[info.key] = section.classList.contains("collapsed");
            save(STORE_KEY, collapsed);
            paint();
        });

        onTabsChange(paint);

        section.appendChild(head);
        section.appendChild(panel);
        if (scroller) section.appendChild(makeResizer(info, scroller, heights));
        paint();
        return section;
    }

    // Keep the boss/fight column in view. When it's taller than the window, a
    // negative top lets it scroll until its bottom (the attack buttons) reaches
    // the bottom of the window, then it stays put. No inner scrollbar, so hit
    // pop-ups and effects that animate past its edges aren't clipped.
    function pinMain() {
        var col = document.querySelector("#app .col-main");
        if (!col) return;
        var wide = window.matchMedia("(min-width: 1300px)");

        function update() {
            col.style.top = wide.matches
                ? Math.min(12, window.innerHeight - col.offsetHeight - 12) + "px"
                : "";
        }

        update();
        new ResizeObserver(update).observe(col);
        window.addEventListener("resize", update);
    }

    // Show the account button as your badges + name, like YOU > PROFILE's NAME row.
    // Imports the site's own modules (same ?v= URL, so the same running copies)
    // to reuse its state and badge drawing. Tampermonkey can run this script in
    // a separate sandbox where those imports would be fresh, empty copies, so
    // this part is injected into the page itself as a <script>.
    function paintAccount() {
        // Where the page script publishes the boss's real numbers (read by trueBoss())
        var bridge = document.createElement("meta");
        bridge.id = "omhp-boss-data";
        document.head.appendChild(bridge);
        var main = document.querySelector('script[src*="js/main.js"]');
        if (!main) return;
        var v = new URL(main.src).search;
        var base = new URL("./", main.src).href; // the folder main.js is in

        var code = `
            Promise.all([import(${JSON.stringify(base + "store.js" + v)}), import(${JSON.stringify(base + "ui/badges.js" + v)})])
                .then(([store, badges]) => {
                    const acct = ${isOn("account") ? 'document.getElementById("acct")' : "null"};
                    let watcher = null;
                    const paint = () => {
                        if (!acct) return; // NAME feature off, or no account button
                        try {
                            const me = store.state.me;
                            // Not logged in: keep the site's [LOG IN]
                            if (!me || !me.login || !me.name) return;
                            const tag = badges.badgeTag(me.badges, me.id);
                            if (tag) acct.replaceChildren(tag, " " + me.name);
                            else acct.replaceChildren(me.name);
                            watcher?.takeRecords(); // our own change: don't react to it
                        } catch (e) {
                            /* leave the site's own button as it is */
                        }
                    };
                    // The site resets the button to [login] on every player update, and its
                    // handler can run after ours, so repaint whenever it overwrites the button.
                    if (acct) {
                        watcher = new MutationObserver(paint);
                        watcher.observe(acct, { childList: true, characterData: true, subtree: true });
                        store.on("me", paint);
                        paint();
                    }

                    // The boss's real numbers for the rest of the script. During the FOG world
                    // event the site draws fake HP on screen, but its own data stays true.
                    const out = document.getElementById("omhp-boss-data");
                    const publish = () => {
                        const b = store.state.boss;
                        if (!out || !b) return;
                        out.dataset.boss = JSON.stringify({
                            seq: b.seq, name: b.name, hp: b.hp, max: b.max_hp, phase: b.phase,
                            dmg: b.total_damage, alive: b.status === "alive"
                        });
                    };
                    store.on("boss", publish);
                    setInterval(publish, 2000);
                    publish();

                    // Your lifetime totals, for SESSION (the attack reply refreshes them)
                    const publishMe = () => {
                        const m = store.state.me;
                        if (!out || !m || typeof m.total_damage !== "number") return;
                        out.dataset.me = JSON.stringify({ dmg: m.total_damage, hits: m.total_attacks, crits: m.total_crits, shards: m.shards });
                        // The order SHOP lists its loot boxes in (see bagBoxOrder)
                        const order = JSON.stringify(Object.keys((m.shop ?? store.state.content?.shop ?? {}).boxes ?? {}));
                        if (out.dataset.boxOrder !== order) out.dataset.boxOrder = order;
                    };
                    store.on("me", publishMe);
                    publishMe();

                    // For the chest ledger (loot.js): each box's stated odds, as outcome -> chance
                    const publishOdds = () => {
                        const boxes = store.state.content?.boxes;
                        if (!out || !boxes) return;
                        const all = {};
                        for (const b of boxes) {
                            all[b.id] = { name: b.name, odds: (b.odds ?? []).map((r) => [r.kind === "item" ? (r.rarity || "item")
                                : r.amount ? r.kind + ":" + r.amount : r.kind, r.chance]) };
                        }
                        const text = JSON.stringify(all);
                        if (out.dataset.boxStated !== text) out.dataset.boxStated = text;
                    };
                    store.on("me", publishOdds);
                    publishOdds();

                    // ...and your own box openings as they arrive in the feed (only new ones:
                    // feed times are in seconds). OPEN ALL is one line with just a count.
                    const since = store.now(), seenOpens = new Set();
                    store.on("feed", () => {
                        const me = store.state.me;
                        if (!me) return;
                        for (const e of store.state.feed ?? []) {
                            if (e.player_id !== me.id || e.t < since || (e.kind !== "unbox" && e.kind !== "unbox_many")) continue;
                            const id = [e.t, e.kind, e.box_id, e.item_id, e.reward, e.amount, e.count].join("|");
                            if (seenOpens.has(id)) continue;
                            seenOpens.add(id);
                            document.dispatchEvent(new CustomEvent("omhp-unbox", { detail: JSON.stringify({
                                bulk: e.kind === "unbox_many", box: e.box_id ?? null, count: e.count ?? 1,
                                reward: e.reward, rarity: e.rarity, amount: e.amount
                            }) }));
                        }
                    });
                })
                .catch(() => {
                    // The site changed its files: the rest of the script falls back to the screen
                    const out = document.getElementById("omhp-boss-data");
                    if (out) out.dataset.fail = [out.dataset.fail, "SITE DATA"].filter(Boolean).join(", ");
                });

            // The site only redraws the selected tab's panel when your data changes, so a
            // panel that's pinned or popped out (see pinPanel / floatingPanels) would go
            // stale. Redraw those too. These drawers only read the site's state.
            Promise.all([
                import(${JSON.stringify(base + "store.js" + v)}),
                import(${JSON.stringify(base + "ui/tabs.js" + v)}),
                import(${JSON.stringify(base + "ui/bag.js" + v)}),
                import(${JSON.stringify(base + "ui/player.js" + v)}),
                import(${JSON.stringify(base + "ui/shop.js" + v)}),
                import(${JSON.stringify(base + "ui/ranks.js" + v)}),
                import(${JSON.stringify(base + "ui/history.js" + v)})
            ])
                .then(([store, tabs, bag, player, shop, ranks, history]) => {
                    // RANKS and HISTORY only fetch when their tab is opened. Reload them while
                    // they're on screen (selected, pinned or popped out), this browser tab is
                    // visible, and you aren't typing in them. CITY and AUCTION refresh themselves.
                    [["ranks", () => ranks.loadRanks(true), 30000], ["history", () => history.loadHistory(), 60000]].forEach(([key, load, ms]) => {
                        setInterval(() => {
                            const p = document.getElementById("panel-" + key);
                            if (document.hidden || !p || p.hidden || !p.offsetParent || p.contains(document.activeElement)) return;
                            Promise.resolve(load()).catch(() => {});
                        }, ms);
                    });
                    const draw = {
                        bag: bag.renderBag, collection: bag.renderCollection,
                        player: player.renderPlayer, inventory: player.renderInventory, shop: shop.renderShop
                    };
                    store.on("me", () => {
                        document.querySelectorAll("#omhp-pinned > .panel, .omhp-float-body > .panel").forEach((p) => {
                            const key = p.id.replace(/^panel-/, "");
                            if (key === tabs.currentTab() || typeof draw[key] !== "function") return; // the site draws that one
                            try { draw[key](); } catch (e) { /* leave it as it was */ }
                        });
                    });
                })
                .catch(() => {
                    // The site changed its files: pinned panels and RANKS just won't refresh
                    const out = document.getElementById("omhp-boss-data");
                    if (out) out.dataset.fail = [out.dataset.fail, "PANEL REFRESH"].filter(Boolean).join(", ");
                });
        `;
        var script = document.createElement("script");
        script.type = "module";
        script.textContent = code;
        document.head.appendChild(script);
        script.remove();
    }

    // Drag the gaps between the three columns to resize the side columns.
    function columnResizers() {
        var columns = document.querySelector("#app .columns");
        if (!columns) return;
        var widths = loadSaved(WIDTHS_KEY);

        function setWidth(side, px) {
            if (px) columns.style.setProperty("--omhp-" + side, Math.round(px) + "px");
            else columns.style.removeProperty("--omhp-" + side);
        }
        setWidth("l", widths.l);
        setWidth("r", widths.r);

        var handles = { l: document.createElement("div"), r: document.createElement("div") };

        function cols() {
            return {
                left: columns.querySelector("#col-left"),
                main: columns.querySelector(".col-main"),
                side: columns.querySelector(".col-side")
            };
        }

        // Centre each handle in its gap
        function place() {
            var c = cols();
            if (!c.left || !c.main || !c.side) return;
            var box = columns.getBoundingClientRect();
            var lr = c.left.getBoundingClientRect(), mr = c.main.getBoundingClientRect(), sr = c.side.getBoundingClientRect();
            handles.l.style.left = ((lr.right + mr.left) / 2 - box.left) + "px";
            handles.r.style.left = ((mr.right + sr.left) / 2 - box.left) + "px";
        }

        ["l", "r"].forEach(function(side) {
            var h = handles[side];
            h.className = "col-drag";
            h.title = "drag to resize, double-click to reset";
            var isDouble = makeDoublePress();
            var startX = 0, startW = 0, startMain = 0;

            h.addEventListener("pointerdown", function(e) {
                if (e.button !== 0) return;
                e.preventDefault();
                if (isDouble()) {
                    delete widths[side];
                    setWidth(side, null);
                    save(WIDTHS_KEY, widths);
                    place();
                    return;
                }
                var c = cols();
                h.setPointerCapture(e.pointerId);
                h.classList.add("dragging");
                startX = e.clientX;
                startW = (side === "l" ? c.left : c.side).offsetWidth;
                startMain = c.main.offsetWidth;
            });

            h.addEventListener("pointermove", function(e) {
                if (!h.classList.contains("dragging")) return;
                var dx = e.clientX - startX;
                var w = side === "l" ? startW + dx : startW - dx;
                // Side column at least 240px; the boss column keeps at least 360px
                w = Math.max(240, Math.min(w, startW + startMain - 360));
                widths[side] = Math.round(w);
                setWidth(side, w);
                place();
            });

            function endDrag() {
                if (!h.classList.contains("dragging")) return;
                h.classList.remove("dragging");
                save(WIDTHS_KEY, widths);
            }
            h.addEventListener("pointerup", endDrag);
            h.addEventListener("pointercancel", endDrag);

            columns.appendChild(h);
        });

        new ResizeObserver(place).observe(columns);
        window.addEventListener("resize", place);
        place();
    }

    // The latest kill estimate ("~39m"), or "" while there isn't one; used by the tab title
    var etaShort = "";

    // Under the HP numbers: how fast the boss is losing HP and when it should die.
    function bossEta() {
        var phase = document.getElementById("phase");
        var hpNow = document.getElementById("hp-now");
        if (!phase || !hpNow) return false;
        var line = document.createElement("div");
        line.id = "omhp-eta";
        line.className = "phase dim";
        phase.insertAdjacentElement("afterend", line);

        // The estimate uses the last 5 minutes; the range shows what the last 1 and 15 say
        var RATE_MS = 15 * 60 * 1000;
        var WINDOWS = [1, 5, 15];
        var samples = [];
        var bossNum = null;

        function sample() {
            etaShort = "";
            var dead = document.getElementById("boss-dead");
            if (dead && !dead.hidden) {
                line.textContent = "";
                return;
            }
            // FOG hides the boss's HP on purpose: don't measure (or reveal) anything meanwhile
            if (fogged()) {
                line.textContent = "FOG · ESTIMATE PAUSED";
                return;
            }
            var b = trueBoss();
            if (!b) return;
            if (b.seq !== bossNum) {
                bossNum = b.seq;
                samples = [];
            }
            var hp = b.hp;
            var now = Date.now();
            samples.push({ t: now, hp: hp, dmg: typeof b.dmg === "number" ? b.dmg : null });
            while (samples.length && now - samples[0].t > RATE_MS) samples.shift();

            var main = rateOver(samples, now, 5); // see lib.js
            if (!main) {
                line.textContent = "MEASURING…";
                return;
            }
            var first = main.first, minutes = main.minutes, perMin = main.perMin;
            // Everyone's damage per minute, before heals (the boss's total-damage counter)
            var last = samples[samples.length - 1];
            var dmgPerMin = first.dmg !== null && last.dmg !== null && last.dmg >= first.dmg
                ? (last.dmg - first.dmg) / minutes : null;
            var dps = dmgPerMin !== null ? " · " + fmt(dmgPerMin) + " DMG/MIN" : "";
            // Healed so far this life: all the damage dealt, minus the HP actually lost
            var healed = typeof b.dmg === "number" && b.max ? b.dmg - (b.max - b.hp) : 0;
            dps += healed > 0 ? " · HEALED " + short(healed) : "";
            if (perMin <= 0) {
                line.textContent = "HOLDING" + dps;
                return;
            }
            etaShort = "~" + dur(hp / perMin);
            // The spread of the other windows' estimates, when it says something
            var etas = etaMinutes(samples, now, WINDOWS);
            var lo = Math.min.apply(null, etas), hi = Math.max.apply(null, etas);
            var range = etas.length > 1 && hi - lo >= 2 ? " (" + dur(lo).replace(/m$/, "") + "–" + dur(hi) + ")" : "";
            line.textContent = "≈ " + fmt(perMin) + " HP/MIN" + dps + " · DOWN IN " + etaShort + range;
            line.title = "estimate from the last 5 minutes; the range is what the last 1 and 15 minutes say";
        }

        sample();
        every(5000, sample);
    }

    // An ASCII graph of a boss's HP in `pane`: a heading with zoom ranges ([ALL] [1H] [15M])
    // and [REPLAY], the plot, a hover readout, and a legend whose entries switch their series
    // on and off. Used by the live graph beside the boss and by old fights from BOSSES.
    //   source()  -> { points, fog, max, end, label(t0, span, zoomed), title }: what to draw.
    //                points are [time, hp, phase, online, your lifetime damage]; fog is
    //                [[start, end], ...]; end is the right edge (now, for the live one).
    //   rowsFor(headHeight, lineHeight) -> how many rows tall.
    var GRAPH_SHOW_KEY = "omhp.layout.graphShow";
    var ZOOMS = [["ALL", 0], ["1H", 3600000], ["15M", 900000]];

    function makeGraph(pane, source, rowsFor) {
        pane.classList.add("omhp-graph");
        var head = document.createElement("div");
        head.className = "omhp-graph-head";
        var headText = document.createElement("span");
        head.appendChild(headText);
        var plot = document.createElement("pre");
        plot.className = "omhp-graph-plot";
        pane.appendChild(head);
        pane.appendChild(plot);

        // What the graph shows (legend toggles and the zoom range), shared and remembered
        var show = Object.assign({ fill: true, heal: true, phase: true, online: true, mine: true, fog: true, range: 0 },
            loadSaved(GRAPH_SHOW_KEY));

        // [ALL] [1H] [15M]: how far back the graph reaches
        var zoomBtns = ZOOMS.map(function(z) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "btn-text omhp-zoom";
            b.textContent = "[" + z[0] + "]";
            b.title = z[1] ? "show the last " + dur(z[1] / 60000) : "show the whole fight";
            b.addEventListener("click", function() {
                show.range = z[1];
                save(GRAPH_SHOW_KEY, show);
                paintZoom();
                draw();
            });
            head.appendChild(b);
            return b;
        });
        function paintZoom() {
            zoomBtns.forEach(function(b, i) { b.classList.toggle("on", (show.range || 0) === ZOOMS[i][1]); });
        }
        paintZoom();

        // [REPLAY]: play the whole history back from the start over 10 seconds
        var replayBtn = document.createElement("button");
        replayBtn.type = "button";
        replayBtn.className = "btn-text omhp-replay";
        replayBtn.textContent = "[REPLAY]";
        replayBtn.title = "play this boss's HP history back from the start";
        head.appendChild(replayBtn);

        var replayAt = null, replayTimer = null; // the moment the replay has reached

        function stopReplay() {
            clearInterval(replayTimer);
            replayTimer = null;
            replayAt = null;
            replayBtn.textContent = "[REPLAY]";
            draw();
        }

        replayBtn.addEventListener("click", function() {
            if (replayTimer) return stopReplay();
            var d = source();
            if (d.points.length < 2) return;
            var start = d.points[0][0], stop = d.end, began = Date.now();
            replayBtn.textContent = "[STOP]";
            replayTimer = setInterval(function() {
                var k = Math.min(1, (Date.now() - began) / 10000);
                replayAt = start + (stop - start) * k;
                draw();
                if (k >= 1) stopReplay();
            }, 80);
        });

        // Hover readout: a cursor line on the column under the pointer and a small box with
        // the time, HP, phase and players online there
        var view = null, hoverX = null;
        var cursor = document.createElement("div");
        cursor.className = "omhp-graph-cursor";
        cursor.hidden = true;
        var tip = document.createElement("div");
        tip.className = "omhp-graph-tip";
        tip.hidden = true;
        pane.appendChild(cursor);
        pane.appendChild(tip);

        function hideHover() {
            cursor.hidden = true;
            tip.hidden = true;
        }

        function showHover(clientX) {
            if (!view) return hideHover();
            var pr = plot.getBoundingClientRect(), box = pane.getBoundingClientRect();
            var c = Math.floor((clientX - pr.left) / view.cw) - (view.label + 1);
            var colStart = view.t0 + view.span * c / view.cols;
            // Nothing past the last real reading, unless it's FOG still going on
            if (c < 0 || c >= view.cols || view.vals[c] === null || colStart > view.lastT && !view.fogCols[c]) return hideHover();
            var x = pr.left - box.left + (view.label + 1 + c + 0.5) * view.cw;
            cursor.style.left = Math.round(x) + "px";
            cursor.style.top = Math.round(pr.top - box.top) + "px";
            cursor.style.height = Math.round(view.rows * view.lineH) + "px";
            cursor.hidden = false;

            var colEnd = view.t0 + view.span * (c + 1) / view.cols;
            var t = view.fogCols[c] ? Math.min(colEnd, view.end) : Math.min(colEnd, view.lastT);
            var hp = view.vals[c];
            var lines = [
                hhmm(t),
                fmt(hp) + " HP (" + (hp / view.max * 100).toFixed(1) + "%)" + (view.fogCols[c] ? " last seen" : "")
            ];
            if (view.phases[c]) lines.push("PHASE " + ROMAN[view.phases[c]]);
            if (view.fogCols[c]) lines.push("FOG: HP hidden");
            if (show.online && view.online[c] !== null) lines.push(view.online[c] + " online");
            if (show.mine && view.mine[c]) lines.push("you: " + fmt(view.mine[c]) + " dmg");
            tip.textContent = lines.join("\n");
            tip.hidden = false;
            // Keep the box inside the pane: flip to the cursor's left near the right edge
            var w = tip.offsetWidth;
            tip.style.left = Math.round(x + 8 + w > box.width ? x - 8 - w : x + 8) + "px";
            tip.style.top = Math.round(pr.top - box.top + 4) + "px";
        }

        plot.addEventListener("pointermove", function(e) {
            hoverX = e.clientX;
            showHover(e.clientX);
        });
        plot.addEventListener("pointerleave", function() {
            hoverX = null;
            hideHover();
        });
        plot.addEventListener("click", function(e) {
            var entry = e.target.closest && e.target.closest("[data-series]");
            if (!entry) return;
            var k = entry.dataset.series;
            show[k] = !show[k];
            save(GRAPH_SHOW_KEY, show);
            draw();
        });

        // Character size of the plot's font, measured again when the pane resizes
        var cw = null, lineH = null;

        function measure() {
            cw = charWidth();
            lineH = parseFloat(getComputedStyle(plot).lineHeight) || 11;
        }

        function charWidth() {
            var probe = document.createElement("span");
            probe.textContent = "M".repeat(20);
            plot.appendChild(probe);
            var w = probe.getBoundingClientRect().width / 20;
            probe.remove();
            return w || 7;
        }

        function ago(ms) {
            return dur(ms / 60000);
        }

        function draw() {
            var d = source();
            var points = d.points, fog = d.fog, max = d.max || 1;
            if (cw === null) measure();
            var rows = rowsFor(head.offsetHeight, lineH);
            var LABEL = 5;
            // A right-hand axis for the players-online (*) and your-damage (+) scales, when
            // there's any of either: "|" then up to 4 characters for each
            var hasRight = points.some(function(p) { return show.online && p[3] != null || show.mine && p[4] != null; });
            var RIGHT = hasRight ? 10 : 0;
            var cols = Math.max(10, Math.floor(pane.clientWidth / cw) - LABEL - 1 - RIGHT);
            if (points.length < 2) {
                headText.textContent = "HP · COLLECTING…";
                plot.textContent = "";
                view = null;
                hideHover();
                return;
            }

            // The whole fight, or (zoomed, and not replaying) only its last `range` ms
            var t1 = d.end, first = points[0][0];
            var zoomed = !!show.range && replayAt === null && t1 - first > show.range;
            var t0 = zoomed ? t1 - show.range : first;
            var span = Math.max(1, t1 - t0);
            // During [REPLAY], nothing after the moment it has reached
            var cutoff = replayAt === null ? Infinity : replayAt;
            // Last reading in each column, your damage within it, and FOG (see lib.js)
            var colsData = bucketColumns(points, fog, t0, span, cols, cutoff);
            var vals = colsData.vals, phases = colsData.phases, online = colsData.online, mine = colsData.mine;
            var fogCols = colsData.fogCols;
            var maxMine = Math.max.apply(null, mine.filter(function(n) { return n; }).concat([0]));
            var maxOnline = Math.max.apply(null, online.filter(function(n) { return n !== null; }).concat([0]));
            // Whether there's anything to switch, before switching it off
            var hasOnline = maxOnline > 0, hasMine = maxMine > 0, hasFog = fogCols.indexOf(true) !== -1;
            if (!show.online) maxOnline = 0;
            if (!show.mine) maxMine = 0;
            // A column higher than the one before it is a heal; a new phase gets a marker
            var heal = [], mark = [];
            for (var c1 = 0; c1 < cols; c1++) {
                heal.push(show.heal && c1 > 0 && vals[c1] !== null && vals[c1 - 1] !== null && vals[c1] > vals[c1 - 1]);
                mark.push(show.phase && c1 > 0 && phases[c1] && phases[c1 - 1] && phases[c1] !== phases[c1 - 1] ? phases[c1] : 0);
            }
            // The new phase's numeral reads across the top row, starting at its marker
            var topText = {};
            mark.forEach(function(ph, c3) {
                if (!ph) return;
                for (var k = 0; k < ROMAN[ph].length; k++) topText[c3 + k] = ROMAN[ph].charAt(k);
            });

            // Plain ASCII, like the site's own HP graph, so every character is in its font:
            // the line sits low/middle/high in its row as ' - .  with a dotted fill below,
            // | for drops (and heals) taller than a row, ^ for a heal, : for a phase change,
            // ~ where FOG hid the HP.
            var grid = [];
            for (var gr = 0; gr < rows; gr++) {
                var row = [];
                for (var gc = 0; gc < cols; gc++) row.push({ ch: " ", cls: null });
                grid.push(row);
            }
            var prevY = null;
            for (var c2 = 0; c2 < cols; c2++) {
                var v = vals[c2];
                if (v === null) {
                    prevY = null;
                    continue;
                }
                var exact = Math.max(0, Math.min(max, v)) / max * (rows - 1);
                var y = Math.round(exact);
                var frac = exact - Math.floor(exact);
                var lineCls = heal[c2] ? "heal" : "line";
                if (show.fill) for (var fr = 0; fr < y; fr++) grid[fr][c2] = { ch: ".", cls: "fill" };
                var from = prevY === null ? y : prevY;
                for (var vr = Math.min(y, from) + 1; vr < Math.max(y, from); vr++) grid[vr][c2] = { ch: "|", cls: lineCls };
                grid[y][c2] = { ch: heal[c2] ? "^" : Math.abs(exact - y) < 0.17 ? "-" : frac < 0.5 ? "'" : ".", cls: lineCls };
                prevY = y;
            }
            // FOG: ~ over the empty space and the dotted fill of the columns it covered
            var isLine = function(cell) { return cell.cls === "line" || cell.cls === "heal"; };
            if (show.fog) {
                for (var gx = 0; gx < cols; gx++) {
                    if (!fogCols[gx]) continue;
                    for (var gy = 0; gy < rows; gy++) {
                        if (grid[gy][gx].cls === null || grid[gy][gx].cls === "fill") grid[gy][gx] = { ch: "~", cls: "fog" };
                    }
                }
            }
            // Players online, on its own 0..peak scale: * over the empty space and the dotted fill
            if (maxOnline > 0) {
                for (var oc = 0; oc < cols; oc++) {
                    if (online[oc] === null) continue;
                    var oy = Math.round(online[oc] / maxOnline * (rows - 1));
                    var under = grid[oy][oc];
                    if (!isLine(under)) grid[oy][oc] = { ch: "*", cls: "online" };
                }
            }
            // Your damage, on its own 0..peak scale: + over the empty space and the dotted fill
            if (maxMine > 0) {
                for (var yc = 0; yc < cols; yc++) {
                    if (!mine[yc]) continue;
                    var yy = Math.round(mine[yc] / maxMine * (rows - 1));
                    var below = grid[yy][yc];
                    if (!isLine(below) && below.cls !== "online") grid[yy][yc] = { ch: "+", cls: "mine" };
                }
            }
            // Phase changes go on top of everything but the HP line: a : column, and the new
            // phase's numeral across the top row
            for (var mc = 0; mc < cols; mc++) {
                if (!mark[mc]) continue;
                for (var mr = 0; mr < rows; mr++) if (!isLine(grid[mr][mc])) grid[mr][mc] = { ch: ":", cls: "mark" };
            }
            Object.keys(topText).forEach(function(k) {
                var cell = grid[rows - 1][k];
                if (cell && !isLine(cell)) grid[rows - 1][k] = { ch: topText[k], cls: "mark" };
            });

            var frag = document.createDocumentFragment();
            // Right axis, on the top, middle and bottom rows: players online, then your damage
            // per column (both on their own 0..peak scales, like the marks they label)
            function rightLabel(r) {
                var share = r === rows - 1 ? 1 : r === Math.round((rows - 1) / 2) ? 0.5 : r === 0 ? 0 : null;
                frag.appendChild(document.createTextNode("|"));
                [["online", maxOnline, String], ["mine", maxMine, short]].forEach(function(axis, i) {
                    var text = axis[1] > 0 && share !== null ? axis[2](Math.round(axis[1] * share)) : "";
                    text = (i ? " " : "") + text.padStart(4);
                    if (!text.trim()) return frag.appendChild(document.createTextNode(text));
                    var sp = document.createElement("span");
                    sp.className = axis[0];
                    sp.textContent = text;
                    frag.appendChild(sp);
                });
            }
            for (var r = rows - 1; r >= 0; r--) {
                var label = "";
                if (r === rows - 1) label = short(max);
                else if (r === Math.round((rows - 1) / 2)) label = short(Math.round(max / 2));
                else if (r === 0) label = "0";
                frag.appendChild(document.createTextNode(label.padStart(LABEL) + "|"));
                // One span per run of same-coloured characters
                var runCls = null, runText = "";
                var flush = function() {
                    if (!runText) return;
                    if (runCls) {
                        var sp = document.createElement("span");
                        sp.className = runCls;
                        sp.textContent = runText;
                        frag.appendChild(sp);
                    } else frag.appendChild(document.createTextNode(runText));
                    runText = "";
                };
                for (var c4 = 0; c4 < cols; c4++) {
                    var cell2 = grid[r][c4];
                    if (cell2.cls !== runCls) {
                        flush();
                        runCls = cell2.cls;
                    }
                    runText += cell2.ch;
                }
                flush();
                if (RIGHT) rightLabel(r);
                frag.appendChild(document.createTextNode("\n"));
            }
            frag.appendChild(document.createTextNode(" ".repeat(LABEL) + "+" + "-".repeat(cols) + (RIGHT ? "+" : "") + "\n"));
            var left = "-" + ago(span), right = d.endLabel || "now";
            frag.appendChild(document.createTextNode(" ".repeat(LABEL + 1) + left +
                " ".repeat(Math.max(1, cols - left.length - right.length)) + right + "\n"));
            // Legend: [series it switches (or null), colour class, mark, label]. Click an entry
            // to hide or show that series.
            frag.appendChild(document.createTextNode(" ".repeat(LABEL + 1)));
            [[null, "line", "-", "hp"], ["fill", "fill", ".", "fill"], ["heal", "heal", "^", "heal"], ["phase", "mark", ":", "phase"]]
                .concat(hasOnline ? [["online", "online", "*", "online"]] : [])
                .concat(hasMine ? [["mine", "mine", "+", "your dmg"]] : [])
                .concat(hasFog ? [["fog", "fog", "~", "fog"]] : [])
                .forEach(function(item, i) {
                    if (i) frag.appendChild(document.createTextNode("  "));
                    var entry = document.createElement("span");
                    var on = !item[0] || show[item[0]];
                    if (item[0]) {
                        entry.dataset.series = item[0];
                        entry.title = (on ? "hide " : "show ") + item[3] +
                            (item[0] === "online" || item[0] === "mine" ? " (scale on the right)" : "");
                        if (!on) entry.className = "omhp-legend-off";
                    }
                    var markEl = document.createElement("span");
                    if (on) markEl.className = item[1];
                    markEl.textContent = item[2];
                    entry.appendChild(markEl);
                    entry.appendChild(document.createTextNode(" " + item[3]));
                    frag.appendChild(entry);
                });
            plot.replaceChildren(frag);
            // What this render shows, for the hover readout
            view = {
                t0: t0, span: span, cols: cols, label: LABEL, rows: rows, cw: cw, lineH: lineH, max: max, end: t1,
                vals: vals, phases: phases, online: online, mine: mine, fogCols: fogCols,
                lastT: Math.min(cutoff, points[points.length - 1][0])
            };
            if (hoverX !== null) showHover(hoverX);

            headText.textContent = replayAt !== null ? "REPLAY · " + hhmm(replayAt) + " · " + ago(replayAt - first) + " in"
                : d.label(t0, span, zoomed);
            head.title = d.title || "";
        }

        new ResizeObserver(function() {
            measure();
            draw();
        }).observe(pane);

        return { draw: draw };
    }

    // The highest HP in a history, for one with no max saved
    function maxHpOf(points) {
        return Math.max.apply(null, points.map(function(p) { return p[1]; }).concat([1]));
    }

    // Old fights for BOSSES' [GRAPH]: each boss's history when the next one arrived, thinned
    // to 300 points, for the last 20 bosses
    var GRAPHS_KEY = "omhp.bossgraphs";

    function archiveGraph(seq, points, fog, max) {
        if (points.length < 2) return;
        var all = loadSaved(GRAPHS_KEY);
        all[seq] = { s: shrinkPoints(points, 300), f: fog.slice(-50), max: max || maxHpOf(points), end: points[points.length - 1][0] };
        var out = {};
        Object.keys(all).sort(function(a, b) { return Number(b) - Number(a); }).slice(0, 20).forEach(function(k) { out[k] = all[k]; });
        save(GRAPHS_KEY, out);
        document.dispatchEvent(new CustomEvent("omhp-graphs")); // BOSSES shows its [GRAPH]
    }

    // An old fight's graph in a floating window you can drag and resize (click [GRAPH] again,
    // or [CLOSE], to close it)
    var graphWins = {};

    function openBossGraph(seq, name) {
        if (graphWins[seq]) {
            graphWins[seq].remove();
            delete graphWins[seq];
            return;
        }
        var saved = loadSaved(GRAPHS_KEY)[seq];
        if (!saved || !saved.s || saved.s.length < 2) return;
        var win = document.createElement("div");
        win.className = "omhp-float omhp-graph-win";
        var bar = document.createElement("div");
        bar.className = "omhp-float-bar";
        var title = document.createElement("span");
        title.textContent = "BOSS #" + seq + (name ? " " + name : "");
        var close = document.createElement("button");
        close.type = "button";
        close.className = "btn-text";
        close.textContent = "[CLOSE]";
        close.addEventListener("click", function() { openBossGraph(seq); });
        bar.appendChild(title);
        bar.appendChild(close);
        var body = document.createElement("div");
        body.className = "omhp-float-body";
        var pane = document.createElement("div");
        body.appendChild(pane);
        win.appendChild(bar);
        win.appendChild(body);
        var count = Object.keys(graphWins).length;
        var w = Math.min(680, window.innerWidth - 20);
        win.style.width = w + "px";
        win.style.height = Math.min(400, window.innerHeight - 40) + "px";
        win.style.left = Math.max(0, (window.innerWidth - w) / 2 + count * 30) + "px";
        win.style.top = 60 + count * 30 + "px";
        win.style.zIndex = "90";
        document.body.appendChild(win);
        graphWins[seq] = win;

        // Drag the title bar to move it
        var drag = null;
        bar.addEventListener("pointerdown", function(e) {
            if (e.button !== 0 || e.target !== bar && e.target !== title) return;
            e.preventDefault();
            bar.setPointerCapture(e.pointerId);
            var r = win.getBoundingClientRect();
            drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        });
        bar.addEventListener("pointermove", function(e) {
            if (!drag) return;
            win.style.left = Math.max(0, Math.min(e.clientX - drag.dx, window.innerWidth - 80)) + "px";
            win.style.top = Math.max(0, Math.min(e.clientY - drag.dy, window.innerHeight - 30)) + "px";
        });
        bar.addEventListener("pointerup", function() { drag = null; });
        bar.addEventListener("pointercancel", function() { drag = null; });

        var points = saved.s, end = saved.end || points[points.length - 1][0];
        makeGraph(pane, function() {
            return {
                points: points, fog: saved.f || [], max: saved.max || maxHpOf(points), end: end, endLabel: hhmm(end),
                label: function(t0, span, zoomed) {
                    return (zoomed ? "LAST " : "HP FROM " + hhmm(points[0][0]) + " · ") + dur(span / 60000);
                },
                title: "boss #" + seq + "'s HP while you watched it"
            };
        }, function(headH, lineH) {
            return Math.max(8, Math.min(40, Math.floor((pane.clientHeight - headH - 3 * lineH) / lineH)));
        });
    }

    // Split the boss area: the ASCII art on the left, the live HP graph on the right covering
    // the boss's whole life since you first saw it (kept across reloads).
    function bossGraph() {
        var stage = document.getElementById("boss-stage");
        var hpNow = document.getElementById("hp-now");
        var hpMax = document.getElementById("hp-max");
        if (!stage || !hpNow) return false;
        var KEY = "omhp.layout.hp";
        var MAX_POINTS = 3000;

        var split = document.createElement("div");
        split.id = "omhp-boss-split";
        stage.insertAdjacentElement("beforebegin", split);
        split.appendChild(stage);
        var pane = document.createElement("div");
        pane.id = "omhp-graph";
        split.appendChild(pane);
        // The art sizes itself to its box on window resize; its box just got narrower
        window.dispatchEvent(new Event("resize"));

        var store = loadSaved(KEY);
        // Histories saved before v0.15 may hold fake HP from the FOG event: start them over
        if (store.v !== 2) store = {};
        var boss = store.boss || null;
        var points = Array.isArray(store.s) ? store.s : []; // [time, hp, phase, online, your lifetime damage]
        var fog = Array.isArray(store.f) ? store.f : []; // [start, end] of each FOG while you watched
        var maxHp = null;

        var leading = false; // this tab records the history (see isLeader)

        function persist() {
            if (leading) save(KEY, { v: 2, boss: boss, s: points, f: fog });
        }

        // FOG is on: stretch the current fog span to now, or start a new one
        function markFog() {
            var now = Date.now();
            var last = fog[fog.length - 1];
            if (last && now - last[1] < 20000) last[1] = now;
            else fog.push([now, now]);
            if (fog.length > 200) fog.shift();
        }

        var graph = makeGraph(pane, function() {
            return {
                points: points, fog: fog, end: Date.now(),
                max: maxHp || numberIn(hpMax) || maxHpOf(points),
                label: function(t0, span, zoomed) {
                    if (fogged()) return "HP · FOG — PAUSED";
                    return zoomed ? "HP · LAST " + dur(span / 60000) : "HP SINCE " + hhmm(t0) + " · " + dur(span / 60000);
                },
                title: "boss #" + boss + "'s HP since you first saw it"
            };
        }, function(headH, lineH) {
            // As tall as the art beside it, less the heading and the time axis
            return Math.max(8, Math.min(32, Math.floor((stage.offsetHeight - headH - 3 * lineH) / lineH)));
        });

        function sample() {
            // FOG hides the boss's HP on purpose: record only that it's on (the line carries
            // the last real value across, shaded, and the change shows once it clears)
            if (fogged()) {
                leading = isLeader();
                if (leading) markFog();
                if (!document.hidden) graph.draw();
                return;
            }
            var b = trueBoss();
            if (!b) return;
            leading = isLeader();
            // Another tab records; its saves arrive through the storage event below
            if (!leading) {
                if (b.max) maxHp = b.max;
                if (!document.hidden) graph.draw();
                return;
            }
            var num = String(b.seq);
            if (num !== boss) {
                // A new boss: keep the last one's fight for BOSSES' [GRAPH], then start over
                if (boss !== null) archiveGraph(boss, points, fog, maxHp);
                boss = num;
                points = [];
                fog = [];
            }
            if (b.max) maxHp = b.max;
            var me = myTotals();
            points.push([Date.now(), b.hp, b.phase || null, numberIn(document.getElementById("st-online")), me ? me.dmg : null]);
            // Long fights: thin out the older half instead of dropping the start
            points = thinPoints(points, MAX_POINTS);
            // Keep recording in a background tab, but only draw what can be seen
            if (!document.hidden) graph.draw();
        }

        sample();
        every(5000, sample);
        every(15000, persist);
        window.addEventListener("pagehide", persist);
        window.addEventListener("storage", function(e) {
            if (e.key !== KEY || leading) return;
            var saved = loadSaved(KEY);
            if (saved.v !== 2) return;
            boss = saved.boss || null;
            points = Array.isArray(saved.s) ? saved.s : [];
            fog = Array.isArray(saved.f) ? saved.f : [];
            if (!document.hidden) graph.draw();
        });
        document.addEventListener("visibilitychange", function() {
            if (!document.hidden) graph.draw();
        });
    }
    // In FIGHT, under YOUR DMG ON THIS BOSS: your share of everyone's damage on this boss.
    function damageShare() {
        var mine = document.getElementById("boss-dmg");
        var all = document.getElementById("g-damage");
        if (!mine || !all) return false;
        var row = document.createElement("div");
        row.appendChild(document.createTextNode("YOUR SHARE "));
        var val = document.createElement("span");
        val.id = "omhp-share";
        val.className = "val";
        row.appendChild(val);
        var dmgRow = mine.parentElement;
        dmgRow.insertAdjacentElement("afterend", row);

        function paint() {
            var m = numberIn(mine), a = numberIn(all);
            val.textContent = a ? (m / a * 100).toFixed(2) + "%" : "--";
        }

        [mine, all].forEach(function(el) {
            new MutationObserver(paint).observe(el, { childList: true, characterData: true, subtree: true });
        });
        paint();
    }

    // SESSION, a box of its own under FIGHT: your damage today, damage per hour while the game
    // was open, best and average hit, crit rate, attacks, shards earned and spent. Kept across
    // reloads and shared by open tabs until [RESET] or a new day (earlier days go to [DAYS]).
    // Counted from your lifetime totals in the site's data: today = the totals now, minus the
    // first reading today.
    function sessionStats() {
        var bossDmg = document.getElementById("boss-dmg");
        var lastHit = document.getElementById("last-hit");
        var fight = document.getElementById("fight");
        if (!bossDmg || !fight) return false;
        var KEY = "omhp.session";
        var panel = document.createElement("div");
        panel.className = "box omhp-session-box";
        var title = document.createElement("div");
        title.className = "box-title";
        title.textContent = "SESSION";
        var grid = document.createElement("div");
        grid.id = "omhp-session";
        grid.className = "omhp-sess-grid";
        var tools = document.createElement("div");
        tools.className = "omhp-sess-tools";
        var daysBox = document.createElement("div");
        daysBox.id = "omhp-days";
        daysBox.hidden = true;
        panel.appendChild(title);
        panel.appendChild(grid);
        panel.appendChild(tools);
        panel.appendChild(daysBox);
        fight.insertAdjacentElement("afterend", panel);

        // base: the totals at the first reading today; last: the latest reading; extra: what
        // was counted from the screen while the site's data wasn't available; shards: what
        // your balance went up (earned) and down (spent) by, and the balance last seen
        function fresh() {
            return {
                v: 2, day: today(), base: null, last: null, extra: { dmg: 0, hits: 0, crits: 0 }, best: 0,
                activeMs: 0, seen: 0, sizes: [], shards: { earned: 0, spent: 0, last: null }
            };
        }

        // The stored session; a new day starts it over and files the old one under DAYS
        function load() {
            var s = loadSaved(KEY);
            if (s.v === 1) {
                // Saved by v0.19-0.21, which kept running totals
                s = { v: 2, day: s.day, base: null, last: null, extra: { dmg: s.total || 0, hits: s.hits || 0, crits: s.crits || 0 },
                    best: s.best || 0, activeMs: s.activeMs || 0, seen: 0 };
            }
            if (s.v !== 2) s = fresh();
            if (!s.shards) s.shards = { earned: 0, spent: 0, last: null }; // saved before v0.27
            if (s.day !== today()) {
                var c = sessionCounts(s, s.last);
                if (c.dmg || s.shards.earned || s.shards.spent) {
                    archiveDay(s.day, "session", {
                        dmg: c.dmg, hits: c.hits, crits: c.crits, best: s.best, activeMs: s.activeMs,
                        earned: s.shards.earned, spent: s.shards.spent
                    });
                }
                var keep = s.shards.last; // today's changes count from the balance we last saw
                s = fresh();
                s.shards.last = keep;
                save(KEY, s);
            }
            return s;
        }

        // Read, change and save, so tabs open side by side don't overwrite each other
        // (Only saved when something changed, which also spares the other tabs a repaint.)
        function update(change) {
            var s = load();
            var before = JSON.stringify(s);
            change(s);
            if (JSON.stringify(s) !== before) save(KEY, s);
            paint();
        }

        // Time with the game open: each tab adds the time since the last tick by any tab,
        // so two open tabs don't count the same minutes twice
        var myLast = Date.now();
        function tickActive() {
            update(function(s) {
                var now = Date.now();
                s.activeMs += Math.max(0, Math.min(90000, now - Math.max(s.seen || 0, myLast))); // not across sleep
                s.seen = now;
                myLast = now;
            });
        }

        var reset = resetButton("start the session over", function() {
            update(function(s) {
                var t = myTotals();
                Object.assign(s, fresh());
                s.base = t;
                s.last = t;
                s.shards.last = t && typeof t.shards === "number" ? t.shards : null;
            });
            myLast = Date.now();
        });
        var daysBtn = resetButton("earlier days", function() {
            daysBox.hidden = !daysBox.hidden;
            if (!daysBox.hidden) paintDays();
        });
        daysBtn.textContent = "[DAYS]";

        tools.appendChild(daysBtn);
        tools.appendChild(reset);

        // One label / value cell of the grid
        function cell(label, value, tip) {
            var c = document.createElement("div");
            c.className = "omhp-sess-cell";
            if (tip) c.title = tip;
            var k = document.createElement("span");
            k.className = "k";
            k.textContent = label;
            var v = document.createElement("span");
            v.className = "v";
            v.textContent = value;
            c.appendChild(k);
            c.appendChild(v);
            return c;
        }

        function paint() {
            var s = load();
            var c = sessionCounts(s, myTotals() || s.last);
            var hours = s.activeMs / 3600000;
            var timed = hours >= 1 / 60;
            var cells = [
                cell("DAMAGE", fmt(c.dmg)),
                cell("PER HOUR", timed ? fmt(c.dmg / hours) : "--", "damage per hour of play today"),
                cell("ATTACKS", fmt(c.hits)),
                cell("BEST HIT", s.best ? fmt(s.best) : "--"),
                cell("AVG HIT", c.hits > 0 ? fmt(c.dmg / c.hits) : "--", spread(s.sizes || [])),
                cell("CRIT", c.hits > 0 ? Math.round(c.crits / c.hits * 100) + "%" : "--"),
                cell("SHARDS", "+" + fmt(s.shards.earned) + (s.shards.spent ? " / −" + fmt(s.shards.spent) : ""),
                    "shards your balance went up by today (and down by, from spending)"),
                cell("SHARDS/HR", timed ? fmt(s.shards.earned / hours) : "--", "shards earned per hour of play today"),
                cell("PLAYED", dur(s.activeMs / 60000), "time today with the game open")
            ];
            grid.replaceChildren.apply(grid, cells);
        }

        // SESSION's tooltip: the size of your last (up to 200) hits, smallest to biggest
        function spread(sizes) {
            if (sizes.length < 5) return "";
            var x = sizes.slice().sort(function(a, b) { return a - b; });
            var at = function(q) { return fmt(x[Math.min(x.length - 1, Math.floor(q * x.length))]); };
            return "your last " + x.length + " hits\nsmallest " + fmt(x[0]) + "\nmedian " + at(0.5) +
                "\n9 in 10 under " + at(0.9) + "\nbiggest " + fmt(x[x.length - 1]);
        }

        // The DAYS table: one line per earlier day, newest first
        function paintDays() {
            var all = loadSaved(DAYS_KEY);
            var dates = Object.keys(all).sort().reverse().slice(0, 14);
            if (!dates.length) {
                daysBox.textContent = "no earlier days yet";
                return;
            }
            var lines = ["DAY      DMG    /HR  HITS CRIT  IDLE SHARDS  LOOT"];
            dates.forEach(function(d) {
                var x = all[d].session || {}, l = (all[d].loot || {}).counts || {};
                var hrs = (x.activeMs || 0) / 3600000;
                var loot = Object.keys(l).map(function(k) { return l[k][1] + " x" + l[k][0]; }).join(" ");
                lines.push(d.slice(5) + "  " + short(x.dmg || 0).padStart(6) + " " +
                    (hrs >= 1 / 60 ? short(Math.round((x.dmg || 0) / hrs)) : "-").padStart(6) + " " +
                    String(x.hits || 0).padStart(5) + " " +
                    (x.hits ? Math.round(x.crits / x.hits * 100) + "%" : "-").padStart(4) + " " +
                    (all[d].idle ? dur(all[d].idle.ms / 60000) : "-").padStart(5) + " " +
                    (x.earned ? "+" + short(x.earned) : "-").padStart(6) + "  " + loot);
            });
            daysBox.textContent = lines.join("\n");
        }

        // Fallback while the site's data isn't there: YOUR DMG ON THIS BOSS on screen
        var prev = null;
        var bossNum = null;
        function readScreen() {
            var numEl = document.getElementById("boss-num");
            var num = numEl ? numEl.textContent : "";
            var dmg = numberIn(bossDmg);
            if (dmg === null) return;
            var add = 0;
            if (prev === null) bossNum = num; // already counted (or done before the session started)
            else if (num !== bossNum || dmg < prev) {
                // New boss: its counter started from 0
                bossNum = num;
                add = dmg;
            } else if (dmg > prev) add = dmg - prev;
            prev = dmg;
            // One rise = one attack; YOUR LAST HIT is drawn in the same update. Another open
            // tab counts it if that one is the leader.
            if (!add || !isLeader()) return paint();
            var crit = lastHit && /CRIT/.test(lastHit.textContent || "") ? 1 : 0;
            update(function(s) {
                s.extra.dmg += add;
                s.extra.hits++;
                s.extra.crits += crit;
            });
        }

        function readDamage() {
            var t = myTotals();
            if (!t) return readScreen();
            update(function(s) {
                // First reading today, or the totals went backwards (another account?): count from here
                if (!s.base || t.dmg < s.base.dmg || t.hits < s.base.hits) s.base = t;
                s.last = t;
                // Shards: only the leader counts changes in the balance, so two tabs don't
                // count the same one twice
                if (typeof t.shards === "number" && isLeader()) {
                    var d = s.shards.last === null ? 0 : t.shards - s.shards.last;
                    if (d > 0) s.shards.earned += d;
                    else if (d < 0) s.shards.spent -= d;
                    s.shards.last = t.shards;
                }
            });
        }

        // YOUR LAST HIT is only drawn by the tab that attacked, so each tab records its own hits
        function readHit() {
            var n = numberIn(lastHit);
            if (n === null) return;
            update(function(s) {
                s.best = Math.max(s.best, n);
                s.sizes = (s.sizes || []).concat([n]).slice(-200);
            });
        }

        new MutationObserver(readDamage).observe(bossDmg, { childList: true, characterData: true, subtree: true });
        var bridge = document.getElementById("omhp-boss-data");
        if (bridge) new MutationObserver(readDamage).observe(bridge, { attributes: true, attributeFilter: ["data-me"] });
        if (lastHit) new MutationObserver(function() { if (hitSeen) readHit(); }).observe(lastHit, { childList: true, characterData: true, subtree: true });
        // Only hits from now on: the one on screen at load was recorded by an earlier page
        var hitSeen = false;
        setTimeout(function() { hitSeen = true; }, 3000);
        // Another tab saved: show its numbers
        window.addEventListener("storage", function(e) {
            if (e.key === KEY) paint();
            if (e.key === DAYS_KEY && !daysBox.hidden) paintDays();
        });
        every(10000, readDamage);
        every(10000, tickActive);
        window.addEventListener("pagehide", tickActive);
        readDamage();
        // The hit already on screen at load was counted by an earlier page (or isn't today's)
        paint();
    }

    // [TOOLKIT] in the top bar: highlight colour, theme, features, loot alerts, layouts and
    // backups.
    function toolkitMenu() {
        var bar = document.getElementById("statusline");
        if (!bar) return;
        var current = loadJSON(ACCENT_KEY, null) || ACCENTS[0].hex;
        var currentTheme = loadJSON(THEME_KEY, null) || THEMES[0].name;

        function el(tag, cls, text) {
            var e = document.createElement(tag);
            if (cls) e.className = cls;
            if (text != null) e.textContent = text;
            return e;
        }

        function choice(text, on, title, onClick) {
            var b = el("button", "btn-text omhp-choice" + (on ? " on" : ""), text);
            b.type = "button";
            if (title) b.title = title;
            b.addEventListener("click", onClick);
            return b;
        }

        var wrap = el("span", "omhp-accent-wrap");
        var btn = el("button", "btn-text", "[TOOLKIT]");
        btn.type = "button";
        btn.id = "omhp-accent";
        btn.title = "OMHP Toolkit: colours, features, layouts";
        btn.style.color = "var(--amber)";
        var pop = el("div", "omhp-accent-pop");
        pop.hidden = true;
        pop.setAttribute("role", "dialog");
        pop.setAttribute("aria-label", "OMHP Toolkit settings");

        // A labelled row: "THEME     TERMINAL  MIDNIGHT  ..."
        function row(label, items) {
            var r = el("div", "omhp-menu-row");
            r.appendChild(el("div", "omhp-menu-label", label));
            var body = el("div", "omhp-menu-body");
            items.forEach(function(x) { body.appendChild(x); });
            r.appendChild(body);
            pop.appendChild(r);
            return body;
        }

        // Header: name, version, close
        var head = el("div", "omhp-menu-head");
        var version = typeof GM_info !== "undefined" && GM_info.script ? " v" + GM_info.script.version : "";
        head.appendChild(el("span", null, "OMHP TOOLKIT" + version));
        head.appendChild(choice("[X]", false, "close", function() { pop.hidden = true; }));
        pop.appendChild(head);

        var swatches = ACCENTS.map(function(a) {
            var sw = el("button", "omhp-swatch" + (a.hex === current ? " on" : ""));
            sw.type = "button";
            sw.style.background = a.hex;
            sw.title = a.name;
            sw.addEventListener("click", function() {
                current = a.hex;
                var stored = a.hex === ACCENTS[0].hex ? null : a.hex; // the default is stored as "no override"
                applyAccent(stored);
                save(ACCENT_KEY, stored);
                swatches.forEach(function(x) { x.classList.toggle("on", x === sw); });
            });
            return sw;
        });
        row("COLOUR", swatches);

        var themeBtns = THEMES.map(function(t) {
            var b = choice(t.name, t.name === currentTheme, null, function() {
                currentTheme = t.name;
                var stored = t.vars ? t.name : null; // the default is stored as "no override"
                applyTheme(stored);
                save(THEME_KEY, stored);
                themeBtns.forEach(function(x) { x.classList.toggle("on", x === b); });
            });
            return b;
        });
        row("THEME", themeBtns);

        // Features on/off: takes effect on the next reload
        var note = el("div", "omhp-menu-note", "reload the page to apply");
        note.hidden = true;
        var featBody = row("FEATURES", FEATURES.map(function(f) {
            var b = choice(f[1], isOn(f[0]), "turn " + f[1] + " on or off", function() {
                features[f[0]] = !isOn(f[0]);
                save(FEATURES_KEY, features);
                b.classList.toggle("on", isOn(f[0]));
                b.setAttribute("aria-pressed", String(isOn(f[0])));
                note.hidden = false;
                // Browsers only let a page ask for notifications from a click like this one
                if (f[0] === "notify" && isOn("notify") && window.Notification && Notification.permission === "default") {
                    Notification.requestPermission();
                }
            });
            b.classList.add("omhp-check");
            b.setAttribute("aria-pressed", String(isOn(f[0])));
            return b;
        }));
        featBody.classList.add("omhp-menu-grid");
        pop.appendChild(note);

        // NOTIFY: the lowest loot rarity worth a notification (click to step through)
        var lootMin = choice("", true, "notify for loot of this rarity or better (click to change)", function() {
            var i = RARITIES.indexOf(notifyRarity());
            save(NOTIFY_RARITY_KEY, RARITIES[(i + 1) % RARITIES.length]);
            paintLootMin();
        });
        function paintLootMin() {
            var r = notifyRarity();
            lootMin.className = "btn-text omhp-choice on r-" + r;
            lootMin.textContent = r.toUpperCase() + " OR BETTER";
        }
        paintLootMin();
        row("LOOT ALERT", [lootMin]);
        if (isOn("keys")) row("KEYS", [el("span", "omhp-menu-hint", "Alt+1–9 tabs · Alt+P pin · Alt+O pop out · Alt+T this menu")]);

        // Other userscripts this one knows, checked each time the menu opens
        var addons = el("span", "omhp-menu-hint");
        row("ADD-ONS", [addons]);
        function paintAddons() {
            addons.textContent = document.getElementById("omhp-tracker")
                ? "1MHP Data Statistics found · " + (isOn("stats") ? "in this theme" : "own colours (STATS THEME off)")
                : "none found (1MHP Data Statistics gets this theme when installed)";
        }

        // Layouts: the built-in ones, your saved ones (× deletes), + SAVE
        var BUILT_IN = { "DEFAULT": {}, "BOSS FOCUS": {} };
        BUILT_IN["BOSS FOCUS"][STORE_KEY] = JSON.stringify({ feed: true, chat: true, dms: true, loot: true });
        BUILT_IN["BOSS FOCUS"]["omhp.layout.widths"] = JSON.stringify({ l: 240 });

        function applyLayout(snap) {
            LAYOUT_KEYS.forEach(function(k) {
                try {
                    if (snap[k] == null) localStorage.removeItem(k);
                    else localStorage.setItem(k, snap[k]);
                } catch (e) { /* ignore */ }
            });
            location.reload();
        }

        var layoutBody = row("LAYOUT", []);
        function paintLayouts() {
            var mine = loadSaved(PRESETS_KEY);
            layoutBody.replaceChildren();
            Object.keys(BUILT_IN).forEach(function(name) {
                layoutBody.appendChild(choice(name, false, "switch to this layout (reloads the page)", function() {
                    if (name === "DEFAULT" && !confirm("Put the layout back to how it started? Column sizes, order, pins and pop-out windows reset (stats and settings stay).")) return;
                    applyLayout(BUILT_IN[name]);
                }));
            });
            Object.keys(mine).forEach(function(name) {
                layoutBody.appendChild(choice(name, false, "switch to this layout (reloads the page)", function() { applyLayout(mine[name]); }));
                var del = choice("×", false, "delete " + name, function() {
                    delete mine[name];
                    save(PRESETS_KEY, mine);
                    paintLayouts();
                });
                del.classList.add("omhp-del");
                layoutBody.appendChild(del);
            });
            layoutBody.appendChild(choice("+ SAVE", false, "save the current layout under a name", function() {
                var name = (prompt("Name this layout:") || "").trim().toUpperCase().slice(0, 20);
                if (!name || BUILT_IN[name]) return;
                var snap = {};
                LAYOUT_KEYS.forEach(function(k) {
                    try { snap[k] = localStorage.getItem(k); } catch (e) { /* ignore */ }
                });
                mine[name] = snap;
                save(PRESETS_KEY, mine);
                paintLayouts();
            }));
        }
        paintLayouts();

        // Backups: everything this toolkit saves, as a file you can load in another browser
        function exportAll() {
            var data = {};
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (isOurKey(k)) data[k] = localStorage.getItem(k);
            }
            var blob = new Blob([JSON.stringify({ app: "omhp-toolkit", v: 1, saved: new Date().toISOString(), data: data })], { type: "application/json" });
            var a = el("a");
            a.href = URL.createObjectURL(blob);
            a.download = "omhp-toolkit-" + today() + ".json";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
        }

        var file = el("input");
        file.type = "file";
        file.accept = ".json,application/json";
        file.hidden = true;
        file.addEventListener("change", function() {
            var f = file.files && file.files[0];
            file.value = "";
            if (!f) return;
            f.text().then(function(text) {
                var got = JSON.parse(text);
                if (!got || got.app !== "omhp-toolkit" || !got.data || typeof got.data !== "object") throw new Error("this isn't an OMHP Toolkit backup");
                // Only our own keys, and only values that are valid JSON
                var keys = Object.keys(got.data).filter(function(k) {
                    if (!isOurKey(k) || typeof got.data[k] !== "string") return false;
                    try { JSON.parse(got.data[k]); return true; } catch (e) { return false; }
                });
                if (!confirm("Replace your toolkit settings, layout and stats with this backup (" + keys.length + " items)? The page will reload.")) return;
                var old = [];
                for (var i = 0; i < localStorage.length; i++) if (isOurKey(localStorage.key(i))) old.push(localStorage.key(i));
                old.forEach(function(k) { localStorage.removeItem(k); });
                keys.forEach(function(k) { localStorage.setItem(k, got.data[k]); });
                location.reload();
            }).catch(function(e) {
                alert("Couldn't import: " + e.message);
            });
        });
        row("BACKUP", [
            choice("EXPORT", false, "download your settings, layouts and stats as a file", exportAll),
            choice("IMPORT", false, "load a file made with EXPORT (replaces what's here)", function() { file.click(); }),
            file
        ]);

        btn.addEventListener("click", function(e) {
            e.stopPropagation();
            pop.hidden = !pop.hidden;
            if (!pop.hidden) paintAddons();
        });
        document.addEventListener("click", function(e) {
            if (!wrap.contains(e.target)) pop.hidden = true;
        });
        document.addEventListener("keydown", function(e) {
            if (e.key === "Escape") pop.hidden = true;
        });

        wrap.appendChild(btn);
        wrap.appendChild(pop);
        addToBar(bar, wrap);
    }

    // Under "+1 ATTACK IN 0:42": how long until every attack slot has refilled.
    function attackTimer() {
        var resetIn = document.getElementById("reset-in");
        var pips = document.getElementById("pips");
        if (!resetIn || !pips) return false;
        var line = document.createElement("div");
        line.id = "omhp-full";
        line.className = "reset-in dim";
        resetIn.insertAdjacentElement("afterend", line);

        // The site's (hidden) rules line says "one recharges every 10 minutes"
        function rechargeSeconds() {
            var t = (document.getElementById("rules-line") || {}).textContent || "";
            var m = t.match(/every (\d+) minutes/);
            if (m) return Number(m[1]) * 60;
            if (/every minute/.test(t)) return 60;
            m = t.match(/every (\d+) seconds/);
            return m ? Number(m[1]) : null;
        }

        // How long your attacks sat full today (recharging nothing). With several tabs
        // open, only the leader counts it. Kept in memory and saved every 30s (and when the
        // page closes); the other tabs follow through the storage event.
        var IDLE_KEY = "omhp.idle";
        var idleSt = loadSaved(IDLE_KEY), idleDirty = false;
        var lastTick = Date.now();
        function idle(full) {
            if (idleSt.day !== today()) {
                if (idleSt.day && idleSt.ms >= 60000) archiveDay(idleSt.day, "idle", { ms: idleSt.ms });
                idleSt = { day: today(), ms: 0 };
                idleDirty = true;
            }
            var now = Date.now();
            if (full && isLeader()) {
                idleSt.ms += Math.min(90000, now - lastTick); // not across sleep
                idleDirty = true;
            }
            lastTick = now;
            return idleSt.ms >= 60000 ? " · IDLE " + dur(idleSt.ms / 60000) + " TODAY" : "";
        }

        function saveIdle() {
            if (!idleDirty) return;
            idleDirty = false;
            save(IDLE_KEY, idleSt);
        }
        every(30000, saveIdle);
        window.addEventListener("pagehide", saveIdle);
        window.addEventListener("storage", function(e) {
            if (e.key === IDLE_KEY && !isLeader()) idleSt = loadSaved(IDLE_KEY);
        });

        function tick() {
            var key = (pips.dataset.key || "").split("/"); // "left/per", set by the site
            var left = Number(key[0]), per = Number(key[1]);
            var next = (resetIn.textContent || "").match(/(\d+):(\d\d)/);
            var every = rechargeSeconds();
            var full = per > 0 && left >= per;
            var wasted = idle(full);
            if (full) {
                line.textContent = "FULL" + wasted;
                line.title = "time today your attacks sat full, recharging nothing";
                return;
            }
            if (!per || isNaN(left) || !next || !every) {
                line.textContent = "";
                return;
            }
            var secs = Number(next[1]) * 60 + Number(next[2]) + (per - left - 1) * every;
            var h = Math.floor(secs / 3600), m = Math.floor(secs % 3600 / 60), s = secs % 60;
            // A clock-style countdown ("1:05:09", "42:09"), unlike dur()'s "1h 05m"
            line.textContent = "FULL IN " + (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0") + wasted;
        }

        tick();
        every(1000, tick);
    }

    // LOOT section for the left column: what you found today, by rarity (kept across
    // reloads and shared by open tabs until [RESET] or a new day; earlier days go to DAYS).
    // Reads your own new lines in the attack feed (the site marks them li.me).
    function lootLog() {
        var KEY = "omhp.loot";
        var MAX_ITEMS = 200;
        var panel = document.createElement("div");
        panel.id = "omhp-loot";
        panel.className = "panel";
        var summary = document.createElement("div");
        summary.className = "panel-h omhp-loot-sum";
        var list = document.createElement("ol");
        list.id = "omhp-loot-list";
        list.className = "feed omhp-loot-list";
        panel.appendChild(summary);
        panel.appendChild(list);
        // Parked out of sight until moveSections() puts it in the left column
        panel.hidden = true;
        document.body.appendChild(panel);

        // counts: rarity class -> [count, label]; items: newest first, { t, cls, text, sold }
        function fresh() {
            return { v: 1, day: today(), counts: {}, items: [] };
        }

        // The stored log; a new day starts it over and files the old counts under DAYS
        function load() {
            var s = loadSaved(KEY);
            if (s.v !== 1) s = fresh();
            if (s.day !== today()) {
                if (Object.keys(s.counts || {}).length) archiveDay(s.day, "loot", { counts: s.counts });
                s = fresh();
                save(KEY, s);
            }
            return s;
        }

        var started = Date.now();
        var reset = resetButton("clear the loot log", function() {
            save(KEY, fresh());
            redraw();
        });

        // [CHESTS]: what your box openings gave, per box, next to the site's stated odds.
        // Counted by the leader tab from your single opens; OPEN ALL only says how many.
        var CHESTS_KEY = "omhp.chests";
        var chestBox = document.createElement("div");
        chestBox.className = "omhp-chests";
        chestBox.hidden = true;
        panel.insertBefore(chestBox, list);
        var chestsBtn = resetButton("what your chests gave you, against the stated odds", function() {
            chestBox.hidden = !chestBox.hidden;
            if (!chestBox.hidden) paintChests();
        });
        chestsBtn.textContent = "[CHESTS]";

        document.addEventListener("omhp-unbox", function(e) {
            if (!isLeader()) return;
            var x;
            try { x = JSON.parse(e.detail); } catch (err) { return; }
            var all = loadSaved(CHESTS_KEY);
            var id = x.box || "?";
            var c = all[id] = all[id] || { opened: 0, bulk: 0, out: {} };
            if (x.bulk) c.bulk += x.count || 0;
            else {
                c.opened++;
                var k = outcomeKey(x.reward, x.rarity, x.amount);
                c.out[k] = (c.out[k] || 0) + 1;
            }
            save(CHESTS_KEY, all);
            if (!chestBox.hidden) paintChests();
        });

        function paintChests() {
            var all = loadSaved(CHESTS_KEY), stated = {};
            var bridge = document.getElementById("omhp-boss-data");
            try { stated = JSON.parse((bridge && bridge.dataset.boxStated) || "{}"); } catch (e) { /* none */ }
            // Boxes in the site's order, then any it doesn't list
            var ids = Object.keys(stated).filter(function(id) { return all[id]; })
                .concat(Object.keys(all).filter(function(id) { return !stated[id]; }));
            chestBox.replaceChildren();
            var head = document.createElement("div");
            head.className = "omhp-chests-head";
            head.textContent = ids.length ? "OBSERVED vs STATED, from your single opens" : "no chests opened yet (open one from BAG)";
            if (ids.length) {
                head.appendChild(resetButton("clear the chest ledger", function() {
                    save(CHESTS_KEY, {});
                    paintChests();
                }));
            }
            chestBox.appendChild(head);
            ids.forEach(function(id) {
                var c = all[id], s = stated[id] || { name: id === "?" ? "UNKNOWN BOX" : id, odds: [] };
                var title = document.createElement("div");
                title.className = "omhp-chests-box";
                title.textContent = (s.name || id).toUpperCase() + " · opened " + fmt(c.opened) +
                    (c.bulk ? " (+" + fmt(c.bulk) + " in bulk: the feed doesn't list what came out)" : "");
                chestBox.appendChild(title);
                // Every stated outcome, then anything seen that the odds don't list
                var keys = s.odds.map(function(o) { return o[0]; });
                Object.keys(c.out).forEach(function(k) { if (keys.indexOf(k) === -1) keys.push(k); });
                keys.forEach(function(k) {
                    var odd = s.odds.filter(function(o) { return o[0] === k; })[0];
                    var n = c.out[k] || 0;
                    var rowEl = document.createElement("div");
                    rowEl.className = "omhp-chests-row";
                    var name = document.createElement("span");
                    name.className = RARITIES.indexOf(k) !== -1 ? "r-" + k : "";
                    name.textContent = outcomeLabel(k);
                    var seen = document.createElement("span");
                    seen.className = "v";
                    seen.textContent = (c.opened ? pct(n / c.opened) : "--") + " (" + fmt(n) + ")";
                    var want = document.createElement("span");
                    want.className = "dim";
                    want.textContent = odd ? "stated " + pct(odd[1]) : "not listed";
                    rowEl.appendChild(name);
                    rowEl.appendChild(seen);
                    rowEl.appendChild(want);
                    chestBox.appendChild(rowEl);
                });
            });
        }

        // "RARE x12 1.2%": count today, and drops per 100 attacks today. The tooltip has
        // the rates over the last 30 days too.
        function paintSummary(st) {
            var keys = Object.keys(st.counts).sort(function(a, b) {
                return RARITIES.indexOf(a.slice(2)) - RARITIES.indexOf(b.slice(2));
            });
            var hits = hitsToday();
            summary.replaceChildren();
            if (!keys.length) summary.appendChild(document.createTextNode("nothing yet today"));
            keys.forEach(function(k, i) {
                if (i) summary.appendChild(document.createTextNode("  "));
                var s = document.createElement("span");
                s.className = k;
                s.textContent = st.counts[k][1] + " x" + st.counts[k][0];
                summary.appendChild(s);
                if (hits > 0) {
                    var r = document.createElement("span");
                    r.className = "omhp-rate";
                    r.textContent = " " + dropRate(st.counts[k][0], hits);
                    summary.appendChild(r);
                }
            });
            summary.appendChild(chestsBtn);
            if (keys.length) summary.appendChild(reset);
            summary.title = ratesTitle(st, hits);
        }

        function ratesTitle(st, hits) {
            var days = loadSaved(DAYS_KEY), all = {}, allHits = hits;
            Object.keys(st.counts).forEach(function(k) { all[k] = [st.counts[k][0], st.counts[k][1]]; });
            Object.keys(days).forEach(function(d) {
                var c = (days[d].loot || {}).counts || {};
                allHits += (days[d].session || {}).hits || 0;
                Object.keys(c).forEach(function(k) {
                    all[k] = all[k] || [0, c[k][1]];
                    all[k][0] += c[k][0];
                });
            });
            var lines = ["drops per 100 attacks"];
            if (hits) lines.push("today (" + fmt(hits) + " attacks): " + Object.keys(st.counts).map(function(k) {
                return st.counts[k][1] + " " + dropRate(st.counts[k][0], hits);
            }).join(", "));
            if (allHits > hits) lines.push("last 30 days (" + fmt(allHits) + " attacks): " + Object.keys(all).map(function(k) {
                return all[k][1] + " " + dropRate(all[k][0], allHits);
            }).join(", "));
            return lines.length > 1 ? lines.join("\n") : "";
        }

        // One list line from its saved data. Rarity text is wrapped in its r-* class so
        // the site's own colours apply.
        function render(it) {
            var item = document.createElement("li");
            var t = document.createElement("span");
            t.className = "t";
            t.textContent = it.t;
            item.appendChild(t);
            var m = document.createElement("span");
            m.className = "m";
            if (it.cls) {
                var tag = document.createElement("span");
                tag.className = it.cls;
                tag.textContent = it.text;
                m.appendChild(tag);
            } else {
                m.textContent = it.text;
            }
            if (it.sold) m.appendChild(document.createTextNode(" (sold)"));
            item.appendChild(m);
            return item;
        }

        function redraw() {
            var st = load();
            list.replaceChildren.apply(list, st.items.map(render));
            paintSummary(st);
        }

        function add(li) {
            // With the game open in several tabs, only the leader writes it down
            if (!isLeader()) return;
            var st = load();
            var tag = li.querySelector('[class^="r-"], [class*=" r-"]');
            var it = { t: new Date().toTimeString().slice(0, 5), cls: null, text: "", sold: /auto-sold/.test(li.textContent) };
            var rarity = null;
            if (tag) {
                it.cls = tag.className;
                it.text = tag.textContent;
                rarity = Array.prototype.filter.call(tag.classList, function(c) { return c.indexOf("r-") === 0; })[0];
                var label = (tag.textContent.match(/[A-Z][A-Z ]*[A-Z]/) || [rarity.slice(2).toUpperCase()])[0];
                st.counts[rarity] = st.counts[rarity] || [0, label];
                st.counts[rarity][0]++;
            } else {
                // Boxes and scrolls: keep the line's own wording after your name
                it.text = (li.querySelector(".m") || li).textContent.replace(/^.*?\b(found|opened)\b/, "$1");
            }
            st.items.unshift(it);
            if (st.items.length > MAX_ITEMS) st.items.length = MAX_ITEMS;
            save(KEY, st);
            redraw();
            if (rarity && RARITIES.indexOf(rarity.slice(2)) >= RARITIES.indexOf(notifyRarity())) {
                notify("Loot: " + it.text.trim());
            }
        }

        function watch() {
            var feed = document.getElementById("feed");
            if (!feed) return;
            new MutationObserver(function(records) {
                records.forEach(function(r) {
                    r.addedNodes.forEach(function(n) {
                        // Only fresh lines (.new), not history the feed loads when you scroll
                        if (n.nodeType !== 1 || !n.classList.contains("me") || !n.classList.contains("new")) return;
                        if (Date.now() - started < 3000) return; // the first batch on load is old news
                        if (n.matches(".k-loot, .k-unbox, .k-box, .k-scroll_find") || /\bfound\b/.test(n.textContent)) add(n);
                    });
                });
            }).observe(feed, { childList: true });
        }

        // Another tab added something (or reset it)
        window.addEventListener("storage", function(e) {
            if (e.key === KEY) redraw();
            if (e.key === CHESTS_KEY && !chestBox.hidden) paintChests();
        });
        // The rates move with every attack, not only with loot
        every(30000, function() { paintSummary(load()); }, { visible: true });
        redraw();
        watch();
    }

    // BOSSES section for the left column: every boss you've seen, newest first. When a boss
    // changes, its summary is saved: name, how long you watched it, your damage and share,
    // the most players online, and HP healed. With several tabs open, the leader records.
    function bossLog() {
        var KEY = "omhp.bosses", CUR_KEY = "omhp.bosscur";
        var MAX = 100;
        var panel = document.createElement("div");
        panel.id = "omhp-bosses";
        panel.className = "panel";
        var list = document.createElement("ol");
        list.id = "omhp-bosses-list";
        list.className = "feed omhp-loot-list";
        panel.appendChild(list);
        // Parked out of sight until moveSections() puts it in the left column
        panel.hidden = true;
        document.body.appendChild(panel);

        function render(x, graphs) {
            var li = document.createElement("li");
            var t = document.createElement("span");
            t.className = "t";
            t.textContent = new Date(x.end).toTimeString().slice(0, 5);
            li.appendChild(t);
            var m = document.createElement("span");
            m.className = "m";
            var name = document.createElement("span");
            name.className = "val";
            name.textContent = "#" + x.seq + " " + (x.name || "");
            m.appendChild(name);
            var bits = [dur((x.end - x.start) / 60000) + (x.killed ? " · KILLED" : " · LEFT")];
            if (x.mine) bits.push("YOU " + short(x.mine) + (x.all ? " (" + (x.mine / x.all * 100).toFixed(2) + "%)" : ""));
            if (x.peak) bits.push("PEAK " + x.peak);
            if (x.healed > 0) bits.push("HEALED " + short(x.healed));
            m.appendChild(document.createTextNode(" · " + bits.join(" · ")));
            if (graphs[x.seq]) {
                var g = resetButton("this boss's HP graph, in a window", function() { openBossGraph(x.seq, x.name); });
                g.textContent = "[GRAPH]";
                m.appendChild(g);
            }
            li.appendChild(m);
            li.title = new Date(x.start).toLocaleString() + " to " + new Date(x.end).toLocaleString() +
                (x.killed ? "" : "\n(you weren't watching when it ended)");
            return li;
        }

        function redraw() {
            var all = loadJSON(KEY, []);
            if (!all.length) {
                var li = document.createElement("li");
                li.className = "dim";
                li.textContent = "bosses you see are listed here once they're gone";
                list.replaceChildren(li);
            } else {
                var graphs = loadSaved(GRAPHS_KEY);
                list.replaceChildren.apply(list, all.map(function(x) { return render(x, graphs); }));
            }
        }

        function sample() {
            var b = trueBoss();
            if (!b || !isLeader()) return;
            var cur = loadJSON(CUR_KEY, null);
            var now = Date.now();
            if (cur && cur.seq !== b.seq) {
                // A new boss: file the last one
                var all = loadJSON(KEY, []);
                if (!all.length || all[0].seq !== cur.seq) {
                    all.unshift(cur);
                    save(KEY, all.slice(0, MAX));
                }
                cur = null;
                redraw();
            }
            if (!cur) cur = { seq: b.seq, name: b.name || "", start: now, end: now, mine: 0, all: 0, peak: 0, healed: 0, killed: false };
            cur.end = now;
            if (b.name) cur.name = b.name;
            var mine = numberIn(document.getElementById("boss-dmg"));
            if (mine !== null && mine >= cur.mine) cur.mine = mine;
            if (typeof b.dmg === "number") cur.all = Math.max(cur.all, b.dmg);
            cur.peak = Math.max(cur.peak, numberIn(document.getElementById("st-online")) || 0);
            if (typeof b.dmg === "number" && b.max) cur.healed = Math.max(cur.healed, b.dmg - (b.max - b.hp));
            if (b.alive === false) cur.killed = true;
            save(CUR_KEY, cur);
        }

        window.addEventListener("storage", function(e) {
            if (e.key === KEY || e.key === GRAPHS_KEY) redraw();
        });
        document.addEventListener("omhp-graphs", redraw); // this tab kept a fight (graph.js)
        redraw();
        sample();
        every(5000, sample);
    }

    // Set once the saved pin (if any) is back, so pop-out windows restore after it
    var pinRestored = false;

    // [PIN] in the right column's tab bar: keep the open panel showing above the others.
    function pinPanel() {
        var side = document.querySelector("#app .col-side");
        var tabs = document.getElementById("tabs");
        if (!side || !tabs) {
            pinRestored = true;
            return;
        }
        var box = document.createElement("div");
        box.id = "omhp-pinned";
        box.hidden = true;
        tabs.insertAdjacentElement("afterend", box);

        // The line under the pinned panel: drag to resize, double-click to reset
        var PIN_H_KEY = "omhp.layout.pinH";
        var grip = document.createElement("div");
        grip.id = "omhp-pin-resize";
        grip.className = "left-resize";
        grip.title = "drag to resize, double-click to reset";
        grip.hidden = true;
        box.insertAdjacentElement("afterend", grip);

        function setPinHeight(px) {
            box.classList.toggle("sized", !!px);
            box.style.height = px ? Math.round(px) + "px" : "";
        }
        setPinHeight(loadJSON(PIN_H_KEY, null));

        var isDouble = makeDoublePress();
        var dragFrom = null; // { y, h } while dragging
        grip.addEventListener("pointerdown", function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            if (isDouble()) {
                setPinHeight(null);
                save(PIN_H_KEY, null);
                return;
            }
            grip.setPointerCapture(e.pointerId);
            grip.classList.add("dragging");
            dragFrom = { y: e.clientY, h: box.offsetHeight };
        });
        grip.addEventListener("pointermove", function(e) {
            if (!dragFrom) return;
            // Leave the panel below at least 120px
            var most = side.clientHeight - tabs.offsetHeight - 120;
            setPinHeight(Math.max(60, Math.min(most, dragFrom.h + e.clientY - dragFrom.y)));
        });
        function endDrag() {
            if (!dragFrom) return;
            dragFrom = null;
            grip.classList.remove("dragging");
            save(PIN_H_KEY, box.offsetHeight);
        }
        grip.addEventListener("pointerup", endDrag);
        grip.addEventListener("pointercancel", endDrag);

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-text omhp-pin";
        tabs.appendChild(btn);

        var pinned = null; // { key, panel, home } while something is pinned
        var keepShown = new MutationObserver(function() {
            if (pinned && pinned.panel.hidden) pinned.panel.hidden = false;
        });

        function paint() {
            btn.textContent = pinned ? "[UNPIN]" : "[PIN]";
            btn.title = pinned ? "stop keeping " + pinned.key.toUpperCase() + " on top" : "keep the open panel on top";
        }

        function pin(key) {
            var panel = document.getElementById("panel-" + key);
            if (!panel || LEFT_TABS.indexOf(key) !== -1) return;
            pinned = { key: key, panel: panel, home: panel.nextSibling };
            box.appendChild(panel);
            box.hidden = false;
            grip.hidden = false;
            panel.hidden = false;
            keepShown.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
            save(PIN_KEY, key);
            paint();
        }

        function unpin() {
            if (!pinned) return;
            keepShown.disconnect();
            side.insertBefore(pinned.panel, pinned.home && pinned.home.parentNode === side ? pinned.home : null);
            var sel = document.querySelector('#tabs [role=tab][aria-selected="true"]');
            pinned.panel.hidden = !(sel && sel.dataset.tab === pinned.key);
            pinned = null;
            box.hidden = true;
            grip.hidden = true;
            save(PIN_KEY, null);
            paint();
        }

        btn.addEventListener("click", function() {
            if (pinned) return unpin();
            var sel = document.querySelector('#tabs [role=tab][aria-selected="true"]');
            if (sel) pin(sel.dataset.tab);
        });

        paint();
        var saved = loadJSON(PIN_KEY, null);
        if (!saved) {
            pinRestored = true;
            return;
        }
        // Load it once by picking its tab, then pin it (after the site restores its own tab)
        whenReady(900, tabsReady, function() {
            var t = tabButton(saved);
            if (t && !t.hidden) {
                var before = document.querySelector('#tabs [role=tab][aria-selected="true"]');
                t.click();
                pin(saved);
                if (before && before !== t) before.click();
            }
            pinRestored = true;
        });
    }

    // Pop out any panel into a floating window you can drag and resize, several at once:
    // [POP OUT] in the tab bar for the open right-hand panel, and the ⧉ button on each
    // left-column section. DESIGN also gets its drawing grid scaled up to fill the window.
    var popOutPanel = null; // set by floatingPanels(); used by the left sections' ⧉ buttons

    function floatingPanels() {
        var tabs = document.getElementById("tabs");
        if (!tabs) return;
        var KEY = "omhp.layout.floats";
        var store = loadSaved(KEY);
        // Older versions only remembered the DESIGN window, under its own key
        var oldDesigner = loadSaved("omhp.layout.designer");
        if (oldDesigner.w && !store.designer) {
            store.designer = oldDesigner;
            save(KEY, store);
        }
        try { localStorage.removeItem("omhp.layout.designer"); } catch (e) { /* ignore */ }

        var open = {}; // key -> { win, body, panel, home, left, keepShown }
        var top = 60;

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-text omhp-popout";
        btn.textContent = "[POP OUT]";
        btn.title = "open this panel in a floating window";
        tabs.appendChild(btn);

        function selectedKey() {
            var sel = document.querySelector('#tabs [role=tab][aria-selected="true"]');
            return sel ? sel.dataset.tab : null;
        }

        function syncButton() {
            var k = selectedKey();
            btn.disabled = !k || !!open[k] || LEFT_TABS.indexOf(k) !== -1;
        }

        function sectionInfo(key) {
            return SECTIONS.filter(function(s) { return s.key === key; })[0] || null;
        }

        function titleFor(key, info) {
            if (key === "designer") return "BOSS FORGE";
            if (info) return info.title;
            var t = tabButton(key);
            // "[ AUCTION HOUSE 2 ]" -> "AUCTION HOUSE"
            return ((t && t.textContent) || key).replace(/^\[\s*|\s*\]$/g, "").replace(/\s+\d+$/, "").toUpperCase();
        }

        function raise(win) {
            win.style.zIndex = String(++top);
        }

        function remember(key) {
            var o = open[key];
            if (!o) return;
            var r = o.win.getBoundingClientRect();
            var g = store[key] || {};
            store[key] = {
                x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width),
                // A minimised window is only its title bar: keep the height it had before
                h: g.min && g.h ? g.h : Math.round(r.height),
                open: true, min: !!g.min, op: g.op || 1
            };
            save(KEY, store);
        }

        // Minimised (title bar only) and see-through, both remembered per window
        function applyLook(key) {
            var o = open[key], g = store[key] || {};
            if (!o) return;
            o.win.classList.toggle("minimised", !!g.min);
            o.win.style.height = g.min ? "auto" : Math.min(g.h || window.innerHeight - 120, window.innerHeight - 20) + "px";
            o.win.style.opacity = String(g.op || 1);
            o.minBtn.textContent = g.min ? "[+]" : "[_]";
            o.minBtn.title = g.min ? "restore" : "minimise to the title bar";
            o.opInput.value = String(Math.round((g.op || 1) * 100));
        }

        function place(key) {
            var g = store[key] || {};
            var win = open[key].win;
            var count = Object.keys(open).length - 1; // cascade new windows a little
            var w = Math.min(g.w || (key === "designer" ? 760 : 460), window.innerWidth - 20);
            var h = Math.min(g.h || window.innerHeight - 120, window.innerHeight - 20);
            var x = g.x != null ? g.x : (window.innerWidth - w) / 2 + count * 30;
            var y = g.y != null ? g.y : 40 + count * 30;
            win.style.left = Math.max(0, Math.min(x, window.innerWidth - 80)) + "px";
            win.style.top = Math.max(0, Math.min(y, window.innerHeight - 40)) + "px";
            win.style.width = w + "px";
            win.style.height = h + "px";
        }

        // DESIGN: scale the grid to the window's width, then let the designer re-measure
        // its cells (it does that on window resize) so drawing stays lined up.
        function refit(key) {
            var o = open[key];
            if (!o || key !== "designer" || o.pending) return;
            o.pending = true;
            requestAnimationFrame(function() {
                o.pending = false;
                var canvas = o.panel.querySelector(".design-canvas");
                var wrap = canvas && canvas.parentElement;
                if (canvas && wrap && wrap.clientWidth) {
                    var cols = parseFloat(getComputedStyle(canvas).getPropertyValue("--cols")) || 36;
                    var px = Math.max(10, Math.min(40, (wrap.clientWidth - 14) / (cols * 0.602)));
                    o.win.style.setProperty("--omhp-design-font", px.toFixed(2) + "px");
                }
                window.dispatchEvent(new Event("resize"));
            });
        }

        function makeWindow(key, title) {
            var win = document.createElement("div");
            win.className = "omhp-float";
            win.dataset.key = key;
            var bar = document.createElement("div");
            bar.className = "omhp-float-bar";
            var name = document.createElement("span");
            name.textContent = title;
            var dock = document.createElement("button");
            dock.type = "button";
            dock.className = "btn-text";
            dock.textContent = "[DOCK]";
            dock.title = "put it back";
            dock.addEventListener("click", function() { dockIn(key); });
            var tools = document.createElement("span");
            tools.className = "omhp-float-tools";
            // See-through: 30% .. 100% opacity
            var opInput = document.createElement("input");
            opInput.type = "range";
            opInput.min = "30";
            opInput.max = "100";
            opInput.step = "5";
            opInput.value = "100";
            opInput.className = "omhp-float-op";
            opInput.title = "see-through";
            opInput.addEventListener("input", function() {
                store[key] = store[key] || {};
                store[key].op = Number(opInput.value) / 100;
                win.style.opacity = String(store[key].op);
            });
            opInput.addEventListener("change", function() { save(KEY, store); });
            var minBtn = document.createElement("button");
            minBtn.type = "button";
            minBtn.className = "btn-text";
            minBtn.addEventListener("click", function() {
                remember(key); // keep the current height before shrinking
                store[key].min = !store[key].min;
                save(KEY, store);
                applyLook(key);
                if (!store[key].min) refit(key);
            });
            tools.appendChild(opInput);
            tools.appendChild(minBtn);
            tools.appendChild(dock);
            bar.appendChild(name);
            bar.appendChild(tools);
            var body = document.createElement("div");
            body.className = "omhp-float-body";
            win.appendChild(bar);
            win.appendChild(body);
            document.body.appendChild(win);

            win.addEventListener("pointerdown", function() { raise(win); });

            // Drag the title bar to move the window
            var drag = null;
            bar.addEventListener("pointerdown", function(e) {
                if (e.button !== 0 || e.target !== bar && e.target !== name) return;
                e.preventDefault();
                bar.setPointerCapture(e.pointerId);
                var r = win.getBoundingClientRect();
                drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
            });
            bar.addEventListener("pointermove", function(e) {
                if (!drag) return;
                win.style.left = Math.max(0, Math.min(e.clientX - drag.dx, window.innerWidth - 80)) + "px";
                win.style.top = Math.max(0, Math.min(e.clientY - drag.dy, window.innerHeight - 30)) + "px";
            });
            function endDrag() {
                if (!drag) return;
                drag = null;
                remember(key);
            }
            bar.addEventListener("pointerup", endDrag);
            bar.addEventListener("pointercancel", endDrag);

            // Resizing (the corner handle) is remembered; DESIGN rescales its grid
            var saveTimer = null;
            new ResizeObserver(function() {
                if (!open[key] || win.classList.contains("minimised")) return;
                refit(key);
                clearTimeout(saveTimer);
                saveTimer = setTimeout(function() { remember(key); }, 300);
            }).observe(win);

            return { win: win, body: body, minBtn: minBtn, opInput: opInput };
        }

        function popOut(key) {
            if (!key) return;
            if (open[key]) return raise(open[key].win);
            var info = sectionInfo(key);
            if (!info && LEFT_TABS.indexOf(key) !== -1) return;
            var panel = document.getElementById(info ? info.panel : "panel-" + key);
            if (!panel) return;
            if (!info) {
                // Right-hand panel: unpin it first, and let the site build/load it by picking its tab
                var pinBtn = document.querySelector("#tabs .omhp-pin");
                if (panel.parentElement && panel.parentElement.id === "omhp-pinned" && pinBtn) pinBtn.click();
                var t = tabButton(key);
                if (!t || t.hidden) return;
                if (t.getAttribute("aria-selected") !== "true") t.click();
            }
            var w = makeWindow(key, titleFor(key, info));
            var o = {
                win: w.win, body: w.body, panel: panel, left: !!info, minBtn: w.minBtn, opInput: w.opInput,
                home: { parent: panel.parentElement, next: panel.nextSibling },
                keepShown: new MutationObserver(function() { if (panel.hidden) panel.hidden = false; })
            };
            open[key] = o;
            w.body.appendChild(panel);
            panel.hidden = false;
            o.keepShown.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
            if (o.left) o.home.parent.classList.add("floated");
            place(key);
            applyLook(key);
            raise(o.win);
            remember(key);
            refit(key);
            // The right column would now be empty under this tab; move it on
            if (!o.left) fixRightPanel(key);
            syncButton();
        }

        function dockIn(key) {
            var o = open[key];
            if (!o) return;
            o.keepShown.disconnect();
            o.home.parent.insertBefore(o.panel, o.home.next && o.home.next.parentNode === o.home.parent ? o.home.next : null);
            if (o.left) {
                o.home.parent.classList.remove("floated");
                o.panel.hidden = false;
            } else {
                o.panel.hidden = selectedKey() !== key;
            }
            o.win.remove();
            delete open[key];
            if (store[key]) store[key].open = false;
            save(KEY, store);
            window.dispatchEvent(new Event("resize"));
            syncButton();
        }

        btn.addEventListener("click", function() { popOut(selectedKey()); });
        new MutationObserver(syncButton).observe(tabs, { subtree: true, attributes: true, attributeFilter: ["aria-selected", "hidden"] });
        syncButton();
        popOutPanel = popOut;

        // Re-open the windows that were open last time (after the site restores its tabs and pins)
        whenReady(1300, function() { return pinRestored && tabsReady(); }, function() {
            Object.keys(store).forEach(function(k) {
                if (store[k] && store[k].open) popOut(k);
            });
        });
    }

    // Shorter labels on the flat tab bar: "[ AUCTION HOUSE 2 ]" shows as "AUCTION 2".
    // The site's own text is left alone (it rewrites it for counts); CSS shows data-short.
    function shortTabs() {
        var tabs = document.getElementById("tabs");
        if (!tabs) return false;
        var SHORT = [
            ["AUCTION HOUSE", "AUCTION"], ["ACHIEVEMENTS", "ACHIEVE"], ["THE FORGE", "FORGE"],
            ["HALL OF FAME", "FAME"], ["CHANGELOG", "CHANGES"]
        ];

        function label(btn) {
            var t = (btn.textContent || "").replace(/^\s*\[\s*|\s*\]\s*$/g, "").replace(/\s+/g, " ");
            SHORT.forEach(function(pair) {
                if (t.indexOf(pair[0]) === 0) t = pair[1] + t.slice(pair[0].length);
            });
            if (btn.dataset.short !== t) btn.dataset.short = t;
        }

        function labelAll() {
            tabs.querySelectorAll(".tab-menu [role=tab]").forEach(label);
        }
        labelAll();
        onTabsChange(labelAll);
    }

    // Local time and how long the page has been open, in the top bar.
    function clock() {
        var bar = document.getElementById("statusline");
        if (!bar) return false;
        var span = document.createElement("span");
        span.id = "omhp-clock";
        span.className = "dim";
        var started = Date.now();

        function tick() {
            var mins = Math.floor((Date.now() - started) / 60000);
            span.textContent = new Date().toTimeString().slice(0, 5) + " · OPEN " + dur(mins);
        }

        addToBar(bar, span);
        tick();
        every(15000, tick, { visible: true });
    }

    // The browser tab's title: the site leads it with your attacks, "(3/5) ONE MILLION HP";
    // this adds the boss's HP and kill estimate after that, "(3/5) [72% ~39m] ONE MILLION HP".
    function tabTitle() {
        function paint() {
            var part = "";
            if (fogged()) part = "[FOG]";
            else {
                var b = trueBoss();
                if (b && b.max && b.alive !== false) part = "[" + (b.hp / b.max * 100).toFixed(0) + "%" + (etaShort ? " " + etaShort : "") + "]";
            }
            var next = titleWith(document.title, part); // see lib.js
            if (next !== document.title) document.title = next;
        }

        var titleEl = document.querySelector("title");
        // The site rewrites the title on every update of your data: add ours back straight away
        if (titleEl) new MutationObserver(paint).observe(titleEl, { childList: true, characterData: true, subtree: true });
        every(5000, paint);
        paint();
    }

    // Desktop notifications while this tab is in the background (see notify()): attacks
    // full, boss killed / new boss, FOG on/off, a new message. Loot is in lootLog().
    function notifier() {
        var last = null;

        function dmCount() {
            var t = (tabButton("dms") || {}).textContent || "";
            var m = t.match(/(\d+)\s*\]?\s*$/);
            return m ? Number(m[1]) : 0;
        }

        function check() {
            var pips = document.getElementById("pips");
            var key = ((pips && pips.dataset.key) || "").split("/");
            var b = trueBoss();
            var now = {
                full: Number(key[1]) > 0 && Number(key[0]) >= Number(key[1]),
                seq: b ? b.seq : null,
                alive: b ? b.alive !== false : null,
                fog: fogged(),
                dms: dmCount()
            };
            if (last) {
                if (now.full && !last.full) notify("Your attacks are full (" + key[0] + "/" + key[1] + ")");
                if (now.seq !== null && last.seq !== null && now.seq !== last.seq) notify("A new boss is here: #" + now.seq);
                else if (last.alive && now.alive === false) notify("Boss #" + now.seq + " is down");
                if (now.fog !== last.fog) notify(now.fog ? "FOG has rolled in" : "The FOG has lifted");
                if (now.dms > last.dms) notify("New message (" + now.dms + " unread)");
            }
            last = now;
        }

        every(5000, check);
        check();
    }

    // Alt + key shortcuts (the site's own keys use no modifier, and it ignores Alt):
    // Alt+1..9 picks a tab in the right column, Alt+P pins, Alt+O pops out, Alt+T opens
    // [TOOLKIT]. Matched by the physical key, so they work on any keyboard layout.
    function shortcuts() {
        document.addEventListener("keydown", function(e) {
            if (!e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
            var t = e.target;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
            var digit = /^Digit([1-9])$/.exec(e.code);
            var btn = null;
            if (digit) {
                var tabs = Array.prototype.filter.call(document.querySelectorAll("#tabs [role=tab]"), function(b) {
                    return !b.hidden && LEFT_TABS.indexOf(b.dataset.tab) === -1;
                });
                btn = tabs[Number(digit[1]) - 1];
            } else if (e.code === "KeyP") btn = document.querySelector("#tabs .omhp-pin");
            else if (e.code === "KeyO") btn = document.querySelector("#tabs .omhp-popout");
            else if (e.code === "KeyT") btn = document.getElementById("omhp-accent");
            if (!btn || btn.disabled) return;
            e.preventDefault();
            btn.click();
        });
    }

    // FILTER on the ATTACKS and CHAT headers: hide lines with any of some words or names,
    // and highlight lines with others (your name, your clan...). Saved; applies to both.
    var FILTER_KEY = "omhp.layout.filters";
    var filterEditor = null; // set by lineFilters(); builds the boxes FILTER opens

    function lineFilters() {
        var lists = [document.getElementById("feed"), document.getElementById("chat-list")].filter(Boolean);
        if (!lists.length) return false;
        var f = Object.assign({ hide: [], mark: [] }, loadSaved(FILTER_KEY));

        function has(words, text) {
            return words.some(function(w) { return text.indexOf(w) !== -1; });
        }

        function apply(li) {
            if (li.nodeType !== 1 || li.tagName !== "LI") return;
            var text = (li.textContent || "").toLowerCase();
            li.classList.toggle("omhp-hide", has(f.hide, text));
            li.classList.toggle("omhp-mark", has(f.mark, text));
        }

        function applyAll() {
            lists.forEach(function(l) { Array.prototype.forEach.call(l.children, apply); });
        }

        lists.forEach(function(l) {
            new MutationObserver(function(records) {
                records.forEach(function(r) { r.addedNodes.forEach(apply); });
            }).observe(l, { childList: true });
        });
        applyAll();

        filterEditor = function() {
            var box = document.createElement("div");
            box.className = "omhp-filter";
            [["hide", "HIDE", "lines with any of these words or names are hidden"],
                ["mark", "MARK", "lines with any of these words or names are highlighted"]].forEach(function(r) {
                var label = document.createElement("label");
                label.appendChild(document.createTextNode(r[1]));
                var input = document.createElement("input");
                input.type = "text";
                input.className = "omhp-filter-in";
                input.placeholder = "words or names, comma-separated";
                input.title = r[2] + " (in ATTACKS and CHAT)";
                input.value = f[r[0]].join(", ");
                input.addEventListener("change", function() {
                    f[r[0]] = input.value.split(",").map(function(w) { return w.trim().toLowerCase(); }).filter(Boolean);
                    save(FILTER_KEY, f);
                    applyAll();
                });
                label.appendChild(input);
                box.appendChild(label);
            });
            return box;
        };
    }

    // BAG: the LOOT BOXES cards in the same order SHOP sells them in, so a pinned BAG
    // lines up with SHOP. The site redraws the panel often, so the order is set with
    // CSS (flex order) and set again after every redraw; boxes SHOP doesn't sell go last.
    function bagBoxOrder() {
        var panel = document.getElementById("panel-bag");
        var bridge = document.getElementById("omhp-boss-data");
        if (!panel || !bridge) return false;

        function apply() {
            var order = [];
            try { order = JSON.parse(bridge.dataset.boxOrder || "[]"); } catch (e) { /* keep the site's order */ }
            if (!order.length) return;
            panel.querySelectorAll(".box-row > .box-card").forEach(function(card) {
                var art = card.querySelector("[data-box-odds]");
                var i = art ? order.indexOf(art.dataset.boxOdds) : -1;
                var want = String(i === -1 ? 999 : i);
                if (card.style.order !== want) card.style.order = want;
            });
        }

        new MutationObserver(apply).observe(panel, { childList: true, subtree: true });
        new MutationObserver(apply).observe(bridge, { attributes: true, attributeFilter: ["data-box-order"] });
        apply();
    }

    // Features that couldn't start (the site changed) and page-script imports that failed,
    // shown as "⚠ 2 OFF" in the top bar so nothing disappears without a word.
    var broken = [];

    function healthCheck() {
        var bar = document.getElementById("statusline");
        var bridge = document.getElementById("omhp-boss-data");
        if (!bar) return;
        var span = document.createElement("span");
        span.className = "omhp-health";
        var added = false;

        function paint() {
            var parts = broken.slice();
            if (bridge && bridge.dataset.fail) parts = parts.concat(bridge.dataset.fail.split(", "));
            if (!parts.length) return;
            span.textContent = "⚠ " + parts.length + " OFF";
            span.title = "OMHP Toolkit couldn't start: " + parts.join(", ") + " (the site may have changed)";
            if (!added) {
                addToBar(bar, span);
                added = true;
            }
        }

        if (bridge) new MutationObserver(paint).observe(bridge, { attributes: true, attributeFilter: ["data-fail"] });
        paint();
    }

    function moveSections() {
        // Start a feature if it's on; note it if it can't find what it needs
        function run(name, fn) {
            if (!isOn(name)) return;
            try {
                if (fn() === false) broken.push(name.toUpperCase());
            } catch (e) {
                broken.push(name.toUpperCase());
                console.error("OMHP Toolkit:", name, e);
            }
        }

        pinMain();
        paintAccount(); // always: it also publishes the boss data (see trueBoss)
        run("graph", bossGraph);
        run("eta", bossEta);
        run("share", damageShare);
        run("session", sessionStats);
        run("full", attackTimer);
        toolkitMenu();
        run("clock", clock);
        run("flattabs", shortTabs);
        run("title", tabTitle);
        run("notify", notifier);
        run("keys", shortcuts);
        run("filters", lineFilters);
        run("boxorder", bagBoxOrder);
        pinPanel();
        floatingPanels();
        run("loot", lootLog);
        run("bosses", bossLog);
        healthCheck();
        var columns = document.querySelector("#app .columns");
        if (!columns) return;
        for (var i = 0; i < SECTIONS.length; i++) {
            if (!document.getElementById(SECTIONS[i].panel)) return;
        }

        // Saved order from the up/down arrows; sections it doesn't know go last
        var order = (function() {
            try { return JSON.parse(localStorage.getItem(ORDER_KEY)) || []; } catch (e) { return []; }
        })();
        var rank = function(info) {
            var i = order.indexOf(info.key);
            return i === -1 ? order.length + SECTIONS.indexOf(info) : i;
        };
        var sections = SECTIONS.slice().sort(function(a, b) { return rank(a) - rank(b); });

        var collapsed = loadSaved(STORE_KEY);
        var heights = loadSaved(HEIGHTS_KEY);
        var col = document.createElement("section");
        col.id = "col-left";
        col.className = "col-left box";
        col.setAttribute("aria-label", "Feed, chat and messages");

        var panels = [];
        sections.forEach(function(info) {
            // Look the panel up before it moves: getElementById can't find it
            // inside the new column until that column is on the page.
            panels.push(document.getElementById(info.panel));
            col.appendChild(buildSection(info, collapsed, heights));
        });
        columns.insertBefore(col, columns.firstChild);
        columnResizers();

        // The site's tab code hides these panels whenever another tab is picked;
        // keep them showing so the site also treats them as open.
        var keepShown = new MutationObserver(function() {
            panels.forEach(function(p) { if (p.hidden) p.hidden = false; });
            fixRightPanel();
        });
        panels.forEach(function(p) {
            keepShown.observe(p, { attributes: true, attributeFilter: ["hidden"] });
            p.hidden = false;
        });

        // Jump to the newest chat messages once it's in place
        var list = document.getElementById("chat-list");
        if (list) list.scrollTop = list.scrollHeight;

        // Let the tab code restore the remembered tab first. Messages only load
        // when their tab is picked, so pick it once, then move the right side on.
        whenReady(500, tabsReady, function() {
            var dms = tabButton("dms");
            if (dms && !dms.hidden) dms.click();
            fixRightPanel();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", moveSections);
    } else {
        moveSections();
    }
})();
