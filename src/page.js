// Show the account button as your badges + name, like YOU > PROFILE's NAME row.
// Imports the site's own modules (same ?v= URL, so the same running copies)
// to reuse its state and badge drawing. Tampermonkey can run this script in
// a separate sandbox where those imports would be fresh, empty copies, so
// this part is injected into the page itself as a <script>.
function paintAccount() {
    // Where the page script publishes the boss's real numbers (read by trueBoss())
    var bridge = document.createElement("meta");
    bridge.id = "omhp-boss-data";
    document.head.appendChild(bridge);
    var main = document.querySelector('script[src*="js/main.js"]');
    if (!main) return;
    var v = new URL(main.src).search;
    var base = new URL("./", main.src).href; // the folder main.js is in

    var code = `
        Promise.all([import(${JSON.stringify(base + "store.js" + v)}), import(${JSON.stringify(base + "ui/badges.js" + v)})])
            .then(([store, badges]) => {
                const acct = ${isOn("account") ? 'document.getElementById("acct")' : "null"};
                let watcher = null;
                const paint = () => {
                    if (!acct) return; // NAME feature off, or no account button
                    try {
                        const me = store.state.me;
                        // Not logged in: keep the site's [LOG IN]
                        if (!me || !me.login || !me.name) return;
                        const tag = badges.badgeTag(me.badges, me.id);
                        if (tag) acct.replaceChildren(tag, " " + me.name);
                        else acct.replaceChildren(me.name);
                        watcher?.takeRecords(); // our own change: don't react to it
                    } catch (e) {
                        /* leave the site's own button as it is */
                    }
                };
                // The site resets the button to [login] on every player update, and its
                // handler can run after ours, so repaint whenever it overwrites the button.
                if (acct) {
                    watcher = new MutationObserver(paint);
                    watcher.observe(acct, { childList: true, characterData: true, subtree: true });
                    store.on("me", paint);
                    paint();
                }

                // The boss's real numbers for the rest of the script. During the FOG world
                // event the site draws fake HP on screen, but its own data stays true.
                const out = document.getElementById("omhp-boss-data");
                const publish = () => {
                    const b = store.state.boss;
                    if (!out || !b) return;
                    out.dataset.boss = JSON.stringify({
                        seq: b.seq, name: b.name, hp: b.hp, max: b.max_hp, phase: b.phase,
                        dmg: b.total_damage, alive: b.status === "alive"
                    });
                };
                store.on("boss", publish);
                setInterval(publish, 2000);
                publish();

                // Your lifetime totals, for SESSION (the attack reply refreshes them)
                const publishMe = () => {
                    const m = store.state.me;
                    if (!out || !m || typeof m.total_damage !== "number") return;
                    out.dataset.me = JSON.stringify({ dmg: m.total_damage, hits: m.total_attacks, crits: m.total_crits });
                    // The order SHOP lists its loot boxes in (see bagBoxOrder)
                    const order = JSON.stringify(Object.keys((m.shop ?? store.state.content?.shop ?? {}).boxes ?? {}));
                    if (out.dataset.boxOrder !== order) out.dataset.boxOrder = order;
                };
                store.on("me", publishMe);
                publishMe();
            })
            .catch(() => {
                // The site changed its files: the rest of the script falls back to the screen
                const out = document.getElementById("omhp-boss-data");
                if (out) out.dataset.fail = [out.dataset.fail, "SITE DATA"].filter(Boolean).join(", ");
            });

        // The site only redraws the selected tab's panel when your data changes, so a
        // panel that's pinned or popped out (see pinPanel / floatingPanels) would go
        // stale. Redraw those too. These drawers only read the site's state.
        Promise.all([
            import(${JSON.stringify(base + "store.js" + v)}),
            import(${JSON.stringify(base + "ui/tabs.js" + v)}),
            import(${JSON.stringify(base + "ui/bag.js" + v)}),
            import(${JSON.stringify(base + "ui/player.js" + v)}),
            import(${JSON.stringify(base + "ui/shop.js" + v)}),
            import(${JSON.stringify(base + "ui/ranks.js" + v)}),
            import(${JSON.stringify(base + "ui/history.js" + v)})
        ])
            .then(([store, tabs, bag, player, shop, ranks, history]) => {
                // RANKS and HISTORY only fetch when their tab is opened. Reload them while
                // they're on screen (selected, pinned or popped out), this browser tab is
                // visible, and you aren't typing in them. CITY and AUCTION refresh themselves.
                [["ranks", () => ranks.loadRanks(true), 30000], ["history", () => history.loadHistory(), 60000]].forEach(([key, load, ms]) => {
                    setInterval(() => {
                        const p = document.getElementById("panel-" + key);
                        if (document.hidden || !p || p.hidden || !p.offsetParent || p.contains(document.activeElement)) return;
                        Promise.resolve(load()).catch(() => {});
                    }, ms);
                });
                const draw = {
                    bag: bag.renderBag, collection: bag.renderCollection,
                    player: player.renderPlayer, inventory: player.renderInventory, shop: shop.renderShop
                };
                store.on("me", () => {
                    document.querySelectorAll("#omhp-pinned > .panel, .omhp-float-body > .panel").forEach((p) => {
                        const key = p.id.replace(/^panel-/, "");
                        if (key === tabs.currentTab() || typeof draw[key] !== "function") return; // the site draws that one
                        try { draw[key](); } catch (e) { /* leave it as it was */ }
                    });
                });
            })
            .catch(() => {
                // The site changed its files: pinned panels and RANKS just won't refresh
                const out = document.getElementById("omhp-boss-data");
                if (out) out.dataset.fail = [out.dataset.fail, "PANEL REFRESH"].filter(Boolean).join(", ");
            });
    `;
    var script = document.createElement("script");
    script.type = "module";
    script.textContent = code;
    document.head.appendChild(script);
    script.remove();
}

