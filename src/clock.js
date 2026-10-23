// Local time and how long the page has been open, in the top bar.
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
    tick();
    every(15000, tick, { visible: true });
}

