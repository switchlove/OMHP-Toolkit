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
- RANKS (every 30 seconds) and HISTORY (every minute) reload while they're on screen (open, pinned or popped out), instead of only when you open the tab.
- Floating windows can be dragged, resized, minimised and faded, and several can be open at once.
- Hides clutter: the duplicate MESSAGES heading, the key hints and the footer (the site's error line stays).

### Boss
- An ASCII HP graph next to the boss art covering the boss's whole life since you first saw it, kept across reloads. It marks heals, phase changes and players online, and hovering shows the values for that moment.
- HP/min, everyone's DMG/min, HP healed and an estimated kill time.
- During the FOG event it uses the site's real data and never records the fake HP.

### Fight
- **YOUR SHARE**: your percentage of all the damage on this boss.
- **SESSION**: your damage today, damage per hour (counting only the time the game was open), best hit, average hit and crit rate. It carries over when you reload and starts again at midnight or when you click **[RESET]**. **[DAYS]** shows your last 14 days: damage, damage per hour, hits, crit rate and loot.
- **FULL IN**: time until every attack slot has refilled.
- **LOOT**: what you found today, counted by rarity. Like SESSION, it carries over when you reload and has its own **[RESET]**.

### Alerts
- The browser tab's title shows the boss's HP and kill estimate after the site's attack count, e.g. `(3/5) [72% ~39m] ONE MILLION HP`, or `[FOG]` during FOG.
- **NOTIFY** (off until you turn it on in FEATURES): desktop notifications while the tab is in the background, for full attacks, a boss going down or a new one arriving, FOG starting or ending, new messages, and loot from a rarity you pick (**LOOT ALERT** in [TOOLKIT], LEGENDARY or better by default).

### Top bar
- **[TOOLKIT]**: the toolkit's settings menu.
  - **COLOUR** and **THEME**: a highlight colour, plus full themes (TERMINAL, MIDNIGHT, PHOSPHOR, PAPER).
  - **FEATURES**: switch any of the HP graph, ETA, share, session, FULL IN, loot, clock, flat tabs, account name, tab title or notifications on or off. Changes apply after a reload.
  - **LOOT ALERT**: the lowest rarity that gets a notification.
  - **LAYOUT**: switch between layouts. **DEFAULT** puts everything back to how it started, **BOSS FOCUS** collapses the left column, and **+ SAVE** stores your current layout (column sizes, section order and heights, pins and pop-out windows) under a name.
  - **BACKUP**: **EXPORT** downloads all your toolkit settings, layouts and stats as a file; **IMPORT** loads one, for example in another browser.
- **⚠ N OFF** appears if parts of the toolkit couldn't start, for example after a site update. Hover it to see which.
- Local time and how long the page has been open.
- The account button shows your badges and name.

Your layout, sizes, order, colours, feature choices, HP history, session and loot are saved in your browser's localStorage. With the game open in more than one tab, one tab records the HP history and loot and the others show what it saves, so nothing is counted twice.

## Notes

This is an unofficial fan-made script and isn't affiliated with One Million HP. It only changes how the page looks on your own screen and reads data the page already has.

## Releasing

1. Raise `@version` in `omhp-toolkit.user.js`. Tampermonkey only updates installs when this number goes up.
2. Commit and push to `main`.
3. Tag it: `git tag vX.Y` and `git push --tags`, or `gh release create vX.Y omhp-toolkit.user.js`.

## License

[MIT](LICENSE)
