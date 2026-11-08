var LEFT_TABS = ["feed", "chat", "both", "dms"];
var SECTIONS = [
    { key: "feed", panel: "panel-feed", title: "ATTACKS", scroller: "#feed" },
    { key: "chat", panel: "panel-chat", title: "CHAT", scroller: "#chat-list" },
    { key: "dms", panel: "panel-dms", title: "MESSAGES", scroller: "#panel-dms" },
    { key: "loot", panel: "omhp-loot", title: "LOOT", scroller: "#omhp-loot-list" }, // built by lootLog()
    { key: "bosses", panel: "omhp-bosses", title: "BOSSES", scroller: "#omhp-bosses-list" } // built by bossLog()
];
var ORDER_KEY = "omhp.layout.order";
var THEME_KEY = "omhp.layout.theme";
var PIN_KEY = "omhp.layout.pinned";
// Each theme's colours; mist is the background mist's (with [TOOLKIT] > MIST > THEME)
var THEMES = [
    { name: "TERMINAL", vars: null }, // the site's own colours
    { name: "MIDNIGHT", vars: { bg: "#0b1020", "bg-2": "#121a30", fg: "#dfe6f5", dim: "#7f8aa6", faint: "#2c3550", mist: "#6a7fb4" } },
    { name: "PHOSPHOR", vars: { bg: "#040904", "bg-2": "#0a140a", fg: "#b6ffb0", dim: "#5f9a5a", faint: "#1f3a1f", mist: "#58b852" } },
    { name: "PAPER", vars: { bg: "#f4efe2", "bg-2": "#e9e2d0", fg: "#2a2620", dim: "#6e665a", faint: "#c9c0ab", mist: "#8c826e" } }
];
var STORE_KEY = "omhp.layout.collapsed";
var HEIGHTS_KEY = "omhp.layout.heights";
var WIDTHS_KEY = "omhp.layout.widths";
var ACCENT_KEY = "omhp.layout.accent";
var ACCENTS = [
    { name: "AMBER", hex: "#ffb000" },
    { name: "GREEN", hex: "#9bff7a" },
    { name: "CYAN", hex: "#5fe0ff" },
    { name: "PINK", hex: "#ff6ad5" },
    { name: "RED", hex: "#ff5340" },
    { name: "VIOLET", hex: "#b28bff" },
    { name: "WHITE", hex: "#e8e1cb" }
];
var ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
// The site's item rarities, lowest first (its r-* classes), in HELP > RARITIES' order: BOSS
// UNIQUE beats ASCENDED, SOVEREIGN beats both
var RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "godly", "ascended", "boss_unique", "sovereign"];
var NOTIFY_RARITY_KEY = "omhp.layout.notifyRarity";
// What a layout is made of (presets, RESET): column sizes, section order and heights,
// collapsed sections, the pinned panel and its height, pop-out windows
var LAYOUT_KEYS = [ORDER_KEY, STORE_KEY, "omhp.layout.heights", "omhp.layout.widths", "omhp.layout.pinH", "omhp.layout.floats", PIN_KEY];
var DAYS_KEY = "omhp.days";
var PRESETS_KEY = "omhp.presets";

