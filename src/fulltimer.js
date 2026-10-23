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

