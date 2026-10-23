function moveSections() {
    // Start a feature if it's on; note it if it can't find what it needs
    function run(name, fn) {
        if (!isOn(name)) return;
        try {
            if (fn() === false) broken.push(name.toUpperCase());
        } catch (e) {
            broken.push(name.toUpperCase());
            console.error("OMHP Toolkit:", name, e);
        }
    }

    pinMain();
    paintAccount(); // always: it also publishes the boss data (see trueBoss)
    run("graph", bossGraph);
    run("eta", bossEta);
    run("share", damageShare);
    run("session", sessionStats);
    run("full", attackTimer);
    toolkitMenu();
    run("clock", clock);
    run("flattabs", shortTabs);
    run("title", tabTitle);
    run("notify", notifier);
    run("keys", shortcuts);
    run("filters", lineFilters);
    run("boxorder", bagBoxOrder);
    pinPanel();
    floatingPanels();
    run("loot", lootLog);
    run("bosses", bossLog);
    healthCheck();
    var columns = document.querySelector("#app .columns");
    if (!columns) return;
    for (var i = 0; i < SECTIONS.length; i++) {
        if (!document.getElementById(SECTIONS[i].panel)) return;
    }

    // Saved order from the up/down arrows; sections it doesn't know go last
    var order = (function() {
        try { return JSON.parse(localStorage.getItem(ORDER_KEY)) || []; } catch (e) { return []; }
    })();
    var rank = function(info) {
        var i = order.indexOf(info.key);
        return i === -1 ? order.length + SECTIONS.indexOf(info) : i;
    };
    var sections = SECTIONS.slice().sort(function(a, b) { return rank(a) - rank(b); });

    var collapsed = loadSaved(STORE_KEY);
    var heights = loadSaved(HEIGHTS_KEY);
    var col = document.createElement("section");
    col.id = "col-left";
    col.className = "col-left box";
    col.setAttribute("aria-label", "Feed, chat and messages");

    var panels = [];
    sections.forEach(function(info) {
        // Look the panel up before it moves: getElementById can't find it
        // inside the new column until that column is on the page.
        panels.push(document.getElementById(info.panel));
        col.appendChild(buildSection(info, collapsed, heights));
    });
    columns.insertBefore(col, columns.firstChild);
    columnResizers();

    // The site's tab code hides these panels whenever another tab is picked;
    // keep them showing so the site also treats them as open.
    var keepShown = new MutationObserver(function() {
        panels.forEach(function(p) { if (p.hidden) p.hidden = false; });
        fixRightPanel();
    });
    panels.forEach(function(p) {
        keepShown.observe(p, { attributes: true, attributeFilter: ["hidden"] });
        p.hidden = false;
    });

    // Jump to the newest chat messages once it's in place
    var list = document.getElementById("chat-list");
    if (list) list.scrollTop = list.scrollHeight;

    // Let the tab code restore the remembered tab first. Messages only load
    // when their tab is picked, so pick it once, then move the right side on.
    whenReady(500, tabsReady, function() {
        var dms = tabButton("dms");
        if (dms && !dms.hidden) dms.click();
        fixRightPanel();
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", moveSections);
} else {
    moveSections();
}
