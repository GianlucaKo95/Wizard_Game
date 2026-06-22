// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUITS = ["red","blue","green","yellow"];

function buildDeck(edition, excludeWerewolf = false) {
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

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function trickWinnerWithoutBomb(trick, trumpSuit, werewolfSuit = null) {
  // Calculate winner ignoring bomb - used to determine who leads next
  const trickWithoutBomb = trick.filter(t => t.card.specialType !== "bomb");
  if (trickWithoutBomb.length === 0) return trick[0]?.playerIndex ?? 0;
  return trickWinner(trickWithoutBomb, trumpSuit, werewolfSuit);
}

function trickWinner(trick, trumpSuit, werewolfSuit = null) {
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
  if (hasVampire) {
    vampireSuit = effectiveTrump;
  }

  const effectiveTrick = trick.map(t => {
    if (t.card.specialType === "vampire") {
      if (!vampireSuit) return t;
      return { ...t, card: { ...t.card, suit: vampireSuit, type: "number", value: 0 } };
    }
    return t;
  });

  const isPassive = (c) =>
    c.type === "fool" ||
    ["witch","fairy","werewolf","rainbow7","rainbow9","wizardfool","bomb"].includes(c.specialType ?? "");

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
    const led = effectiveTrick.find(t => t.card.type === "number" && !t.card.specialType)?.card.suit ?? null;
    if (c.suit === led && wc.suit !== led) { w = i; continue; }
    if (wc.suit === led && c.suit !== led) continue;
    if (c.value > wc.value) w = i;
  }
  return trick[w].playerIndex;
}

function calcScore(bid, got) {
  return bid === got ? 20 + bid * 10 : -Math.abs(bid - got) * 10;
}

function forbiddenDealerBid(bids, dealerIdx, round) {
  const sum = bids.reduce((acc, b, i) => i === dealerIdx ? acc : acc + (b ?? 0), 0);
  const f = round - sum;
  return f >= 0 && f <= round ? f : null;
}

function aiBid(hand, trumpSuit = null, werewolfSuit = null) {
  const effectiveTrump = werewolfSuit ?? trumpSuit;
  let e = 0;
  for (const c of hand) {
    if (c.type === "wizard") {
      e += 0.95; // near-guaranteed trick winner (unless beaten by an earlier wizard)
    } else if (c.specialType === "dragon") {
      e += 0.9; // beats everything except fairy
    } else if (c.specialType === "fairy") {
      e += 0.05; // almost always loses
    } else if (c.specialType === "bomb" || c.specialType === "rainbow7" || c.specialType === "rainbow9" || c.specialType === "witch" || c.specialType === "wizardfool") {
      e += 0.3; // situational, hard to predict
    } else if (c.type === "fool") {
      e += 0; // never wins (unless all fools)
    } else if (c.type === "number") {
      const isTrump = effectiveTrump && c.suit === effectiveTrump;
      if (isTrump) {
        // Trump cards are much stronger - high trump nearly guarantees a trick
        if (c.value >= 11) e += 0.85;
        else if (c.value >= 8) e += 0.6;
        else if (c.value >= 5) e += 0.35;
        else e += 0.15;
      } else {
        // Non-trump cards only win if high enough and no one trumps/overbids
        if (c.value >= 13) e += 0.45;
        else if (c.value >= 11) e += 0.25;
        else if (c.value >= 9) e += 0.1;
      }
    }
  }
  return Math.max(0, Math.round(e));
}

function isAlwaysPlayable(c) {
  return c.type === "fool" || c.type === "wizard" ||
    ["witch","wizardfool","dragon","fairy","bomb"].includes(c.specialType ?? "");
}

function aiChooseCard(hand, trick, trumpSuit, werewolfSuit = null) {
  const ledEntry = trick.find(t =>
    t.card.type === "number" ||
    (["rainbow7","rainbow9"].includes(t.card.specialType) && t.card.suit)
  );
  const led = ledEntry?.card.suit ?? null;
  const followable = led ? hand.filter(c => c.suit === led && !isAlwaysPlayable(c)) : [];
  const playable = followable.length > 0 ? followable : hand;

  const dragon = playable.find(c => c.specialType === "dragon");
  if (dragon && trick.length > 0 && !trick.some(t => t.card.specialType === "fairy")) return dragon;

  const wiz = playable.find(c => c.type === "wizard");
  if (wiz && trick.length > 0) return wiz;

  const effectiveTrump = werewolfSuit ?? trumpSuit;
  const str = (c) =>
    c.type === "wizard" ? 100 :
    c.specialType === "dragon" ? 99 :
    isAlwaysPlayable(c) ? -1 :
    effectiveTrump && c.suit === effectiveTrump ? 50 + c.value :
    c.value;

  const sorted = [...playable].sort((a, b) => str(b) - str(a));
  return sorted[sorted.length - 1] ?? playable[0] ?? hand[0];
}

function addLog(room, msg) {
  room.log = [msg, ...room.log].slice(0, 30);
}

function suitDot(suit) {
  const dots = { red: "🔴", blue: "🔵", green: "🟢", yellow: "🟡" };
  return dots[suit] ?? suit ?? "–";
}

function cardLabel(card) {
  if (!card) return "?";
  if (card.type === "wizard") return "🧙";
  if (card.type === "fool") return "🃏";
  if (card.specialType) return card.specialType;
  const sym = {red:"♥",blue:"♠",green:"♣",yellow:"♦"}[card.suit] ?? "?";
  return `${card.value}${sym}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function aiBidIndianPoker(players, myIdx, trumpSuit = null, werewolfSuit = null) {
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

async function tickAIBids(supabase, roomId, room, players) {
  // Always reload fresh players to get correct bid state
  const { data: freshBidPlayers } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
  const freshPlayers = freshBidPlayers ?? players;
  let current = room.current_player;
  const bids = freshPlayers.map(p => p.bid);
  // Use fresh players for AI bidding
  players = freshPlayers;
  const startBidder = (room.dealer + 1) % players.length;
  let iterations = 0;
  const isIndianPokerRound = room.round === 1;

  while (players[current]?.is_ai && iterations++ < players.length) {
    let bid = isIndianPokerRound
      ? aiBidIndianPoker(players, current, room.trump_suit, room.werewolf_suit)
      : aiBid(players[current].hand, room.trump_suit, room.werewolf_suit);
    const forbidden = forbiddenDealerBid(bids, room.dealer, room.round);
    if (room.dealer === current && forbidden !== null && bid === forbidden) {
      bid = bid === room.round ? 0 : bid + 1;
    }
    bids[current] = bid;
    players[current].bid = bid;
    addLog(room, `${players[current].ai_name} bietet: ${bid}`);
    await supabase.from("room_players").update({ bid }).eq("id", players[current].id);
    current = (current + 1) % players.length;
    if (current === startBidder && bids.every(b => b !== null)) break;
  }

  const allBid = bids.every(b => b !== null);
  const newPhase = allBid ? "playing" : "bidding";
  const newCurrent = allBid ? startBidder : current;
  await supabase.from("rooms").update({ phase: newPhase, current_player: newCurrent, log: room.log }).eq("id", roomId);

  console.log("[tickAIBids] allBid:", allBid, "newCurrent:", newCurrent, "is_ai:", players[newCurrent]?.is_ai);
  return json({ ok: true });
}

async function aiPlayNext(supabase, roomId, room, players) {
  const current = room.current_player;
  console.log("[aiPlayNext] called, current_player:", current, "phase:", room.phase);
  // Note: no blocking delay here - would cause timeout
  // Delay is handled client-side via triggerAI polling

  // Always load fresh players from DB to get correct hands
  const { data: freshPlayers, error: fpErr } = await supabase
    .from("room_players").select("*").eq("room_id", roomId).order("player_index");

  console.log("[aiPlayNext] freshPlayers loaded:", freshPlayers?.length, "error:", fpErr?.message);
  const allPlayers = freshPlayers ?? players;

  let currentPlayer = allPlayers[current];
  console.log("[aiPlayNext] currentPlayer:", currentPlayer?.ai_name, "is_ai:", currentPlayer?.is_ai, "hand length:", currentPlayer?.hand?.length);

  if (!currentPlayer?.is_ai) {
    console.log("[aiPlayNext] not AI, returning");
    return json({ ok: true });
  }

  // If hand is empty, wait and retry - DB write may not be committed yet
  if (!currentPlayer.hand || currentPlayer.hand.length === 0) {
    console.log("[aiPlayNext] empty hand, waiting 800ms and retrying...");
    await new Promise(r => setTimeout(r, 800));
    const { data: retryPlayers } = await supabase
      .from("room_players").select("*").eq("room_id", roomId).order("player_index");
    currentPlayer = (retryPlayers ?? allPlayers)[current];
    console.log("[aiPlayNext] after retry, hand length:", currentPlayer?.hand?.length);
    if (!currentPlayer?.hand || currentPlayer.hand.length === 0) {
      console.log("[aiPlayNext] still empty after retry!");
      return json({ ok: true });
    }
  }

  const card = aiChooseCard(currentPlayer.hand, room.current_trick ?? [], room.trump_suit, room.werewolf_suit);
  if (!card) {
    console.log("[aiPlayNext] aiChooseCard returned undefined! hand:", JSON.stringify(currentPlayer.hand));
    return json({ ok: true });
  }
  console.log("[aiPlayNext] AI plays:", cardLabel(card));
  const newHand = currentPlayer.hand.filter(c => c.id !== card.id);
  await supabase.from("room_players").update({ hand: newHand }).eq("id", currentPlayer.id);
  const newTrick = [...(room.current_trick ?? []), { card, playerIndex: current }];
  addLog(room, `${currentPlayer.ai_name}: ${cardLabel(card)}`);
  // Pass updated players with correct hand sizes to advanceTrick
  const updPlayers = allPlayers.map((p, i) => i === current ? { ...p, hand: newHand } : p);
  return await advanceTrick(supabase, roomId, { ...room, current_trick: newTrick, current_player: current, log: room.log }, updPlayers);
}

async function advanceBidder(supabase, roomId, room, players, bids) {
  const startBidder = (room.dealer + 1) % players.length;
  const allBid = bids.every(b => b !== null);
  const next = (room.current_player + 1) % players.length;
  const newPhase = allBid ? "playing" : "bidding";
  const newCurrent = allBid ? startBidder : next;
  await supabase.from("rooms").update({ phase: newPhase, current_player: newCurrent, log: room.log }).eq("id", roomId);
  if (!allBid && players[newCurrent]?.is_ai) {
    return await tickAIBids(supabase, roomId, { ...room, phase: newPhase, current_player: newCurrent }, players);
  }
  return json({ ok: true });
}

async function endRound(supabase, roomId, room, players) {
  const results = players.map((p, i) => {
    const delta = calcScore(p.bid ?? 0, p.tricks_won);
    return { playerIndex: i, name: p.ai_name, bid: p.bid ?? 0, got: p.tricks_won, delta, totalScore: p.score + delta };
  });
  for (const r of results) {
    await supabase.from("room_players").update({ score: r.totalScore }).eq("id", players[r.playerIndex].id);
  }
  await supabase.from("round_history").insert({ room_id: roomId, round: room.round, results });

  if (room.round >= room.max_rounds) {
    await supabase.from("rooms").update({ phase: "gameEnd", log: room.log }).eq("id", roomId);
    // Save stats
    for (const r of results) {
      const p = players[r.playerIndex];
      if (!p.is_ai && p.user_id) {
        const sorted = [...results].sort((a, b) => b.totalScore - a.totalScore);
        const placement = sorted.findIndex(s => s.playerIndex === r.playerIndex) + 1;
        await supabase.from("game_stats").insert({
          room_id: roomId, user_id: p.user_id, placement,
          final_score: r.totalScore, total_rounds: room.max_rounds,
          tricks_bid: results.reduce((a, rr) => a + rr.bid, 0),
          tricks_won: results.reduce((a, rr) => a + rr.got, 0),
        });
      }
    }
  } else {
    await supabase.from("rooms").update({ phase: "roundEnd", log: room.log }).eq("id", roomId);
  }
}

async function advanceTrick(supabase, roomId, room, players) {
  const trick = room.current_trick;

  if (trick.length < players.length) {
    const next = (room.current_player + 1) % players.length;
    await supabase.from("rooms").update({ current_trick: trick, current_player: next, log: room.log }).eq("id", roomId);
    if (players[next]?.is_ai) {
      // Break chain - save state, client triggers next AI move with delay
      await supabase.from("rooms").update({
        current_trick: trick,
        current_player: next,
        log: room.log
      }).eq("id", roomId);
      return json({ ok: true });
    }
    return json({ ok: true });
  }

  // Explicitly save current trick state so realtime fires
  await supabase.from("rooms").update({ current_trick: trick, current_player: room.current_player }).eq("id", roomId);

  // Trick complete
  const winnerIdx = trickWinner(trick, room.trump_suit, room.werewolf_suit);

  if (winnerIdx === -1) {
    // Check if it was a bomb or all-fools
    const hasBomb = trick.some(t => t.card.specialType === "bomb");
    const nextLeader = hasBomb
      ? trickWinnerWithoutBomb(trick, room.trump_suit, room.werewolf_suit)
      : trick[0].playerIndex; // all fools: first player leads next
    const msg = hasBomb ? "💥 Elderstab! Stich annulliert." : "🃏 Nur Narren – kein Stich!";
    addLog(room, msg);
    await supabase.from("rooms").update({
      current_trick: [], current_player: nextLeader,
      last_trick_winner: null, last_trick_cards: trick,
      phase: "trickEnd", log: room.log
    }).eq("id", roomId);
    return json({ ok: true });
  }

  // Load fresh tricks_won from DB to avoid stale local value from previous round
  const { data: freshWinner } = await supabase.from("room_players").select("tricks_won").eq("id", players[winnerIdx].id).single();
  const newTricksWon = (freshWinner?.tricks_won ?? 0) + 1;
  await supabase.from("room_players").update({ tricks_won: newTricksWon }).eq("id", players[winnerIdx].id);
  players[winnerIdx].tricks_won = newTricksWon;
  addLog(room, `✓ ${players[winnerIdx].ai_name} gewinnt den Stich!`);

  const has9 = trick.some(t => t.card.specialType === "rainbow9");
  const has7 = trick.some(t => t.card.specialType === "rainbow7");
  const hasWitch = trick.some(t => t.card.id === "witch" || t.card.specialType === "witch");

  // Check if this is the last trick - if so, skip all pending actions
  const totalTricksAfter = players.reduce((s, p) => s + (p.tricks_won ?? 0), 0);
  const isLastTrick = totalTricksAfter >= room.round;

  const rainbow7Players = (has7 && !isLastTrick) ? players.map((_, i) => i) : null;
  const pendingWitch = (hasWitch && !isLastTrick) ? (trick.find(t => t.card.id === "witch" || t.card.specialType === "witch")?.playerIndex ?? null) : null;
  const hasPending = !isLastTrick && (has9 || has7 || hasWitch);

  await supabase.from("rooms").update({
    current_trick: [], current_player: winnerIdx,
    last_trick_winner: winnerIdx, last_trick_cards: trick,
    phase: "trickEnd",
    pending_rainbow9: has9 ? winnerIdx : null,
    pending_rainbow7: rainbow7Players,
    pending_witch: pendingWitch,
    log: room.log
  }).eq("id", roomId);

  // Reload fresh room AND players to get correct state
  const { data: freshRoom2 } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  const currentRound = freshRoom2?.round ?? room.round;
  const maxRounds = freshRoom2?.max_rounds ?? room.max_rounds;

  const { data: freshAfterTrick } = await supabase
    .from("room_players").select("*").eq("room_id", roomId).order("player_index");
  const updatedPlayers2 = freshAfterTrick ?? players;

  // Round ends when all hands are empty OR total tricks >= round number
  const totalTricksPlayed = updatedPlayers2.reduce((sum, p) => sum + (p.tricks_won ?? 0), 0);
  const allHandsEmpty = updatedPlayers2.every(p => (p.hand ?? []).length === 0);
  const roundOver = allHandsEmpty || totalTricksPlayed >= currentRound;
  console.log("[advanceTrick] totalTricksPlayed:", totalTricksPlayed, "currentRound:", currentRound, "allHandsEmpty:", allHandsEmpty, "roundOver:", roundOver);

  // If the 9¾ winner is an AI, resolve it automatically right away
  if (has9 && updatedPlayers2[winnerIdx]?.is_ai) {
    const winnerPlayer = updatedPlayers2[winnerIdx];
    const tricksWon = winnerPlayer.tricks_won ?? 0;
    const currentBid = winnerPlayer.bid ?? 0;
    // If exactly on target, must go up; otherwise random direction (but never below 0)
    let adjust = 1;
    if (tricksWon !== currentBid) {
      adjust = (currentBid > 0 && Math.random() < 0.5) ? -1 : 1;
    }
    const newBid = Math.max(0, currentBid + adjust);
    await supabase.from("room_players").update({ bid: newBid }).eq("id", winnerPlayer.id);
    addLog(room, `${winnerPlayer.ai_name} ändert Vorhersage auf ${newBid}`);
    await supabase.from("rooms").update({ pending_rainbow9: null, log: room.log }).eq("id", roomId);
    updatedPlayers2[winnerIdx] = { ...winnerPlayer, bid: newBid };
  }

  const stillPendingRainbow9 = has9 && !updatedPlayers2[winnerIdx]?.is_ai;

  // Note: even if roundOver is true, we do NOT call endRound here.
  // We stay in "trickEnd" so the last trick remains visible for the same
  // duration as any other trick. The client's clearTrick (after its display
  // delay) will detect roundOver and call endRound at that point - unless
  // there's a pending human action (9¾), which must resolve first.
  if (stillPendingRainbow9 || hasPending) {
    // Has pending actions (incl. 9¾ on last trick for a human) - stay in trickEnd, client handles
    // Round-end check happens after the pending action resolves (see rainbow9Adjust, witchRevealDone)
  }
  // else: stay in trickEnd - client will call clearTrick after its delay, which then checks roundOver

  return json({ ok: true });
}

async function dealRound(supabase, roomId, room, players) {
  const deck = shuffle(buildDeck(room.edition ?? "classic", room.round === 1));
  const hands = players.map(() => []);
  for (let i = 0; i < room.round; i++)
    for (let p = 0; p < players.length; p++)
      hands[p].push(deck.pop());

  const trumpCard = deck.pop() ?? null;
  const remainingDeck = [...deck];

  console.log("[dealRound] dealing", room.round, "cards to", players.length, "players, deck size:", deck.length + players.length * room.round + 1);
  for (let i = 0; i < players.length; i++) {
    console.log("[dealRound] player", i, "hand size:", hands[i].length, "id:", players[i].id);
    const { error: dealErr } = await supabase.from("room_players").update({ hand: hands[i], bid: null, tricks_won: 0 }).eq("id", players[i].id);
    if (dealErr) console.log("[dealRound] ERROR saving hand:", dealErr.message);
  }

  // Check if any player got werewolf in hand
  const dealtPlayers = players.map((p, i) => ({ ...p, hand: hands[i] }));
  const werewolfHolder = dealtPlayers.find(p => p.hand.some(c => c.specialType === "werewolf"));
  if (werewolfHolder && trumpCard?.specialType !== "werewolf" && trumpCard !== null) {
    const newHand = [...werewolfHolder.hand];
    const wi = newHand.findIndex(c => c.specialType === "werewolf");
    const werewolfCard = newHand[wi];
    newHand[wi] = trumpCard;
    await supabase.from("room_players").update({ hand: newHand, bid: null, tricks_won: 0 }).eq("id", werewolfHolder.id);
    addLog(room, `🐺 ${werewolfHolder.ai_name} hat den Werwolf – tauscht mit der Trumpfkarte!`);
    const wPhase = werewolfHolder.is_ai ? "bidding" : "choosingWerewolf";
    const wSuit = werewolfHolder.is_ai ? SUITS[Math.floor(Math.random() * 4)] : null;
    const wPlayer = werewolfHolder.is_ai ? (room.dealer + 1) % players.length : werewolfHolder.player_index;
    if (werewolfHolder.is_ai) addLog(room, `${werewolfHolder.ai_name} wählt Stichfarbe: ${suitDot(wSuit)}`);
    await supabase.from("rooms").update({
      round: room.round, max_rounds: room.max_rounds, dealer: room.dealer,
      trump_card: werewolfCard, trump_suit: null,
      phase: wPhase, current_player: wPlayer,
      werewolf_suit: wSuit, remaining_deck: remainingDeck,
      current_trick: [], last_trick_winner: null, last_trick_cards: null,
      pending_rainbow7: null, pending_rainbow9: null, pending_witch: null,
      log: room.log
    }).eq("id", roomId);
    if (wPhase === "bidding") {
      const updPlayers = dealtPlayers.map(p => p.player_index === werewolfHolder.player_index ? { ...p, hand: newHand } : p);
      return await tickAIBids(supabase, roomId, { ...room, phase: "bidding", current_player: wPlayer, werewolf_suit: wSuit }, updPlayers);
    }
    return json({ ok: true });
  }

  const nextBidder = (room.dealer + 1) % players.length;
  let phase = "bidding";
  let currentPlayer = nextBidder;
  let trumpSuit = trumpCard?.suit ?? null;

  if (trumpCard?.type === "wizard" || trumpCard?.specialType === "wizardfool") {
    phase = "choosingTrump";
    currentPlayer = room.dealer;
    const label = trumpCard?.specialType === "wizardfool" ? "Zauberernarr (als Zauberer)" : "Zauberer";
    addLog(room, `Runde ${room.round} – ${label}: Dealer wählt Trumpf`);
    if (players[room.dealer].is_ai) {
      trumpSuit = SUITS[Math.floor(Math.random() * 4)];
      phase = "bidding";
      currentPlayer = nextBidder;
      addLog(room, `${players[room.dealer].ai_name} wählt Trumpf: ${suitDot(trumpSuit)}`);
    }
  } else if (trumpCard?.specialType === "werewolf") {
    phase = "choosingWerewolf";
    currentPlayer = room.dealer;
    addLog(room, `Runde ${room.round} – Werwolf: Dealer wählt Stichfarbe`);
    if (players[room.dealer].is_ai) {
      const suit = SUITS[Math.floor(Math.random() * 4)];
      await supabase.from("rooms").update({
        round: room.round, max_rounds: room.max_rounds, dealer: room.dealer,
        trump_card: trumpCard, trump_suit: null, werewolf_suit: suit,
        phase: "bidding", current_player: nextBidder,
        remaining_deck: remainingDeck,
        current_trick: [], last_trick_winner: null, last_trick_cards: null,
        pending_rainbow7: null, pending_rainbow9: null, pending_witch: null,
        log: room.log
      }).eq("id", roomId);
      return await tickAIBids(supabase, roomId, { ...room, phase: "bidding", current_player: nextBidder, werewolf_suit: suit }, dealtPlayers);
    }
  } else {
    addLog(room, `Runde ${room.round} – Trumpf: ${trumpCard ? (trumpCard.type === "fool" ? "Kein Trumpf" : suitDot(trumpCard.suit)) : "–"}`);
  }

  await supabase.from("rooms").update({
    round: room.round, max_rounds: room.max_rounds, dealer: room.dealer,
    trump_card: trumpCard, trump_suit: trumpSuit,
    phase, current_player: currentPlayer,
    remaining_deck: remainingDeck,
    current_trick: [], last_trick_winner: null, last_trick_cards: null,
    werewolf_suit: null, pending_rainbow7: null, pending_rainbow9: null, pending_witch: null,
    log: room.log
  }).eq("id", roomId);

  if (phase === "bidding") {
    return await tickAIBids(supabase, roomId, { ...room, phase, current_player: currentPlayer, trump_suit: trumpSuit, werewolf_suit: null }, dealtPlayers);
  }
  return json({ ok: true });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  let body;
  try {
    body = await req.json();
  } catch(e) {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }
  const { action, roomId } = body;

  const { data: roomRow } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (!roomRow) return json({ error: "Raum nicht gefunden" }, 404);
  const room = roomRow;

  const { data: playerRows } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
  const players = playerRows ?? [];
  const callerPlayer = players.find(p => p.user_id === user.id);
  const callerIdx = callerPlayer?.player_index ?? -1;

  switch (action) {


    case "clearTrick": {
      if (room.phase !== "trickEnd") return json({ ok: true });

      // Load fresh state
      const { data: freshCR2 } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      const { data: freshCP2 } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
      const fr = freshCR2 ?? room;
      const fp2 = freshCP2 ?? players;

      const hasPendingItems = fr.pending_rainbow9 !== null ||
        Array.isArray(fr.pending_rainbow7) ||
        fr.pending_witch !== null;

      if (hasPendingItems) {
        await supabase.from("rooms").update({ phase: "playing" }).eq("id", roomId);
        return json({ ok: true });
      }

      // Check round over
      const totalTricks2 = fp2.reduce((sum, p) => sum + (p.tricks_won ?? 0), 0);
      const allEmpty2 = fp2.every(p => (p.hand ?? []).length === 0);
      const roundOver2 = allEmpty2 || totalTricks2 >= fr.round;

      console.log("[clearTrick] totalTricks:", totalTricks2, "round:", fr.round, "allEmpty:", allEmpty2, "roundOver:", roundOver2, "players tricks_won:", fp2.map(p => p.tricks_won));

      if (roundOver2) {
        await endRound(supabase, roomId, fr, fp2);
      } else {
        // Just set phase to playing - client will trigger AI via triggerAI
        await supabase.from("rooms").update({
          phase: "playing",
          current_player: fr.last_trick_winner ?? fr.current_player
        }).eq("id", roomId);
      }
      return json({ ok: true });
    }

    case "witchRevealDone": {
      const { data: wrPlayers } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
      const { data: wrRoom } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      if (wrPlayers && wrRoom) {
        const totalTWR = wrPlayers.reduce((s, p) => s + (p.tricks_won ?? 0), 0);
        const allEWR = wrPlayers.every(p => (p.hand ?? []).length === 0);
        if (allEWR || totalTWR >= wrRoom.round) {
          await supabase.from("rooms").update({ witch_swap: null }).eq("id", roomId);
          await endRound(supabase, roomId, { ...wrRoom, witch_swap: null }, wrPlayers);
          return json({ ok: true });
        }
      }
      await supabase.from("rooms").update({ phase: "playing", witch_swap: null }).eq("id", roomId);
      return json({ ok: true });
    }

    case "triggerAI": {
      if (room.phase !== "playing") return json({ ok: true });
      const { data: freshP } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
      const fp = freshP ?? players;
      console.log("[triggerAI] current_player:", room.current_player, "is_ai:", fp[room.current_player]?.is_ai, "hand:", fp[room.current_player]?.hand?.length);
      if (!fp[room.current_player]?.is_ai) return json({ ok: true });
      return await aiPlayNext(supabase, roomId, { ...room, current_trick: room.current_trick ?? [] }, fp);
    }

    case "startGame": {
      if (callerIdx !== 0) return json({ error: "Nur der Host kann starten" }, 403);
      const aiCount = body.aiCount ?? 0;
      const aiInserts = [];
      for (let i = players.length; i < Math.min(6, players.length + aiCount); i++) {
        aiInserts.push({ room_id: roomId, player_index: i, is_ai: true, ai_name: `KI ${i - players.length + 1}`, hand: [], score: 0, tricks_won: 0, connected: true });
      }
      let insertedAI = [];
      if (aiInserts.length > 0) {
        const { data: aiData } = await supabase.from("room_players").insert(aiInserts).select();
        insertedAI = aiData ?? [];
        console.log("[startGame] inserted AI players:", insertedAI.length, insertedAI.map(p => p.id));
      }
      // Reload ALL players from DB to get correct IDs
      const { data: freshAllPlayers } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
      const allPlayers = freshAllPlayers ?? [...players, ...insertedAI];
      console.log("[startGame] allPlayers:", allPlayers.length, allPlayers.map(p => ({ id: p.id, name: p.ai_name })));
      const maxRounds = Math.floor(60 / allPlayers.length);
      const edition = body.edition ?? room.edition ?? "classic";
      addLog(room, `Spiel gestartet mit ${allPlayers.length} Spielern (${edition === "anniversary" ? "30 Jahre Edition" : "Classic"})`);
      await supabase.from("rooms").update({ max_rounds: maxRounds, round: 1, dealer: 0, edition, log: room.log }).eq("id", roomId);
      return await dealRound(supabase, roomId, { ...room, round: 1, max_rounds: maxRounds, dealer: 0, log: room.log }, allPlayers);
    }

    case "chooseTrump": {
      if (room.phase !== "choosingTrump") return json({ error: "Falscher Status" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      addLog(room, `Trumpf gewählt: ${suitDot(body.suit)}`);
      const nextBidder = (room.dealer + 1) % players.length;
      await supabase.from("rooms").update({ trump_suit: body.suit, phase: "bidding", current_player: nextBidder, log: room.log }).eq("id", roomId);
      return await tickAIBids(supabase, roomId, { ...room, trump_suit: body.suit, phase: "bidding", current_player: nextBidder, log: room.log }, players);
    }

    case "chooseWerewolf": {
      if (room.phase !== "choosingWerewolf") return json({ error: "Falscher Status" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      addLog(room, `🐺 Stichfarbe gewählt: ${suitDot(body.suit)}`);
      const nextBidder = (room.dealer + 1) % players.length;
      await supabase.from("rooms").update({ werewolf_suit: body.suit, phase: "bidding", current_player: nextBidder, log: room.log }).eq("id", roomId);
      return await tickAIBids(supabase, roomId, { ...room, werewolf_suit: body.suit, phase: "bidding", current_player: nextBidder, log: room.log }, players);
    }

    case "bid": {
      if (room.phase !== "bidding") return json({ error: "Falscher Status" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      const bid = Number(body.bid);
      const forbidden = forbiddenDealerBid(players.map(p => p.bid), room.dealer, room.round);
      if (room.dealer === callerIdx && forbidden !== null && bid === forbidden)
        return json({ error: `Stichzwang: ${forbidden} ist verboten!` }, 400);
      callerPlayer.bid = bid;
      await supabase.from("room_players").update({ bid }).eq("id", callerPlayer.id);
      addLog(room, `${callerPlayer.ai_name} bietet: ${bid}`);
      const bids = players.map((p, i) => i === callerIdx ? bid : p.bid);
      return await advanceBidder(supabase, roomId, room, players.map((p, i) => i === callerIdx ? { ...p, bid } : p), bids);
    }

    case "playCard": {
      if (room.phase !== "playing") return json({ error: "Falscher Status" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      const hand = callerPlayer.hand;
      const card = hand.find(c => c.id === body.cardId);
      if (!card) return json({ error: "Karte nicht gefunden" }, 400);
      // Ensure player has bid before playing
      if (callerPlayer.bid === null || callerPlayer.bid === undefined) {
        return json({ error: "Du musst erst bieten!" }, 400);
      }

      // Validate follow suit
      const ledEntry = room.current_trick.find(t =>
        t.card.type === "number" ||
        (["rainbow7","rainbow9"].includes(t.card.specialType) && t.card.suit)
      );
      const effectiveLedSuit = ledEntry?.card.suit ?? null;
      if (!isAlwaysPlayable(card) && effectiveLedSuit) {
        const canFollow = hand.some(c => c.suit === effectiveLedSuit && !isAlwaysPlayable(c));
        if (canFollow && card.suit !== effectiveLedSuit)
          return json({ error: `Du musst ${effectiveLedSuit} bekennen!` }, 400);
      }

      const isWitch = card.specialType === "witch";
      const isRainbowChoice = (card.specialType === "rainbow7" || card.specialType === "rainbow9") && body.suit;
      const newHand = hand.filter(c => c.id !== card.id);
      await supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer.id);
      const playedCard = isWitch ? { ...card, type: "fool" } : (isRainbowChoice ? { ...card, suit: body.suit } : card);
      const newTrick = [...room.current_trick, { card: playedCard, playerIndex: callerIdx }];
      addLog(room, `${callerPlayer.ai_name}: ${cardLabel(card)}`);
      const updPlayers = players.map((p, i) => i === callerIdx ? { ...p, hand: newHand } : p);
      return await advanceTrick(supabase, roomId, { ...room, current_trick: newTrick, current_player: callerIdx, log: room.log }, updPlayers);
    }

    case "playSpecial": {
      const { specialAction: sa, cardId, suit, takeCardId, giveCardId, choice } = body;

      if (sa === "witch" && takeCardId && giveCardId) {
        const lastTrick = room.last_trick_cards ?? [];
        const takenCard = lastTrick.find(t => t.card.id === takeCardId)?.card;
        if (!takenCard) return json({ error: "Karte nicht gefunden" }, 400);
        const givenCard = callerPlayer.hand.find(c => c.id === giveCardId);
        const newHand = callerPlayer.hand.filter(c => c.id !== giveCardId);
        newHand.push(takenCard);
        await supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer.id);
        addLog(room, `🧹 ${callerPlayer.ai_name} tauscht: gibt ${cardLabel(givenCard)} · nimmt ${cardLabel(takenCard)}`);
        // Store swap info for 4 seconds display
        await supabase.from("rooms").update({
          pending_witch: null,
          phase: "witchReveal",
          witch_swap: { playerName: callerPlayer.ai_name, gave: givenCard, took: takenCard },
          log: room.log
        }).eq("id", roomId);
        // Check if round is over after witch swap
        const { data: afterWitchPlayers } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
        const { data: afterWitchRoom } = await supabase.from("rooms").select("*").eq("id", roomId).single();
        if (afterWitchPlayers && afterWitchRoom) {
          const totalTW = afterWitchPlayers.reduce((s, p) => s + (p.tricks_won ?? 0), 0);
          const allEW = afterWitchPlayers.every(p => (p.hand ?? []).length === 0);
          if (allEW || totalTW >= afterWitchRoom.round) {
            // Delay endRound until after witchReveal display
            // witchRevealDone will handle it
          }
        }
        return json({ ok: true });
      }

      if (sa === "wizardfool") {
        const card = callerPlayer.hand.find(c => c.id === cardId);
        if (!card) return json({ error: "Karte nicht gefunden" }, 400);
        const newHand = callerPlayer.hand.filter(c => c.id !== cardId);
        await supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer.id);
        const resolvedCard = { ...card, type: choice === "wizard" ? "wizard" : "fool" };
        const newTrick = [...room.current_trick, { card: resolvedCard, playerIndex: callerIdx }];
        addLog(room, `${callerPlayer.ai_name}: Ron als ${choice === "wizard" ? "Zauberer" : "Narr"}`);
        const updPlayers = players.map((p, i) => i === callerIdx ? { ...p, hand: newHand } : p);
        return await advanceTrick(supabase, roomId, { ...room, current_trick: newTrick, log: room.log }, updPlayers);
      }

      return json({ error: "Unbekannte Sonderaktion" }, 400);
    }

    case "passCard": {
      if (!Array.isArray(room.pending_rainbow7) || !room.pending_rainbow7.includes(callerIdx))
        return json({ error: "Nicht dein Zug" }, 400);
      const passedCard = callerPlayer.hand.find(c => c.id === body.cardId);
      if (!passedCard) return json({ error: "Karte nicht gefunden" }, 400);
      const newHand = callerPlayer.hand.filter(c => c.id !== body.cardId);
      await supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer.id);
      const buffer = room.pending_rainbow7_buffer ?? {};
      buffer[callerIdx] = passedCard;
      addLog(room, `${callerPlayer.ai_name} hat eine Karte gewählt`);
      let remaining = room.pending_rainbow7.filter(i => i !== callerIdx);
      const updPlayers = players.map((p, i) => i === callerIdx ? { ...p, hand: newHand } : p);
      for (const aiIdx of [...remaining]) {
        const aiPlayer = updPlayers.find(p => p.player_index === aiIdx);
        if (aiPlayer?.is_ai && aiPlayer.hand.length > 0) {
          const aiCard = aiPlayer.hand[Math.floor(Math.random() * aiPlayer.hand.length)];
          const aiNewHand = aiPlayer.hand.filter(c => c.id !== aiCard.id);
          await supabase.from("room_players").update({ hand: aiNewHand }).eq("id", aiPlayer.id);
          buffer[aiIdx] = aiCard;
          remaining = remaining.filter(i => i !== aiIdx);
        }
      }
      if (remaining.length === 0) {
        const { data: finalPlayers } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
        for (const [fromIdxStr, card] of Object.entries(buffer)) {
          const fromIdx = parseInt(fromIdxStr);
          const leftIdx = (fromIdx - 1 + finalPlayers.length) % finalPlayers.length;
          const leftPlayer = finalPlayers.find(p => p.player_index === leftIdx);
          if (leftPlayer) await supabase.from("room_players").update({ hand: [...leftPlayer.hand, card] }).eq("id", leftPlayer.id);
        }
        addLog(room, "🎁 Alle haben eine Karte weitergegeben!");
        await supabase.from("rooms").update({ pending_rainbow7: null, pending_rainbow7_buffer: null, phase: "playing", log: room.log }).eq("id", roomId);
        // Check if round is over after card exchange
        const { data: afterPassPlayers } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
        const { data: afterPassRoom } = await supabase.from("rooms").select("*").eq("id", roomId).single();
        if (afterPassPlayers && afterPassRoom) {
          const totalT = afterPassPlayers.reduce((s, p) => s + (p.tricks_won ?? 0), 0);
          const allE = afterPassPlayers.every(p => (p.hand ?? []).length === 0);
          if (allE || totalT >= afterPassRoom.round) {
            await endRound(supabase, roomId, afterPassRoom, afterPassPlayers);
          }
        }
      } else {
        await supabase.from("rooms").update({ pending_rainbow7: remaining, pending_rainbow7_buffer: buffer, log: room.log }).eq("id", roomId);
      }
      return json({ ok: true });
    }

    case "rainbow9Adjust": {
      if (room.pending_rainbow9 !== callerIdx) return json({ error: "Nicht dein Zug" }, 400);
      const newBid = Math.max(0, (callerPlayer.bid ?? 0) + (body.adjust ?? 1));
      await supabase.from("room_players").update({ bid: newBid }).eq("id", callerPlayer.id);
      addLog(room, `${callerPlayer.ai_name} ändert Vorhersage auf ${newBid}`);
      await supabase.from("rooms").update({ pending_rainbow9: null, log: room.log }).eq("id", roomId);

      // Check if round is over after the prediction adjustment
      const { data: r9Players } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
      const { data: r9Room } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      if (r9Players && r9Room) {
        const totalT9 = r9Players.reduce((s, p) => s + (p.tricks_won ?? 0), 0);
        const allE9 = r9Players.every(p => (p.hand ?? []).length === 0);
        if (allE9 || totalT9 >= r9Room.round) {
          await endRound(supabase, roomId, r9Room, r9Players);
          return json({ ok: true });
        }
      }

      await supabase.from("rooms").update({ phase: "playing" }).eq("id", roomId);
      return json({ ok: true });
    }

    case "nextRound": {
      if (room.phase !== "roundEnd") return json({ error: "Falscher Status" }, 400);
      if (room.host_id !== user.id) return json({ error: "Nur der Host" }, 403);
      // Reload fresh room AND players from DB for accurate state
      const { data: freshNextRoom } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      const { data: freshNextPlayers } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
      const nextPlayers = freshNextPlayers ?? players;
      const currentDealer = freshNextRoom?.dealer ?? room.dealer;
      const nextDealer = (currentDealer + 1) % nextPlayers.length;
      const nextRound = (freshNextRoom?.round ?? room.round) + 1;
      addLog(room, `Runde ${nextRound} beginnt`);
      return await dealRound(supabase, roomId, { ...room, ...freshNextRoom, round: nextRound, dealer: nextDealer, log: room.log }, nextPlayers);
    }

    case "newGame": {
      if (callerIdx !== 0) return json({ error: "Nur der Host" }, 403);
      for (const p of players) await supabase.from("room_players").update({ score: 0, bid: null, tricks_won: 0, hand: [] }).eq("id", p.id);
      await supabase.from("round_history").delete().eq("room_id", roomId);
      addLog(room, "Neues Spiel gestartet");
      return await dealRound(supabase, roomId, { ...room, round: 1, dealer: 0, log: room.log }, players.map(p => ({ ...p, score: 0, bid: null, tricks_won: 0 })));
    }

    default:
      return json({ error: "Unbekannte Aktion" }, 400);
  }
});
