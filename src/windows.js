// Pop out any panel into a floating window you can drag and resize, several at once:
// [POP OUT] in the tab bar for the open right-hand panel, and the ⧉ button on each
// left-column section. DESIGN also gets its drawing grid scaled up to fill the window.
var popOutPanel = null; // set by floatingPanels(); used by the left sections' ⧉ buttons
var tileWindows = null; // set by floatingPanels(); [TOOLKIT] > LAYOUT > TILE

// Where a window dragged to (x, y) goes: snapped to the screen's edges and to the other
// floating windows' edges within 10px (see snapPos), unless Shift is held; kept on screen
function snapWindow(win, x, y, free) {
    var r = win.getBoundingClientRect();
    var others = Array.prototype.filter.call(document.querySelectorAll(".omhp-float"), function(w) { return w !== win; })
        .map(function(w) {
            var b = w.getBoundingClientRect();
            return { x: b.left, y: b.top, w: b.width, h: b.height };
        });
    var p = free ? { x: x, y: y } : snapPos(x, y, r.width, r.height, others, window.innerWidth, window.innerHeight, 10);
    return { x: Math.max(0, Math.min(p.x, window.innerWidth - 80)), y: Math.max(0, Math.min(p.y, window.innerHeight - 30)) };
}

function floatingPanels() {
    var tabs = document.getElementById("tabs");
    if (!tabs) return;
    var KEY = "omhp.layout.floats";
    var store = loadSaved(KEY);
    // Older versions only remembered the DESIGN window, under its own key
    var oldDesigner = loadSaved("omhp.layout.designer");
    if (oldDesigner.w && !store.designer) {
        store.designer = oldDesigner;
        save(KEY, store);
    }
    try { localStorage.removeItem("omhp.layout.designer"); } catch (e) { /* ignore */ }

    var open = {}; // key -> { win, body, panel, home, left, keepShown }
    var top = 60;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-text omhp-popout";
    btn.textContent = "[POP OUT]";
    btn.title = "open this panel in a floating window";
    tabs.appendChild(btn);

    function selectedKey() {
        var sel = document.querySelector('#tabs [role=tab][aria-selected="true"]');
        return sel ? sel.dataset.tab : null;
    }

    function syncButton() {
        var k = selectedKey();
        btn.disabled = !k || !!open[k] || LEFT_TABS.indexOf(k) !== -1;
    }

    function sectionInfo(key) {
        return SECTIONS.filter(function(s) { return s.key === key; })[0] || null;
    }

    function titleFor(key, info) {
        if (key === "designer") return "BOSS FORGE";
        if (info) return info.title;
        var t = tabButton(key);
        // "[ AUCTION HOUSE 2 ]" -> "AUCTION HOUSE"
        return ((t && t.textContent) || key).replace(/^\[\s*|\s*\]$/g, "").replace(/\s+\d+$/, "").toUpperCase();
    }

    function raise(win) {
        win.style.zIndex = String(++top);
    }

    function remember(key) {
        var o = open[key];
        if (!o) return;
        var r = o.win.getBoundingClientRect();
        var g = store[key] || {};
        store[key] = {
            x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width),
            // A minimised window is only its title bar: keep the height it had before
            h: g.min && g.h ? g.h : Math.round(r.height),
            open: true, min: !!g.min, op: g.op || 1
        };
        save(KEY, store);
    }

    // Minimised (title bar only) and see-through, both remembered per window
    function applyLook(key) {
        var o = open[key], g = store[key] || {};
        if (!o) return;
        o.win.classList.toggle("minimised", !!g.min);
        o.win.style.height = g.min ? "auto" : Math.min(g.h || window.innerHeight - 120, window.innerHeight - 20) + "px";
        o.win.style.opacity = String(g.op || 1);
        o.minBtn.textContent = g.min ? "[+]" : "[_]";
        o.minBtn.title = g.min ? "restore" : "minimise to the title bar";
        o.opInput.value = String(Math.round((g.op || 1) * 100));
    }

    function place(key) {
        var g = store[key] || {};
        var win = open[key].win;
        var count = Object.keys(open).length - 1; // cascade new windows a little
        var w = Math.min(g.w || (key === "designer" ? 760 : 460), window.innerWidth - 20);
        var h = Math.min(g.h || window.innerHeight - 120, window.innerHeight - 20);
        var x = g.x != null ? g.x : (window.innerWidth - w) / 2 + count * 30;
        var y = g.y != null ? g.y : 40 + count * 30;
        win.style.left = Math.max(0, Math.min(x, window.innerWidth - 80)) + "px";
        win.style.top = Math.max(0, Math.min(y, window.innerHeight - 40)) + "px";
        win.style.width = w + "px";
        win.style.height = h + "px";
    }

    // DESIGN: scale the grid to the window's width, then let the designer re-measure
    // its cells (it does that on window resize) so drawing stays lined up.
    function refit(key) {
        var o = open[key];
        if (!o || key !== "designer" || o.pending) return;
        o.pending = true;
        requestAnimationFrame(function() {
            o.pending = false;
            var canvas = o.panel.querySelector(".design-canvas");
            var wrap = canvas && canvas.parentElement;
            if (canvas && wrap && wrap.clientWidth) {
                var cols = parseFloat(getComputedStyle(canvas).getPropertyValue("--cols")) || 36;
                var px = Math.max(10, Math.min(40, (wrap.clientWidth - 14) / (cols * 0.602)));
                o.win.style.setProperty("--omhp-design-font", px.toFixed(2) + "px");
            }
            window.dispatchEvent(new Event("resize"));
        });
    }

    function makeWindow(key, title) {
        var win = document.createElement("div");
        win.className = "omhp-float";
        win.dataset.key = key;
        var bar = document.createElement("div");
        bar.className = "omhp-float-bar";
        var name = document.createElement("span");
        name.textContent = title;
        var dock = document.createElement("button");
        dock.type = "button";
        dock.className = "btn-text";
        dock.textContent = "[DOCK]";
        dock.title = "put it back";
        dock.addEventListener("click", function() { dockIn(key); });
        var tools = document.createElement("span");
        tools.className = "omhp-float-tools";
        // See-through: 30% .. 100% opacity
        var opInput = document.createElement("input");
        opInput.type = "range";
        opInput.min = "30";
        opInput.max = "100";
        opInput.step = "5";
        opInput.value = "100";
        opInput.className = "omhp-float-op";
        opInput.title = "see-through";
        opInput.addEventListener("input", function() {
            store[key] = store[key] || {};
            store[key].op = Number(opInput.value) / 100;
            win.style.opacity = String(store[key].op);
        });
        opInput.addEventListener("change", function() { save(KEY, store); });
        var minBtn = document.createElement("button");
        minBtn.type = "button";
        minBtn.className = "btn-text";
        minBtn.addEventListener("click", function() {
            remember(key); // keep the current height before shrinking
            store[key].min = !store[key].min;
            save(KEY, store);
            applyLook(key);
            if (!store[key].min) refit(key);
        });
        tools.appendChild(opInput);
        tools.appendChild(minBtn);
        tools.appendChild(dock);
        bar.appendChild(name);
        bar.appendChild(tools);
        var body = document.createElement("div");
        body.className = "omhp-float-body";
        win.appendChild(bar);
        win.appendChild(body);
        document.body.appendChild(win);

        win.addEventListener("pointerdown", function() { raise(win); });

        // Drag the title bar to move the window
        var drag = null;
        bar.addEventListener("pointerdown", function(e) {
            if (e.button !== 0 || e.target !== bar && e.target !== name) return;
            e.preventDefault();
            bar.setPointerCapture(e.pointerId);
            var r = win.getBoundingClientRect();
            drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        });
        bar.addEventListener("pointermove", function(e) {
            if (!drag) return;
            var p = snapWindow(win, e.clientX - drag.dx, e.clientY - drag.dy, e.shiftKey);
            win.style.left = p.x + "px";
            win.style.top = p.y + "px";
        });
        function endDrag() {
            if (!drag) return;
            drag = null;
            remember(key);
        }
        bar.addEventListener("pointerup", endDrag);
        bar.addEventListener("pointercancel", endDrag);

        // Resizing (the corner handle) is remembered; DESIGN rescales its grid
        var saveTimer = null;
        new ResizeObserver(function() {
            if (!open[key] || win.classList.contains("minimised")) return;
            refit(key);
            clearTimeout(saveTimer);
            saveTimer = setTimeout(function() { remember(key); }, 300);
        }).observe(win);

        return { win: win, body: body, minBtn: minBtn, opInput: opInput };
    }

    function popOut(key) {
        if (!key) return;
        if (open[key]) return raise(open[key].win);
        var info = sectionInfo(key);
        if (!info && LEFT_TABS.indexOf(key) !== -1) return;
        var panel = document.getElementById(info ? info.panel : "panel-" + key);
        if (!panel) return;
        if (!info) {
            // Right-hand panel: unpin it first, and let the site build/load it by picking its tab
            if (unpinKey) unpinKey(key);
            var t = tabButton(key);
            if (!t || t.hidden) return;
            if (t.getAttribute("aria-selected") !== "true") t.click();
        }
        var w = makeWindow(key, titleFor(key, info));
        var o = {
            win: w.win, body: w.body, panel: panel, left: !!info, minBtn: w.minBtn, opInput: w.opInput,
            home: { parent: panel.parentElement, next: panel.nextSibling },
            keepShown: new MutationObserver(function() { if (panel.hidden) panel.hidden = false; })
        };
        open[key] = o;
        w.body.appendChild(panel);
        panel.hidden = false;
        o.keepShown.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
        if (o.left) o.home.parent.classList.add("floated");
        place(key);
        applyLook(key);
        raise(o.win);
        remember(key);
        refit(key);
        // The right column would now be empty under this tab; move it on
        if (!o.left) fixRightPanel(key);
        syncButton();
    }

    function dockIn(key) {
        var o = open[key];
        if (!o) return;
        o.keepShown.disconnect();
        o.home.parent.insertBefore(o.panel, o.home.next && o.home.next.parentNode === o.home.parent ? o.home.next : null);
        if (o.left) {
            o.home.parent.classList.remove("floated");
            o.panel.hidden = false;
        } else {
            o.panel.hidden = selectedKey() !== key;
        }
        o.win.remove();
        delete open[key];
        if (store[key]) store[key].open = false;
        save(KEY, store);
        window.dispatchEvent(new Event("resize"));
        syncButton();
    }

    btn.addEventListener("click", function() { popOut(selectedKey()); });
    new MutationObserver(syncButton).observe(tabs, { subtree: true, attributes: true, attributeFilter: ["aria-selected", "hidden"] });
    syncButton();
    popOutPanel = popOut;

    // TILE: every open window that isn't minimised, in a grid over the right two-thirds of
    // the screen (the boss column stays clear); the new places are remembered
    tileWindows = function() {
        var wins = Array.prototype.filter.call(document.querySelectorAll(".omhp-float"), function(w) {
            return !w.classList.contains("minimised");
        });
        var area = { x: Math.round(window.innerWidth / 3), y: 10, w: Math.round(window.innerWidth * 2 / 3) - 10, h: window.innerHeight - 20 };
        tileRects(wins.length, area, 8).forEach(function(r, i) {
            var w = wins[i];
            w.style.left = r.x + "px";
            w.style.top = r.y + "px";
            w.style.width = r.w + "px";
            w.style.height = r.h + "px";
            if (w.dataset.key && open[w.dataset.key]) remember(w.dataset.key);
        });
        window.dispatchEvent(new Event("resize"));
    };

    // Re-open the windows that were open last time (after the site restores its tabs and pins)
    whenReady(1300, function() { return pinRestored && tabsReady(); }, function() {
        Object.keys(store).forEach(function(k) {
            if (store[k] && store[k].open) popOut(k);
        });
    });
}

