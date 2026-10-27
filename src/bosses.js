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
        var evs = Object.keys(x.events || {}).map(function(k) { return eventLabel(k) + (x.events[k] > 1 ? " ×" + x.events[k] : ""); });
        if (evs.length) bits.push(evs.join(", "));
        m.appendChild(document.createTextNode(" · " + bits.join(" · ")));
        if (graphs[x.seq]) {
            var g = resetButton("this boss's HP graph, in a window", function() { openBossGraph(x.seq, x.name); });
            g.textContent = "[GRAPH]";
            m.appendChild(g);
        }
        li.appendChild(m);
        li.title = new Date(x.start).toLocaleString() + " to " + new Date(x.end).toLocaleString() +
            (x.killed ? "" : "\n(you weren't watching when it ended)") + phaseLines(x.ph);
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
                if (cur.all > 0 && cur.mine > 0) bumpRecord("share", cur.mine / cur.all * 100, { seq: cur.seq, name: cur.name });
                delete cur.me;
                delete cur.lastEv;
                all.unshift(cur);
                save(KEY, all.slice(0, MAX));
            }
            cur = null;
            redraw();
        }
        if (!cur) cur = { seq: b.seq, name: b.name || "", start: now, end: now, mine: 0, all: 0, peak: 0, healed: 0, killed: false, events: {}, ph: {} };
        cur.end = now;
        if (b.name) cur.name = b.name;
        var mine = numberIn(document.getElementById("boss-dmg"));
        if (mine !== null && mine >= cur.mine) cur.mine = mine;
        if (typeof b.dmg === "number") cur.all = Math.max(cur.all, b.dmg);
        cur.peak = Math.max(cur.peak, numberIn(document.getElementById("st-online")) || 0);
        if (typeof b.dmg === "number" && b.max) cur.healed = Math.max(cur.healed, b.dmg - (b.max - b.hp));
        if (b.alive === false) cur.killed = true;
        // The world events this boss had (each counted once), and your damage, hits and time in
        // each phase: what your lifetime totals rose by since the last look, put on this phase
        if (!cur.events) cur.events = {};
        if (!cur.ph) cur.ph = {};
        var ev = b.event;
        if (ev && ev.kind && ev.kind + ":" + ev.id !== cur.lastEv) {
            cur.lastEv = ev.kind + ":" + ev.id;
            cur.events[ev.kind] = (cur.events[ev.kind] || 0) + 1;
        }
        var t = myTotals();
        if (t && cur.me && t.dmg >= cur.me.dmg) {
            var p = cur.ph[b.phase || 0] = cur.ph[b.phase || 0] || [0, 0, 0];
            p[0] += t.dmg - cur.me.dmg;
            p[1] += Math.max(0, t.hits - cur.me.hits);
            p[2] += Math.min(60000, now - cur.me.t);
        }
        if (t) cur.me = { dmg: t.dmg, hits: t.hits, t: now };
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

// Your damage on a boss by phase, a line each: "PHASE II  45,000 dmg · 120 hits · 12m"
function phaseLines(ph) {
    return Object.keys(ph || {}).sort(function(a, b) { return a - b; }).map(function(k) {
        var p = ph[k];
        return "\n" + (Number(k) ? "PHASE " + ROMAN[k] : "NO PHASE") + "  " + fmt(p[0]) + " dmg · " + fmt(p[1]) + " hits · " + dur(p[2] / 60000);
    }).join("");
}
