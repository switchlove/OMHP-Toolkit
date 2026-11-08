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
    watcher(apply).observe(bridge, { attributes: true, attributeFilter: ["data-box-order"] });
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
        // The heading, past the sort bar ([JOINED] [THIS WEEK] [ALL TIME]) the site puts under it
        var head = list && list.previousElementSibling;
        while (head && !head.classList.contains("panel-h")) head = head.previousElementSibling;
        if (!head) return;
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


// TICKETS: [ HIDE VOTED ] hides the tickets you've +1'd or -1'd, to find the ones still waiting
// for your vote, and [ HIDE CLOSED ] the COMPLETED and SKIPPED ones (both remembered). The site
// rebuilds the filter row and the list on every redraw, so the buttons and the marks go back
// on after each one. It shows 30 at a time: while some are hidden, [ SHOW MORE ] is pressed
// until 30 are showing.
var TICKETS_VOTED_KEY = "omhp.layout.ticketsHideVoted";
var TICKETS_CLOSED_KEY = "omhp.layout.ticketsHideClosed";

function ticketFilters() {
    var panel = document.getElementById("panel-tickets");
    if (!panel) return;
    var toggles = [
        { key: TICKETS_VOTED_KEY, label: "HIDE VOTED", title: "hide the tickets you've voted on",
            hides: function(card) { return !!card.querySelector(".ticket-vote.voted"); } },
        { key: TICKETS_CLOSED_KEY, label: "HIDE CLOSED", title: "hide the COMPLETED and SKIPPED tickets",
            hides: function(card) { return card.classList.contains("ticket-completed") || card.classList.contains("ticket-skipped"); } }
    ];
    toggles.forEach(function(t) { t.on = loadJSON(t.key, false) === true; });

    function apply() {
        var row = panel.querySelector(".ticket-filters");
        if (!row) return;
        var sorts = row.querySelector(".ticket-sorts");
        toggles.forEach(function(t) {
            var b = row.querySelector('[data-omhp-tk="' + t.key + '"]');
            if (!b) {
                b = document.createElement("button");
                b.type = "button";
                b.className = "inline-btn ticket-filter";
                b.dataset.omhpTk = t.key;
                b.title = t.title;
                b.addEventListener("click", function() {
                    t.on = !t.on;
                    save(t.key, t.on);
                    apply();
                });
                row.insertBefore(b, sorts);
            }
            var text = t.on ? "[x " + t.label + " ]" : "[ " + t.label + " ]";
            if (b.textContent !== text) b.textContent = text;
            b.setAttribute("aria-pressed", String(t.on));
        });

        var list = panel.querySelector(".ticket-list");
        if (!list) return;
        var showing = 0, hidden = 0;
        list.querySelectorAll(":scope > .ticket").forEach(function(card) {
            var hide = toggles.some(function(t) { return t.on && t.hides(card); });
            if (card.classList.contains("omhp-tk-hide") !== hide) card.classList.toggle("omhp-tk-hide", hide);
            if (hide) hidden++;
            else showing++;
        });
        var more = list.querySelector(":scope > .ticket-more");
        if (hidden && showing < 30 && more) {
            more.click();
            return;
        }
        var none = list.querySelector(":scope > .omhp-tk-none");
        var text = hidden && !showing ? "> nothing left: every ticket here is " + toggles.filter(function(t) { return t.on; }).map(function(t) {
            return t.key === TICKETS_VOTED_KEY ? "voted on" : "closed";
        }).join(" or ") + "." : "";
        if (text && !none) {
            none = document.createElement("div");
            none.className = "dim bag-note omhp-tk-none";
            list.appendChild(none);
        } else if (!text && none) {
            none.remove();
        }
        if (none && text && none.textContent !== text) none.textContent = text;
    }

    observeBatched(panel, { childList: true, subtree: true }, apply);
    onSetting(function(key) {
        var t = toggles.find(function(x) { return x.key === key; });
        if (!t) return;
        t.on = loadJSON(t.key, false) === true;
        apply();
    });
    apply();
}


// ACHIEVEMENTS: [ RAREST ] / [ MOST HAVE IT ] after the site's filters sort the cards by how
// many players have each one (its "N% OF PLAYERS HAVE THIS" line); the lit one again goes back
// to the site's order (remembered). The site redraws the whole panel, so the chips go back on
// after every redraw, and the order is set with CSS (the list is a grid), pinned ones first.
var ACH_SORT_KEY = "omhp.layout.achievementSort";

function achievementSort() {
    var panel = document.getElementById("panel-achievements");
    if (!panel) return;
    var sortBy = loadJSON(ACH_SORT_KEY, null);
    var CHIPS = [["rare", "RAREST", "fewest players have it first"], ["common", "MOST HAVE IT", "most players have it first"]];

    function apply() {
        var row = panel.querySelector(".achievement-filters");
        if (row) {
            CHIPS.forEach(function(c) {
                var b = row.querySelector('[data-omhp-ach="' + c[0] + '"]');
                if (!b) {
                    b = document.createElement("button");
                    b.type = "button";
                    b.className = "chip omhp-ach-sort";
                    b.dataset.omhpAch = c[0];
                    b.textContent = "[ " + c[1] + " ]";
                    b.addEventListener("click", function() {
                        sortBy = sortBy === c[0] ? null : c[0];
                        save(ACH_SORT_KEY, sortBy);
                        apply();
                    });
                    row.appendChild(b);
                }
                var on = sortBy === c[0];
                if (b.classList.contains("on") !== on) b.classList.toggle("on", on);
                b.setAttribute("aria-pressed", String(on));
                b.title = on ? "back to the site's order" : c[2];
            });
        }
        var cards = panel.querySelectorAll(".achievement-list > .achievement-card");
        var place = sortBy ? achievementOrder(Array.prototype.map.call(cards, function(card) {
            var line = card.querySelector(".achievement-rarity");
            return { pinned: card.classList.contains("pinned"), pct: line ? achievementPct(line.textContent) : null };
        }), sortBy) : null;
        cards.forEach(function(card, i) {
            var want = place ? String(place[i]) : "";
            if (card.style.order !== want) card.style.order = want;
        });
    }

    observeBatched(panel, { childList: true, subtree: true }, apply);
    onSetting(function(key) {
        if (key !== ACH_SORT_KEY) return;
        sortBy = loadJSON(ACH_SORT_KEY, null);
        apply();
    });
    apply();
}


// EFFECTS ([TOOLKIT]): the site's [FX] LOW turns everything down at once; these do one thing
// each, and theme the background mist. The site only draws the mist while its layer has
// .shown (and keeps the last frame when it stops), so:
//   OFF: .shown comes off, and nothing is drawn.
//   STILL: .shown stays on long enough for a frame, then comes off; .omhp-mist-held keeps
//     it on screen. It goes back on for a moment when the picture would change: the boss's
//     phase or colour, your theme or highlight colour, the window's size.
// Colour (SITE / THEME / HIGHLIGHT) and strength are CSS: the site draws in the layer's colour.
var applyEffects = function() {};

function effectToggles() {
    var mist = document.getElementById("mist-bg");
    var root = document.documentElement;
    var revealed = !!(mist && mist.classList.contains("shown"));
    var drawing = false, timer = 0, look = "";

    // The mist's classes for the chosen mode
    function settle() {
        if (!mist || !revealed) return;
        var bg = effectSettings().bg;
        var held = bg === "still", shown = bg === "live" || (held && drawing);
        if (mist.classList.contains("omhp-mist-held") !== held) mist.classList.toggle("omhp-mist-held", held);
        if (mist.classList.contains("shown") !== shown) mist.classList.toggle("shown", shown);
    }

    // STILL: let the site draw for `ms`, then hold that frame
    function redraw(ms) {
        if (!mist || !revealed || effectSettings().bg !== "still") return;
        clearTimeout(timer);
        drawing = true;
        timer = setTimeout(function() {
            drawing = false;
            settle();
        }, ms);
        settle();
    }

    applyEffects = function() {
        var fx = effectSettings();
        root.classList.toggle("omhp-mist-off", fx.bg === "off");
        root.classList.toggle("omhp-mist-still", fx.bg === "still");
        root.classList.toggle("omhp-mist-theme", fx.tint === "theme");
        root.classList.toggle("omhp-mist-accent", fx.tint === "accent");
        root.classList.toggle("omhp-mist-faint", fx.strength === "faint");
        root.classList.toggle("omhp-mist-bright", fx.strength === "bright");
        root.classList.toggle("omhp-no-scanlines", fx.scanlines);
        root.classList.toggle("omhp-no-numbers", fx.numbers);
        settle();
        redraw(300);
    };

    if (mist) {
        watcher(function() {
            // The site shows the mist once the page is ready (after the name prompt): a still
            // one gets a while to draw its first frame
            if (!revealed && mist.classList.contains("shown")) {
                revealed = true;
                redraw(1500);
                settle();
                return;
            }
            // The site changed its colour (the boss's phase, its own tint)
            var now = mist.className.replace(/\b(shown|omhp-mist-held)\b/g, "").trim() + "|" + mist.style.color;
            if (now !== look) {
                look = now;
                redraw(300);
            }
            settle();
        }).observe(mist, { attributes: true, attributeFilter: ["class", "style"] });
        // Your theme or highlight colour (set on the page's root), and the window's size (the
        // site's resize can clear the mist)
        watcher(function() { redraw(300); }).observe(root, { attributes: true, attributeFilter: ["style"] });
        window.addEventListener("resize", function() { redraw(300); });
    }
    onSetting(function(key) {
        if (key === EFFECTS_KEY) applyEffects();
    });
    applyEffects();
}
