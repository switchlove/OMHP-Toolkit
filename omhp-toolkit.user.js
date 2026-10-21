// ==UserScript==
// @name         OMHP Toolkit
// @namespace    https://github.com/switchlove/OMHP-Toolkit
// @version      0.17
// @description  Wider three-column layout, pop-out panels, boss HP graph and ETA, session/loot stats, and colour themes for One Million HP
// @author       switchlove
// @homepageURL  https://github.com/switchlove/OMHP-Toolkit
// @supportURL   https://github.com/switchlove/OMHP-Toolkit/issues
// @updateURL    https://raw.githubusercontent.com/switchlove/OMHP-Toolkit/main/omhp-toolkit.user.js
// @downloadURL  https://raw.githubusercontent.com/switchlove/OMHP-Toolkit/main/omhp-toolkit.user.js
// @match        https://onemillionhp.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=onemillionhp.com
// @grant        none
// ==/UserScript==

// What this does:
//
// LAYOUT
//   - Widens the page to three columns: feed/chat/messages | boss | side panels.
//     Under 1300px wide the left column drops below everything else.
//   - Left column: ATTACKS, CHAT, MESSAGES and LOOT sections. Each one collapses,
//     moves up/down, pops out, and resizes by dragging its bottom edge.
//   - Drag the gaps between columns to resize them. Double-click any drag handle to reset.
//   - The boss column and the right column stay pinned in view while you scroll.
//   - Right column: a flat tab bar (every unlocked tab as a button, short labels, no
//     dropdowns). [PIN] keeps the open panel above the others. [POP OUT] opens it
//     in a floating window.
//   - Floating windows can be dragged, resized, minimised and faded, and you can
//     have several open at once.
//   - Hides the clutter: the duplicate MESSAGES heading, the key hints and the
//     footer (the site's error line stays).
//
// BOSS
//   - An ASCII HP graph next to the boss art, covering the boss's whole life since
//     you first saw it (kept across reloads). It marks heals, phase changes and
//     players online, and hovering shows the readout for that moment.
//   - Under the HP: HP/min, everyone's DMG/min, HP healed, and an estimated kill time.
//   - During the FOG event it uses the site's real data and never records the fake HP.
//
// FIGHT
//   - YOUR SHARE: your percentage of all the damage on this boss.
//   - SESSION: damage since the page opened, per hour, best hit, average hit, crit rate.
//   - FULL IN: time until every attack slot has refilled.
//   - LOOT: what you found this session, counted by rarity.
//
// TOP BAR
//   - [COLOUR]: highlight colour and full themes (TERMINAL, MIDNIGHT, PHOSPHOR, PAPER).
//   - Local time and how long the page has been open.
//   - The account button shows your badges and name instead of [LOGIN].
//
// Your layout, sizes, order, colours and HP history are saved in localStorage.

(function() {
    var LEFT_TABS = ["feed", "chat", "both", "dms"];
    var SECTIONS = [
        { key: "feed", panel: "panel-feed", title: "ATTACKS", scroller: "#feed" },
        { key: "chat", panel: "panel-chat", title: "CHAT", scroller: "#chat-list" },
        { key: "dms", panel: "panel-dms", title: "MESSAGES", scroller: "#panel-dms" },
        { key: "loot", panel: "omhp-loot", title: "LOOT", scroller: "#omhp-loot-list" } // built by lootLog()
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

        /* Flat tab bar: every unlocked tab as a button, no dropdowns */
        #tabs .tab-cat { display: none; }
        #tabs .tab-group { position: static; display: contents; }
        #tabs .tab-menu, #tabs .tab-menu[hidden] {
            display: flex !important; position: static; transform: none; flex-direction: row; flex-wrap: wrap;
            align-items: center; min-width: 0; padding: 0; margin: 0; background: none; border: 0; box-shadow: none;
        }
        #tabs .tab-menu button { padding: 2px 3px; font-size: 11px; letter-spacing: 0; }
        /* Short labels (see shortTabs): hide the site's text, show data-short instead */
        #tabs .tab-menu [role=tab][data-short] { font-size: 0; }
        #tabs .tab-menu [role=tab][data-short]::before { content: attr(data-short); font-size: 11px; }
        #tabs .tab-menu button.has-new:not([aria-selected="true"]) { color: var(--amber); }
        #tabs .tab-menu .tab-link { display: none; }
        /* One line per section (WORLD / YOU / LEADERBOARD / GAME); [PIN] [POP OUT] share the last */
        #tabs .tab-menu, #tabs .tab-menu[hidden] { flex: 0 0 100%; justify-content: center; }

        /* Boss kill ETA, HP sparkline, session damage, attacks-full timer */
        #omhp-eta { font-size: 12px; letter-spacing: .08em; margin-top: 2px; }

        /* Boss area split: ASCII art left, HP graph right */
        #omhp-boss-split { display: flex; gap: 10px; align-items: center; }
        #omhp-boss-split > #boss-stage { flex: 1 1 0; min-width: 0; }
        #omhp-graph { flex: 1 1 0; min-width: 0; text-align: left; overflow: hidden; }
        #omhp-graph-head { font-size: 11px; color: var(--dim); letter-spacing: .04em; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; white-space: nowrap; }
        #omhp-graph-plot { margin: 0; font-size: 11px; line-height: 1; letter-spacing: 0; white-space: pre; color: var(--faint); }
        #omhp-graph-plot .line { color: var(--red); }
        #omhp-graph-plot .fill { color: var(--red); opacity: .35; }
        #omhp-graph-plot .heal { color: var(--mythic); }
        #omhp-graph-plot .mark { color: var(--amber); }
        #omhp-graph-plot .online { color: var(--blue); }
        #omhp-graph { position: relative; }
        #omhp-graph-plot { cursor: crosshair; }
        #omhp-graph-cursor {
            position: absolute; width: 1px; background: var(--fg); opacity: .4; pointer-events: none;
        }
        #omhp-graph-tip {
            position: absolute; z-index: 2; pointer-events: none; white-space: pre;
            padding: 3px 6px; background: var(--bg-2); border: 1px solid var(--dim);
            color: var(--fg); font-size: 11px; line-height: 1.35; letter-spacing: .03em;
        }
        #omhp-graph-cursor[hidden], #omhp-graph-tip[hidden] { display: none; }
        #omhp-session .val { color: var(--fg); }

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
        #omhp-loot-list { max-height: none; height: 140px; overflow-y: auto; }

        /* Pinned right panel: on top, scrolls on its own; the tab bar switches the one below */
        #omhp-pinned {
            flex: 0 1 auto; max-height: 45%; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin;
            margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed var(--faint);
        }
        #omhp-pinned > .panel { min-height: 0; }
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

        /* Accent colour picker */
        .omhp-accent-wrap { position: relative; display: inline-block; }
        .omhp-swatches { display: flex; gap: 6px; }
        .omhp-themes { display: flex; gap: 8px; white-space: nowrap; }
        .omhp-theme { font-size: 11px; color: var(--dim); }
        .omhp-theme.on { color: var(--fg); text-decoration: underline; }
        .omhp-accent-pop {
            position: absolute; top: calc(100% + 6px); right: 0; z-index: 50;
            display: flex; flex-direction: column; gap: 8px;
            padding: 6px 8px; background: var(--bg-2); border: 1px solid var(--dim); box-shadow: 0 6px 18px rgba(0,0,0,.6);
        }
        .omhp-accent-pop[hidden] { display: none; }
        .omhp-swatch {
            width: 18px; height: 18px; padding: 0; border: 1px solid var(--faint); cursor: pointer;
        }
        .omhp-swatch.on { outline: 2px solid var(--fg); outline-offset: 1px; }
        .foot { margin-top: 8px; }
        .foot > p:not(#err) { display: none; }
    `;

    var style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    function loadSaved(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || {};
        } catch (e) {
            return {};
        }
    }

    function save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            /* ignore */
        }
    }

    function loadAccent() {
        try {
            return JSON.parse(localStorage.getItem(ACCENT_KEY));
        } catch (e) {
            return null;
        }
    }

    function applyAccent(hex) {
        if (hex) document.documentElement.style.setProperty("--amber", hex);
        else document.documentElement.style.removeProperty("--amber");
    }

    function loadTheme() {
        try {
            return JSON.parse(localStorage.getItem(THEME_KEY));
        } catch (e) {
            return null;
        }
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
    applyTheme(loadTheme());
    applyAccent(loadAccent());

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
            phase: ph ? ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"].indexOf(ph[1]) : null,
            dmg: numberIn(document.getElementById("g-damage")), alive: true
        };
    }

    // The site's own flag while the FOG world event is faking the HP readout
    function fogged() {
        var bar = document.getElementById("hp-bar");
        return !!(bar && bar.classList.contains("fogged"));
    }

    // 1234567 -> "1.2M", 243000 -> "243K"
    function short(n) {
        if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M";
        if (n >= 1e3) return Math.round(n / 1e3) + "K";
        return String(n);
    }

    function numberIn(el) {
        var m = el && (el.textContent || "").replace(/,/g, "").match(/\d+/);
        return m ? Number(m[0]) : null;
    }

    function fmt(n) {
        return Math.round(n).toLocaleString("en-US");
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

    // The right-hand panel would be empty while one of the moved tabs is selected,
    // so switch it to the first other tab that's unlocked.
    function fixRightPanel() {
        var selected = document.querySelector('#tabs [role=tab][aria-selected="true"]');
        if (selected && LEFT_TABS.indexOf(selected.dataset.tab) === -1) return;
        var tabs = document.querySelectorAll("#tabs [role=tab]");
        for (var i = 0; i < tabs.length; i++) {
            if (!tabs[i].hidden && LEFT_TABS.indexOf(tabs[i].dataset.tab) === -1) {
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

        var btn = tabButton(info.key);
        if (btn) new MutationObserver(paint).observe(btn, { childList: true, characterData: true, subtree: true });

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
        if (!main || !document.getElementById("acct")) return;
        var v = new URL(main.src).search;
        var base = new URL("./", main.src).href; // the folder main.js is in

        var code = `
            Promise.all([import(${JSON.stringify(base + "store.js" + v)}), import(${JSON.stringify(base + "ui/badges.js" + v)})])
                .then(([store, badges]) => {
                    const acct = document.getElementById("acct");
                    let watcher = null;
                    const paint = () => {
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
                    watcher = new MutationObserver(paint);
                    watcher.observe(acct, { childList: true, characterData: true, subtree: true });
                    store.on("me", paint);
                    paint();

                    // The boss's real numbers for the rest of the script. During the FOG world
                    // event the site draws fake HP on screen, but its own data stays true.
                    const out = document.getElementById("omhp-boss-data");
                    const publish = () => {
                        const b = store.state.boss;
                        if (!out || !b) return;
                        out.dataset.boss = JSON.stringify({
                            seq: b.seq, hp: b.hp, max: b.max_hp, phase: b.phase,
                            dmg: b.total_damage, alive: b.status === "alive"
                        });
                    };
                    store.on("boss", publish);
                    setInterval(publish, 2000);
                    publish();
                })
                .catch(() => { /* the site changed its files; leave the button as it is */ });
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

    // Under the HP numbers: how fast the boss is losing HP and when it should die.
    function bossEta() {
        var phase = document.getElementById("phase");
        var hpNow = document.getElementById("hp-now");
        if (!phase || !hpNow) return;
        var line = document.createElement("div");
        line.id = "omhp-eta";
        line.className = "phase dim";
        phase.insertAdjacentElement("afterend", line);

        var RATE_MS = 5 * 60 * 1000;
        var samples = [];
        var bossNum = null;

        function sample() {
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

            var first = samples[0];
            var minutes = (now - first.t) / 60000;
            if (minutes < 0.5) {
                line.textContent = "MEASURING…";
                return;
            }
            var perMin = (first.hp - hp) / minutes;
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
            var mins = Math.round(hp / perMin);
            var h = Math.floor(mins / 60), m = mins % 60;
            line.textContent = "≈ " + fmt(perMin) + " HP/MIN" + dps + " · DOWN IN ~" +
                (h ? h + "h " + String(m).padStart(2, "0") + "m" : m + "m");
        }

        sample();
        setInterval(sample, 5000);
    }

    // Split the boss area: the ASCII art on the left, an ASCII graph of the boss's HP
    // on the right covering its whole life since you first saw it (kept across reloads).
    function bossGraph() {
        var stage = document.getElementById("boss-stage");
        var hpNow = document.getElementById("hp-now");
        var hpMax = document.getElementById("hp-max");
        if (!stage || !hpNow) return;
        var KEY = "omhp.layout.hp";
        var MAX_POINTS = 3000;

        var split = document.createElement("div");
        split.id = "omhp-boss-split";
        stage.insertAdjacentElement("beforebegin", split);
        split.appendChild(stage);
        var pane = document.createElement("div");
        pane.id = "omhp-graph";
        var head = document.createElement("div");
        head.id = "omhp-graph-head";
        var plot = document.createElement("pre");
        plot.id = "omhp-graph-plot";
        pane.appendChild(head);
        pane.appendChild(plot);
        split.appendChild(pane);
        // The art sizes itself to its box on window resize; its box just got narrower
        window.dispatchEvent(new Event("resize"));

        var store = loadSaved(KEY);
        // Histories saved before v0.15 may hold fake HP from the FOG event: start them over
        if (store.v !== 2) store = {};
        var boss = store.boss || null;
        var points = Array.isArray(store.s) ? store.s : []; // [time, hp, phase, online]
        var maxHp = null;
        var ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

        function persist() {
            save(KEY, { v: 2, boss: boss, s: points });
        }

        // Hover readout: a cursor line on the column under the pointer and a small box with
        // the time, HP, phase and players online there
        var view = null, hoverX = null;
        var cursor = document.createElement("div");
        cursor.id = "omhp-graph-cursor";
        cursor.hidden = true;
        var tip = document.createElement("div");
        tip.id = "omhp-graph-tip";
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
            // Nothing past the last real reading (e.g. while FOG has paused the graph)
            if (c < 0 || c >= view.cols || view.vals[c] === null || colStart > view.lastT) return hideHover();
            var x = pr.left - box.left + (view.label + 1 + c + 0.5) * view.cw;
            cursor.style.left = Math.round(x) + "px";
            cursor.style.top = Math.round(pr.top - box.top) + "px";
            cursor.style.height = Math.round(view.rows * view.lineH) + "px";
            cursor.hidden = false;

            var t = Math.min(view.t0 + view.span * (c + 1) / view.cols, view.lastT);
            var hp = view.vals[c];
            var lines = [
                new Date(t).toTimeString().slice(0, 5),
                fmt(hp) + " HP (" + (hp / view.max * 100).toFixed(1) + "%)"
            ];
            if (view.phases[c]) lines.push("PHASE " + ROMAN[view.phases[c]]);
            if (view.online[c] !== null) lines.push(view.online[c] + " online");
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

        function sample() {
            // FOG hides the boss's HP on purpose: record nothing meanwhile (the line just
            // carries the last real value across, and the change shows once it clears)
            if (fogged()) return draw();
            var b = trueBoss();
            if (!b) return;
            var num = String(b.seq);
            if (num !== boss) {
                boss = num;
                points = [];
            }
            if (b.max) maxHp = b.max;
            points.push([Date.now(), b.hp, b.phase || null, numberIn(document.getElementById("st-online"))]);
            // Long fights: thin out the older half instead of dropping the start
            if (points.length > MAX_POINTS) {
                points = points.filter(function(p, i) { return i % 2 === 0 || i === points.length - 1; });
            }
            draw();
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
            var mins = Math.round(ms / 60000);
            if (mins < 60) return mins + "m";
            var h = Math.floor(mins / 60);
            return h + "h " + String(mins % 60).padStart(2, "0") + "m";
        }

        function draw() {
            var max = maxHp || numberIn(hpMax) || Math.max.apply(null, points.map(function(p) { return p[1]; }).concat([1]));
            var lineH = parseFloat(getComputedStyle(plot).lineHeight) || 11;
            // As tall as the art beside it, less the heading and the time axis
            var rows = Math.max(8, Math.min(32, Math.floor((stage.offsetHeight - head.offsetHeight - 3 * lineH) / lineH)));
            var LABEL = 5;
            var cw = charWidth();
            var cols = Math.max(10, Math.floor(pane.clientWidth / cw) - LABEL - 1);
            if (points.length < 2) {
                head.textContent = "HP · COLLECTING…";
                plot.textContent = "";
                view = null;
                hideHover();
                return;
            }

            var t0 = points[0][0], t1 = Date.now();
            var span = Math.max(1, t1 - t0);
            // Last reading in each column; gaps carry the previous value forward
            var vals = [], phases = [], online = [];
            var j = 0, last = null, lastPhase = null, lastOnline = null;
            for (var c = 0; c < cols; c++) {
                var end = t0 + span * (c + 1) / cols;
                while (j < points.length && points[j][0] <= end) {
                    last = points[j][1];
                    if (points[j][2]) lastPhase = points[j][2];
                    if (points[j][3] != null) lastOnline = points[j][3];
                    j++;
                }
                vals.push(last);
                phases.push(lastPhase);
                online.push(lastOnline);
            }
            var maxOnline = Math.max.apply(null, online.filter(function(n) { return n !== null; }).concat([0]));
            // A column higher than the one before it is a heal; a new phase gets a marker
            var heal = [], mark = [];
            for (var c1 = 0; c1 < cols; c1++) {
                heal.push(c1 > 0 && vals[c1] !== null && vals[c1 - 1] !== null && vals[c1] > vals[c1 - 1]);
                mark.push(c1 > 0 && phases[c1] && phases[c1 - 1] && phases[c1] !== phases[c1 - 1] ? phases[c1] : 0);
            }
            // The new phase's numeral reads across the top row, starting at its marker
            var topText = {};
            mark.forEach(function(ph, c3) {
                if (!ph) return;
                for (var k = 0; k < ROMAN[ph].length; k++) topText[c3 + k] = ROMAN[ph].charAt(k);
            });

            // Plain ASCII, like the site's own HP graph, so every character is in its font:
            // the line sits low/middle/high in its row as ' - .  with a dotted fill below,
            // | for drops (and heals) taller than a row, ^ for a heal, : for a phase change.
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
                for (var fr = 0; fr < y; fr++) grid[fr][c2] = { ch: ".", cls: "fill" };
                var from = prevY === null ? y : prevY;
                for (var vr = Math.min(y, from) + 1; vr < Math.max(y, from); vr++) grid[vr][c2] = { ch: "|", cls: lineCls };
                grid[y][c2] = { ch: heal[c2] ? "^" : Math.abs(exact - y) < 0.17 ? "-" : frac < 0.5 ? "'" : ".", cls: lineCls };
                if (mark[c2]) {
                    for (var mr = y + 1; mr < rows; mr++) if (grid[mr][c2].ch === " ") grid[mr][c2] = { ch: ":", cls: "mark" };
                }
                prevY = y;
            }
            // The new phase's numeral reads across the top row, starting at its marker
            // Players online, on its own 0..peak scale: * over the empty space and the dotted fill
            if (maxOnline > 0) {
                for (var oc = 0; oc < cols; oc++) {
                    if (online[oc] === null) continue;
                    var oy = Math.round(online[oc] / maxOnline * (rows - 1));
                    var under = grid[oy][oc];
                    if (under.cls === null || under.cls === "fill" || under.cls === "mark") grid[oy][oc] = { ch: "*", cls: "online" };
                }
            }
            Object.keys(topText).forEach(function(k) {
                var cell = grid[rows - 1][k];
                if (cell && (cell.ch === " " || cell.cls === "mark")) grid[rows - 1][k] = { ch: topText[k], cls: "mark" };
            });

            var frag = document.createDocumentFragment();
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
                frag.appendChild(document.createTextNode("\n"));
            }
            frag.appendChild(document.createTextNode(" ".repeat(LABEL) + "+" + "-".repeat(cols) + "\n"));
            var left = "-" + ago(span), right = "now";
            frag.appendChild(document.createTextNode(" ".repeat(LABEL + 1) + left +
                " ".repeat(Math.max(1, cols - left.length - right.length)) + right + "\n"));
            // Legend
            frag.appendChild(document.createTextNode(" ".repeat(LABEL + 1)));
            [["line", "-"], [null, "hp  "], ["heal", "^"], [null, "heal  "], ["mark", ":"], [null, "phase"]].concat(maxOnline > 0 ? [[null, "  "], ["online", "*"], [null, "online " + maxOnline]] : []).forEach(function(part) {
                if (!part[0]) return frag.appendChild(document.createTextNode(part[1]));
                var sp = document.createElement("span");
                sp.className = part[0];
                sp.textContent = part[1];
                frag.appendChild(sp);
            });
            plot.replaceChildren(frag);
            // What this render shows, for the hover readout
            view = {
                t0: t0, span: span, cols: cols, label: LABEL, rows: rows, cw: cw, lineH: lineH, max: max,
                vals: vals, phases: phases, online: online, lastT: points[points.length - 1][0]
            };
            if (hoverX !== null) showHover(hoverX);

            var since = new Date(t0).toTimeString().slice(0, 5);
            head.textContent = fogged() ? "HP · FOG — PAUSED" : "HP SINCE " + since + " · " + ago(span);
            head.title = "boss #" + boss + "'s HP since you first saw it";
        }

        sample();
        setInterval(sample, 5000);
        setInterval(persist, 30000);
        window.addEventListener("pagehide", persist);
        new ResizeObserver(function() { draw(); }).observe(pane);
    }

    // In FIGHT, under YOUR DMG ON THIS BOSS: your share of everyone's damage on this boss.
    function damageShare() {
        var mine = document.getElementById("boss-dmg");
        var all = document.getElementById("g-damage");
        if (!mine || !all) return;
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
        setInterval(paint, 5000);
        paint();
    }

    // In FIGHT: your damage since this page opened, damage per hour, best hit.
    function sessionStats() {
        var bossDmg = document.getElementById("boss-dmg");
        var lastHit = document.getElementById("last-hit");
        var box = document.querySelector(".lasthit");
        if (!bossDmg || !box) return;
        var line = document.createElement("div");
        line.id = "omhp-session";
        box.appendChild(line);

        var started = Date.now();
        var total = 0, best = 0, hits = 0, crits = 0;
        var prev = null;
        var bossNum = null;

        function paint() {
            var parts = ["SESSION ", val(fmt(total) + " DMG")];
            var hours = (Date.now() - started) / 3600000;
            if (hours >= 1 / 60) parts.push(" · ", val(fmt(total / hours) + "/HR"));
            if (best) parts.push(" · BEST ", val(fmt(best)));
            if (hits) {
                parts.push(" · AVG ", val(fmt(total / hits)));
                parts.push(" · ", val(Math.round(crits / hits * 100) + "%"), " CRIT");
            }
            line.replaceChildren.apply(line, parts);
        }

        // One rise of YOUR DMG = one attack landing. The site draws YOUR LAST HIT in
        // the same update, so read it now to see whether that attack was a crit.
        function countHit() {
            hits++;
            if (lastHit && /CRIT/.test(lastHit.textContent || "")) crits++;
        }

        function val(text) {
            var s = document.createElement("span");
            s.className = "val";
            s.textContent = text;
            return s;
        }

        function readDamage() {
            var numEl = document.getElementById("boss-num");
            var num = numEl ? numEl.textContent : "";
            var dmg = numberIn(bossDmg);
            if (dmg === null) return;
            if (prev === null) {
                prev = dmg; // what you'd already done before opening the page
                bossNum = num;
            } else if (num !== bossNum || dmg < prev) {
                // New boss: its counter started from 0
                bossNum = num;
                total += dmg;
                if (dmg > 0) countHit();
                prev = dmg;
            } else if (dmg > prev) {
                total += dmg - prev;
                countHit();
                prev = dmg;
            }
            paint();
        }

        function readHit() {
            var n = numberIn(lastHit);
            if (n !== null && n > best) {
                best = n;
                paint();
            }
        }

        new MutationObserver(readDamage).observe(bossDmg, { childList: true, characterData: true, subtree: true });
        if (lastHit) new MutationObserver(readHit).observe(lastHit, { childList: true, characterData: true, subtree: true });
        setInterval(readDamage, 2000);
        readDamage();
        readHit();
    }

    // [COLOUR] in the top bar: pick the site's highlight colour.
    function accentPicker() {
        var bar = document.getElementById("statusline");
        if (!bar) return;
        var current = loadAccent() || ACCENTS[0].hex;

        var sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "::";
        var wrap = document.createElement("span");
        wrap.className = "omhp-accent-wrap";
        var btn = document.createElement("button");
        btn.type = "button";
        btn.id = "omhp-accent";
        btn.className = "btn-text";
        btn.textContent = "[COLOUR]";
        btn.title = "highlight colour";
        btn.style.color = "var(--amber)";
        var pop = document.createElement("div");
        pop.className = "omhp-accent-pop";
        pop.hidden = true;
        var swatches = document.createElement("div");
        swatches.className = "omhp-swatches";
        var themes = document.createElement("div");
        themes.className = "omhp-themes";
        pop.appendChild(swatches);
        pop.appendChild(themes);

        // Whole-palette themes
        var currentTheme = loadTheme() || THEMES[0].name;
        THEMES.forEach(function(t) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "btn-text omhp-theme" + (t.name === currentTheme ? " on" : "");
            b.textContent = t.name;
            b.dataset.theme = t.name;
            b.addEventListener("click", function() {
                currentTheme = t.name;
                var stored = t.vars ? t.name : null; // the default is stored as "no override"
                applyTheme(stored);
                save(THEME_KEY, stored);
                themes.querySelectorAll(".omhp-theme").forEach(function(x) {
                    x.classList.toggle("on", x.dataset.theme === currentTheme);
                });
            });
            themes.appendChild(b);
        });

        ACCENTS.forEach(function(a) {
            var s = document.createElement("button");
            s.type = "button";
            s.className = "omhp-swatch" + (a.hex === current ? " on" : "");
            s.style.background = a.hex;
            s.title = a.name;
            s.dataset.hex = a.hex;
            s.addEventListener("click", function() {
                current = a.hex;
                // The default is stored as "no override"
                var stored = a.hex === ACCENTS[0].hex ? null : a.hex;
                applyAccent(stored);
                save(ACCENT_KEY, stored);
                pop.querySelectorAll(".omhp-swatch").forEach(function(x) {
                    x.classList.toggle("on", x.dataset.hex === current);
                });
                pop.hidden = true;
            });
            swatches.appendChild(s);
        });

        btn.addEventListener("click", function(e) {
            e.stopPropagation();
            pop.hidden = !pop.hidden;
        });
        document.addEventListener("click", function(e) {
            if (!wrap.contains(e.target)) pop.hidden = true;
        });

        wrap.appendChild(btn);
        wrap.appendChild(pop);
        // Match the spacing the site puts around its own separators
        bar.appendChild(document.createTextNode(" "));
        bar.appendChild(sep);
        bar.appendChild(document.createTextNode(" "));
        bar.appendChild(wrap);
    }

    // Under "+1 ATTACK IN 0:42": how long until every attack slot has refilled.
    function attackTimer() {
        var resetIn = document.getElementById("reset-in");
        var pips = document.getElementById("pips");
        if (!resetIn || !pips) return;
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

        function tick() {
            var key = (pips.dataset.key || "").split("/"); // "left/per", set by the site
            var left = Number(key[0]), per = Number(key[1]);
            var next = (resetIn.textContent || "").match(/(\d+):(\d\d)/);
            var every = rechargeSeconds();
            if (!per || isNaN(left) || left >= per || !next || !every) {
                line.textContent = "";
                return;
            }
            var secs = Number(next[1]) * 60 + Number(next[2]) + (per - left - 1) * every;
            var h = Math.floor(secs / 3600), m = Math.floor(secs % 3600 / 60), s = secs % 60;
            line.textContent = "FULL IN " + (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
        }

        tick();
        setInterval(tick, 1000);
    }

    // LOOT section for the left column: what you found this session, by rarity.
    // Reads your own new lines in the attack feed (the site marks them li.me).
    function lootLog() {
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

        var counts = {}; // rarity class -> [count, sample element for its colour]
        var started = Date.now();

        function paintSummary() {
            var keys = Object.keys(counts);
            if (!keys.length) {
                summary.textContent = "nothing yet this session";
                return;
            }
            summary.replaceChildren();
            keys.forEach(function(k, i) {
                if (i) summary.appendChild(document.createTextNode("  "));
                var s = document.createElement("span");
                s.className = k;
                s.textContent = counts[k][1] + " x" + counts[k][0];
                summary.appendChild(s);
            });
        }

        function add(li) {
            var tag = li.querySelector('[class^="r-"], [class*=" r-"]');
            var item = document.createElement("li");
            var t = document.createElement("span");
            t.className = "t";
            t.textContent = new Date().toTimeString().slice(0, 5);
            item.appendChild(t);
            var m = document.createElement("span");
            m.className = "m";
            if (tag) {
                m.appendChild(tag.cloneNode(true));
                var rarity = Array.prototype.filter.call(tag.classList, function(c) { return c.indexOf("r-") === 0; })[0];
                var label = (tag.textContent.match(/[A-Z][A-Z ]*[A-Z]/) || [rarity.slice(2).toUpperCase()])[0];
                counts[rarity] = counts[rarity] || [0, label];
                counts[rarity][0]++;
            } else {
                // Boxes and scrolls: keep the line's own wording after your name
                m.textContent = (li.querySelector(".m") || li).textContent.replace(/^.*?\b(found|opened)\b/, "$1");
            }
            if (/auto-sold/.test(li.textContent)) m.appendChild(document.createTextNode(" (sold)"));
            item.appendChild(m);
            list.insertBefore(item, list.firstChild);
            paintSummary();
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

        paintSummary();
        watch();
    }

    // [PIN] in the right column's tab bar: keep the open panel showing above the others.
    function pinPanel() {
        var side = document.querySelector("#app .col-side");
        var tabs = document.getElementById("tabs");
        if (!side || !tabs) return;
        var box = document.createElement("div");
        box.id = "omhp-pinned";
        box.hidden = true;
        tabs.insertAdjacentElement("afterend", box);

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
            save(PIN_KEY, null);
            paint();
        }

        btn.addEventListener("click", function() {
            if (pinned) return unpin();
            var sel = document.querySelector('#tabs [role=tab][aria-selected="true"]');
            if (sel) pin(sel.dataset.tab);
        });

        paint();
        var saved = (function() {
            try { return JSON.parse(localStorage.getItem(PIN_KEY)); } catch (e) { return null; }
        })();
        if (saved) {
            // Load it once by picking its tab, then pin it (after the site restores its own tab)
            setTimeout(function() {
                var t = tabButton(saved);
                if (!t || t.hidden) return;
                var before = document.querySelector('#tabs [role=tab][aria-selected="true"]');
                t.click();
                pin(saved);
                if (before && before !== t) before.click();
            }, 900);
        }
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
            if (!o.left) fixRightPanelExcept(key);
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
        setTimeout(function() {
            Object.keys(store).forEach(function(k) {
                if (store[k] && store[k].open) popOut(k);
            });
        }, 1300);
    }

    // Like fixRightPanel, but also moves off one more tab whose panel has left the column.
    function fixRightPanelExcept(key) {
        var selected = document.querySelector('#tabs [role=tab][aria-selected="true"]');
        if (selected && selected.dataset.tab !== key && LEFT_TABS.indexOf(selected.dataset.tab) === -1) return;
        var tabs = document.querySelectorAll("#tabs [role=tab]");
        for (var i = 0; i < tabs.length; i++) {
            var k = tabs[i].dataset.tab;
            if (!tabs[i].hidden && k !== key && LEFT_TABS.indexOf(k) === -1) {
                tabs[i].click();
                return;
            }
        }
    }

    // Shorter labels on the flat tab bar: "[ AUCTION HOUSE 2 ]" shows as "AUCTION 2".
    // The site's own text is left alone (it rewrites it for counts); CSS shows data-short.
    function shortTabs() {
        var tabs = document.getElementById("tabs");
        if (!tabs) return;
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

        tabs.querySelectorAll(".tab-menu [role=tab]").forEach(function(btn) {
            label(btn);
            new MutationObserver(function() { label(btn); })
                .observe(btn, { childList: true, characterData: true, subtree: true });
        });
    }

    // Local time and how long the page has been open, in the top bar.
    function clock() {
        var bar = document.getElementById("statusline");
        if (!bar) return;
        var sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "::";
        var span = document.createElement("span");
        span.id = "omhp-clock";
        span.className = "dim";
        var started = Date.now();

        function tick() {
            var now = new Date();
            var mins = Math.floor((Date.now() - started) / 60000);
            var open = mins >= 60 ? Math.floor(mins / 60) + "h " + String(mins % 60).padStart(2, "0") + "m" : mins + "m";
            span.textContent = now.toTimeString().slice(0, 5) + " · OPEN " + open;
        }

        bar.appendChild(document.createTextNode(" "));
        bar.appendChild(sep);
        bar.appendChild(document.createTextNode(" "));
        bar.appendChild(span);
        tick();
        setInterval(tick, 15000);
    }

    function moveSections() {
        pinMain();
        paintAccount();
        bossGraph();
        bossEta();
        damageShare();
        sessionStats();
        attackTimer();
        accentPicker();
        clock();
        shortTabs();
        pinPanel();
        floatingPanels();
        lootLog();
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
        setTimeout(function() {
            var dms = tabButton("dms");
            if (dms && !dms.hidden) dms.click();
            fixRightPanel();
        }, 500);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", moveSections);
    } else {
        moveSections();
    }
})();
