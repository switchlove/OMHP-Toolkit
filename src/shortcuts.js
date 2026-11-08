// Alt + key shortcuts (the site's own keys use no modifier, and it ignores Alt):
// Alt+1..9 picks a tab in the right column, Alt+P pins, Alt+O pops out, Alt+T opens
// [TOOLKIT]. Matched by the physical key, so they work on any keyboard layout. Esc leaves a
// text box.
function shortcuts() {
    document.addEventListener("keydown", function(e) {
        if (!e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
        var t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        var digit = /^Digit([1-9])$/.exec(e.code);
        var btn = null;
        if (digit) {
            var tabs = Array.prototype.filter.call(document.querySelectorAll("#tabs [role=tab]"), function(b) {
                return !b.hidden && LEFT_TABS.indexOf(b.dataset.tab) === -1;
            });
            btn = tabs[Number(digit[1]) - 1];
        } else if (e.code === "KeyP") btn = document.querySelector("#tabs .omhp-pin");
        else if (e.code === "KeyO") btn = document.querySelector("#tabs .omhp-popout");
        else if (e.code === "KeyT") btn = document.getElementById("omhp-accent");
        if (!btn || btn.disabled) return;
        e.preventDefault();
        btn.click();
    });
    // Esc leaves a text box (CHAT, DMs...), so Space and the site's other keys attack again. The
    // chat's emote / name picker takes the first Esc itself (it marks the key handled).
    document.addEventListener("keydown", function(e) {
        var t = e.target;
        if (e.key !== "Escape" || e.defaultPrevented || !t) return;
        if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) t.blur();
    });
}

