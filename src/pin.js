// Set once the saved pin (if any) is back, so pop-out windows restore after it
var pinRestored = false;

// [PIN] in the right column's tab bar: keep the open panel showing above the others.
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

    // The line under the pinned panel: drag to resize, double-click to reset
    var PIN_H_KEY = "omhp.layout.pinH";
    var grip = document.createElement("div");
    grip.id = "omhp-pin-resize";
    grip.className = "left-resize";
    grip.title = "drag to resize, double-click to reset";
    grip.hidden = true;
    box.insertAdjacentElement("afterend", grip);

    function setPinHeight(px) {
        box.classList.toggle("sized", !!px);
        box.style.height = px ? Math.round(px) + "px" : "";
    }
    setPinHeight(loadJSON(PIN_H_KEY, null));

    var isDouble = makeDoublePress();
    var dragFrom = null; // { y, h } while dragging
    grip.addEventListener("pointerdown", function(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        if (isDouble()) {
            setPinHeight(null);
            save(PIN_H_KEY, null);
            return;
        }
        grip.setPointerCapture(e.pointerId);
        grip.classList.add("dragging");
        dragFrom = { y: e.clientY, h: box.offsetHeight };
    });
    grip.addEventListener("pointermove", function(e) {
        if (!dragFrom) return;
        // Leave the panel below at least 120px
        var most = side.clientHeight - tabs.offsetHeight - 120;
        setPinHeight(Math.max(60, Math.min(most, dragFrom.h + e.clientY - dragFrom.y)));
    });
    function endDrag() {
        if (!dragFrom) return;
        dragFrom = null;
        grip.classList.remove("dragging");
        save(PIN_H_KEY, box.offsetHeight);
    }
    grip.addEventListener("pointerup", endDrag);
    grip.addEventListener("pointercancel", endDrag);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-text omhp-pin";
    tabs.appendChild(btn);

    var pinned = null; // { key, panel, home } while something is pinned
    var keepShown = new MutationObserver(function() {
        if (pinned && pinned.panel.hidden) pinned.panel.hidden = false;
    });

    function paint() {
        btn.textContent = pinned ? "[UNPIN]" : "[PIN]";
        btn.title = pinned ? "stop keeping " + pinned.key.toUpperCase() + " on top" : "keep the open panel on top";
    }

    function pin(key) {
        var panel = document.getElementById("panel-" + key);
        if (!panel || LEFT_TABS.indexOf(key) !== -1) return;
        pinned = { key: key, panel: panel, home: panel.nextSibling };
        box.appendChild(panel);
        box.hidden = false;
        grip.hidden = false;
        panel.hidden = false;
        keepShown.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
        save(PIN_KEY, key);
        paint();
    }

    function unpin() {
        if (!pinned) return;
        keepShown.disconnect();
        side.insertBefore(pinned.panel, pinned.home && pinned.home.parentNode === side ? pinned.home : null);
        var sel = document.querySelector('#tabs [role=tab][aria-selected="true"]');
        pinned.panel.hidden = !(sel && sel.dataset.tab === pinned.key);
        pinned = null;
        box.hidden = true;
        grip.hidden = true;
        save(PIN_KEY, null);
        paint();
    }

    btn.addEventListener("click", function() {
        if (pinned) return unpin();
        var sel = document.querySelector('#tabs [role=tab][aria-selected="true"]');
        if (sel) pin(sel.dataset.tab);
    });

    paint();
    var saved = loadJSON(PIN_KEY, null);
    if (!saved) {
        pinRestored = true;
        return;
    }
    // Load it once by picking its tab, then pin it (after the site restores its own tab)
    whenReady(900, tabsReady, function() {
        var t = tabButton(saved);
        if (t && !t.hidden) {
            var before = document.querySelector('#tabs [role=tab][aria-selected="true"]');
            t.click();
            pin(saved);
            if (before && before !== t) before.click();
        }
        pinRestored = true;
    });
}

