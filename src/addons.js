// BAG: the LOOT BOXES cards in the same order SHOP sells them in, so a pinned BAG
// lines up with SHOP. The site redraws the panel often, so the order is set with
// CSS (flex order) and set again after every redraw; boxes SHOP doesn't sell go last.
function bagBoxOrder() {
    var panel = document.getElementById("panel-bag");
    var bridge = document.getElementById("omhp-boss-data");
    if (!panel || !bridge) return false;

    function apply() {
        var order = [];
        try { order = JSON.parse(bridge.dataset.boxOrder || "[]"); } catch (e) { /* keep the site's order */ }
        if (!order.length) return;
        panel.querySelectorAll(".box-row > .box-card").forEach(function(card) {
            var art = card.querySelector("[data-box-odds]");
            var i = art ? order.indexOf(art.dataset.boxOdds) : -1;
            var want = String(i === -1 ? 999 : i);
            if (card.style.order !== want) card.style.order = want;
        });
    }

    new MutationObserver(apply).observe(panel, { childList: true, subtree: true });
    new MutationObserver(apply).observe(bridge, { attributes: true, attributeFilter: ["data-box-order"] });
    apply();
}

