// ─── House Themes ─────────────────────────────────────────────────────────────
export const HOUSES = {
  red: {
    name: "Gryffindor",
    primary: "#740001",
    secondary: "#D3A625",
    accent: "#E8503A",
    symbol: "🦁",
    sigil: "G",
  },
  blue: {
    name: "Ravenclaw",
    primary: "#0C1A40",
    secondary: "#946B2D",
    accent: "#4A90D9",
    symbol: "🦅",
    sigil: "R",
  },
  green: {
    name: "Slytherin",
    primary: "#1A3A2A",
    secondary: "#AAAAAA",
    accent: "#2EA94B",
    symbol: "🐍",
    sigil: "S",
  },
  yellow: {
    name: "Hufflepuff",
    primary: "#372E29",
    secondary: "#F0C75E",
    accent: "#F7C948",
    symbol: "🦡",
    sigil: "H",
  },
} as const;

// ─── Character Names per Value ────────────────────────────────────────────────
export const CHAR_NAMES: Record<number, string> = {
  1:  "Erstjähriger",
  2:  "Geist",
  3:  "Schüler",
  4:  "Prefekt",
  5:  "Quidditch",
  6:  "Expelliarmus",
  7:  "Auror",
  8:  "Zaubertrank",
  9:  "Lehrer",
  10: "Kopfschüler",
  11: "Orden",
  12: "Ministerium",
  13: "Großmeister",
};

// ─── Wizard Characters ────────────────────────────────────────────────────────
export const WIZARD_CHARS = [
  { name: "Albus", title: "Schulleiter", color: "#9B59B6" },
  { name: "Salazar", title: "Gründer", color: "#2ECC71" },
  { name: "Tom", title: "Dunkler Lord", color: "#E74C3C" },
  { name: "Minerva", title: "Professorin", color: "#3498DB" },
];

// ─── Fool Characters ──────────────────────────────────────────────────────────
export const FOOL_CHARS = [
  { name: "Dobby", title: "Freier Elf", color: "#95A5A6" },
  { name: "Peeves", title: "Poltergeist", color: "#E67E22" },
  { name: "Neville", title: "Tollpatsch", color: "#F39C12" },
  { name: "Luna", title: "Traumtänzerin", color: "#BDC3C7" },
];

// ─── Special Cards ─────────────────────────────────────────────────────────────
export const SPECIAL_CARDS = [
  { id: "dragon",       type: "dragon",       name: "Seidenschnabel", subtitle: "Schlägt alles außer die Fee" },
  { id: "fairy",        type: "fairy",        name: "Fee",             subtitle: "Verliert immer – außer der Drache spielt" },
  { id: "witch",        type: "witch",        name: "Bellatrix",       subtitle: "Narr + Karte tauschen" },
  { id: "werewolf",     type: "werewolf",     name: "Lupin",           subtitle: "Bestimmt Stichfarbe für ganze Runde" },
  { id: "vampire",      type: "vampire",      name: "Quirrell",        subtitle: "Kopiert Trumpf für diesen Stich" },
  { id: "bomb",         type: "bomb",         name: "Elderstab",       subtitle: "Annulliert den Stich" },
  { id: "rainbow7",     type: "rainbow7",     name: "George Weasley",  subtitle: "Wert 7½ · freie Farbe · Karte weitergeben" },
  { id: "rainbow9",     type: "rainbow9",     name: "Gleis 9¾",        subtitle: "Wert 9¾ · freie Farbe · Ansage ±1" },
  { id: "wizardfool",   type: "wizardfool",   name: "Ron Weasley",     subtitle: "Du wählst: Zauberer oder Narr" },
] as const;

export type SpecialCardType = typeof SPECIAL_CARDS[number]["type"];
