// Shared game logic used by all Edge Functions

export type Suit = "red" | "blue" | "green" | "yellow";
export type CardType = "number" | "fool" | "wizard";

export interface Card {
  id: string;
  type: CardType;
  suit: Suit | null;
  value: number;
}

export interface TrickEntry {
  card: Card;
  playerIndex: number;
}

const SUITS: Suit[] = ["red", "blue", "green", "yellow"];

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let v = 1; v <= 13; v++) {
      deck.push({ id: `${suit}-${v}`, type: "number", suit, value: v });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `fool-${i}`, type: "fool", suit: null, value: 0 });
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `wizard-${i}`, type: "wizard", suit: null, value: 14 });
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function trickWinner(trick: TrickEntry[], trumpSuit: Suit | null): number {
  let winnerIdx = 0;
  for (let i = 0; i < trick.length; i++) {
    const c = trick[i].card;
    const w = trick[winnerIdx].card;
    if (c.type === "wizard") { winnerIdx = i; continue; }
    if (w.type === "wizard") continue;
    if (c.type === "fool") continue;
    if (w.type === "fool") { winnerIdx = i; continue; }
    const cTrump = trumpSuit && c.suit === trumpSuit;
    const wTrump = trumpSuit && w.suit === trumpSuit;
    if (cTrump && !wTrump) { winnerIdx = i; continue; }
    if (wTrump && !cTrump) continue;
    const ledSuit = trick.find(t => t.card.type === "number")?.card.suit ?? null;
    if (c.suit === ledSuit && w.suit !== ledSuit) { winnerIdx = i; continue; }
    if (w.suit === ledSuit && c.suit !== ledSuit) continue;
    if (c.value > w.value) winnerIdx = i;
  }
  return trick[winnerIdx].playerIndex;
}

export function isValidPlay(card: Card, hand: Card[], trick: TrickEntry[]): { valid: boolean; reason?: string } {
  if (!hand.find(c => c.id === card.id)) return { valid: false, reason: "Karte nicht in der Hand" };
  if (card.type === "fool" || card.type === "wizard") return { valid: true };
  const ledSuit = trick.find(t => t.card.type === "number")?.card.suit ?? null;
  if (!ledSuit) return { valid: true };
  const canFollow = hand.some(c => c.suit === ledSuit && c.type === "number");
  if (canFollow && card.suit !== ledSuit) return { valid: false, reason: "Du musst Farbe bekennen!" };
  return { valid: true };
}

export function calcScore(bid: number, got: number): number {
  return bid === got ? 20 + bid * 10 : -Math.abs(bid - got) * 10;
}

export function forbiddenDealerBid(bids: (number | null)[], dealerIdx: number, round: number): number | null {
  const sum = bids.reduce<number>((acc, b, i) => i === dealerIdx ? acc : acc + (b ?? 0), 0);
  const forbidden = round - sum;
  return forbidden >= 0 && forbidden <= round ? forbidden : null;
}

export function aiBid(hand: Card[], _round: number): number {
  let estimate = 0;
  for (const c of hand) {
    if (c.type === "wizard") estimate += 1;
    else if (c.type === "fool") estimate += 0;
    else if (c.value >= 12) estimate += 0.7;
    else if (c.value >= 10) estimate += 0.35;
  }
  return Math.round(estimate);
}

export function aiChooseCard(hand: Card[], trick: TrickEntry[], trumpSuit: Suit | null): Card {
  const ledSuit = trick.find(t => t.card.type === "number")?.card.suit ?? null;
  const followable = ledSuit ? hand.filter(c => c.suit === ledSuit) : [];
  const playable = followable.length > 0 ? followable : hand;
  const wizard = playable.find(c => c.type === "wizard");
  if (wizard && trick.length > 0) return wizard;
  const strength = (c: Card): number => {
    if (c.type === "wizard") return 100;
    if (c.type === "fool") return -1;
    if (trumpSuit && c.suit === trumpSuit) return 50 + c.value;
    return c.value;
  };
  return [...playable].sort((a, b) => strength(b) - strength(a)).at(-1)!;
}

export function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export function cardName(card: Card): string {
  if (card.type === "wizard") return "🧙 Zauberer";
  if (card.type === "fool") return "🃏 Narr";
  const sym = { red: "♥", blue: "♠", green: "♣", yellow: "♦" }[card.suit!];
  return `${card.value}${sym}`;
}
