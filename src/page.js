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
                // The running world event, with its times in this computer's clock (the site's are
                // the server's, in seconds); id tells one event from the next
                const localEvent = (ev) => ev && ev.kind ? {
                    kind: ev.kind, stage: ev.stage ?? null, name: ev.name ?? null, id: ev.started_at ?? null,
                    until: ev.until ? Math.round(Date.now() + (ev.until - store.now()) * 1000) : null
                } : null;
                const publish = () => {
                    const b = store.state.boss;
                    if (!out || !b) return;
                    out.dataset.boss = JSON.stringify({
                        seq: b.seq, name: b.name, hp: b.hp, max: b.max_hp, phase: b.phase,
                        dmg: b.total_damage, alive: b.status === "alive", event: localEvent(b.event)
                    });
                };
                store.on("boss", publish);
                setInterval(publish, 2000);
                publish();

                // Your lifetime totals, for SESSION (the attack reply refreshes them)
                const publishMe = () => {
                    const m = store.state.me;
                    if (!out || !m || typeof m.total_damage !== "number") return;
                    out.dataset.me = JSON.stringify({ dmg: m.total_damage, hits: m.total_attacks, crits: m.total_crits, shards: m.shards });
                    // The order SHOP lists its loot boxes in (see bagBoxOrder)
                    const order = JSON.stringify(Object.keys((m.shop ?? store.state.content?.shop ?? {}).boxes ?? {}));
                    if (out.dataset.boxOrder !== order) out.dataset.boxOrder = order;
                };
                store.on("me", publishMe);
                publishMe();

                // For the chest ledger (loot.js): each box's stated odds, as outcome -> chance
                const publishOdds = () => {
                    const boxes = store.state.content?.boxes;
                    if (!out || !boxes) return;
                    const all = {};
                    for (const b of boxes) {
                        all[b.id] = { name: b.name, odds: (b.odds ?? []).map((r) => [r.kind === "item" ? (r.rarity || "item")
                            : r.amount ? r.kind + ":" + r.amount : r.kind, r.chance]) };
                    }
                    const text = JSON.stringify(all);
                    if (out.dataset.boxStated !== text) out.dataset.boxStated = text;
                };
                store.on("me", publishOdds);
                publishOdds();

                // ...and your own box openings as they arrive in the feed (only new ones:
                // feed times are in seconds). OPEN ALL is one line with just a count.
                const since = store.now(), seenOpens = new Set();
                store.on("feed", () => {
                    const me = store.state.me;
                    if (!me) return;
                    for (const e of store.state.feed ?? []) {
                        if (e.player_id !== me.id || e.t < since || (e.kind !== "unbox" && e.kind !== "unbox_many")) continue;
                        const id = [e.t, e.kind, e.box_id, e.item_id, e.reward, e.amount, e.count].join("|");
                        if (seenOpens.has(id)) continue;
                        seenOpens.add(id);
                        document.dispatchEvent(new CustomEvent("omhp-unbox", { detail: JSON.stringify({
                            bulk: e.kind === "unbox_many", box: e.box_id ?? null, count: e.count ?? 1,
                            reward: e.reward, rarity: e.rarity, amount: e.amount
                        }) }));
                    }
                });
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
                    document.querySelectorAll("#omhp-pinned .omhp-pin-slot > .panel, .omhp-float-body > .panel").forEach((p) => {
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
        // Player hover cards (HOVER CARDS feature): pause over a name in ATTACKS or CHAT to
        // see their place on this boss's board, and what they've done in the last 5
        // minutes. Badge tags keep the site's own hover box. The board is fetched at most
        // every 30s; it lists the top 10.
        if (${isOn("cards")}) Promise.all([
            import(${JSON.stringify(base + "store.js" + v)}),
            import(${JSON.stringify(base + "api.js" + v)})
        ])
            .then(([store, api]) => {
                const card = document.createElement("div");
                card.className = "omhp-card";
                card.hidden = true;
                document.body.appendChild(card);
                let over = null, timer = 0, board = null, boardSeq = null, boardAt = 0;
                const num = (n) => Math.round(n).toLocaleString("en-US");

                const loadBoard = async () => {
                    const seq = store.state.boss?.seq;
                    if (!seq) return null;
                    if (!board || boardSeq !== seq || Date.now() - boardAt > 30000) {
                        boardSeq = seq;
                        boardAt = Date.now();
                        board = await api.getLeaderboard("boss:" + seq).catch(() => null);
                    }
                    return board;
                };
                // Their hits in the feed over the last 5 minutes (feed times are in seconds)
                const recent = (pid, name) => {
                    const since = store.now() - 300;
                    let dmg = 0, hits = 0;
                    for (const e of store.state.feed ?? []) {
                        if (e.t < since || typeof e.damage !== "number") continue;
                        if (pid ? e.player_id !== pid : e.name !== name) continue;
                        dmg += e.damage;
                        hits++;
                    }
                    return { dmg, hits };
                };
                const line = (label, value) => {
                    const row = document.createElement("div");
                    const k = document.createElement("span");
                    k.className = "k";
                    k.textContent = label;
                    const val = document.createElement("span");
                    val.textContent = value;
                    row.append(k, val);
                    return row;
                };
                const place = (who) => {
                    const r = who.getBoundingClientRect();
                    card.style.left = Math.max(4, Math.min(r.left, window.innerWidth - card.offsetWidth - 4)) + "px";
                    const below = r.bottom + 4;
                    card.style.top = (below + card.offsetHeight > window.innerHeight ? r.top - card.offsetHeight - 4 : below) + "px";
                };
                const paint = (who, d) => {
                    const head = document.createElement("div");
                    head.className = "omhp-card-name";
                    head.textContent = d.name + (d.isMe ? "  (you)" : "");
                    const rows = [head];
                    if (d.lb === undefined) rows.push(line("THIS BOSS", "loading…"));
                    else if (!d.lb) rows.push(line("THIS BOSS", "no board right now"));
                    else {
                        const at = (key) => {
                            if (d.isMe && d.lb.me?.[key]?.rank) return { rank: d.lb.me[key].rank, value: d.lb.me[key].value };
                            const list = d.lb[key] ?? [];
                            const i = list.findIndex((x) => d.pid ? x.player_id === d.pid : x.name === d.name);
                            return i === -1 ? null : { rank: i + 1, value: list[i].value };
                        };
                        const dmg = at("damage"), atk = at("attacks");
                        rows.push(line("THIS BOSS", dmg ? "#" + dmg.rank + " · " + num(dmg.value) + " dmg" : "not in the top 10"));
                        if (atk) rows.push(line("ATTACKS", "#" + atk.rank + " · " + num(atk.value)));
                    }
                    rows.push(line("LAST 5 MIN", d.recent.hits ? num(d.recent.dmg) + " dmg · " + d.recent.hits + " hits" : "no hits in the feed"));
                    card.replaceChildren(...rows);
                    card.hidden = false;
                    place(who);
                };
                const show = async (who) => {
                    const name = who.textContent.trim();
                    let pid = who.closest("li")?.dataset.pid || null;
                    // A chat name has no id on it: find it in the feed
                    if (!pid) pid = (store.state.feed ?? []).find((e) => e.name === name && e.player_id)?.player_id ?? null;
                    const me = store.state.me;
                    const d = { name, pid, isMe: !!me && (pid ? pid === me.id : name === me.name), recent: recent(pid, name) };
                    paint(who, d);
                    d.lb = await loadBoard();
                    if (over === who) paint(who, d);
                };
                document.addEventListener("mouseover", (ev) => {
                    const who = ev.target instanceof Element ? ev.target.closest("#feed .who, #chat-list .who") : null;
                    if (who === over) return;
                    over = who;
                    clearTimeout(timer);
                    card.hidden = true;
                    if (who) timer = setTimeout(() => show(who), 300);
                });
            })
            .catch(() => {
                const out = document.getElementById("omhp-boss-data");
                if (out) out.dataset.fail = [out.dataset.fail, "HOVER CARDS"].filter(Boolean).join(", ");
            });
        // DAILY (shown by the CLOCK): when the next daily reward comes, and whether today's is
        // claimed. Asked every 10 minutes, just after it resets, and (while it's waiting) a
        // minute after your data changes, which is when you claim it.
        if (${isOn("clock")}) Promise.all([
            import(${JSON.stringify(base + "store.js" + v)}),
            import(${JSON.stringify(base + "api.js" + v)})
        ])
            .then(([store, api]) => {
                const out = document.getElementById("omhp-boss-data");
                let timer = 0, asked = 0, claimed = null;
                const load = async () => {
                    clearTimeout(timer);
                    asked = Date.now();
                    let wait = 600000;
                    try {
                        if (store.state.me?.name_chosen) {
                            const d = await api.getDaily();
                            const next = Math.round(Date.now() + ((d?.next_reset ?? 0) - store.now()) * 1000);
                            claimed = !!d?.claimed_today;
                            out.dataset.daily = JSON.stringify({ next, claimed });
                            if (next > Date.now()) wait = Math.min(wait, next - Date.now() + 5000);
                        }
                    } catch (e) { /* not logged in, or the site is busy: ask again later */ }
                    timer = setTimeout(load, wait);
                };
                store.on("me", () => {
                    if (claimed !== true && Date.now() - asked > 60000) load();
                });
                load();
            })
            .catch(() => {
                const out = document.getElementById("omhp-boss-data");
                if (out) out.dataset.fail = [out.dataset.fail, "DAILY"].filter(Boolean).join(", ");
            });
    `;
    var script = document.createElement("script");
    script.type = "module";
    script.textContent = code;
    document.head.appendChild(script);
    script.remove();
}

