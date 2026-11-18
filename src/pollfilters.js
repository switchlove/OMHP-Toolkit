// POLLS: HIDE and SORT rows like TICKETS' own. The site has neither, and redraws the whole
// panel on every load, vote and its 15s refresh, so the same bar goes back under the heading
// after every redraw, hidden polls get a class, and the cards are moved into the chosen order.
// Everything is read from the cards the site draws: a poll's vote count only when the site
// shows it (you voted, skipped, or it ended), so MOST VOTES never gives away an open poll's.
var POLL_FILTER_KEY = "omhp.layout.pollFilters";

function pollFilters() {
    var panel = document.getElementById("panel-polls");
    if (!panel) return false;
    var HIDES = [["ended", "ENDED", "polls that have passed or failed"], ["voted", "VOTED", "polls you've voted on"],
        ["skipped", "SKIPPED", "polls you skipped"], ["ticket", "FROM TICKETS", "polls that came from a player's ticket"]];
    var SORTS = [["new", "NEWEST", "newest first"], ["ending", "ENDING SOON", "open polls ending soonest first, then ended ones"],
        ["votes", "MOST VOTES", "most votes first (open polls you haven't voted on, whose counts are hidden, go last)"]];
    var state;

    function load() {
        var s = loadJSON(POLL_FILTER_KEY, null);
        state = {
            hide: s && Array.isArray(s.hide) ? s.hide : ["ended"],
            sort: s && SORTS.some(function(x) { return x[0] === s.sort; }) ? s.sort : "new"
        };
    }
    load();

    function button(label, title, onClick) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "inline-btn ticket-filter";
        b.title = title;
        b.addEventListener("click", function() {
            onClick();
            save(POLL_FILTER_KEY, state);
            apply();
        });
        return b;
    }

    function paintButton(b, on, text) {
        var t = on ? "[x " + text + " ]" : "[ " + text + " ]";
        if (b.textContent !== t) b.textContent = t;
        if (b.getAttribute("aria-pressed") !== String(on)) b.setAttribute("aria-pressed", String(on));
    }

    // The bar, built once and put back after each redraw
    var bar = document.createElement("div");
    bar.className = "ticket-filters omhp-poll-filters";
    var hideRow = document.createElement("span");
    hideRow.className = "ticket-sorts ticket-hides";
    var sortRow = document.createElement("span");
    sortRow.className = "ticket-sorts";
    var none = document.createElement("div");
    none.className = "dim omhp-poll-none";
    none.textContent = "> no polls match: turn a HIDE off";
    [[hideRow, "HIDE "], [sortRow, "SORT "]].forEach(function(r) {
        var l = document.createElement("span");
        l.className = "dim";
        l.textContent = r[1];
        r[0].appendChild(l);
    });
    var hideBtns = HIDES.map(function(h) {
        var b = button(h[1], "hide " + h[2], function() {
            var i = state.hide.indexOf(h[0]);
            if (i === -1) state.hide.push(h[0]);
            else state.hide.splice(i, 1);
        });
        hideRow.appendChild(b);
        return b;
    });
    var sortBtns = SORTS.map(function(s) {
        var b = button(s[1], s[2], function() { state.sort = s[0]; });
        sortRow.appendChild(b);
        return b;
    });
    bar.appendChild(hideRow);
    bar.appendChild(sortRow);

    // The site's own list of skipped polls (its [ SKIP ] button)
    function skippedIds() {
        try {
            return (localStorage.getItem("omhp.polls.skipped") || "").split(",").filter(Boolean);
        } catch (e) {
            return [];
        }
    }

    function apply() {
        var cards = Array.prototype.slice.call(panel.querySelectorAll(":scope > .poll[data-id]"));
        if (!cards.length) {
            if (bar.isConnected) bar.remove();
            if (none.isConnected) none.remove();
            return;
        }
        var skipped = skippedIds();
        var counts = { ended: 0, voted: 0, skipped: 0, ticket: 0 };
        var shown = 0;
        var info = cards.map(function(c) {
            var is = {
                ended: !c.classList.contains("poll-open"),
                voted: !!c.querySelector('.poll-mine, .poll-vote [aria-pressed="true"]'),
                skipped: skipped.indexOf(c.dataset.id) !== -1,
                ticket: !!c.querySelector(".poll-from")
            };
            Object.keys(counts).forEach(function(k) { if (is[k]) counts[k]++; });
            var hide = state.hide.some(function(k) { return is[k]; });
            if (c.classList.contains("omhp-poll-hidden") !== hide) c.classList.toggle("omhp-poll-hidden", hide);
            if (!hide) shown++;
            var left = c.querySelector(".poll-left"), total = c.querySelector(".poll-total");
            var n = total && (total.textContent || "").replace(/,/g, "").match(/\d+/);
            return {
                el: c, id: Number(c.dataset.id), open: !is.ended,
                left: left ? durSecs(left.textContent) : null, total: n ? Number(n[0]) : null
            };
        });
        HIDES.forEach(function(h, i) { paintButton(hideBtns[i], state.hide.indexOf(h[0]) !== -1, h[1] + " " + counts[h[0]]); });
        SORTS.forEach(function(s, i) { paintButton(sortBtns[i], state.sort === s[0], s[1]); });

        // Under the heading (the site rebuilds the panel without it)
        var head = panel.querySelector(":scope > .panel-h");
        var at = head ? head.nextSibling : panel.firstChild;
        if (at !== bar) panel.insertBefore(bar, at);
        var wantNone = shown === 0;
        if (wantNone !== none.isConnected) {
            if (wantNone) bar.insertAdjacentElement("afterend", none);
            else none.remove();
        }

        // Moving a card would take the keyboard out of a comment being typed
        if (panel.contains(document.activeElement) && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName)) return;
        var order = pollOrder(info, state.sort); // see lib.js
        var byId = {};
        info.forEach(function(p) { byId[p.id] = p.el; });
        var same = order.every(function(id, i) { return cards[i] === byId[id]; });
        if (same) return;
        // Where the list ends, so anything the site puts after it stays after it
        var after = cards[cards.length - 1].nextSibling;
        order.forEach(function(id) { panel.insertBefore(byId[id], after); });
    }

    observeBatched(panel, { childList: true, subtree: true }, apply);
    onSetting(function(key) {
        if (key !== POLL_FILTER_KEY) return;
        load();
        apply();
    });
    apply();
}
