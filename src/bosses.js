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

