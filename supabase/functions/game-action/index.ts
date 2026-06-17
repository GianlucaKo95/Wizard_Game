// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUITS = ["red","blue","green","yellow"];

function buildDeck(edition) {
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
    deck.push({ id: "werewolf",   type: "special", specialType: "werewolf",   suit: null, value: 0  });
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
    if (c.type === "wizard") { w = i; continue; }
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

function aiBid(hand) {
  let e = 0;
  for (const c of hand) {
    if (c.type === "wizard" || c.specialType === "dragon") e += 1;
    else if (c.value >= 12) e += 0.7;
    else if (c.value >= 10) e += 0.35;
  }
  return Math.round(e);
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
  const led = werewolfSuit ?? ledEntry?.card.suit ?? null;
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
  return sorted[sorted.length - 1];
}

function addLog(room, msg) {
  room.log = [msg, ...room.log].slice(0, 30);
}

function cardLabel(card) {
  if (card.type === "wizard") return "🧙";
  if (card.type === "fool") return "🃏";
  if (card.specialType) return card.specialType;
  const sym = {red:"♥",blue:"♠",green:"♣",yellow:"♦"}[card.suit];
  return `${card.value}${sym}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function tickAIBids(supabase, roomId, room, players) {
  let current = room.current_player;
  const bids = players.map(p => p.bid);
  const startBidder = (room.dealer + 1) % players.length;
  let iterations = 0;

  while (players[current]?.is_ai && iterations++ < players.length) {
    let bid = aiBid(players[current].hand);
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

  // If playing phase starts and first player is AI, trigger play immediately
  if (allBid && players[newCurrent]?.is_ai) {
    const updRoom = { ...room, phase: "playing", current_player: newCurrent, current_trick: [], log: room.log };
    return await aiPlayNext(supabase, roomId, updRoom, players);
  }

  return json({ ok: true });
}

async function aiPlayNext(supabase, roomId, room, players) {
  const current = room.current_player;

  // Always load fresh players from DB to get correct hands
  const { data: freshPlayers } = await supabase
    .from("room_players").select("*").eq("room_id", roomId).order("player_index");
  const allPlayers = freshPlayers ?? players;

  if (!allPlayers[current]?.is_ai) return json({ ok: true });

  const currentPlayer = allPlayers[current];
  if (!currentPlayer.hand || currentPlayer.hand.length === 0) {
    // No cards to play - round might be over
    return json({ ok: true });
  }

  const card = aiChooseCard(currentPlayer.hand, room.current_trick ?? [], room.trump_suit, room.werewolf_suit);
  const newHand = currentPlayer.hand.filter(c => c.id !== card.id);
  await supabase.from("room_players").update({ hand: newHand }).eq("id", currentPlayer.id);
  const newTrick = [...(room.current_trick ?? []), { card, playerIndex: current }];
  addLog(room, `${currentPlayer.ai_name}: ${cardLabel(card)}`);
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

  // Bomb
  if (trick.some(t => t.card.specialType === "bomb")) {
    addLog(room, "💥 Elderstab! Stich annulliert.");
    await supabase.from("rooms").update({
      current_trick: [], current_player: (room.current_player + 1) % players.length,
      last_trick_winner: null, last_trick_cards: trick,
      pending_rainbow9: null, phase: "playing", log: room.log
    }).eq("id", roomId);
    return json({ ok: true });
  }

  if (trick.length < players.length) {
    const next = (room.current_player + 1) % players.length;
    await supabase.from("rooms").update({ current_trick: trick, current_player: next, log: room.log }).eq("id", roomId);
    if (players[next]?.is_ai) {
      return await aiPlayNext(supabase, roomId, { ...room, current_trick: trick, current_player: next, log: room.log }, players);
    }
    return json({ ok: true });
  }

  // Trick complete
  const winnerIdx = trickWinner(trick, room.trump_suit, room.werewolf_suit);

  if (winnerIdx === -1) {
    addLog(room, "💥 Stich annulliert!");
    await supabase.from("rooms").update({
      current_trick: [], current_player: (room.current_player + 1) % players.length,
      last_trick_winner: null, last_trick_cards: trick, phase: "playing", log: room.log
    }).eq("id", roomId);
    return json({ ok: true });
  }

  players[winnerIdx].tricks_won++;
  await supabase.from("room_players").update({ tricks_won: players[winnerIdx].tricks_won }).eq("id", players[winnerIdx].id);
  addLog(room, `✓ ${players[winnerIdx].ai_name} gewinnt den Stich!`);

  const has9 = trick.some(t => t.card.specialType === "rainbow9");
  const has7 = trick.some(t => t.card.specialType === "rainbow7");
  const hasWitch = trick.some(t => t.card.id === "witch" || t.card.specialType === "witch");
  const rainbow7Players = has7 ? players.map((_, i) => i) : null;

  await supabase.from("rooms").update({
    current_trick: [], current_player: winnerIdx,
    last_trick_winner: winnerIdx, last_trick_cards: trick,
    phase: hasPending ? "trickEnd" : "trickEnd",
    pending_rainbow9: has9 ? winnerIdx : null,
    pending_rainbow7: rainbow7Players,
    pending_witch: hasWitch ? (trick.find(t => t.card.id === "witch" || t.card.specialType === "witch")?.playerIndex ?? null) : null,
    log: room.log
  }).eq("id", roomId);

  // Execute directly - no setTimeout in Edge Functions
  const hasPending = (room.pending_rainbow9 ?? null) !== null ||
    Array.isArray(room.pending_rainbow7) ||
    (room.pending_witch ?? null) !== null;

  if (players.every(p => p.hand.length === 0)) {
    await endRound(supabase, roomId, room, players);
  } else if (!hasPending) {
    await supabase.from("rooms").update({ phase: "playing" }).eq("id", roomId);
    if (players[winnerIdx]?.is_ai) {
      await aiPlayNext(supabase, roomId, {
        ...room, current_trick: [],
        current_player: winnerIdx, phase: "playing", log: room.log,
        pending_rainbow9: null, pending_rainbow7: null, pending_witch: null
      }, players);
    }
  } else {
    await supabase.from("rooms").update({ phase: "playing" }).eq("id", roomId);
  }

  return json({ ok: true });
}

async function dealRound(supabase, roomId, room, players) {
  const deck = shuffle(buildDeck(room.edition ?? body?.edition ?? "classic"));
  const hands = players.map(() => []);
  for (let i = 0; i < room.round; i++)
    for (let p = 0; p < players.length; p++)
      hands[p].push(deck.pop());

  const trumpCard = deck.pop() ?? null;
  const remainingDeck = [...deck];

  for (let i = 0; i < players.length; i++) {
    await supabase.from("room_players").update({ hand: hands[i], bid: null, tricks_won: 0 }).eq("id", players[i].id);
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
    if (werewolfHolder.is_ai) addLog(room, `${werewolfHolder.ai_name} wählt Stichfarbe: ${wSuit}`);
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

  if (trumpCard?.type === "wizard") {
    phase = "choosingTrump";
    currentPlayer = room.dealer;
    addLog(room, `Runde ${room.round} – Zauberer: Dealer wählt Trumpf`);
    if (players[room.dealer].is_ai) {
      trumpSuit = SUITS[Math.floor(Math.random() * 4)];
      phase = "bidding";
      currentPlayer = nextBidder;
      addLog(room, `${players[room.dealer].ai_name} wählt Trumpf: ${trumpSuit}`);
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
    addLog(room, `Runde ${room.round} – Trumpf: ${trumpCard ? (trumpCard.type === "fool" ? "Kein Trumpf" : (trumpCard.suit ?? "–")) : "–"}`);
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
  if (!authHeader) return new Response("Unauthorized", { status: 401 });

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser();
  if (authErr || !user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { action, roomId } = body;

  const { data: roomRow } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (!roomRow) return json({ error: "Raum nicht gefunden" }, 404);
  const room = roomRow;

  const { data: playerRows } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
  const players = playerRows ?? [];
  const callerPlayer = players.find(p => p.user_id === user.id);
  const callerIdx = callerPlayer?.player_index ?? -1;

  switch (action) {

    case "startGame": {
      if (callerIdx !== 0) return json({ error: "Nur der Host kann starten" }, 403);
      const aiCount = body.aiCount ?? 0;
      const aiInserts = [];
      for (let i = players.length; i < Math.min(6, players.length + aiCount); i++) {
        aiInserts.push({ room_id: roomId, player_index: i, is_ai: true, ai_name: `KI ${i - players.length + 1}`, hand: [], score: 0, tricks_won: 0, connected: true });
      }
      if (aiInserts.length > 0) await supabase.from("room_players").insert(aiInserts);
      const allPlayers = [...players, ...aiInserts.map((ai, i) => ({ ...ai, player_index: players.length + i }))];
      const maxRounds = Math.floor(60 / allPlayers.length);
      const edition = body.edition ?? room.edition ?? "classic";
      addLog(room, `Spiel gestartet mit ${allPlayers.length} Spielern (${edition === "anniversary" ? "30 Jahre Edition" : "Classic"})`);
      await supabase.from("rooms").update({ max_rounds: maxRounds, round: 1, dealer: 0, edition, log: room.log }).eq("id", roomId);
      return await dealRound(supabase, roomId, { ...room, round: 1, max_rounds: maxRounds, dealer: 0, log: room.log }, allPlayers);
    }

    case "chooseTrump": {
      if (room.phase !== "choosingTrump") return json({ error: "Falscher Status" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      addLog(room, `Trumpf gewählt: ${body.suit}`);
      const nextBidder = (room.dealer + 1) % players.length;
      await supabase.from("rooms").update({ trump_suit: body.suit, phase: "bidding", current_player: nextBidder, log: room.log }).eq("id", roomId);
      return await tickAIBids(supabase, roomId, { ...room, trump_suit: body.suit, phase: "bidding", current_player: nextBidder, log: room.log }, players);
    }

    case "chooseWerewolf": {
      if (room.phase !== "choosingWerewolf") return json({ error: "Falscher Status" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      addLog(room, `🐺 Stichfarbe gewählt: ${body.suit}`);
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

      // Validate follow suit
      const ledEntry = room.current_trick.find(t =>
        t.card.type === "number" ||
        (["rainbow7","rainbow9"].includes(t.card.specialType) && t.card.suit)
      );
      const effectiveLedSuit = room.werewolf_suit ?? ledEntry?.card.suit ?? null;
      if (!isAlwaysPlayable(card) && effectiveLedSuit) {
        const canFollow = hand.some(c => c.suit === effectiveLedSuit && !isAlwaysPlayable(c));
        if (canFollow && card.suit !== effectiveLedSuit)
          return json({ error: `Du musst ${effectiveLedSuit} bekennen!` }, 400);
      }

      const isWitch = card.specialType === "witch";
      const newHand = hand.filter(c => c.id !== card.id);
      await supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer.id);
      const playedCard = isWitch ? { ...card, type: "fool" } : card;
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
        const newHand = callerPlayer.hand.filter(c => c.id !== giveCardId);
        newHand.push(takenCard);
        await supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer.id);
        addLog(room, `🧹 ${callerPlayer.ai_name} tauscht Karte`);
        await supabase.from("rooms").update({ pending_witch: null, phase: "playing", log: room.log }).eq("id", roomId);
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
      await supabase.from("rooms").update({ pending_rainbow9: null, phase: "playing", log: room.log }).eq("id", roomId);
      return json({ ok: true });
    }

    case "nextRound": {
      if (room.phase !== "roundEnd") return json({ error: "Falscher Status" }, 400);
      if (callerIdx !== 0) return json({ error: "Nur der Host" }, 403);
      addLog(room, `Runde ${room.round + 1} beginnt`);
      return await dealRound(supabase, roomId, { ...room, round: room.round + 1, dealer: (room.dealer + 1) % players.length, log: room.log }, players);
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
