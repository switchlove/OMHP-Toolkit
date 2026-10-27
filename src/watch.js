// AUCTION WATCH: [+ THIS SEARCH] above the auction house saves the search you last ran there
// with a top price (up to five). The leader tab has the page script fetch each watched search,
// newest first, every minute (every 3 while the browser tab is in the background). A listing it
// hasn't seen before at or under the price is a match: a notification, a sound (SOUNDS), the
// AUCTION tab lit up until you look, and a line in the list until you [CLEAR] it.
var WATCH_KEY = "omhp.layout.watches";
var WATCH_SEEN_KEY = "omhp.layout.watchSeen"; // listing ids already seen, per watch
var WATCH_HITS_KEY = "omhp.layout.watchHits";
var MAX_WATCHES = 5;

function auctionWatch() {
    var panel = document.getElementById("panel-auction");
    var bridge = document.getElementById("omhp-boss-data");
    if (!panel || !bridge) return false;
    var bar = document.createElement("div");
    bar.className = "omhp-watch";

    // "SWORD · EPIC ≤ 1,200"
    function label(f, max) {
        var bits = [f.q, f.slot, f.rarity, f.effect, f.refined ? "REFINED" : "", f.unowned ? "NOT OWNED" : ""].filter(Boolean);
        return (bits.join(" · ") || "ANYTHING").toUpperCase() + (max ? " ≤ " + fmt(max) : "");
    }

    // The search last run in AUCTION (the page script sees the site ask for it)
    function lastSearch() {
        try { return JSON.parse(bridge.dataset.aucQuery || "{}"); } catch (e) { return {}; }
    }

    function line(cls, text) {
        var d = document.createElement("div");
        d.className = cls;
        if (text) d.textContent = text;
        return d;
    }

    function paint() {
        var watches = loadJSON(WATCH_KEY, []), hits = loadJSON(WATCH_HITS_KEY, []);
        var head = line("omhp-watch-head", "WATCH ");
        var add = resetButton("watch the search you last ran: new listings at or under your price are flagged", addWatch);
        add.textContent = "[+ THIS SEARCH]";
        add.disabled = watches.length >= MAX_WATCHES;
        head.appendChild(add);
        var rows = [head];
        if (!watches.length) rows.push(line("omhp-watch-row dim", "search below, then + THIS SEARCH to hear about new listings"));
        watches.forEach(function(w) {
            var row = line("omhp-watch-row", label(w.f || {}, w.max));
            var del = resetButton("stop watching this", function() {
                save(WATCH_KEY, loadJSON(WATCH_KEY, []).filter(function(x) { return x.id !== w.id; }));
                paint();
            });
            del.textContent = "×";
            row.appendChild(del);
            rows.push(row);
        });
        if (hits.length) {
            var hh = line("omhp-watch-head", "NEW LISTINGS ");
            var clear = resetButton("clear this list", function() {
                save(WATCH_HITS_KEY, []);
                paint();
            });
            clear.textContent = "[CLEAR]";
            hh.appendChild(clear);
            rows.push(hh);
            hits.forEach(function(h) {
                var row = line("omhp-watch-row");
                var name = document.createElement("span");
                if (h.rarity) name.className = "r-" + h.rarity;
                name.textContent = h.name;
                row.appendChild(document.createTextNode(hhmm(h.t) + "  "));
                row.appendChild(name);
                row.appendChild(document.createTextNode((h.count > 1 ? " ×" + h.count : "") + " for " + fmt(h.price)));
                rows.push(row);
            });
        }
        bar.replaceChildren.apply(bar, rows);
    }

    function addWatch() {
        var f = lastSearch();
        var max = Number(String(prompt("New listings of " + label(f) + " at or under what price?") || "").replace(/[^\d]/g, ""));
        if (!max) return;
        var watches = loadJSON(WATCH_KEY, []);
        if (watches.length >= MAX_WATCHES) return;
        // Not yet primed: the first look only notes what's listed already
        watches.push({ id: Date.now().toString(36), f: f, max: max, primed: false });
        save(WATCH_KEY, watches);
        paint();
        poll();
    }

    var lastPoll = 0;
    function poll() {
        var watches = loadJSON(WATCH_KEY, []);
        if (!watches.length || !isLeader()) return;
        lastPoll = Date.now();
        document.dispatchEvent(new CustomEvent("omhp-watch-poll", {
            detail: JSON.stringify(watches.map(function(w) { return { id: w.id, f: w.f }; }))
        }));
    }
    every(15000, function() {
        if (Date.now() - lastPoll >= (document.hidden ? 180000 : 60000) - 1000) poll();
    });

    // AUCTION lit up while there are matches you haven't looked at
    function lit(on) {
        var tab = tabButton("auction");
        if (tab) tab.classList.toggle("omhp-watch-lit", on);
    }

    document.addEventListener("omhp-watch-result", function(e) {
        var r;
        try { r = JSON.parse(e.detail); } catch (err) { return; }
        var watches = loadJSON(WATCH_KEY, []);
        var w = watches.filter(function(x) { return x.id === r.id; })[0];
        if (!w) return;
        var seen = loadSaved(WATCH_SEEN_KEY), before = seen[w.id] || [];
        var fresh = r.listings.filter(function(l) { return before.indexOf(l.id) === -1; });
        if (w.primed) {
            var found = fresh.filter(function(l) { return l.price <= w.max; });
            if (found.length) {
                var hits = loadJSON(WATCH_HITS_KEY, []);
                found.forEach(function(l) { hits.unshift({ t: Date.now(), name: l.name, rarity: l.rarity, price: l.price, count: l.count }); });
                save(WATCH_HITS_KEY, hits.slice(0, 20));
                notify("Auction: " + found[0].name + " for " + fmt(found[0].price) + (found.length > 1 ? " (+" + (found.length - 1) + " more)" : ""));
                playSound("watch");
                lit(true);
                paint();
            }
        } else {
            w.primed = true;
            save(WATCH_KEY, watches);
        }
        seen[w.id] = before.concat(fresh.map(function(l) { return l.id; })).slice(-200);
        Object.keys(seen).forEach(function(k) {
            if (!watches.some(function(x) { return x.id === k; })) delete seen[k];
        });
        save(WATCH_SEEN_KEY, seen);
    });

    // The site redraws the panel from scratch, so the list goes back on top after each redraw;
    // AUCTION on screen means you've seen the matches
    function place() {
        if (bar.parentNode !== panel || panel.firstChild !== bar) panel.insertBefore(bar, panel.firstChild);
        if (!panel.hidden && panel.offsetParent) lit(false);
    }
    observeBatched(panel, { childList: true }, place);
    observeBatched(panel, { attributes: true, attributeFilter: ["hidden"] }, place);
    window.addEventListener("storage", function(e) {
        if (e.key === WATCH_KEY || e.key === WATCH_HITS_KEY) paint();
        if (e.key === WATCH_HITS_KEY && loadJSON(WATCH_HITS_KEY, []).length) lit(true);
    });
    paint();
    place();
}
