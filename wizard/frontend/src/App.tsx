import { useState, useEffect, useCallback, useRef } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase, callGameAction } from "./supabase";
import { CardView } from "./CardView";
import { SUITS, SUIT_SYMBOLS, SUIT_COLORS, forbiddenDealerBid } from "./types";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bgDark: "#10161A",
  bgPanel: "#17201B",
  accent: "#263029",
  accentLight: "#3A4B40",
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
  fontFamily: "'Inter', sans-serif",
  background: active ? `linear-gradient(135deg, ${C.accent}, ${C.accentLight})` : "rgba(255,255,255,0.05)",
  color: active ? C.goldLight : C.ivoryDim,
  border: "none",
  borderRadius: 16,
  padding: "clamp(8px,2vw,12px) clamp(12px,3vw,20px)",
  fontSize: "clamp(13px, 2vw, 15px)",
  cursor: "pointer",
  letterSpacing: "0.02em",
  transition: "all 0.2s",
  fontWeight: 600,
  boxShadow: active ? "0 6px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
  minHeight: 44,
  userSelect: "none",
  WebkitUserSelect: "none",
});

// Pill-track segmented control (player count, edition, login/register toggle …)
const segTrack: React.CSSProperties = {
  display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: 999, padding: 3,
};
const segBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, textAlign: "center", padding: "10px 0", borderRadius: 999,
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13,
  background: active ? `linear-gradient(135deg, ${C.accent}, ${C.accentLight})` : "transparent",
  color: active ? C.goldLight : C.ivoryDim,
  border: "none", cursor: "pointer",
  boxShadow: active ? "0 2px 8px rgba(0,0,0,0.35)" : "none",
  WebkitTapHighlightColor: "transparent", touchAction: "manipulation", minHeight: 40,
  userSelect: "none", WebkitUserSelect: "none",
});

// Icon-over-label tile button (Home screen secondary actions)
const tileBtn: React.CSSProperties = {
  flex: 1, background: "rgba(255,255,255,0.045)", border: "none", borderRadius: 16,
  padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 12, color: C.ivoryDim, cursor: "pointer",
  WebkitTapHighlightColor: "transparent", touchAction: "manipulation", minHeight: 44,
  userSelect: "none", WebkitUserSelect: "none",
};

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
  background: `radial-gradient(ellipse at 20% 0%, ${C.accent}33 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, #23302a33 0%, transparent 60%), ${C.bgDark}`,
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
        <div style={{ ...cinzel, fontSize: "clamp(32px,5vw,52px)", fontWeight: 700, color: C.gold, letterSpacing: "clamp(6px,1.5vw,12px)", textShadow: `0 0 40px ${C.accent}` }}>WIZARD</div>
        <div style={{ fontSize: 12, color: C.ivoryDim, letterSpacing: 3, marginTop: 4 }}>DAS KARTENSPIEL</div>
      </div>

      <GoldDivider />

      {/* Name Card */}
      <div style={{ ...glass({ padding: 24 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Mode toggle */}
        <div style={segTrack}>
          {(["login","register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={segBtn(mode === m)}>
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

// ─── Profile Screen ───────────────────────────────────────────────────────────
function ProfileScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const username = session.user.user_metadata?.username ?? "Spieler";
  const [nameInput, setNameInput] = useState(username);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    supabase.from("user_stats").select("*").eq("id", session.user.id).single().then(({ data }) => setStats(data));
  }, [session.user.id]);

  async function saveName() {
    const n = nameInput.trim();
    if (!n || n === username) return;
    setNameSaving(true); setNameMsg(null);
    const { error } = await supabase.auth.updateUser({ data: { username: n } });
    setNameSaving(false);
    setNameMsg(error ? { text: "Fehler beim Speichern", ok: false } : { text: "Name gespeichert ✓", ok: true });
  }

  async function savePassword() {
    setPwMsg(null);
    if (pw1.length < 6) { setPwMsg({ text: "Mindestens 6 Zeichen", ok: false }); return; }
    if (pw1 !== pw2) { setPwMsg({ text: "Passwörter stimmen nicht überein", ok: false }); return; }
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setPwSaving(false);
    if (error) setPwMsg({ text: error.message, ok: false });
    else { setPwMsg({ text: "Passwort geändert ✓", ok: true }); setPw1(""); setPw2(""); }
  }

  const statItems = stats ? [
    { label: "Spiele", value: stats.games_played ?? 0, icon: "🎮" },
    { label: "Siege", value: stats.games_won ?? 0, icon: "🏆" },
    { label: "Ø Punkte", value: stats.avg_score ?? 0, icon: "⭐" },
    { label: "Ø Platz", value: stats.avg_placement ?? "–", icon: "🎯" },
    { label: "Trefferquote", value: `${stats.bid_accuracy_pct ?? 0}%`, icon: "🎪" },
    { label: "Stiche geboten", value: stats.total_bid ?? 0, icon: "🃏" },
  ] : [];

  return (
    <div style={{ ...tableStyle, justifyContent: "flex-start", gap: 14, paddingTop: "max(20px, env(safe-area-inset-top))" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "min(420px,92vw)" }}>
        <div style={{ ...cinzel, fontSize: "clamp(16px,5vw,22px)", color: C.gold }}>👤 Profil</div>
        <button onClick={onBack} style={{ ...goldBtn(false), padding: "6px 14px", fontSize: 12 }}>← Zurück</button>
      </div>

      {/* Name */}
      <div style={{ ...glass({ padding: 20 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ ...cinzel, fontSize: 11, color: C.gold, letterSpacing: 2 }}>NAME</div>
        <input value={nameInput} onChange={e => { setNameInput(e.target.value); setNameMsg(null); }}
          placeholder="Dein Name" style={inputStyle} maxLength={24}
          onKeyDown={e => e.key === "Enter" && saveName()} />
        <button onClick={saveName} disabled={nameSaving || !nameInput.trim() || nameInput.trim() === username}
          style={{ ...goldBtn(), padding: "10px 0", fontSize: 13, opacity: (nameSaving || !nameInput.trim() || nameInput.trim() === username) ? 0.5 : 1 }}>
          {nameSaving ? "…" : "Namen speichern"}
        </button>
        {nameMsg && <div style={{ fontSize: 12, color: nameMsg.ok ? C.success : "#FF8080", textAlign: "center" }}>{nameMsg.text}</div>}
      </div>

      {/* Password */}
      <div style={{ ...glass({ padding: 20 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ ...cinzel, fontSize: 11, color: C.gold, letterSpacing: 2 }}>PASSWORT ÄNDERN</div>
        <input value={pw1} onChange={e => { setPw1(e.target.value); setPwMsg(null); }}
          placeholder="Neues Passwort" type="password" style={inputStyle} autoComplete="new-password" />
        <input value={pw2} onChange={e => { setPw2(e.target.value); setPwMsg(null); }}
          placeholder="Passwort bestätigen" type="password" style={inputStyle} autoComplete="new-password"
          onKeyDown={e => e.key === "Enter" && savePassword()} />
        <button onClick={savePassword} disabled={pwSaving || !pw1 || !pw2}
          style={{ ...goldBtn(), padding: "10px 0", fontSize: 13, opacity: (pwSaving || !pw1 || !pw2) ? 0.5 : 1 }}>
          {pwSaving ? "…" : "Passwort speichern"}
        </button>
        {pwMsg && <div style={{ fontSize: 12, color: pwMsg.ok ? C.success : "#FF8080", textAlign: "center" }}>{pwMsg.text}</div>}
      </div>

      {/* Stats */}
      <div style={{ ...glass({ padding: 20 }), width: "min(420px, 92vw)" }}>
        <div style={{ ...cinzel, fontSize: 11, color: C.gold, letterSpacing: 2, marginBottom: 12 }}>📊 STATISTIKEN</div>
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
    </div>
  );
}

// ─── Lobby ────────────────────────────────────────────────────────────────────
function LobbyScreen({ session }: { session: Session }) {
  const [view, setView] = useState<"home" | "create" | "join" | "rules" | "profile">("home");
  const [reconnectRoom, setReconnectRoom] = useState<string|null>(null);
  const [savedPlannedTotal, setSavedPlannedTotal] = useState<number | null>(null);

  // Check for reconnectable room on mount
  useEffect(() => {
    const savedRoom = sessionStorage.getItem("wizard_room");
    if (savedRoom) {
      const { roomId, code, plannedTotal } = JSON.parse(savedRoom);
      supabase.from("rooms").select("phase").eq("id", roomId).single()
        .then(({ data }) => {
          if (data && data.phase !== "gameEnd") { setReconnectRoom(code); if (plannedTotal) setSavedPlannedTotal(plannedTotal); }
          else sessionStorage.removeItem("wizard_room");
        });
    }
  }, []);
  const [codeInput, setCodeInput] = useState("");
  const [totalPlayers, setTotalPlayers] = useState(3);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [edition, setEdition] = useState<"classic"|"anniversary">("classic");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const username = session.user.user_metadata?.username ?? "Spieler";

  async function createRoom() {
    setLoading(true); setError("");
    const res = await callGameAction("", "createRoom", { username, edition });
    if (!res?.roomId) { setError(res?.error ?? "Fehler"); setLoading(false); return; }
    sessionStorage.setItem("wizard_room", JSON.stringify({ roomId: res.roomId, code: res.code, plannedTotal: totalPlayers }));
    setRoomId(res.roomId);
    setLoading(false);
  }

  async function joinRoom() {
    setLoading(true); setError("");
    const res = await callGameAction("", "joinRoom", { username, code: codeInput.toUpperCase() });
    if (!res?.roomId) { setError(res?.error ?? "Raum nicht gefunden"); setLoading(false); return; }
    sessionStorage.setItem("wizard_room", JSON.stringify({ roomId: res.roomId, code: codeInput.toUpperCase() }));
    setRoomId(res.roomId);
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

  if (view === "profile") return <ProfileScreen session={session} onBack={() => setView("home")} />;

  if (roomId) return <GameRoom roomId={roomId} session={session} plannedTotal={savedPlannedTotal ?? totalPlayers} edition={edition} onLeave={() => { sessionStorage.removeItem("wizard_room"); setRoomId(null); }} />;

  // compact: skips the big mascot/title hero (only makes sense once, on the
  // home screen) so content-heavy sub-screens like "create" don't push their
  // primary action button below the fold and force scrolling to reach it.
  const HeaderBlock = ({ compact = false }: { compact?: boolean } = {}) => (
    <>
      {!compact && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "clamp(36px,10vw,52px)" }}>🧙</div>
          <div style={{ ...cinzel, fontSize: "clamp(28px,5vw,48px)", fontWeight: 700, color: C.gold, letterSpacing: "clamp(4px,1vw,10px)" }}>WIZARD</div>
        </div>
      )}
      <button onClick={() => setView("profile")} style={{ ...goldBtn(false), padding: "6px 14px", fontSize: 12 }}>⚙️ Profil</button>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "min(320px, 92vw)" }}>
        <button onClick={() => setView("create")} style={{ ...goldBtn(), width: "100%", padding: "16px 0", fontSize: 15 }}>
          Spiel erstellen
        </button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setView("join")} style={tileBtn}>
            <span style={{ fontSize: 18 }}>⬡</span>
            Beitreten
          </button>
          <button onClick={() => setView("rules")} style={tileBtn}>
            <span style={{ fontSize: 18 }}>📖</span>
            Regeln
          </button>
        </div>
      </div>
    </div>
  );

  if (view === "create") return (
    <div style={{ ...tableStyle, justifyContent: "center", gap: 20 }}>
      <HeaderBlock compact />
      <div style={{ ...glass({ padding: 24 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 16 }}>
        <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 13, textAlign: "left", padding: 0 }}>← Zurück</button>
        <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>Neues Spiel</div>
        <div>
          <div style={{ ...cinzel, fontSize: 10, color: C.ivoryDim, letterSpacing: 2, marginBottom: 8 }}>GESAMTZAHL SPIELER</div>
          <div style={segTrack}>
            {[3,4,5,6].map(n => (
              <button key={n} onClick={() => setTotalPlayers(n)}
                style={{ ...segBtn(totalPlayers===n), fontSize: 15 }}>{n}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: C.ivoryDim, marginTop: 6 }}>Fehlende Plätze werden beim Start automatisch mit KI aufgefüllt</div>
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
          Ziel: <span style={{ color: C.gold, ...cinzel }}>{totalPlayers}</span> Spieler ·{" "}
          <span style={{ color: C.gold }}>{Math.floor(60/totalPlayers)} Runden</span>
        </div>
        <button onClick={createRoom} disabled={loading}
          style={{ ...goldBtn(), width: "100%", padding: "13px 0", fontSize: 14, opacity: loading?0.5:1 }}>
          {loading ? "Erstelle Raum…" : "✦ Raum erstellen"}
        </button>
        {error && <div style={{ color: "#FF8080", fontSize: 12, textAlign: "center" }}>{error}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ ...tableStyle, justifyContent: "center", gap: 20 }}>
      <HeaderBlock compact />
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
    else if (n === 2) position = "top";
    else if (n === 3) { position = offset === 1 ? "top-left" : "top-right"; }
    else if (n === 4) { position = offset === 1 ? "left" : offset === 2 ? "top" : "right"; }
    else if (n === 5) { position = offset === 1 ? "left" : offset === 2 ? "top-left" : offset === 3 ? "top-right" : "right"; }
    else if (n === 6) { position = offset === 1 ? "left" : offset === 2 ? "top-left" : offset === 3 ? "top" : offset === 4 ? "top-right" : "right"; }
    seats.push({ player: players[i], position });
  }
  return seats;
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

// Loads players from the hand-free view and merges the caller's own hand
// (own row is still readable via RLS). Opponents get hand as an array of
// face-down placeholders sized by hand_count; in round 1 visible_hand shows
// their real cards (Indian poker).
async function loadPlayersSecure(roomId: string, myUserId: string) {
  const [{ data: pub }, { data: mine }] = await Promise.all([
    supabase.from("room_players_view").select("*").eq("room_id", roomId).order("player_index"),
    supabase.from("room_players").select("player_index, hand").eq("room_id", roomId).eq("user_id", myUserId).maybeSingle(),
  ]);
  if (!pub) return null;
  return pub.map((p: any) => {
    const isMe = p.player_index === mine?.player_index;
    const hand = isMe
      ? (mine?.hand ?? [])
      : (p.visible_hand ?? Array.from({ length: p.hand_count ?? 0 }, (_, i) => ({ id: `hidden-${p.player_index}-${i}`, type: "hidden" })));
    return { ...p, hand };
  });
}

// ─── Game Room ────────────────────────────────────────────────────────────────
function GameRoom({ roomId, session, plannedTotal, edition, onLeave }: { roomId: string; session: Session; plannedTotal: number; edition?: string; onLeave: () => void }) {
  const aiTriggerPending = useRef(false);
  const aiTriggerLastKey = useRef<string>("");
  const clearTrickPending = useRef(false);
  const [showLog, setShowLog] = useState(false);
  const [modalMinimized, setModalMinimized] = useState(true);
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
  type SpecialAction =
    | { type: "rainbow7pass" | "rainbow7suit" | "rainbow9suit" | "wizardfool"; cardId: string }
    | { type: "witchGive"; takeCardId: string };
  const [specialAction, setSpecialAction] = useState<SpecialAction | null>(null);
  const [passingCard, setPassingCard] = useState<string|null>(null); // for 7½
  const [passedRainbow7, setPassedRainbow7] = useState(false); // true once I've submitted my card for the current pending_rainbow7 round, until the server confirms I'm no longer pending
  const [witchSwapped, setWitchSwapped] = useState(false); // true once I've submitted my Hexe swap, until the server confirms I'm no longer pending_witch
  const [rainbow9Adjusted, setRainbow9Adjusted] = useState(false); // true once I've submitted my 9¾ adjustment, until the server confirms I'm no longer pending_rainbow9
  const logRef = useRef<HTMLDivElement>(null);

  // ── Chat state ──
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const showChatRef = useRef(false);
  useEffect(() => { showChatRef.current = showChat; if (showChat) setUnreadCount(0); }, [showChat]);

  // Load chat history + subscribe to new messages
  useEffect(() => {
    supabase.from("room_messages").select("*").eq("room_id", roomId).order("created_at").limit(100)
      .then(({ data }) => { if (data) setChatMessages(data); });
    const chatCh = supabase.channel(`chat:${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, payload => {
        setChatMessages(prev => prev.some(m => m.id === (payload.new as any).id) ? prev : [...prev, payload.new]);
        if (!showChatRef.current && (payload.new as any).user_id !== session.user.id) {
          setUnreadCount(c => c + 1);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(chatCh); };
  }, [roomId]);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (showChat) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, showChat]);

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    const username = session.user.user_metadata?.username ?? "Spieler";
    await supabase.from("room_messages").insert({ room_id: roomId, user_id: session.user.id, username, text });
  };

  const actInFlight = useRef(false);

  const act = useCallback(async (action: string, extra = {}) => {
    if (actInFlight.current) return; // prevent double-submission race conditions
    actInFlight.current = true;
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
    actInFlight.current = false;
  }, [roomId]);

  useEffect(() => {
    supabase.from("rooms").select("id, code, phase, round, max_rounds, dealer, current_player, trump_card, trump_suit, werewolf_suit, original_trump_card, current_trick, last_trick_winner, last_trick_cards, pending_rainbow7, pending_rainbow7_buffer, pending_rainbow9, pending_rainbow9_deferred, pending_witch, pending_vampire_reveal, witch_swap, edition, log, created_at").eq("id", roomId).single().then(({ data }) => { if (data) setRoom(data); });
    loadPlayersSecure(roomId, session.user.id).then(data => {
      if (data) {
        setPlayers(data);
        const mine = data.find((p: any) => p.user_id === session.user.id);
        if (mine) setMyIdx(mine.player_index);
      }
    });
  }, [roomId]);

  useEffect(() => {
    const refreshState = () => {
      supabase.from("rooms").select("id, code, phase, round, max_rounds, dealer, current_player, trump_card, trump_suit, werewolf_suit, original_trump_card, current_trick, last_trick_winner, last_trick_cards, pending_rainbow7, pending_rainbow7_buffer, pending_rainbow9, pending_rainbow9_deferred, pending_witch, pending_vampire_reveal, witch_swap, edition, log, created_at").eq("id", roomId).single().then(({ data }) => { if (data) setRoom(data); });
      loadPlayersSecure(roomId, session.user.id).then(data => { if (data) setPlayers(data); });
    };

    const ch = supabase.channel(`room:${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, payload => {
        const newRoom = payload.new;
        setRoom(newRoom);
        loadPlayersSecure(roomId, session.user.id).then(data => {
          if (data) {
            setPlayers(data);
            if (newRoom.phase === "playing" && data[newRoom.current_player]?.is_ai) {
              // Unique key: player index + current trick length to prevent duplicate triggers
              // for the same turn (multiple room updates fire for one state change)
              const triggerKey = `${newRoom.current_player}-${(newRoom.current_trick ?? []).length}-${newRoom.round}`;
              if (!aiTriggerPending.current && aiTriggerLastKey.current !== triggerKey) {
                aiTriggerPending.current = true;
                aiTriggerLastKey.current = triggerKey;
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
            if (newRoom.phase === "witchReveal") {
              setTimeout(() => {
                callGameAction(roomId, "witchRevealDone", {});
              }, 4000);
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
          setPlayers(prev => {
            if (prev.some(p => p.id === payload.new.id)) return prev;
            return [...prev, payload.new].sort((a,b) => a.player_index - b.player_index);
          });
        } else {
          refreshState();
        }
      })
      .subscribe();

    // Poll every 5 seconds as fallback for missed realtime events (read-only, no AI trigger)
    const poll = setInterval(refreshState, 5000);

    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [roomId]);

  // ── Watchdogs: state-based fallbacks in case a realtime event was missed ──
  // These fire on ANY room-state change (realtime OR polling), so the game
  // can never get permanently stuck in trickEnd or at an AI turn.
  useEffect(() => {
    if (room?.phase !== "trickEnd") return;
    const t = setTimeout(() => {
      if (!clearTrickPending.current) {
        clearTrickPending.current = true;
        callGameAction(roomId, "clearTrick", {}).finally(() => { clearTrickPending.current = false; });
      }
    }, 6000); // slightly after the primary 5s realtime-driven schedule
    return () => clearTimeout(t);
  }, [room?.phase, room?.last_trick_winner]);

  useEffect(() => {
    if (room?.phase !== "playing") return;
    if (!players[room.current_player]?.is_ai) return;
    const triggerKey = `wd-${room.current_player}-${(room.current_trick ?? []).length}-${room.round}`;
    const t = setTimeout(() => {
      if (aiTriggerLastKey.current !== triggerKey) {
        aiTriggerLastKey.current = triggerKey;
        callGameAction(roomId, "triggerAI", {});
      }
    }, 4000); // primary realtime path fires at 2s; this is the safety net
    return () => clearTimeout(t);
  }, [room?.phase, room?.current_player, (room?.current_trick ?? []).length, players]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = 0; }, [room?.log]);

  // Re-minimize modal on every transition into bidding/choosingTrump phase
  // so the player always sees the table first before opening the window.
  useEffect(() => {
    if (room?.phase === "bidding" || room?.phase === "choosingTrump" || room?.phase === "choosingWerewolf") {
      setModalMinimized(true);
    }
  }, [room?.phase, room?.round]);

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

  // Compute early so the useEffect below (which must precede all early returns) can use it
  const myPlayerEarly = players.find((p: any) => p.user_id === session.user.id);
  const effectiveMyIdxEarly = myPlayerEarly?.player_index ?? myIdx;

  // Must be before any conditional early returns (React Hook rules)
  // Reliably open the 7½ "pass a card" window whenever this player is pending,
  // and only reset passedRainbow7 once the server confirms (via realtime) that
  // we're no longer in pending_rainbow7 - not after a fixed delay, which can
  // race the realtime update and reopen the window right after submitting.
  useEffect(() => {
    const amPending = !!room && Array.isArray(room.pending_rainbow7) && room.pending_rainbow7.includes(effectiveMyIdxEarly);
    if (amPending && !specialAction && !passedRainbow7) {
      setSpecialAction({ type: "rainbow7pass", cardId: "rainbow7" });
    } else if (!amPending && passedRainbow7) {
      setPassedRainbow7(false);
    }
  }, [room?.pending_rainbow7, effectiveMyIdxEarly, specialAction, passedRainbow7]);

  // Same fix as passedRainbow7 above, for the Hexe swap: room.pending_witch
  // still shows this player as pending locally until the realtime update
  // confirming the swap arrives, which would otherwise flash step 1 (choose
  // a trick card) again right after step 2 was already submitted.
  useEffect(() => {
    if (witchSwapped && room?.pending_witch !== effectiveMyIdxEarly) {
      setWitchSwapped(false);
    }
  }, [room?.pending_witch, effectiveMyIdxEarly, witchSwapped]);

  // Same fix again, for the 9¾ bid adjustment: closes the modal the instant
  // the player submits instead of waiting on the realtime round-trip.
  useEffect(() => {
    if (rainbow9Adjusted && room?.pending_rainbow9 !== effectiveMyIdxEarly) {
      setRainbow9Adjusted(false);
    }
  }, [room?.pending_rainbow9, effectiveMyIdxEarly, rainbow9Adjusted]);

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
    // Shrinks automatically as real players join: the host originally planned for
    // `plannedTotal` players total, so fewer AI are needed the more humans show up.
    const effectiveAiCount = Math.max(0, plannedTotal - players.length);
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

        {isHost && effectiveAiCount > 0 && (
          <div style={{ fontSize: 11, color: C.ivoryDim }}>+ {effectiveAiCount} KI {effectiveAiCount === 1 ? "wird" : "werden"} beim Start ergänzt</div>
        )}
        {isHost ? (
          <button onClick={() => act("startGame", { aiCount: effectiveAiCount, edition: room?.edition ?? "classic" })} disabled={loading || players.length + effectiveAiCount < 2}
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
            <button onClick={() => act("nextRound")} disabled={loading} style={{ ...goldBtn(), padding: "12px 28px", opacity: loading ? 0.5 : 1, cursor: loading ? "default" : "pointer" }}>
              {loading ? "…" : `Weiter → Runde ${room.round + 1}`}
            </button>
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
            setPassedRainbow7(true); // stays closed until the server confirms via realtime
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

    // Witch pending swap - show inline between table and my pill
    // (handled inline, not as overlay)

    return null;
  };

  // ── Chat Panel ──
  // Plain JSX (NOT a nested component) so typing doesn't remount the input and close the keyboard
  const chatPanel = (
    <div style={{
      position: "fixed" as const, right: 0, top: 0, bottom: 0, zIndex: 150,
      width: "min(340px, 92vw)",
      background: "rgba(10, 30, 18, 0.97)", borderLeft: `1px solid ${C.glassBorder}`,
      display: "flex", flexDirection: "column" as const,
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${C.glassBorder}` }}>
        <div style={{ ...cinzel, fontSize: 14, color: C.gold }}>💬 Chat</div>
        <button onClick={() => setShowChat(false)} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 20 }}>✕</button>
      </div>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto" as const, padding: "10px 12px", display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {chatMessages.length === 0 && (
          <div style={{ fontSize: 12, color: C.ivoryDim, textAlign: "center" as const, marginTop: 20 }}>Noch keine Nachrichten</div>
        )}
        {chatMessages.map((m: any) => {
          const mine = m.user_id === session.user.id;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              {!mine && <div style={{ fontSize: 9, color: C.gold, marginBottom: 2, ...cinzel }}>{m.username}</div>}
              <div style={{
                background: mine ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.08)",
                border: `1px solid ${mine ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.12)"}`,
                borderRadius: mine ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                padding: "7px 11px", fontSize: 14, color: "#fff",
                wordBreak: "break-word" as const, lineHeight: 1.35,
              }}>{m.text}</div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>
      {/* Input */}
      <div style={{ display: "flex", gap: 8, padding: "8px 10px 12px" }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") sendChat(); }}
          placeholder="Nachricht…"
          style={{
            flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 20, color: "#fff", padding: "9px 14px", fontSize: 14, outline: "none",
          }}
        />
        <button onClick={sendChat} disabled={!chatInput.trim()}
          style={{ ...goldBtn(), padding: "9px 16px", borderRadius: 20, opacity: chatInput.trim() ? 1 : 0.4 }}>➤</button>
      </div>
    </div>
  );

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
                <tr style={{ background: "rgba(38,48,41,0.4)" }}>
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
                  <tr style={{ background: "rgba(38,48,41,0.2)", borderBottom: `1px solid ${C.glassBorder}` }}>
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
  const isChoosingTrump = room.phase === "choosingTrump" && isMyTurn;
  const isChoosingWerewolf = room.phase === "choosingWerewolf" && isMyTurn;
  // !witchSwapped: room.pending_witch still shows me as pending locally until
  // the realtime update confirming the swap arrives - see witchSwapped useEffect.
  const pendingWitchForMe = room?.pending_witch === effectiveMyIdx && !witchSwapped;
  // Same reasoning as pendingWitchForMe, for the 9¾ adjustment - see rainbow9Adjusted useEffect.
  const pendingRainbow9ForMe = room?.pending_rainbow9 === effectiveMyIdx && !rainbow9Adjusted;
  const isPlaying = room.phase === "playing" && isMyTurn && !loading;
  const seats = getSeatPositions(players, effectiveMyIdx);

  return (
    <div style={{
      height: "100dvh", width: "100%", overflow: "hidden", position: "relative" as const,
      background: C.bgDark,
    }}>
      {/* Status bar safe-area strip - matches table color */}
      <div style={{
        position: "absolute" as const, top: 0, left: 0, right: 0, height: "env(safe-area-inset-top)",
        background: "#101713", zIndex: 16,
      }} />

      {/* Table - fills below safe area */}
      <div style={{
        position: "absolute" as const, top: "env(safe-area-inset-top)", left: 0, right: 0, bottom: 0,
      }}>

      {/* Table surface: Mischton wood-grain (radial base + grain streaks + fine noise + vignette) */}
      <div style={{
        position: "absolute" as const, inset: 0, pointerEvents: "none" as const,
        background: "radial-gradient(ellipse at 50% 35%, #3b4a41 0%, #232e28 55%, #101713 100%)",
      }} />
      <div style={{
        position: "absolute" as const, inset: 0, pointerEvents: "none" as const,
        backgroundImage: "repeating-linear-gradient(89deg, rgba(0,0,0,0.16) 0px, transparent 2px, transparent 30px, rgba(255,255,255,0.05) 33px, transparent 36px, transparent 70px), repeating-linear-gradient(91deg, rgba(0,0,0,0.10) 0px, transparent 1px, transparent 55px, rgba(255,255,255,0.03) 57px, transparent 60px, transparent 118px)",
      }} />
      <div style={{
        position: "absolute" as const, inset: 0, pointerEvents: "none" as const, opacity: 0.5, mixBlendMode: "overlay" as const,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.12 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }} />
      <div style={{
        position: "absolute" as const, inset: 0, pointerEvents: "none" as const,
        background: "radial-gradient(ellipse at 50% 40%, transparent 0%, transparent 45%, rgba(0,0,0,0.38) 100%)",
      }} />

      {/* Header - floats over table */}
      <div style={{
        position: "absolute" as const, top: 0, left: 0, right: 0, zIndex: 15,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 12px 6px 12px",
        background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%)",
      }}>
        <div style={{ ...cinzel, fontSize: "clamp(10px,1.8vmin,18px)", color: "rgba(255,255,255,0.65)" }}>RUNDE {room.round}/{room.max_rounds}</div>
        <div style={{ ...cinzel, fontSize: "clamp(13px,2.5vmin,22px)", color: C.gold, letterSpacing: "clamp(2px,0.5vmin,6px)" }}>🧙 WIZARD</div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <button onClick={() => setShowLog(v => !v)} style={{ ...goldBtn(showLog), padding: "4px 7px", fontSize: 11 }} title="Log">📜</button>
          <button onClick={() => setShowChat(v => !v)} style={{ ...goldBtn(showChat), padding: "4px 7px", fontSize: 11, position: "relative" as const }} title="Chat">
            💬
            {unreadCount > 0 && (
              <span style={{
                position: "absolute" as const, top: -6, right: -6,
                background: "#C0392B", color: "#fff", borderRadius: 10,
                fontSize: 9, fontWeight: 700, padding: "1px 5px", minWidth: 16,
              }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>
          <button onClick={() => setShowScoresheet(true)} style={{ ...goldBtn(false), padding: "4px 7px", fontSize: 11 }} title="Spielblatt">📋</button>
          <button onClick={() => { if (confirm("Spiel verlassen?")) onLeave(); }} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 11, padding: "4px 7px", borderRadius: 6 }}>✕</button>
        </div>
      </div>

      {/* Full screen table with seated players */}
      {(() => {
        const n = players.length;

        const seatPos = (position: string): React.CSSProperties => {
          switch (position) {
            case "top":         return { top: "clamp(78px,11vh,140px)", left: "50%", transform: "translateX(-50%)" };
            case "top-left":    return { top: "clamp(78px,11vh,140px)", left: "22%", transform: "translateX(-50%)" };
            case "top-right":   return { top: "clamp(78px,11vh,140px)", left: "78%", transform: "translateX(-50%)" };
            case "left":        return { top: "46%", left: "3%",  transform: "translateY(-50%)" };
            case "right":       return { top: "46%", left: "97%", transform: "translate(-100%,-50%)" };
            default:            return { top: "clamp(78px,13vh,96px)", left: "50%", transform: "translateX(-50%)" };
          }
        };

        const isIndianPoker = room.round === 1;

        const PlayerSeat = ({ p, position }: { p: any; position: string }) => {
          const isActive = room.current_player === p.player_index;
          const hasBid = p.bid !== null;
          const count = Array.isArray(p.hand) ? p.hand.length : 0;
          const hasPlayed = trick.some((t:any) => t.playerIndex === p.player_index);
          const isStatic = position === "static";
          const isMe = p.player_index === effectiveMyIdx;
          const visibleCard = isIndianPoker && !isMe && Array.isArray(p.hand) && p.hand.length > 0 ? p.hand[0] : null;
          return (
            <div style={{
              position: isStatic ? "relative" as const : "absolute" as const,
              ...(isStatic ? {} : seatPos(position)), zIndex: 5,
              display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4,
            }}>
              {/* Indian Poker: show this opponent's card visibly above their pill */}
              {visibleCard && (
                <CardView card={visibleCard} small />
              )}
              <div style={{
                background: isActive ? `linear-gradient(135deg, rgba(38,48,41,0.96), rgba(58,75,64,0.92))` : "rgba(5,10,20,0.88)",
                border: `${isActive ? "2px" : "1px"} solid ${isActive ? C.gold : "rgba(201,168,76,0.3)"}`,
                boxShadow: isActive ? `0 0 22px ${C.gold}88` : "0 2px 8px rgba(0,0,0,0.5)",
                borderRadius: 10, padding: "5px 9px", minWidth: "clamp(72px,12vmin,150px)",
                transition: "all 0.3s ease",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 10 }}>{p.is_ai ? "🤖" : "👤"}</span>
                <span style={{ ...cinzel, fontSize: "clamp(9px,1.6vmin,16px)", color: isActive ? C.gold : "#fff", fontWeight: 700, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis", maxWidth: "clamp(70px,10vmin,120px)" }}>
                  {p.ai_name}
                </span>
                {hasPlayed && <span style={{ fontSize: 9, color: C.gold, marginLeft: "auto" }}>✓</span>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                <span style={{ ...cinzel, fontSize: "clamp(11px,2vmin,18px)", color: "#F4D03F", fontWeight: 700 }}>{p.score}</span>
                {hasBid ? (
                  <span style={{ ...cinzel, fontSize: "clamp(9px,1.5vmin,15px)", color: p.tricks_won === p.bid ? C.success : p.tricks_won > p.bid ? C.error : "rgba(255,255,255,0.7)" }}>
                    {p.tricks_won}/{p.bid}
                  </span>
                ) : room.phase === "bidding" ? (
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>…</span>
                ) : null}
                {p.player_index !== effectiveMyIdx && <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginLeft: "auto" }}>🂠{count}</span>}
              </div>
              </div>
            </div>
          );
        };

        return (
          <>
            {/* All opponent seats positioned around the table */}
            {seats.filter((s:any) => s.position !== "bottom").map((s:any) => (
              <PlayerSeat key={s.player.id} p={s.player} position={s.position} />
            ))}

            {/* Trumpf - always visible, fixed corner */}
            {room.trump_card && (() => {
              // These trump cards have no natural suit of their own - the dealer
              // picks one instead, shown as a badge/letter since the card itself
              // can't display it.
              const trumpHasChosenSuit = room.trump_card.type === "wizard" ||
                ["wizardfool", "vampire", "rainbow9", "dragon", "rainbow7"].includes(room.trump_card.specialType);
              return (
              <div style={{ position: "absolute" as const, bottom: "26%", left: "clamp(10px,3vw,40px)", textAlign: "center", zIndex: 4 }}>
                <div style={{ position: "relative" as const, display: "inline-block" }}>
                  {room.trump_suit && trumpHasChosenSuit && (
                    <div style={{
                      position: "absolute" as const, top: -10, left: "50%", transform: "translateX(-50%)",
                      background: SUIT_COLORS[room.trump_suit as keyof typeof SUIT_COLORS],
                      color: "#fff", borderRadius: 20, padding: "2px 8px",
                      fontSize: "clamp(8px,1.2vmin,12px)", fontWeight: 700, ...cinzel,
                      whiteSpace: "nowrap" as const, zIndex: 5,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                    }}>
                      {SUIT_SYMBOLS[room.trump_suit as keyof typeof SUIT_SYMBOLS]}
                    </div>
                  )}
                  <CardView card={room.trump_card} werewolfSuit={room.werewolf_suit} />
                </div>
                <div style={{ ...cinzel, fontSize: "clamp(7px,1vmin,10px)", color: C.gold, marginTop: 3 }}>TRUMPF</div>
                {room.trump_suit && !trumpHasChosenSuit && (
                  <div style={{ color: SUIT_COLORS[room.trump_suit as keyof typeof SUIT_COLORS], fontSize: "clamp(10px,1.5vmin,14px)", fontWeight: 700 }}>{SUIT_SYMBOLS[room.trump_suit as keyof typeof SUIT_SYMBOLS]}</div>
                )}
                {room.werewolf_suit && <div style={{ color: SUIT_COLORS[room.werewolf_suit as keyof typeof SUIT_COLORS], fontSize: "clamp(10px,1.5vmin,14px)" }}>🐺 {SUIT_SYMBOLS[room.werewolf_suit as keyof typeof SUIT_SYMBOLS]}</div>}
              </div>
              );
            })()}

            {/* Trick cards - center of table, positional */}
            <div style={{ position: "absolute" as const, top: "44%", left: "50%", transform: "translate(-50%,-50%)", width: "60%", height: "26%", zIndex: 3 }}>
              {trick.length === 0 && room.phase === "playing" && (
                <div style={{ position: "absolute" as const, top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "center", whiteSpace: "nowrap" as const }}>
                  {players[room.current_player]?.ai_name} beginnt…
                </div>
              )}

              {trick.map((t: any) => {
                const offset = (t.playerIndex - effectiveMyIdx + n) % n;
                const isMe = offset === 0;
                let pos: React.CSSProperties = {};
                if (n <= 3) {
                  if (isMe)            pos = { bottom: "0%",  left: "50%", transform: "translateX(-50%)" };
                  else if (offset===1) pos = { top: "0%",    left: "30%", transform: "translateX(-50%)" };
                  else                 pos = { top: "0%",    left: "70%", transform: "translateX(-50%)" };
                } else if (n === 4) {
                  if (isMe)            pos = { bottom: "0%",  left: "50%", transform: "translateX(-50%)" };
                  else if (offset===1) pos = { top: "50%",   left: "0%",  transform: "translateY(-50%)" };
                  else if (offset===2) pos = { top: "0%",    left: "50%", transform: "translateX(-50%)" };
                  else                 pos = { top: "50%",   right: "0%", transform: "translateY(-50%)" };
                } else if (n === 5) {
                  if (isMe)            pos = { bottom: "0%",  left: "50%", transform: "translateX(-50%)" };
                  else if (offset===1) pos = { top: "50%",   left: "0%",  transform: "translateY(-50%)" };
                  else if (offset===2) pos = { top: "0%",    left: "25%", transform: "translateX(-50%)" };
                  else if (offset===3) pos = { top: "0%",    left: "75%", transform: "translateX(-50%)" };
                  else                 pos = { top: "50%",   right: "0%", transform: "translateY(-50%)" };
                } else {
                  if (isMe)            pos = { bottom: "0%",  left: "50%", transform: "translateX(-50%)" };
                  else if (offset===1) pos = { top: "50%",   left: "0%",  transform: "translateY(-50%)" };
                  else if (offset===2) pos = { top: "0%",    left: "25%", transform: "translateX(-50%)" };
                  else if (offset===3) pos = { top: "0%",    left: "50%", transform: "translateX(-50%)" };
                  else if (offset===4) pos = { top: "0%",    left: "75%", transform: "translateX(-50%)" };
                  else                 pos = { top: "50%",   right: "0%", transform: "translateY(-50%)" };
                }
                return (
                  <div key={t.playerIndex} style={{ position: "absolute" as const, textAlign: "center", ...pos }}>
                    <div style={{ fontSize: 8, color: isMe ? C.gold : "rgba(255,255,255,0.6)", marginBottom: 2, ...cinzel }}>
                      {isMe ? "Du" : players[t.playerIndex]?.ai_name}
                    </div>
                    <CardView card={t.card} />
                    {t.card.specialType === "wizardfool" && (
                      <div style={{ ...cinzel, fontSize: 7, marginTop: 2, color: t.card.type === "wizard" ? C.gold : "#95A5A6" }}>
                        {t.card.type === "wizard" ? "🧙 Zauberer" : "🃏 Narr"}
                      </div>
                    )}
                    {(t.card.specialType === "rainbow7" || t.card.specialType === "rainbow9") && t.card.suit && (
                      <div style={{ ...cinzel, fontSize: "clamp(10px,1.5vmin,14px)", fontWeight: 700, marginTop: 2, color: SUIT_COLORS[t.card.suit as keyof typeof SUIT_COLORS] }}>
                        {SUIT_SYMBOLS[t.card.suit as keyof typeof SUIT_SYMBOLS]}
                      </div>
                    )}
                  </div>
                );
              })}

              {room.phase === "trickEnd" && room.last_trick_winner !== null && (
                <div style={{ position: "absolute" as const, bottom: -28, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
                  <div style={{ ...cinzel, fontSize: 11, color: C.gold, background: "rgba(0,0,0,0.75)", padding: "3px 10px", borderRadius: 8, textShadow: `0 0 10px ${C.gold}`, whiteSpace: "nowrap" as const }}>
                    ✓ {players[room.last_trick_winner]?.ai_name} gewinnt!
                  </div>
                </div>
              )}
            </div>

          </>
        );
      })()}

      {/* Bottom UI stack - my seat, turn indicator, hand - all in one flex flow, never overlapping */}
      <div style={{
        position: "absolute" as const, bottom: 0, left: 0, right: 0, zIndex: 10,
        display: "flex", flexDirection: "column" as const, alignItems: "center",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        background: "transparent",
      }}>
        {/* My seat pill - standalone markup, not absolutely positioned */}
        {(() => {
          const mySeat = seats.find((s:any) => s.position === "bottom");
          if (!mySeat) return null;
          const p = mySeat.player;
          const isActive = room.current_player === p.player_index;
          const hasBid = p.bid !== null;
          const hasPlayed = trick.some((t:any) => t.playerIndex === p.player_index);
          return (
            <div style={{
              marginBottom: 4,
              background: isActive ? `linear-gradient(135deg, rgba(38,48,41,0.96), rgba(58,75,64,0.92))` : "rgba(5,10,20,0.88)",
              border: `${isActive ? "2px" : "1px"} solid ${isActive ? C.gold : "rgba(201,168,76,0.3)"}`,
              boxShadow: isActive ? `0 0 22px ${C.gold}88` : "0 2px 8px rgba(0,0,0,0.5)",
              borderRadius: 10, padding: "5px 9px", minWidth: "clamp(72px,12vmin,150px)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2, justifyContent: "center" }}>
                <span style={{ fontSize: 10 }}>👤</span>
                <span style={{ ...cinzel, fontSize: "clamp(9px,1.6vmin,16px)", color: isActive ? C.gold : "#fff", fontWeight: 700, whiteSpace: "nowrap" as const }}>
                  {p.ai_name}
                </span>
                {hasPlayed && <span style={{ fontSize: 9, color: C.gold }}>✓</span>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "baseline", justifyContent: "center" }}>
                <span style={{ ...cinzel, fontSize: "clamp(11px,2vmin,18px)", color: "#F4D03F", fontWeight: 700 }}>{p.score}</span>
                {hasBid ? (
                  <span style={{ ...cinzel, fontSize: "clamp(9px,1.5vmin,15px)", color: p.tricks_won === p.bid ? C.success : p.tricks_won > p.bid ? C.error : "rgba(255,255,255,0.7)" }}>
                    {p.tricks_won}/{p.bid}
                  </span>
                ) : room.phase === "bidding" ? (
                  <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>…</span>
                ) : null}
              </div>
            </div>
          );
        })()}

        {/* Turn indicator */}
        <div style={{ textAlign: "center", marginBottom: 6, minHeight: 22 }}>
          <span style={{
            ...cinzel,
            fontSize: isPlaying ? "clamp(10px,2vmin,18px)" : "clamp(8px,1.5vmin,14px)",
            color: isPlaying ? "#FFE566" : "rgba(255,255,255,0.45)",
            letterSpacing: 1,
            padding: isPlaying ? "5px 16px" : "0",
            background: isPlaying ? `linear-gradient(135deg, rgba(38,48,41,0.9), rgba(58,75,64,0.8))` : "transparent",
            borderRadius: isPlaying ? 16 : 0,
            border: isPlaying ? `1.5px solid ${C.gold}` : "none",
            boxShadow: isPlaying ? `0 0 12px rgba(201,168,76,0.4)` : "none",
          }}>
            {isPlaying ? "✦ DU BIST DRAN ✦" : room.phase === "playing" ? `⏳ ${players[room.current_player]?.ai_name} ist dran` : ""}
          </span>
        </div>

        <div style={{ display: "flex", gap: "clamp(3px,1vw,6px)", flexWrap: "nowrap", justifyContent: myHand.length > 6 ? "flex-start" : "center", overflowX: "auto", alignSelf: "stretch", width: "100%", maxWidth: "100vw", minWidth: 0, boxSizing: "border-box" as const, padding: "0 8px 8px", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {myHand.map((card: any) => (
            <CardView key={card.id} card={card}
              selected={selected === card.id}
              disabled={!isPlaying}
              faceDown={room.round === 1}
              onClick={isPlaying ? () => setSelected(card.id === selected ? null : card.id) : undefined}
            />
          ))}
        </div>
        {room.round === 1 && (
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <span style={{ ...cinzel, fontSize: "clamp(8px,1.5vmin,14px)", color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>
              🔮 Indianer-Poker: Deine Karte bleibt verdeckt
            </span>
          </div>
        )}
        {isPlaying && selected && (
          <div style={{ textAlign: "center", marginTop: 6 }}>
            <button onClick={() => {
              const card = myHand.find((c:any) => c.id === selected);
              if (card?.specialType === "wizardfool") {
                setSpecialAction({ type: "wizardfool", cardId: selected });
                setSelected(null);
              } else if (card?.specialType === "rainbow7") {
                setSpecialAction({ type: "rainbow7suit", cardId: selected });
                setSelected(null);
              } else if (card?.specialType === "rainbow9") {
                setSpecialAction({ type: "rainbow9suit", cardId: selected });
                setSelected(null);
              } else {
                act("playCard", { cardId: selected });
                setSelected(null);
              }
            }} style={{ ...goldBtn(), padding: "9px 28px", fontSize: 13 }}>
              Karte ausspielen
            </button>
          </div>
        )}
      </div>

      {/* ── Modal overlays: Bidding, Trump, Werewolf, 9¾, Witch ── */}
      {(isBidding || isChoosingTrump || isChoosingWerewolf ||
        (room.phase === "bidding" && !isMyTurn) ||
        (room.phase === "choosingWerewolf" && !isMyTurn) ||
        pendingRainbow9ForMe ||
        pendingWitchForMe ||
        specialAction?.type === "witchGive" ||
        room.phase === "witchReveal") && (
        modalMinimized ? (
          <button onClick={() => setModalMinimized(false)} style={{
            position: "absolute" as const, top: "max(40px, env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", zIndex: 35,
            ...goldBtn(true), padding: "8px 18px", fontSize: 12, display: "flex", alignItems: "center", gap: 6,
            boxShadow: `0 0 20px rgba(201,168,76,0.5)`, animation: "pulse 2s infinite",
          }}>
            ⬆ {isBidding ? "Jetzt bieten"
              : isChoosingTrump ? "Trumpf wählen"
              : isChoosingWerewolf ? "Stichfarbe wählen"
              : pendingRainbow9ForMe ? "9¾ – Vorhersage anpassen"
              : pendingWitchForMe ? "Hexe – Karte tauschen"
              : specialAction?.type === "witchGive" ? "Hexe – Karte abgeben"
              : room.phase === "witchReveal" ? "Tausch-Ergebnis ansehen"
              : "Aktion erforderlich"}
          </button>
        ) : (
        <div style={{
          position: "absolute" as const, inset: 0, zIndex: 30,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div style={{
            background: "rgba(8,12,20,0.97)", border: `2px solid ${C.gold}`, borderRadius: 16,
            padding: "36px 24px 20px 24px", textAlign: "center", width: "min(360px,92vw)",
            boxShadow: `0 0 40px rgba(201,168,76,0.3)`, maxHeight: "80vh", overflowY: "auto",
            position: "relative" as const,
          }}>
            <button onClick={() => setModalMinimized(true)} style={{
              position: "absolute" as const, top: 8, right: 8, background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)",
              borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", zIndex: 2,
            }} title="Tisch & Handkarten ansehen">
              👁 Tisch ansehen
            </button>
            {isBidding && <>
              <div style={{ ...cinzel, fontSize: 13, color: C.gold, letterSpacing: 1, marginBottom: 10 }}>
                WIE VIELE STICHE? (0–{room.round})
              </div>
              {dealerForbidden !== null && (
                <div style={{ color: "#F7DC6F", fontSize: 11, marginBottom: 10, background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 6, padding: "6px 10px" }}>
                  ⚠ Stichzwang: {dealerForbidden} ist verboten
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, justifyContent: "center" }}>
                {Array.from({ length: room.round + 1 }, (_, i) => (
                  <button key={i} onClick={() => act("bid", { bid: i })} disabled={i === dealerForbidden}
                    style={{ ...goldBtn(i !== dealerForbidden), padding: "12px 18px", fontSize: 19, opacity: i === dealerForbidden ? 0.2 : 1, minWidth: 50 }}>
                    {i}
                  </button>
                ))}
              </div>
            </>}

            {isChoosingTrump && <>
              <div style={{ ...cinzel, fontSize: 13, color: C.gold, marginBottom: 12 }}>TRUMPFFARBE WÄHLEN</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {SUITS.map(s => <button key={s} onClick={() => act("chooseTrump", { suit: s })} style={{ background: `${SUIT_COLORS[s]}33`, border: `2px solid ${SUIT_COLORS[s]}`, borderRadius: 8, color: SUIT_COLORS[s], fontSize: 22, fontWeight: 700, padding: "10px 14px", cursor: "pointer", ...cinzel }}>{SUIT_SYMBOLS[s]}</button>)}
              </div>
            </>}

            {isChoosingWerewolf && <>
              <div style={{ fontSize: 22, marginBottom: 4 }}>🐺</div>
              <div style={{ ...cinzel, fontSize: 13, color: C.gold, marginBottom: 12 }}>STICHFARBE WÄHLEN</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {SUITS.map(s => <button key={s} onClick={() => act("chooseWerewolf", { suit: s })} style={{ background: `${SUIT_COLORS[s]}33`, border: `2px solid ${SUIT_COLORS[s]}`, borderRadius: 8, color: SUIT_COLORS[s], fontSize: 22, fontWeight: 700, padding: "10px 14px", cursor: "pointer", ...cinzel }}>{SUIT_SYMBOLS[s]}</button>)}
              </div>
            </>}

            {room.phase === "bidding" && !isMyTurn && !isBidding && (
              <div style={{ ...cinzel, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                ⏳ <span style={{ color: C.gold }}>{players[room.current_player]?.ai_name}</span> bietet…
              </div>
            )}
            {room.phase === "choosingWerewolf" && !isMyTurn && !isChoosingWerewolf && (
              <div style={{ ...cinzel, fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                🐺 <span style={{ color: C.gold }}>{players[room.current_player]?.ai_name}</span> wählt Stichfarbe…
              </div>
            )}

            {/* 9¾ Adjust */}
            {pendingRainbow9ForMe && (() => {
              const currentBid = me?.bid ?? 0;
              const tricksWon = me?.tricks_won ?? 0;
              const canDecrease = currentBid > 0 && tricksWon !== currentBid;
              return (
                <>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🚂</div>
                  <div style={{ ...cinzel, fontSize: 13, color: "#AED6F1", marginBottom: 6 }}>
                    GLEIS 9¾ – VORHERSAGE ANPASSEN (Pflicht)
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 12 }}>
                    Aktuell: <span style={{ color: C.gold, fontWeight: 700 }}>{currentBid}</span>
                    {tricksWon === currentBid && <span style={{ color: "#F7DC6F", display: "block", fontSize: 11 }}>⚠ Du bist im Ziel – nur +1 möglich</span>}
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                    {canDecrease && (
                      <button onClick={() => { act("rainbow9Adjust", { adjust: -1 }); setRainbow9Adjusted(true); }}
                        style={{ ...goldBtn(false), flex: 1, padding: "12px 0", fontSize: 17 }}>
                        −1 → {currentBid - 1}
                      </button>
                    )}
                    <button onClick={() => { act("rainbow9Adjust", { adjust: 1 }); setRainbow9Adjusted(true); }}
                      style={{ ...goldBtn(), flex: 1, padding: "12px 0", fontSize: 17 }}>
                      +1 → {currentBid + 1}
                    </button>
                  </div>
                </>
              );
            })()}

            {/* Hexe – Karte tauschen */}
            {pendingWitchForMe && (() => {
              const trickCards = (room.last_trick_cards ?? []).filter((t:any) =>
                t.card.specialType !== "witch" && t.card.id !== "witch"
              );
              return (
                <>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>🧹</div>
                  <div style={{ ...cinzel, fontSize: 12, color: "#E74C3C", marginBottom: 8 }}>
                    BELLATRIX – KARTE AUS DEM STICH NEHMEN
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 10 }}>
                    Wähle eine Karte die du auf deine Hand nimmst (dafür gibst du eine ab)
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" as const }}>
                    {trickCards.map((t:any) => (
                      <div key={t.card.id} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>{players[t.playerIndex]?.ai_name}</div>
                        <CardView card={t.card} onClick={() => {
                          setSpecialAction({ type: "witchGive", takeCardId: t.card.id });
                        }} />
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* Hexe – Karte abgeben (Step 2) */}
            {specialAction?.type === "witchGive" && (
              <>
                <div style={{ ...cinzel, fontSize: 12, color: "#E74C3C", marginBottom: 8 }}>
                  WELCHE KARTE GIBST DU AB?
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" as const }}>
                  {myHand.map((c:any) => (
                    <CardView key={c.id} card={c} onClick={() => {
                      act("playSpecial", {
                        specialAction: "witch",
                        takeCardId: specialAction.takeCardId,
                        giveCardId: c.id
                      });
                      setWitchSwapped(true); // stays closed until the server confirms via realtime
                      setSpecialAction(null);
                    }} />
                  ))}
                </div>
              </>
            )}

            {/* Hexe Tausch Anzeige */}
            {room.phase === "witchReveal" && room.witch_swap && (
              <>
                <div style={{ fontSize: 18, marginBottom: 6 }}>🧹</div>
                <div style={{ ...cinzel, fontSize: 12, color: "#E74C3C", marginBottom: 10 }}>
                  {room.witch_swap.playerName} hat getauscht
                </div>
                <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>ABGEGEBEN</div>
                    <CardView card={room.witch_swap.gave} small />
                  </div>
                  <div style={{ fontSize: 20, color: C.gold }}>⇄</div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>GENOMMEN</div>
                    <CardView card={room.witch_swap.took} small />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        )
      )}

      {showScoresheet && <Scoresheet />}
      {showChat && chatPanel}
      <SpecialOverlay />

      {/* Error Toast */}
      {error && (
        <div onClick={() => setError("")} style={{ position: "absolute" as const, top: "max(50px, env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", background: `${C.error}EE`, color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 13, zIndex: 100, ...cinzel, cursor: "pointer", whiteSpace: "nowrap" as const, maxWidth: "90vw", textAlign: "center" }}>
          {error} <span style={{ opacity: 0.7, fontSize: 11 }}>✕</span>
        </div>
      )}

      {/* Log */}
      <div ref={logRef} className="log-panel" style={{ ...glass({ padding: 8 }), fontSize: "var(--text-xs)", color: C.ivoryDim, display: showLog ? "block" : "none", position: "absolute" as const, zIndex: 20 }}>
        {log.map((l: string, i: number) => (
          <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid rgba(201,168,76,0.06)" }}>{l}</div>
        ))}
      </div>
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Always show loading max 2 seconds
    const timeout = setTimeout(() => setLoading(false), 2000);

    try {
      const isPWA = window.matchMedia("(display-mode: standalone)").matches
        || (window.navigator as any).standalone === true;

      if (isPWA) {
        // PWA: restore existing session
        supabase.auth.getSession().then(({ data }) => {
          setSession(data.session);
          setLoading(false);
          clearTimeout(timeout);
        }).catch(() => { setLoading(false); clearTimeout(timeout); });
      } else {
        // Browser: never restore session, always show login
        setLoading(false);
        clearTimeout(timeout);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
        const pwa = window.matchMedia("(display-mode: standalone)").matches
          || (window.navigator as any).standalone === true;
        if (pwa) setSession(s);
        else if (s) setSession(s); // just logged in
      });

      return () => { subscription.unsubscribe(); clearTimeout(timeout); };
    } catch {
      setLoading(false);
      clearTimeout(timeout);
    }
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bgDark, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
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
