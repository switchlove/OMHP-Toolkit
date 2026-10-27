# OMHP Toolkit

A Tampermonkey userscript for [One Million HP](https://onemillionhp.com/). It adds a three-column layout with pinned and pop-out panels, a boss HP graph with a kill ETA and replay, session, loot and boss logs, alerts, chat and feed filters, saved layouts and colour themes. Almost everything can be switched off in its own settings menu, **[TOOLKIT]**.

[![OMHP Toolkit running on One Million HP](docs/screenshot.png)](docs/screenshot-hq.png)
<sub>Click for the full-size (4K) screenshot.</sub>

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or another userscript manager such as Violentmonkey).
2. Open **[omhp-toolkit.user.js](https://raw.githubusercontent.com/switchlove/OMHP-Toolkit/main/omhp-toolkit.user.js)** and Tampermonkey will offer to install it. You can also install it from **[Greasy Fork](https://greasyfork.org/en/scripts/601490-omhp-toolkit)**.
3. Reload onemillionhp.com.

Tampermonkey checks this repo for updates on its own when the `@version` number goes up.

## Features

The full guide to every feature is in the **[wiki](https://github.com/switchlove/OMHP-Toolkit/wiki)**. In short:

- **[Layout](https://github.com/switchlove/OMHP-Toolkit/wiki/Layout)**: three resizable columns, with ATTACKS, CHAT, MESSAGES, LOOT and BOSSES on the left. Pin up to three right-hand panels, or pop any panel out into a floating window that snaps and tiles.
- **[Boss](https://github.com/switchlove/OMHP-Toolkit/wiki/Boss)**: an ASCII HP graph covering the boss's whole life, with heals, phases, FOG, world events, players online, your damage, zoom, replay and a comparison with the last boss. A kill estimate with a range, and a log of every boss you've seen.
- **[Fight](https://github.com/switchlove/OMHP-Toolkit/wiki/Fight)**: your share of the damage, today's SESSION stats with the last 14 days and your all-time records, FULL IN and IDLE timers, and a LOOT log with drop rates and chest odds.
- **[Shortcuts and filters](https://github.com/switchlove/OMHP-Toolkit/wiki/Shortcuts-and-Filters)**: Alt shortcuts, hide or highlight lines in ATTACKS and CHAT, AUCTION WATCH, chat replies, player hover cards and a compact mode.
- **[Alerts](https://github.com/switchlove/OMHP-Toolkit/wiki/Alerts)**: the boss's HP and kill estimate in the tab title, desktop notifications and sounds.
- **[Toolkit menu](https://github.com/switchlove/OMHP-Toolkit/wiki/Toolkit-Menu)**: colours and themes (shareable as a code), features on and off, saved layouts, backups, storage and a debug report. The top bar also gets a clock and the next DAILY reward.

Everything it keeps stays in your browser; see [Saved Data](https://github.com/switchlove/OMHP-Toolkit/wiki/Saved-Data). Something not working? See [Troubleshooting](https://github.com/switchlove/OMHP-Toolkit/wiki/Troubleshooting).

## Notes

This is an unofficial fan-made script and isn't affiliated with One Million HP. It changes how the page looks on your own screen and reads data the page already has. The only requests it makes are ones the site makes itself: RANKS and HISTORY while they're on screen, the boss's board for HOVER CARDS, the DAILY timer and the searches you watch with AUCTION WATCH. Everything it keeps stays in your browser.

## Development

The userscript is built from the files in `src/`; don't edit `omhp-toolkit.user.js` by hand.

- `src/header.js` holds the userscript header (including `@version`) and the feature notes. `src/style.css` is the stylesheet. Everything else is one part each: `core.js` and `lib.js` (shared helpers), then a file per feature (`graph.js`, `session.js`, `loot.js`, `menu.js`, ...).
- `build.js` joins them, in the order listed at its top, into one function so they share a scope, and writes `omhp-toolkit.user.js`. That file stays committed, because installs and updates point at it.
- `src/lib.js` has the helpers that don't touch the page (formatting, the tab title, SESSION's counting, the ETA, the graph's columns). `test/lib.test.js` tests them.

```sh
npm install      # once: the lint tools
npm run build    # write omhp-toolkit.user.js from src/
npm test         # the tests
npm run lint     # eslint on the built script, the build script and the tests
npm run check    # is the built script up to date, and does it parse?
```

## Releasing

1. Raise `@version` in `src/header.js`, then `npm run build`. Tampermonkey only updates installs when this number goes up, and CI fails any change to the script that doesn't raise it.
2. Update the [wiki](https://github.com/switchlove/OMHP-Toolkit/wiki) (and the feature notes in `src/header.js`, and the README's short feature list if needed) for anything new.
3. Run `npm test` and `npm run lint`.
4. Commit and push to `main`. CI checks that the built script matches `src/`, its syntax, the tests and lint, and the release workflow creates a `vX.Y` GitHub release with the script attached. No manual tagging is needed.

## License

[MIT](LICENSE)

---

<sub>AI disclosure: [Claude](https://claude.ai) was used to help with code review and testing.</sub>
