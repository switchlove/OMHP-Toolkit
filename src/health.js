// Features that couldn't start (the site changed) and page-script imports that failed,
// shown as "⚠ 2 OFF" in the top bar so nothing disappears without a word.
var broken = [];

function healthCheck() {
    var bar = document.getElementById("statusline");
    var bridge = document.getElementById("omhp-boss-data");
    if (!bar) return;
    var span = document.createElement("span");
    span.className = "omhp-health";
    var added = false;

    function paint() {
        var parts = broken.slice();
        if (storageFull) parts.push("STORAGE FULL");
        if (bridge && bridge.dataset.fail) parts = parts.concat(bridge.dataset.fail.split(", "));
        if (!parts.length) return;
        span.textContent = "⚠ " + parts.length + " OFF";
        span.title = "OMHP Toolkit couldn't start: " + parts.join(", ") + " (the site may have changed)";
        if (!added) {
            addToBar(bar, span);
            added = true;
        }
    }

    if (bridge) new MutationObserver(paint).observe(bridge, { attributes: true, attributeFilter: ["data-fail"] });
    every(15000, function() { if (storageFull) paint(); });
    paint();
}

// [TOOLKIT] > COPY DEBUG: the toolkit's version and state for a bug report (no stats or names)
function debugReport() {
    var bridge = document.getElementById("omhp-boss-data");
    var main = document.querySelector('script[src*="js/main.js"]');
    var width = function(sel) {
        var e = document.querySelector(sel);
        return e ? e.offsetWidth : "-";
    };
    var fails = broken.concat(bridge && bridge.dataset.fail ? bridge.dataset.fail.split(", ") : []);
    return [
        "OMHP Toolkit " + (typeof GM_info !== "undefined" && GM_info.script ? "v" + GM_info.script.version : "(version unknown)") +
            " · site " + (main ? new URL(main.src).search || "(no ?v)" : "(main.js not found)"),
        "browser: " + navigator.userAgent,
        "window: " + window.innerWidth + "x" + window.innerHeight + " · columns " + width("#col-left") + " / " +
            width("#app .col-main") + " / " + width("#app .col-side"),
        "features off: " + (FEATURES.filter(function(f) { return !isOn(f[0]); }).map(function(f) { return f[0]; }).join(", ") || "none"),
        "not started: " + (fails.join(", ") || "none"),
        "this tab records: " + (isLeader() ? "yes" : "no") + " · site data: " + (bridge && bridge.dataset.boss ? "yes" : "no"),
        "storage: " + ourStorage().map(function(x) { return x.key.replace(/^omhp\./, "") + " " + Math.round(x.size * 2 / 1024) + "K"; }).join(", ") +
            (storageFull ? " (FULL)" : "")
    ].join("\n");
}
