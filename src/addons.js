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


// ASCII BOSS FORGE: a slider next to the site's [ GRID ] for how strong the drawing grid's lines
// are, from gone to strong (remembered). The site only has faint and bright; clicking its
// [ GRID ] goes back to those (the slider then shows where they sit). Double-click it to do the same.
var DESIGN_GRID_KEY = "omhp.layout.designGrid";

function designGrid() {
    var panel = document.getElementById("panel-designer");
    if (!panel) return;
    var root = document.documentElement;
    var wrap = null, input = null, label = null;

    function value() {
        var v = loadJSON(DESIGN_GRID_KEY, null);
        return typeof v === "number" ? Math.max(0, Math.min(100, v)) : null;
    }

    // Where the site's own two settings sit on the slider
    function siteValue() {
        var g = document.getElementById("design-grid");
        return g && g.getAttribute("aria-pressed") === "true" ? 52 : 14;
    }

    function paint() {
        var v = value();
        root.classList.toggle("omhp-grid-set", v !== null);
        if (v !== null) {
            // The site's colours: faint is .035 / .12, bright .13 / .45
            root.style.setProperty("--omhp-grid-line", "rgba(255,255,255," + (v / 100 * 0.25).toFixed(3) + ")");
            root.style.setProperty("--omhp-grid-mid", "rgba(255,176,0," + Math.min(1, v / 100 * 0.85).toFixed(3) + ")");
        }
        if (!input) return;
        var shown = v !== null ? v : siteValue();
        if (Number(input.value) !== shown) input.value = String(shown);
        var text = v === null ? "LINES" : "LINES " + v + "%";
        if (label.textContent !== text) label.textContent = text;
    }

    function set(v) {
        save(DESIGN_GRID_KEY, v);
        paint();
    }

    function attach() {
        if (wrap && wrap.isConnected) return;
        var gridBtn = document.getElementById("design-grid");
        if (!gridBtn) return;
        if (!wrap) {
            wrap = document.createElement("label");
            wrap.className = "omhp-grid-pick";
            wrap.title = "how strong the grid lines are (double-click to go back to the site's [ GRID ])";
            label = document.createElement("span");
            input = document.createElement("input");
            input.type = "range";
            input.min = "0";
            input.max = "100";
            input.step = "1";
            input.addEventListener("input", function() { set(Number(input.value)); });
            input.addEventListener("dblclick", function() { set(null); });
            wrap.appendChild(label);
            wrap.appendChild(input);
        }
        gridBtn.insertAdjacentElement("afterend", wrap);
        paint();
    }

    // The site's [ GRID ] (it has already switched by the time this hears the click)
    panel.addEventListener("click", function(e) {
        if (e.target instanceof Element && e.target.closest("#design-grid")) set(null);
    });
    observeBatched(panel, { childList: true, subtree: true }, attach);
    onSetting(function(key) {
        if (key === DESIGN_GRID_KEY) paint();
    });
    paint();
    attach();
}


// YOU > PROFILE and INVENTORY: how far you are through this level, after the LEVEL row's XP
// ("1,349,994 / 1,417,683 XP) 54.6%"), in the same terms as INVENTORY's bar (from where this level
// started). The site redraws both rows with their panels.
function levelPercent() {
    var share = function(text) {
        var t = myTotals(), lvl = t && Array.isArray(t.lvl) ? t.lvl : null;
        if (lvl && typeof lvl[0] === "number" && lvl[1] > lvl[0]) return (t.dmg - lvl[0]) / (lvl[1] - lvl[0]);
        // No site data: the numbers on the row (counted from 0, not from where this level started)
        var m = text.replace(/,/g, "").match(/(\d+)\s*\/\s*(\d+)\s*XP/);
        return m && Number(m[2]) > 0 ? Number(m[1]) / Number(m[2]) : null;
    };
    // [panel, the element holding the "N / N XP" text]
    var SPOTS = [
        ["panel-player", function(p) {
            var cell = Array.prototype.filter.call(p.querySelectorAll("table.kv tr"), function(tr) {
                return tr.cells.length > 1 && tr.cells[0].textContent.trim() === "LEVEL";
            })[0];
            return cell ? cell.cells[1] : null;
        }],
        ["panel-inventory", function(p) { return p.querySelector(".level-row"); }]
    ];
    var applies = [];
    SPOTS.forEach(function(spot) {
        var panel = document.getElementById(spot[0]);
        if (!panel) return;
        var pct = document.createElement("span");
        pct.className = "omhp-lvl-pct";
        pct.title = "how far you are through this level";
        var apply = function() {
            var row = spot[1](panel);
            if (!row) return;
            var at = Array.prototype.filter.call(row.childNodes, function(n) {
                return n.nodeType === 3 && /XP\)?\s*$/.test(n.nodeValue);
            })[0];
            if (!at) return;
            var s = share(at.nodeValue);
            if (s === null) return;
            // Rounded down, so it only says 100% once you're there
            var text = " " + (Math.floor(Math.max(0, Math.min(1, s)) * 1000) / 10).toFixed(1) + "%";
            if (pct.textContent !== text) pct.textContent = text;
            if (at.nextSibling !== pct) row.insertBefore(pct, at.nextSibling);
        };
        observeBatched(panel, { childList: true, subtree: true }, apply);
        applies.push(apply);
        apply();
    });
    var bridge = document.getElementById("omhp-boss-data");
    if (bridge) watcher(function() { applies.forEach(function(f) { f(); }); }).observe(bridge, { attributes: true, attributeFilter: ["data-me"] });
}


// INVENTORY: [-] / [+] on LEVEL UNLOCKS folds the list down to its heading (remembered). The site
// redraws the panel on every update of your data, so the button goes back on after each redraw
// and the rows are hidden with a class on the panel, which the redraws leave alone. HELP's
// pop-up of the same list stays as it is.
var UNLOCKS_FOLD_KEY = "omhp.layout.unlocksFold";

function unlocksFold() {
    var panel = document.getElementById("panel-inventory");
    if (!panel) return;
    var folded = loadJSON(UNLOCKS_FOLD_KEY, false) === true;

    function apply() {
        if (panel.classList.contains("omhp-unlocks-folded") !== folded) panel.classList.toggle("omhp-unlocks-folded", folded);
        var head = panel.querySelector(".unlocks > .unlocks-h");
        if (!head) return;
        var b = head.querySelector(".omhp-unlocks-fold");
        if (!b) {
            b = document.createElement("button");
            b.type = "button";
            b.className = "btn-text omhp-clan-fold omhp-unlocks-fold";
            b.addEventListener("click", function() {
                folded = !folded;
                save(UNLOCKS_FOLD_KEY, folded);
                apply();
            });
            head.insertBefore(b, head.firstChild);
        }
        var text = folded ? "[+] " : "[-] ";
        if (b.textContent !== text) b.textContent = text;
        // Folded, the title still says what's next: "LEVEL 30 GODLY gear and BOSS UNIQUES <- NEXT (3 levels to go)"
        var next = panel.querySelector(".unlocks-next");
        var title = folded ? "show what each level opens" +
            (next ? ". Next: " + (next.textContent || "").replace(/^\s*\[\s*\]\s*/, "").replace(/\s+/g, " ").trim() : "") : "hide the level unlocks";
        if (b.title !== title) b.title = title;
        if (b.getAttribute("aria-expanded") !== String(!folded)) b.setAttribute("aria-expanded", String(!folded));
    }

    observeBatched(panel, { childList: true, subtree: true }, apply);
    onSetting(function(key) {
        if (key !== UNLOCKS_FOLD_KEY) return;
        folded = loadJSON(UNLOCKS_FOLD_KEY, false) === true;
        apply();
    });
    apply();
}


// INVENTORY: a HIDE row under YOUR EQUIPMENT's RARITY / EFFECT / SORT, to hide any mix of rarities
// at once (the site's RARITY picks just one to show). Remembered. The hidden rarities go on the
// panel as data-omhp-own-hide and the stylesheet hides their rows, so a redraw (every update of
// your data) never shows them for a moment; the row of buttons goes back on after each redraw.
// Each button counts that rarity's rows in the list as the site's own filters leave it.
var OWN_HIDE_KEY = "omhp.layout.ownHide";

function equipmentHide() {
    var panel = document.getElementById("panel-inventory");
    if (!panel) return;
    var hide;
    function load() {
        var s = loadJSON(OWN_HIDE_KEY, []);
        hide = Array.isArray(s) ? s.filter(function(r) { return RARITIES.indexOf(r) !== -1; }) : [];
    }
    load();

    var bar = document.createElement("div");
    bar.className = "ticket-filters omhp-own-hides";
    var lead = document.createElement("span");
    lead.className = "dim";
    lead.textContent = "HIDE ";
    bar.appendChild(lead);
    var btns = RARITIES.map(function(r) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "inline-btn ticket-filter r-" + r;
        var name = r.replace(/_/g, " ").toUpperCase();
        b.title = "hide your " + name + " gear";
        b.addEventListener("click", function() {
            var i = hide.indexOf(r);
            if (i === -1) hide.push(r);
            else hide.splice(i, 1);
            save(OWN_HIDE_KEY, hide);
            apply();
        });
        bar.appendChild(b);
        return { id: r, name: name, el: b };
    });
    var tally = document.createElement("span");
    tally.className = "dim omhp-own-hidden";
    var none = document.createElement("div");
    none.className = "dim bag-note omhp-own-none";
    none.textContent = "> all hidden: turn a HIDE off";

    function rarityOf(row) {
        var name = row.querySelector(".own-name");
        var m = name && name.className.match(/(?:^|\s)r-([a-z_]+)/);
        return m ? m[1] : "";
    }

    function apply() {
        var want = hide.join(" ");
        if ((panel.dataset.omhpOwnHide || "") !== want) {
            if (want) panel.dataset.omhpOwnHide = want;
            else delete panel.dataset.omhpOwnHide;
        }
        var picks = panel.querySelector(".own-picks"), list = panel.querySelector(".own-list"), head = panel.querySelector(".own-head");
        if (!picks || !list) return; // not drawn yet ("> connecting...")

        var counts = {}, rows = list.querySelectorAll(":scope > .own-row"), hidden = 0;
        rows.forEach(function(row) {
            var r = rarityOf(row);
            counts[r] = (counts[r] || 0) + 1;
            if (hide.indexOf(r) !== -1) hidden++;
        });
        var any = false;
        btns.forEach(function(b) {
            var on = hide.indexOf(b.id) !== -1, n = counts[b.id] || 0;
            var show = on || n > 0;
            if (show) any = true;
            if (b.el.hidden === show) b.el.hidden = !show;
            var text = (on ? "[x " : "[ ") + b.name + " " + fmt(n) + " ]";
            if (b.el.textContent !== text) b.el.textContent = text;
            if (b.el.getAttribute("aria-pressed") !== String(on)) b.el.setAttribute("aria-pressed", String(on));
        });
        if (bar.hidden === any) bar.hidden = !any;
        if (picks.nextSibling !== bar) picks.parentNode.insertBefore(bar, picks.nextSibling);

        // "YOUR EQUIPMENT  12 / 40 · 28 HIDDEN"
        var text = hidden ? " · " + fmt(hidden) + " HIDDEN" : "";
        if (tally.textContent !== text) tally.textContent = text;
        if (head && hidden && tally.parentNode !== head) head.appendChild(tally);
        else if (!hidden && tally.isConnected) tally.remove();

        var allGone = hidden > 0 && hidden === rows.length;
        if (allGone && none.nextSibling !== list) list.parentNode.insertBefore(none, list);
        else if (!allGone && none.isConnected) none.remove();
    }

    observeBatched(panel, { childList: true, subtree: true }, apply);
    onSetting(function(key) {
        if (key !== OWN_HIDE_KEY) return;
        load();
        apply();
    });
    apply();
}
