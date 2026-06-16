import { useState, useEffect, useCallback } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase, callGameAction } from "./supabase";
import { CardView } from "./CardView";
import { SUITS, SUIT_SYMBOLS, SUIT_COLORS, forbiddenDealerBid, type GameState } from "./types";

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  table: {
    minHeight: "100vh",
    background: "radial-gradient(ellipse at center,#1b4332 0%,#081c15 100%)",
    display: "flex", flexDirection: "column" as const,
    alignItems: "center", padding: 12, gap: 10,
  } as React.CSSProperties,
  btn: (bg = "#4a0072"): React.CSSProperties => ({
    background: bg, color: "#e8d5a0",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 8, padding: "10px 20px",
    fontSize: 14, cursor: "pointer",
  }),
  input: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 6, color: "#e8d5a0",
    padding: "8px 12px", fontSize: 14, width: "100%",
  } as React.CSSProperties,
  card: (color = "rgba(0,0,0,0.45)"): React.CSSProperties => ({
    background: color, borderRadius: 10,
    padding: "10px 16px", display: "flex",
    flexDirection: "column" as const, gap: 6,
  }),
};

function Pill({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? "rgba(100,60,150,0.7)" : "rgba(0,0,0,0.45)", borderRadius: 8, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}>
      {children}
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(""); setLoading(true);
    try {
      if (mode === "register") {
        const email = `${username.toLowerCase().replace(/\s+/g,"")}@wizard.local`;
        const { error: e } = await supabase.auth.signUp({
          email, password,
          options: { data: { username } }
        });
        if (e) throw e;
      } else {
        const email = `${username.toLowerCase().replace(/\s+/g,"")}@wizard.local`;
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
      }
    } catch (e: any) {
      setError(e.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ ...S.table, justifyContent: "center", gap: 20 }}>
      <div style={{ fontSize: 52 }}>🧙</div>
      <div style={{ fontSize: 32, fontWeight: "bold", color: "#ffd700", letterSpacing: 4 }}>WIZARD</div>

      <div style={{ ...S.card(), width: 300, gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["login","register"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ ...S.btn(mode===m?"#4a0072":"#222"), flex: 1, fontSize: 13 }}>
              {m === "login" ? "Anmelden" : "Registrieren"}
            </button>
          ))}
        </div>
        <input value={username} onChange={e=>setUsername(e.target.value)}
          placeholder="Benutzername" style={S.input} />
        <input value={password} onChange={e=>setPassword(e.target.value)}
          placeholder="Passwort" type="password" style={S.input}
          onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
        <button onClick={handleSubmit} disabled={loading}
          style={{ ...S.btn(), opacity: loading ? 0.5 : 1 }}>
          {loading ? "…" : mode==="login" ? "Anmelden" : "Account erstellen"}
        </button>
        {error && <div style={{ color: "#eb5757", fontSize: 12 }}>{error}</div>}
      </div>
    </div>
  );
}

// ─── Stats Screen ──────────────────────────────────────────────────────────────
function StatsScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    supabase.from("user_stats").select("*").eq("id", userId).single()
      .then(({ data }) => setStats(data));
  }, [userId]);

  return (
    <div style={{ ...S.card(), minWidth: 280, gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#ffd700", fontSize: 16 }}>📊 Statistiken</div>
        <button onClick={onBack} style={{ ...S.btn("#333"), padding: "4px 10px", fontSize: 12 }}>✕</button>
      </div>
      {!stats ? <div style={{ opacity: 0.5 }}>Lade…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            ["Spiele", stats.games_played ?? 0],
            ["Siege", stats.games_won ?? 0],
            ["Ø Punkte", stats.avg_score ?? 0],
            ["Ø Platz", stats.avg_placement ?? "–"],
            ["Trefferquote", `${stats.bid_accuracy_pct ?? 0}%`],
            ["Geboten", stats.total_bid ?? 0],
          ].map(([label, val]) => (
            <div key={label as string} style={{ background: "rgba(0,0,0,0.4)", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: "bold", color: "#ffd700" }}>{val}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Lobby Screen ─────────────────────────────────────────────────────────────
function LobbyScreen({ session }: { session: Session }) {
  const [codeInput, setCodeInput] = useState("");
  const [aiCount, setAiCount] = useState(2);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const username = session.user.user_metadata?.username ?? session.user.email;

  async function createRoom() {
    setLoading(true); setError("");
    const code = Math.random().toString(36).substring(2,6).toUpperCase();
    const { data, error: e } = await supabase.from("rooms").insert({
      code, host_id: session.user.id, phase: "lobby"
    }).select().single();
    if (e || !data) { setError(e?.message ?? "Fehler"); setLoading(false); return; }
    await supabase.from("room_players").insert({
      room_id: data.id, user_id: session.user.id,
      player_index: 0, is_ai: false,
      ai_name: username, hand: [], score: 0, tricks_won: 0, connected: true
    });
    setRoomId(data.id);
    setLoading(false);
  }

  async function joinRoom() {
    setLoading(true); setError("");
    const { data: room } = await supabase.from("rooms")
      .select("*").eq("code", codeInput.toUpperCase()).single();
    if (!room) { setError("Raum nicht gefunden"); setLoading(false); return; }
    if (room.phase !== "lobby") { setError("Spiel bereits gestartet"); setLoading(false); return; }
    const { data: existing } = await supabase.from("room_players")
      .select("player_index").eq("room_id", room.id).order("player_index");
    if ((existing?.length ?? 0) >= 6) { setError("Raum voll"); setLoading(false); return; }
    const nextIdx = (existing?.length ?? 0);
    await supabase.from("room_players").insert({
      room_id: room.id, user_id: session.user.id,
      player_index: nextIdx, is_ai: false,
      ai_name: username, hand: [], score: 0, tricks_won: 0, connected: true
    });
    setRoomId(room.id);
    setLoading(false);
  }

  if (roomId) return <GameRoom roomId={roomId} session={session} aiCount={aiCount} />;

  return (
    <div style={{ ...S.table, justifyContent: "center", gap: 18 }}>
      <div style={{ fontSize: 52 }}>🧙</div>
      <div style={{ fontSize: 32, fontWeight: "bold", color: "#ffd700", letterSpacing: 4 }}>WIZARD</div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 13, opacity: 0.7 }}>👤 {username}</span>
        <button onClick={() => setShowStats(s=>!s)} style={{ ...S.btn("#1b4d3e"), padding: "4px 10px", fontSize: 12 }}>📊</button>
        <button onClick={() => supabase.auth.signOut()} style={{ ...S.btn("#333"), padding: "4px 10px", fontSize: 12 }}>Abmelden</button>
      </div>

      {showStats && <StatsScreen userId={session.user.id} onBack={() => setShowStats(false)} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 300 }}>
        <div style={S.card()}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>KI-Spieler beim Start</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[0,1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setAiCount(n)}
                style={{ ...S.btn(aiCount===n?"#4a0072":"#333"), padding: "6px 12px" }}>
                {n===0?"Keine":n}
              </button>
            ))}
          </div>
        </div>

        <button onClick={createRoom} disabled={loading} style={{ ...S.btn(), opacity: loading?0.5:1 }}>
          Raum erstellen
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <input value={codeInput} onChange={e=>setCodeInput(e.target.value.toUpperCase())}
            placeholder="XXXX" maxLength={4}
            style={{ ...S.input, flex: 1, textAlign: "center", letterSpacing: 4 }} />
          <button onClick={joinRoom} disabled={loading} style={S.btn("#1b4d3e")}>Beitreten</button>
        </div>
        {error && <div style={{ color: "#eb5757", fontSize: 13 }}>{error}</div>}
      </div>
    </div>
  );
}

// ─── Game Room ────────────────────────────────────────────────────────────────
function GameRoom({ roomId, session, aiCount }: { roomId: string; session: Session; aiCount: number }) {
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [myIdx, setMyIdx] = useState<number>(-1);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const act = useCallback(async (action: string, extra = {}) => {
    setLoading(true); setError("");
    const res = await callGameAction(roomId, action, extra);
    if (res.error) setError(res.error);
    setLoading(false);
  }, [roomId]);

  // Load initial state
  useEffect(() => {
    supabase.from("rooms").select("*").eq("id", roomId).single()
      .then(({ data }) => { if (data) setRoom(data); });
    supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index")
      .then(({ data }) => {
        if (data) {
          setPlayers(data);
          const mine = data.find((p: any) => p.user_id === session.user.id);
          if (mine) setMyIdx(mine.player_index);
        }
      });
  }, [roomId]);

  // Realtime subscriptions
  useEffect(() => {
    const roomSub = supabase.channel(`room:${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        payload => setRoom(payload.new))
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` },
        () => {
          supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index")
            .then(({ data }) => { if (data) setPlayers(data); });
        })
      .subscribe();
    return () => { supabase.removeChannel(roomSub); };
  }, [roomId]);

  if (!room) return <div style={{ ...S.table, justifyContent: "center", opacity: 0.5 }}>Lade…</div>;

  const me = players[myIdx];
  const myHand: any[] = me?.hand ?? [];
  const isHost = myIdx === 0;
  const isMyTurn = room.current_player === myIdx;
  const log: string[] = room.log ?? [];
  const trick: any[] = room.current_trick ?? [];

  // ── Lobby ──
  if (room.phase === "lobby") {
    return (
      <div style={{ ...S.table, justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 26, color: "#ffd700" }}>🧙 Wizard</div>
        <Pill><span style={{ fontSize: 11, opacity: 0.6 }}>Code:</span><span style={{ fontSize: 22, letterSpacing: 4, fontWeight: "bold" }}>{room.code}</span></Pill>
        <div style={{ fontSize: 11, opacity: 0.4 }}>wizard.heimdns.de – Code teilen!</div>
        <div style={S.card()}>
          {players.map((p: any) => (
            <div key={p.id} style={{ padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: 13 }}>
              {p.player_index===0?"👑 ":"👤 "}{p.ai_name ?? `Spieler ${p.player_index+1}`}{p.user_id===session.user.id?" (Du)":""}
            </div>
          ))}
        </div>
        {isHost ? (
          <button onClick={() => act("startGame", { aiCount })} disabled={loading || players.length + aiCount < 2}
            style={{ ...S.btn(), opacity: loading?0.5:1 }}>
            Spiel starten
          </button>
        ) : <div style={{ opacity: 0.5 }}>Warte auf Host…</div>}
        {error && <div style={{ color: "#eb5757", fontSize: 13 }}>{error}</div>}
      </div>
    );
  }

  // ── Round/Game End ──
  if (room.phase === "roundEnd" || room.phase === "gameEnd") {
    const sorted = [...players].sort((a,b)=>b.score-a.score);
    return (
      <div style={{ ...S.table, justifyContent: "center", gap: 14 }}>
        <div style={{ fontSize: 22, color: "#ffd700" }}>
          {room.phase==="gameEnd" ? "🏆 Spiel beendet!" : `Runde ${room.round} beendet`}
        </div>
        <div style={S.card()}>
          {sorted.map((p:any,i:number) => (
            <div key={p.id} style={{ display:"flex", justifyContent:"space-between", gap:24, padding:"5px 0", fontSize: i===0?16:13, color: i===0?"#ffd700":"#e8d5a0", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
              <span>{["🥇","🥈","🥉","4.","5.","6."][i]} {p.ai_name}</span>
              <span style={{ fontWeight:"bold" }}>{p.score}</span>
            </div>
          ))}
        </div>
        {isHost && room.phase==="roundEnd" && (
          <button onClick={() => act("nextRound")} style={S.btn("#1b4d3e")}>
            Weiter → Runde {room.round+1}
          </button>
        )}
        {isHost && room.phase==="gameEnd" && (
          <button onClick={() => act("newGame")} style={S.btn()}>Nochmal spielen</button>
        )}
        {!isHost && <div style={{ opacity:0.5, fontSize:13 }}>Warte auf Host…</div>}
      </div>
    );
  }

  // ── Main game ──
  const isBidding = room.phase === "bidding" && isMyTurn;
  const isChoosingTrump = room.phase === "choosingTrump" && isMyTurn;
  const isPlaying = room.phase === "playing" && isMyTurn && !loading;
  const forbidden = forbiddenDealerBid(players.map((p:any)=>p.bid), room.dealer, room.round);
  const dealerForbidden = room.dealer === myIdx ? forbidden : null;

  return (
    <div style={S.table}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", width:"100%", maxWidth:720, alignItems:"center" }}>
        <div style={{ fontSize:11, opacity:0.6 }}>Runde {room.round}/{room.max_rounds}</div>
        <div style={{ fontSize:16, color:"#ffd700", fontWeight:"bold", letterSpacing:3 }}>🧙 WIZARD</div>
        <div style={{ fontSize:11, opacity:0.7 }}>{room.code}</div>
      </div>

      {/* Players */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center" }}>
        {players.map((p:any) => (
          <Pill key={p.id} highlight={room.current_player===p.player_index}>
            <span style={{ fontSize:10 }}>{p.is_ai?"🤖":p.connected?"👤":"❌"}</span>
            <span style={{ fontSize:11 }}>{p.ai_name}{p.user_id===session.user.id?" (Du)":""}</span>
            <span style={{ fontSize:11, color:"#ffd700" }}>{p.score}</span>
            <span style={{ fontSize:10, color:"#aaa" }}>{p.bid!==null?`${p.tricks_won}/${p.bid}`:"?"}</span>
          </Pill>
        ))}
      </div>

      {/* Trump */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center", alignItems:"center" }}>
        <Pill>
          <span style={{ fontSize:11, opacity:0.6 }}>Trumpf:</span>
          {room.trump_card ? <CardView card={room.trump_card} small /> : <span style={{ opacity:0.4 }}>–</span>}
          {room.trump_suit && <span style={{ color:SUIT_COLORS[room.trump_suit as keyof typeof SUIT_COLORS], fontSize:18 }}>{SUIT_SYMBOLS[room.trump_suit as keyof typeof SUIT_SYMBOLS]}</span>}
        </Pill>
        <Pill><span style={{ fontSize:11, opacity:0.6 }}>Dealer:</span><span style={{ fontSize:11 }}>{players[room.dealer]?.ai_name}</span></Pill>
      </div>

      {/* Choose trump */}
      {isChoosingTrump && (
        <div style={{ ...S.card("rgba(0,0,0,0.7)"), textAlign:"center", gap:10 }}>
          <div style={{ fontSize:13 }}>🧙 Zauberer – wähle die Trumpffarbe:</div>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            {SUITS.map(s => (
              <button key={s} onClick={() => act("chooseTrump", { suit:s })}
                style={{ ...S.btn(), background:SUIT_COLORS[s]+"99", fontSize:22, padding:"8px 14px" }}>
                {SUIT_SYMBOLS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bidding */}
      {isBidding && (
        <div style={{ ...S.card("rgba(0,0,0,0.6)"), textAlign:"center", gap:8 }}>
          <div style={{ fontSize:13 }}>Wie viele Stiche machst du? (0–{room.round})</div>
          {dealerForbidden!==null && (
            <div style={{ color:"#e9c46a", fontSize:11 }}>⚠ Als Dealer darfst du nicht {dealerForbidden} bieten</div>
          )}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center" }}>
            {Array.from({length:room.round+1},(_,i)=>(
              <button key={i} onClick={() => act("bid",{bid:i})} disabled={i===dealerForbidden}
                style={{ ...S.btn("#1b4d3e"), padding:"8px 14px", opacity:i===dealerForbidden?0.3:1 }}>
                {i}
              </button>
            ))}
          </div>
        </div>
      )}

      {room.phase==="bidding" && !isMyTurn && (
        <div style={{ opacity:0.5, fontSize:13 }}>{players[room.current_player]?.ai_name} bietet…</div>
      )}

      {/* Trick */}
      <div style={{ display:"flex", gap:12, justifyContent:"center", alignItems:"center", minHeight:110, position:"relative", flexWrap:"wrap" }}>
        {trick.length===0 && room.phase==="playing" && (
          <div style={{ opacity:0.25, fontSize:13 }}>{players[room.current_player]?.ai_name} beginnt</div>
        )}
        {trick.map((t:any,i:number) => (
          <div key={i} style={{ textAlign:"center" }}>
            <div style={{ fontSize:10, opacity:0.6, marginBottom:3 }}>{players[t.playerIndex]?.ai_name}</div>
            <CardView card={t.card} />
          </div>
        ))}
        {room.phase==="trickEnd" && room.last_trick_winner!==null && (
          <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", background:"rgba(0,0,0,0.88)", borderRadius:8, padding:"8px 18px", color:"#ffd700", fontSize:14, whiteSpace:"nowrap" }}>
            {players[room.last_trick_winner]?.ai_name} gewinnt! 🎉
          </div>
        )}
      </div>

      {/* Opponents */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
        {players.map((p:any) => {
          if (p.player_index===myIdx) return null;
          const count = Array.isArray(p.hand) ? p.hand.length : 0;
          return (
            <div key={p.id} style={{ textAlign:"center", opacity:room.current_player===p.player_index?1:0.55 }}>
              <div style={{ fontSize:10, marginBottom:3 }}>{p.is_ai?"🤖":"👤"} {p.ai_name} {room.current_player===p.player_index?"⬇":""}</div>
              <div style={{ display:"flex", gap:2 }}>
                {Array.from({length:count}).map((_,ci)=>(
                  <CardView key={ci} card={{id:"h",type:"fool",suit:null,value:0}} faceDown small />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* My hand */}
      <div style={{ marginTop:"auto", paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.08)", width:"100%", maxWidth:720 }}>
        <div style={{ fontSize:11, opacity:0.6, textAlign:"center", marginBottom:6 }}>
          {isPlaying?"🎯 Du bist dran!":room.phase==="playing"?`Warte auf ${players[room.current_player]?.ai_name}…`:"Deine Karten"}
        </div>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", justifyContent:"center", marginBottom:8 }}>
          {myHand.map((card:any) => (
            <CardView key={card.id} card={card}
              selected={selected===card.id}
              disabled={!isPlaying}
              onClick={isPlaying?()=>setSelected(card.id===selected?null:card.id):undefined}
            />
          ))}
        </div>
        {isPlaying && selected && (
          <div style={{ textAlign:"center" }}>
            <button onClick={() => { act("playCard",{cardId:selected}); setSelected(null); }} style={S.btn()}>
              Karte ausspielen
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ position:"fixed", top:12, left:"50%", transform:"translateX(-50%)", background:"#eb5757", color:"#fff", padding:"8px 16px", borderRadius:8, fontSize:13, zIndex:100 }}>
          {error}
        </div>
      )}

      {/* Log */}
      <div style={{ position:"fixed", bottom:8, right:8, width:200, background:"rgba(0,0,0,0.75)", borderRadius:8, padding:8, fontSize:10, maxHeight:130, overflowY:"auto" }}>
        {log.map((l:string,i:number)=>(
          <div key={i} style={{ padding:"1px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_,s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={{ ...S.table, justifyContent:"center", opacity:0.5 }}>🧙</div>;
  if (!session) return <AuthScreen />;
  return <LobbyScreen session={session} />;
}
