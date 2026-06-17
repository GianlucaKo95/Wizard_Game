// @ts-nocheck
// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ────────────────────────────────────────────────────────────────────
type Suit = "red" | "blue" | "green" | "yellow";
interface Card { id: string; type: "number"|"fool"|"wizard"|"special"; suit: Suit|null; value: number; specialType?: string; }
interface TrickEntry { card: Card; playerIndex: number; }
interface RoomPlayer { id: string; room_id: string; player_index: number; is_ai: boolean; ai_name: string|null; user_id: string|null; hand: Card[]; bid: number|null; tricks_won: number; score: number; }
interface Room { id: string; code: string; phase: string; round: number; max_rounds: number; dealer: number; current_player: number; trump_card: Card|null; trump_suit: Suit|null; current_trick: TrickEntry[]; last_trick_winner: number|null; last_trick_cards: TrickEntry[]|null; log: string[]; werewolf_suit?: Suit|null; bomb_active?: boolean; pending_rainbow9?: number|null; pending_rainbow7?: number[]|null;
pending_rainbow7_buffer?: Record<number,Card>|null;
edition?: "classic"|"anniversary";
remaining_deck?: Card[]|null;
vampire_revealed?: Card|null;
pending_witch?: number|null; // playerIndex of witch player who can swap }

// ─── Deck ─────────────────────────────────────────────────────────────────────
const SUITS: Suit[] = ["red","blue","green","yellow"];
function buildDeck(edition: "classic"|"anniversary" = "classic"): Card[] {
  const deck: Card[] = [];
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
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

// ─── Game logic ───────────────────────────────────────────────────────────────
function trickWinner(trick: TrickEntry[], trumpSuit: Suit|null, werewolfSuit: Suit|null = null, bombActive = false): number {
  // Bomb – no winner
  if (bombActive || trick.some(t => t.card.specialType === "bomb")) return -1;

  const effectiveTrump = werewolfSuit ?? trumpSuit;

  // Dragon wins against EVERYTHING including wizards – only fairy beats it
  const hasDragon = trick.some(t => t.card.specialType === "dragon");
  const hasFairy  = trick.some(t => t.card.specialType === "fairy");

  if (hasDragon) {
    if (hasFairy) {
      // Fairy is the only card that beats the dragon
      const fi = trick.findIndex(t => t.card.specialType === "fairy");
      return trick[fi].playerIndex;
    }
    const di = trick.findIndex(t => t.card.specialType === "dragon");
    return trick[di].playerIndex;
  }

  // Resolve vampire effect
  const hasVampire = trick.some(t => t.card.specialType === "vampire");
  let vampireSuit: Suit|null = null;
  let vampireRevealedCard: Card|null = null;

  if (hasVampire) {
    if (room.trump_card?.specialType === "werewolf") {
      // Flip next card from remaining deck
      const deck = Array.isArray(room.remaining_deck) ? [...room.remaining_deck] : [];
      if (deck.length > 0) {
        vampireRevealedCard = deck.pop()!;
        vampireSuit = vampireRevealedCard.suit ?? null;
        // Save updated deck and revealed card
        await supabase.from("rooms").update({
          remaining_deck: deck,
          vampire_revealed: vampireRevealedCard
        }).eq("id", roomId);
        addLog(room, `🧛 Vampir deckt auf: ${vampireRevealedCard.suit ?? "Narr"} – gilt als Stichfarbe für diesen Stich`);
      }
    } else if (room.trump_card?.type === "fool") {
      vampireSuit = null; // acts as fool
    } else {
      vampireSuit = effectiveTrump;
    }
  }

  let effectiveTrick = trick.map(t => {
    if (t.card.specialType === "vampire") {
      if (!vampireSuit) return t; // acts as fool if no trump
      return { ...t, card: { ...t.card, suit: vampireSuit, type: "number" as const, value: 0 } };
    }
    return t;
  });

  let w = 0;
  for (let i = 0; i < effectiveTrick.length; i++) {
    const c = effectiveTrick[i].card, wc = effectiveTrick[w].card;
    if (c.type==="wizard") { w=i; continue; }
    if (wc.type==="wizard") continue;
    // Witch = fool, wizardfool resolved before this
    if (c.type==="fool" || c.specialType==="witch" || c.specialType==="fairy" || c.specialType==="werewolf" || c.specialType==="rainbow7" || c.specialType==="rainbow9" || c.specialType==="wizardfool") continue;
    if (wc.type==="fool" || wc.specialType==="witch" || wc.specialType==="fairy" || wc.specialType==="werewolf" || wc.specialType==="rainbow7" || wc.specialType==="rainbow9" || wc.specialType==="wizardfool") { w=i; continue; }
    const ct = effectiveTrump&&c.suit===effectiveTrump, wt = effectiveTrump&&wc.suit===effectiveTrump;
    if (ct&&!wt) { w=i; continue; }
    if (wt&&!ct) continue;
    const led = effectiveTrick.find(t=>t.card.type==="number"&&!t.card.specialType)?.card.suit??null;
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

function aiChooseCard(hand: Card[], trick: TrickEntry[], trumpSuit: Suit|null, werewolfSuit: Suit|null = null): Card {
  const ledEntry = trick.find(t =>
    t.card.type === "number" ||
    (t.card.specialType === "rainbow7" && t.card.suit) ||
    (t.card.specialType === "rainbow9" && t.card.suit)
  );
  const led = werewolfSuit ?? ledEntry?.card.suit ?? null;

  const isAlwaysPlayable = (c: Card) =>
    c.type === "fool" || c.type === "wizard" ||
    ["witch","wizardfool","dragon","fairy","bomb"].includes(c.specialType ?? "");

  const followable = led ? hand.filter(c => c.suit === led && !isAlwaysPlayable(c)) : [];
  const playable = followable.length > 0 ? followable : hand;

  // AI strategy for special cards
  const dragon = playable.find(c => c.specialType === "dragon");
  if (dragon && trick.length > 0 && !trick.some(t => t.card.specialType === "fairy")) return dragon;

  const wiz = playable.find(c => c.type === "wizard");
  if (wiz && trick.length > 0) return wiz;

  // Play bomb strategically: only if trick has many high cards and AI is losing
  const bomb = playable.find(c => c.specialType === "bomb");
  const highCards = trick.filter(t => t.card.value >= 10 || t.card.type === "wizard").length;
  if (bomb && highCards >= 2) return bomb;

  // Play wizardfool as wizard if leading, fool if behind
  const wf = playable.find(c => c.specialType === "wizardfool");
  if (wf) return { ...wf, type: trick.length === 0 ? "wizard" as const : "fool" as const };

  const effectiveTrump = werewolfSuit ?? trumpSuit;
  const str = (c: Card) =>
    c.type === "wizard" ? 100 :
    c.specialType === "dragon" ? 99 :
    c.type === "fool" || isAlwaysPlayable(c) ? -1 :
    effectiveTrump && c.suit === effectiveTrump ? 50 + c.value :
    c.value;

  const sorted = [...playable].sort((a, b) => str(b) - str(a));
  // Play lowest losing card or highest winning card
  return sorted[sorted.length - 1];
}

function addLog(room: Room, msg: string) {
  room.log = [msg, ...room.log].slice(0,30);
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Handler ──────────────────────────────────────────────────────────────────
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    case "chooseWerewolf": {
      if (room.phase !== "choosingWerewolf") return json({ error: "Falscher Spielzustand" }, 400);
      if (room.current_player !== callerIdx) return json({ error: "Nicht dein Zug" }, 403);
      addLog(room, `${callerPlayer?.ai_name ?? user.email} wählt Stichfarbe: ${body.suit}`);
      const nextBidder = (room.dealer + 1) % players.length;
      await supabase.from("rooms").update({
        werewolf_suit: body.suit, phase: "bidding",
        current_player: nextBidder, log: room.log
      }).eq("id", roomId);
      return await tickAIBids(supabase, roomId, { ...room, werewolf_suit: body.suit as Suit, phase: "bidding", current_player: nextBidder, log: room.log }, players);
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

      // Witch: play as fool, schedule swap after trick
      const isWitch = card.specialType === "witch";

      // Validate follow suit
      // Led suit: first number card OR rainbow card with chosen suit
      // Werewolf overrides led suit for whole round
      const ledEntry = room.current_trick.find((t:TrickEntry) =>
        t.card.type === "number" ||
        (t.card.specialType === "rainbow7" && t.card.suit) ||
        (t.card.specialType === "rainbow9" && t.card.suit)
      );
      const effectiveLedSuit = room.werewolf_suit ?? ledEntry?.card.suit ?? null;

      // Fool, Wizard, Witch, WizardFool, Dragon, Fairy, Bomb, Werewolf can always be played
      const isAlwaysPlayable = (c: Card) =>
        c.type === "fool" ||
        c.type === "wizard" ||
        ["witch","wizardfool","dragon","fairy","bomb"].includes(c.specialType ?? "");

      if (!isAlwaysPlayable(card) && effectiveLedSuit) {
        // Check if player can follow suit
        const canFollow = hand.some(c =>
          c.suit === effectiveLedSuit &&
          !isAlwaysPlayable(c)
        );
        if (canFollow && card.suit !== effectiveLedSuit) {
          return json({ error: `Du musst ${effectiveLedSuit} bekennen!` }, 400);
        }
      }

      const newHand = hand.filter(c=>c.id!==card.id);
      await supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer!.id);
      // Witch plays as fool in the trick
      const playedCard = isWitch ? { ...card, type: "fool" as const } : card;
      const newTrick: TrickEntry[] = [...room.current_trick, { card: playedCard, playerIndex: callerIdx }];
      addLog(room, `${callerPlayer!.ai_name}: ${cardLabel(card)}`);
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


    case "passCard": {
      // 7½ – collect cards in buffer, reveal only when ALL have chosen
      if (!Array.isArray(room.pending_rainbow7) || !room.pending_rainbow7.includes(callerIdx)) {
        return json({ error: "Nicht dein Zug zum Weitergeben" }, 400);
      }
      const passedCard = callerPlayer!.hand.find((c:Card) => c.id === body.cardId);
      if (!passedCard) return json({ error: "Karte nicht gefunden" }, 400);

      // Remove from hand
      const newHand = callerPlayer!.hand.filter((c:Card) => c.id !== body.cardId);
      await supabase.from("room_players").update({ hand: newHand }).eq("id", callerPlayer!.id);

      // Add to buffer
      const buffer: Record<number,Card> = (room.pending_rainbow7_buffer as any) ?? {};
      buffer[callerIdx] = passedCard;
      addLog(room, `${callerPlayer!.ai_name} hat eine Karte gewählt`);

      let remaining = room.pending_rainbow7.filter((i:number) => i !== callerIdx);

      // AI players choose automatically
      const updatedPlayers = players.map((p:RoomPlayer) => p.player_index === callerIdx ? {...p, hand: newHand} : p);
      for (const aiIdx of [...remaining]) {
        const aiPlayer = updatedPlayers.find((p:RoomPlayer) => p.player_index === aiIdx);
        if (aiPlayer?.is_ai && aiPlayer.hand.length > 0) {
          const aiCard = aiPlayer.hand[Math.floor(Math.random() * aiPlayer.hand.length)];
          const aiNewHand = aiPlayer.hand.filter((c:Card) => c.id !== aiCard.id);
          await supabase.from("room_players").update({ hand: aiNewHand }).eq("id", aiPlayer.id);
          buffer[aiIdx] = aiCard;
          addLog(room, `${aiPlayer.ai_name} hat eine Karte gewählt`);
          remaining = remaining.filter((i:number) => i !== aiIdx);
        }
      }

      if (remaining.length === 0) {
        // All chosen – distribute cards simultaneously
        const finalPlayers = (await supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index")).data ?? [];
        for (const [fromIdxStr, card] of Object.entries(buffer)) {
          const fromIdx = parseInt(fromIdxStr);
          const leftIdx = (fromIdx - 1 + finalPlayers.length) % finalPlayers.length;
          const leftPlayer = finalPlayers.find((p:any) => p.player_index === leftIdx);
          if (leftPlayer) {
            const updHand = [...leftPlayer.hand, card];
            await supabase.from("room_players").update({ hand: updHand }).eq("id", leftPlayer.id);
          }
        }
        addLog(room, "🎁 Alle haben eine Karte weitergegeben!");
        await supabase.from("rooms").update({
          pending_rainbow7: null, pending_rainbow7_buffer: null,
          phase: "playing", log: room.log
        }).eq("id", roomId);
      } else {
        await supabase.from("rooms").update({
          pending_rainbow7: remaining, pending_rainbow7_buffer: buffer, log: room.log
        }).eq("id", roomId);
      }
      return json({ ok: true });
    }

    case "rainbow9Adjust": {
      if (room.pending_rainbow9 !== callerIdx) return json({ error: "Nicht dein Zug" }, 400);
      const newBid = Math.max(0, (callerPlayer!.bid ?? 0) + (body.adjust ?? 1));
      await supabase.from("room_players").update({ bid: newBid }).eq("id", callerPlayer!.id);
      addLog(room, `${callerPlayer!.ai_name} ändert Vorhersage auf ${newBid} (9¾)`);
      await supabase.from("rooms").update({
        pending_rainbow9: null, phase: "playing", log: room.log
      }).eq("id", roomId);
      return json({ ok: true });
    }

    default:
      return json({ error: "Unbekannte Aktion" }, 400);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function dealRound(supabase: any, roomId: string, room: Room, players: RoomPlayer[]) {
  const deck = shuffle(buildDeck(room.edition ?? "classic"));
  const hands: Card[][] = players.map(()=>[]);
  for (let i = 0; i < room.round; i++)
    for (let p = 0; p < players.length; p++)
      hands[p].push(deck.pop()!);

  const trumpCard = deck.pop() ?? null;
  const remainingDeck = [...deck]; // save for vampire
  const trumpSuit = trumpCard?.suit ?? null;

  // Save hands
  for (let i = 0; i < players.length; i++) {
    await supabase.from("room_players").update({ hand: hands[i], bid: null, tricks_won: 0 }).eq("id", players[i].id);
  }

  const nextBidder = (room.dealer + 1) % players.length;
  let phase = "bidding";
  let currentPlayer = nextBidder;

  addLog(room, `Runde ${room.round} – Trumpf: ${trumpCard ? (trumpCard.type==="fool"?"Kein Trumpf":trumpCard.suit??"–") : "–"}`);

  // Check if any player received werewolf in hand
  const dealtPlayers = players.map((p, i) => ({ ...p, hand: hands[i] }));
  const werewolfHolder = dealtPlayers.find(p => p.hand.some((c:Card) => c.specialType === "werewolf"));
  if (werewolfHolder && trumpCard?.specialType !== "werewolf" && trumpCard !== null) {
    // Swap werewolf from hand with trump card
    const newHand = [...werewolfHolder.hand];
    const wi = newHand.findIndex((c:Card) => c.specialType === "werewolf");
    const werewolfCard = newHand[wi];
    newHand[wi] = trumpCard;
    await supabase.from("room_players").update({ hand: newHand, bid: null, tricks_won: 0 }).eq("id", werewolfHolder.id);
    addLog(room, `🐺 ${werewolfHolder.ai_name} hat den Werwolf – tauscht mit der Trumpfkarte!`);
    const wPhase = werewolfHolder.is_ai ? "bidding" : "choosingWerewolf";
    const wSuit = werewolfHolder.is_ai ? (["red","blue","green","yellow"] as Suit[])[Math.floor(Math.random()*4)] : null;
    const wPlayer = werewolfHolder.is_ai ? (room.dealer + 1) % players.length : werewolfHolder.player_index;
    if (werewolfHolder.is_ai) addLog(room, `${werewolfHolder.ai_name} wählt Stichfarbe: ${wSuit}`);
    await supabase.from("rooms").update({
      trump_card: werewolfCard, trump_suit: null,
      phase: wPhase, current_player: wPlayer,
      werewolf_suit: wSuit, remaining_deck: remainingDeck,
      current_trick: [], last_trick_winner: null, last_trick_cards: null,
      log: room.log
    }).eq("id", roomId);
    if (wPhase === "bidding") {
      const updPlayers = dealtPlayers.map(p => p.player_index === werewolfHolder.player_index ? {...p, hand: newHand} : p);
      return await tickAIBids(supabase, roomId, { ...room, trump_card: werewolfCard, phase: "bidding", current_player: wPlayer, werewolf_suit: wSuit as Suit, current_trick: [], log: room.log }, updPlayers);
    }
    return json({ ok: true });
  }

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
        current_trick: [], last_trick_winner: null, last_trick_cards: null, werewolf_suit: null, remaining_deck: remainingDeck, log: room.log
      }).eq("id", roomId);
      const updatedPlayers = players.map((p,i)=>({...p,hand:hands[i],bid:null,tricks_won:0}));
      return await tickAIBids(supabase, roomId, { ...room, trump_suit: suit as Suit, phase, current_player: currentPlayer, current_trick: [], log: room.log }, updatedPlayers);
    }
  }

  await supabase.from("rooms").update({
    round: room.round, max_rounds: room.max_rounds, dealer: room.dealer,
    phase, current_player: currentPlayer,
    trump_card: trumpCard, trump_suit: trumpSuit,
    current_trick: [], last_trick_winner: null, last_trick_cards: null, werewolf_suit: null, remaining_deck: remainingDeck, log: room.log
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
  // Clear vampire revealed card from previous trick
  if (room.vampire_revealed && room.current_trick.length === 0) {
    await supabase.from("rooms").update({ vampire_revealed: null }).eq("id", roomId);
    room = { ...room, vampire_revealed: null };
  }
  const trick = room.current_trick;

  // Bomb overrides everything - check first
  if (trick.some((t:TrickEntry) => t.card.specialType === "bomb")) {
    addLog(room, "💥 Elderstab! Der Stich wird annulliert – niemand gewinnt.");
    await supabase.from("rooms").update({
      current_trick: [], current_player: (room.current_player+1)%players.length,
      last_trick_winner: null, last_trick_cards: trick,
      pending_rainbow9: null, // bomb cancels 9¾ too
      phase: "playing", log: room.log
    }).eq("id", roomId);
    return json({ ok: true });
  }

  if (trick.length < players.length) {
    const next = (room.current_player+1) % players.length;
    await supabase.from("rooms").update({ current_trick: trick, current_player: next, log: room.log }).eq("id", roomId);
    // AI plays
    if (players[next]?.is_ai) {
      const card = aiChooseCard(players[next].hand, trick, room.trump_suit, room.werewolf_suit);
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
  const winnerIdx = trickWinner(trick, room.trump_suit, room.werewolf_suit);
  const winner = players[winnerIdx];
  const newTricksWon = winner.tricks_won + 1;
  await supabase.from("room_players").update({ tricks_won: newTricksWon }).eq("id", winner.id);
  addLog(room, `✓ ${winner.ai_name ?? "Spieler"} gewinnt den Stich!`);

  await supabase.from("rooms").update({
    current_trick: [], current_player: winnerIdx,
    last_trick_winner: winnerIdx, last_trick_cards: trick,
    phase: "trickEnd",
    pending_rainbow9: has9 && winnerIdx >= 0 ? winnerIdx : null,
    pending_rainbow7: has7 ? rainbow7Players : null,
    pending_witch: hasWitch ? trick.find(t => t.card.id?.includes("witch") || t.card.specialType === "witch")?.playerIndex ?? null : null,
    log: room.log
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
        const card = aiChooseCard(updatedPlayers[winnerIdx].hand, [], freshRoom.trump_suit, freshRoom.werewolf_suit);
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
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
