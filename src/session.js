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

// In FIGHT: your damage today, damage per hour while the game was open, best hit, average
// hit, crit rate. Kept across reloads and shared by open tabs until [RESET] or a new day
// (earlier days go to [DAYS]). Counted from your lifetime totals in the site's data:
// today = the totals now, minus the first reading today.
function sessionStats() {
    var bossDmg = document.getElementById("boss-dmg");
    var lastHit = document.getElementById("last-hit");
    var box = document.querySelector(".lasthit");
    if (!bossDmg || !box) return false;
    var KEY = "omhp.session";
    var line = document.createElement("div");
    line.id = "omhp-session";
    box.appendChild(line);
    var daysBox = document.createElement("div");
    daysBox.id = "omhp-days";
    daysBox.hidden = true;
    box.appendChild(daysBox);

    // base: the totals at the first reading today; last: the latest reading; extra: what
    // was counted from the screen while the site's data wasn't available
    function fresh() {
        return { v: 2, day: today(), base: null, last: null, extra: { dmg: 0, hits: 0, crits: 0 }, best: 0, activeMs: 0, seen: 0, sizes: [] };
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
        if (s.day !== today()) {
            var c = sessionCounts(s, s.last);
            if (c.dmg) archiveDay(s.day, "session", { dmg: c.dmg, hits: c.hits, crits: c.crits, best: s.best, activeMs: s.activeMs });
            s = fresh();
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
        });
        myLast = Date.now();
    });
    var daysBtn = resetButton("earlier days", function() {
        daysBox.hidden = !daysBox.hidden;
        if (!daysBox.hidden) paintDays();
    });
    daysBtn.textContent = "[DAYS]";

    function val(text) {
        var s = document.createElement("span");
        s.className = "val";
        s.textContent = text;
        return s;
    }

    function paint() {
        var s = load();
        var c = sessionCounts(s, myTotals() || s.last);
        var parts = ["SESSION ", val(fmt(c.dmg) + " DMG")];
        var hours = s.activeMs / 3600000;
        if (hours >= 1 / 60) parts.push(" · ", val(fmt(c.dmg / hours) + "/HR"));
        if (s.best) parts.push(" · BEST ", val(fmt(s.best)));
        if (c.hits > 0) {
            parts.push(" · AVG ", val(fmt(c.dmg / c.hits)));
            parts.push(" · ", val(Math.round(c.crits / c.hits * 100) + "%"), " CRIT");
        }
        parts.push(daysBtn, reset);
        line.replaceChildren.apply(line, parts);
        line.title = spread(s.sizes || []);
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
        var lines = ["DAY      DMG    /HR  HITS CRIT  IDLE  LOOT"];
        dates.forEach(function(d) {
            var x = all[d].session || {}, l = (all[d].loot || {}).counts || {};
            var hrs = (x.activeMs || 0) / 3600000;
            var loot = Object.keys(l).map(function(k) { return l[k][1] + " x" + l[k][0]; }).join(" ");
            lines.push(d.slice(5) + "  " + short(x.dmg || 0).padStart(6) + " " +
                (hrs >= 1 / 60 ? short(Math.round((x.dmg || 0) / hrs)) : "-").padStart(6) + " " +
                String(x.hits || 0).padStart(5) + " " +
                (x.hits ? Math.round(x.crits / x.hits * 100) + "%" : "-").padStart(4) + " " +
                (all[d].idle ? dur(all[d].idle.ms / 60000) : "-").padStart(5) + "  " + loot);
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

