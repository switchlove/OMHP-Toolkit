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
    paint();
}

