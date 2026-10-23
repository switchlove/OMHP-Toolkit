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

