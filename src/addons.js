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


// ASCII BOSS FORGE: [-] / [+] on YOUR SUBMISSIONS and YOUR BOSSES folds each list away
// (remembered). The site builds the page the first time it's opened, and redraws each box's
// heading and rows together, so the button goes back on after every redraw and the rows are
// hidden with a class on the box, which the redraws leave alone.
var FORGE_FOLD_KEY = "omhp.layout.forgeFold";

function forgeFold() {
    var panel = document.getElementById("panel-designer");
    if (!panel) return;
    var BOXES = [["design-submissions", "submissions", "your submissions"], ["design-my-bosses", "bosses", "your bosses"]];
    var folds = loadSaved(FORGE_FOLD_KEY);
    var watched = {};

    function apply(box) {
        var host = document.getElementById(box[0]);
        if (!host) return;
        var folded = !!folds[box[1]];
        host.classList.toggle("omhp-df-folded", folded);
        var head = host.firstElementChild;
        if (!head || head.tagName !== "B") return;
        var b = head.querySelector(".omhp-df-fold");
        if (!b) {
            b = document.createElement("button");
            b.type = "button";
            b.className = "btn-text omhp-clan-fold omhp-df-fold";
            b.addEventListener("click", function() {
                if (folds[box[1]]) delete folds[box[1]];
                else folds[box[1]] = true;
                save(FORGE_FOLD_KEY, folds);
                apply(box);
            });
            head.insertBefore(b, head.firstChild);
        }
        var text = folded ? "[+] " : "[-] ";
        if (b.textContent !== text) b.textContent = text;
        var rows = host.children.length - 1;
        b.title = folded ? "show " + box[2] + " (" + rows + ")" : "hide " + box[2];
        b.setAttribute("aria-expanded", String(!folded));
    }

    // Each box once the page has built it; it redraws with replaceChildren
    function attach() {
        BOXES.forEach(function(box) {
            var host = document.getElementById(box[0]);
            if (host && !watched[box[0]]) {
                watched[box[0]] = true;
                observeBatched(host, { childList: true }, function() { apply(box); });
            }
            apply(box);
        });
    }

    observeBatched(panel, { childList: true }, attach);
    onSetting(function(key) {
        if (key !== FORGE_FOLD_KEY) return;
        folds = loadSaved(FORGE_FOLD_KEY);
        BOXES.forEach(apply);
    });
    attach();
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
