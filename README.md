# OMHP Toolkit

A Tampermonkey userscript for [One Million HP](https://onemillionhp.com/). It adds a wider three-column layout, pop-out panels, a boss HP graph with a kill ETA, session and loot stats, and colour themes.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or another userscript manager such as Violentmonkey).
2. Open **[omhp-toolkit.user.js](https://raw.githubusercontent.com/switchlove/OMHP-Toolkit/main/omhp-toolkit.user.js)** and Tampermonkey will offer to install it. You can also install it from **[Greasy Fork](https://greasyfork.org/en/scripts/601490-omhp-toolkit)**.
3. Reload onemillionhp.com.

Tampermonkey checks this repo for updates on its own when the `@version` number goes up.

## Features

### Layout
- Three columns: feed/chat/messages | boss | side panels. Under 1300px wide, the left column moves below everything else.
- Left column with ATTACKS, CHAT, MESSAGES and LOOT sections. Each one collapses, moves up or down, pops out, and resizes by dragging its bottom edge.
- Drag the gaps between columns to resize them. Double-click any drag handle to reset it.
- The boss column and the right column stay pinned in view while you scroll.
- A flat tab bar in the right column: every unlocked tab is a button, with short labels and no dropdowns.
- **[PIN]** keeps the open panel above the others. Drag the line under it to split the column's height between the two panels. **[POP OUT]** opens it in a floating window.
- BAG's loot-box cards are smaller, so more fit across the right column.
- Floating windows can be dragged, resized, minimised and faded, and several can be open at once.
- Hides clutter: the duplicate MESSAGES heading, the key hints and the footer (the site's error line stays).

### Boss
- An ASCII HP graph next to the boss art covering the boss's whole life since you first saw it, kept across reloads. It marks heals, phase changes and players online, and hovering shows the values for that moment.
- HP/min, everyone's DMG/min, HP healed and an estimated kill time.
- During the FOG event it uses the site's real data and never records the fake HP.

### Fight
- **YOUR SHARE**: your percentage of all the damage on this boss.
- **SESSION**: your damage today, damage per hour (counting only the time the page was open), best hit, average hit and crit rate. It carries over when you reload and starts again at midnight or when you click **[RESET]**.
- **FULL IN**: time until every attack slot has refilled.
- **LOOT**: what you found today, counted by rarity. Like SESSION, it carries over when you reload and has its own **[RESET]**.

### Top bar
- **[COLOUR]**: a highlight colour, plus full themes (TERMINAL, MIDNIGHT, PHOSPHOR, PAPER).
- **FEATURES** (inside [COLOUR]): switch off any of the HP graph, ETA, share, session, FULL IN, loot, clock, flat tabs or account name. Changes apply after a reload.
- Local time and how long the page has been open.
- The account button shows your badges and name.

Your layout, sizes, order, colours, feature choices, HP history, session and loot are saved in your browser's localStorage.

## Notes

This is an unofficial fan-made script and isn't affiliated with One Million HP. It only changes how the page looks on your own screen and reads data the page already has.

## Releasing

1. Raise `@version` in `omhp-toolkit.user.js`. Tampermonkey only updates installs when this number goes up.
2. Commit and push to `main`.
3. Tag it: `git tag vX.Y` and `git push --tags`, or `gh release create vX.Y omhp-toolkit.user.js`.

## License

[MIT](LICENSE)
