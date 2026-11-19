// Shorter labels on the flat tab bar: "[ ACHIEVEMENTS 2 ]" shows as "ACHIEVE 2".
// The site's own text is left alone (it rewrites it for counts); CSS shows data-short.
function shortTabs() {
    var tabs = document.getElementById("tabs");
    if (!tabs) return false;
    var SHORT = [
        ["ACHIEVEMENTS", "ACHIEVE"], ["HALL OF FAME", "FAME"], ["CHANGELOG", "CHANGES"], ["THE DIG", "DIG"],
        ["SPREAD THE WORD", "SHARE"], ["DESIGN A BOSS", "DESIGN"], ["VOTE ON BOSSES", "VOTE"],
        ["ANNOUNCEMENTS", "NEWS"], ["CREATE EMOTES", "EMOTES"]
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

// HELP stays a dropdown on the flat bar's GAME line: the help pages, RARITIES and ODDS, plus
// the outside links (COMMUNITY's DISCORD and WIKI, BUY ME A COFFEE), which the flat bar has no
// room for. CHANGELOG moves out of it onto the line. The site's own handlers open and close
// the list; this adds closing after a pick, on a click elsewhere and on Escape.
function helpMenu() {
    var tabs = document.getElementById("tabs");
    if (!tabs) return false;
    var head = tabs.querySelector('.tab-subcat[data-label="HELP"]');
    var sub = head ? head.closest(".tab-sub") : null;
    if (!sub) {
        var faq = document.getElementById("faq-open");
        sub = faq ? faq.closest(".tab-sub") : null;
        head = sub ? sub.querySelector(".tab-subcat") : null;
    }
    var list = sub ? sub.querySelector(".tab-submenu") : null;
    if (!head || !list) return false;
    sub.classList.add("omhp-help");

    var changelog = list.querySelector('[data-tab="changelog"]');
    if (changelog) sub.parentNode.insertBefore(changelog, sub);

    // DISCORD and WIKI before PRIVACY / TERMS, the coffee link last
    var legal = list.querySelector("a.tab-link");
    tabs.querySelectorAll(".tab-submenu a.tab-link").forEach(function(a) {
        if (!list.contains(a)) list.insertBefore(a, legal);
    });
    var coffee = document.getElementById("coffee-link");
    if (coffee) list.appendChild(coffee);

    // Clicking the heading itself never gets here (the site stops it), so it still toggles
    function close() {
        if (!list.hidden) head.click();
    }
    document.addEventListener("click", close);
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") close();
    });
}

