// Split the boss area: the ASCII art on the left, an ASCII graph of the boss's HP
// on the right covering its whole life since you first saw it (kept across reloads).
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
    var head = document.createElement("div");
    head.id = "omhp-graph-head";
    var headText = document.createElement("span");
    head.appendChild(headText);
    // [REPLAY]: play the saved history back from the start over 10 seconds
    var replayBtn = document.createElement("button");
    replayBtn.type = "button";
    replayBtn.className = "btn-text omhp-replay";
    replayBtn.textContent = "[REPLAY]";
    replayBtn.title = "play this boss's HP history back from the start";
    head.appendChild(replayBtn);
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
    var points = Array.isArray(store.s) ? store.s : []; // [time, hp, phase, online, your lifetime damage]
    var fog = Array.isArray(store.f) ? store.f : []; // [start, end] of each FOG while you watched
    var maxHp = null;

    var leading = false; // this tab records the history (see isLeader)

    // What the graph shows; click a legend entry to switch it (remembered)
    var SHOW_KEY = "omhp.layout.graphShow";
    var show = Object.assign({ fill: true, heal: true, phase: true, online: true, mine: true, fog: true }, loadSaved(SHOW_KEY));

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
        if (points.length < 2) return;
        var start = points[0][0], end = Date.now(), began = Date.now();
        replayBtn.textContent = "[STOP]";
        replayTimer = setInterval(function() {
            var k = Math.min(1, (Date.now() - began) / 10000);
            replayAt = start + (end - start) * k;
            draw();
            if (k >= 1) stopReplay();
        }, 80);
    });

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
        // Nothing past the last real reading, unless it's FOG still going on
        if (c < 0 || c >= view.cols || view.vals[c] === null || colStart > view.lastT && !view.fogCols[c]) return hideHover();
        var x = pr.left - box.left + (view.label + 1 + c + 0.5) * view.cw;
        cursor.style.left = Math.round(x) + "px";
        cursor.style.top = Math.round(pr.top - box.top) + "px";
        cursor.style.height = Math.round(view.rows * view.lineH) + "px";
        cursor.hidden = false;

        var colEnd = view.t0 + view.span * (c + 1) / view.cols;
        var t = view.fogCols[c] ? Math.min(colEnd, Date.now()) : Math.min(colEnd, view.lastT);
        var hp = view.vals[c];
        var lines = [
            new Date(t).toTimeString().slice(0, 5),
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
        save(SHOW_KEY, show);
        draw();
    });

    function sample() {
        // FOG hides the boss's HP on purpose: record only that it's on (the line carries
        // the last real value across, shaded, and the change shows once it clears)
        if (fogged()) {
            leading = isLeader();
            if (leading) markFog();
            if (!document.hidden) draw();
            return;
        }
        var b = trueBoss();
        if (!b) return;
        if (b.max) maxHp = b.max;
        leading = isLeader();
        // Another tab records; its saves arrive through the storage event below
        if (!leading) {
            if (!document.hidden) draw();
            return;
        }
        var num = String(b.seq);
        if (num !== boss) {
            boss = num;
            points = [];
            fog = [];
        }
        var me = myTotals();
        points.push([Date.now(), b.hp, b.phase || null, numberIn(document.getElementById("st-online")), me ? me.dmg : null]);
        // Long fights: thin out the older half instead of dropping the start
        points = thinPoints(points, MAX_POINTS);
        // Keep recording in a background tab, but only draw what can be seen
        if (!document.hidden) draw();
    }

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
        var max = maxHp || numberIn(hpMax) || Math.max.apply(null, points.map(function(p) { return p[1]; }).concat([1]));
        if (cw === null) measure();
        // As tall as the art beside it, less the heading and the time axis
        var rows = Math.max(8, Math.min(32, Math.floor((stage.offsetHeight - head.offsetHeight - 3 * lineH) / lineH)));
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

        var t0 = points[0][0], t1 = Date.now();
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
        var left = "-" + ago(span), right = "now";
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
                var mark = document.createElement("span");
                if (on) mark.className = item[1];
                mark.textContent = item[2];
                entry.appendChild(mark);
                entry.appendChild(document.createTextNode(" " + item[3]));
                frag.appendChild(entry);
            });
        plot.replaceChildren(frag);
        // What this render shows, for the hover readout
        view = {
            t0: t0, span: span, cols: cols, label: LABEL, rows: rows, cw: cw, lineH: lineH, max: max,
            vals: vals, phases: phases, online: online, mine: mine, fogCols: fogCols, lastT: Math.min(cutoff, points[points.length - 1][0])
        };
        if (hoverX !== null) showHover(hoverX);

        var since = new Date(t0).toTimeString().slice(0, 5);
        headText.textContent = replayAt !== null ? "REPLAY · " + new Date(replayAt).toTimeString().slice(0, 5) + " · " + ago(replayAt - t0) + " in"
            : fogged() ? "HP · FOG — PAUSED" : "HP SINCE " + since + " · " + ago(span);
        head.title = "boss #" + boss + "'s HP since you first saw it";
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
        if (!document.hidden) draw();
    });
    new ResizeObserver(function() {
        measure();
        draw();
    }).observe(pane);
    document.addEventListener("visibilitychange", function() {
        if (!document.hidden) draw();
    });
}

