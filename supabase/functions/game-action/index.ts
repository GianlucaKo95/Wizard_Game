import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ────────────────────────────────────────────────────────────────────
type Suit = "red" | "blue" | "green" | "yellow";
interface Card { id: string; type: "number"|"fool"|"wizard"; suit: Suit|null; value: number; }
interface TrickEntry { card: Card; playerIndex: number; }
interface RoomPlayer { id: string; room_id: string; player_index: number; is_ai: boolean; ai_name: string|null; user_id: string|null; hand: Card[]; bid: number|null; tricks_won: number; score: number; }
interface Room { id: string; code: string; phase: string; round: number; max_rounds: number; dealer: number; current_player: number; trump_card: Card|null; trump_suit: Suit|null; current_trick: TrickEntry[]; last_trick_winner: number|null; last_trick_cards: TrickEntry[]|null; log: string[]; }

// ─── Deck ─────────────────────────────────────────────────────────────────────
const SUITS: Suit[] = ["red","blue","green","yellow"];
function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS)
    for (let v = 1; v <= 13; v++)
      deck.push({ id: `${suit}-${v}`, type: "number", suit, value: v });
  for (let i = 0; i < 4; i++) deck.push({ id: `fool-${i}`, type: "fool", suit: null, value: 0 });
  for (let i = 0; i < 4; i++) deck.push({ id: `wizard-${i}`, type: "wizard", suit: null, value: 14 });
  return deck;
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

// ─── Game logic ───────────────────────────────────────────────────────────────
function trickWinner(trick: TrickEntry[], trumpSuit: Suit|null): number {
  let w = 0;
  for (let i = 0; i < trick.length; i++) {
    const c = trick[i].card, wc = trick[w].card;
    if (c.type==="wizard") { w=i; continue; }
    if (wc.type==="wizard") continue;
    if (c.type==="fool") continue;
    if (wc.type==="fool") { w=i; continue; }
    const ct = trumpSuit&&c.suit===trumpSuit, wt = trumpSuit&&wc.suit===trumpSuit;
    if (ct&&!wt) { w=i; continue; }
    if (wt&&!ct) continue;
    const led = trick.find(t=>t.card.type==="number")?.card.suit??null;
    if (c.suit===led&&wc.suit!==led) { w=i; continue; }
    if (wc.suit===led&&c.suit!==led) continue;
    if (c.value>wc.value) w=i;
  }
  return trick[w].playerIndex;
}

function calcScore(bid: number, got: number): number {
  return bid===got ? 20+bid*10 : -Math.abs(bid-got)*10;
}

function forbiddenDealerBid(bids: (number|null)[], dealerIdx: number, round: number): number|null {
  const sum = bids.reduce<number>((acc,b,i)=>i===dealerIdx?acc:acc+(b??0),0);
  const f = round-sum;
  return f>=0&&f<=round ? f : null;
}

function aiBid(hand: Card[]): number {
  let e = 0;
  for (const c of hand) {
    if (c.type==="wizard") e+=1;
    else if (c.value>=12) e+=0.7;
    else if (c.value>=10) e+=0.35;
  }
  return Math.round(e);
}

function aiChooseCard(hand: Card[], trick: TrickEntry[], trumpSuit: Suit|null): Card {
  const led = trick.find(t=>t.card.type==="number")?.card.suit??null;
  const followable = led ? hand.filter(c=>c.suit===led) : [];
  const playable = followable.length>0 ? followable : hand;
  const wiz = playable.find(c=>c.type==="wizard");
  if (wiz&&trick.length>0) return wiz;
  const str = (c: Card) => c.type==="wizard"?100:c.type==="fool"?-1:trumpSuit&&c.suit===trumpSuit?50+c.value:c.value;
  return [...playable].sort((a,b)=>str(b)-str(a))[playable.length-1];
}

function addLog(room: Room, msg: string) {
  room.log = [msg, ...room.log].slice(0,30);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });
  const { data: { user }, error: authErr } = await createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  ).auth.getUser();
  if (authErr || !user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { action, roomId, roomCode } = body;

  // Load room
  const { data: roomRow, error: roomErr } = await supabase
    .from("rooms").select("*").eq("id", roomId).single();
  if (roomErr || !roomRow) return json({ error: "Raum nicht gefunden" }, 404);

  const room = roomRow as Room;

  // Load players
  const { data: playerRows } = await supabase
    .from("room_players").select("*").eq("room_id", roomId).order("player_index");
  const players: RoomPlayer[] = playerRows ?? [];

  // Find caller's player index
  const callerPlayer = players.find(p => p.user_id === user.id);
  const callerIdx = callerPlayer?.player_index ?? -1;

  // ── Actions ────────────────────────────────────────────────────────────────
  switch (action) {

    case "startGame": {
      if (callerIdx !== 0) return json({ error: "Nur der Host kann starten" }, 403);
      const { aiCount = 0 } = body;
      // Add AI players
      const aiInserts = [];
      for (let i = players.length; i < Math.min(6, players.length + aiCount); i++) {
        aiInserts.push({ room_id: roomId, player_index: i, is_ai: true, ai_name: `KI ${i - players.length + 1}`, hand: [], score: 0, tricks_won: 0, connected: true });
      }
      if (aiInserts.length > 0) await supabase.from("room_players").insert(aiInserts);

      const allPlayers = [...players, ...aiInserts.map((ai,i)=>({...ai, player_index: players.length+i}))];
      const maxRounds = Math.floor(60 / allPlayers.length);
      await supabase.from("rooms").update({ max_rounds: maxRounds, round: 1, dealer: 0, phase: "dealing" }).eq("id", roomId);
      // Trigger first round deal
      return await dealRound(supabase, roomId, { ...room, round: 1, max_rounds: maxRounds, dealer: 0 }, allPlayers);
    }

    case "chooseTrump": {
      if (room.phase !== "choosingTrump") return json({ error: "Falscher Spielzustand" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      addLog(room, `${callerPlayer?.ai_name ?? "Du"} wählt Trumpf: ${body.suit}`);
      const nextBidder = (room.dealer + 1) % players.length;
      await supabase.from("rooms").update({
        trump_suit: body.suit, phase: "bidding",
        current_player: nextBidder, log: room.log
      }).eq("id", roomId);
      // Trigger AI bids if needed
      return await tickAIBids(supabase, roomId, { ...room, trump_suit: body.suit, phase: "bidding", current_player: nextBidder, log: room.log }, players);
    }

    case "bid": {
      if (room.phase !== "bidding") return json({ error: "Falscher Spielzustand" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      const bid = Number(body.bid);
      const bids = players.map(p=>p.bid);
      const forbidden = forbiddenDealerBid(bids, room.dealer, room.round);
      if (room.dealer === callerIdx && forbidden !== null && bid === forbidden)
        return json({ error: `Stichzwang: Du darfst nicht ${forbidden} bieten!` }, 400);

      await supabase.from("room_players").update({ bid }).eq("id", callerPlayer!.id);
      const updatedBids = bids.map((b,i)=>i===callerIdx?bid:b);
      addLog(room, `${callerPlayer?.ai_name ?? user.email} bietet: ${bid}`);
      const updatedPlayers = players.map((p,i)=>i===callerIdx?{...p,bid}:p);
      return await advanceBidder(supabase, roomId, room, updatedPlayers, updatedBids);
    }

    case "playCard": {
      if (room.phase !== "playing") return json({ error: "Falscher Spielzustand" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      const hand: Card[] = callerPlayer!.hand;
      const card = hand.find(c => c.id === body.cardId);
      if (!card) return json({ error: "Karte nicht gefunden" }, 400);

      // Validate follow suit
      const led = room.current_trick.find((t:TrickEntry)=>t.card.type==="number")?.card.suit??null;
      if (led && card.type==="number" && card.suit!==led && hand.some(c=>c.suit===led&&c.type==="number"))
        return json({ error: "Du musst Farbe bekennen!" }, 400);

      const newHand = hand.filter(c=>c.id!==card.id);
      await supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer!.id);
      const newTrick: TrickEntry[] = [...room.current_trick, { card, playerIndex: callerIdx }];
      addLog(room, `${user.email}: ${cardLabel(card)}`);
      const updatedPlayers = players.map((p,i)=>i===callerIdx?{...p,hand:newHand}:p);
      return await advanceTrick(supabase, roomId, { ...room, current_trick: newTrick, log: room.log }, updatedPlayers);
    }

    case "nextRound": {
      if (room.phase !== "roundEnd") return json({ error: "Falscher Spielzustand" }, 400);
      if (callerIdx !== 0) return json({ error: "Nur der Host" }, 403);
      const newRound = room.round + 1;
      const newDealer = (room.dealer + 1) % players.length;
      return await dealRound(supabase, roomId, { ...room, round: newRound, dealer: newDealer }, players);
    }

    case "newGame": {
      if (callerIdx !== 0) return json({ error: "Nur der Host" }, 403);
      await supabase.from("room_players").update({ score: 0, bid: null, tricks_won: 0, hand: [] }).eq("room_id", roomId);
      await supabase.from("round_history").delete().eq("room_id", roomId);
      return await dealRound(supabase, roomId, { ...room, round: 1, dealer: 0, log: ["Neues Spiel gestartet"] }, players.map(p=>({...p,score:0,bid:null,tricks_won:0})));
    }

    default:
      return json({ error: "Unbekannte Aktion" }, 400);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function dealRound(supabase: any, roomId: string, room: Room, players: RoomPlayer[]) {
  const deck = shuffle(buildDeck());
  const hands: Card[][] = players.map(()=>[]);
  for (let i = 0; i < room.round; i++)
    for (let p = 0; p < players.length; p++)
      hands[p].push(deck.pop()!);

  const trumpCard = deck.pop() ?? null;
  const trumpSuit = trumpCard?.suit ?? null;

  // Save hands
  for (let i = 0; i < players.length; i++) {
    await supabase.from("room_players").update({ hand: hands[i], bid: null, tricks_won: 0 }).eq("id", players[i].id);
  }

  const nextBidder = (room.dealer + 1) % players.length;
  let phase = "bidding";
  let currentPlayer = nextBidder;

  addLog(room, `Runde ${room.round} – Trumpf: ${trumpCard ? (trumpCard.type==="fool"?"Kein Trumpf":trumpCard.suit??"–") : "–"}`);

  if (trumpCard?.type === "wizard") {
    phase = "choosingTrump";
    currentPlayer = room.dealer;
    addLog(room, "Zauberer aufgedeckt – Dealer wählt Trumpf");
    // If AI dealer, pick immediately
    if (players[room.dealer].is_ai) {
      const suit = SUITS[Math.floor(Math.random()*4)];
      addLog(room, `${players[room.dealer].ai_name} wählt Trumpf: ${suit}`);
      phase = "bidding";
      currentPlayer = nextBidder;
      await supabase.from("rooms").update({
        round: room.round, max_rounds: room.max_rounds, dealer: room.dealer,
        phase, current_player: currentPlayer,
        trump_card: trumpCard, trump_suit: suit,
        current_trick: [], last_trick_winner: null, last_trick_cards: null, log: room.log
      }).eq("id", roomId);
      const updatedPlayers = players.map((p,i)=>({...p,hand:hands[i],bid:null,tricks_won:0}));
      return await tickAIBids(supabase, roomId, { ...room, trump_suit: suit as Suit, phase, current_player: currentPlayer, current_trick: [], log: room.log }, updatedPlayers);
    }
  }

  await supabase.from("rooms").update({
    round: room.round, max_rounds: room.max_rounds, dealer: room.dealer,
    phase, current_player: currentPlayer,
    trump_card: trumpCard, trump_suit: trumpSuit,
    current_trick: [], last_trick_winner: null, last_trick_cards: null, log: room.log
  }).eq("id", roomId);

  const updatedPlayers = players.map((p,i)=>({...p,hand:hands[i],bid:null,tricks_won:0}));
  if (phase === "bidding") {
    return await tickAIBids(supabase, roomId, { ...room, phase, current_player: currentPlayer, trump_suit: trumpSuit, current_trick: [], log: room.log }, updatedPlayers);
  }
  return json({ ok: true });
}

async function tickAIBids(supabase: any, roomId: string, room: any, players: RoomPlayer[]) {
  let current = room.current_player;
  const bids = players.map((p:RoomPlayer)=>p.bid);
  const startBidder = (room.dealer+1) % players.length;
  let iterations = 0;

  while (players[current]?.is_ai && iterations++ < players.length) {
    let bid = aiBid(players[current].hand);
    const forbidden = forbiddenDealerBid(bids, room.dealer, room.round);
    if (room.dealer===current && forbidden!==null && bid===forbidden)
      bid = bid===room.round ? 0 : bid+1;
    bids[current] = bid;
    players[current].bid = bid;
    addLog(room, `${players[current].ai_name} bietet: ${bid}`);
    await supabase.from("room_players").update({ bid }).eq("id", players[current].id);
    current = (current+1)%players.length;
    if (current===startBidder && bids.every((b:any)=>b!==null)) break;
  }

  const allBid = bids.every((b:any)=>b!==null);
  const newPhase = allBid ? "playing" : "bidding";
  const newCurrent = allBid ? startBidder : current;

  await supabase.from("rooms").update({ phase: newPhase, current_player: newCurrent, log: room.log }).eq("id", roomId);
  return json({ ok: true });
}

async function advanceBidder(supabase: any, roomId: string, room: Room, players: RoomPlayer[], bids: (number|null)[]) {
  const startBidder = (room.dealer+1) % players.length;
  const allBid = bids.every(b=>b!==null);
  const next = (room.current_player+1) % players.length;
  const newPhase = allBid ? "playing" : "bidding";
  const newCurrent = allBid ? startBidder : next;

  await supabase.from("rooms").update({ phase: newPhase, current_player: newCurrent, log: room.log }).eq("id", roomId);

  if (!allBid && players[newCurrent]?.is_ai) {
    return await tickAIBids(supabase, roomId, { ...room, phase: newPhase, current_player: newCurrent }, players);
  }
  return json({ ok: true });
}

async function advanceTrick(supabase: any, roomId: string, room: Room, players: RoomPlayer[]) {
  const trick = room.current_trick;

  if (trick.length < players.length) {
    const next = (room.current_player+1) % players.length;
    await supabase.from("rooms").update({ current_trick: trick, current_player: next, log: room.log }).eq("id", roomId);
    // AI plays
    if (players[next]?.is_ai) {
      const card = aiChooseCard(players[next].hand, trick, room.trump_suit);
      const newHand = players[next].hand.filter((c:Card)=>c.id!==card.id);
      await supabase.from("room_players").update({ hand: newHand }).eq("id", players[next].id);
      const newTrick = [...trick, { card, playerIndex: next }];
      addLog(room, `${players[next].ai_name}: ${cardLabel(card)}`);
      const updatedPlayers = players.map((p,i)=>i===next?{...p,hand:newHand}:p);
      return await advanceTrick(supabase, roomId, { ...room, current_trick: newTrick, current_player: next, log: room.log }, updatedPlayers);
    }
    return json({ ok: true });
  }

  // Trick complete
  const winnerIdx = trickWinner(trick, room.trump_suit);
  const winner = players[winnerIdx];
  const newTricksWon = winner.tricks_won + 1;
  await supabase.from("room_players").update({ tricks_won: newTricksWon }).eq("id", winner.id);
  addLog(room, `✓ ${winner.ai_name ?? "Spieler"} gewinnt den Stich!`);

  await supabase.from("rooms").update({
    current_trick: [], current_player: winnerIdx,
    last_trick_winner: winnerIdx, last_trick_cards: trick,
    phase: "trickEnd", log: room.log
  }).eq("id", roomId);

  const updatedPlayers = players.map((p,i)=>i===winnerIdx?{...p,tricks_won:newTricksWon}:p);

  // Check if round over (all hands empty)
  const handsEmpty = updatedPlayers.every(p=>p.hand.length===0);
  if (handsEmpty) {
    // Score round
    const results = updatedPlayers.map((p,i)=>{
      const delta = calcScore(p.bid??0, p.tricks_won);
      return { playerIndex: i, name: p.ai_name??`Spieler ${i+1}`, bid: p.bid??0, got: p.tricks_won, delta, totalScore: p.score+delta };
    });
    for (const r of results) {
      await supabase.from("room_players").update({ score: r.totalScore }).eq("id", updatedPlayers[r.playerIndex].id);
    }
    await supabase.from("round_history").insert({ room_id: roomId, round: room.round, results });

    const isLastRound = room.round >= room.max_rounds;
    await supabase.from("rooms").update({ phase: isLastRound ? "gameEnd" : "roundEnd", log: room.log }).eq("id", roomId);

    if (isLastRound) {
      // Save game stats
      const sorted = [...results].sort((a,b)=>b.totalScore-a.totalScore);
      for (const r of results) {
        const p = updatedPlayers[r.playerIndex];
        if (!p.is_ai && p.user_id) {
          const placement = sorted.findIndex(s=>s.playerIndex===r.playerIndex)+1;
          await supabase.from("game_stats").insert({
            room_id: roomId, user_id: p.user_id,
            placement, final_score: r.totalScore,
            total_rounds: room.max_rounds,
            tricks_bid: results.reduce((a,rr)=>a+rr.bid,0),
            tricks_won: results.reduce((a,rr)=>a+rr.got,0),
          });
        }
      }
    }
  } else {
    // Short delay then continue – set phase back to playing
    setTimeout(async () => {
      await supabase.from("rooms").update({ phase: "playing" }).eq("id", roomId);
      if (updatedPlayers[winnerIdx]?.is_ai) {
        const { data: freshRoom } = await supabase.from("rooms").select("*").eq("id", roomId).single();
        const card = aiChooseCard(updatedPlayers[winnerIdx].hand, [], freshRoom.trump_suit);
        const newHand = updatedPlayers[winnerIdx].hand.filter((c:Card)=>c.id!==card.id);
        await supabase.from("room_players").update({ hand: newHand }).eq("id", updatedPlayers[winnerIdx].id);
        const newTrick = [{ card, playerIndex: winnerIdx }];
        addLog(freshRoom, `${updatedPlayers[winnerIdx].ai_name}: ${cardLabel(card)}`);
        await advanceTrick(supabase, roomId, { ...freshRoom, current_trick: newTrick, log: freshRoom.log }, updatedPlayers.map((p,i)=>i===winnerIdx?{...p,hand:newHand}:p));
      }
    }, 1500);
  }

  return json({ ok: true });
}

function cardLabel(card: Card): string {
  if (card.type==="wizard") return "🧙 Zauberer";
  if (card.type==="fool") return "🃏 Narr";
  const sym = {red:"♥",blue:"♠",green:"♣",yellow:"♦"}[card.suit!];
  return `${card.value}${sym}`;
}

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
