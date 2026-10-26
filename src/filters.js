// FILTER on the ATTACKS and CHAT headers: hide lines with any of some words or names,
// and highlight lines with others (your name, your clan...). Saved; applies to both.
var FILTER_KEY = "omhp.layout.filters";
var filterEditor = null; // set by lineFilters(); builds the boxes FILTER opens

function lineFilters() {
    var lists = [document.getElementById("feed"), document.getElementById("chat-list")].filter(Boolean);
    if (!lists.length) return false;
    var f = Object.assign({ hide: [], mark: [] }, loadSaved(FILTER_KEY));

    function has(words, text) {
        return words.some(function(w) { return text.indexOf(w) !== -1; });
    }

    function apply(li) {
        if (li.nodeType !== 1 || li.tagName !== "LI") return;
        var text = (li.textContent || "").toLowerCase();
        li.classList.toggle("omhp-hide", has(f.hide, text));
        li.classList.toggle("omhp-mark", has(f.mark, text));
    }

    function applyAll() {
        lists.forEach(function(l) { Array.prototype.forEach.call(l.children, apply); });
    }

    lists.forEach(function(l) {
        new MutationObserver(function(records) {
            records.forEach(function(r) { r.addedNodes.forEach(apply); });
        }).observe(l, { childList: true });
    });
    applyAll();
    onSetting(function(key) {
        if (key !== FILTER_KEY) return;
        f = Object.assign({ hide: [], mark: [] }, loadSaved(FILTER_KEY));
        applyAll();
    });

    filterEditor = function() {
        var box = document.createElement("div");
        box.className = "omhp-filter";
        [["hide", "HIDE", "lines with any of these words or names are hidden"],
            ["mark", "MARK", "lines with any of these words or names are highlighted"]].forEach(function(r) {
            var label = document.createElement("label");
            label.appendChild(document.createTextNode(r[1]));
            var input = document.createElement("input");
            input.type = "text";
            input.className = "omhp-filter-in";
            input.placeholder = "words or names, comma-separated";
            input.title = r[2] + " (in ATTACKS and CHAT)";
            input.value = f[r[0]].join(", ");
            input.addEventListener("change", function() {
                f[r[0]] = input.value.split(",").map(function(w) { return w.trim().toLowerCase(); }).filter(Boolean);
                save(FILTER_KEY, f);
                applyAll();
            });
            label.appendChild(input);
            box.appendChild(label);
        });
        return box;
    };
}

