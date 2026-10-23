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

