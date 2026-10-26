// Set once the saved pins (if any) are back, so pop-out windows restore after them
var pinRestored = false;
// Unpins one panel by its tab (set by pinPanel); a pop-out window uses it before taking
// a pinned panel
var unpinKey = null;
var MAX_PINS = 3;

// [PIN] in the right column's tab bar: keep the open panel showing above the others. Up to
// three panels can be pinned, stacked, each with its own resize line and [UNPIN].
function pinPanel() {
    var side = document.querySelector("#app .col-side");
    var tabs = document.getElementById("tabs");
    if (!side || !tabs) {
        pinRestored = true;
        return;
    }
    var box = document.createElement("div");
    box.id = "omhp-pinned";
    box.hidden = true;
    tabs.insertAdjacentElement("afterend", box);

    // Each pinned panel's height once its line has been dragged (by tab); before v0.28
    // there was one pin and one number
    var PIN_H_KEY = "omhp.layout.pinH";
    var heights = loadJSON(PIN_H_KEY, {});
    var oldHeight = typeof heights === "number" ? heights : null;
    if (!heights || typeof heights !== "object") heights = {};

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-text omhp-pin";
    tabs.appendChild(btn);

    var pins = []; // { key, panel, home, slot, grip, keepShown }, top to bottom

    function selectedKey() {
        var sel = document.querySelector('#tabs [role=tab][aria-selected="true"]');
        return sel ? sel.dataset.tab : null;
    }

    function find(key) {
        return pins.filter(function(p) { return p.key === key; })[0] || null;
    }

    function paint() {
        var k = selectedKey(), on = find(k);
        var full = pins.length >= MAX_PINS;
        btn.textContent = on ? "[UNPIN]" : "[PIN]";
        btn.disabled = !on && (!k || full || LEFT_TABS.indexOf(k) !== -1);
        btn.title = on ? "stop keeping " + k.toUpperCase() + " on top"
            : full ? "up to " + MAX_PINS + " panels can be pinned" : "keep the open panel on top";
        box.hidden = !pins.length;
        box.style.setProperty("--omhp-pins", String(Math.max(1, pins.length))); // see style.css
    }

    function setHeight(p, px) {
        p.slot.classList.toggle("sized", !!px);
        p.slot.style.height = px ? Math.round(px) + "px" : "";
    }

    // The line under a pinned panel: drag to resize, double-click to reset
    function makeGrip(p) {
        var grip = document.createElement("div");
        grip.className = "left-resize omhp-pin-grip";
        grip.title = "drag to resize, double-click to reset";
        var isDouble = makeDoublePress();
        var dragFrom = null; // { y, h } while dragging
        grip.addEventListener("pointerdown", function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            if (isDouble()) {
                setHeight(p, null);
                delete heights[p.key];
                save(PIN_H_KEY, heights);
                return;
            }
            grip.setPointerCapture(e.pointerId);
            grip.classList.add("dragging");
            dragFrom = { y: e.clientY, h: p.slot.offsetHeight };
        });
        grip.addEventListener("pointermove", function(e) {
            if (!dragFrom) return;
            // At most the pinned area's own height (65% of the column, see style.css); past
            // that the pins scroll together, so the panel below keeps its room
            var most = Math.max(120, Math.round(side.clientHeight * 0.65) - grip.offsetHeight);
            setHeight(p, Math.max(60, Math.min(most, dragFrom.h + e.clientY - dragFrom.y)));
        });
        function endDrag() {
            if (!dragFrom) return;
            dragFrom = null;
            grip.classList.remove("dragging");
            heights[p.key] = p.slot.offsetHeight;
            save(PIN_H_KEY, heights);
        }
        grip.addEventListener("pointerup", endDrag);
        grip.addEventListener("pointercancel", endDrag);
        return grip;
    }

    function pin(key) {
        var panel = document.getElementById("panel-" + key);
        if (!panel || LEFT_TABS.indexOf(key) !== -1 || find(key) || pins.length >= MAX_PINS) return;
        var slot = document.createElement("div");
        slot.className = "omhp-pin-slot";
        var x = document.createElement("button");
        x.type = "button";
        x.className = "btn-text omhp-pin-x";
        x.textContent = "[UNPIN]";
        x.title = "stop keeping " + key.toUpperCase() + " on top";
        x.addEventListener("click", function() { unpin(key); });
        var p = {
            key: key, panel: panel, home: panel.nextSibling, slot: slot,
            keepShown: new MutationObserver(function() { if (panel.hidden) panel.hidden = false; })
        };
        slot.appendChild(x);
        slot.appendChild(panel);
        p.grip = makeGrip(p);
        box.appendChild(slot);
        box.appendChild(p.grip);
        panel.hidden = false;
        p.keepShown.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
        setHeight(p, heights[key]);
        pins.push(p);
        save(PIN_KEY, pins.map(function(q) { return q.key; }));
        paint();
    }

    function unpin(key) {
        var p = find(key);
        if (!p) return;
        p.keepShown.disconnect();
        side.insertBefore(p.panel, p.home && p.home.parentNode === side ? p.home : null);
        p.panel.hidden = selectedKey() !== key;
        p.slot.remove();
        p.grip.remove();
        pins.splice(pins.indexOf(p), 1);
        save(PIN_KEY, pins.map(function(q) { return q.key; }));
        paint();
    }
    unpinKey = unpin;

    btn.addEventListener("click", function() {
        var k = selectedKey();
        if (!k) return;
        if (find(k)) unpin(k);
        else pin(k);
    });
    observeBatched(tabs, { subtree: true, attributes: true, attributeFilter: ["aria-selected", "hidden"] }, paint);
    paint();

    var saved = loadJSON(PIN_KEY, null);
    if (typeof saved === "string") saved = [saved]; // one pin, before v0.28
    if (!Array.isArray(saved) || !saved.length) {
        pinRestored = true;
        return;
    }
    if (oldHeight && heights[saved[0]] === undefined) heights[saved[0]] = oldHeight;
    // Load each by picking its tab, then pin it (after the site restores its own tab)
    whenReady(900, tabsReady, function() {
        var before = document.querySelector('#tabs [role=tab][aria-selected="true"]');
        saved.slice(0, MAX_PINS).forEach(function(key) {
            var t = tabButton(key);
            if (!t || t.hidden) return;
            t.click();
            pin(key);
        });
        if (before && !before.hidden) before.click();
        pinRestored = true;
    });
}
