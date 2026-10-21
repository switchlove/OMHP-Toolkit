# OMHP Toolkit

A Tampermonkey userscript for [One Million HP](https://onemillionhp.com/). It adds a wider three-column layout, pop-out panels, a boss HP graph with a kill ETA, session and loot stats, and colour themes.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or another userscript manager such as Violentmonkey).
2. Open **[omhp-toolkit.user.js](https://raw.githubusercontent.com/switchlove/OMHP-Toolkit/main/omhp-toolkit.user.js)**. Tampermonkey will offer to install it.
3. Reload onemillionhp.com.

Tampermonkey checks this repo for updates on its own when the `@version` number goes up.

## Features

### Layout
- Three columns: feed/chat/messages | boss | side panels. Under 1300px wide, the left column moves below everything else.
- Left column with ATTACKS, CHAT, MESSAGES and LOOT sections. Each one collapses, moves up or down, pops out, and resizes by dragging its bottom edge.
- Drag the gaps between columns to resize them. Double-click any drag handle to reset it.
- The boss column and the right column stay pinned in view while you scroll.
- A flat tab bar in the right column: every unlocked tab is a button, with short labels and no dropdowns.
- **[PIN]** keeps the open panel above the others. **[POP OUT]** opens it in a floating window.
- Floating windows can be dragged, resized, minimised and faded, and several can be open at once.
- Hides clutter: the duplicate MESSAGES heading, the key hints and the footer (the site's error line stays).

### Boss
- An ASCII HP graph next to the boss art covering the boss's whole life since you first saw it, kept across reloads. It marks heals, phase changes and players online, and hovering shows the values for that moment.
- HP/min, everyone's DMG/min, HP healed and an estimated kill time.
- During the FOG event it uses the site's real data and never records the fake HP.

### Fight
- **YOUR SHARE**: your percentage of all the damage on this boss.
- **SESSION**: damage since the page opened, damage per hour, best hit, average hit and crit rate.
- **FULL IN**: time until every attack slot has refilled.
- **LOOT**: what you found this session, counted by rarity.

### Top bar
- **[COLOUR]**: a highlight colour, plus full themes (TERMINAL, MIDNIGHT, PHOSPHOR, PAPER).
- Local time and how long the page has been open.
- The account button shows your badges and name.

Your layout, sizes, order, colours and HP history are saved in your browser's localStorage.

## Notes

This is an unofficial fan-made script and isn't affiliated with One Million HP. It only changes how the page looks on your own screen and reads data the page already has.

## License

[MIT](LICENSE)
