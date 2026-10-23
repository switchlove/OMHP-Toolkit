
var style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);

function loadJSON(key, fallback) {
    try {
        var v = JSON.parse(localStorage.getItem(key));
        return v == null ? fallback : v;
    } catch (e) {
        return fallback;
    }
}

function loadSaved(key) {
    return loadJSON(key, {});
}

function save(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        /* ignore */
    }
}

// One clock for the whole script: every(ms, fn) runs fn about every ms. With
// { visible: true } it skips while this tab is in the background.
var ticks = [];

function every(ms, fn, opts) {
    ticks.push({ ms: ms, fn: fn, next: Date.now() + ms, visible: !!(opts && opts.visible) });
}
setInterval(function() {
    var now = Date.now();
    ticks.forEach(function(t) {
        if (now < t.next) return;
        t.next = now + t.ms;
        if (t.visible && document.hidden) return;
        try { t.fn(); } catch (e) { console.error("OMHP Toolkit:", e); }
    });
}, 1000);

// One watcher on the tab bar for everything that follows its labels (section badges,
// short tab names): onTabsChange(fn) runs fn whenever a tab's text changes
var tabWatchers = null;

function onTabsChange(fn) {
    var tabs = document.getElementById("tabs");
    if (!tabs) return;
    if (!tabWatchers) {
        tabWatchers = [];
        new MutationObserver(function() {
            tabWatchers.forEach(function(f) { f(); });
        }).observe(tabs, { childList: true, characterData: true, subtree: true });
    }
    tabWatchers.push(fn);
}

// Features you can switch on/off in [TOOLKIT]: [key, label, on by default?]
var FEATURES_KEY = "omhp.layout.features";
var FEATURES = [
    ["graph", "HP GRAPH", true], ["eta", "ETA", true], ["share", "SHARE", true], ["session", "SESSION", true],
    ["full", "FULL IN", true], ["loot", "LOOT", true], ["clock", "CLOCK", true], ["flattabs", "FLAT TABS", true],
    ["account", "NAME", true], ["title", "TAB TITLE", true], ["bosses", "BOSS LOG", true], ["keys", "SHORTCUTS", true],
    ["filters", "FILTERS", true], ["compact", "COMPACT", false], ["stats", "STATS THEME", true], ["boxorder", "BOX ORDER", true],
    ["notify", "NOTIFY", false]
];
var features = loadSaved(FEATURES_KEY);

function isOn(name) {
    if (typeof features[name] === "boolean") return features[name];
    var f = FEATURES.filter(function(x) { return x[0] === name; })[0];
    return !f || f[2];
}

// LOOT and BOSSES are features you can switch off; the site's own sections always stay
SECTIONS = SECTIONS.filter(function(s) { return isOn(s.key); });
if (isOn("flattabs")) document.documentElement.classList.add("omhp-flattabs");
if (isOn("compact")) document.documentElement.classList.add("omhp-compact");
if (isOn("stats")) document.documentElement.classList.add("omhp-stats-theme");

function applyAccent(hex) {
    if (hex) document.documentElement.style.setProperty("--amber", hex);
    else document.documentElement.style.removeProperty("--amber");
}

function applyTheme(name) {
    var root = document.documentElement.style;
    var theme = THEMES.filter(function(t) { return t.name === name; })[0];
    ["bg", "bg-2", "fg", "dim", "faint"].forEach(function(v) {
        if (theme && theme.vars) root.setProperty("--" + v, theme.vars[v]);
        else root.removeProperty("--" + v);
    });
}

// Before anything else paints, so there's no flash of the old colours
applyTheme(loadJSON(THEME_KEY, null));
applyAccent(loadJSON(ACCENT_KEY, null));

// The boss's real HP/phase/number from the site's own data (see paintAccount), or null
// if that isn't available yet. Falls back to the screen only when it isn't fogged.
function trueBoss() {
    var el = document.getElementById("omhp-boss-data");
    if (el && el.dataset.boss) {
        try {
            var b = JSON.parse(el.dataset.boss);
            if (b && typeof b.hp === "number") return b;
        } catch (e) { /* fall through */ }
    }
    var bar = document.getElementById("hp-bar");
    if (bar && bar.classList.contains("fogged")) return null; // the screen is lying right now
    var num = ((document.getElementById("boss-num") || {}).textContent || "").match(/\d+/);
    var hp = numberIn(document.getElementById("hp-now"));
    if (!num || hp === null) return null;
    var ph = ((document.getElementById("phase") || {}).textContent || "").match(/PHASE\s+([IVX]+)/);
    return {
        seq: Number(num[0]), hp: hp, max: numberIn(document.getElementById("hp-max")),
        phase: ph ? ROMAN.indexOf(ph[1]) : null,
        dmg: numberIn(document.getElementById("g-damage")), alive: true
    };
}

// The site's own flag while the FOG world event is faking the HP readout
function fogged() {
    var bar = document.getElementById("hp-bar");
    return !!(bar && bar.classList.contains("fogged"));
}

function numberIn(el) {
    var m = el && (el.textContent || "").replace(/,/g, "").match(/\d+/);
    return m ? Number(m[0]) : null;
}

// Append " :: el" to the top bar, with the spacing the site uses around its separators
function addToBar(bar, el) {
    var sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "::";
    bar.appendChild(document.createTextNode(" "));
    bar.appendChild(sep);
    bar.appendChild(document.createTextNode(" "));
    bar.appendChild(el);
}

function notifyRarity() {
    var r = loadJSON(NOTIFY_RARITY_KEY, "legendary");
    return RARITIES.indexOf(r) === -1 ? "legendary" : r;
}

// A desktop notification, only while this tab is in the background (NOTIFY feature)
function notify(text) {
    if (!isOn("notify") || !document.hidden || !window.Notification || Notification.permission !== "granted") return;
    try {
        new Notification("OMHP", { body: text, tag: "omhp-" + text, icon: "https://www.google.com/s2/favicons?sz=64&domain=onemillionhp.com" });
    } catch (e) {
        /* some browsers only allow notifications from a service worker */
    }
}

// The site's numbers for you (lifetime damage, hits, crits), published by the page
// script (see paintAccount), or null
function myTotals() {
    var el = document.getElementById("omhp-boss-data");
    if (!el || !el.dataset.me) return null;
    try {
        var t = JSON.parse(el.dataset.me);
        return typeof t.dmg === "number" && typeof t.hits === "number" ? t : null;
    } catch (e) {
        return null;
    }
}

// This toolkit's localStorage keys (the site keeps its own under omhp.* too, e.g. omhp.tab)
function isOurKey(k) {
    return k.indexOf("omhp.layout.") === 0 ||
        ["omhp.session", "omhp.loot", "omhp.idle", "omhp.bosses", "omhp.bosscur", DAYS_KEY, PRESETS_KEY].indexOf(k) !== -1;
}

// Your attacks today, from the stored SESSION (see sessionStats), or 0
function hitsToday() {
    var st = loadSaved("omhp.session");
    if (st.v !== 2 || st.day !== today()) return 0;
    var t = myTotals() || st.last;
    return (t && st.base ? t.hits - st.base.hits : 0) + ((st.extra && st.extra.hits) || 0);
}

// An earlier day's SESSION or LOOT totals, kept for 30 days (the DAYS table)
function archiveDay(day, kind, data) {
    if (!day || day === today()) return;
    var days = loadSaved(DAYS_KEY);
    days[day] = days[day] || {};
    days[day][kind] = data;
    var out = {};
    Object.keys(days).sort().slice(-30).forEach(function(d) { out[d] = days[d]; });
    save(DAYS_KEY, out);
}

// With the game open in several tabs, one of them is the "leader": only it records the
// HP history and the loot log, so nothing is counted twice. The others show what it saves.
var TAB_ID = Math.random().toString(36).slice(2);
var LEADER_KEY = "omhp.leader";

var amLeader = false;

// Every 5s: take the lock if it's free (or its tab stopped renewing it), renew it if it's
// ours. Last write wins, so if two tabs claim at once, the next round settles it.
function claimLeader() {
    var l = loadJSON(LEADER_KEY, null);
    amLeader = !(l && l.id !== TAB_ID && Date.now() - l.t < 15000);
    if (amLeader) save(LEADER_KEY, { id: TAB_ID, t: Date.now() });
}

// Whether this tab records (cheap: the 5s round above does the storage work)
function isLeader() {
    return amLeader;
}

claimLeader();
every(5000, claimLeader);
window.addEventListener("pagehide", function() {
    var l = loadJSON(LEADER_KEY, null);
    if (l && l.id === TAB_ID) {
        try { localStorage.removeItem(LEADER_KEY); } catch (e) { /* ignore */ }
    }
});

// Run fn once at least minMs have passed and test() is true (checked every 100ms),
// or after 5s regardless. The minimum gives the site time to restore its own state.
function whenReady(minMs, test, fn) {
    var start = Date.now();
    (function check() {
        var waited = Date.now() - start;
        if (waited >= minMs && test() || waited > 5000) return fn();
        setTimeout(check, 100);
    })();
}

// The site has restored its remembered tab
function tabsReady() {
    return !!document.querySelector('#tabs [role=tab][aria-selected="true"]');
}

// A small [RESET] link for the session and loot lines
function resetButton(title, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn-text omhp-reset";
    b.textContent = "[RESET]";
    b.title = title;
    b.addEventListener("click", onClick);
    return b;
}

