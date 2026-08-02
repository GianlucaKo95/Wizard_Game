// Run with:  deno test logic_test.ts   — or —   npx tsx logic_test.ts
import {
  trickWinner, trickWinnerWithoutBomb, calcScore, forbiddenDealerBid,
  aiBid, isAlwaysPlayable, aiChooseCard, buildDeck, aiWorstCard,
  aiChooseRainbowSuit, cardLabel,
} from "./logic.ts";

let passed = 0, failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓", name); }
  catch (e) { failed++; console.error("  ✗", name, "—", (e as Error).message); }
}
function eq(actual: unknown, expected: unknown, msg = "") {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const n = (suit: string, value: number) => ({ id: `${suit}-${value}`, type: "number", suit, value });
const wiz = () => ({ id: "w", type: "wizard", suit: null, value: 14 });
const fool = () => ({ id: "f", type: "fool", suit: null, value: 0 });
const sp = (t: string, extra = {}) => ({ id: t, type: "special", specialType: t, suit: null, value: 0, ...extra });
const T = (...cards: any[]) => cards.map((card, playerIndex) => ({ card, playerIndex }));

console.log("── Stichwertung (Basis) ──");
test("höchste Karte der Stichfarbe gewinnt", () =>
  eq(trickWinner(T(n("red", 5), n("red", 11), n("blue", 13)), null), 1));
test("Trumpf schlägt Stichfarbe", () =>
  eq(trickWinner(T(n("red", 13), n("blue", 2)), "blue"), 1));
test("erster Zauberer gewinnt sofort", () =>
  eq(trickWinner(T(n("red", 13), wiz(), wiz()), "red"), 1));
test("Narr verliert immer", () =>
  eq(trickWinner(T(fool(), n("green", 1)), null), 1));
test("nur Narren → erster Narr gewinnt", () =>
  eq(trickWinner(T(fool(), fool(), fool()), "red"), 0));

console.log("── Narr/Zauberer führt (Bedienregeln via Lead) ──");
test("Narr führt → zweite Karte etabliert Stichfarbe", () =>
  // fool, green4, red13 (rot ist NICHT trumpf): green4 gewinnt, red13 bedient nicht
  eq(trickWinner(T(fool(), n("green", 4), n("red", 13)), null), 1));

console.log("── 30 Jahre: Drache & Fee ──");
test("Drache schlägt alles inkl. Zauberer", () =>
  eq(trickWinner(T(wiz(), sp("dragon")), "red"), 1));
test("Fee schlägt den Drachen", () =>
  eq(trickWinner(T(sp("dragon"), sp("fairy"), n("red", 13)), "red"), 1));
test("Fee ohne Drache verliert", () =>
  eq(trickWinner(T(sp("fairy"), n("red", 2)), null), 1));

console.log("── 30 Jahre: Hexe ──");
test("Hexe verliert immer", () =>
  eq(trickWinner(T(sp("witch"), n("red", 1)), null), 1));

console.log("── Rangfolge unter passiven Karten: Hexe < Fee < Narr ──");
test("Narr schlägt Fee (kein Drache)", () =>
  eq(trickWinner(T(sp("fairy"), fool()), null), 1));
test("Narr schlägt Hexe", () =>
  eq(trickWinner(T(sp("witch"), fool()), null), 1));
test("Fee schlägt Hexe", () =>
  eq(trickWinner(T(sp("witch"), sp("fairy")), null), 1));
test("Narr, Fee, Hexe, Narr → erster Narr gewinnt (nicht die zuerst gespielte Karte)", () =>
  eq(trickWinner(T(fool(), sp("fairy"), sp("witch"), fool()), null), 0));
test("Fee, Narr, Hexe, Narr → Narr gewinnt, nicht die zuerst gespielte Fee", () =>
  eq(trickWinner(T(sp("fairy"), fool(), sp("witch"), fool()), null), 1));

console.log("── 30 Jahre: Bombe ──");
test("Bombe annulliert → -1", () =>
  eq(trickWinner(T(n("red", 13), sp("bomb")), "red"), -1));
test("trickWinnerWithoutBomb liefert hypothetischen Gewinner (Extrembeispiel)", () =>
  eq(trickWinnerWithoutBomb(T(sp("fairy"), sp("dragon"), sp("rainbow7"), sp("bomb"), sp("witch")), "red"), 0));

console.log("── 30 Jahre: 9¾ (Wolke) & 7½ (Jongleur) ──");
test("9¾ ohne Farbwahl ist passiv", () =>
  eq(trickWinner(T(sp("rainbow9"), n("red", 1)), null), 1));
test("9¾ mit Farbe schlägt die 9 derselben Farbe", () =>
  eq(trickWinner(T(n("red", 9), sp("rainbow9", { suit: "red", value: 9.75 })), null), 1));
test("9¾ mit Farbe verliert gegen die 10", () =>
  eq(trickWinner(T(n("red", 10), sp("rainbow9", { suit: "red", value: 9.75 })), null), 0));
test("9¾ als Trumpffarbe gewählt schlägt Nicht-Trumpf (blaue 13)", () =>
  eq(trickWinner(T(n("blue", 13), n("blue", 4), sp("rainbow9", { suit: "red", value: 9.75 })), "red"), 2));
test("9¾ führt mit Farbe → etabliert Stichfarbe", () =>
  // rainbow9 rot führt, rote 10 bedient und gewinnt, blaue 13 nicht
  eq(trickWinner(T(sp("rainbow9", { suit: "red", value: 9.75 }), n("red", 10), n("blue", 13)), null), 1));
test("7½ mit Farbe kämpft (schlägt rote 7)", () =>
  eq(trickWinner(T(n("red", 7), sp("rainbow7", { suit: "red", value: 7.5 })), null), 1));

console.log("── 30 Jahre: Vampir ──");
test("Vampir kopiert Trumpfkarte (rote 8) und schlägt rote 5", () =>
  eq(trickWinner(T(n("red", 5), sp("vampire")), "red", null, 8, n("red", 8)), 1));
test("Vampir ohne Trumpf ist passiv", () =>
  eq(trickWinner(T(sp("vampire"), n("green", 1)), null, null, 0, null), 1));
test("Vampir kopiert Zauberer-Trumpfkarte → gewinnt als Zauberer", () =>
  eq(trickWinner(T(n("red", 13), sp("vampire")), "red", null, 0, wiz()), 1));
test("Vampir kopiert Narr-Trumpfkarte → passiv", () =>
  eq(trickWinner(T(sp("vampire"), n("green", 2)), null, null, 0, fool()), 1));

console.log("── isAlwaysPlayable ──");
for (const c of [wiz(), fool(), sp("witch"), sp("wizardfool"), sp("dragon"), sp("fairy"), sp("bomb"), sp("vampire"), sp("rainbow7"), sp("rainbow9")]) {
  test(`immer spielbar: ${(c as any).specialType ?? c.type}`, () => eq(isAlwaysPlayable(c), true));
}
test("Zahlenkarte NICHT immer spielbar", () => eq(isAlwaysPlayable(n("red", 5)), false));

console.log("── Punkte ──");
test("Treffer: 20 + 10/Stich", () => eq(calcScore(3, 3), 50));
test("0 geboten, 0 bekommen: 20", () => eq(calcScore(0, 0), 20));
test("daneben: -10 pro Abweichung", () => eq(calcScore(2, 5), -30));

console.log("── Dealer-Regel ──");
test("Dealer darf Summe nicht ausgleichen", () => eq(forbiddenDealerBid([2, 1, null], 2, 5), 2));
test("kein Verbot wenn Ausgleich unmöglich (negativ)", () => eq(forbiddenDealerBid([4, 3, null], 2, 5), null));

console.log("── KI ──");
test("KI verschwendet keinen zweiten Zauberer", () => {
  const hand = [wiz(), n("red", 3)];
  const pick = aiChooseCard(hand, T(wiz()), "red", null, 2, 0);
  eq((pick as any).type !== "wizard", true);
});
test("KI wählt Drache zum Gewinnen", () => {
  const hand = [sp("dragon"), n("red", 2)];
  eq((aiChooseCard(hand, T(n("blue", 13)), "red", null, 1, 0) as any).specialType, "dragon");
});
test("KI wirft Zauberer ab wenn Stiche voll", () => {
  const hand = [wiz(), n("red", 13)];
  eq((aiChooseCard(hand, T(n("blue", 2)), null, null, 1, 1) as any).type, "wizard");
});
test("aiBid Runde 10 mit starker Hand ≥ 3", () => {
  const hand = [wiz(), n("red", 13), n("red", 12), n("blue", 13), n("blue", 12), n("green", 11), n("green", 6), n("yellow", 9), n("yellow", 4), fool()];
  eq(aiBid(hand, "red") >= 3, true);
});

console.log("── KI: Jongleur-Weitergabe ──");
test("KI gibt Zahlenkarte statt Zauberer weiter", () => {
  const hand = [wiz(), n("red", 3)];
  eq((aiWorstCard(hand, "red") as any).type !== "wizard", true);
});
test("KI gibt Nicht-Trumpf statt Trumpfkarte weiter", () => {
  const hand = [n("red", 10), n("blue", 2)];
  eq(aiWorstCard(hand, "red"), n("blue", 2));
});
test("KI gibt niedrigste Nicht-Trumpfkarte weiter", () => {
  const hand = [n("blue", 9), n("green", 2), n("red", 5)];
  eq(aiWorstCard(hand, "red"), n("green", 2));
});

console.log("── 30 Jahre: Jongleur/Wolke Farbwahl (KI) ──");
test("KI braucht Stich → wählt Trumpffarbe", () => {
  eq(aiChooseRainbowSuit([], "blue", null, true), "blue");
});
test("KI braucht Stich, kein Trumpf gesetzt → folgt Anspielfarbe", () => {
  eq(aiChooseRainbowSuit(T(n("green", 5)), null, null, true), "green");
});
test("KI braucht keinen Stich mehr → meidet Trumpffarbe", () => {
  eq(aiChooseRainbowSuit([], "blue", null, false) !== "blue", true);
});
test("KI braucht keinen Stich, Anspielfarbe ≠ Trumpf → folgt Anspielfarbe", () => {
  eq(aiChooseRainbowSuit(T(n("green", 5)), "blue", null, false), "green");
});
test("cardLabel zeigt gewählte Farbe bei 7½", () => {
  eq(cardLabel({ id: "rainbow7", specialType: "rainbow7", suit: "red" }), "7½ 🔴");
});
test("cardLabel ohne Farbe zeigt nur specialType", () => {
  eq(cardLabel({ id: "rainbow9", specialType: "rainbow9", suit: null }), "rainbow9");
});
test("cardLabel zeigt Farbkreis statt Kartensymbol bei Zahlenkarten", () => {
  eq(cardLabel(n("blue", 13)), "13 🔵");
});

console.log("── Deck ──");
test("Classic: 60 Karten", () => eq(buildDeck("classic").length, 60));
test("Runde 1: kein Werwolf im Deck", () =>
  eq(buildDeck("anniversary", true).some((c: any) => c.specialType === "werewolf"), false));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) (globalThis as any).Deno?.exit?.(1) ?? process.exit(1);
