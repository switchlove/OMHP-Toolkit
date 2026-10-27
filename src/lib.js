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

// A time as "14:32"
function hhmm(t) {
    return new Date(t).toTimeString().slice(0, 5);
}

// The tab title with our part ("[72% ~39m]", "[FOG]", or "" for none) after the site's
// attack count: "(3/5) ONE MILLION HP" -> "(3/5) [72% ~39m] ONE MILLION HP". A title a
// world event is flashing ("(!) ...") is left as it is.
var TITLE_PART = /\[(?:FOG[^\]]*|\d[\d.]*%[^\]]*)\] ?/;

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

// A chance (0..1) the way the site's odds box writes it: 48% / 9.6% / 0.12% / <0.001%
function pct(p) {
    var v = p * 100;
    if (v <= 0) return "0%";
    if (v < 0.001) return "<0.001%";
    if (v >= 99.95) return "100%";
    var digits = v >= 10 ? 0 : v >= 1 ? 1 : Math.min(3, 1 - Math.floor(Math.log10(v)));
    return Number(v.toFixed(digits)) + "%";
}

// The chest ledger's name for what a box gave: the rarity for an item ("legendary"),
// otherwise the reward and its amount ("attacks:5", "ultimate")
function outcomeKey(kind, rarity, amount) {
    if (kind === "item") return rarity || "item";
    return amount ? kind + ":" + amount : kind;
}

// ...and how it reads: "LEGENDARY", "+5 ATTACKS", "2 CRIT CHARGES", "ULTIMATE"
function outcomeLabel(key) {
    var parts = key.split(":"), kind = parts[0], n = Number(parts[1]);
    if (kind === "attacks") return "+" + n + " ATTACK" + (n === 1 ? "" : "S");
    if (kind === "next_crit") return n + " CRIT CHARGE" + (n === 1 ? "" : "S");
    if (kind === "ultimate") return "ULTIMATE RECHARGE";
    if (kind === "scroll") return "A SCROLL";
    return kind.replace(/_/g, " ").toUpperCase();
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

// At most n points, picked evenly across the whole list (the first and last always kept)
function shrinkPoints(points, n) {
    if (points.length <= n) return points.slice();
    var out = [];
    for (var i = 0; i < n; i++) out.push(points[Math.round(i * (points.length - 1) / (n - 1))]);
    return out;
}

// A theme as a short code to share: "OMHP1-", then the theme's colours (bg, bg-2, fg, dim,
// faint) and the highlight colour, as six hex colours without the "#"
var THEME_VARS = ["bg", "bg-2", "fg", "dim", "faint"];

function themeCode(vars, accent) {
    return "OMHP1-" + THEME_VARS.map(function(v) { return vars[v] || "#000000"; }).concat([accent || "#ffb000"])
        .map(function(hex) { return hex.replace("#", "").toLowerCase(); }).join("-");
}

// ...and back: { vars, accent }, or null if it isn't a theme code
function parseThemeCode(code) {
    var m = String(code || "").trim().match(/^OMHP1-((?:[0-9a-f]{6}-){5}[0-9a-f]{6})$/i);
    if (!m) return null;
    var hex = m[1].toLowerCase().split("-").map(function(h) { return "#" + h; });
    var vars = {};
    THEME_VARS.forEach(function(v, i) { vars[v] = hex[i]; });
    return { vars: vars, accent: hex[5] };
}

// Snap a w x h box dragged to (x, y) to the edges of the view (vw x vh) and of other
// boxes ([{ x, y, w, h }]) when it comes within `dist` px: flush against them, or lined up
// with them. Each axis snaps on its own, to the nearest candidate.
function snapPos(x, y, w, h, others, vw, vh, dist) {
    var xs = [0, vw - w], ys = [0, vh - h];
    others.forEach(function(o) {
        xs.push(o.x - w, o.x + o.w, o.x, o.x + o.w - w);
        ys.push(o.y - h, o.y + o.h, o.y, o.y + o.h - h);
    });
    function near(v, list) {
        var best = v, gap = dist + 1;
        list.forEach(function(c) {
            var g = Math.abs(c - v);
            if (g <= dist && g < gap) {
                best = c;
                gap = g;
            }
        });
        return best;
    }
    return { x: near(x, xs), y: near(y, ys) };
}

// n boxes in a grid filling `area` ({ x, y, w, h }), `gap` px apart, row by row
function tileRects(n, area, gap) {
    if (!n) return [];
    var cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    var w = (area.w - gap * (cols - 1)) / cols, h = (area.h - gap * (rows - 1)) / rows;
    var out = [];
    for (var i = 0; i < n; i++) {
        var c = i % cols, r = Math.floor(i / cols);
        out.push({ x: Math.round(area.x + c * (w + gap)), y: Math.round(area.y + r * (h + gap)), w: Math.round(w), h: Math.round(h) });
    }
    return out;
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

// A boss's HP history packed small for storage: times as whole seconds since the point
// before, your lifetime damage as the change since the point before (the first reading in
// full), and empty fields at the end of a point left off. { t: first time in seconds, s: rows }
function packPoints(points) {
    var t0 = points.length ? Math.round(points[0][0] / 1000) : 0, prevT = t0, prevMine = null;
    var rows = points.map(function(p) {
        var t = Math.round(p[0] / 1000);
        var mine = p[4] == null ? null : prevMine === null ? p[4] : p[4] - prevMine;
        prevMine = p[4] == null ? null : p[4];
        var row = [t - prevT, p[1], p[2] || null, p[3] == null ? null : p[3], mine];
        prevT = t;
        while (row.length > 2 && row[row.length - 1] === null) row.pop();
        return row;
    });
    return { t: t0, s: rows };
}

// ...and back to [time, hp, phase, online, your lifetime damage]
function unpackPoints(packed) {
    var t = packed.t * 1000, prevMine = null;
    return (packed.s || []).map(function(r) {
        t += r[0] * 1000;
        var mine = r[4] == null ? null : prevMine === null ? r[4] : prevMine + r[4];
        prevMine = mine;
        return [t, r[1], r[2] == null ? null : r[2], r[3] == null ? null : r[3], mine];
    });
}

// World event kinds as short names for the title and graph: "laststand" -> "LAST STAND"
var EVENT_NAMES = { second_wind: "2ND WIND", laststand: "LAST STAND" };

function eventLabel(kind) {
    return EVENT_NAMES[kind] || String(kind || "event").replace(/_/g, " ").toUpperCase();
}

// A countdown as a clock: 102000 -> "1:42", 3723000 -> "1:02:03"
function clockDur(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s % 60).padStart(2, "0");
}

// For each of `cols` columns from t0 over `span` ms, the kind of world event running in it
// (events are [start, end, kind]), or null. Nothing after `cutoff`.
function eventColumns(events, t0, span, cols, cutoff) {
    var out = [];
    for (var c = 0; c < cols; c++) {
        var start = t0 + span * c / cols, end = t0 + span * (c + 1) / cols;
        var hit = start > cutoff ? null : events.filter(function(e) { return e[0] < end && e[1] >= start; })[0];
        out.push(hit ? hit[2] : null);
    }
    return out;
}

// How many days in a row you've played up to `day` ("YYYY-MM-DD"), from the days you played
function streakDays(days, day) {
    var set = {};
    days.forEach(function(d) { set[d] = true; });
    var n = 0, d = new Date(day + "T12:00:00");
    while (set[today(d)]) {
        n++;
        d.setDate(d.getDate() - 1);
    }
    return n;
}
