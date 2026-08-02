// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  SUITS, buildDeck, shuffle, trickWinner, trickWinnerWithoutBomb,
  calcScore, forbiddenDealerBid, aiBid, isAlwaysPlayable, aiChooseCard,
  suitDot, cardLabel, aiBidIndianPoker, aiWorstCard, aiChooseRainbowSuit,
} from "./logic.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Lightweight per-user rate limit (per instance): 20 actions / 10s.
const rateMap = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (rateMap.get(userId) ?? []).filter(t => now - t < 10_000);
  hits.push(now);
  rateMap.set(userId, hits);
  return hits.length > 20;
}

const DEBUG = Deno.env.get("WIZARD_DEBUG") === "1";
const dbg = (...a: unknown[]) => { if (DEBUG) console.log(...a); };

function addLog(room, msg) {
  room.log = [msg, ...room.log].slice(0, 30);
}


// ── Server-side game driver ─────────────────────────────────────
// Keeps the game moving without depending on any client being online.
// Client triggers remain as fallback; all paths are idempotent (ai_lock, phase guards).
let waitUntilWarned = false;
function schedule(task: () => Promise<unknown>, delayMs: number) {
  const p = (async () => {
    await new Promise(r => setTimeout(r, delayMs));
    try { await task(); } catch (e) { console.error("[schedule]", (e as Error).message); }
  })();
  const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
  if (typeof waitUntil === "function") {
    waitUntil(p);
  } else if (!waitUntilWarned) {
    // Runtime doesn't expose EdgeRuntime.waitUntil (unexpected outside local dev).
    // Without it the instance may be frozen after the response is sent, silently
    // dropping the server-driven AI/clearTrick path back onto client polling only.
    // Logged once per instance so this is visible in production logs instead of
    // failing invisibly.
    waitUntilWarned = true;
    console.error("[schedule] EdgeRuntime.waitUntil unavailable — falling back to client-triggered scheduling only");
  }
}

function scheduleAITurn(supabase, roomId, delayMs = 1800) {
  schedule(async () => {
    const { data: r } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (!r || r.phase !== "playing") return;
    const { data: ps } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
    if (!ps?.[r.current_player]?.is_ai || !ps[r.current_player]?.hand?.length) return;
    await aiPlayNext(supabase, roomId, { ...r, current_trick: r.current_trick ?? [] }, ps);
  }, delayMs);
}

function scheduleClearTrick(supabase, roomId, delayMs = 5000) {
  schedule(async () => {
    const { data: r } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (!r || r.phase !== "trickEnd") return;
    await handleClearTrick(supabase, roomId, r);
  }, delayMs);
}

// Client calls "witchRevealDone" ~4s after showing the swap result (see App.tsx).
// Unlike trickEnd this had no server-side fallback at all - if every client
// disconnects right as phase becomes "witchReveal", the room was stuck there
// forever. Mirrors scheduleClearTrick/handleClearTrick.
function scheduleWitchRevealDone(supabase, roomId, delayMs = 6000) {
  schedule(async () => {
    const { data: r } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (!r || r.phase !== "witchReveal") return;
    await handleWitchRevealDone(supabase, roomId, r);
  }, delayMs);
}

async function upd(promise, label) {
  const { error } = await promise;
  if (error) console.error(`[db:${label}]`, error.message);
  return { error };
}

// Reveals the card hidden under the Werewolf trump card the moment the
// Vampire is actually played (not at trick-end) - so any player still to
// act in this trick sees the same information a real reveal would give
// them immediately, instead of only finding out from the log afterwards.
// Persists the reveal to `rooms.original_trump_card` right away; advanceTrick
// picks it up from there once the trick resolves, instead of re-reading and
// re-popping the deck itself.
async function revealCardUnderWerewolf(supabase, roomId, room) {
  const { data: deckRow } = await supabase.from("room_decks").select("deck").eq("room_id", roomId).maybeSingle();
  const remaining = deckRow?.deck ?? [];
  const cardUnder = remaining.length > 0 ? remaining[remaining.length - 1] : null;
  if (!cardUnder) return null;
  addLog(room, `🧛 Vampir deckt Karte unter dem Werwolf auf: ${cardLabel(cardUnder)}`);
  room.original_trump_card = cardUnder;
  await upd(supabase.from("room_decks").upsert({ room_id: roomId, deck: remaining.slice(0, -1) }), "deck.vampireReveal");
  await upd(supabase.from("rooms").update({ original_trump_card: cardUnder, log: room.log }).eq("id", roomId), "log.vampireReveal");
  return cardUnder;
}

async function handleClearTrick(supabase, roomId, room) {
      if (room.phase !== "trickEnd") return json({ ok: true });

      // Load fresh state
      const { data: freshCR2 } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      const { data: freshCP2 } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
      const fr = freshCR2 ?? room;
      const fp2 = freshCP2 ?? [];

      // Loose != null: treats undefined (missing DB column) as "no pending item"
      // Strict !== null would deadlock the game in trickEnd if a column is missing
      const hasPendingItems = fr.pending_rainbow9 != null ||
        fr.pending_rainbow9_deferred != null ||
        Array.isArray(fr.pending_rainbow7) ||
        fr.pending_witch != null;

      if (hasPendingItems) {
        // Pending actions still open - ensure we stay in trickEnd
        // so the pending action handlers can fire
        if (fr.phase !== "trickEnd") {
          await supabase.from("rooms").update({ phase: "trickEnd" }).eq("id", roomId);
        }
        return json({ ok: true });
      }

      // Check round over
      const totalTricks2 = fp2.reduce((sum, p) => sum + (p.tricks_won ?? 0), 0);
      const allEmpty2 = fp2.every(p => (p.hand ?? []).length === 0);
      const roundOver2 = allEmpty2 || totalTricks2 >= fr.round;

      dbg("[clearTrick] totalTricks:", totalTricks2, "round:", fr.round, "allEmpty:", allEmpty2, "roundOver:", roundOver2, "players tricks_won:", fp2.map(p => p.tricks_won));

      if (roundOver2) {
        // Atomically set phase to "scoring" first to prevent concurrent clearTrick calls
        // from both calling endRound and double-counting points.
        // A plain .update() doesn't error when its WHERE clause matches 0 rows, so both
        // racing calls would see no error and both proceed - .select() forces PostgREST
        // to return the affected rows, so an empty result reliably means we lost the race
        // (same pattern as the ai_lock check in aiPlayNext).
        const { data: lockRows, error: lockError } = await supabase.from("rooms")
          .update({ phase: "scoring" })
          .eq("id", roomId)
          .eq("phase", "trickEnd") // only update if still in trickEnd (optimistic lock)
          .select("id");
        if (lockError || !lockRows || lockRows.length === 0) return json({ ok: true }); // lost the race
        await endRound(supabase, roomId, fr, fp2);
      } else {
        // Just set phase to playing - client will trigger AI via triggerAI
        await supabase.from("rooms").update({
          phase: "playing",
          current_player: fr.last_trick_winner ?? fr.current_player
        }).eq("id", roomId);
      scheduleAITurn(supabase, roomId);
      }
      return json({ ok: true });
}

async function handleWitchRevealDone(supabase, roomId, room) {
  if (room.phase !== "witchReveal") return json({ ok: true });

  const { data: wrPlayers } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
  const { data: wrRoom } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  const fr = wrRoom ?? room;
  const fp = wrPlayers ?? [];

  const totalTWR = fp.reduce((s, p) => s + (p.tricks_won ?? 0), 0);
  const allEWR = fp.every(p => (p.hand ?? []).length === 0);
  if (allEWR || totalTWR >= fr.round) {
    // Same atomic optimistic lock as handleClearTrick - only one of two
    // concurrent calls (client trigger + server schedule) may proceed.
    const { data: lockRows, error: lockError } = await supabase.from("rooms")
      .update({ phase: "scoring", witch_swap: null })
      .eq("id", roomId)
      .eq("phase", "witchReveal")
      .select("id");
    if (lockError || !lockRows || lockRows.length === 0) return json({ ok: true }); // lost the race
    await endRound(supabase, roomId, { ...fr, witch_swap: null }, fp);
    return json({ ok: true });
  }

  await supabase.from("rooms").update({ phase: "playing", witch_swap: null }).eq("id", roomId);
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
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

  dbg("[tickAIBids] allBid:", allBid, "newCurrent:", newCurrent, "is_ai:", players[newCurrent]?.is_ai);
  return json({ ok: true });
}

async function aiPlayNext(supabase, roomId, room, players) {
  const current = room.current_player;
  dbg("[aiPlayNext] called, current_player:", current, "phase:", room.phase);
  // Note: no blocking delay here - would cause timeout
  // Delay is handled client-side via triggerAI polling

  // Always load fresh players from DB to get correct hands
  const { data: freshPlayers, error: fpErr } = await supabase
    .from("room_players").select("*").eq("room_id", roomId).order("player_index");

  dbg("[aiPlayNext] freshPlayers loaded:", freshPlayers?.length, "error:", fpErr?.message);
  const allPlayers = freshPlayers ?? players;

  let currentPlayer = allPlayers[current];
  dbg("[aiPlayNext] currentPlayer:", currentPlayer?.ai_name, "is_ai:", currentPlayer?.is_ai, "hand length:", currentPlayer?.hand?.length);

  if (!currentPlayer?.is_ai) {
    dbg("[aiPlayNext] not AI, returning");
    return json({ ok: true });
  }

  // If hand is empty, wait and retry - DB write may not be committed yet
  if (!currentPlayer.hand || currentPlayer.hand.length === 0) {
    dbg("[aiPlayNext] empty hand, waiting 800ms and retrying...");
    await new Promise(r => setTimeout(r, 800));
    const { data: retryPlayers } = await supabase
      .from("room_players").select("*").eq("room_id", roomId).order("player_index");
    currentPlayer = (retryPlayers ?? allPlayers)[current];
    dbg("[aiPlayNext] after retry, hand length:", currentPlayer?.hand?.length);
    if (!currentPlayer?.hand || currentPlayer.hand.length === 0) {
      dbg("[aiPlayNext] still empty after retry!");
      return json({ ok: true });
    }
  }

  const card = aiChooseCard(currentPlayer.hand, room.current_trick ?? [], room.trump_suit, room.werewolf_suit, currentPlayer.bid, currentPlayer.tricks_won ?? 0);
  if (!card) {
    dbg("[aiPlayNext] aiChooseCard returned undefined! hand:", JSON.stringify(currentPlayer.hand));
    return json({ ok: true });
  }
  dbg("[aiPlayNext] AI plays:", cardLabel(card));
  const newHand = currentPlayer.hand.filter(c => c.id !== card.id);
  const expectedTrickLen = (room.current_trick ?? []).length;

  // Atomic guard: attempt to advance current_player away from itself as a lock.
  // Only one concurrent call can successfully claim the turn by using a WHERE
  // condition on current_player - the second call's update affects 0 rows.
  const lockToken = `locked-${Date.now()}-${Math.random()}`;
  const { data: lockResult, error: lockErr } = await supabase
    .from("rooms")
    .update({ ai_lock: lockToken })
    .eq("id", roomId)
    .eq("current_player", current)
    .select("ai_lock");
  if (lockErr) {
    // Column missing or DB error: proceed WITHOUT lock rather than deadlocking the game.
    // The trick-length + card-presence checks below still catch most races.
    dbg("[aiPlayNext] ai_lock unavailable (", lockErr.message, ") - proceeding without lock");
  } else if (!lockResult || lockResult.length === 0 || lockResult[0].ai_lock !== lockToken) {
    dbg("[aiPlayNext] could not acquire lock, concurrent call in progress, skipping");
    return json({ ok: true });
  }
  // Re-verify trick state and card presence after acquiring lock
  const { data: freshRoomCheck } = await supabase.from("rooms").select("current_trick, current_player").eq("id", roomId).single();
  const actualTrickLen = (freshRoomCheck?.current_trick ?? []).length;
  if (actualTrickLen !== expectedTrickLen || freshRoomCheck?.current_player !== current) {
    dbg("[aiPlayNext] trick state changed, skipping. expected:", expectedTrickLen, "actual:", actualTrickLen);
    return json({ ok: true });
  }
  const { data: verifyPlayer } = await supabase
    .from("room_players").select("hand").eq("id", currentPlayer.id).single();
  const dbHand = verifyPlayer?.hand ?? [];
  if (!dbHand.some((c: any) => c.id === card.id)) {
    dbg("[aiPlayNext] card already played by concurrent call, skipping");
    return json({ ok: true });
  }
  await upd(supabase.from("room_players").update({ hand: newHand }).eq("id", currentPlayer.id), "aiPlay.hand");

  // For wizardfool: AI decides wizard or fool based on whether it needs more tricks
  let playedCard = card;
  if (card.specialType === "wizardfool") {
    const needsTricks = (currentPlayer.tricks_won ?? 0) < (currentPlayer.bid ?? 0);
    const wizardInTrick = (room.current_trick ?? []).some(t => t.card.type === "wizard");
    const choice = (needsTricks && !wizardInTrick) ? "wizard" : "fool";
    playedCard = { ...card, type: choice };
    addLog(room, `${currentPlayer.ai_name}: Ron als ${choice === "wizard" ? "Zauberer" : "Narr"}`);
  } else if (card.specialType === "rainbow7" || card.specialType === "rainbow9") {
    const needsTricks = (currentPlayer.tricks_won ?? 0) < (currentPlayer.bid ?? 0);
    const suit = aiChooseRainbowSuit(room.current_trick ?? [], room.trump_suit, room.werewolf_suit, needsTricks);
    playedCard = { ...card, suit };
    addLog(room, `${currentPlayer.ai_name}: ${cardLabel(playedCard)}`);
  } else {
    addLog(room, `${currentPlayer.ai_name}: ${cardLabel(card)}`);
  }

  if (card.specialType === "vampire" && room.werewolf_suit) {
    await revealCardUnderWerewolf(supabase, roomId, room);
  }

  const newTrick = [...(room.current_trick ?? []), { card: playedCard, playerIndex: current }];
  // Let advanceTrick reload players fresh from DB - passing stale updPlayers
  // can cause empty-hand issues when DB writes from previous round haven't propagated
  return await advanceTrick(supabase, roomId, { ...room, current_trick: newTrick, current_player: current, log: room.log }, null);
}

async function advanceBidder(supabase, roomId, room, players, bids) {
  const startBidder = (room.dealer + 1) % players.length;
  const allBid = bids.every(b => b !== null);
  const next = (room.current_player + 1) % players.length;
  const newPhase = allBid ? "playing" : "bidding";
  const newCurrent = allBid ? startBidder : next;
  await supabase.from("rooms").update({ phase: newPhase, current_player: newCurrent, log: room.log }).eq("id", roomId);
  if (allBid && players[newCurrent]?.is_ai) scheduleAITurn(supabase, roomId);
  if (!allBid && players[newCurrent]?.is_ai) {
    return await tickAIBids(supabase, roomId, { ...room, phase: newPhase, current_player: newCurrent }, players);
  }
  return json({ ok: true });
}

async function endRound(supabase, roomId, room, players) {
  // Guard: only run if phase is trickEnd or scoring (not roundEnd/gameEnd/playing)
  // This prevents double scoring if endRound is called concurrently
  const validPhases = ["trickEnd", "scoring", "playing"];
  if (!validPhases.includes(room.phase)) {
    dbg("[endRound] skipping - phase is", room.phase, "(already processed)");
    return;
  }
  const results = players.map((p, i) => {
    const delta = calcScore(p.bid ?? 0, p.tricks_won);
    return { playerIndex: i, name: p.ai_name, bid: p.bid ?? 0, got: p.tricks_won, delta, totalScore: p.score + delta };
  });
  // Atomic: all scores + history in one transaction (RPC); falls back to
  // per-row writes if the RPC isn't deployed yet.
  const { error: rpcErr } = await supabase.rpc("apply_round_scores", {
    p_room_id: roomId, p_round: room.round, p_results: results,
  });
  if (rpcErr) {
    console.error("[endRound] RPC unavailable, falling back:", rpcErr.message);
    for (const r of results) {
      await upd(supabase.from("room_players").update({ score: r.totalScore }).eq("id", players[r.playerIndex].id), "endRound.score");
    }
    await upd(supabase.from("round_history").insert({ room_id: roomId, round: room.round, results }), "endRound.history");
  }

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
  // Always reload fresh players to avoid stale hand data from previous rounds
  if (!players) {
    const { data: freshP } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
    players = freshP ?? [];
  }
  const trick = room.current_trick;

  if (trick.length < players.length) {
    const next = (room.current_player + 1) % players.length;
    await supabase.from("rooms").update({ current_trick: trick, current_player: next, log: room.log }).eq("id", roomId);
    if (players[next]?.is_ai) {
      await supabase.from("rooms").update({
        current_trick: trick,
        current_player: next,
        log: room.log
      }).eq("id", roomId);
      scheduleAITurn(supabase, roomId); // server drives the next AI move
      return json({ ok: true });
    }
    return json({ ok: true });
  }

  // Explicitly save current trick state so realtime fires
  await supabase.from("rooms").update({ current_trick: trick, current_player: room.current_player }).eq("id", roomId);

  // Trick complete
  let trumpCardValue = room.werewolf_suit
    ? (room.original_trump_card?.value ?? 0)
    : (room.trump_card?.value ?? 0);

  // Special case: Vampir im Stich + Werwolf als aktiver Trumpf
  // → Karte unter dem Werwolf aufdecken; die neue Trumpffarbe gilt NUR FÜR DIESEN STICH.
  // Danach bleibt der Werwolf-Suit als Trumpf aktiv (werewolf_suit unverändert in DB).
  // Reveal itself already happened (and was logged) the moment the Vampire was
  // played - see revealCardUnderWerewolf() - so it's picked up from
  // room.original_trump_card here instead of being looked up/logged/popped again.
  const vampireInTrick = trick.some(t => t.card.specialType === "vampire");
  let trickTrumpSuit = room.trump_suit;
  let trickWerewolfSuit = room.werewolf_suit;
  let trickTrumpCard = room.trump_card;
  if (vampireInTrick && room.werewolf_suit) {
    const cardUnder = room.original_trump_card ?? null;
    if (cardUnder) {
      if (cardUnder.type === "number") {
        trickTrumpSuit = cardUnder.suit;
        trickWerewolfSuit = null;
        trickTrumpCard = cardUnder;
        trumpCardValue = cardUnder.value;
        addLog(room, `Trumpf für diesen Stich: ${suitDot(trickTrumpSuit)}`);
      } else if (cardUnder.type === "fool") {
        trickTrumpSuit = null;
        trickWerewolfSuit = null;
        trickTrumpCard = cardUnder;
        addLog(room, `Kein Trumpf in diesem Stich (Narr)`);
      } else if (cardUnder.type === "wizard" || cardUnder.specialType === "wizardfool") {
        trickTrumpSuit = SUITS[Math.floor(Math.random() * 4)];
        trickWerewolfSuit = null;
        trickTrumpCard = cardUnder;
        addLog(room, `Zauberer: Trumpf für diesen Stich ${suitDot(trickTrumpSuit)}`);
      } else if (cardUnder.specialType) {
        // Sonderkarte aufgedeckt → Vampir kopiert ALLE ihre Effekte (offiz. FAQ)
        // Die Vampir-Karte im Stich wird zur kopierten Sonderkarte, sodass
        // Drache/Fee/Bombe die Stichwertung und Hexe/Jongleur/Wolke die
        // Nach-Stich-Effekte automatisch auslösen.
        const vIdx = trick.findIndex(t => t.card.specialType === "vampire");
        if (vIdx >= 0) {
          trick[vIdx] = { ...trick[vIdx], card: { ...trick[vIdx].card, specialType: cardUnder.specialType, copiedByVampire: true } };
          addLog(room, `🧛 Vampir wirkt als ${cardLabel(cardUnder)}`);
        }
        // Trumpf-Semantik der kopierten Karte: Hexe/Jongleur → kein Trumpf in diesem Stich
        if (cardUnder.specialType === "witch" || cardUnder.specialType === "rainbow7") {
          trickTrumpSuit = null;
          trickWerewolfSuit = null;
        } else if (cardUnder.specialType === "rainbow9") {
          trickTrumpSuit = SUITS[Math.floor(Math.random() * 4)];
          trickWerewolfSuit = null;
          addLog(room, `Wolke: Trumpf für diesen Stich ${suitDot(trickTrumpSuit)}`);
        }
        // Drache/Fee/Bombe: Werwolf-Suit bleibt, Karte wirkt über specialType
      }
      await upd(supabase.from("rooms").update({ log: room.log }).eq("id", roomId), "log.vampire");
    }
    dbg("[vampire+werewolf] trick-only trump:", trickTrumpSuit, "werewolf_suit stays:", room.werewolf_suit);
  }

  const winnerIdx = trickWinner(trick, trickTrumpSuit, trickWerewolfSuit, trumpCardValue, trickTrumpCard);

  if (winnerIdx === -1) {
    // Check if it was a bomb or all-fools
    const hasBomb = trick.some(t => t.card.specialType === "bomb");
    const nextLeader = hasBomb
      ? trickWinnerWithoutBomb(trick, trickTrumpSuit, trickWerewolfSuit, trumpCardValue, trickTrumpCard)
      : trick[0].playerIndex; // all fools: first player leads next
    const msg = hasBomb ? "💥 Elderstab! Stich annulliert." : "🃏 Nur Narren – kein Stich!";
    addLog(room, msg);

    // Even with a bomb, Jongleur (7½) and Hexe still trigger (official FAQ)
    const bombHas7 = hasBomb && trick.some(t => t.card.specialType === "rainbow7");
    const bombHasWitch = hasBomb && trick.some(t => t.card.id === "witch" || t.card.specialType === "witch");
    // Bombed tricks never add to tricks_won, so comparing totalTricks to room.round
    // doesn't track physical tricks played when multiple bombs void tricks in the
    // same round - checking hand emptiness directly (like isLastTrick below) is robust
    // regardless of how many prior tricks were voided.
    const bombIsLastTrick = players.every(p => (p.hand ?? []).length === 0);

    const bombRainbow7Players = (bombHas7 && !bombIsLastTrick) ? players.map((_, i) => i) : null;
    const bombWitchPlayerIdx = trick.find(t => t.card.id === "witch" || t.card.specialType === "witch")?.playerIndex ?? null;
    const bombWitchHand = bombWitchPlayerIdx !== null ? players[bombWitchPlayerIdx]?.hand ?? [] : [];
    const bombPendingWitch = (bombHasWitch && !bombIsLastTrick && bombWitchHand.length > 0)
      ? bombWitchPlayerIdx
      : null;

    await supabase.from("rooms").update({
      current_trick: [], current_player: nextLeader,
      last_trick_winner: null, last_trick_cards: trick,
      phase: "trickEnd",
      pending_rainbow7: bombRainbow7Players,
      pending_witch: bombPendingWitch,
      pending_rainbow9: null, pending_rainbow9_deferred: null,
      log: room.log
    }).eq("id", roomId);

    // If the witch player is an AI, auto-swap immediately
    if (bombPendingWitch !== null && players[bombPendingWitch]?.is_ai) {
      const witchAI = players[bombPendingWitch];
      const swappableTrick = trick.filter(t => t.card.specialType !== "witch" && t.card.id !== "witch");
      if (swappableTrick.length > 0 && witchAI.hand.length > 0) {
        // Pick the strongest trick card to take, give away the weakest hand card
        const takenEntry = swappableTrick.reduce((best, t) =>
          (t.card.value ?? 0) > (best.card.value ?? 0) ? t : best, swappableTrick[0]);
        const takenCard = takenEntry.card;
        const givenCard = witchAI.hand.reduce((worst, c) =>
          (c.value ?? 0) < (worst.value ?? 0) ? c : worst, witchAI.hand[0]);
        const newHand = witchAI.hand.filter(c => c.id !== givenCard.id);
        newHand.push(takenCard);
        await supabase.from("room_players").update({ hand: newHand }).eq("id", witchAI.id);
        addLog(room, `🧹 ${witchAI.ai_name} tauscht: gibt ${cardLabel(givenCard)} · nimmt ${cardLabel(takenCard)}`);
        await supabase.from("rooms").update({
          pending_witch: null,
          phase: "witchReveal",
          witch_swap: { playerName: witchAI.ai_name, gave: givenCard, took: takenCard },
          log: room.log
        }).eq("id", roomId);
        scheduleWitchRevealDone(supabase, roomId);
      } else {
        await supabase.from("rooms").update({ pending_witch: null }).eq("id", roomId);
      }
    }

    return json({ ok: true });
  }

  // Load fresh tricks_won from DB to avoid stale local value from previous round
  const { data: freshWinner } = await supabase.from("room_players").select("tricks_won").eq("id", players[winnerIdx].id).single();
  const newTricksWon = (freshWinner?.tricks_won ?? 0) + 1;
  await supabase.from("room_players").update({ tricks_won: newTricksWon }).eq("id", players[winnerIdx].id);
  players[winnerIdx].tricks_won = newTricksWon;
  addLog(room, `✓ ${players[winnerIdx].ai_name} gewinnt den Stich!`);

  const has9 = trick.some(t => t.card.specialType === "rainbow9");
  const hasBomb = trick.some(t => t.card.specialType === "bomb");
  // Wolke + Bombe: Stichvorhersage ändert sich nicht (offiz. FAQ)
  const has9Active = has9 && !hasBomb;
  const has7 = trick.some(t => t.card.specialType === "rainbow7");
  const hasWitch = trick.some(t => t.card.id === "witch" || t.card.specialType === "witch");

  // Check if this is the last trick - if so, skip all pending actions.
  // Mirrors roundOver2's check in handleClearTrick: totalTricksAfter alone
  // undercounts once a bomb has voided a trick (nobody's tricks_won increases
  // for it), which would otherwise leave this the true last trick with
  // totalTricksAfter < room.round and incorrectly try to set up a card-pass/
  // witch-swap when no player has any cards left to give away.
  const totalTricksAfter = players.reduce((s, p) => s + (p.tricks_won ?? 0), 0);
  const allHandsEmptyNow = players.every(p => (p.hand ?? []).length === 0);
  const isLastTrick = allHandsEmptyNow || totalTricksAfter >= room.round;

  const rainbow7Players = (has7 && !isLastTrick) ? players.map((_, i) => i) : null;
  const witchPlayerIdx = trick.find(t => t.card.id === "witch" || t.card.specialType === "witch")?.playerIndex ?? null;
  const witchPlayerHand = witchPlayerIdx !== null ? players[witchPlayerIdx]?.hand ?? [] : [];
  const pendingWitch = (hasWitch && !isLastTrick && witchPlayerHand.length > 0)
    ? witchPlayerIdx
    : null;

  await supabase.from("rooms").update({
    current_trick: [], current_player: winnerIdx,
    last_trick_winner: winnerIdx, last_trick_cards: trick,
    phase: "trickEnd",
    // If both Jongleur (7½) and Wolke (9¾) are in the trick,
    // Jongleur resolves first (official FAQ). Defer rainbow9 until after rainbow7 is done.
    pending_rainbow9: (has9Active && !has7) ? winnerIdx : null,
    pending_rainbow9_deferred: (has9Active && has7) ? winnerIdx : null,
    pending_rainbow7: rainbow7Players,
    pending_witch: pendingWitch,
    log: room.log
  }).eq("id", roomId);
  scheduleClearTrick(supabase, roomId); // server clears the trick after display delay
  dbg("[advanceTrick] after trickEnd update, room.trump_suit:", room.trump_suit, "room.werewolf_suit:", room.werewolf_suit);

  // If the witch player is an AI, auto-swap immediately
  if (pendingWitch !== null && players[pendingWitch]?.is_ai) {
    // Reload fresh player data to avoid stale hands from previous round
    const { data: freshWitchPlayers } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
    const witchAI = freshWitchPlayers?.[pendingWitch] ?? players[pendingWitch];
    const swappableTrick = trick.filter(t => t.card.specialType !== "witch" && t.card.id !== "witch");
    if (swappableTrick.length > 0 && witchAI.hand.length > 0) {
      const takenEntry = swappableTrick.reduce((best, t) =>
        (t.card.value ?? 0) > (best.card.value ?? 0) ? t : best, swappableTrick[0]);
      const takenCard = takenEntry.card;
      const givenCard = witchAI.hand.reduce((worst, c) =>
        (c.value ?? 0) < (worst.value ?? 0) ? c : worst, witchAI.hand[0]);
      const newHand = witchAI.hand.filter(c => c.id !== givenCard.id);
      newHand.push(takenCard);
      await supabase.from("room_players").update({ hand: newHand }).eq("id", witchAI.id);
      addLog(room, `🧹 ${witchAI.ai_name} tauscht: gibt ${cardLabel(givenCard)} · nimmt ${cardLabel(takenCard)}`);
      await supabase.from("rooms").update({
        pending_witch: null,
        phase: "witchReveal",
        witch_swap: { playerName: witchAI.ai_name, gave: givenCard, took: takenCard },
        log: room.log
      }).eq("id", roomId);
      scheduleWitchRevealDone(supabase, roomId);
    } else {
      await supabase.from("rooms").update({ pending_witch: null }).eq("id", roomId);
    }
  }

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
  dbg("[advanceTrick] totalTricksPlayed:", totalTricksPlayed, "currentRound:", currentRound, "allHandsEmpty:", allHandsEmpty, "roundOver:", roundOver);

  // If the 9¾ winner is an AI, resolve it automatically right away
  if (has9Active && updatedPlayers2[winnerIdx]?.is_ai) {
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

  // Note: even if roundOver is true, we do NOT call endRound here.
  // We stay in "trickEnd" so the last trick remains visible for the same
  // duration as any other trick. The client's clearTrick (after its display
  // delay) will detect roundOver and call endRound at that point - unless
  // there's a pending human action (9¾/7½/Hexe), which must resolve first
  // (see rainbow9Adjust, passCard, witchRevealDone).

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
  await upd(supabase.from("room_decks").upsert({ room_id: roomId, deck: remainingDeck }), "deck.deal");

  dbg("[dealRound] dealing", room.round, "cards to", players.length, "players, deck size:", deck.length + players.length * room.round + 1);
  // Atomic dealing via RPC (all hands in one transaction); per-row fallback if RPC missing.
  {
    const { error: dealRpcErr } = await supabase.rpc("deal_hands", {
      p_room_id: roomId,
      p_hands: players.map((p, i) => ({ playerIndex: p.player_index, hand: hands[i] })),
    });
    if (dealRpcErr) {
      console.error("[dealRound] RPC unavailable, falling back:", dealRpcErr.message);
      for (let i = 0; i < players.length; i++) {
        await upd(supabase.from("room_players").update({ hand: hands[i], bid: null, tricks_won: 0 }).eq("id", players[i].id), "deal.hand");
      }
    }
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
    // Draw the card "under the werewolf" (next card from remaining deck) - vampire will copy this
    const cardUnderWerewolf = remainingDeck.length > 0 ? remainingDeck[remainingDeck.length - 1] : null;
    const wPhase = werewolfHolder.is_ai ? "bidding" : "choosingWerewolf";
    const wSuit = werewolfHolder.is_ai ? SUITS[Math.floor(Math.random() * 4)] : null;
    const wPlayer = werewolfHolder.is_ai ? (room.dealer + 1) % players.length : werewolfHolder.player_index;
    if (werewolfHolder.is_ai) addLog(room, `${werewolfHolder.ai_name} wählt Stichfarbe: ${suitDot(wSuit)}`);
    await supabase.from("rooms").update({
      round: room.round, max_rounds: room.max_rounds, dealer: room.dealer,
      trump_card: werewolfCard, trump_suit: null,
      original_trump_card: cardUnderWerewolf, // card under werewolf - vampire copies this
      phase: wPhase, current_player: wPlayer,
      werewolf_suit: wSuit,
      current_trick: [], last_trick_winner: null, last_trick_cards: null,
      pending_rainbow7: null, pending_rainbow9: null, pending_rainbow9_deferred: null, pending_witch: null, pending_vampire_reveal: null,
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
    // Card under the werewolf = next card from remaining deck (for vampire to copy)
    const cardUnderWerwolf2 = remainingDeck.length > 0 ? remainingDeck[remainingDeck.length - 1] : null;
    if (players[room.dealer].is_ai) {
      const suit = SUITS[Math.floor(Math.random() * 4)];
      await supabase.from("rooms").update({
        round: room.round, max_rounds: room.max_rounds, dealer: room.dealer,
        trump_card: trumpCard, trump_suit: null, werewolf_suit: suit,
        original_trump_card: cardUnderWerwolf2,
        phase: "bidding", current_player: nextBidder,
        current_trick: [], last_trick_winner: null, last_trick_cards: null,
        pending_rainbow7: null, pending_rainbow9: null, pending_rainbow9_deferred: null, pending_witch: null, pending_vampire_reveal: null,
        log: room.log
      }).eq("id", roomId);
      return await tickAIBids(supabase, roomId, { ...room, phase: "bidding", current_player: nextBidder, werewolf_suit: suit }, dealtPlayers);
    }
  } else if (trumpCard?.specialType === "dragon") {
    // Offiz. FAQ: Drache als Trumpfkarte → Dealer bestimmt eine Trumpffarbe
    // (wie beim Zauberer). Zuvor fiel dies durch den generischen Fallback
    // fälschlich auf "kein Trumpf" (dragon.suit ist null), da kein eigener
    // Zweig existierte.
    phase = "choosingTrump";
    currentPlayer = room.dealer;
    addLog(room, `Runde ${room.round} – Drache als Trumpf: Dealer wählt Trumpffarbe`);
    if (players[room.dealer].is_ai) {
      trumpSuit = SUITS[Math.floor(Math.random() * 4)];
      phase = "bidding";
      currentPlayer = nextBidder;
      addLog(room, `${players[room.dealer].ai_name} wählt Trumpf: ${suitDot(trumpSuit)}`);
    }
  } else if (trumpCard?.specialType === "vampire") {
    // Offiz. FAQ: "Deckst du bei der Bestimmung der Trumpffarbe den Vampir auf,
    // bestimmst du eine Trumpffarbe." → Dealer wählt, wie beim Zauberer.
    phase = "choosingTrump";
    currentPlayer = room.dealer;
    addLog(room, `Runde ${room.round} – Vampir als Trumpf: Dealer wählt Trumpffarbe`);
    if (players[room.dealer].is_ai) {
      trumpSuit = SUITS[Math.floor(Math.random() * 4)];
      phase = "bidding";
      currentPlayer = nextBidder;
      addLog(room, `${players[room.dealer].ai_name} wählt Trumpf: ${suitDot(trumpSuit)}`);
    }
  } else if (trumpCard?.specialType === "witch" || trumpCard?.specialType === "rainbow7") {
    // Hexe oder Jongleur als Trumpfkarte → kein Trumpf (offiz. FAQ)
    addLog(room, `Runde ${room.round} – ${trumpCard.specialType === "rainbow7" ? "Jongleur" : "Hexe"} als Trumpf: Kein Trumpf`);
    // phase stays "bidding", trumpSuit stays null
  } else if (trumpCard?.specialType === "rainbow9") {
    // Wolke als Trumpfkarte → Dealer wählt Trumpffarbe (offiz. FAQ)
    phase = "choosingTrump";
    currentPlayer = room.dealer;
    addLog(room, `Runde ${room.round} – Wolke als Trumpf: Dealer wählt Trumpffarbe`);
    if (players[room.dealer].is_ai) {
      trumpSuit = SUITS[Math.floor(Math.random() * 4)];
      phase = "bidding";
      currentPlayer = nextBidder;
      addLog(room, `${players[room.dealer].ai_name} wählt Trumpf: ${suitDot(trumpSuit)}`);
    }
  } else {
    addLog(room, `Runde ${room.round} – Trumpf: ${trumpCard ? (trumpCard.type === "fool" ? "Kein Trumpf" : suitDot(trumpCard.suit)) : "–"}`);
  }

  await supabase.from("rooms").update({
    round: room.round, max_rounds: room.max_rounds, dealer: room.dealer,
    trump_card: trumpCard, trump_suit: trumpSuit,
    original_trump_card: null,
    phase, current_player: currentPlayer,
    current_trick: [], last_trick_winner: null, last_trick_cards: null,
    werewolf_suit: null, pending_rainbow7: null, pending_rainbow9: null, pending_rainbow9_deferred: null, pending_witch: null, pending_vampire_reveal: null,
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

  if (rateLimited(user.id)) return json({ error: "Zu viele Anfragen" }, 429);

  // createRoom/joinRoom don't operate on an existing roomId yet (createRoom
  // makes one, joinRoom resolves the room from a room code) - skip the lookup.
  if (action === "createRoom" || action === "joinRoom") {
    switch (action) {
      case "createRoom": {
        const code = Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
        const uname = (body.username ?? "Spieler").toString().slice(0, 24);
        const { data: newRoom, error: crErr } = await supabase.from("rooms")
          .insert({ code, host_id: user.id, phase: "lobby", round: 0, max_rounds: 0, dealer: 0, current_player: 0, log: [], edition: body.edition === "anniversary" ? "anniversary" : "classic" })
          .select("id, code").single();
        if (crErr || !newRoom) return json({ error: "Raum konnte nicht erstellt werden" }, 500);
        await upd(supabase.from("room_players").insert({ room_id: newRoom.id, user_id: user.id, player_index: 0, is_ai: false, ai_name: uname, hand: [], score: 0, tricks_won: 0, connected: true }), "createRoom.player");
        return json({ ok: true, roomId: newRoom.id, code: newRoom.code });
      }
      case "joinRoom": {
        const jcode = (body.code ?? "").toString().toUpperCase().slice(0, 8);
        const { data: jRoom } = await supabase.from("rooms").select("id, phase").eq("code", jcode).single();
        if (!jRoom) return json({ error: "Raum nicht gefunden" }, 404);
        if (jRoom.phase !== "lobby") return json({ error: "Spiel läuft bereits" }, 400);
        const { data: existing } = await supabase.from("room_players").select("player_index, user_id").eq("room_id", jRoom.id);
        if (existing?.some(p => p.user_id === user.id)) return json({ ok: true, roomId: jRoom.id }); // already joined
        if ((existing?.length ?? 0) >= 6) return json({ error: "Raum ist voll" }, 400);
        const uname2 = (body.username ?? "Spieler").toString().slice(0, 24);
        await upd(supabase.from("room_players").insert({ room_id: jRoom.id, user_id: user.id, player_index: existing?.length ?? 0, is_ai: false, ai_name: uname2, hand: [], score: 0, tricks_won: 0, connected: true }), "joinRoom.player");
        // Touch rooms so lobby clients get a realtime event and reload the player list
        await upd(supabase.from("rooms").update({ log: [`${uname2} ist beigetreten`] }).eq("id", jRoom.id), "joinRoom.touch");
        return json({ ok: true, roomId: jRoom.id });
      }
    }
  }

  const { data: roomRow } = await supabase.from("rooms").select("*").eq("id", roomId).single();
  if (!roomRow) return json({ error: "Raum nicht gefunden" }, 404);
  const room = roomRow;

  const { data: playerRows } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
  const players = playerRows ?? [];
  const callerPlayer = players.find(p => p.user_id === user.id);
  const callerIdx = callerPlayer?.player_index ?? -1;

  switch (action) {


    case "clearTrick": return await handleClearTrick(supabase, roomId, room);

    case "witchRevealDone": return await handleWitchRevealDone(supabase, roomId, room);

    case "triggerAI": {
      // Reload fresh room state - the room loaded at handler start may be stale
      const { data: freshRoom2 } = await supabase.from("rooms").select("*").eq("id", roomId).single();
      const currentRoom = freshRoom2 ?? room;
      if (currentRoom.phase !== "playing") return json({ ok: true });
      const { data: freshP } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
      const fp = freshP ?? players;
      dbg("[triggerAI] current_player:", currentRoom.current_player, "is_ai:", fp[currentRoom.current_player]?.is_ai, "hand:", fp[currentRoom.current_player]?.hand?.length);
      if (!fp[currentRoom.current_player]?.is_ai) return json({ ok: true });
      if (!fp[currentRoom.current_player]?.hand?.length) {
        dbg("[triggerAI] hand already empty - concurrent call, skipping");
        return json({ ok: true });
      }
      return await aiPlayNext(supabase, roomId, { ...currentRoom, current_trick: currentRoom.current_trick ?? [] }, fp);
    }

    case "startGame": {
      if (callerIdx !== 0) return json({ error: "Nur der Host kann starten" }, 403);
      const aiCount = Number(body.aiCount ?? 0);
      if (!Number.isInteger(aiCount) || aiCount < 0) return json({ error: "Ungültige KI-Anzahl" }, 400);
      const aiInserts = [];
      for (let i = players.length; i < Math.min(6, players.length + aiCount); i++) {
        aiInserts.push({ room_id: roomId, player_index: i, is_ai: true, ai_name: `KI ${i - players.length + 1}`, hand: [], score: 0, tricks_won: 0, connected: true });
      }
      let insertedAI = [];
      if (aiInserts.length > 0) {
        const { data: aiData } = await supabase.from("room_players").insert(aiInserts).select();
        insertedAI = aiData ?? [];
        dbg("[startGame] inserted AI players:", insertedAI.length, insertedAI.map(p => p.id));
      }
      // Reload ALL players from DB to get correct IDs
      const { data: freshAllPlayers } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
      const allPlayers = freshAllPlayers ?? [...players, ...insertedAI];
      dbg("[startGame] allPlayers:", allPlayers.length, allPlayers.map(p => ({ id: p.id, name: p.ai_name })));
      const maxRounds = Math.floor(60 / allPlayers.length);
      const edition = body.edition ?? room.edition ?? "classic";
      addLog(room, `Spiel gestartet mit ${allPlayers.length} Spielern (${edition === "anniversary" ? "30 Jahre Edition" : "Classic"})`);
      await supabase.from("rooms").update({ max_rounds: maxRounds, round: 1, dealer: 0, edition, log: room.log }).eq("id", roomId);
      return await dealRound(supabase, roomId, { ...room, round: 1, max_rounds: maxRounds, dealer: 0, log: room.log }, allPlayers);
    }

    case "chooseTrump": {
      if (room.phase !== "choosingTrump") return json({ error: "Falscher Status" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      if (!SUITS.includes(body.suit)) return json({ error: "Ungültige Farbe" }, 400);
      addLog(room, `Trumpf gewählt: ${suitDot(body.suit)}`);
      const nextBidder = (room.dealer + 1) % players.length;
      await supabase.from("rooms").update({ trump_suit: body.suit, phase: "bidding", current_player: nextBidder, log: room.log }).eq("id", roomId);
      return await tickAIBids(supabase, roomId, { ...room, trump_suit: body.suit, phase: "bidding", current_player: nextBidder, log: room.log }, players);
    }

    case "chooseWerewolf": {
      if (room.phase !== "choosingWerewolf") return json({ error: "Falscher Status" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      if (!SUITS.includes(body.suit)) return json({ error: "Ungültige Farbe" }, 400);
      addLog(room, `🐺 Stichfarbe gewählt: ${suitDot(body.suit)}`);
      const nextBidder = (room.dealer + 1) % players.length;
      await supabase.from("rooms").update({ werewolf_suit: body.suit, phase: "bidding", current_player: nextBidder, log: room.log }).eq("id", roomId);
      return await tickAIBids(supabase, roomId, { ...room, werewolf_suit: body.suit, phase: "bidding", current_player: nextBidder, log: room.log }, players);
    }

    case "bid": {
      if (room.phase !== "bidding") return json({ error: "Falscher Status" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      const bid = Number(body.bid);
      if (!Number.isInteger(bid) || bid < 0 || bid > room.round) return json({ error: "Ungültiges Gebot" }, 400);
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
      // The FIRST non-passive card in the trick establishes the led suit.
      // Fool is passive → if fool leads, the next number/rainbow card sets the suit.
      // Wizard leads → no suit at all (everyone free).
      const isPassiveCard = (c) => !c || c.type === "fool" ||
        ((c.specialType === "rainbow7" || c.specialType === "rainbow9") && !c.suit) ||
        (c.specialType === "vampire" && !(room.werewolf_suit ?? room.trump_suit)) ||
        ["witch","fairy","werewolf","wizardfool","bomb"].includes(c.specialType ?? "");
      const leadCard = room.current_trick.find(t => !isPassiveCard(t.card))?.card ?? null;
      const effectiveLedSuit = !leadCard ? null :
        leadCard.specialType === "vampire"
          ? (room.werewolf_suit ?? room.trump_suit)
          : (leadCard.suit ?? null);
      // Vampire is never forced as a follow-suit card (official FAQ rule)
      if (!isAlwaysPlayable(card) && effectiveLedSuit) {
        const canFollow = hand.some(c => c.suit === effectiveLedSuit && !isAlwaysPlayable(c));
        if (canFollow && card.suit !== effectiveLedSuit)
          return json({ error: `Du musst ${effectiveLedSuit} bekennen!` }, 400);
      }

      const isWitch = card.specialType === "witch";
      const isRainbowChoice = (card.specialType === "rainbow7" || card.specialType === "rainbow9") && body.suit;
      if (isRainbowChoice && !SUITS.includes(body.suit)) return json({ error: "Ungültige Farbe" }, 400);
      const newHand = hand.filter(c => c.id !== card.id);
      await upd(supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer.id), "playCard.hand");
      const playedCard = isWitch ? { ...card, type: "fool" } : (isRainbowChoice ? { ...card, suit: body.suit } : card);
      const newTrick = [...room.current_trick, { card: playedCard, playerIndex: callerIdx }];
      addLog(room, `${callerPlayer.ai_name}: ${cardLabel(playedCard)}`);
      if (card.specialType === "vampire" && room.werewolf_suit) {
        await revealCardUnderWerewolf(supabase, roomId, room);
      }
      return await advanceTrick(supabase, roomId, { ...room, current_trick: newTrick, current_player: callerIdx, log: room.log }, null);
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
        await upd(supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer.id), "playCard.hand");
        addLog(room, `🧹 ${callerPlayer.ai_name} tauscht: gibt ${cardLabel(givenCard)} · nimmt ${cardLabel(takenCard)}`);
        // Store swap info for 4 seconds display
        await supabase.from("rooms").update({
          pending_witch: null,
          phase: "witchReveal",
          witch_swap: { playerName: callerPlayer.ai_name, gave: givenCard, took: takenCard },
          log: room.log
        }).eq("id", roomId);
        // Round-over check happens in witchRevealDone/scheduleWitchRevealDone,
        // once the swap result has actually been displayed.
        scheduleWitchRevealDone(supabase, roomId);
        return json({ ok: true });
      }

      if (sa === "wizardfool") {
        const card = callerPlayer.hand.find(c => c.id === cardId);
        if (!card) return json({ error: "Karte nicht gefunden" }, 400);
        const newHand = callerPlayer.hand.filter(c => c.id !== cardId);
        await upd(supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer.id), "playCard.hand");
        const resolvedCard = { ...card, type: choice === "wizard" ? "wizard" : "fool" };
        const newTrick = [...room.current_trick, { card: resolvedCard, playerIndex: callerIdx }];
        addLog(room, `${callerPlayer.ai_name}: Ron als ${choice === "wizard" ? "Zauberer" : "Narr"}`);
        return await advanceTrick(supabase, roomId, { ...room, current_trick: newTrick, log: room.log }, null);
      }

      return json({ error: "Unbekannte Sonderaktion" }, 400);
    }

    case "passCard": {
      if (!Array.isArray(room.pending_rainbow7) || !room.pending_rainbow7.includes(callerIdx))
        return json({ error: "Nicht dein Zug" }, 400);
      const passedCard = callerPlayer.hand.find(c => c.id === body.cardId);
      if (!passedCard) return json({ error: "Karte nicht gefunden" }, 400);
      const newHand = callerPlayer.hand.filter(c => c.id !== body.cardId);
      await upd(supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer.id), "playCard.hand");
      const buffer = room.pending_rainbow7_buffer ?? {};
      buffer[callerIdx] = passedCard;
      addLog(room, `${callerPlayer.ai_name} hat eine Karte gewählt`);
      let remaining = room.pending_rainbow7.filter(i => i !== callerIdx);
      // Immediately write updated pending list to DB to prevent duplicate passCard calls
      await supabase.from("rooms").update({ pending_rainbow7: remaining, pending_rainbow7_buffer: buffer, log: room.log }).eq("id", roomId);
      // Reload fresh players for AI auto-pass to avoid stale hand data
      const { data: freshPassPlayers } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
      const updPlayers = freshPassPlayers ?? players;
      for (const aiIdx of [...remaining]) {
        const aiPlayer = updPlayers.find(p => p.player_index === aiIdx);
        if (aiPlayer?.is_ai && aiPlayer.hand.length > 0) {
          const aiCard = aiWorstCard(aiPlayer.hand, room.trump_suit, room.werewolf_suit);
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
          const leftIdx = (fromIdx + 1) % finalPlayers.length;
          const leftPlayer = finalPlayers.find(p => p.player_index === leftIdx);
          if (leftPlayer) await supabase.from("room_players").update({ hand: [...leftPlayer.hand, card] }).eq("id", leftPlayer.id);
        }
        addLog(room, "🎁 Alle haben eine Karte weitergegeben!");
        // After Jongleur resolves, activate deferred Wolke (9¾) if present
        const deferredRainbow9 = room.pending_rainbow9_deferred ?? null;
        await supabase.from("rooms").update({
          pending_rainbow7: null,
          pending_rainbow7_buffer: null,
          pending_rainbow9_deferred: null,
          pending_rainbow9: deferredRainbow9,
          phase: deferredRainbow9 !== null ? "trickEnd" : "playing",
          log: room.log
        }).eq("id", roomId);
        // If deferred rainbow9 is for an AI, auto-resolve it
        if (deferredRainbow9 !== null) {
          const { data: r9Players2 } = await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index");
          const r9Room2 = { ...room, pending_rainbow9: deferredRainbow9, pending_rainbow9_deferred: null };
          if (r9Players2 && r9Players2[deferredRainbow9]?.is_ai) {
            const wp = r9Players2[deferredRainbow9];
            const adj = (wp.tricks_won ?? 0) !== (wp.bid ?? 0) && (wp.bid ?? 0) > 0 && Math.random() < 0.5 ? -1 : 1;
            const newBid = Math.max(0, (wp.bid ?? 0) + adj);
            await supabase.from("room_players").update({ bid: newBid }).eq("id", wp.id);
            addLog(room, `${wp.ai_name} ändert Vorhersage auf ${newBid}`);
            await supabase.from("rooms").update({ pending_rainbow9: null, phase: "playing", log: room.log }).eq("id", roomId);
          }
        }
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
