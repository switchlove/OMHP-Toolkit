// Shorter labels on the flat tab bar: "[ AUCTION HOUSE 2 ]" shows as "AUCTION 2".
// The site's own text is left alone (it rewrites it for counts); CSS shows data-short.
function shortTabs() {
    var tabs = document.getElementById("tabs");
    if (!tabs) return false;
    var SHORT = [
        ["AUCTION HOUSE", "AUCTION"], ["ACHIEVEMENTS", "ACHIEVE"], ["THE FORGE", "FORGE"],
        ["HALL OF FAME", "FAME"], ["CHANGELOG", "CHANGES"],
        ["SPREAD THE WORD", "SHARE"], ["DESIGN A BOSS", "DESIGN"]
    ];

    function label(btn) {
        var t = (btn.textContent || "").replace(/^\s*\[\s*|\s*\]\s*$/g, "").replace(/\s+/g, " ");
        SHORT.forEach(function(pair) {
            if (t.indexOf(pair[0]) === 0) t = pair[1] + t.slice(pair[0].length);
        });
        if (btn.dataset.short !== t) btn.dataset.short = t;
    }

    function labelAll() {
        tabs.querySelectorAll(".tab-menu [role=tab]").forEach(label);
    }
    labelAll();
    onTabsChange(labelAll);
}

