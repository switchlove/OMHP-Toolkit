// Local time and how long the page has been open, in the top bar, and the next DAILY.
var DAILY_NOTE_KEY = "omhp.layout.dailyNote"; // the day DAILY's reminder was last sent

function clock() {
    var bar = document.getElementById("statusline");
    if (!bar) return false;
    var span = document.createElement("span");
    span.id = "omhp-clock";
    span.className = "dim";
    var started = Date.now();

    function tick() {
        var mins = Math.floor((Date.now() - started) / 60000);
        span.textContent = new Date().toTimeString().slice(0, 5) + " · OPEN " + dur(mins);
    }

    addToBar(bar, span);

    // DAILY: time to the next daily reward, or READY while today's is waiting (the page script
    // asks the site; see page.js). NOTIFY reminds you once a day after it's waited 30 minutes.
    var bridge = document.getElementById("omhp-boss-data");
    var daily = document.createElement("span");
    bar.appendChild(daily);
    var waitingSince = null;
    function paintDaily() {
        var d = null;
        try { d = JSON.parse((bridge && bridge.dataset.daily) || "null"); } catch (e) { /* none yet */ }
        daily.textContent = "";
        daily.className = "";
        if (!d) return;
        if (!d.claimed || d.next <= Date.now()) {
            daily.textContent = " · DAILY READY";
            daily.className = "omhp-daily-ready";
            daily.title = "today's DAILY reward is waiting";
            if (waitingSince === null) waitingSince = Date.now();
            if (Date.now() - waitingSince > 30 * 60000 && loadJSON(DAILY_NOTE_KEY, null) !== today()) {
                save(DAILY_NOTE_KEY, today());
                notify("Your DAILY reward is waiting");
            }
        } else {
            waitingSince = null;
            daily.textContent = " · DAILY " + dur((d.next - Date.now()) / 60000);
            daily.title = "time to the next DAILY reward";
        }
    }
    if (bridge) new MutationObserver(paintDaily).observe(bridge, { attributes: true, attributeFilter: ["data-daily"] });
    every(30000, paintDaily);
    tick();
    every(15000, tick, { visible: true });
}

