// [TOOLKIT] in the top bar: highlight colour, theme, features, loot alerts, layouts and
// backups.
function toolkitMenu() {
    var bar = document.getElementById("statusline");
    if (!bar) return;
    var current = loadJSON(ACCENT_KEY, null) || ACCENTS[0].hex;
    var currentTheme = loadJSON(THEME_KEY, null) || THEMES[0].name;

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    }

    function choice(text, on, title, onClick) {
        var b = el("button", "btn-text omhp-choice" + (on ? " on" : ""), text);
        b.type = "button";
        if (title) b.title = title;
        b.addEventListener("click", onClick);
        return b;
    }

    var wrap = el("span", "omhp-accent-wrap");
    var btn = el("button", "btn-text", "[TOOLKIT]");
    btn.type = "button";
    btn.id = "omhp-accent";
    btn.title = "OMHP Toolkit: colours, features, layouts";
    btn.style.color = "var(--amber)";
    var pop = el("div", "omhp-accent-pop");
    pop.hidden = true;
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "OMHP Toolkit settings");

    // A labelled row: "THEME     TERMINAL  MIDNIGHT  ..."
    function row(label, items) {
        var r = el("div", "omhp-menu-row");
        r.appendChild(el("div", "omhp-menu-label", label));
        var body = el("div", "omhp-menu-body");
        items.forEach(function(x) { body.appendChild(x); });
        r.appendChild(body);
        pop.appendChild(r);
        return body;
    }

    // Header: name, version, close
    var head = el("div", "omhp-menu-head");
    var version = typeof GM_info !== "undefined" && GM_info.script ? " v" + GM_info.script.version : "";
    head.appendChild(el("span", null, "OMHP TOOLKIT" + version));
    head.appendChild(choice("[X]", false, "close", function() { pop.hidden = true; }));
    pop.appendChild(head);

    var swatches = ACCENTS.map(function(a) {
        var sw = el("button", "omhp-swatch" + (a.hex === current ? " on" : ""));
        sw.type = "button";
        sw.style.background = a.hex;
        sw.title = a.name;
        sw.addEventListener("click", function() {
            current = a.hex;
            var stored = a.hex === ACCENTS[0].hex ? null : a.hex; // the default is stored as "no override"
            applyAccent(stored);
            save(ACCENT_KEY, stored);
            swatches.forEach(function(x) { x.classList.toggle("on", x === sw); });
        });
        return sw;
    });
    row("COLOUR", swatches);

    var themeBtns = THEMES.map(function(t) {
        var b = choice(t.name, t.name === currentTheme, null, function() {
            currentTheme = t.name;
            var stored = t.vars ? t.name : null; // the default is stored as "no override"
            applyTheme(stored);
            save(THEME_KEY, stored);
            themeBtns.forEach(function(x) { x.classList.toggle("on", x === b); });
        });
        return b;
    });
    row("THEME", themeBtns);

    // Features on/off: takes effect on the next reload
    var note = el("div", "omhp-menu-note", "reload the page to apply");
    note.hidden = true;
    var featBody = row("FEATURES", FEATURES.map(function(f) {
        var b = choice(f[1], isOn(f[0]), "turn " + f[1] + " on or off", function() {
            features[f[0]] = !isOn(f[0]);
            save(FEATURES_KEY, features);
            b.classList.toggle("on", isOn(f[0]));
            b.setAttribute("aria-pressed", String(isOn(f[0])));
            note.hidden = false;
            // Browsers only let a page ask for notifications from a click like this one
            if (f[0] === "notify" && isOn("notify") && window.Notification && Notification.permission === "default") {
                Notification.requestPermission();
            }
        });
        b.classList.add("omhp-check");
        b.setAttribute("aria-pressed", String(isOn(f[0])));
        return b;
    }));
    featBody.classList.add("omhp-menu-grid");
    pop.appendChild(note);

    // NOTIFY: the lowest loot rarity worth a notification (click to step through)
    var lootMin = choice("", true, "notify for loot of this rarity or better (click to change)", function() {
        var i = RARITIES.indexOf(notifyRarity());
        save(NOTIFY_RARITY_KEY, RARITIES[(i + 1) % RARITIES.length]);
        paintLootMin();
    });
    function paintLootMin() {
        var r = notifyRarity();
        lootMin.className = "btn-text omhp-choice on r-" + r;
        lootMin.textContent = r.toUpperCase() + " OR BETTER";
    }
    paintLootMin();
    row("LOOT ALERT", [lootMin]);
    if (isOn("keys")) row("KEYS", [el("span", "omhp-menu-hint", "Alt+1–9 tabs · Alt+P pin · Alt+O pop out · Alt+T this menu")]);

    // Other userscripts this one knows, checked each time the menu opens
    var addons = el("span", "omhp-menu-hint");
    row("ADD-ONS", [addons]);
    function paintAddons() {
        addons.textContent = document.getElementById("omhp-tracker")
            ? "1MHP Data Statistics found · " + (isOn("stats") ? "in this theme" : "own colours (STATS THEME off)")
            : "none found (1MHP Data Statistics gets this theme when installed)";
    }

    // Layouts: the built-in ones, your saved ones (× deletes), + SAVE
    var BUILT_IN = { "DEFAULT": {}, "BOSS FOCUS": {} };
    BUILT_IN["BOSS FOCUS"][STORE_KEY] = JSON.stringify({ feed: true, chat: true, dms: true, loot: true });
    BUILT_IN["BOSS FOCUS"]["omhp.layout.widths"] = JSON.stringify({ l: 240 });

    function applyLayout(snap) {
        LAYOUT_KEYS.forEach(function(k) {
            try {
                if (snap[k] == null) localStorage.removeItem(k);
                else localStorage.setItem(k, snap[k]);
            } catch (e) { /* ignore */ }
        });
        location.reload();
    }

    var layoutBody = row("LAYOUT", []);
    function paintLayouts() {
        var mine = loadSaved(PRESETS_KEY);
        layoutBody.replaceChildren();
        Object.keys(BUILT_IN).forEach(function(name) {
            layoutBody.appendChild(choice(name, false, "switch to this layout (reloads the page)", function() {
                if (name === "DEFAULT" && !confirm("Put the layout back to how it started? Column sizes, order, pins and pop-out windows reset (stats and settings stay).")) return;
                applyLayout(BUILT_IN[name]);
            }));
        });
        Object.keys(mine).forEach(function(name) {
            layoutBody.appendChild(choice(name, false, "switch to this layout (reloads the page)", function() { applyLayout(mine[name]); }));
            var del = choice("×", false, "delete " + name, function() {
                delete mine[name];
                save(PRESETS_KEY, mine);
                paintLayouts();
            });
            del.classList.add("omhp-del");
            layoutBody.appendChild(del);
        });
        layoutBody.appendChild(choice("+ SAVE", false, "save the current layout under a name", function() {
            var name = (prompt("Name this layout:") || "").trim().toUpperCase().slice(0, 20);
            if (!name || BUILT_IN[name]) return;
            var snap = {};
            LAYOUT_KEYS.forEach(function(k) {
                try { snap[k] = localStorage.getItem(k); } catch (e) { /* ignore */ }
            });
            mine[name] = snap;
            save(PRESETS_KEY, mine);
            paintLayouts();
        }));
    }
    paintLayouts();

    // Backups: everything this toolkit saves, as a file you can load in another browser
    function exportAll() {
        var data = {};
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (isOurKey(k)) data[k] = localStorage.getItem(k);
        }
        var blob = new Blob([JSON.stringify({ app: "omhp-toolkit", v: 1, saved: new Date().toISOString(), data: data })], { type: "application/json" });
        var a = el("a");
        a.href = URL.createObjectURL(blob);
        a.download = "omhp-toolkit-" + today() + ".json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
    }

    var file = el("input");
    file.type = "file";
    file.accept = ".json,application/json";
    file.hidden = true;
    file.addEventListener("change", function() {
        var f = file.files && file.files[0];
        file.value = "";
        if (!f) return;
        f.text().then(function(text) {
            var got = JSON.parse(text);
            if (!got || got.app !== "omhp-toolkit" || !got.data || typeof got.data !== "object") throw new Error("this isn't an OMHP Toolkit backup");
            // Only our own keys, and only values that are valid JSON
            var keys = Object.keys(got.data).filter(function(k) {
                if (!isOurKey(k) || typeof got.data[k] !== "string") return false;
                try { JSON.parse(got.data[k]); return true; } catch (e) { return false; }
            });
            if (!confirm("Replace your toolkit settings, layout and stats with this backup (" + keys.length + " items)? The page will reload.")) return;
            var old = [];
            for (var i = 0; i < localStorage.length; i++) if (isOurKey(localStorage.key(i))) old.push(localStorage.key(i));
            old.forEach(function(k) { localStorage.removeItem(k); });
            keys.forEach(function(k) { localStorage.setItem(k, got.data[k]); });
            location.reload();
        }).catch(function(e) {
            alert("Couldn't import: " + e.message);
        });
    });
    row("BACKUP", [
        choice("EXPORT", false, "download your settings, layouts and stats as a file", exportAll),
        choice("IMPORT", false, "load a file made with EXPORT (replaces what's here)", function() { file.click(); }),
        file
    ]);

    btn.addEventListener("click", function(e) {
        e.stopPropagation();
        pop.hidden = !pop.hidden;
        if (!pop.hidden) paintAddons();
    });
    document.addEventListener("click", function(e) {
        if (!wrap.contains(e.target)) pop.hidden = true;
    });
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") pop.hidden = true;
    });

    wrap.appendChild(btn);
    wrap.appendChild(pop);
    addToBar(bar, wrap);
}

