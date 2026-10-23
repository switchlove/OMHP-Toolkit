// ==UserScript==
// @name         OMHP Toolkit
// @namespace    https://github.com/switchlove/OMHP-Toolkit
// @version      0.28
// @description  Three-column layout with pinned and pop-out panels, a boss HP graph with kill ETA and replay, session, loot and boss logs, alerts, chat filters, saved layouts and colour themes for One Million HP
// @author       switchlove
// @license      MIT
// @homepageURL  https://github.com/switchlove/OMHP-Toolkit
// @supportURL   https://github.com/switchlove/OMHP-Toolkit/issues
// @updateURL    https://raw.githubusercontent.com/switchlove/OMHP-Toolkit/main/omhp-toolkit.user.js
// @downloadURL  https://raw.githubusercontent.com/switchlove/OMHP-Toolkit/main/omhp-toolkit.user.js
// @match        https://onemillionhp.com/*
// @match        https://www.onemillionhp.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=onemillionhp.com
// @grant        none
// ==/UserScript==

// What this does:
//
// LAYOUT
//   - Widens the page to three columns: feed/chat/messages | boss | side panels.
//     Under 1300px wide the left column drops below everything else.
//   - Left column: ATTACKS, CHAT, MESSAGES, LOOT and BOSSES sections. Each one collapses,
//     moves up/down, pops out, and resizes by dragging its bottom edge.
//   - Drag the gaps between columns to resize them. Double-click any drag handle to reset.
//   - The boss column and the right column stay pinned in view while you scroll.
//   - Right column: a flat tab bar (every unlocked tab as a button, short labels, no
//     dropdowns). [PIN] keeps the open panel above the others, up to three stacked, each
//     with its own resize line and [UNPIN]. [POP OUT] opens it in a floating window.
//     BAG's loot-box cards are smaller so more fit across, and in the same order as
//     SHOP. RANKS (30s) and HISTORY (60s) refresh while they're on screen. CLAN's
//     MEMBERS list folds away with [-] / [+] on its heading.
//   - Floating windows can be dragged, resized, minimised and faded, and you can have
//     several open at once. They snap to the screen's edges and to each other (hold
//     Shift to place one freely); [TOOLKIT] > LAYOUT > TILE lays them out in a grid.
//   - Hides the clutter: the duplicate MESSAGES heading, the key hints and the
//     footer (the site's error line stays).
//
// BOSS
//   - An ASCII HP graph next to the boss art, covering the boss's whole life since
//     you first saw it (kept across reloads). It marks heals, phase changes, FOG, players
//     online and your own damage (those two on a scale at the right); hovering shows the
//     readout for that moment, and clicking a legend entry hides or shows it.
//   - Under the HP: HP/min, everyone's DMG/min, HP healed, and an estimated kill time
//     with a range (what the last 1 and 15 minutes say).
//   - [ALL] [1H] [15M] on the graph zoom in on the recent part of a long fight.
//   - BOSSES: every boss you've seen, with how long it lasted, your damage and share,
//     peak players online and HP healed; [GRAPH] opens its HP graph in a window.
//   - During the FOG event it uses the site's real data and never records the fake HP.
//
// FIGHT
//   - YOUR SHARE: your percentage of all the damage on this boss.
//   - SESSION (its own box under FIGHT): your damage today, per hour, attacks, best and
//     average hit, crit rate, shards earned and spent, shards per hour and time played.
//     Kept across reloads until [RESET] or a new day; [DAYS] shows the last 14 days.
//     Hover AVG HIT for the spread of your last 200 hits.
//   - FULL IN: time until every attack slot has refilled, and IDLE: how long today
//     your attacks sat full, recharging nothing.
//   - LOOT: what you found today, counted by rarity with drops per 100 attacks (kept like
//     SESSION, with [RESET]; hover for the last 30 days). [CHESTS] compares what your
//     box openings gave with the site's stated odds.
//
// TOP BAR
//   - [TOOLKIT]: highlight colour, themes (TERMINAL, MIDNIGHT, PHOSPHOR, PAPER, or your
//     own CUSTOM colours, shareable as a code), FEATURES
//     to switch parts of this script on or off (applies on reload), the loot alert
//     rarity, the shortcut keys, add-ons it found, saved LAYOUTs, and EXPORT / IMPORT
//     of everything as a backup file.
//   - Local time and how long the page has been open.
//   - The account button shows your badges and name instead of [LOGIN].
//   - A "⚠ N OFF" warning if parts of this script couldn't start (the site changed).
//
// MORE
//   - Alt shortcuts: Alt+1..9 picks a right-column tab, Alt+P pins, Alt+O pops out,
//     Alt+T opens [TOOLKIT].
//   - FILTER on ATTACKS and CHAT: hide lines with some words or names, highlight others.
//   - COMPACT (off by default): tighter lines and spacing everywhere.
//   - HOVER CARDS: pause over a name in ATTACKS or CHAT for their place on this boss's
//     board and their damage in the last 5 minutes.
//   - [REPLAY] on the HP graph plays the boss's history back from the start.
//   - STATS THEME: if Zephy's "1MHP Data Statistics" userscript is installed, its panel
//     takes on this page's theme and highlight colour.
//
// ALERTS
//   - The browser tab's title adds the boss's HP and kill estimate: "(3/5) [72% ~39m] ...".
//   - NOTIFY (off by default): desktop notifications while the tab is in the background
//     for full attacks, boss down / new boss, FOG, new messages and loot from a set rarity.
//
// Your layout, sizes, order, colours, features, HP history, session and loot are saved in
// localStorage. With the game open in several tabs, one records and the others follow it.

