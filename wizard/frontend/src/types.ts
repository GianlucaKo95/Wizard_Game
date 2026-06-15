export type Suit = "red" | "blue" | "green" | "yellow";
export type CardType = "number" | "fool" | "wizard";

export interface Card {
  id: string;
  type: CardType;
  suit: Suit | null;
  value: number;
}

export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  hand: Card[];
  bid: number | null;
  tricksWon: number;
  score: number;
  connected: boolean;
}

export interface TrickEntry {
  card: Card;
  playerIndex: number;
}

export interface RoundResult {
  playerIndex: number;
  name: string;
  bid: number;
  got: number;
  delta: number;
  totalScore: number;
}

export type GamePhase =
  | "lobby"
  | "bidding"
  | "choosingTrump"
  | "playing"
  | "trickEnd"
  | "roundEnd"
  | "gameEnd";

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  round: number;
  maxRounds: number;
  dealer: number;
  currentPlayer: number;
  trumpCard: Card | null;
  trumpSuit: Suit | null;
  currentTrick: TrickEntry[];
  lastTrickWinner: number | null;
  lastTrickCards: TrickEntry[] | null;
  roundHistory: RoundResult[][];
  log: string[];
  fillWithAI: boolean;
  aiCount: number;
}

export const SUITS: Suit[] = ["red", "blue", "green", "yellow"];
export const SUIT_SYMBOLS: Record<Suit, string> = { red: "♥", blue: "♠", green: "♣", yellow: "♦" };
export const SUIT_COLORS: Record<Suit, string> = {
  red: "#e63946", blue: "#457b9d", green: "#2d6a4f", yellow: "#e9c46a"
};

export function cardLabel(card: Card): string {
  if (card.type === "wizard") return "Z";
  if (card.type === "fool") return "N";
  return String(card.value);
}

export function forbiddenDealerBid(
  bids: (number | null)[],
  dealerIdx: number,
  round: number
): number | null {
  const sum = bids.reduce<number>((acc, b, i) => i === dealerIdx ? acc : acc + (b ?? 0), 0);
  const forbidden = round - sum;
  if (forbidden >= 0 && forbidden <= round) return forbidden;
  return null;
}
