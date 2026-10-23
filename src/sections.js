// Drag press that comes within 400ms of the last one counts as a double-click
function makeDoublePress() {
    var last = 0;
    return function() {
        var now = Date.now();
        var isDouble = now - last < 400;
        last = isDouble ? 0 : now;
        return isDouble;
    };
}

function makeResizer(info, scroller, heights) {
    var handle = document.createElement("div");
    handle.className = "left-resize";
    handle.title = "drag to resize, double-click to reset";

    if (heights[info.key]) scroller.style.height = heights[info.key] + "px";

    var startY = 0;
    var startH = 0;
    var stuckToBottom = false;
    var lastDown = 0;

    function reset() {
        scroller.style.height = "";
        scroller.style.maxHeight = "";
        delete heights[info.key];
        save(HEIGHTS_KEY, heights);
    }

    handle.addEventListener("pointerdown", function(e) {
        if (e.button !== 0) return;
        e.preventDefault();
        // Two presses close together: reset (pointer capture can stop dblclick firing)
        var now = Date.now();
        if (now - lastDown < 400) {
            lastDown = 0;
            reset();
            return;
        }
        lastDown = now;
        handle.setPointerCapture(e.pointerId);
        handle.classList.add("dragging");
        startY = e.clientY;
        startH = scroller.offsetHeight;
        stuckToBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 4;
    });

    handle.addEventListener("pointermove", function(e) {
        if (!handle.classList.contains("dragging")) return;
        var h = Math.max(80, Math.min(window.innerHeight * 0.85, startH + e.clientY - startY));
        scroller.style.maxHeight = "none";
        scroller.style.height = Math.round(h) + "px";
        if (stuckToBottom) scroller.scrollTop = scroller.scrollHeight;
    });

    function endDrag() {
        if (!handle.classList.contains("dragging")) return;
        handle.classList.remove("dragging");
        heights[info.key] = scroller.offsetHeight;
        save(HEIGHTS_KEY, heights);
    }
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);

    return handle;
}

function tabButton(key) {
    return document.querySelector('#tabs [data-tab="' + key + '"]');
}

// The right-hand panel would be empty while one of the moved tabs is selected (or
// the tab `except`, whose panel has left the column), so switch it to the first
// other tab that's unlocked.
function fixRightPanel(except) {
    var selected = document.querySelector('#tabs [role=tab][aria-selected="true"]');
    if (selected && selected.dataset.tab !== except && LEFT_TABS.indexOf(selected.dataset.tab) === -1) return;
    var tabs = document.querySelectorAll("#tabs [role=tab]");
    for (var i = 0; i < tabs.length; i++) {
        var k = tabs[i].dataset.tab;
        if (!tabs[i].hidden && k !== except && LEFT_TABS.indexOf(k) === -1) {
            tabs[i].click();
            return;
        }
    }
}

function buildSection(info, collapsed, heights) {
    var panel = document.getElementById(info.panel);
    // Look it up before the panel moves (see moveSections)
    var scroller = document.querySelector(info.scroller);
    var section = document.createElement("div");
    section.className = "left-section" + (collapsed[info.key] ? " collapsed" : "");
    section.dataset.key = info.key;

    var head = document.createElement("div");
    head.className = "left-head";
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "left-toggle";
    head.appendChild(toggle);

    // Up/down arrows to reorder the sections (remembered)
    [["▲", "move up", -1], ["▼", "move down", 1]].forEach(function(a) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "left-move";
        b.textContent = a[0];
        b.title = a[1];
        b.addEventListener("click", function() {
            var col = section.parentElement;
            if (a[2] < 0 && section.previousElementSibling) col.insertBefore(section, section.previousElementSibling);
            if (a[2] > 0 && section.nextElementSibling) col.insertBefore(section.nextElementSibling, section);
            save(ORDER_KEY, Array.prototype.map.call(col.querySelectorAll(":scope > .left-section"), function(s) {
                return s.dataset.key;
            }));
        });
        head.appendChild(b);
    });
    // FILTER (see lineFilters): opens the hide / highlight boxes under the header
    if (filterEditor && (info.key === "feed" || info.key === "chat")) {
        var fb = document.createElement("button");
        fb.type = "button";
        fb.className = "left-move";
        fb.textContent = "FILTER";
        fb.title = "hide or highlight lines in ATTACKS and CHAT";
        var editor = null;
        fb.addEventListener("click", function() {
            if (editor) {
                editor.remove();
                editor = null;
                return;
            }
            editor = filterEditor();
            head.insertAdjacentElement("afterend", editor);
            editor.querySelector("input").focus();
        });
        head.appendChild(fb);
    }
    var pop = document.createElement("button");
    pop.type = "button";
    pop.className = "left-move";
    pop.textContent = "⧉";
    pop.title = "pop out into a window";
    pop.addEventListener("click", function() {
        if (popOutPanel) popOutPanel(info.key);
    });
    head.appendChild(pop);

    // Show the tab's badge in the header, e.g. "[ MESSAGES 2 ]" -> "MESSAGES 2"
    function paint() {
        var label = info.title;
        var btn = tabButton(info.key);
        if (btn) {
            var m = (btn.textContent || "").match(/^\[\s*\S+\s*(.*?)\s*\]$/);
            if (m && m[1]) label += " " + m[1];
        }
        var isCollapsed = section.classList.contains("collapsed");
        toggle.textContent = (isCollapsed ? "[+] " : "[-] ") + label;
        toggle.setAttribute("aria-expanded", String(!isCollapsed));
    }

    toggle.addEventListener("click", function() {
        section.classList.toggle("collapsed");
        collapsed[info.key] = section.classList.contains("collapsed");
        save(STORE_KEY, collapsed);
        paint();
    });

    onTabsChange(paint);

    section.appendChild(head);
    section.appendChild(panel);
    if (scroller) section.appendChild(makeResizer(info, scroller, heights));
    paint();
    return section;
}

// Keep the boss/fight column in view. When it's taller than the window, a
// negative top lets it scroll until its bottom (the attack buttons) reaches
// the bottom of the window, then it stays put. No inner scrollbar, so hit
// pop-ups and effects that animate past its edges aren't clipped.
function pinMain() {
    var col = document.querySelector("#app .col-main");
    if (!col) return;
    var wide = window.matchMedia("(min-width: 1300px)");

    function update() {
        col.style.top = wide.matches
            ? Math.min(12, window.innerHeight - col.offsetHeight - 12) + "px"
            : "";
    }

    update();
    new ResizeObserver(update).observe(col);
    window.addEventListener("resize", update);
}

