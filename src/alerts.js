// The browser tab's title: the site leads it with your attacks, "(3/5) ONE MILLION HP";
// this adds the boss's HP and kill estimate after that, "(3/5) [72% ~39m] ONE MILLION HP".
function tabTitle() {
    function paint() {
        var part = "";
        if (fogged()) part = "[FOG]";
        else {
            var b = trueBoss();
            if (b && b.max && b.alive !== false) part = "[" + (b.hp / b.max * 100).toFixed(0) + "%" + (etaShort ? " " + etaShort : "") + "]";
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

