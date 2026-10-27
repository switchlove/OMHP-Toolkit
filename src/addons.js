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

    observeBatched(panel, { childList: true, subtree: true }, apply);
    new MutationObserver(apply).observe(bridge, { attributes: true, attributeFilter: ["data-box-order"] });
    apply();
}


// CLAN: [-] / [+] on the MEMBERS heading folds the member list away (remembered). The site
// redraws the panel whenever the clan changes, so the button goes back on after every redraw
// and the list is hidden with a class on the panel, which the redraws leave alone.
var CLAN_FOLD_KEY = "omhp.layout.clanFold";

function clanFold() {
    var panel = document.getElementById("panel-clan");
    if (!panel) return;
    var folded = loadJSON(CLAN_FOLD_KEY, false) === true;

    function apply() {
        panel.classList.toggle("omhp-clan-folded", folded);
        var list = panel.querySelector(".clan-members");
        var head = list && list.previousElementSibling;
        if (!head || !head.classList.contains("panel-h")) return;
        var b = head.querySelector(".omhp-clan-fold");
        if (!b) {
            b = document.createElement("button");
            b.type = "button";
            b.className = "btn-text omhp-clan-fold";
            b.addEventListener("click", function() {
                folded = !folded;
                save(CLAN_FOLD_KEY, folded);
                apply();
            });
            head.insertBefore(b, head.firstChild);
        }
        var text = folded ? "[+] " : "[-] ";
        if (b.textContent !== text) b.textContent = text;
        b.title = folded ? "show the " + list.children.length + " members" : "hide the member list";
        b.setAttribute("aria-expanded", String(!folded));
    }

    observeBatched(panel, { childList: true, subtree: true }, apply);
    apply();
}

// SHOP: the site won't redraw SHOP while an input inside it has focus (so a half-typed BUY
// amount survives), and clicking an AUTO-SELL label focuses its hidden tick box, so the
// tick and the SURE? question never appeared. Let go of the tick box before the site
// handles the change (a capture listener on the document runs before the box's own).
function shopTicks() {
    document.addEventListener("change", function(e) {
        var box = e.target;
        if (box instanceof HTMLInputElement && box.type === "checkbox" && box.closest("#panel-shop")) box.blur();
    }, true);
}
