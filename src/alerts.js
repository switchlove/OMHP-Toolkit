// The browser tab's title: the site leads it with your attacks, "(3/5) ONE MILLION HP";
// this adds the boss's HP and kill estimate after that, "(3/5) [72% ~39m] ONE MILLION HP".
function tabTitle() {
    function paint() {
        var part = "";
        if (fogged()) part = "[" + (eventTag(false) || "FOG") + "]";
        else {
            var b = trueBoss();
            if (b && b.max && b.alive !== false) part = "[" + (b.hp / b.max * 100).toFixed(0) + "%" + (etaShort ? " " + etaShort : "") +
                (eventTag(false) ? " · " + eventTag(false) : "") + "]";
        }
        var next = titleWith(document.title, part); // see lib.js
        if (next !== document.title) document.title = next;
    }

    var titleEl = document.querySelector("title");
    // The site rewrites the title on every update of your data: add ours back straight away
    if (titleEl) new MutationObserver(paint).observe(titleEl, { childList: true, characterData: true, subtree: true });
    every(5000, paint);
    paint();
}

// Desktop notifications while this tab is in the background (see notify()): attacks
// full, boss killed / new boss, FOG on/off, a new message. Loot is in lootLog().
function notifier() {
    var last = null;

    function dmCount() {
        var t = (tabButton("dms") || {}).textContent || "";
        var m = t.match(/(\d+)\s*\]?\s*$/);
        return m ? Number(m[1]) : 0;
    }

    function check() {
        var pips = document.getElementById("pips");
        var key = ((pips && pips.dataset.key) || "").split("/");
        var b = trueBoss();
        var now = {
            full: Number(key[1]) > 0 && Number(key[0]) >= Number(key[1]),
            seq: b ? b.seq : null,
            alive: b ? b.alive !== false : null,
            fog: fogged(),
            dms: dmCount()
        };
        if (last) {
            if (now.full && !last.full) notify("Your attacks are full (" + key[0] + "/" + key[1] + ")");
            if (now.seq !== null && last.seq !== null && now.seq !== last.seq) notify("A new boss is here: #" + now.seq);
            else if (last.alive && now.alive === false) notify("Boss #" + now.seq + " is down");
            if (now.fog !== last.fog) notify(now.fog ? "FOG has rolled in" : "The FOG has lifted");
            if (now.dms > last.dms) notify("New message (" + now.dms + " unread)");
        }
        last = now;
    }

    every(5000, check);
    check();
}

// SOUNDS > NEW BOSS (MENTION is in chatPlus, AUCTION MATCH in auctionWatch)
function soundAlerts() {
    var seq = null;
    every(5000, function() {
        var b = trueBoss();
        if (!b) return;
        if (seq !== null && b.seq !== seq && isLeader()) playSound("boss");
        seq = b.seq;
    });
}

// CHAT+: a line that mentions you sends a notification (in the background) and plays MENTION;
// Shift-click a name to start a reply ("@NAME "); hover a line's time for when it was sent.
function chatPlus() {
    var list = document.getElementById("chat-list");
    var input = document.getElementById("chat-input");
    if (!list || !input) return false;

    // The site redraws the whole list on each message. Message ids only go up, so only the lines
    // after the newest one already looked at are new; those on screen when the page opened are
    // old news. Walking back from the end stops at the first old line.
    var newest = null;
    function scan() {
        var lines = list.children, top = newest;
        for (var i = lines.length - 1; i >= 0; i--) {
            var id = Number(lines[i].dataset && lines[i].dataset.id);
            if (!id) continue;
            if (newest !== null && id <= newest) break;
            if (top === null || id > top) top = id;
            var li = lines[i];
            if (newest === null || !li.classList.contains("mention-me") || li.classList.contains("me") || !isLeader()) continue;
            notify("Chat: " + ((li.querySelector(".chat-text") || li).textContent || "").trim().slice(0, 120));
            playSound("mention");
        }
        newest = top === null ? 0 : top;
    }
    setTimeout(function() {
        scan();
        observeBatched(list, { childList: true }, scan);
    }, 3000);

    // Shift-click a name: "@NAME " in the chat box (a plain click still opens their gear)
    list.addEventListener("click", function(e) {
        var who = e.shiftKey && e.target.closest ? e.target.closest(".who") : null;
        if (!who || input.disabled) return;
        e.preventDefault();
        e.stopPropagation();
        var name = (who.textContent || "").replace(/[^A-Za-z0-9_]/g, "");
        if (!name) return;
        var at = "@" + name + " ";
        if (input.value.indexOf(at) === -1) input.value += (input.value && !/\s$/.test(input.value) ? " " : "") + at;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }, true);

    // A line's time ("3m") as the date and time it was sent (watched on the two lists only)
    function timeTitle(e) {
        var t = e.target;
        if (!(t instanceof HTMLElement) || !t.classList.contains("t") || !t.dataset.t || t.title) return;
        var secs = Number(t.dataset.t);
        if (secs) t.title = new Date(secs * 1000).toLocaleString();
    }
    [list, document.getElementById("feed")].forEach(function(l) {
        if (l) l.addEventListener("mouseover", timeTitle);
    });
}

