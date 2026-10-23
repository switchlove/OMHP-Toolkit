// Pure helpers: they don't touch the page or storage, so test/lib.test.js runs them in Node.

// 1234567 -> "1.2M", 243000 -> "243K"
function short(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + "M";
    if (n >= 1e3) return Math.round(n / 1e3) + "K";
    return String(n);
}

function fmt(n) {
    return Math.round(n).toLocaleString("en-US");
}

// 42 -> "42m", 187 -> "3h 07m"
function dur(mins) {
    mins = Math.round(mins);
    if (mins < 60) return mins + "m";
    return Math.floor(mins / 60) + "h " + String(mins % 60).padStart(2, "0") + "m";
}

// Local date as "YYYY-MM-DD" (now, or the date given), for things that start over each day
function today(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// The tab title with our part ("[72% ~39m]", "[FOG]", or "" for none) after the site's
// attack count: "(3/5) ONE MILLION HP" -> "(3/5) [72% ~39m] ONE MILLION HP". A title a
// world event is flashing ("(!) ...") is left as it is.
var TITLE_PART = /\[(?:FOG|\d[\d.]*%[^\]]*)\] ?/;

function titleWith(title, part) {
    if (/^\(!\)/.test(title)) return title;
    var plain = title.replace(TITLE_PART, "");
    if (!part) return plain;
    var m = plain.match(/^\(\d+\/\d+\)/);
    return m ? m[0] + " " + part + plain.slice(m[0].length) : part + " " + plain;
}

// SESSION's numbers: lifetime totals now (t) minus the first reading today (s.base), plus
// what was counted from the screen without the site's data (s.extra)
function sessionCounts(s, t) {
    var b = s.base;
    var d = t && b ? { dmg: t.dmg - b.dmg, hits: t.hits - b.hits, crits: (t.crits || 0) - (b.crits || 0) }
        : { dmg: 0, hits: 0, crits: 0 };
    return { dmg: d.dmg + s.extra.dmg, hits: d.hits + s.extra.hits, crits: d.crits + s.extra.crits };
}

// Drops per 100 attacks: 3 in 250 -> "1.2%"
function dropRate(n, hits) {
    var pct = n / hits * 100;
    return (pct >= 10 ? pct.toFixed(0) : pct >= 1 ? pct.toFixed(1) : pct.toFixed(2)) + "%";
}

// HP lost per minute over the last `mins` minutes of samples ({ t, hp }, oldest first), or
// over all of them if they cover less; null when they cover under half a minute
function rateOver(samples, now, mins) {
    if (!samples.length) return null;
    var from = samples[0];
    for (var i = samples.length - 1; i >= 0; i--) {
        if (now - samples[i].t > mins * 60000) break;
        from = samples[i];
    }
    var m = (now - from.t) / 60000;
    var hp = samples[samples.length - 1].hp;
    return m >= 0.5 ? { perMin: (from.hp - hp) / m, first: from, minutes: m } : null;
}

// Minutes left at each window's rate, for the windows where the boss is going down
function etaMinutes(samples, now, windows) {
    var hp = samples.length ? samples[samples.length - 1].hp : 0;
    return windows.map(function(w) { return rateOver(samples, now, w); })
        .filter(function(r) { return r && r.perMin > 0; })
        .map(function(r) { return hp / r.perMin; });
}

// Long fights: past `max` points, keep every second point of the older half (the start
// and the recent part stay)
function thinPoints(points, max) {
    if (points.length <= max) return points;
    var half = Math.floor(points.length / 2);
    return points.slice(0, half).filter(function(p, i) { return i % 2 === 0; }).concat(points.slice(half));
}

// The HP graph's columns: for `cols` columns from t0 over `span` ms, the last reading in
// each (gaps carry the previous one forward). points are [time, hp, phase, online, your
// lifetime damage]; fog is [[start, end], ...]. Nothing after `cutoff` (the replay).
// mine is your damage within each column; fogCols says which columns FOG covered.
function bucketColumns(points, fog, t0, span, cols, cutoff) {
    var vals = [], phases = [], online = [], mine = [], fogCols = [];
    var j = 0, last = null, lastPhase = null, lastOnline = null, lastMine = null, prevMine = null;
    for (var c = 0; c < cols; c++) {
        var start = t0 + span * c / cols, end = t0 + span * (c + 1) / cols;
        fogCols.push(start <= cutoff && fog.some(function(f) { return f[0] <= end && f[1] >= start; }));
        if (start > cutoff) {
            vals.push(null);
            phases.push(null);
            online.push(null);
            mine.push(null);
            continue;
        }
        while (j < points.length && points[j][0] <= end) {
            last = points[j][1];
            if (points[j][2]) lastPhase = points[j][2];
            if (points[j][3] != null) lastOnline = points[j][3];
            if (points[j][4] != null) lastMine = points[j][4];
            j++;
        }
        vals.push(last);
        phases.push(lastPhase);
        online.push(lastOnline);
        mine.push(lastMine !== null && prevMine !== null && lastMine >= prevMine ? lastMine - prevMine : null);
        prevMine = lastMine;
    }
    return { vals: vals, phases: phases, online: online, mine: mine, fogCols: fogCols };
}
