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

