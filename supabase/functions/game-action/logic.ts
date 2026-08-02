// ════════════════════════════════════════════════════════════
// logic.ts — pure Wizard game rules (no DB, no side effects)
// Unit-testable: deno test / npx tsx logic_test.ts
// ════════════════════════════════════════════════════════════

export const SUITS = ["red","blue","green","yellow"];

export function buildDeck(edition, excludeWerewolf = false) {
  const deck = [];
  for (const suit of SUITS)
    for (let v = 1; v <= 13; v++)
      deck.push({ id: `${suit}-${v}`, type: "number", suit, value: v });
  for (let i = 0; i < 4; i++) deck.push({ id: `fool-${i}`, type: "fool", suit: null, value: 0 });
  for (let i = 0; i < 4; i++) deck.push({ id: `wizard-${i}`, type: "wizard", suit: null, value: 14 });
  if (edition === "anniversary") {
    deck.push({ id: "dragon",     type: "special", specialType: "dragon",     suit: null, value: 15 });
    deck.push({ id: "fairy",      type: "special", specialType: "fairy",      suit: null, value: -1 });
    deck.push({ id: "witch",      type: "special", specialType: "witch",      suit: null, value: 0  });
    if (!excludeWerewolf) {
      deck.push({ id: "werewolf", type: "special", specialType: "werewolf",   suit: null, value: 0  });
    }
    deck.push({ id: "vampire",    type: "special", specialType: "vampire",    suit: null, value: 0  });
    deck.push({ id: "bomb",       type: "special", specialType: "bomb",       suit: null, value: 0  });
    deck.push({ id: "rainbow7",   type: "special", specialType: "rainbow7",   suit: null, value: 7.5 });
    deck.push({ id: "rainbow9",   type: "special", specialType: "rainbow9",   suit: null, value: 9.75 });
    deck.push({ id: "wizardfool", type: "special", specialType: "wizardfool", suit: null, value: 0  });
  }
  return deck;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

export function trickWinnerWithoutBomb(trick, trumpSuit, werewolfSuit = null, trumpCardValue = 0, trumpCardObj = null) {
  // Calculate winner ignoring bomb - used to determine who leads next
  const trickWithoutBomb = trick.filter(t => t.card.specialType !== "bomb");
  if (trickWithoutBomb.length === 0) return trick[0]?.playerIndex ?? 0;
  return trickWinner(trickWithoutBomb, trumpSuit, werewolfSuit, trumpCardValue, trumpCardObj);
}

export function trickWinner(trick, trumpSuit, werewolfSuit = null, trumpCardValue = 0, trumpCardObj = null) {
  if (trick.some(t => t.card.specialType === "bomb")) return -1;

  const effectiveTrump = werewolfSuit ?? trumpSuit;
  const hasDragon = trick.some(t => t.card.specialType === "dragon");
  const hasFairy  = trick.some(t => t.card.specialType === "fairy");

  if (hasDragon) {
    if (hasFairy) {
      return trick[trick.findIndex(t => t.card.specialType === "fairy")].playerIndex;
    }
    return trick[trick.findIndex(t => t.card.specialType === "dragon")].playerIndex;
  }

  const hasVampire = trick.some(t => t.card.specialType === "vampire");
  let vampireSuit = null;
  let vampireValue = 0;
  if (hasVampire) {
    if (werewolfSuit) {
      // Werwolf war Trumpfkarte → Vampir kopiert die Karte UNTER dem Werwolf
      // Die Stichfarbe ist werewolfSuit, der Wert kommt aus original_trump_card (via trumpCardValue)
      vampireSuit = werewolfSuit;
      vampireValue = trumpCardValue > 0 ? trumpCardValue : 7; // fallback: mittlerer Wert falls keine originale Karte
    } else if (effectiveTrump) {
      // Normal: Vampir kopiert die Trumpfkarte
      vampireSuit = effectiveTrump;
      vampireValue = trumpCardValue > 0 ? trumpCardValue : 7;
    }
    // else: kein Trumpf → Vampir ist passiv wie ein Narr
  }

  const effectiveTrick = trick.map(t => {
    if (t.card.specialType === "vampire") {
      // Offiz. FAQ: Vampir kopiert die Trumpfkarte inkl. ALLER Effekte
      if (trumpCardObj?.type === "wizard" || trumpCardObj?.specialType === "wizardfool")
        return { ...t, card: { ...t.card, type: "wizard", suit: null } };
      if (trumpCardObj?.type === "fool")
        return t; // copies fool → passive
      if (!vampireSuit) return t; // no trump → vampire is passive like a fool
      return { ...t, card: { ...t.card, suit: vampireSuit, type: "number", value: vampireValue } };
    }
    return t;
  });

  const isPassive = (c) =>
    c.type === "fool" ||
    // rainbow9 (9¾) and rainbow7 (7½) are passive only if no suit chosen yet
    ((c.specialType === "rainbow9" || c.specialType === "rainbow7") && !c.suit) ||
    ["witch","fairy","werewolf","wizardfool","bomb"].includes(c.specialType ?? "");

  let w = 0;
  for (let i = 0; i < effectiveTrick.length; i++) {
    const c = effectiveTrick[i].card;
    const wc = effectiveTrick[w].card;
    if (c.type === "wizard") { if (wc.type !== "wizard") w = i; continue; }
    if (wc.type === "wizard") continue;
    if (isPassive(c)) continue;
    if (isPassive(wc)) { w = i; continue; }
    const ct = effectiveTrump && c.suit === effectiveTrump;
    const wt = effectiveTrump && wc.suit === effectiveTrump;
    if (ct && !wt) { w = i; continue; }
    if (wt && !ct) continue;
    // First non-passive card establishes led suit (fool is passive, wizard means no suit)
    const isPassiveTW = (c) => !c || c.type === "fool" ||
      // rainbow7/9 and vampire count as lead cards once they carry a suit
      ((c.specialType === "rainbow7" || c.specialType === "rainbow9" || c.specialType === "vampire") && !c.suit) ||
      ["witch","fairy","werewolf","wizardfool","bomb"].includes(c.specialType ?? "");
    const leadTW = effectiveTrick.find(t => !isPassiveTW(t.card))?.card ?? null;
    const led = leadTW ? (leadTW.suit ?? null) : null;
    if (c.suit === led && wc.suit !== led) { w = i; continue; }
    if (wc.suit === led && c.suit !== led) continue;
    if (c.value > wc.value) w = i;
  }
  return trick[w].playerIndex;
}

export function calcScore(bid, got) {
  return bid === got ? 20 + bid * 10 : -Math.abs(bid - got) * 10;
}

export function forbiddenDealerBid(bids, dealerIdx, round) {
  const sum = bids.reduce((acc, b, i) => i === dealerIdx ? acc : acc + (b ?? 0), 0);
  const f = round - sum;
  return f >= 0 && f <= round ? f : null;
}

export function aiBid(hand, trumpSuit = null, werewolfSuit = null) {
  const effectiveTrump = werewolfSuit ?? trumpSuit;
  const n = hand.length; // round number = hand size
  let e = 0;
  for (const c of hand) {
    if (c.type === "wizard") {
      e += 0.95;
    } else if (c.specialType === "dragon") {
      e += 0.9;
    } else if (c.specialType === "fairy") {
      e += 0.05;
    } else if (c.specialType === "bomb" || c.specialType === "rainbow7" || c.specialType === "rainbow9" || c.specialType === "witch" || c.specialType === "wizardfool") {
      e += 0.3;
    } else if (c.type === "fool") {
      e += 0;
    } else if (c.type === "number") {
      const isTrump = effectiveTrump && c.suit === effectiveTrump;
      if (isTrump) {
        if (c.value >= 11) e += 0.85;
        else if (c.value >= 8)  e += 0.65;
        else if (c.value >= 5)  e += 0.4;
        else e += 0.2;
      } else {
        // Non-trump: scale with round size - in round 10+ a 13 is much more likely to win
        // because more cards are in play and fewer players can trump
        const scaleFactor = Math.min(1.0, n / 8); // 0→1 as rounds grow to 8+
        if (c.value >= 13) e += 0.45 + 0.25 * scaleFactor; // up to 0.70
        else if (c.value >= 12) e += 0.30 + 0.20 * scaleFactor; // up to 0.50
        else if (c.value >= 11) e += 0.18 + 0.17 * scaleFactor; // up to 0.35
        else if (c.value >= 10) e += 0.10 + 0.10 * scaleFactor; // up to 0.20
        else if (c.value >= 9)  e += 0.05 + 0.05 * scaleFactor; // up to 0.10
        // below 9: essentially 0 in non-trump
      }
    }
  }
  return Math.max(0, Math.round(e));
}

export function isAlwaysPlayable(c) {
  return c.type === "fool" || c.type === "wizard" ||
    // These can always be played freely regardless of led suit (official FAQ)
    ["witch","wizardfool","dragon","fairy","bomb","vampire","rainbow7","rainbow9"].includes(c.specialType ?? "");
}

// Picks the card an AI would least mind giving away (Jongleur/7½ pass-left).
// Keeps wizards, dragons and high trump cards; hands over weak/passive cards first.
export function aiWorstCard(hand, trumpSuit = null, werewolfSuit = null) {
  const effectiveTrump = werewolfSuit ?? trumpSuit;
  const keepValue = (c) => {
    if (c.type === "wizard") return 100;
    if (c.specialType === "dragon") return 95;
    if (c.type === "number" && effectiveTrump && c.suit === effectiveTrump) return 50 + c.value;
    if (c.specialType === "vampire") return 40;
    if (["rainbow7", "rainbow9", "witch", "wizardfool", "bomb"].includes(c.specialType ?? "")) return 25;
    if (c.type === "number") return c.value;
    if (c.type === "fool") return -1;
    if (c.specialType === "fairy") return -2;
    return 0;
  };
  return [...hand].sort((a, b) => keepValue(a) - keepValue(b))[0] ?? hand[0];
}

export function aiChooseCard(hand, trick, trumpSuit, werewolfSuit = null, bid = null, tricksWon = 0) {
  // First non-passive card establishes led suit (fool is passive, wizard means no suit)
  const effTrumpForLead = werewolfSuit ?? trumpSuit;
  const isPassiveAI = (c) => !c || c.type === "fool" ||
    ((c.specialType === "rainbow7" || c.specialType === "rainbow9") && !c.suit) ||
    (c.specialType === "vampire" && !effTrumpForLead) ||
    ["witch","fairy","werewolf","wizardfool","bomb"].includes(c.specialType ?? "");
  const leadAI = trick.find(t => !isPassiveAI(t.card))?.card ?? null;
  const led = leadAI
    ? (leadAI.specialType === "vampire" ? effTrumpForLead : (leadAI.suit ?? null))
    : null;
  const followable = led ? hand.filter(c => c.suit === led && !isAlwaysPlayable(c)) : [];
  const playable = followable.length > 0 ? followable : hand;

  const effectiveTrump = werewolfSuit ?? trumpSuit;
  const needsMoreTricks = bid === null || tricksWon < bid;

  const winStr = (c) =>
    c.type === "wizard" ? 100 :
    c.specialType === "dragon" ? 99 :
    isAlwaysPlayable(c) ? 1 :
    effectiveTrump && c.suit === effectiveTrump ? 50 + (c.value ?? 0) :
    led && c.suit === led ? 10 + (c.value ?? 0) :
    c.value ?? 0;

  const loseStr = (c) =>
    c.type === "wizard" ? 0 :
    c.type === "fool" ? 1 :
    isAlwaysPlayable(c) ? 40 :
    effectiveTrump && c.suit === effectiveTrump ? 20 + (c.value ?? 0) :
    c.value ?? 0;

  if (needsMoreTricks) {
    const wizardAlreadyInTrick = trick.some(t => t.card.type === "wizard");
    const dragonAlreadyInTrick = trick.some(t => t.card.specialType === "dragon");
    const fairyInTrick = trick.some(t => t.card.specialType === "fairy");

    if (wizardAlreadyInTrick) {
      const candidates = playable.filter(c => c.type !== "wizard");
      const pool = candidates.length > 0 ? candidates : playable;
      return [...pool].sort((a, b) => loseStr(a) - loseStr(b))[0] ?? pool[0] ?? hand[0];
    }

    const dragon = playable.find(c => c.specialType === "dragon");
    if (dragon && trick.length > 0 && !fairyInTrick && !dragonAlreadyInTrick) return dragon;

    const wiz = playable.find(c => c.type === "wizard");
    if (wiz && trick.length > 0) return wiz;

    return [...playable].sort((a, b) => winStr(b) - winStr(a))[0] ?? playable[0] ?? hand[0];
  } else {
    const sorted = [...playable].sort((a, b) => loseStr(a) - loseStr(b));
    return sorted[0] ?? playable[0] ?? hand[0];
  }
}

export function suitDot(suit) {
  const dots = { red: "🔴", blue: "🔵", green: "🟢", yellow: "🟡" };
  return dots[suit] ?? suit ?? "–";
}

export function cardLabel(card) {
  if (!card) return "?";
  if (card.type === "wizard") return "🧙";
  if (card.type === "fool") return "🃏";
  if (card.specialType) return card.specialType;
  const sym = {red:"♥",blue:"♠",green:"♣",yellow:"♦"}[card.suit] ?? "?";
  return `${card.value}${sym}`;
}

// Logs failed writes instead of silently swallowing them (root cause of
// several "missing trump card" bugs when a DB column didn't exist yet).

export function aiBidIndianPoker(players, myIdx, trumpSuit = null, werewolfSuit = null) {
  // In round 1 (Indian Poker), the AI cannot see its own card.
  // It can only reason from the other players' visible cards and the trump.
  // Heuristic: with N players and 1 card each, base chance for a single trick
  // depends on how strong the visible opponents' cards look, plus baseline randomness
  // representing the unknown own card.
  const effectiveTrump = werewolfSuit ?? trumpSuit;
  const others = players.filter((_, i) => i !== myIdx);

  // Estimate the strength of the strongest visible opponent card
  let maxOpponentStrength = 0;
  for (const p of others) {
    const c = (p.hand ?? [])[0];
    if (!c) continue;
    let s = 0;
    if (c.type === "wizard") s = 0.95;
    else if (c.specialType === "dragon") s = 0.9;
    else if (c.specialType === "fairy") s = 0.05;
    else if (c.type === "fool") s = 0;
    else if (c.type === "number") {
      const isTrump = effectiveTrump && c.suit === effectiveTrump;
      s = isTrump ? (c.value / 13) * 0.85 : (c.value / 13) * 0.45;
    } else {
      s = 0.3; // other specials
    }
    maxOpponentStrength = Math.max(maxOpponentStrength, s);
  }

  // Unknown own card: assume average strength (~0.4), reduced by how strong
  // the best visible opponent card is (can't beat a very strong visible card reliably)
  const ownEstimate = Math.max(0.05, 0.45 - maxOpponentStrength * 0.3);

  return ownEstimate >= 0.4 ? 1 : 0;
}
