import { useState, useEffect, useCallback, useRef } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase, callGameAction } from "./supabase";
import { CardView } from "./CardView";
import { SUITS, SUIT_SYMBOLS, SUIT_COLORS, forbiddenDealerBid } from "./types";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  midnight: "#0D1B2A",
  deepBlue: "#162032",
  violet: "#3D1C6E",
  violetLight: "#5A2D99",
  gold: "#C9A84C",
  goldLight: "#E4C97A",
  ivory: "#F2E8D5",
  ivoryDim: "#B8A98A",
  glass: "rgba(255,255,255,0.04)",
  glassBorder: "rgba(201,168,76,0.2)",
  error: "#CF4444",
  success: "#2D9E5F",
};

// ─── Shared Styles ────────────────────────────────────────────────────────────
const cinzel: React.CSSProperties = { fontFamily: "'Cinzel', serif" };

const glass = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: "rgba(10,16,28,0.92)",
  backdropFilter: "blur(12px)",
  border: `1px solid rgba(201,168,76,0.35)`,
  borderRadius: 12,
  ...extra,
});

const goldBtn = (active = true): React.CSSProperties => ({
  ...cinzel,
  background: active ? `linear-gradient(135deg, ${C.violet}, ${C.violetLight})` : "rgba(255,255,255,0.06)",
  color: active ? C.goldLight : C.ivoryDim,
  border: `1px solid ${active ? C.gold : "rgba(255,255,255,0.1)"}`,
  borderRadius: 8,
  padding: "clamp(8px,2vw,12px) clamp(12px,3vw,20px)",
  fontSize: "clamp(13px, 2vw, 15px)",
  cursor: "pointer",
  letterSpacing: "0.05em",
  transition: "all 0.2s",
  fontWeight: 600,
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
  minHeight: 44,
  userSelect: "none",
  WebkitUserSelect: "none",
});

const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.3)",
  border: `1px solid ${C.glassBorder}`,
  borderRadius: 8,
  color: C.ivory,
  padding: "clamp(10px,2vw,14px) clamp(12px,3vw,18px)",
  fontSize: 16, // must be 16px+ to prevent iOS zoom
  width: "100%",
  outline: "none",
  fontFamily: "Inter, sans-serif",
  WebkitAppearance: "none",
};

// Applied as className to prevent selection
const tableStyle: React.CSSProperties = {
  minHeight: "100dvh",
  background: `radial-gradient(ellipse at 20% 0%, ${C.violet}33 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, #1A3A6E33 0%, transparent 60%), ${C.midnight}`,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: `max(16px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))`,
  gap: "clamp(8px, 1.5vw, 16px)",
};

function GoldDivider() {
  return <div style={{ width: "100%", maxWidth: 680, height: 1, background: `linear-gradient(90deg, transparent, ${C.gold}55, transparent)` }} />;
}

// ─── Install Banner ───────────────────────────────────────────────────────────
function InstallBanner() {
  const [prompt, setPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setPrompt(e); setShow(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show) return null;

  return (
    <div style={{ ...glass(), position: "fixed", bottom: "max(16px, env(safe-area-inset-bottom))", left: "max(16px, env(safe-area-inset-left))", right: "max(16px, env(safe-area-inset-right))", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, zIndex: 1000 }}>
      <div style={{ fontSize: 28 }}>🧙</div>
      <div style={{ flex: 1 }}>
        <div style={{ ...cinzel, fontSize: 13, color: C.gold }}>Als App installieren</div>
        <div style={{ fontSize: 11, color: C.ivoryDim, marginTop: 2 }}>Wizard direkt vom Homescreen starten</div>
      </div>
      <button onClick={() => { prompt?.prompt(); setShow(false); }} style={{ ...goldBtn(), padding: "7px 14px", fontSize: 12 }}>Installieren</button>
      <button onClick={() => setShow(false)} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 18, padding: 4 }}>✕</button>
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState<"login"|"register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const name = username.trim();
    if (!name) { setError("Bitte gib deinen Namen ein"); return; }
    setError(""); setLoading(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const email = `${slug}@wizard.local`;
      const pw = password.trim() || `wiz${slug}2024!`;

      if (mode === "login") {
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (loginErr) throw new Error("Falscher Name oder Passwort");
      } else {
        if (!password.trim()) throw new Error("Bitte ein Passwort wählen");
        const { error: regErr } = await supabase.auth.signUp({
          email, password: pw,
          options: { data: { username: name } }
        });
        if (regErr) throw new Error(regErr.message === "User already registered" ? "Name bereits vergeben – bitte anmelden" : regErr.message);
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (loginErr) throw loginErr;
      }
    } catch (e: any) {
      setError(e.message ?? "Fehler beim Anmelden");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ ...tableStyle, justifyContent: "center", gap: 24 }}>
      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "clamp(44px,12vw,64px)", marginBottom: 8 }}>🧙</div>
        <div style={{ ...cinzel, fontSize: "clamp(32px,5vw,52px)", fontWeight: 700, color: C.gold, letterSpacing: "clamp(6px,1.5vw,12px)", textShadow: `0 0 40px ${C.violet}` }}>WIZARD</div>
        <div style={{ fontSize: 12, color: C.ivoryDim, letterSpacing: 3, marginTop: 4 }}>DAS KARTENSPIEL</div>
      </div>

      <GoldDivider />

      {/* Name Card */}
      <div style={{ ...glass({ padding: 24 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 4 }}>
          {(["login","register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
              flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer",
              ...cinzel, fontSize: 12, letterSpacing: 1,
              background: mode === m ? `linear-gradient(135deg, ${C.violet}, ${C.violetLight})` : "transparent",
              color: mode === m ? C.goldLight : C.ivoryDim,
            }}>
              {m === "login" ? "Anmelden" : "Registrieren"}
            </button>
          ))}
        </div>

        <input value={username} onChange={e => setUsername(e.target.value)}
          placeholder="Dein Name" style={inputStyle} autoFocus
          onKeyDown={e => e.key === "Enter" && handleSubmit()} />

        <input value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Passwort" type="password" style={inputStyle}
          onKeyDown={e => e.key === "Enter" && handleSubmit()} />

        <button onClick={handleSubmit} disabled={loading} style={{
          ...goldBtn(), width: "100%", padding: "12px 0", fontSize: 14,
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? "…" : mode === "login" ? "✦ Anmelden" : "✦ Registrieren"}
        </button>

        {error && (
          <div style={{ background: `${C.error}22`, border: `1px solid ${C.error}55`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#FF8080", textAlign: "center" }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stats Screen ─────────────────────────────────────────────────────────────
function StatsScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    supabase.from("user_stats").select("*").eq("id", userId).single().then(({ data }) => setStats(data));
  }, [userId]);

  const statItems = stats ? [
    { label: "Spiele", value: stats.games_played ?? 0, icon: "🎮" },
    { label: "Siege", value: stats.games_won ?? 0, icon: "🏆" },
    { label: "Ø Punkte", value: stats.avg_score ?? 0, icon: "⭐" },
    { label: "Ø Platz", value: stats.avg_placement ?? "–", icon: "🎯" },
    { label: "Trefferquote", value: `${stats.bid_accuracy_pct ?? 0}%`, icon: "🎪" },
    { label: "Stiche geboten", value: stats.total_bid ?? 0, icon: "🃏" },
  ] : [];

  return (
    <div style={{ ...glass({ padding: 20 }), width: "min(380px, 92vw)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>📊 Statistiken</div>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 20 }}>✕</button>
      </div>
      {!stats ? <div style={{ textAlign: "center", padding: 24, color: C.ivoryDim }}>Lade…</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {statItems.map(({ label, value, icon }) => (
            <div key={label} style={{ ...glass({ padding: "10px 8px" }), textAlign: "center" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
              <div style={{ ...cinzel, fontSize: 18, fontWeight: 700, color: C.gold }}>{value}</div>
              <div style={{ fontSize: 10, color: C.ivoryDim, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Lobby ────────────────────────────────────────────────────────────────────
function LobbyScreen({ session }: { session: Session }) {
  const [view, setView] = useState<"home" | "create" | "join" | "rules">("home");
  const [reconnectRoom, setReconnectRoom] = useState<string|null>(null);

  // Check for reconnectable room on mount
  useEffect(() => {
    const savedRoom = sessionStorage.getItem("wizard_room");
    if (savedRoom) {
      const { roomId, code } = JSON.parse(savedRoom);
      supabase.from("rooms").select("phase").eq("id", roomId).single()
        .then(({ data }) => {
          if (data && data.phase !== "gameEnd") setReconnectRoom(code);
          else sessionStorage.removeItem("wizard_room");
        });
    }
  }, []);
  const [codeInput, setCodeInput] = useState("");
  const [aiCount, setAiCount] = useState(2);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [humanCount, setHumanCount] = useState(1);
  const [edition, setEdition] = useState<"classic"|"anniversary">("classic");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const username = session.user.user_metadata?.username ?? "Spieler";
  const maxAI = Math.max(0, 6 - humanCount);
  const minAI = Math.max(0, 3 - humanCount); // minimum 3 players total

  async function createRoom() {
    setLoading(true); setError("");
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const { data, error: e } = await supabase.from("rooms").insert({ code, host_id: session.user.id, phase: "lobby", edition }).select().single();
    if (e || !data) { setError(e?.message ?? "Fehler"); setLoading(false); return; }
    await supabase.from("room_players").insert({ room_id: data.id, user_id: session.user.id, player_index: 0, is_ai: false, ai_name: username, hand: [], score: 0, tricks_won: 0, connected: true });
    sessionStorage.setItem("wizard_room", JSON.stringify({ roomId: data.id, code }));
    setRoomId(data.id);
    setLoading(false);
  }

  async function joinRoom() {
    setLoading(true); setError("");
    const { data: room } = await supabase.from("rooms").select("*").eq("code", codeInput.toUpperCase()).single();
    if (!room) { setError("Raum nicht gefunden"); setLoading(false); return; }
    if (room.phase !== "lobby") { setError("Spiel bereits gestartet"); setLoading(false); return; }
    const { data: existing } = await supabase.from("room_players").select("player_index").eq("room_id", room.id);
    if ((existing?.length ?? 0) >= 6) { setError("Raum voll (max. 6 Spieler)"); setLoading(false); return; }
    await supabase.from("room_players").insert({ room_id: room.id, user_id: session.user.id, player_index: existing?.length ?? 0, is_ai: false, ai_name: username, hand: [], score: 0, tricks_won: 0, connected: true });
    sessionStorage.setItem("wizard_room", JSON.stringify({ roomId: room.id, code: codeInput.toUpperCase() }));
    setRoomId(room.id);
    setLoading(false);
  }

  // Reconnect function
  async function reconnect() {
    if (!reconnectRoom) return;
    setCodeInput(reconnectRoom);
    await joinRoom();
  }


  // ── Rules ──
  if (view === "rules") return (
    <div style={{ ...tableStyle, justifyContent: "flex-start", gap: 14, paddingTop: "max(20px, env(safe-area-inset-top))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "min(680px,96vw)" }}>
        <div style={{ ...cinzel, fontSize: "clamp(16px,5vw,22px)", color: C.gold }}>📖 Regeln</div>
        <button onClick={() => setView("home")} style={{ ...goldBtn(false), padding: "6px 14px", fontSize: 12 }}>← Zurück</button>
      </div>

      {/* Basic rules */}
      <div style={{ ...glass({ padding: 16 }), width: "min(680px,96vw)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ ...cinzel, fontSize: 12, color: C.gold, letterSpacing: 2 }}>GRUNDREGELN</div>
        {[
          ["Ziel", "Genau so viele Stiche machen wie angesagt"],
          ["Treffer", "+20 Punkte + 10 pro angesagtem Stich"],
          ["Fehler", "-10 Punkte pro Differenz"],
          ["Zauberer", "Schlägt alles (außer Drachen)"],
          ["Narr", "Verliert immer"],
          ["Stichzwang", "Der Dealer darf nicht die Zahl bieten, die die Gesamtansagen gleich der Rundenzahl macht"],
          ["Farbzwang", "Angespielte Farbe muss bedient werden wenn möglich"],
        ].map(([title, desc]) => (
          <div key={title} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid rgba(201,168,76,0.08)" }}>
            <div style={{ ...cinzel, fontSize: 11, color: C.gold, minWidth: 90 }}>{title}</div>
            <div style={{ fontSize: 11, color: C.ivoryDim, flex: 1 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Special cards */}
      <div style={{ ...glass({ padding: 16 }), width: "min(680px,96vw)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ ...cinzel, fontSize: 12, color: C.gold, letterSpacing: 2 }}>⚡ 30 JAHRE EDITION – SPEZIALKARTEN</div>
        {[
          ["🐉 Seidenschnabel", "Schlägt ALLES – auch Zauberer. Einzige Ausnahme: die Fee gewinnt gegen den Drachen."],
          ["✦ Fee", "Verliert immer – außer wenn der Drache gespielt wurde. Dann gewinnt die Fee."],
          ["🧹 Bellatrix (Hexe)", "Gilt als Narr. Nach dem Stich darf eine beliebige Karte aus dem Stich gegen eine Handkarte getauscht werden."],
          ["🐺 Lupin (Werwolf)", "Wird als Trumpfkarte aufgedeckt oder beim Ziehen sofort getauscht. Der Spieler wählt die Anspielfarbe für die gesamte Runde."],
          ["🧛 Quirrell (Vampir)", "Kopiert die aufgedeckte Trumpfkarte für diesen einen Stich. Ist Trumpf ein Narr (oder kein Trumpf), wirkt der Vampir als Narr."],
          ["💥 Elderstab (Bombe)", "Annulliert den Stich – niemand gewinnt ihn. Vorhersagen können dadurch aufgehen."],
          ["😄 George Weasley (7½)", "Wert 7,5. Spieler wählt die Farbe. Nach dem Stich gibt JEDER Spieler eine Karte seiner Wahl an den linken Nachbarn weiter."],
          ["🚂 Gleis 9¾ (9¾)", "Wert 9,75. Spieler wählt die Farbe. Der Stichgewinner muss seine Vorhersage um 1 erhöhen oder senken (nicht unter 0)."],
          ["❓ Ron Weasley (Zauberernarr)", "Beim Ausspielen entscheidet der Spieler: Zauberer oder Narr?"],
        ].map(([title, desc]) => (
          <div key={title as string} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(201,168,76,0.08)" }}>
            <div style={{ ...cinzel, fontSize: 11, color: C.gold, minWidth: 120 }}>{title}</div>
            <div style={{ fontSize: 11, color: C.ivoryDim, flex: 1, lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (roomId) return <GameRoom roomId={roomId} session={session} aiCount={Math.min(aiCount, maxAI)} edition={edition} onLeave={() => { sessionStorage.removeItem("wizard_room"); setRoomId(null); }} />;

  const HeaderBlock = () => (
    <>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "clamp(36px,10vw,52px)" }}>🧙</div>
        <div style={{ ...cinzel, fontSize: "clamp(28px,5vw,48px)", fontWeight: 700, color: C.gold, letterSpacing: "clamp(4px,1vw,10px)" }}>WIZARD</div>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ ...glass({ padding: "6px 14px" }), ...cinzel, fontSize: 13, color: C.ivory }}>👤 {username}</div>
        <button onClick={() => setShowStats(s => !s)} style={{ ...goldBtn(false), padding: "6px 12px" }}>📊</button>
        <button onClick={() => { sessionStorage.removeItem("wizard_room"); supabase.auth.signOut(); }} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 12 }}>⬚ Name ändern</button>
      </div>
      {showStats && <StatsScreen userId={session.user.id} onBack={() => setShowStats(false)} />}
      <GoldDivider />
    </>
  );

  if (view === "home") return (
    <div style={{ ...tableStyle, justifyContent: "center", gap: 20 }}>
      <HeaderBlock />
      {reconnectRoom && (
        <div style={{ ...glass({ padding: "12px 16px" }), width: "min(320px,92vw)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...cinzel, fontSize: 12, color: C.gold }}>Laufendes Spiel gefunden</div>
            <div style={{ fontSize: 11, color: C.ivoryDim, marginTop: 2 }}>Raum: {reconnectRoom}</div>
          </div>
          <button onClick={reconnect} style={{ ...goldBtn(), padding: "8px 14px", fontSize: 12 }}>Zurück</button>
          <button onClick={() => { sessionStorage.removeItem("wizard_room"); setReconnectRoom(null); }} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "min(320px, 92vw)" }}>
        <button onClick={() => setView("create")} style={{ ...goldBtn(), width: "100%", padding: "16px 0", fontSize: 15 }}>
          ✦ Spiel erstellen
        </button>
        <button onClick={() => setView("join")} style={{ ...goldBtn(false), width: "100%", padding: "16px 0", fontSize: 15 }}>
          ⬡ Spiel beitreten
        </button>
        <button onClick={() => setView("rules")} style={{ ...goldBtn(false), width: "100%", padding: "12px 0", fontSize: 13 }}>
          📖 Regeln & Spezialkarten
        </button>
      </div>
    </div>
  );

  if (view === "create") return (
    <div style={{ ...tableStyle, justifyContent: "center", gap: 20 }}>
      <HeaderBlock />
      <div style={{ ...glass({ padding: 24 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 16 }}>
        <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 13, textAlign: "left", padding: 0 }}>← Zurück</button>
        <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>Neues Spiel</div>
        <div>
          <div style={{ ...cinzel, fontSize: 10, color: C.ivoryDim, letterSpacing: 2, marginBottom: 8 }}>MENSCHLICHE SPIELER (inkl. dir)</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1,2,3,4,5,6].map(n => (
              <button key={n} onClick={() => { setHumanCount(n); const newMax = Math.max(0, 6-n); const newMin = Math.max(0, 3-n); setAiCount(Math.min(Math.max(aiCount, newMin), newMax)); }}
                style={{ ...goldBtn(humanCount===n), flex: 1, padding: "14px 0", fontSize: 15 }}>{n}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ ...cinzel, fontSize: 10, color: C.ivoryDim, letterSpacing: 2, marginBottom: 8 }}>
            KI-MITSPIELER {maxAI === 0 ? "(Raum voll)" : `(max. ${maxAI})`}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: maxAI + 1 }, (_, n) => (
              <button key={n} onClick={() => setAiCount(Math.max(n, minAI))}
                disabled={n < minAI}
                style={{ ...goldBtn(aiCount===Math.max(n,minAI) && n>=minAI), flex: 1, padding: "14px 0", fontSize: 15, opacity: n < minAI ? 0.25 : 1 }}>
                {n===0?"–":n}
              </button>
            ))}
          </div>
        </div>
        {/* Edition */}
        <div>
          <div style={{ ...cinzel, fontSize: 10, color: C.ivoryDim, letterSpacing: 2, marginBottom: 8 }}>EDITION</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEdition("classic")}
              style={{ ...goldBtn(edition === "classic"), flex: 1, padding: "10px 0", fontSize: 12, flexDirection: "column", display: "flex", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 16 }}>🧙</span>
              <span>Classic</span>
              <span style={{ fontSize: 9, opacity: 0.7 }}>60 Karten</span>
            </button>
            <button onClick={() => setEdition("anniversary")}
              style={{ ...goldBtn(edition === "anniversary"), flex: 1, padding: "10px 0", fontSize: 12, flexDirection: "column", display: "flex", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span>30 Jahre</span>
              <span style={{ fontSize: 9, opacity: 0.7 }}>69 Karten</span>
            </button>
          </div>
        </div>

        <div style={{ ...glass({ padding: "10px 14px" }), fontSize: 12, color: C.ivoryDim, textAlign: "center" }}>
          <span style={{ color: C.gold, ...cinzel }}>{humanCount + aiCount}</span> Spieler gesamt ·{" "}
          {humanCount} 👤 + {aiCount} 🤖 · <span style={{ color: C.gold }}>{Math.floor(60/(humanCount+aiCount))} Runden</span>{humanCount+aiCount < 3 ? <span style={{color:"#FF8080"}}> · min. 3 Spieler</span> : ""}
        </div>
        <button onClick={createRoom} disabled={loading || humanCount+aiCount < 3}
          style={{ ...goldBtn(), width: "100%", padding: "13px 0", fontSize: 14, opacity: loading?0.5:1 }}>
          {loading ? "Erstelle Raum…" : "✦ Raum erstellen"}
        </button>
        {error && <div style={{ color: "#FF8080", fontSize: 12, textAlign: "center" }}>{error}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ ...tableStyle, justifyContent: "center", gap: 20 }}>
      <HeaderBlock />
      <div style={{ ...glass({ padding: 24 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 14 }}>
        <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 13, textAlign: "left", padding: 0 }}>← Zurück</button>
        <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>Spiel beitreten</div>
        <input value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())}
          placeholder="XXXX" maxLength={4}
          style={{ ...inputStyle, textAlign: "center", letterSpacing: 8, fontSize: 22, ...cinzel }}
          onKeyDown={e => e.key==="Enter" && joinRoom()} autoFocus />
        <button onClick={joinRoom} disabled={loading || codeInput.length < 4}
          style={{ ...goldBtn(), width: "100%", padding: "13px 0", fontSize: 14, opacity: loading||codeInput.length<4?0.5:1 }}>
          {loading ? "Suche Raum…" : "⬡ Beitreten"}
        </button>
        {error && <div style={{ color: "#FF8080", fontSize: 12, textAlign: "center" }}>{error}</div>}
      </div>
    </div>
  );
}




// ─── Seat Layout ──────────────────────────────────────────────────────────────
// Returns players ordered by seat position relative to myIdx
// Positions: bottom (me), left, top-left, top, top-right, right
function getSeatPositions(players: any[], myIdx: number) {
  const n = players.length;
  const effectiveMyIdx = myIdx >= 0 ? myIdx : 0;
  const seats: { player: any; position: string }[] = [];
  for (let i = 0; i < n; i++) {
    const offset = (i - effectiveMyIdx + n) % n;
    let position = "top";
    if (offset === 0) position = "bottom";
    else if (n <= 3) position = "top"; // 2-3 players: all opponents on top
    else if (n === 4) { position = offset === 1 ? "left" : offset === 2 ? "top" : "right"; }
    else if (n === 5) { position = offset === 1 ? "left" : offset === 2 ? "top-left" : offset === 3 ? "top-right" : "right"; }
    else if (n === 6) { position = offset === 1 ? "left" : offset === 2 ? "top-left" : offset === 3 ? "top" : offset === 4 ? "top-right" : "right"; }
    seats.push({ player: players[i], position });
  }
  return seats;
}

// ─── Playability Check (client-side hint) ────────────────────────────────────
function isCardPlayable(card: any, hand: any[], trick: any[], werewolfSuit?: string|null): boolean {
  const alwaysOk = (c: any) =>
    c.type === "fool" || c.type === "wizard" ||
    ["witch","wizardfool","dragon","fairy","bomb","werewolf"].includes(c.specialType ?? "");

  if (alwaysOk(card)) return true;

  const ledEntry = trick.find((t:any) =>
    t.card.type === "number" ||
    (t.card.specialType === "rainbow7" && t.card.suit) ||
    (t.card.specialType === "rainbow9" && t.card.suit)
  );
  const led = werewolfSuit ?? ledEntry?.card.suit ?? null;
  if (!led) return true;

  const canFollow = hand.some((c:any) => c.suit === led && !alwaysOk(c));
  if (canFollow && card.suit !== led) return false;
  return true;
}

// ─── Hand Sorting ─────────────────────────────────────────────────────────────
const SUIT_ORDER: Record<string, number> = { red: 0, blue: 1, green: 2, yellow: 3 };
const TYPE_ORDER: Record<string, number> = { fool: 0, number: 1, wizard: 2, special: 3 };

function sortHand(hand: any[]): any[] {
  return [...hand].sort((a, b) => {
    // 1. Type order
    const tA = TYPE_ORDER[a.type] ?? 1;
    const tB = TYPE_ORDER[b.type] ?? 1;
    if (tA !== tB) return tA - tB;
    // 2. For number cards: suit order
    if (a.type === "number" && b.type === "number") {
      const sA = SUIT_ORDER[a.suit] ?? 0;
      const sB = SUIT_ORDER[b.suit] ?? 0;
      if (sA !== sB) return sA - sB;
      // 3. Within same suit: value ascending
      return a.value - b.value;
    }
    return 0;
  });
}

// ─── Game Room ────────────────────────────────────────────────────────────────
function GameRoom({ roomId, session, aiCount, edition, onLeave }: { roomId: string; session: Session; aiCount: number; edition?: string; onLeave: () => void }) {
  const aiTriggerPending = useRef(false);
  const clearTrickPending = useRef(false);
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [myIdx, setMyIdx] = useState(-1);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScoresheet, setShowScoresheet] = useState(false);

  // Reload round history when scoresheet opens
  useEffect(() => {
    if (showScoresheet) {
      supabase.from("round_history").select("*").eq("room_id", roomId).order("round")
        .then(({ data }) => { if (data) setRoundHistory(data); });
    }
  }, [showScoresheet]);
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  const [specialAction, setSpecialAction] = useState<null|{type:string;cardId:string;trickCards?:any[]}>(null);
  const [pendingCard, setPendingCard] = useState<any>(null);
  const [passingCard, setPassingCard] = useState<string|null>(null); // for 7½
  const logRef = useRef<HTMLDivElement>(null);

  const act = useCallback(async (action: string, extra = {}) => {
    setLoading(true); setError("");
    const res = await callGameAction(roomId, action, extra);
    if (res.error) {
      setError(res.error);
      // Auto-dismiss non-critical errors, keep critical ones
      if (!res.error.includes("Verbindung") && !res.error.includes("Server")) {
        setTimeout(() => setError(""), 4000);
      }
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    supabase.from("rooms").select("*").eq("id", roomId).single().then(({ data }) => { if (data) setRoom(data); });
    supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index").then(({ data }) => {
      if (data) {
        setPlayers(data);
        const mine = data.find((p: any) => p.user_id === session.user.id);
        if (mine) setMyIdx(mine.player_index);
      }
    });
  }, [roomId]);

  useEffect(() => {
    const refreshState = () => {
      supabase.from("rooms").select("*").eq("id", roomId).single().then(({ data }) => { if (data) setRoom(data); });
      supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index").then(({ data }) => { if (data) setPlayers(data); });
    };

    const ch = supabase.channel(`room:${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, payload => {
        const newRoom = payload.new;
        setRoom(newRoom);
        supabase.from("room_players").select("*").eq("room_id", roomId).order("player_index").then(({ data }) => {
          if (data) {
            setPlayers(data);
            if (newRoom.phase === "playing" && data[newRoom.current_player]?.is_ai) {
              if (!aiTriggerPending.current) {
                aiTriggerPending.current = true;
                setTimeout(() => {
                  aiTriggerPending.current = false;
                  callGameAction(roomId, "triggerAI", {});
                }, 2000);
              }
            }
            if (newRoom.phase === "trickEnd") {
              if (!clearTrickPending.current) {
                clearTrickPending.current = true;
                setTimeout(() => {
                  clearTrickPending.current = false;
                  callGameAction(roomId, "clearTrick", {});
                }, 5000);
              }
            }
          }
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === "UPDATE" && payload.new) {
          setPlayers(prev => {
            const exists = prev.some(p => p.id === payload.new.id);
            if (exists) return prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p);
            return [...prev, payload.new].sort((a,b) => a.player_index - b.player_index);
          });
        } else if (payload.eventType === "INSERT") {
          setPlayers(prev => [...prev, payload.new].sort((a,b) => a.player_index - b.player_index));
        } else {
          refreshState();
        }
      })
      .subscribe();

    // Poll every 5 seconds as fallback for missed realtime events (read-only, no AI trigger)
    const poll = setInterval(refreshState, 5000);

    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [roomId]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 0; }, [room?.log]);

  // Sync myIdx whenever players changes
  useEffect(() => {
    const mine = players.find((p: any) => p.user_id === session.user.id);
    if (mine && mine.player_index !== myIdx) setMyIdx(mine.player_index);
  }, [players]);

  // Load round history
  useEffect(() => {
    supabase.from("round_history").select("*").eq("room_id", roomId).order("round")
      .then(({ data }) => { if (data) setRoundHistory(data); });
  }, [room?.phase, room?.round]);

  if (!room) return (
    <div style={{ ...tableStyle, justifyContent: "center" }}>
      <div style={{ ...cinzel, fontSize: 18, color: C.gold }}>Lade…</div>
    </div>
  );

  // Always compute from players directly - never rely on myIdx state alone
  const myPlayer = players.find((p: any) => p.user_id === session.user.id);
  const effectiveMyIdx = myPlayer?.player_index ?? myIdx;
  const me = myPlayer;
  const myHand: any[] = sortHand(me?.hand ?? []);
  const isHost = effectiveMyIdx === 0;
  // Compare as numbers explicitly
  const isMyTurn = myPlayer !== undefined && Number(room.current_player) === Number(effectiveMyIdx);
  const log: string[] = room.log ?? [];
  // During trickEnd, show the cards that were just played
  const trick: any[] = room.phase === "trickEnd" 
    ? (room.last_trick_cards ?? room.current_trick ?? [])
    : (room.current_trick ?? []);
  const forbidden = forbiddenDealerBid(players.map((p: any) => p.bid), room.dealer, room.round);
  const dealerForbidden = room.dealer === effectiveMyIdx ? forbidden : null;

  // ── Lobby Phase ──
  if (room.phase === "lobby") {
    return (
      <div style={{ ...tableStyle, justifyContent: "center", gap: 20 }}>
        <div style={{ ...cinzel, fontSize: 24, color: C.gold }}>🧙 Warteraum</div>
        <div style={{ ...glass({ padding: "8px 24px" }), ...cinzel, fontSize: 20, letterSpacing: 6, color: C.goldLight }}>{room.code}</div>
        <div style={{ fontSize: 11, color: C.ivoryDim }}>Code mit Freunden teilen</div>
        <div style={{ ...glass({ padding: "4px 14px" }), fontSize: 11, color: room?.edition === "anniversary" ? "#F7DC6F" : C.ivoryDim }}>
          {room?.edition === "anniversary" ? "⚡ 30 Jahre Edition" : "🧙 Classic Edition"}
        </div>

        <div style={{ ...glass({ padding: 16 }), width: "min(320px, 92vw)" }}>
          {players.map((p: any) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
              <div style={{ fontSize: 18 }}>{p.player_index === 0 ? "👑" : "👤"}</div>
              <div style={{ ...cinzel, fontSize: 13, color: p.user_id === session.user.id ? C.gold : C.ivory }}>{p.ai_name}</div>
              {p.user_id === session.user.id && <div style={{ fontSize: 10, color: C.ivoryDim, marginLeft: "auto" }}>Du</div>}
            </div>
          ))}
        </div>

        {isHost ? (
          <button onClick={() => act("startGame", { aiCount, edition: room?.edition ?? "classic" })} disabled={loading || players.length + aiCount < 2}
            style={{ ...goldBtn(), padding: "13px 32px", fontSize: 14, opacity: loading ? 0.5 : 1 }}>
            ✦ Spiel starten
          </button>
        ) : <div style={{ color: C.ivoryDim, fontSize: 13 }}>Warte auf den Host…</div>}
        {error && <div style={{ color: "#FF8080", fontSize: 12 }}>{error}</div>}
      </div>
    );
  }

  // ── Round/Game End ──
  if (room.phase === "roundEnd" || room.phase === "gameEnd") {
    const sorted = [...players].sort((a: any, b: any) => b.score - a.score);
    const medals = ["🥇", "🥈", "🥉", "4.", "5.", "6."];
    const lastRound = roundHistory[roundHistory.length - 1];
    return (
      <div style={{ ...tableStyle, justifyContent: "center", gap: 14 }} className="fade-in">
        <div style={{ ...cinzel, fontSize: "clamp(18px,5vw,26px)", color: C.gold }}>
          {room.phase === "gameEnd" ? "🏆 Spiel beendet!" : `Runde ${room.round} beendet`}
        </div>

        {/* Round detail */}
        {lastRound && (
          <div style={{ ...glass({ padding: 16 }), width: "min(420px, 96vw)", overflowX: "auto" }}>
            <div style={{ ...cinzel, fontSize: "var(--text-xs)", color: C.gold, letterSpacing: 2, marginBottom: 10 }}>RUNDEN-ERGEBNIS</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.glassBorder}` }}>
                  <th style={{ ...cinzel, textAlign: "left", padding: "4px 8px", color: C.ivoryDim, fontWeight: 600 }}>Spieler</th>
                  <th style={{ ...cinzel, textAlign: "center", padding: "4px 8px", color: C.ivoryDim, fontWeight: 600 }}>Geboten</th>
                  <th style={{ ...cinzel, textAlign: "center", padding: "4px 8px", color: C.ivoryDim, fontWeight: 600 }}>Gemacht</th>
                  <th style={{ ...cinzel, textAlign: "center", padding: "4px 8px", color: C.ivoryDim, fontWeight: 600 }}>Punkte</th>
                  <th style={{ ...cinzel, textAlign: "center", padding: "4px 8px", color: C.ivoryDim, fontWeight: 600 }}>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {lastRound.results?.map((r: any) => {
                  const hit = r.bid === r.got;
                  const delta = hit ? 20 + r.bid * 10 : -Math.abs(r.bid - r.got) * 10;
                  return (
                    <tr key={r.playerIndex} style={{ borderBottom: "1px solid rgba(201,168,76,0.06)" }}>
                      <td style={{ padding: "6px 8px", color: C.ivory, ...cinzel }}>{r.name}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center", color: C.ivoryDim }}>{r.bid}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center", color: C.ivoryDim }}>{r.got}</td>
                      <td style={{ padding: "6px 8px", textAlign: "center", ...cinzel, fontWeight: 700, color: hit ? C.success : C.error }}>
                        {delta > 0 ? "+" : ""}{delta}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "center", ...cinzel, fontWeight: 700, color: C.gold }}>{r.totalScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Ranking */}
        <div style={{ ...glass({ padding: 14 }), width: "min(360px, 96vw)" }}>
          <div style={{ ...cinzel, fontSize: "var(--text-xs)", color: C.gold, letterSpacing: 2, marginBottom: 8 }}>GESAMTRANKING</div>
          {sorted.map((p: any, i: number) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < sorted.length - 1 ? "1px solid rgba(201,168,76,0.08)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{medals[i]}</span>
                <span style={{ ...cinzel, fontSize: i === 0 ? "clamp(14px,4vw,16px)" : "clamp(12px,3vw,14px)", color: i === 0 ? C.gold : C.ivory }}>{p.ai_name}</span>
              </div>
              <span style={{ ...cinzel, fontWeight: 700, fontSize: "clamp(13px,4vw,16px)", color: i === 0 ? C.gold : C.ivory }}>{p.score}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {isHost && room.phase === "roundEnd" && (
            <button onClick={() => act("nextRound")} style={{ ...goldBtn(), padding: "12px 28px" }}>Weiter → Runde {room.round + 1}</button>
          )}
          <button onClick={onLeave} style={{ ...goldBtn(false), padding: "8px 20px", fontSize: 13 }}>🏠 Zurück zur Startseite</button>
          {isHost && room.phase === "gameEnd" && (
            <button onClick={() => act("newGame")} style={{ ...goldBtn(), padding: "12px 28px" }}>Nochmal spielen</button>
          )}
          {!isHost && <div style={{ color: C.ivoryDim, fontSize: 13 }}>Warte auf Host…</div>}
          <button onClick={() => window.location.reload()} style={{ ...goldBtn(false), padding: "12px 20px", fontSize: 12 }}>Raum verlassen</button>
        </div>
      </div>
    );
  }



  // ── Special Card Overlays ──
  const SpecialOverlay = () => {
    if (!specialAction) return null;
    const overlayStyle: React.CSSProperties = {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
      zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    };

    // Werewolf – choose suit for whole round
    if (specialAction.type === "werewolf") return (
      <div style={overlayStyle}>
        <div style={{ ...glass({ padding: 24 }), width: "min(340px,92vw)", textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 32 }}>🐺</div>
          <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>Lupin wählt die Stichfarbe</div>
          <div style={{ fontSize: 12, color: C.ivoryDim }}>Diese Farbe gilt für die gesamte Runde</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {SUITS.map(s => (
              <button key={s} onClick={() => { act("playSpecial", { cardId: specialAction.cardId, specialAction: "werewolf", suit: s }); setSpecialAction(null); }}
                style={{ background: `${SUIT_COLORS[s]}33`, border: `2px solid ${SUIT_COLORS[s]}`, borderRadius: 8, color: SUIT_COLORS[s], fontSize: 22, padding: "12px 16px", cursor: "pointer" }}>
                {SUIT_SYMBOLS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    // Witch – swap a card from trick
    if (specialAction.type === "witch") return (
      <div style={overlayStyle}>
        <div style={{ ...glass({ padding: 24 }), width: "min(400px,92vw)", textAlign: "center", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 32 }}>🧹</div>
          <div style={{ ...cinzel, fontSize: 15, color: C.gold }}>Bellatrix – Karte tauschen</div>
          <div style={{ fontSize: 11, color: C.ivoryDim }}>Wähle eine Karte aus dem Stich die du auf deine Hand nimmst</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {(specialAction.trickCards ?? []).filter((t:any) => t.card.id !== specialAction.cardId).map((t:any) => (
              <div key={t.card.id} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, color: C.ivoryDim, marginBottom: 3 }}>{players[t.playerIndex]?.ai_name}</div>
                <CardView card={t.card} onClick={() => { act("playSpecial", { cardId: specialAction.cardId, specialAction: "witch", takeCardId: t.card.id }); setSpecialAction(null); }} />
              </div>
            ))}
          </div>
          <button onClick={() => { act("playSpecial", { cardId: specialAction.cardId, specialAction: "witchSkip" }); setSpecialAction(null); }}
            style={{ ...goldBtn(false), fontSize: 12, padding: "8px 16px" }}>
            Keine Karte tauschen
          </button>
        </div>
      </div>
    );


    // Rainbow 7½ suit chooser
    if (specialAction.type === "rainbow7suit") return (
      <div style={overlayStyle}>
        <div style={{ ...glass({ padding: 24 }), width: "min(340px,92vw)", textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>George – welche Farbe?</div>
          <div style={{ fontSize: 11, color: C.ivoryDim }}>Wert 7½ · danach gibt jeder Spieler eine Karte weiter</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {SUITS.map(s => (
              <button key={s} onClick={() => { act("playCard", { cardId: specialAction.cardId, suit: s }); setSpecialAction(null); }}
                style={{ background: `${SUIT_COLORS[s]}33`, border: `2px solid ${SUIT_COLORS[s]}`, borderRadius: 8, color: SUIT_COLORS[s], fontSize: 22, padding: "12px 16px", cursor: "pointer" }}>
                {SUIT_SYMBOLS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

    // 7½ – pass a card to left neighbor
    if (specialAction.type === "rainbow7pass") return (
      <div style={overlayStyle}>
        <div style={{ ...glass({ padding: 24 }), width: "min(400px,92vw)", textAlign: "center", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 28 }}>🎁</div>
          <div style={{ ...cinzel, fontSize: 15, color: C.gold }}>George Weasley – Karte weitergeben</div>
          <div style={{ fontSize: 11, color: C.ivoryDim }}>
            Wähle eine Karte die du deinem <span style={{ color: C.gold }}>linken Nachbarn</span> gibst<br/>
            <span style={{ color: C.ivoryDim, fontSize: 10 }}>
              {Array.isArray(room?.pending_rainbow7) ? `Noch ${room.pending_rainbow7.length} Spieler ausstehend` : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
            {myHand.map((card:any) => (
              <div key={card.id} style={{ textAlign: "center" }}>
                <CardView card={card}
                  selected={passingCard === card.id}
                  onClick={() => setPassingCard(card.id)} />
              </div>
            ))}
          </div>
          <button onClick={() => {
            if (!passingCard) return;
            act("passCard", { cardId: passingCard });
            setPassingCard(null);
            setSpecialAction(null);
          }} disabled={!passingCard}
            style={{ ...goldBtn(), padding: "11px 0", opacity: passingCard ? 1 : 0.4 }}>
            Karte weitergeben
          </button>
        </div>
      </div>
    );

    // Rainbow 9¾ suit chooser
    if (specialAction.type === "rainbow9suit") return (
      <div style={overlayStyle}>
        <div style={{ ...glass({ padding: 24 }), width: "min(340px,92vw)", textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>Gleis 9¾ – welche Farbe?</div>
          <div style={{ fontSize: 11, color: C.ivoryDim }}>Wert 9¾ · der Stichgewinner ändert seine Vorhersage</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {SUITS.map(s => (
              <button key={s} onClick={() => { act("playCard", { cardId: specialAction.cardId, suit: s }); setSpecialAction(null); }}
                style={{ background: `${SUIT_COLORS[s]}33`, border: `2px solid ${SUIT_COLORS[s]}`, borderRadius: 8, color: SUIT_COLORS[s], fontSize: 22, padding: "12px 16px", cursor: "pointer" }}>
                {SUIT_SYMBOLS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );

        // WizardFool – choose wizard or fool
    if (specialAction.type === "wizardfool") return (
      <div style={overlayStyle}>
        <div style={{ ...glass({ padding: 24 }), width: "min(340px,92vw)", textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>Ron – Zauberer oder Narr?</div>
          <div style={{ fontSize: 12, color: C.ivoryDim }}>Ron kann sich nicht entscheiden…</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => { act("playSpecial", { cardId: specialAction.cardId, specialAction: "wizardfool", choice: "wizard" }); setSpecialAction(null); }}
              style={{ ...goldBtn(), flex: 1, padding: "14px 0", fontSize: 14 }}>🧙 Zauberer</button>
            <button onClick={() => { act("playSpecial", { cardId: specialAction.cardId, specialAction: "wizardfool", choice: "fool" }); setSpecialAction(null); }}
              style={{ ...goldBtn(false), flex: 1, padding: "14px 0", fontSize: 14 }}>🃏 Narr</button>
          </div>
        </div>
      </div>
    );

    // Rainbow 9¾ – adjust bid
    if (specialAction.type === "rainbow9") return (
      <div style={overlayStyle}>
        <div style={{ ...glass({ padding: 24 }), width: "min(340px,92vw)", textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>Gleis 9¾ – Vorhersage anpassen</div>
          <div style={{ fontSize: 12, color: C.ivoryDim }}>Der Stichgewinner muss seine Vorhersage um 1 ändern</div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => { act("playSpecial", { cardId: specialAction.cardId, specialAction: "rainbow9", adjust: 1 }); setSpecialAction(null); }}
              style={{ ...goldBtn(), flex: 1, padding: "14px 0", fontSize: 16 }}>+1</button>
            <button onClick={() => { act("playSpecial", { cardId: specialAction.cardId, specialAction: "rainbow9", adjust: -1 }); setSpecialAction(null); }}
              style={{ ...goldBtn(false), flex: 1, padding: "14px 0", fontSize: 16 }}>−1</button>
          </div>
        </div>
      </div>
    );

    // 9¾ pending bid adjustment (triggered by room state after trick end)
    if (room?.pending_rainbow9 === effectiveMyIdx) return (
      <div style={overlayStyle}>
        <div style={{ ...glass({ padding: 24 }), width: "min(340px,92vw)", textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 28 }}>🚂</div>
          <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>Gleis 9¾ – Vorhersage anpassen</div>
          <div style={{ fontSize: 12, color: C.ivoryDim }}>
            Du hast den Stich gewonnen – passe deine Vorhersage an<br/>
            <span style={{ color: C.gold }}>Aktuell: {me?.bid ?? 0}</span>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            {(me?.bid ?? 0) > 0 && (
              <button onClick={() => act("rainbow9Adjust", { adjust: -1 })}
                style={{ ...goldBtn(false), flex: 1, padding: "14px 0", fontSize: 16 }}>−1 ({(me?.bid??0)-1})</button>
            )}
            <button onClick={() => act("rainbow9Adjust", { adjust: 1 })}
              style={{ ...goldBtn(), flex: 1, padding: "14px 0", fontSize: 16 }}>+1 ({(me?.bid??0)+1})</button>
          </div>
        </div>
      </div>
    );

    // 7½ pending card pass – show to all players in pending list
    if (Array.isArray(room?.pending_rainbow7) && room.pending_rainbow7.includes(effectiveMyIdx) && !specialAction) {
      setTimeout(() => setSpecialAction({ type: "rainbow7pass", cardId: "rainbow7" }), 100);
    }

    // Witch pending swap
    if (room?.pending_witch === effectiveMyIdx && !specialAction) {
      setTimeout(() => setSpecialAction({ type: "witch", cardId: "witch" }), 100);
    }

    return null;
  };

  // ── Scoresheet Modal ──
  const Scoresheet = () => {
    // Bietreihenfolge: immer rechts vom Dealer (= dealer+1, dealer+2, ...)
    const bidOrder = Array.from({ length: players.length }, (_, i) => (room.dealer + 1 + i) % players.length);
    const forbidden = forbiddenDealerBid(players.map((p: any) => p.bid), room.dealer, room.round);

    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
        onClick={() => setShowScoresheet(false)}>
        <div style={{ ...glass({ padding: 0 }), width: "min(700px, 96vw)", maxHeight: "85vh", overflow: "auto", borderRadius: 12 }}
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: `1px solid ${C.glassBorder}` }}>
            <div style={{ ...cinzel, fontSize: 15, color: C.gold }}>📋 Spielblatt</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontSize: 11, color: C.ivoryDim }}>Runde {room.round}/{room.max_rounds}</div>
              <button onClick={() => setShowScoresheet(false)} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 20 }}>✕</button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="scoresheet-table" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(61,28,110,0.4)" }}>
                  <th style={{ ...cinzel, padding: "10px 12px", textAlign: "left", color: C.gold, borderBottom: `1px solid ${C.glassBorder}`, fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>RUNDE</th>
                  {players.map((p: any) => (
                    <th key={p.id} style={{ ...cinzel, padding: "10px 12px", textAlign: "center", color: p.player_index === effectiveMyIdx ? C.gold : C.ivory, borderBottom: `1px solid ${C.glassBorder}`, fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>
                      {p.ai_name}{p.player_index === effectiveMyIdx ? " ★" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Past rounds */}
                {roundHistory.map((rh: any) => (
                  <tr key={rh.round} style={{ borderBottom: `1px solid rgba(201,168,76,0.08)` }}>
                    <td style={{ padding: "8px 12px", color: C.ivoryDim, whiteSpace: "nowrap" }}>
                      <div style={{ ...cinzel, fontSize: 11, color: C.gold }}>R{rh.round}</div>
                      <div style={{ fontSize: 10, color: C.ivoryDim }}>🎴 {players[((rh.round - 1) % players.length)]?.ai_name ?? "?"}</div>
                    </td>
                    {players.map((p: any) => {
                      const r = rh.results?.find((x: any) => x.playerIndex === p.player_index);
                      const hit = r && r.bid === r.got;
                      return (
                        <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                          <div style={{ fontSize: 11, color: C.ivoryDim }}>
                            <span style={{ color: C.ivory }}>A:{r?.bid ?? "?"}</span>
                            {" / "}
                            <span style={{ color: C.ivory }}>G:{r?.got ?? "?"}</span>
                          </div>
                          <div style={{ ...cinzel, fontSize: 13, fontWeight: 700, color: hit ? C.success : C.error, marginTop: 2 }}>
                            {r ? (r.delta > 0 ? "+" : "") + r.delta : "–"}
                          </div>
                          <div style={{ fontSize: 10, color: C.gold, marginTop: 1 }}>{r?.totalScore ?? "–"}</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Current round – live bidding */}
                {room.phase !== "gameEnd" && (
                  <tr style={{ background: "rgba(61,28,110,0.2)", borderBottom: `1px solid ${C.glassBorder}` }}>
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ ...cinzel, fontSize: 11, color: C.goldLight }}>R{room.round} ▶</div>
                      <div style={{ fontSize: 10, color: C.ivoryDim }}>🎴 {players[room.dealer]?.ai_name}</div>
                    </td>
                    {bidOrder.map((pi: number) => {
                      const p = players[pi];
                      if (!p) return null;
                      const bid = p.bid;
                      const isCurrent = room.phase === "bidding" && room.current_player === pi;
                      const isDealer = room.dealer === pi;
                      const isForbidden = isDealer && forbidden !== null;
                      return (
                        <td key={p.id} style={{ padding: "8px 12px", textAlign: "center" }}>
                          <div style={{
                            ...cinzel, fontSize: 14, fontWeight: 700,
                            color: bid !== null ? C.goldLight : isCurrent ? C.gold : C.ivoryDim,
                            background: isCurrent ? "rgba(201,168,76,0.15)" : "transparent",
                            borderRadius: 6, padding: "4px 6px",
                            border: isCurrent ? `1px solid ${C.gold}55` : "1px solid transparent",
                            animation: isCurrent ? "pulse 1.5s infinite" : "none",
                          }}>
                            {bid !== null ? `A:${bid}` : isCurrent ? "⟳" : "?"}
                          </div>
                          {isForbidden && bid === null && (
                            <div style={{ fontSize: 9, color: "#E4C97A", marginTop: 2 }}>≠{forbidden}</div>
                          )}
                          {room.phase === "playing" || room.phase === "trickEnd" ? (
                            <div style={{ fontSize: 10, color: C.ivoryDim, marginTop: 2 }}>{p.tricks_won}/{bid ?? "?"} Stiche</div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                )}

                {/* Total row */}
                <tr style={{ background: "rgba(201,168,76,0.08)" }}>
                  <td style={{ padding: "8px 12px", ...cinzel, fontSize: 11, color: C.gold }}>GESAMT</td>
                  {players.map((p: any) => (
                    <td key={p.id} style={{ padding: "8px 12px", textAlign: "center", ...cinzel, fontSize: 15, fontWeight: 700, color: C.gold }}>{p.score}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ── Main Game ──
  const isBidding = room.phase === "bidding" && isMyTurn;
  // Debug - remove later
  console.log("Debug:", { phase: room.phase, current_player: room.current_player, effectiveMyIdx, isMyTurn, isBidding, myPlayerId: myPlayer?.id });
  const isChoosingTrump = room.phase === "choosingTrump" && isMyTurn;
  const isChoosingWerewolf = room.phase === "choosingWerewolf" && isMyTurn;
  const isPlaying = room.phase === "playing" && isMyTurn && !loading;

  return (
    <div style={tableStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", maxWidth: 1100, alignItems: "center" }}>
        <div style={{ ...cinzel, fontSize: 11, color: C.ivoryDim }}>RUNDE {room.round}/{room.max_rounds}</div>
        <div style={{ ...cinzel, fontSize: 16, color: C.gold, letterSpacing: 4 }}>🧙 WIZARD</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ ...cinzel, fontSize: 11, color: C.ivoryDim, letterSpacing: 2 }}>{room.code}</div>
          <button onClick={() => setShowScoresheet(true)} style={{ ...goldBtn(false), padding: "4px 8px", fontSize: 11 }}>📋</button>
        </div>
      </div>

      {/* Round table layout */}
      {(() => {
        const seats = getSeatPositions(players, effectiveMyIdx);
        const topPlayers = seats.filter((s:any) => ["top","top-left","top-right"].includes(s.position));
        const leftPlayer = seats.find((s:any) => s.position === "left");
        const rightPlayer = seats.find((s:any) => s.position === "right");

        const PlayerPill = ({ p, arrow = "" }: { p: any; arrow?: string }) => {
          const isActive = room.current_player === p.player_index;
          const hasBid = p.bid !== null;
          const count = Array.isArray(p.hand) ? p.hand.length : 0;
          const hasPlayed = trick.some((t:any) => t.playerIndex === p.player_index);
          const isMe = p.player_index === effectiveMyIdx;
          return (
            <div style={{
              background: isActive
                ? `linear-gradient(135deg, rgba(61,28,110,0.97), rgba(90,45,153,0.9))`
                : isMe ? "rgba(10,20,40,0.95)" : "rgba(5,10,20,0.94)",
              border: `${isActive ? "2.5px" : "1.5px"} solid ${isActive ? C.gold : isMe ? "rgba(201,168,76,0.4)" : "rgba(201,168,76,0.2)"}`,
              boxShadow: isActive ? `0 0 28px ${C.gold}88, 0 4px 12px rgba(0,0,0,0.5)` : "0 2px 8px rgba(0,0,0,0.5)",
              borderRadius: 12, padding: "clamp(6px,1.5vw,10px) clamp(8px,2vw,14px)",
              display: "flex", flexDirection: "column" as const, gap: 5,
              minWidth: "clamp(100px,18vw,160px)", maxWidth: "clamp(140px,22vw,220px)", position: "relative" as const,
              transition: "all 0.3s ease",
            }}>
              {isActive && arrow && (
                <div style={{ position: "absolute", [arrow]: -18, left: "50%", transform: "translateX(-50%)", color: C.gold, fontSize: 16, lineHeight: 1 }}>
                  {arrow === "top" ? "▼" : "▲"}
                </div>
              )}
              {/* Name row */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12 }}>{p.is_ai ? "🤖" : "👤"}</span>
                <span style={{ ...cinzel, fontSize: "clamp(10px,1.8vw,13px)", color: isActive ? C.gold : isMe ? C.goldLight : C.ivory, fontWeight: 700, whiteSpace: "nowrap" as const }}>
                  {p.ai_name}{isMe ? " ★" : ""}
                </span>
                {hasPlayed && <span style={{ fontSize: 12, color: C.gold, marginLeft: "auto" }}>✓</span>}
              </div>
              {/* Stats row */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: C.ivoryDim, letterSpacing: 1 }}>PKT</span>
                  <span style={{ ...cinzel, fontSize: "clamp(14px,2.5vw,22px)", color: C.goldLight, fontWeight: 700, lineHeight: 1 }}>{p.score}</span>
                </div>
                <div style={{ width: 1, height: 28, background: "rgba(201,168,76,0.2)" }} />
                {hasBid ? (
                  <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: C.ivoryDim, letterSpacing: 1 }}>STICHE</span>
                    <span style={{ ...cinzel, fontSize: "clamp(14px,2.5vw,22px)", fontWeight: 700, lineHeight: 1,
                      color: p.tricks_won === p.bid ? C.success : p.tricks_won > p.bid ? C.error : C.ivory }}>
                      {p.tricks_won}<span style={{ fontSize: "clamp(9px,1.5vw,14px)", color: C.ivoryDim }}>/{p.bid}</span>
                    </span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: C.ivoryDim, letterSpacing: 1 }}>TIPP</span>
                    <span style={{ ...cinzel, fontSize: "clamp(14px,2.5vw,20px)", color: C.ivoryDim, lineHeight: 1 }}>
                      {room.phase === "bidding" ? "…" : "–"}
                    </span>
                  </div>
                )}
                {p.player_index !== effectiveMyIdx && (
                  <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: C.ivoryDim }}>🂠</span>
                    <span style={{ ...cinzel, fontSize: 13, color: C.ivoryDim }}>{count}</span>
                  </div>
                )}
              </div>
            </div>
          );
        };

        // My seat pill
        const mySeat = seats.find((s:any) => s.position === "bottom");

        return (
          <div style={{ width: "min(1200px,99vw)", display: "flex", flexDirection: "column" as const, gap: 8, alignItems: "center" }}>

            {/* Top players */}
            <div style={{ display: "flex", justifyContent: "center", gap: "clamp(4px,1vw,8px)", flexWrap: "wrap" as const }}>
              {topPlayers.map((s:any) => <PlayerPill key={s.player.id} p={s.player} arrow="top" />)}
            </div>

            {/* Middle: left + table + right */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%" }}>

              {/* Left */}
              <div style={{ width: "clamp(90px,15vw,160px)", flexShrink: 0 }}>
                {leftPlayer && <PlayerPill p={leftPlayer.player} arrow="top" />}
              </div>

              {/* Green table */}
              <div style={{
                flex: 1, minHeight: "clamp(200px,55vw,520px)",
                background: "radial-gradient(ellipse at center, #1e5c3a 0%, #0d2818 55%, #061408 100%)",
                border: "3px solid rgba(201,168,76,0.25)", borderRadius: 16, padding: "clamp(10px,2vw,20px) clamp(10px,2vw,20px)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                boxShadow: "inset 0 4px 40px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.5)",
                position: "relative" as const,
              }}>
                {/* Trump */}
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2, minWidth: 50 }}>
                  {room.trump_card && <CardView card={room.trump_card} small werewolfSuit={room.werewolf_suit} />}
                  <div style={{ ...cinzel, fontSize: 7, color: C.gold }}>TRUMPF</div>
                  {room.trump_suit && <span style={{ color: SUIT_COLORS[room.trump_suit as keyof typeof SUIT_COLORS], fontSize: 12 }}>{SUIT_SYMBOLS[room.trump_suit as keyof typeof SUIT_SYMBOLS]}</span>}
                  {room.werewolf_suit && <span style={{ fontSize: 8, color: "#F7DC6F" }}>🐺{SUIT_SYMBOLS[room.werewolf_suit as keyof typeof SUIT_SYMBOLS]}</span>}
                </div>

                {/* Trick cards + Bidding overlay */}
                <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center", justifyContent: "center", flexWrap: "wrap" as const, position: "relative" as const }}>

                  {trick.length === 0 && room.phase === "playing" && (
                    <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>{players[room.current_player]?.ai_name} beginnt…</div>
                  )}
                  {[...trick].sort((a:any,b:any) => {
                      // Sort by seat position (clockwise from current player)
                      const seatA = (a.playerIndex - effectiveMyIdx + players.length) % players.length;
                      const seatB = (b.playerIndex - effectiveMyIdx + players.length) % players.length;
                      return seatA - seatB;
                    }).map((t: any, i: number) => {
                      const isMe = t.playerIndex === effectiveMyIdx;
                      return (
                        <div key={i} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 8, color: isMe ? C.gold : "rgba(255,255,255,0.5)", marginBottom: 2, ...cinzel }}>
                            {isMe ? "Du" : players[t.playerIndex]?.ai_name}
                          </div>
                          <CardView card={t.card} />
                        </div>
                      );
                    })}
                  {room.phase === "trickEnd" && room.last_trick_winner !== null && (
                    <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
                      <div style={{ ...cinzel, fontSize: 12, color: C.gold, textAlign: "center", textShadow: `0 0 12px ${C.gold}`, background: "rgba(0,0,0,0.7)", padding: "4px 12px", borderRadius: 8 }}>
                        ✓ {players[room.last_trick_winner]?.ai_name} gewinnt den Stich!
                      </div>
                    </div>
                  )}
                </div>

                {/* Round info */}
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 3, minWidth: 50 }}>
                  <div style={{ ...cinzel, fontSize: 9, color: C.gold }}>R{room.round}<span style={{ color: C.ivoryDim }}>/{room.max_rounds}</span></div>
                  <div style={{ fontSize: 8, color: C.ivoryDim, textAlign: "center" }}>🎴 {players[room.dealer]?.ai_name}</div>
                </div>
              </div>

              {/* Right */}
              <div style={{ width: 160, flexShrink: 0 }}>
                {rightPlayer && <PlayerPill p={rightPlayer.player} arrow="top" />}
              </div>
            </div>

            {/* Bidding / action UI - between table and my pill */}
            {(isBidding || isChoosingTrump || isChoosingWerewolf ||
              (room.phase === "bidding" && !isMyTurn) ||
              (room.phase === "choosingWerewolf" && !isMyTurn)) && (
              <div style={{ background: "rgba(5,8,15,0.95)", border: `2px solid ${C.gold}`, borderRadius: 12, padding: "12px 16px", textAlign: "center", width: "100%" }}>
                {isBidding && <>
                  <div style={{ ...cinzel, fontSize: "clamp(10px,2.5vw,12px)", color: C.gold, letterSpacing: 1, marginBottom: 8 }}>
                    WIE VIELE STICHE? (0–{room.round})
                    {dealerForbidden !== null && <span style={{ color: "#F7DC6F", fontSize: "clamp(9px,2vw,11px)", display: "block", marginTop: 4 }}>⚠ {dealerForbidden} verboten</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, justifyContent: "center" }}>
                    {Array.from({ length: room.round + 1 }, (_, i) => (
                      <button key={i} onClick={() => act("bid", { bid: i })} disabled={i === dealerForbidden}
                        style={{ ...goldBtn(i !== dealerForbidden), padding: "10px 16px", fontSize: "clamp(16px,4vw,22px)", opacity: i === dealerForbidden ? 0.2 : 1, minWidth: 48 }}>
                        {i}
                      </button>
                    ))}
                  </div>
                </>}
                {isChoosingTrump && <>
                  <div style={{ ...cinzel, fontSize: 12, color: C.gold, marginBottom: 10 }}>TRUMPFFARBE WÄHLEN</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    {SUITS.map(s => <button key={s} onClick={() => act("chooseTrump", { suit: s })} style={{ background: `${SUIT_COLORS[s]}33`, border: `2px solid ${SUIT_COLORS[s]}`, borderRadius: 8, color: SUIT_COLORS[s], fontSize: 24, padding: "10px 14px", cursor: "pointer" }}>{SUIT_SYMBOLS[s]}</button>)}
                  </div>
                </>}
                {isChoosingWerewolf && <>
                  <div style={{ ...cinzel, fontSize: 12, color: C.gold, marginBottom: 10 }}>🐺 STICHFARBE WÄHLEN</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    {SUITS.map(s => <button key={s} onClick={() => act("chooseWerewolf", { suit: s })} style={{ background: `${SUIT_COLORS[s]}33`, border: `2px solid ${SUIT_COLORS[s]}`, borderRadius: 8, color: SUIT_COLORS[s], fontSize: 24, padding: "10px 14px", cursor: "pointer" }}>{SUIT_SYMBOLS[s]}</button>)}
                  </div>
                </>}
                {room.phase === "bidding" && !isMyTurn && (
                  <div style={{ ...cinzel, fontSize: 12, color: C.ivoryDim }}>⏳ <span style={{ color: C.gold }}>{players[room.current_player]?.ai_name}</span> bietet…</div>
                )}
                {room.phase === "choosingWerewolf" && !isMyTurn && !isChoosingWerewolf && (
                  <div style={{ ...cinzel, fontSize: 12, color: C.ivoryDim }}>🐺 <span style={{ color: C.gold }}>{players[room.current_player]?.ai_name}</span> wählt…</div>
                )}
              </div>
            )}

            {/* My pill at bottom */}
            {mySeat && (
              <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
                <PlayerPill p={mySeat.player} arrow="" />
              </div>
            )}
          </div>
        );
      })()}


      {/* Choose Werewolf Suit */}
      {isChoosingWerewolf && (
        <div style={{ background: "rgba(5,8,15,0.96)", border: `2px solid ${C.gold}`, borderRadius: 12, padding: 16, textAlign: "center", width: "min(460px,92vw)" }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🐺</div>
          <div style={{ ...cinzel, fontSize: 12, color: C.gold, letterSpacing: 2, marginBottom: 12 }}>STICHFARBE FÜR DIESE RUNDE WÄHLEN</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {SUITS.map(s => (
              <button key={s} onClick={() => act("chooseWerewolf", { suit: s })} style={{
                background: `${SUIT_COLORS[s]}33`, border: `2px solid ${SUIT_COLORS[s]}`,
                borderRadius: 8, color: SUIT_COLORS[s], fontSize: 22, padding: "12px 16px", cursor: "pointer",
              }}>{SUIT_SYMBOLS[s]}</button>
            ))}
          </div>
        </div>
      )}

      {room.phase === "choosingWerewolf" && !isMyTurn && (
        <div style={{ ...glass({ padding: "8px 14px" }), fontSize: 12, color: C.ivoryDim, textAlign: "center" }}>
          🐺 <span style={{ color: C.gold, ...cinzel }}>{players[room.current_player]?.ai_name}</span> wählt die Stichfarbe…
        </div>
      )}

      {/* Choose Trump */}
      {isChoosingTrump && (
        <div style={{ background: "rgba(5,8,15,0.96)", border: `2px solid ${C.gold}`, borderRadius: 12, padding: 16, textAlign: "center", width: "min(460px,92vw)" }}>
          <div style={{ ...cinzel, fontSize: 12, color: C.gold, letterSpacing: 2, marginBottom: 12 }}>TRUMPFFARBE WÄHLEN</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {SUITS.map(s => (
              <button key={s} onClick={() => act("chooseTrump", { suit: s })} style={{
                background: `${SUIT_COLORS[s]}33`, border: `2px solid ${SUIT_COLORS[s]}`,
                borderRadius: 8, color: SUIT_COLORS[s], fontSize: 22, padding: "12px 16px", cursor: "pointer",
              }}>{SUIT_SYMBOLS[s]}</button>
            ))}
          </div>
        </div>
      )}


      {/* My Hand */}
      <div style={{ marginTop: "auto", paddingTop: 10, borderTop: `1px solid ${C.glassBorder}`, width: "100%", maxWidth: "100%" }}>
        <div style={{
          ...cinzel,
          fontSize: isPlaying ? "clamp(12px,2.5vw,15px)" : "clamp(9px,1.5vw,11px)",
          color: isPlaying ? "#FFE566" : "rgba(255,255,255,0.5)",
          textAlign: "center",
          marginBottom: 8,
          letterSpacing: 2,
          padding: isPlaying ? "8px 20px" : "2px 0",
          background: isPlaying ? `linear-gradient(135deg, rgba(61,28,110,0.95), rgba(90,45,153,0.85))` : "transparent",
          borderRadius: isPlaying ? 20 : 0,
          border: isPlaying ? `2px solid ${C.gold}` : "none",
          boxShadow: isPlaying ? `0 0 16px rgba(201,168,76,0.4)` : "none",
          animation: isPlaying ? "pulse 2s infinite" : "none",
        }}>
          {isPlaying ? "✦ DU BIST DRAN ✦" : room.phase === "playing" ? `⏳ ${players[room.current_player]?.ai_name} ist dran` : "DEINE KARTEN"}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center", marginBottom: 10 }}>
          {myHand.map((card: any) => (
            <CardView key={card.id} card={card}
              selected={selected === card.id}
              disabled={!isPlaying}
              onClick={isPlaying ? () => setSelected(card.id === selected ? null : card.id) : undefined}
            />
          ))}
        </div>
        {isPlaying && selected && (
          <div style={{ textAlign: "center" }}>
            <button onClick={() => {
              const card = myHand.find((c:any) => c.id === selected);
              if (card?.specialType === "werewolf") {
                setSpecialAction({ type: "werewolf", cardId: selected });
                setSelected(null);
              } else if (card?.specialType === "wizardfool") {
                setSpecialAction({ type: "wizardfool", cardId: selected });
                setSelected(null);
              } else if (card?.specialType === "rainbow7") {
                // Rainbow 7½ – choose suit first
                setSpecialAction({ type: "rainbow7suit", cardId: selected });
                setSelected(null);
              } else if (card?.specialType === "rainbow9") {
                // Rainbow 9¾ – choose suit first
                setSpecialAction({ type: "rainbow9suit", cardId: selected });
                setSelected(null);
              } else {
                act("playCard", { cardId: selected });
                setSelected(null);
              }
            }} style={{ ...goldBtn(), padding: "11px 32px" }}>
              Karte ausspielen
            </button>
          </div>
        )}
      </div>

      {showScoresheet && <Scoresheet />}
      <SpecialOverlay />

      {/* Error Toast */}
      {error && (
        <div onClick={() => setError("")} style={{ position: "fixed", top: "max(16px, env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", background: `${C.error}EE`, color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, zIndex: 100, ...cinzel, cursor: "pointer", whiteSpace: "nowrap", maxWidth: "90vw", textAlign: "center" }}>
          {error} <span style={{ opacity: 0.7, fontSize: 11 }}>✕</span>
        </div>
      )}

      {/* Log */}
      <div ref={logRef} className="log-panel" style={{ ...glass({ padding: 8 }), fontSize: "var(--text-xs)", color: C.ivoryDim }}>
        {log.map((l: string, i: number) => (
          <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid rgba(201,168,76,0.06)" }}>{l}</div>
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
    const isPWA = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as any).standalone === true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setLoading(false);
    });

    if (!isPWA) {
      // Browser: always start fresh
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          // Sign out silently, onAuthStateChange will set session to null
          supabase.auth.signOut().catch(() => {});
        } else {
          setLoading(false);
        }
      }).catch(() => setLoading(false));
    } else {
      // PWA: restore session
      const timeout = setTimeout(() => setLoading(false), 3000);
      supabase.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setLoading(false);
        clearTimeout(timeout);
      }).catch(() => { setLoading(false); clearTimeout(timeout); });
      return () => { subscription.unsubscribe(); clearTimeout(timeout); };
    }

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.midnight, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ ...cinzel, fontSize: 48, color: C.gold }}>🧙</div>
      <div style={{ ...cinzel, fontSize: 14, color: C.ivoryDim, letterSpacing: 3 }}>WIZARD</div>
    </div>
  );

  return (
    <>
      {session ? <LobbyScreen session={session} /> : <AuthScreen />}
      <InstallBanner />
    </>
  );
}
