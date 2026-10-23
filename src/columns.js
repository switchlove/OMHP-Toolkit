// Drag the gaps between the three columns to resize the side columns.
function columnResizers() {
    var columns = document.querySelector("#app .columns");
    if (!columns) return;
    var widths = loadSaved(WIDTHS_KEY);

    function setWidth(side, px) {
        if (px) columns.style.setProperty("--omhp-" + side, Math.round(px) + "px");
        else columns.style.removeProperty("--omhp-" + side);
    }
    setWidth("l", widths.l);
    setWidth("r", widths.r);

    var handles = { l: document.createElement("div"), r: document.createElement("div") };

    function cols() {
        return {
            left: columns.querySelector("#col-left"),
            main: columns.querySelector(".col-main"),
            side: columns.querySelector(".col-side")
        };
    }

    // Centre each handle in its gap
    function place() {
        var c = cols();
        if (!c.left || !c.main || !c.side) return;
        var box = columns.getBoundingClientRect();
        var lr = c.left.getBoundingClientRect(), mr = c.main.getBoundingClientRect(), sr = c.side.getBoundingClientRect();
        handles.l.style.left = ((lr.right + mr.left) / 2 - box.left) + "px";
        handles.r.style.left = ((mr.right + sr.left) / 2 - box.left) + "px";
    }

    ["l", "r"].forEach(function(side) {
        var h = handles[side];
        h.className = "col-drag";
        h.title = "drag to resize, double-click to reset";
        var isDouble = makeDoublePress();
        var startX = 0, startW = 0, startMain = 0;

        h.addEventListener("pointerdown", function(e) {
            if (e.button !== 0) return;
            e.preventDefault();
            if (isDouble()) {
                delete widths[side];
                setWidth(side, null);
                save(WIDTHS_KEY, widths);
                place();
                return;
            }
            var c = cols();
            h.setPointerCapture(e.pointerId);
            h.classList.add("dragging");
            startX = e.clientX;
            startW = (side === "l" ? c.left : c.side).offsetWidth;
            startMain = c.main.offsetWidth;
        });

        h.addEventListener("pointermove", function(e) {
            if (!h.classList.contains("dragging")) return;
            var dx = e.clientX - startX;
            var w = side === "l" ? startW + dx : startW - dx;
            // Side column at least 240px; the boss column keeps at least 360px
            w = Math.max(240, Math.min(w, startW + startMain - 360));
            widths[side] = Math.round(w);
            setWidth(side, w);
            place();
        });

        function endDrag() {
            if (!h.classList.contains("dragging")) return;
            h.classList.remove("dragging");
            save(WIDTHS_KEY, widths);
        }
        h.addEventListener("pointerup", endDrag);
        h.addEventListener("pointercancel", endDrag);

        columns.appendChild(h);
    });

    new ResizeObserver(place).observe(columns);
    window.addEventListener("resize", place);
    place();
}

