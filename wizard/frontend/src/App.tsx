import { useState, useEffect, useCallback, useRef } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase, callGameAction } from "./supabase";
import { CardView } from "./CardView";
import { SUITS, SUIT_SYMBOLS, SUIT_COLORS, forbiddenDealerBid } from "./types";
import { IconX, IconArrowLeft, IconSettings, IconUsers, IconUserPlus, IconHome, IconClipboardList, IconMessageCircle, IconHistory, IconCards, IconTrophy, IconStar, IconTarget, IconPercent, IconLayers, IconBarChart, IconMic, IconMicOff, IconBell, IconBellOff, IconGripVertical, IconPencil } from "./Icons";
import { WizardArt, DragonArt, FairyArt, WitchArt, WerewolfArt, VampireArt, BombArt, Rainbow7Art, Rainbow9Art, WizardFoolArt } from "./CardArt";

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

// Corner-radius scale - every rounded element in the app draws from this
// instead of a one-off number, so "how rounded" stays a handful of
// deliberate choices rather than per-component guesswork.
const RADIUS = { sm: 8, md: 12, lg: 16, pill: 999 };

// ─── Shared Styles ────────────────────────────────────────────────────────────
const cinzel: React.CSSProperties = { fontFamily: "'Cinzel', serif" };

const glass = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: "rgba(10,16,28,0.92)",
  backdropFilter: "blur(12px)",
  border: `1px solid rgba(201,168,76,0.35)`,
  borderRadius: RADIUS.md,
  ...extra,
});

const goldBtn = (active = true): React.CSSProperties => ({
  fontFamily: "'Inter', sans-serif",
  background: active ? `linear-gradient(135deg, ${C.accent}, ${C.accentLight})` : "rgba(255,255,255,0.05)",
  color: active ? C.goldLight : C.ivoryDim,
  border: "none",
  borderRadius: RADIUS.lg,
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
  display: "flex", gap: 2, background: "rgba(255,255,255,0.05)", borderRadius: RADIUS.pill, padding: 3,
};
const segBtn = (active: boolean): React.CSSProperties => ({
  flex: 1, textAlign: "center", padding: "10px 0", borderRadius: RADIUS.pill,
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
  flex: 1, background: "rgba(255,255,255,0.045)", border: "none", borderRadius: RADIUS.lg,
  padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
  fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 12, color: C.ivoryDim, cursor: "pointer",
  WebkitTapHighlightColor: "transparent", touchAction: "manipulation", minHeight: 44,
  userSelect: "none", WebkitUserSelect: "none",
};

const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.3)",
  border: `1px solid ${C.glassBorder}`,
  borderRadius: RADIUS.sm,
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

// A small fanned pile of face-down mini cards next to a player's seat pill -
// like the real-table habit of laying won tricks face-down in front of you
// so everyone can see the count at a glance, instead of only a "2/3" text
// ratio. Caps at 5 fanned cards (a round can run up to 20 tricks); beyond
// that only the badge number keeps climbing. The badge itself carries the
// bid comparison (green=hit, red=busted, gold=still in progress) since the
// fan alone no longer shows the bid the way the old "2/3" text did.
function TrickPile({ tricksWon, bid }: { tricksWon: number; bid: number | null }) {
  if (bid === null) return null;
  const hit = tricksWon === bid, bust = tricksWon > bid;
  // Before the first trick there's nothing to fan out yet, but the Ansage
  // itself still needs to stay visible - that's the whole point of showing
  // it - so this falls back to the old "0/3" text instead of going blank.
  if (tricksWon === 0) {
    return (
      <span style={{ ...cinzel, fontSize: "clamp(9px,1.5vmin,15px)", color: hit ? C.success : bust ? C.error : "rgba(255,255,255,0.7)" }}>
        {tricksWon}/{bid}
      </span>
    );
  }
  const shown = Math.min(tricksWon, 5);
  const badgeColor = hit ? C.success : bust ? C.error : C.gold;
  const CARD_W = 12, OFFSET = 6.5, SPREAD = 22;
  return (
    <div style={{ position: "relative", height: 19, width: CARD_W + (shown - 1) * OFFSET + 5, flexShrink: 0 }}>
      {Array.from({ length: shown }, (_, i) => {
        const t = shown > 1 ? i / (shown - 1) - 0.5 : 0;
        const rot = t * SPREAD;
        return (
          <svg key={i} viewBox="0 0 44 66" style={{
            position: "absolute", left: i * OFFSET, bottom: 0, width: CARD_W, height: 18,
            transformOrigin: "bottom center", transform: `rotate(${rot}deg)`,
            filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.55))",
          }}>
            <rect width="44" height="66" rx="5" fill={C.bgDark} />
            <rect x="2" y="2" width="40" height="62" rx="4" fill="none" stroke="rgba(201,168,76,0.35)" strokeWidth="1.5" />
            <text x="22" y="39" textAnchor="middle" fontSize="20" fill="rgba(201,168,76,0.35)">⚡</text>
          </svg>
        );
      })}
      <span style={{
        position: "absolute", top: -5, right: -3,
        background: badgeColor, color: "#0A0F08", ...cinzel, fontWeight: 700,
        fontSize: 8.5, width: 12, height: 12, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
      }}>{tricksWon}</span>
    </div>
  );
}

// ─── "Rechenblock" Paper Design Tokens ─────────────────────────────────────
// The manual scoring feature replaces a physical paper scoresheet, so it
// gets its own warm, hand-ruled parchment skin instead of the app's usual
// dark fantasy theme - scoped ONLY to ManualScoreboardScreen/ManualGameSetup/
// ManualPlayerSlot/ManualGamePlay below, never used elsewhere.
const PAPER = {
  bg: "#EAE0C4",
  panel: "#F8F1DC",
  panelAlt: "#F1E7C9",
  ink: "#3B2A16",
  inkDim: "#8A7350",
  line: "rgba(90,68,38,0.3)",
  lineFaint: "rgba(90,68,38,0.14)",
  gold: "#A6772C",
  goldDeep: "#8A5E1F",
  goldLight: "#C99A44",
  danger: "#A23A2E",
  success: "#3D7A45",
  shadow: "rgba(59,42,22,0.28)",
};

const paperHand: React.CSSProperties = { fontFamily: "'Shadows Into Light', cursive" };

// Fine paper grain, tinted toward the ink-brown rather than neutral gray so it
// reads as texture instead of TV static - reused on every paper surface below.
const PAPER_GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.23  0 0 0 0 0.16  0 0 0 0 0.08  0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const paperBg: React.CSSProperties = {
  minHeight: "100dvh",
  backgroundColor: PAPER.bg,
  backgroundImage: [
    "radial-gradient(ellipse at 15% 8%, rgba(255,252,240,0.55), transparent 55%)",
    "radial-gradient(ellipse at 88% 92%, rgba(110,82,45,0.14), transparent 55%)",
    `repeating-linear-gradient(${PAPER.lineFaint} 0, ${PAPER.lineFaint} 1px, transparent 1px, transparent 30px)`,
  ].join(", "),
};

const paperPanel = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  backgroundColor: PAPER.panel,
  backgroundImage: [
    "radial-gradient(120% 90% at 12% 0%, rgba(255,255,255,0.5), transparent 60%)",
    PAPER_GRAIN,
  ].join(", "),
  backgroundBlendMode: "normal, multiply",
  border: `1px solid ${PAPER.line}`,
  borderRadius: RADIUS.md,
  boxShadow: `0 6px 18px ${PAPER.shadow}, inset 0 0 0 1px rgba(255,255,255,0.35)`,
  ...extra,
});

const paperBtn = (active = true): React.CSSProperties => ({
  fontFamily: "'Inter', sans-serif",
  background: active ? `linear-gradient(135deg, ${PAPER.gold}, ${PAPER.goldDeep})` : "rgba(59,42,22,0.07)",
  color: active ? "#FBF4E2" : PAPER.inkDim,
  border: active ? "none" : `1px solid ${PAPER.line}`,
  borderRadius: RADIUS.lg,
  padding: "clamp(8px,2vw,12px) clamp(12px,3vw,20px)",
  fontSize: "clamp(13px, 2vw, 15px)",
  cursor: "pointer",
  letterSpacing: "0.01em",
  transition: "all 0.2s",
  fontWeight: 700,
  boxShadow: active ? `0 4px 12px ${PAPER.shadow}` : "none",
  WebkitTapHighlightColor: "transparent",
  touchAction: "manipulation",
  minHeight: 44,
  userSelect: "none",
  WebkitUserSelect: "none",
});

const paperInput: React.CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  border: `1px solid ${PAPER.line}`,
  borderRadius: RADIUS.sm,
  color: PAPER.ink,
  padding: "clamp(10px,2vw,14px) clamp(12px,3vw,18px)",
  fontSize: 16,
  width: "100%",
  outline: "none",
  fontFamily: "Inter, sans-serif",
  WebkitAppearance: "none",
};

// Small framed portrait, keeping the card art's native 100:140 aspect ratio
// (no cropping) - used wherever we'd otherwise reach for an emoji as a stand-in
// for actual game content (mascot, special-card icons), since emoji render
// inconsistently across platforms and this app already has hand-drawn art for
// nearly all of it.
function CardIcon({ children, size = 28, style }: { children: React.ReactNode; size?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: size, height: size * 1.4, borderRadius: size * 0.16,
      overflow: "hidden", flexShrink: 0,
      boxShadow: `0 0 0 1.5px ${C.glassBorder}, 0 4px 14px rgba(0,0,0,0.4)`,
      ...style,
    }}>
      {children}
    </div>
  );
}

function WizardMascot({ size = 48, style }: { size?: number; style?: React.CSSProperties }) {
  return <CardIcon size={size} style={style}><WizardArt index={0} /></CardIcon>;
}

// Deterministic color per user/name so the same person always gets the same
// fallback color, without needing to store or coordinate anything.
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 42%, 32%)`;
}

// Uploaded profile picture, or a generated initial-on-a-color-circle fallback
// when none is set (also covers AI players, who never have one).
function Avatar({ userId, username, avatarUrl, size = 28 }: { userId: string; username: string; avatarUrl?: string | null; size?: number }) {
  const ring = { boxShadow: `0 0 0 1.5px ${C.glassBorder}`, flexShrink: 0 as const };
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", ...ring }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: avatarColor(userId || username), color: "rgba(255,255,255,0.9)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: size * 0.42,
      ...ring,
    }}>
      {(username || "?").trim().charAt(0).toUpperCase()}
    </div>
  );
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
      <WizardMascot size={30} />
      <div style={{ flex: 1 }}>
        <div style={{ ...cinzel, fontSize: 13, color: C.gold }}>Als App installieren</div>
        <div style={{ fontSize: 11, color: C.ivoryDim, marginTop: 2 }}>Wizzo direkt vom Homescreen starten</div>
      </div>
      <button onClick={() => { prompt?.prompt(); setShow(false); }} style={{ ...goldBtn(), padding: "7px 14px", fontSize: 12 }}>Installieren</button>
      <button onClick={() => setShow(false)} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", padding: 4, display: "flex" }}><IconX size={18} /></button>
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
    <div style={{ ...tableStyle, justifyContent: "center", gap: 24 }} className="fade-in">
      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <WizardMascot size={56} style={{ margin: "0 auto 10px" }} />
        <div style={{ ...cinzel, fontSize: "clamp(32px,5vw,52px)", fontWeight: 700, color: C.gold, letterSpacing: "clamp(6px,1.5vw,12px)", textShadow: `0 0 40px ${C.accent}` }}>WIZZO</div>
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
          opacity: loading ? 0.5 : 1,
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

// ─── Push Notifications ("Du bist dran") ──────────────────────────────────────
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function subscribeToPush(userId: string): Promise<{ ok: boolean; error?: string }> {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { ok: false, error: "Push ist nicht konfiguriert" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "Dein Browser unterstützt keine Benachrichtigungen" };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "Berechtigung verweigert" };
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  }, { onConflict: "user_id,endpoint" });
  if (error) return { ok: false, error: "Speichern fehlgeschlagen" };
  return { ok: true };
}

async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
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

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("profiles").select("avatar_url").eq("id", session.user.id).single()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
  }, [session.user.id]);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const pushSupported = "serviceWorker" in navigator && "PushManager" in window && !!import.meta.env.VITE_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!pushSupported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushEnabled(!!sub))
      .catch(() => {});
  }, [pushSupported]);

  async function togglePush() {
    setPushBusy(true); setPushMsg(null);
    if (pushEnabled) {
      await unsubscribeFromPush(session.user.id);
      setPushEnabled(false);
    } else {
      const res = await subscribeToPush(session.user.id);
      if (res.ok) setPushEnabled(true);
      else setPushMsg({ text: res.error ?? "Fehlgeschlagen", ok: false });
    }
    setPushBusy(false);
  }

  async function processAvatarImage(file: File): Promise<Blob> {
    const img = await createImageBitmap(file);
    const size = Math.min(img.width, img.height);
    const sx = (img.width - size) / 2, sy = (img.height - size) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/jpeg", 0.85));
  }

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) { setAvatarMsg({ text: "Bitte ein Bild auswählen", ok: false }); return; }
    setAvatarUploading(true); setAvatarMsg(null);
    try {
      const blob = await processAvatarImage(file);
      const path = `${session.user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so the new image shows immediately instead of the old one cached at the same URL.
      const bustedUrl = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: bustedUrl }).eq("id", session.user.id);
      if (dbErr) throw dbErr;
      setAvatarUrl(bustedUrl);
      setAvatarMsg({ text: "Profilbild gespeichert ✓", ok: true });
    } catch {
      setAvatarMsg({ text: "Upload fehlgeschlagen", ok: false });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function removeAvatar() {
    setAvatarUploading(true); setAvatarMsg(null);
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", session.user.id);
    setAvatarUrl(null);
    setAvatarUploading(false);
  }

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
    { label: "Spiele", value: stats.games_played ?? 0, icon: <IconCards size={18} /> },
    { label: "Siege", value: stats.games_won ?? 0, icon: <IconTrophy size={18} /> },
    { label: "Ø Punkte", value: stats.avg_score ?? 0, icon: <IconStar size={16} /> },
    { label: "Ø Platz", value: stats.avg_placement ?? "–", icon: <IconTarget size={18} /> },
    { label: "Trefferquote", value: `${stats.bid_accuracy_pct ?? 0}%`, icon: <IconPercent size={18} /> },
    { label: "Stiche geboten", value: stats.total_bid ?? 0, icon: <IconLayers size={18} /> },
  ] : [];

  return (
    <div style={{ ...tableStyle, justifyContent: "flex-start", gap: 14, paddingTop: "max(20px, env(safe-area-inset-top))" }} className="fade-in">
      <button onClick={onBack} style={{ alignSelf: "flex-start", background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 13, padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><IconArrowLeft size={13} /> Zurück</button>
      <div style={{ ...cinzel, fontSize: "clamp(16px,5vw,22px)", color: C.gold, display: "flex", alignItems: "center", gap: 8 }}><IconSettings size={17} /> Profil</div>

      {/* Avatar */}
      <div style={{ ...glass({ padding: 20 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ ...cinzel, fontSize: 11, color: C.gold, letterSpacing: 2, alignSelf: "flex-start" }}>PROFILBILD</div>
        <Avatar userId={session.user.id} username={username} avatarUrl={avatarUrl} size={72} />
        <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }} />
        <div style={{ display: "flex", gap: 8, width: "100%" }}>
          <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
            style={{ ...goldBtn(), flex: 1, padding: "10px 0", fontSize: 13, opacity: avatarUploading ? 0.5 : 1 }}>
            {avatarUploading ? "…" : "Bild hochladen"}
          </button>
          {avatarUrl && (
            <button onClick={removeAvatar} disabled={avatarUploading}
              style={{ ...goldBtn(false), padding: "10px 16px", fontSize: 13, opacity: avatarUploading ? 0.5 : 1 }}>
              Entfernen
            </button>
          )}
        </div>
        {avatarMsg && <div style={{ fontSize: 12, color: avatarMsg.ok ? C.success : C.error, textAlign: "center" }}>{avatarMsg.text}</div>}
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

      {/* Push notifications */}
      {pushSupported && (
        <div style={{ ...glass({ padding: 20 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...cinzel, fontSize: 11, color: C.gold, letterSpacing: 2 }}>BENACHRICHTIGUNGEN</div>
          <button onClick={togglePush} disabled={pushBusy}
            style={{ ...goldBtn(pushEnabled), padding: "10px 0", fontSize: 13, opacity: pushBusy ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {pushEnabled ? <IconBellOff size={14} /> : <IconBell size={14} />}
            {pushBusy ? "…" : pushEnabled ? "Deaktivieren" : "\"Du bist dran\" aktivieren"}
          </button>
          {pushMsg && <div style={{ fontSize: 12, color: pushMsg.ok ? C.success : "#FF8080", textAlign: "center" }}>{pushMsg.text}</div>}
        </div>
      )}

      {/* Stats */}
      <div style={{ ...glass({ padding: 20 }), width: "min(420px, 92vw)" }}>
        <div style={{ ...cinzel, fontSize: 11, color: C.gold, letterSpacing: 2, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><IconBarChart size={13} /> STATISTIKEN</div>
        {!stats ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ ...glass({ padding: "10px 8px" }), textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div className="skeleton" style={{ width: 18, height: 18, borderRadius: 5 }} />
                <div className="skeleton" style={{ width: 28, height: 16, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: 40, height: 8, borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {statItems.map(({ label, value, icon }) => (
              <div key={label} style={{ ...glass({ padding: "10px 8px" }), textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", color: C.gold, marginBottom: 4 }}>{icon}</div>
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

// ─── Friends Screen ───────────────────────────────────────────────────────────
function FriendsScreen({ session, onClose, onlineUserIds }: { session: Session; onClose: () => void; onlineUserIds: Set<string> }) {
  const uid = session.user.id;
  const [rows, setRows] = useState<any[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; username: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    supabase.from("friends").select("*").or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
      .then(async ({ data }) => {
        const list = data ?? [];
        setRows(list);
        const otherIds = Array.from(new Set(list.map((f: any) => f.requester_id === uid ? f.addressee_id : f.requester_id)));
        if (otherIds.length) {
          const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", otherIds);
          const map: Record<string, string> = {};
          const avMap: Record<string, string | null> = {};
          (profs ?? []).forEach((p: any) => { map[p.id] = p.username; avMap[p.id] = p.avatar_url; });
          setNames(map);
          setAvatars(avMap);
        }
      });
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  const accepted = (rows ?? []).filter((f: any) => f.status === "accepted");
  const incoming = (rows ?? []).filter((f: any) => f.status === "pending" && f.addressee_id === uid);
  const outgoing = (rows ?? []).filter((f: any) => f.status === "pending" && f.requester_id === uid);

  async function search() {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase.from("profiles").select("id, username").ilike("username", `%${q}%`).neq("id", uid).limit(8);
    setSearching(false);
    setResults(data ?? []);
  }

  function statusFor(id: string): "friend" | "incoming" | "outgoing" | "none" {
    if (accepted.some((f: any) => f.requester_id === id || f.addressee_id === id)) return "friend";
    if (incoming.some((f: any) => f.requester_id === id)) return "incoming";
    if (outgoing.some((f: any) => f.addressee_id === id)) return "outgoing";
    return "none";
  }

  async function sendRequest(id: string) {
    setBusyId(id); setMsg(null);
    const { error } = await supabase.from("friends").insert({ requester_id: uid, addressee_id: id, status: "pending" });
    setBusyId(null);
    if (error) setMsg({ text: "Anfrage konnte nicht gesendet werden", ok: false });
    else { setMsg({ text: "Anfrage gesendet ✓", ok: true }); load(); }
  }

  async function accept(rowId: string) {
    setBusyId(rowId);
    await supabase.from("friends").update({ status: "accepted" }).eq("id", rowId);
    setBusyId(null);
    load();
  }

  async function remove(rowId: string) {
    setBusyId(rowId);
    await supabase.from("friends").delete().eq("id", rowId);
    setBusyId(null);
    load();
  }

  return (
    <div style={{
      position: "fixed" as const, right: 0, top: 0, bottom: 0, zIndex: 150,
      width: "min(300px, 88vw)",
      background: "rgba(16,22,26,0.97)", borderLeft: `1px solid ${C.glassBorder}`,
      display: "flex", flexDirection: "column" as const,
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
    }} className="slide-in-right">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${C.glassBorder}` }}>
        <div style={{ ...cinzel, fontSize: 14, color: C.gold, display: "flex", alignItems: "center", gap: 6 }}><IconUsers size={15} /> Freunde</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", display: "flex" }}><IconX size={18} /></button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" as const, padding: "14px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Search / add */}
        <div style={{ ...glass({ padding: 16 }), display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...cinzel, fontSize: 10, color: C.gold, letterSpacing: 2 }}>FREUND HINZUFÜGEN</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Username suchen"
              style={{ ...inputStyle, fontSize: 13, padding: "8px 10px" }} onKeyDown={e => e.key === "Enter" && search()} />
            <button onClick={search} disabled={searching || query.trim().length < 2}
              style={{ ...goldBtn(), padding: "0 14px", fontSize: 12, opacity: searching || query.trim().length < 2 ? 0.5 : 1 }}>
              Suchen
            </button>
          </div>
          {results.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {results.map(r => {
                const st = statusFor(r.id);
                return (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, flexWrap: "wrap" as const }}>
                    <div style={{ ...cinzel, fontSize: 13, color: C.ivory, flex: 1 }}>{r.username}</div>
                    {st === "friend" && <span style={{ fontSize: 10, color: C.ivoryDim }}>Schon Freunde</span>}
                    {st === "incoming" && <span style={{ fontSize: 10, color: C.ivoryDim }}>Hat dich angefragt</span>}
                    {st === "outgoing" && <span style={{ fontSize: 10, color: C.ivoryDim }}>Gesendet</span>}
                    {st === "none" && (
                      <button onClick={() => sendRequest(r.id)} disabled={busyId === r.id}
                        style={{ ...goldBtn(), padding: "4px 10px", fontSize: 10, opacity: busyId === r.id ? 0.5 : 1 }}>
                        Anfragen
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {msg && <div style={{ fontSize: 11, color: msg.ok ? C.success : C.error, textAlign: "center" }}>{msg.text}</div>}
        </div>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div style={{ ...glass({ padding: 16 }), display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ ...cinzel, fontSize: 10, color: C.gold, letterSpacing: 2 }}>ANFRAGEN ({incoming.length})</div>
            {incoming.map((f: any) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                <Avatar userId={f.requester_id} username={names[f.requester_id] ?? "?"} avatarUrl={avatars[f.requester_id]} size={24} />
                <div style={{ ...cinzel, fontSize: 13, color: C.ivory, flex: 1 }}>{names[f.requester_id] ?? "…"}</div>
                <button onClick={() => accept(f.id)} disabled={busyId === f.id} style={{ ...goldBtn(), padding: "4px 10px", fontSize: 10 }}>Annehmen</button>
                <button onClick={() => remove(f.id)} disabled={busyId === f.id} style={{ ...goldBtn(false), padding: "4px 10px", fontSize: 10 }}>Ablehnen</button>
              </div>
            ))}
          </div>
        )}

        {/* Friends list */}
        <div style={{ ...glass({ padding: 16 }), display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ ...cinzel, fontSize: 10, color: C.gold, letterSpacing: 2 }}>MEINE FREUNDE ({accepted.length})</div>
          {rows === null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <div className="skeleton" style={{ width: 7, height: 7, borderRadius: "50%" }} />
                  <div className="skeleton" style={{ width: `${90 - i * 18}px`, height: 13, borderRadius: 4, flex: "none" }} />
                </div>
              ))}
            </div>
          ) : accepted.length === 0 ? (
            <div style={{ fontSize: 11, color: C.ivoryDim, textAlign: "center", padding: 8 }}>Noch keine Freunde – oben nach Usernamen suchen</div>
          ) : accepted.map((f: any) => {
            const otherId = f.requester_id === uid ? f.addressee_id : f.requester_id;
            return (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid rgba(201,168,76,0.10)" }}>
                <div style={{ position: "relative" as const }}>
                  <Avatar userId={otherId} username={names[otherId] ?? "?"} avatarUrl={avatars[otherId]} size={26} />
                  <span style={{ position: "absolute" as const, bottom: -1, right: -1, width: 8, height: 8, borderRadius: "50%", background: onlineUserIds.has(otherId) ? C.success : "rgba(255,255,255,0.25)", boxShadow: `0 0 0 2px ${C.bgDark}` }} title={onlineUserIds.has(otherId) ? "Online" : "Offline"} />
                </div>
                <div style={{ ...cinzel, fontSize: 13, color: C.ivory, flex: 1 }}>{names[otherId] ?? "…"}</div>
                <button onClick={() => remove(f.id)} disabled={busyId === f.id}
                  style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 10 }}>Entfernen</button>
              </div>
            );
          })}
          {outgoing.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 9, color: C.ivoryDim, letterSpacing: 1 }}>AUSSTEHEND</div>
              {outgoing.map((f: any) => (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 12, color: C.ivoryDim, flex: 1 }}>{names[f.addressee_id] ?? "…"}</div>
                  <button onClick={() => remove(f.id)} disabled={busyId === f.id}
                    style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 10 }}>Zurückziehen</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Manual Scoreboard ("Rechenblock") ─────────────────────────────────────────
// Digital replacement for the paper scoresheet: tracks a game played at the
// table (not through the app's own dealing/bidding/trick logic). One host
// enters bid/tricks per round for everyone; linked players' results feed
// into the normal game_stats/user_stats via the finishManualGame action.

// Running total after each round, not just one final sum at the bottom -
// that's how a real paper Rechenblock works: every round's own line shows
// the score-so-far. Shared by the Rechenblock's live/finished-game tables
// and the online game_rooms Spielblatt, which all need the identical scan.
function computeRunningTotals(playerIndexes: number[], rounds: { round: number; results?: any[] }[]): Record<number, Record<number, number>> {
  const out: Record<number, Record<number, number>> = {};
  const acc: Record<number, number> = {};
  for (const pi of playerIndexes) acc[pi] = 0;
  for (const r of rounds) {
    for (const pi of playerIndexes) {
      const e = (r.results ?? []).find((x: any) => x.playerIndex === pi);
      if (e) acc[pi] += e.delta ?? 0;
    }
    out[r.round] = { ...acc };
  }
  return out;
}

// A small deterministic tilt per cell, not random per render - the same
// round+player always tilts the same way instead of jittering on re-render,
// so a saved round's entries look hand-written rather than animated.
function handTilt(seed: number): number {
  return ((seed * 37) % 7 - 3) * 0.35;
}

function ManualPlayerSlot({ index, slot, excludeIds, onChange }: {
  index: number;
  slot: { userId: string | null; name: string };
  excludeIds: string[];
  onChange: (slot: { userId: string | null; name: string }) => void;
}) {
  const [query, setQuery] = useState(slot.userId ? "" : slot.name);
  const [results, setResults] = useState<{ id: string; username: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (slot.userId || q.length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      supabase.from("profiles").select("id, username").ilike("username", `%${q}%`).limit(6)
        .then(({ data }) => setResults((data ?? []).filter(p => !excludeIds.includes(p.id))));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, slot.userId, excludeIds.join(",")]);

  if (slot.userId) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, ...paperPanel({ padding: "9px 12px" }), background: PAPER.panelAlt }}>
        <div style={{ flex: 1, fontSize: 13, color: PAPER.ink }}>{slot.name}</div>
        <button onClick={() => { onChange({ userId: null, name: "" }); setQuery(""); }}
          style={{ background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", display: "flex" }}><IconX size={14} /></button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange({ userId: null, name: e.target.value }); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={`Spieler ${index + 1}: Name eintragen oder Nutzer suchen…`}
        style={{ ...paperInput, fontSize: 13, padding: "9px 12px" }}
        maxLength={24}
      />
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 10, ...paperPanel({ padding: 4 }), maxHeight: 170, overflowY: "auto" }}>
          {results.map(r => (
            <button key={r.id} onMouseDown={() => { onChange({ userId: r.id, name: r.username }); setQuery(r.username); setOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: PAPER.ink, padding: "8px 10px", fontSize: 13, cursor: "pointer", borderRadius: 6 }}>
              {r.username}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ManualGameSetup({ uid, pastGames, onCreated, onViewGame }: { uid: string; pastGames: any[]; onCreated: () => void; onViewGame: (game: any) => void }) {
  // Two steps: pick who's playing, then fix the seating/turn order they'll
  // actually sit in - that order drives dealer rotation and bidding order
  // once the game starts, so it needs to be explicit rather than just
  // "whatever order you happened to type names in".
  const [stage, setStage] = useState<"roster" | "order">("roster");
  const [edition, setEdition] = useState<"classic" | "anniversary">("classic");
  const [count, setCount] = useState(4);
  // Stable per-slot ids (independent of array position) so React keeps
  // reusing the same DOM node for a slot as it moves during drag-and-drop -
  // a positional key would make React treat the slot in the DOM as "the
  // same" and just swap its rendered content, which breaks drag continuity.
  const nextId = useRef(4);
  const [slots, setSlots] = useState<{ id: number; userId: string | null; name: string }[]>(
    Array.from({ length: 4 }, (_, i) => ({ id: i, userId: null, name: "" }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function changeCount(n: number) {
    setCount(n);
    setSlots(prev => {
      const next = [...prev];
      while (next.length < n) next.push({ id: nextId.current++, userId: null, name: "" });
      return next.slice(0, n);
    });
  }

  const excludeIds = slots.map(s => s.userId).filter((id): id is string => !!id);

  // Touch-friendly drag-and-drop for the seating-order screen. Native HTML5
  // drag-and-drop (draggable/dragstart/dragover) doesn't work reliably on
  // touch devices, so this uses the Pointer Events API instead, which covers
  // mouse, touch and pen uniformly.
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const dragStartY = useRef(0);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  function startDrag(id: number, e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    setDragId(id);
    setDragOffsetY(0);
  }

  function swapSlots(i: number, j: number) {
    const rowEl = rowRefs.current[j];
    const rowHeight = rowEl ? rowEl.getBoundingClientRect().height + 6 : 0;
    // Compensate the drag origin by the row's natural-position shift so the
    // dragged row's on-screen position stays continuous under the pointer
    // instead of jumping when its index (and therefore its natural flex
    // position) changes underneath it.
    dragStartY.current += (j > i ? 1 : -1) * rowHeight;
    setSlots(prev => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function onDragMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragId === null) return;
    const current = slotsRef.current;
    const idx = current.findIndex(s => s.id === dragId);
    if (idx < 0) return;
    if (e.clientY < dragStartY.current && idx > 0) {
      const aboveEl = rowRefs.current[idx - 1];
      if (aboveEl) {
        const r = aboveEl.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) swapSlots(idx, idx - 1);
      }
    } else if (e.clientY > dragStartY.current && idx < current.length - 1) {
      const belowEl = rowRefs.current[idx + 1];
      if (belowEl) {
        const r = belowEl.getBoundingClientRect();
        if (e.clientY > r.top + r.height / 2) swapSlots(idx, idx + 1);
      }
    }
    let offset = e.clientY - dragStartY.current;
    // Keep the dragged row inside the list's own bounds, even on a fast or
    // overshot drag - otherwise it can visually overlap the screen's header
    // above the list.
    const rowEl = rowRefs.current[idx];
    const listEl = listRef.current;
    if (rowEl && listEl) {
      const rowRect = rowEl.getBoundingClientRect();
      const listRect = listEl.getBoundingClientRect();
      const naturalTop = rowRect.top - dragOffsetY;
      const minOffset = listRect.top - naturalTop;
      const maxOffset = listRect.bottom - rowRect.height - naturalTop;
      offset = Math.min(Math.max(offset, minOffset), maxOffset);
    }
    setDragOffsetY(offset);
  }

  function endDrag() {
    setDragId(null);
    setDragOffsetY(0);
  }

  function goToOrder() {
    setError("");
    const names = slots.map(s => s.name.trim());
    if (names.some(n => !n)) { setError("Bitte für jede Position einen Namen eintragen oder Spieler wählen"); return; }
    setStage("order");
  }

  async function start() {
    setError("");
    setLoading(true);
    const maxRounds = Math.floor(60 / count);
    const { data: game, error: gErr } = await supabase.from("manual_games")
      .insert({ host_id: uid, edition, max_rounds: maxRounds }).select().single();
    if (gErr || !game) { setError("Spiel konnte nicht erstellt werden"); setLoading(false); return; }
    const rows = slots.map((s, i) => ({
      manual_game_id: game.id, player_index: i, user_id: s.userId, display_name: s.name.trim(),
    }));
    const { error: pErr } = await supabase.from("manual_game_players").insert(rows);
    setLoading(false);
    if (pErr) { setError("Spieler konnten nicht gespeichert werden"); await supabase.from("manual_games").delete().eq("id", game.id); return; }
    onCreated();
  }

  if (stage === "order") {
    return (
      <div className="paper-sheet" style={{ ...paperPanel({ padding: 20 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 14 }}>
        <button onClick={() => setStage("roster")} style={{ alignSelf: "flex-start", background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 12, padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><IconArrowLeft size={12} /> Zurück</button>
        <div style={{ ...paperHand, fontSize: 20, color: PAPER.ink }}>Reihenfolge festlegen</div>
        <div style={{ fontSize: 11.5, color: PAPER.inkDim }}>So wie ihr am Tisch sitzt - bestimmt Geber- und Bietreihenfolge. Zum Sortieren ziehen.</div>
        <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {slots.map((s, i) => {
            const isDragging = dragId === s.id;
            return (
              <div key={s.id} ref={el => { rowRefs.current[i] = el; }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, ...paperPanel({ padding: "8px 12px" }),
                  background: PAPER.panelAlt,
                  position: isDragging ? "relative" : undefined,
                  transform: isDragging ? `translateY(${dragOffsetY}px)` : undefined,
                  zIndex: isDragging ? 10 : undefined,
                  boxShadow: isDragging ? `0 10px 26px ${PAPER.shadow}` : undefined,
                }}>
                <span style={{ ...paperHand, fontSize: 15, color: PAPER.gold, minWidth: 16 }}>{i + 1}.</span>
                <span style={{ flex: 1, fontSize: 13, color: PAPER.ink }}>{s.name}</span>
                <div
                  onPointerDown={e => startDrag(s.id, e)}
                  onPointerMove={onDragMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  style={{ touchAction: "none", cursor: isDragging ? "grabbing" : "grab", color: PAPER.inkDim, padding: 4, display: "flex" }}
                >
                  <IconGripVertical size={18} />
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={start} disabled={loading} style={{ ...paperBtn(), width: "100%", padding: "12px 0", fontSize: 14, opacity: loading ? 0.5 : 1 }}>
          {loading ? "…" : "✦ Spiel starten"}
        </button>
        {error && <div style={{ color: PAPER.danger, fontSize: 12, textAlign: "center" }}>{error}</div>}
      </div>
    );
  }

  return (
    <>
      <div className="paper-sheet" style={{ ...paperPanel({ padding: 20 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ ...paperHand, fontSize: 20, color: PAPER.ink }}>Neues Spiel erfassen</div>

        <div>
          <div style={{ ...paperHand, fontSize: 13, color: PAPER.inkDim, letterSpacing: 1, marginBottom: 8 }}>EDITION</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEdition("classic")} style={{ ...paperBtn(edition === "classic"), flex: 1, padding: "8px 0", fontSize: 12 }}>Classic</button>
            <button onClick={() => setEdition("anniversary")} style={{ ...paperBtn(edition === "anniversary"), flex: 1, padding: "8px 0", fontSize: 12 }}>30 Jahre</button>
          </div>
        </div>

        <div>
          <div style={{ ...paperHand, fontSize: 13, color: PAPER.inkDim, letterSpacing: 1, marginBottom: 8 }}>SPIELERANZAHL</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[3, 4, 5, 6].map(n => (
              <button key={n} onClick={() => changeCount(n)} style={{ ...paperBtn(count === n), flex: 1, padding: "8px 0", fontSize: 13 }}>{n}</button>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: PAPER.inkDim, marginTop: 6 }}>{Math.floor(60 / count)} Runden</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ ...paperHand, fontSize: 13, color: PAPER.inkDim, letterSpacing: 1 }}>MITSPIELER</div>
          {slots.map((s, i) => (
            <ManualPlayerSlot key={s.id} index={i} slot={s} excludeIds={excludeIds}
              onChange={v => setSlots(prev => prev.map((p, pi) => pi === i ? { ...p, ...v } : p))} />
          ))}
        </div>

        <button onClick={goToOrder} style={{ ...paperBtn(), width: "100%", padding: "12px 0", fontSize: 14 }}>
          Weiter → Reihenfolge
        </button>
        {error && <div style={{ color: PAPER.danger, fontSize: 12, textAlign: "center" }}>{error}</div>}
      </div>

      {pastGames.length > 0 && (
        <div style={{ ...paperPanel({ padding: 16 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ ...paperHand, fontSize: 13, color: PAPER.inkDim, letterSpacing: 1 }}>FRÜHERE SPIELE</div>
          {pastGames.slice(0, 8).map(g => (
            <button key={g.id} onClick={() => onViewGame(g)}
              style={{ display: "flex", justifyContent: "space-between", width: "100%", background: "none", border: "none", borderTop: `1px solid ${PAPER.lineFaint}`, fontSize: 12, color: PAPER.inkDim, padding: "6px 0", cursor: "pointer", textAlign: "left", font: "inherit" }}>
              <span>{new Date(g.created_at).toLocaleDateString("de-DE")}</span>
              <span>{g.edition === "anniversary" ? "30 Jahre" : "Classic"} · {g.max_rounds} Runden</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ManualGamePlay({ session, game, players, rounds, onChange }: {
  session: Session; game: any; players: any[]; rounds: any[]; onChange: () => void;
}) {
  const currentRoundNum = rounds.length + 1;
  const isDone = currentRoundNum > game.max_rounds;
  // Bids get announced (and locked in) before anyone knows the trick
  // results - matches the real Wizard flow, so this is a two-phase round:
  // first lock in everyone's Ansage (pending_bids), then once the round has
  // actually been played, enter Stiche and finalize together.
  const pendingBids: Record<string, number> | null = game.pending_bids ?? null;
  const [bids, setBids] = useState<Record<number, string>>({});
  const [gots, setGots] = useState<Record<number, string>>({});
  const [locking, setLocking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");
  const [wolkePicking, setWolkePicking] = useState(false);
  const [wolkePlayer, setWolkePlayer] = useState<number | null>(null);
  // Correcting an already-saved round - a mis-tap during entry is otherwise
  // permanent, since Stiche entry auto-saves the instant the last player's
  // is tapped.
  const [editingRound, setEditingRound] = useState<number | null>(null);
  const [editBid, setEditBid] = useState<Record<number, string>>({});
  const [editGot, setEditGot] = useState<Record<number, string>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const dealerIdx = (currentRoundNum - 1) % players.length;
  const dealer = players[dealerIdx];

  useEffect(() => { setBids({}); setGots({}); setError(""); setWolkePicking(false); setWolkePlayer(null); }, [currentRoundNum, !!pendingBids]);

  const runningByRound = computeRunningTotals(players.map(p => p.player_index), rounds);
  const lastRoundNum = rounds.length ? rounds[rounds.length - 1].round : null;
  // Crown the current leader, but only once scores have actually diverged
  // from the 0-0 starting tie.
  const latestTotals = lastRoundNum !== null ? runningByRound[lastRoundNum] : null;
  const maxTotal = latestTotals ? Math.max(0, ...Object.values(latestTotals)) : 0;
  const isLeaderAt = (round: number, playerIndex: number) =>
    round === lastRoundNum && maxTotal > 0 && runningByRound[round]?.[playerIndex] === maxTotal;
  const gotSum = players.reduce((s, p) => s + (Number(gots[p.player_index]) || 0), 0);

  // Bidding proceeds one player at a time, in real turn order (left of the
  // dealer first, dealer last) - matching how bidding actually works at the
  // table and in the online game_rooms flow, instead of everyone filling in
  // a shared row at once.
  const biddingOrder = !isDone && !pendingBids
    ? Array.from({ length: players.length }, (_, i) => players[(dealerIdx + 1 + i) % players.length])
    : [];
  const nextBidder = biddingOrder.find(p => bids[p.player_index] === undefined) ?? null;
  // Recording tricks won happens after the round is played, in normal seat
  // order (not dealer-relative) - at the table you just go around and note
  // each person's tricks, the same order they sit in on screen.
  const nextGoter = !isDone && pendingBids ? players.find(p => gots[p.player_index] === undefined) ?? null : null;
  // Stichzwang: only the dealer (last to bid) faces this - the one total
  // that would make all bids exactly equal the round's trick count.
  const dealerForbiddenBid = nextBidder?.player_index === dealerIdx
    ? (() => {
        const sum = players.reduce((acc, p) => p.player_index === dealerIdx ? acc : acc + (Number(bids[p.player_index]) || 0), 0);
        const f = currentRoundNum - sum;
        return f >= 0 && f <= currentRoundNum ? f : null;
      })()
    : null;

  async function recordBid(playerIndex: number, value: number) {
    const next = { ...bids, [playerIndex]: String(value) };
    setBids(next);
    if (playerIndex !== dealerIdx) return; // more players still to bid
    // Dealer just bid last - everyone's in, lock it in immediately.
    setLocking(true);
    const asObject: Record<string, number> = {};
    for (const p of players) asObject[p.player_index] = Number(next[p.player_index]);
    const { error: bErr } = await supabase.from("manual_games").update({ pending_bids: asObject }).eq("id", game.id);
    setLocking(false);
    if (bErr) { setError("Ansagen konnten nicht gespeichert werden"); return; }
    onChange();
  }

  // Step back to correct a mis-tap, one player at a time - only reaches
  // back through bids/Stiche not yet committed to the server (the dealer's
  // bid locks immediately, and the last Stiche auto-saves the round, so at
  // that point there's nothing local left to undo).
  function undoLastBid() {
    const entered = biddingOrder.filter(p => bids[p.player_index] !== undefined);
    if (entered.length === 0) return;
    const last = entered[entered.length - 1];
    setBids(prev => { const next = { ...prev }; delete next[last.player_index]; return next; });
  }
  function undoLastGot() {
    const entered = players.filter(p => gots[p.player_index] !== undefined);
    if (entered.length === 0) return;
    const last = entered[entered.length - 1];
    setGots(prev => { const next = { ...prev }; delete next[last.player_index]; return next; });
  }

  // Bid displayed/edited for a player once bids are locked in (Phase B) -
  // starts out as whatever was locked, but stays editable: Wolke (9¾)
  // forces the trick winner to raise or lower their Ansage *during* the
  // round, after bids are already locked, so this needs to be changeable
  // right up until the round is finalized, not just before locking.
  function effectiveBid(playerIndex: number): string {
    if (bids[playerIndex] !== undefined) return bids[playerIndex];
    return pendingBids ? String(pendingBids[playerIndex] ?? "") : "";
  }

  // Wolke (9¾): exactly ±1 on the trick winner's already-locked Ansage,
  // never below 0 - guided step buttons instead of a free-text edit, so a
  // typo can't silently produce an invalid adjustment.
  function adjustBid(playerIndex: number, delta: 1 | -1) {
    const current = Number(effectiveBid(playerIndex) || 0);
    const next = Math.max(0, current + delta);
    setBids(prev => ({ ...prev, [playerIndex]: String(next) }));
  }

  async function saveRound(gotsOverride?: Record<number, string>) {
    if (!pendingBids) return;
    const g = gotsOverride ?? gots;
    setError("");
    for (const p of players) {
      if (effectiveBid(p.player_index) === "" || g[p.player_index] === undefined || g[p.player_index] === "") {
        setError("Bitte für jeden Spieler Ansage und Stiche eintragen"); return;
      }
    }
    setSaving(true);
    const results = players.map(p => {
      const bid = Number(effectiveBid(p.player_index));
      const got = Number(g[p.player_index]);
      const delta = bid === got ? 20 + bid * 10 : -Math.abs(bid - got) * 10;
      return { playerIndex: p.player_index, name: p.display_name, bid, got, delta };
    });
    const { error: rErr } = await supabase.from("manual_game_rounds")
      .insert({ manual_game_id: game.id, round: currentRoundNum, results });
    if (rErr) { setSaving(false); setError("Runde konnte nicht gespeichert werden"); return; }
    await supabase.from("manual_games").update({ pending_bids: null }).eq("id", game.id);
    setSaving(false);
    onChange();
  }

  // Tricks won are tapped in one player at a time, same button-picker
  // pattern as the Ansage above, instead of typing numbers into small
  // inputs - once the last player's is tapped, the round saves itself
  // immediately, same auto-advance as the dealer's bid locking in above.
  async function recordGot(playerIndex: number, value: number) {
    const next = { ...gots, [playerIndex]: String(value) };
    setGots(next);
    const stillMissing = players.some(p => next[p.player_index] === undefined || next[p.player_index] === "");
    if (stillMissing) return;
    await saveRound(next);
  }

  async function finish() {
    setFinishing(true);
    const res = await callGameAction("", "finishManualGame", { manualGameId: game.id });
    setFinishing(false);
    if (!res?.ok) { setError(res?.error ?? "Konnte nicht abgeschlossen werden"); return; }
    onChange();
  }

  async function discard() {
    if (!confirm("Dieses Spiel wirklich verwerfen? Alle bisher erfassten Runden gehen verloren.")) return;
    await supabase.from("manual_games").delete().eq("id", game.id);
    onChange();
  }

  function startEditRound(r: any) {
    const eb: Record<number, string> = {};
    const eg: Record<number, string> = {};
    for (const p of players) {
      const e = (r.results ?? []).find((x: any) => x.playerIndex === p.player_index);
      eb[p.player_index] = e ? String(e.bid) : "";
      eg[p.player_index] = e ? String(e.got) : "";
    }
    setEditBid(eb);
    setEditGot(eg);
    setEditError("");
    setEditingRound(r.round);
  }

  function cancelEditRound() {
    setEditingRound(null);
    setEditError("");
  }

  async function saveEditedRound(r: any) {
    setEditError("");
    for (const p of players) {
      if (editBid[p.player_index] === "" || editGot[p.player_index] === undefined || editGot[p.player_index] === "") {
        setEditError("Bitte für jeden Spieler Ansage und Stiche eintragen"); return;
      }
    }
    setEditSaving(true);
    const results = players.map(p => {
      const bid = Number(editBid[p.player_index]);
      const got = Number(editGot[p.player_index]);
      const delta = bid === got ? 20 + bid * 10 : -Math.abs(bid - got) * 10;
      return { playerIndex: p.player_index, name: p.display_name, bid, got, delta };
    });
    const { error: uErr } = await supabase.from("manual_game_rounds").update({ results }).eq("id", r.id);
    setEditSaving(false);
    if (uErr) { setEditError("Runde konnte nicht aktualisiert werden"); return; }
    setEditingRound(null);
    onChange();
  }

  return (
    <>
      <div className="paper-sheet" style={{ ...paperPanel({ padding: 16 }), width: "min(460px, 96vw)", overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ ...paperHand, fontSize: 15, color: PAPER.inkDim, letterSpacing: 0.5 }}>
            {game.edition === "anniversary" ? "30 Jahre" : "Classic"} · Runde {Math.min(currentRoundNum, game.max_rounds)}/{game.max_rounds}
          </div>
          <button onClick={discard} style={{ background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 11 }}>Verwerfen</button>
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%", fontVariantNumeric: "tabular-nums" as const }}>
          <thead>
            <tr>
              <th style={{ padding: "6px 8px", textAlign: "left", color: PAPER.inkDim, fontWeight: 600, fontSize: 10.5, borderBottom: `1.5px solid ${PAPER.line}`, whiteSpace: "nowrap" }}>Runde</th>
              {players.map(p => (
                <th key={p.id} style={{ padding: "6px 8px", textAlign: "right", color: PAPER.inkDim, fontWeight: 600, fontSize: 10.5, borderBottom: `1.5px solid ${PAPER.line}`, whiteSpace: "nowrap" }}>{p.display_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map(r => (
              <tr key={r.round} style={{ background: editingRound === r.round ? PAPER.panelAlt : undefined }}>
                <td style={{ padding: "8px", borderTop: `1px solid ${PAPER.lineFaint}`, fontSize: 12, color: PAPER.ink, whiteSpace: "nowrap" }}>
                  <button onClick={() => editingRound === r.round ? cancelEditRound() : startEditRound(r)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, color: "inherit", font: "inherit" }}>
                    <span style={{ ...paperHand, fontSize: 16, display: "inline-block", transform: `rotate(${handTilt(r.round)}deg)` }}>R{r.round}</span>
                    <IconPencil size={10} style={{ color: PAPER.inkDim }} />
                  </button>
                  <div style={{ fontSize: 9, color: PAPER.inkDim, fontWeight: 400, marginTop: 1 }}>{players[(r.round - 1) % players.length]?.display_name} gibt</div>
                </td>
                {players.map(p => {
                  const e = (r.results ?? []).find((x: any) => x.playerIndex === p.player_index);
                  const total = runningByRound[r.round]?.[p.player_index];
                  const leader = isLeaderAt(r.round, p.player_index);
                  const seed = r.round * 5 + p.player_index;
                  return (
                    <td key={p.id} style={{ padding: "8px", borderTop: `1px solid ${PAPER.lineFaint}`, textAlign: "right", fontSize: 12.5, whiteSpace: "nowrap" }}>
                      {/* Total first, Ansage after it - matches the real paper
                          block's layout (score in the wide column, bid in the
                          narrow one next to it). Written in the "hand" font,
                          same as it'd be scribbled on a real paper block. */}
                      {e && <span style={{ ...paperHand, display: "inline-block", fontSize: 18, color: leader ? PAPER.gold : PAPER.goldDeep, transform: `rotate(${handTilt(seed)}deg)` }}>
                        {total}
                      </span>}
                      <span style={{ ...paperHand, marginLeft: 6, display: "inline-block", fontSize: 15, color: PAPER.inkDim, transform: `rotate(${handTilt(seed + 2)}deg)` }}>{e ? e.bid : "–"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {!isDone && !pendingBids && (
              <tr>
                <td style={{ padding: "8px", background: PAPER.panelAlt, fontSize: 12, color: PAPER.goldDeep, whiteSpace: "nowrap" }}>
                  R{currentRoundNum} ▶
                  <div style={{ fontSize: 9.5, color: PAPER.inkDim, fontWeight: 400, marginTop: 1 }}>{dealer?.display_name} gibt</div>
                </td>
                {players.map(p => {
                  const has = bids[p.player_index] !== undefined;
                  const isNext = nextBidder?.player_index === p.player_index;
                  return (
                    <td key={p.id} style={{ padding: "8px", background: PAPER.panelAlt, textAlign: "right", fontSize: 12.5, whiteSpace: "nowrap" }}>
                      {has
                        ? <span style={{ color: PAPER.ink }}>{bids[p.player_index]}</span>
                        : isNext
                          ? <span style={{ color: PAPER.gold, fontWeight: 700 }}>●</span>
                          : <span style={{ color: PAPER.inkDim }}>…</span>}
                    </td>
                  );
                })}
              </tr>
            )}
            {!isDone && pendingBids && (
              <tr>
                <td style={{ padding: "8px", background: PAPER.panelAlt, fontSize: 12, color: PAPER.goldDeep, whiteSpace: "nowrap" }}>
                  R{currentRoundNum} ▶
                  <div style={{ fontSize: 9.5, color: PAPER.inkDim, fontWeight: 400, marginTop: 1 }}>{dealer?.display_name} gibt</div>
                </td>
                {players.map(p => {
                  const gotEntered = gots[p.player_index] !== undefined;
                  const isNextGoter = nextGoter?.player_index === p.player_index;
                  return (
                    <td key={p.id} style={{ padding: "6px 4px", background: PAPER.panelAlt }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                        {/* Ansage stays editable here (not just plain text) - Wolke (9¾)
                            forces the trick winner to adjust it mid-round, after bids
                            are already locked in above. */}
                        <input type="number" min={0} max={currentRoundNum} value={effectiveBid(p.player_index)}
                          onChange={e => setBids(prev => ({ ...prev, [p.player_index]: e.target.value }))}
                          style={{ ...paperInput, width: 36, padding: "5px 2px", fontSize: 12, textAlign: "center" }} />
                        <span style={{ fontSize: 11.5, color: PAPER.inkDim }}>/</span>
                        {/* Stiche get tapped in below (button picker), not typed here -
                            this just reflects tap status: entered, up next, or waiting. */}
                        <span style={{ fontSize: 12.5, minWidth: 16, textAlign: "center", fontWeight: gotEntered ? 400 : 700, color: gotEntered ? PAPER.ink : isNextGoter ? PAPER.gold : PAPER.inkDim }}>
                          {gotEntered ? gots[p.player_index] : isNextGoter ? "●" : "…"}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
        {editingRound !== null && (() => {
          const r = rounds.find(x => x.round === editingRound);
          if (!r) return null;
          return (
            <div style={{ marginTop: 10, ...paperPanel({ padding: 12 }), background: PAPER.panelAlt }}>
              <div style={{ ...paperHand, fontSize: 14, color: PAPER.goldDeep, marginBottom: 8 }}>Runde {editingRound} korrigieren</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {players.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 12.5, color: PAPER.ink }}>{p.display_name}</span>
                    <input type="number" min={0} max={editingRound} placeholder="Ansage" value={editBid[p.player_index] ?? ""}
                      onChange={e => setEditBid(prev => ({ ...prev, [p.player_index]: e.target.value }))}
                      style={{ ...paperInput, width: 52, padding: "5px 4px", fontSize: 12, textAlign: "center" }} />
                    <span style={{ fontSize: 11.5, color: PAPER.inkDim }}>/</span>
                    <input type="number" min={0} max={editingRound} placeholder="Stiche" value={editGot[p.player_index] ?? ""}
                      onChange={e => setEditGot(prev => ({ ...prev, [p.player_index]: e.target.value }))}
                      style={{ ...paperInput, width: 52, padding: "5px 4px", fontSize: 12, textAlign: "center" }} />
                  </div>
                ))}
              </div>
              {editError && <div style={{ color: PAPER.danger, fontSize: 11, marginTop: 8 }}>{editError}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={cancelEditRound} style={{ ...paperBtn(false), flex: 1, padding: "8px 0", fontSize: 12.5 }}>Abbrechen</button>
                <button onClick={() => saveEditedRound(r)} disabled={editSaving} style={{ ...paperBtn(), flex: 1, padding: "8px 0", fontSize: 12.5, opacity: editSaving ? 0.5 : 1 }}>
                  {editSaving ? "…" : "Speichern"}
                </button>
              </div>
            </div>
          );
        })()}
        {!isDone && pendingBids && nextGoter && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
              <div style={{ ...paperHand, fontSize: 15, color: PAPER.goldDeep }}>
                WIE VIELE STICHE HAT <span style={{ color: PAPER.ink }}>{nextGoter.display_name}</span> GEHOLT? (0–{currentRoundNum})
              </div>
              {players.some(p => gots[p.player_index] !== undefined) && (
                <button onClick={undoLastGot} style={{ background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 11, padding: "2px 0", display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <IconArrowLeft size={11} /> zurück
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {Array.from({ length: currentRoundNum + 1 }, (_, i) => (
                <button key={i} onClick={() => recordGot(nextGoter.player_index, i)} disabled={saving}
                  style={{ ...paperBtn(), padding: "9px 14px", fontSize: 15, opacity: saving ? 0.5 : 1, minWidth: 40 }}>
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}
        {!isDone && !pendingBids && nextBidder && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
              <div style={{ ...paperHand, fontSize: 15, color: PAPER.goldDeep }}>
                WIE VIELE STICHE? (0–{currentRoundNum}) – <span style={{ color: PAPER.ink }}>{nextBidder.display_name}</span>
              </div>
              {biddingOrder.some(p => bids[p.player_index] !== undefined) && (
                <button onClick={undoLastBid} style={{ background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 11, padding: "2px 0", display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                  <IconArrowLeft size={11} /> zurück
                </button>
              )}
            </div>
            {dealerForbiddenBid !== null && (
              <div style={{ color: PAPER.danger, fontSize: 10.5, marginBottom: 8, background: "rgba(162,58,46,0.1)", border: `1px solid rgba(162,58,46,0.35)`, borderRadius: 6, padding: "5px 9px" }}>
                ⚠ Stichzwang: {dealerForbiddenBid} ist verboten
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {Array.from({ length: currentRoundNum + 1 }, (_, i) => (
                <button key={i} onClick={() => recordBid(nextBidder.player_index, i)} disabled={i === dealerForbiddenBid || locking}
                  style={{ ...paperBtn(i !== dealerForbiddenBid), padding: "9px 14px", fontSize: 15, opacity: i === dealerForbiddenBid ? 0.25 : locking ? 0.5 : 1, minWidth: 40 }}>
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}
        {!isDone && pendingBids && currentRoundNum > 1 && gotSum > 0 && gotSum !== currentRoundNum && (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ fontSize: 10.5, color: PAPER.inkDim, textAlign: "right" }}>Summe Stiche ({gotSum}) ≠ Runde ({currentRoundNum}) - bei einer Bombe normal.</div>
          </div>
        )}
        {!isDone && pendingBids && !wolkePicking && (
          <button onClick={() => setWolkePicking(true)} style={{ marginTop: 10, background: "none", border: `1px solid ${PAPER.line}`, borderRadius: RADIUS.sm, color: PAPER.inkDim, cursor: "pointer", fontSize: 11.5, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            🚂 9¾ – Vorhersage anpassen
          </button>
        )}
        {!isDone && pendingBids && wolkePicking && wolkePlayer === null && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: PAPER.inkDim, marginBottom: 6 }}>Wer hat den Stich mit der Wolke gewonnen?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {players.map(p => (
                <button key={p.id} onClick={() => setWolkePlayer(p.player_index)}
                  style={{ ...paperBtn(false), padding: "7px 12px", fontSize: 12 }}>{p.display_name}</button>
              ))}
              <button onClick={() => setWolkePicking(false)} style={{ background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 11.5, padding: "7px 4px" }}>Abbrechen</button>
            </div>
          </div>
        )}
        {!isDone && pendingBids && wolkePicking && wolkePlayer !== null && (() => {
          const p = players.find(pl => pl.player_index === wolkePlayer);
          const current = Number(effectiveBid(wolkePlayer) || 0);
          return (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: PAPER.inkDim, marginBottom: 6 }}>
                <span style={{ color: PAPER.goldDeep }}>{p?.display_name}</span> - aktuelle Ansage: <span style={{ color: PAPER.goldDeep, fontWeight: 700 }}>{current}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { adjustBid(wolkePlayer, -1); setWolkePicking(false); setWolkePlayer(null); }} disabled={current === 0}
                  style={{ ...paperBtn(false), flex: 1, padding: "9px 0", fontSize: 13, opacity: current === 0 ? 0.4 : 1 }}>
                  −1 → {Math.max(0, current - 1)}
                </button>
                <button onClick={() => { adjustBid(wolkePlayer, 1); setWolkePicking(false); setWolkePlayer(null); }}
                  style={{ ...paperBtn(), flex: 1, padding: "9px 0", fontSize: 13 }}>
                  +1 → {current + 1}
                </button>
              </div>
              <button onClick={() => setWolkePlayer(null)} style={{ marginTop: 6, background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 10.5, padding: 0 }}>Anderer Spieler</button>
            </div>
          );
        })()}
      </div>

      {error && <div style={{ color: PAPER.danger, fontSize: 12, textAlign: "center" }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, width: "min(460px, 96vw)" }}>
        {!isDone && pendingBids && (
          <button onClick={() => saveRound()} disabled={saving} style={{ ...paperBtn(), flex: 1, padding: "12px 0", fontSize: 14, opacity: saving ? 0.5 : 1 }}>
            {saving ? "…" : "Runde abschließen"}
          </button>
        )}
        <button onClick={finish} disabled={finishing || rounds.length === 0} style={{ ...paperBtn(isDone), flex: 1, padding: "12px 0", fontSize: 14, opacity: (finishing || rounds.length === 0) ? 0.5 : 1 }}>
          {finishing ? "…" : "🏁 Spiel abschließen"}
        </button>
      </div>
    </>
  );
}

// Read-only round-by-round history for a finished game - tapping into what
// was so far only a summary line ("Classic · 15 Runden") in the past-games
// list. Editing is intentionally not offered here: finishManualGame already
// recorded this game's final scores into game_stats, so changing rounds
// after the fact would desync the two.
function ManualFinishedGameView({ game, onBack }: { game: any; onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from("manual_game_players").select("*").eq("manual_game_id", game.id).order("player_index"),
      supabase.from("manual_game_rounds").select("*").eq("manual_game_id", game.id).order("round"),
    ]).then(([{ data: p }, { data: r }]) => {
      setPlayers(p ?? []);
      setRounds(r ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [game.id]);

  const runningByRound = computeRunningTotals(players.map(p => p.player_index), rounds);
  const lastRoundNum = rounds.length ? rounds[rounds.length - 1].round : null;
  const latestTotals = lastRoundNum !== null ? runningByRound[lastRoundNum] : null;
  const maxTotal = latestTotals ? Math.max(0, ...Object.values(latestTotals)) : 0;
  const isLeaderAt = (round: number, playerIndex: number) =>
    round === lastRoundNum && maxTotal > 0 && runningByRound[round]?.[playerIndex] === maxTotal;

  return (
    <div className="paper-sheet" style={{ ...paperPanel({ padding: 16 }), width: "min(460px, 96vw)", overflowX: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 12, padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><IconArrowLeft size={12} /> Zurück</button>
        <div style={{ ...paperHand, fontSize: 13, color: PAPER.inkDim }}>
          {game.edition === "anniversary" ? "30 Jahre" : "Classic"} · {new Date(game.created_at).toLocaleDateString("de-DE")}
        </div>
      </div>
      {loading ? (
        <div className="skeleton" style={{ width: "100%", height: 120, borderRadius: 8 }} />
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%", fontVariantNumeric: "tabular-nums" as const }}>
          <thead>
            <tr>
              <th style={{ padding: "6px 8px", textAlign: "left", color: PAPER.inkDim, fontWeight: 600, fontSize: 10.5, borderBottom: `1.5px solid ${PAPER.line}`, whiteSpace: "nowrap" }}>Runde</th>
              {players.map(p => (
                <th key={p.id} style={{ padding: "6px 8px", textAlign: "right", color: PAPER.inkDim, fontWeight: 600, fontSize: 10.5, borderBottom: `1.5px solid ${PAPER.line}`, whiteSpace: "nowrap" }}>{p.display_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map(r => (
              <tr key={r.round}>
                <td style={{ padding: "8px", borderTop: `1px solid ${PAPER.lineFaint}`, fontSize: 12, color: PAPER.ink, whiteSpace: "nowrap" }}>
                  <span style={{ ...paperHand, fontSize: 16, display: "inline-block", transform: `rotate(${handTilt(r.round)}deg)` }}>R{r.round}</span>
                  <div style={{ fontSize: 9, color: PAPER.inkDim, fontWeight: 400, marginTop: 1 }}>{players[(r.round - 1) % players.length]?.display_name} gibt</div>
                </td>
                {players.map(p => {
                  const e = (r.results ?? []).find((x: any) => x.playerIndex === p.player_index);
                  const total = runningByRound[r.round]?.[p.player_index];
                  const leader = isLeaderAt(r.round, p.player_index);
                  const seed = r.round * 5 + p.player_index;
                  return (
                    <td key={p.id} style={{ padding: "8px", borderTop: `1px solid ${PAPER.lineFaint}`, textAlign: "right", fontSize: 12.5, whiteSpace: "nowrap" }}>
                      {e && <span style={{ ...paperHand, display: "inline-block", fontSize: 18, color: leader ? PAPER.gold : PAPER.goldDeep, transform: `rotate(${handTilt(seed)}deg)` }}>
                        {total}
                      </span>}
                      <span style={{ ...paperHand, marginLeft: 6, display: "inline-block", fontSize: 15, color: PAPER.inkDim, transform: `rotate(${handTilt(seed + 2)}deg)` }}>{e ? e.bid : "–"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ManualScoreboardScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const uid = session.user.id;
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<any | null>(null);
  const [pastGames, setPastGames] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [viewingGame, setViewingGame] = useState<any | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    supabase.from("manual_games").select("*").eq("host_id", uid).order("created_at", { ascending: false })
      .then(async ({ data }) => {
        const games = data ?? [];
        const active = games.find((g: any) => !g.finished_at) ?? null;
        // "Frühere Spiele" is a history of finished games, not a graveyard of
        // ones that got cut short - "Spiel abschließen" is allowed anytime
        // rounds.length > 0, so an early-ended game still gets finished_at
        // and still counts toward stats, it just doesn't clutter this list
        // unless every round up to max_rounds was actually played.
        const finished = games.filter((g: any) => g.finished_at);
        if (finished.length > 0) {
          const { data: roundRows } = await supabase.from("manual_game_rounds")
            .select("manual_game_id").in("manual_game_id", finished.map((g: any) => g.id));
          const counts: Record<string, number> = {};
          for (const r of roundRows ?? []) counts[r.manual_game_id] = (counts[r.manual_game_id] ?? 0) + 1;
          setPastGames(finished.filter((g: any) => (counts[g.id] ?? 0) >= g.max_rounds));
        } else {
          setPastGames([]);
        }
        setActiveGame(active);
        if (active) {
          const [{ data: p }, { data: r }] = await Promise.all([
            supabase.from("manual_game_players").select("*").eq("manual_game_id", active.id).order("player_index"),
            supabase.from("manual_game_rounds").select("*").eq("manual_game_id", active.id).order("round"),
          ]);
          setPlayers(p ?? []);
          setRounds(r ?? []);
        } else {
          setPlayers([]); setRounds([]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [uid]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{
      ...paperBg, display: "flex", flexDirection: "column", alignItems: "center",
      padding: `max(16px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))`,
      gap: "clamp(8px, 1.5vw, 16px)", justifyContent: "flex-start", paddingTop: "max(20px, env(safe-area-inset-top))",
    }} className="fade-in">
      <button onClick={onBack} style={{ alignSelf: "flex-start", background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 13, padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><IconArrowLeft size={13} /> Zurück</button>
      <div style={{ ...paperHand, fontSize: "clamp(20px,6vw,28px)", color: PAPER.ink, display: "flex", alignItems: "center", gap: 8 }}><IconClipboardList size={17} /> Rechenblock</div>

      {loading ? (
        <div className="skeleton" style={{ width: 200, height: 40, borderRadius: 8 }} />
      ) : viewingGame ? (
        <ManualFinishedGameView game={viewingGame} onBack={() => setViewingGame(null)} />
      ) : activeGame ? (
        <ManualGamePlay session={session} game={activeGame} players={players} rounds={rounds} onChange={load} />
      ) : (
        <ManualGameSetup uid={uid} pastGames={pastGames} onCreated={load} onViewGame={setViewingGame} />
      )}
    </div>
  );
}

// ─── Lobby ────────────────────────────────────────────────────────────────────
function LobbyScreen({ session }: { session: Session }) {
  const [view, setView] = useState<"home" | "create" | "join" | "rules" | "profile" | "scoreboard">("home");
  const [showFriendsPanel, setShowFriendsPanel] = useState(false);
  const [reconnectRoom, setReconnectRoom] = useState<{ roomId: string; code: string; phase: string } | null>(null);

  // Reconnect state now lives on the backend (room_players membership),
  // not in localStorage - this is authoritative for any tab/device the
  // player opens, and the server's inactivity reaper (004_room_cleanup.sql)
  // is what bounds how long a stale membership can hang around.
  const checkReconnect = useCallback(() => {
    supabase.from("room_players")
      .select("room_id, rooms:room_id(id, code, phase, created_at)")
      .eq("user_id", session.user.id)
      .order("created_at", { foreignTable: "rooms", ascending: false })
      .then(({ data }) => {
        const active = (data ?? []).map((r: any) => r.rooms).find((r: any) => r && r.phase !== "gameEnd");
        setReconnectRoom(active ? { roomId: active.id, code: active.code, phase: active.phase } : null);
      });
  }, [session.user.id]);

  useEffect(() => { checkReconnect(); }, [checkReconnect]);
  const [codeInput, setCodeInput] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [edition, setEdition] = useState<"classic"|"anniversary">("classic");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const username = session.user.user_metadata?.username ?? "Spieler";
  // Lebt hier (nicht in GameRoom) und übersteht darum Phasenwechsel innerhalb
  // eines Raums - siehe Kommentar bei useVoiceChat.
  const voice = useVoiceChat(roomId, session);

  // Pending friend requests (badge) + incoming room invites (popup): initial
  // fetch, then live via realtime so they arrive even while sitting idle.
  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const [incomingInvite, setIncomingInvite] = useState<{ id: string; room_code: string; from_username: string } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  useEffect(() => {
    const uid = session.user.id;
    const refreshPendingCount = () => {
      supabase.from("friends").select("id", { count: "exact", head: true })
        .eq("addressee_id", uid).eq("status", "pending")
        .then(({ count }) => setPendingFriendCount(count ?? 0));
    };
    refreshPendingCount();
    supabase.from("room_invites").select("id, room_code, from_username").eq("to_user_id", uid)
      .order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => { if (data && data[0]) setIncomingInvite(data[0]); });

    const ch = supabase.channel(`social:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friends", filter: `addressee_id=eq.${uid}` }, refreshPendingCount)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_invites", filter: `to_user_id=eq.${uid}` }, payload => {
        setIncomingInvite(payload.new as any);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "room_invites", filter: `to_user_id=eq.${uid}` }, payload => {
        setIncomingInvite(prev => prev?.id === (payload.old as any).id ? null : prev);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [session.user.id]);

  // Who's currently online, for the friends list / invite picker. Tracked
  // here (not in FriendsScreen/GameRoom) because LobbyScreen stays mounted
  // for the whole session - joining a room only swaps what it renders.
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const uid = session.user.id;
    const presenceCh = supabase.channel("online-users", { config: { presence: { key: uid } } });
    presenceCh
      .on("presence", { event: "sync" }, () => {
        setOnlineUserIds(new Set(Object.keys(presenceCh.presenceState())));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") presenceCh.track({ at: new Date().toISOString() });
      });
    return () => { supabase.removeChannel(presenceCh); };
  }, [session.user.id]);

  async function createRoom() {
    setLoading(true); setError("");
    const res = await callGameAction("", "createRoom", { username, edition });
    if (!res?.roomId) { setError(res?.error ?? "Fehler"); setLoading(false); return; }
    setRoomId(res.roomId);
    setLoading(false);
  }

  async function joinRoom(codeArg?: string) {
    const code = (codeArg ?? codeInput).toUpperCase();
    setLoading(true); setError("");
    const res = await callGameAction("", "joinRoom", { username, code });
    if (!res?.roomId) { setError(res?.error ?? "Raum nicht gefunden"); setLoading(false); return; }
    setRoomId(res.roomId);
    setLoading(false);
  }

  // Reconnect function
  async function reconnect() {
    if (!reconnectRoom) return;
    setCodeInput(reconnectRoom.code);
    await joinRoom(reconnectRoom.code);
  }

  async function respondToInvite(accept: boolean) {
    if (!incomingInvite) return;
    const invite = incomingInvite;
    setInviteBusy(true);
    await supabase.from("room_invites").delete().eq("id", invite.id);
    setIncomingInvite(null);
    setInviteBusy(false);
    if (accept) {
      if (roomId && !confirm("Aktuelles Spiel verlassen und dem neuen Raum beitreten?")) return;
      await joinRoom(invite.room_code);
    }
  }


  const screen = (() => {
  // ── Rules ──
  if (view === "rules") return (
    <div style={{ ...tableStyle, justifyContent: "flex-start", gap: 14, paddingTop: "max(20px, env(safe-area-inset-top))" }} className="fade-in">
      <button onClick={() => setView("home")} style={{ alignSelf: "flex-start", background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 13, padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><IconArrowLeft size={13} /> Zurück</button>
      <div style={{ ...cinzel, fontSize: "clamp(16px,5vw,22px)", color: C.gold }}>📖 Regeln</div>

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
          [<DragonArt />, "Drache", "Schlägt ALLES – auch Zauberer. Einzige Ausnahme: die Fee gewinnt gegen den Drachen."],
          [<FairyArt />, "Fee", "Verliert immer – außer wenn der Drache gespielt wurde. Dann gewinnt die Fee."],
          [<WitchArt />, "Hexe", "Gilt als Narr. Nach dem Stich darf eine beliebige Karte aus dem Stich gegen eine Handkarte getauscht werden."],
          [<WerewolfArt />, "Werwolf", "Wird als Trumpfkarte aufgedeckt oder beim Ziehen sofort getauscht. Der Spieler wählt die Anspielfarbe für die gesamte Runde."],
          [<VampireArt />, "Vampir", "Kopiert die aufgedeckte Trumpfkarte für diesen einen Stich. Ist Trumpf ein Narr (oder kein Trumpf), wirkt der Vampir als Narr."],
          [<BombArt />, "Bombe", "Annulliert den Stich – niemand gewinnt ihn. Vorhersagen können dadurch aufgehen."],
          [<Rainbow7Art />, "Jongleur (7½)", "Wert 7,5. Spieler wählt die Farbe. Nach dem Stich gibt JEDER Spieler eine Karte seiner Wahl an den linken Nachbarn weiter."],
          [<Rainbow9Art />, "Wolke (9¾)", "Wert 9,75. Spieler wählt die Farbe. Der Stichgewinner muss seine Vorhersage um 1 erhöhen oder senken (nicht unter 0)."],
          [<WizardFoolArt />, "Zauberernarr", "Beim Ausspielen entscheidet der Spieler: Zauberer oder Narr?"],
        ].map(([icon, title, desc], i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(201,168,76,0.08)" }}>
            <CardIcon size={26}>{icon}</CardIcon>
            <div style={{ ...cinzel, fontSize: 11, color: C.gold, minWidth: 90 }}>{title}</div>
            <div style={{ fontSize: 11, color: C.ivoryDim, flex: 1, lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (view === "profile") return <ProfileScreen session={session} onBack={() => setView("home")} />;

  if (view === "scoreboard") return <ManualScoreboardScreen session={session} onBack={() => setView("home")} />;

  if (roomId) return <GameRoom roomId={roomId} session={session} edition={edition} onlineUserIds={onlineUserIds} voice={voice} onLeave={() => { setRoomId(null); checkReconnect(); }} />;

  // compact: skips the big mascot/title hero (only makes sense once, on the
  // home screen) so content-heavy sub-screens like "create" don't push their
  // primary action button below the fold and force scrolling to reach it.
  const HeaderBlock = ({ compact = false, showProfile = true }: { compact?: boolean; showProfile?: boolean } = {}) => (
    <>
      {!compact && (
        <div style={{ textAlign: "center" }}>
          <WizardMascot size={42} style={{ margin: "0 auto 8px" }} />
          <div style={{ ...cinzel, fontSize: "clamp(28px,5vw,48px)", fontWeight: 700, color: C.gold, letterSpacing: "clamp(4px,1vw,10px)" }}>WIZZO</div>
        </div>
      )}
      {showProfile && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowFriendsPanel(true)} style={{ ...goldBtn(false), padding: "6px 14px", fontSize: 12, position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconUsers size={14} /> Freunde
            {pendingFriendCount > 0 && (
              <span style={{ position: "absolute", top: -4, right: -4, background: C.error, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 999, minWidth: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                {pendingFriendCount}
              </span>
            )}
          </button>
          <button onClick={() => setView("profile")} style={{ ...goldBtn(false), padding: "6px 14px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><IconSettings size={14} /> Profil</button>
        </div>
      )}
      <GoldDivider />
    </>
  );

  if (view === "home") return (
    <div style={{ ...tableStyle, justifyContent: "center", gap: 20 }} className="fade-in">
      <HeaderBlock />
      {reconnectRoom && (
        <div style={{ ...glass({ padding: "12px 16px" }), width: "min(320px,92vw)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...cinzel, fontSize: 12, color: C.gold }}>Laufendes Spiel gefunden</div>
            <div style={{ fontSize: 11, color: C.ivoryDim, marginTop: 2 }}>Raum: {reconnectRoom.code}</div>
          </div>
          <button onClick={reconnect} style={{ ...goldBtn(), padding: "8px 14px", fontSize: 12 }}>Zurück</button>
          <button onClick={() => {
            // Only actually leave the room server-side pre-start - mid-game,
            // dismissing the banner is just hiding it, the seat stays reserved.
            if (reconnectRoom.phase === "lobby") callGameAction(reconnectRoom.roomId, "leaveRoom", {});
            setReconnectRoom(null);
          }} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", display: "flex" }}><IconX size={18} /></button>
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
          <button onClick={() => setView("scoreboard")} style={tileBtn}>
            <IconClipboardList size={18} />
            Rechenblock
          </button>
        </div>
      </div>
    </div>
  );

  if (view === "create") return (
    <div style={{ ...tableStyle, justifyContent: "center", gap: 20 }} className="fade-in">
      <HeaderBlock compact showProfile={false} />
      <div style={{ ...glass({ padding: 24 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 16 }}>
        <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 13, textAlign: "left", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><IconArrowLeft size={13} /> Zurück</button>
        <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>Neues Spiel</div>
        {/* Edition */}
        <div>
          <div style={{ ...cinzel, fontSize: 10, color: C.ivoryDim, letterSpacing: 2, marginBottom: 8 }}>EDITION</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEdition("classic")}
              style={{ ...goldBtn(edition === "classic"), flex: 1, padding: "10px 0", fontSize: 12, flexDirection: "column", display: "flex", alignItems: "center", gap: 2 }}>
              <CardIcon size={16}><WizardArt index={0} /></CardIcon>
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

        <button onClick={createRoom} disabled={loading}
          style={{ ...goldBtn(), width: "100%", padding: "13px 0", fontSize: 14, opacity: loading?0.5:1 }}>
          {loading ? "Erstelle Raum…" : "✦ Raum erstellen"}
        </button>
        {error && <div style={{ color: "#FF8080", fontSize: 12, textAlign: "center" }}>{error}</div>}
      </div>
    </div>
  );

  return (
    <div style={{ ...tableStyle, justifyContent: "center", gap: 20 }} className="fade-in">
      <HeaderBlock compact showProfile={false} />
      <div style={{ ...glass({ padding: 24 }), width: "min(420px, 92vw)", display: "flex", flexDirection: "column", gap: 14 }}>
        <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 13, textAlign: "left", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><IconArrowLeft size={13} /> Zurück</button>
        <div style={{ ...cinzel, fontSize: 16, color: C.gold }}>Spiel beitreten</div>
        <input value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())}
          placeholder="XXXXX" maxLength={5}
          style={{ ...inputStyle, textAlign: "center", letterSpacing: 8, fontSize: 22, ...cinzel }}
          onKeyDown={e => e.key==="Enter" && joinRoom()} autoFocus />
        <button onClick={() => joinRoom()} disabled={loading || codeInput.length < 5}
          style={{ ...goldBtn(), width: "100%", padding: "13px 0", fontSize: 14, opacity: loading||codeInput.length<5?0.5:1 }}>
          {loading ? "Suche Raum…" : "⬡ Beitreten"}
        </button>
        {error && <div style={{ color: "#FF8080", fontSize: 12, textAlign: "center" }}>{error}</div>}
      </div>
    </div>
  );
  })();

  return (
    <>
      {incomingInvite && (
        <div style={{ position: "fixed", top: "max(16px, env(safe-area-inset-top))", left: 0, right: 0, margin: "0 auto", zIndex: 200, width: "min(360px, 92vw)" }} className="fade-in">
          <div style={{ ...glass({ padding: 16 }), display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, color: C.ivory }}>
              <span style={{ ...cinzel, color: C.gold }}>{incomingInvite.from_username}</span> lädt dich zu einer Partie ein
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => respondToInvite(true)} disabled={inviteBusy} style={{ ...goldBtn(), flex: 1, padding: "9px 0", fontSize: 13, opacity: inviteBusy ? 0.5 : 1 }}>Beitreten</button>
              <button onClick={() => respondToInvite(false)} disabled={inviteBusy} style={{ ...goldBtn(false), flex: 1, padding: "9px 0", fontSize: 13, opacity: inviteBusy ? 0.5 : 1 }}>Ablehnen</button>
            </div>
          </div>
        </div>
      )}
      {showFriendsPanel && <FriendsScreen session={session} onClose={() => setShowFriendsPanel(false)} onlineUserIds={onlineUserIds} />}
      {screen}
    </>
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
  const [{ data: pub, error: pubErr }, { data: mine, error: mineErr }] = await Promise.all([
    supabase.from("room_players_view").select("*").eq("room_id", roomId).order("player_index"),
    supabase.from("room_players").select("player_index, hand").eq("room_id", roomId).eq("user_id", myUserId).maybeSingle(),
  ]);
  if (!pub || pubErr) return null;
  // A failed own-row fetch must not silently fall through to "isMe" being
  // false for every row below - that would replace the caller's real hand
  // with fake face-down placeholders instead of surfacing the failure.
  if (mineErr) { console.error("[loadPlayersSecure] own hand fetch failed:", mineErr.message); return null; }
  return pub.map((p: any) => {
    const isMe = p.player_index === mine?.player_index;
    const hand = isMe
      ? (mine?.hand ?? [])
      : (p.visible_hand ?? Array.from({ length: p.hand_count ?? 0 }, (_, i) => ({ id: `hidden-${p.player_index}-${i}`, type: "hidden" })));
    return { ...p, hand };
  });
}

// Guards a piece of state against out-of-order async writers: several
// independent fetches (initial mount, a realtime-triggered refetch, a
// polling fallback) can all resolve a full overwrite of the same state, and
// nothing stops a slow one from landing after a fresher update and reverting
// it. `next()` tokens a fetch when it's *started*; `bump()` marks that state
// moved forward some other way (e.g. an incremental realtime merge applied
// directly, bypassing this fetch path entirely); `isCurrent(token)` tells a
// resolved fetch whether it's still the newest thing in flight before it's
// allowed to apply its result.
function makeSeqGuard() {
  let seq = 0;
  return { next: () => ++seq, bump: () => { seq++; }, isCurrent: (token: number) => token === seq };
}

// ─── Voice Chat ───────────────────────────────────────────────────────────────
// Opt-in P2P-Mesh per WebRTC zwischen den Mitspielern eines Raums. Signaling
// läuft über einen eigenen Supabase-Realtime-Broadcast-Channel (kein eigener
// Signaling-Server nötig), ICE-Server (STUN + eigener TURN) kommen von der
// "getIceServers"-Aktion der Edge Function.
//
// Als Hook statt als eigene Komponente, aufgerufen in LobbyScreen (nicht in
// GameRoom) - GameRoom hat pro Spielphase komplett unterschiedliche JSX-Bäume
// (separate return-Statements), ein dort verschachtelter Verbindungs-State
// würde bei jedem Phasenwechsel (z.B. Warteraum → Spiel gestartet) unmounten
// und die Verbindung verlieren. LobbyScreen bleibt dagegen für die gesamte
// Raum-Sitzung gemountet. GameRoom bekommt das Ergebnis als Prop und
// entscheidet selbst, wo und wie die Steuerung angezeigt wird (Warteraum:
// große Karte, laufendes Spiel: kleines Icon im Header statt einem Button,
// der sonst die Handkarten verdecken würde).
function useVoiceChat(roomId: string | null, session: Session) {
  const [enabled, setEnabled] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [participantIds, setParticipantIds] = useState<Set<string>>(new Set());
  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set());

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const channelRef = useRef<any>(null);
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const rafsRef = useRef<Map<string, number>>(new Map());
  const audioCtxsRef = useRef<Map<string, AudioContext>>(new Map());
  // Trickle ICE candidates can arrive (and with 3+ peers all signaling at
  // once, routinely do arrive) before setRemoteDescription() has run for
  // that peer - addIceCandidate() throws in that case, and with more peers
  // negotiating concurrently the odds of losing a candidate (and with it,
  // sometimes the only viable network path) go up accordingly. Queue them
  // per peer and flush once the remote description is actually set.
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  function stopSpeakingDetection(id: string) {
    const raf = rafsRef.current.get(id);
    if (raf) cancelAnimationFrame(raf);
    rafsRef.current.delete(id);
    // Every call to startSpeakingDetection opens a new AudioContext - without
    // closing it here, each connect/disconnect leaks one. Browsers cap how
    // many can be open at once (Safari/iOS especially), so over a longer
    // session with a few join/leave cycles new ones eventually start
    // silently failing.
    audioCtxsRef.current.get(id)?.close().catch(() => {});
    audioCtxsRef.current.delete(id);
  }

  function startSpeakingDetection(stream: MediaStream, id: string) {
    try {
      const ctx = new AudioContext();
      audioCtxsRef.current.set(id, ctx);
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setSpeakingIds(prev => {
          const isSpeaking = avg > 12;
          if (isSpeaking === prev.has(id)) return prev;
          const next = new Set(prev);
          if (isSpeaking) next.add(id); else next.delete(id);
          return next;
        });
        rafsRef.current.set(id, requestAnimationFrame(tick));
      };
      tick();
    } catch { /* Analyse ist nur Kosmetik - Verbindung funktioniert auch ohne */ }
  }

  function getOrCreatePeer(otherId: string): RTCPeerConnection {
    let pc = peersRef.current.get(otherId);
    if (pc) return pc;
    pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    localStreamRef.current?.getTracks().forEach(t => pc!.addTrack(t, localStreamRef.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: "ice", from: session.user.id, to: otherId, candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      let el = audioElsRef.current.get(otherId);
      if (!el) {
        el = document.createElement("audio");
        el.autoplay = true;
        // Playback of a detached (never-appended) audio element is
        // unreliable on Safari/iOS once more than one is active at a time -
        // it's the difference between "voice chat works with 2 people" and
        // "the 3rd person's audio silently never starts". Kept out of
        // layout/view but genuinely in the DOM.
        el.style.display = "none";
        document.body.appendChild(el);
        audioElsRef.current.set(otherId, el);
      }
      el.srcObject = e.streams[0];
      setParticipantIds(prev => new Set(prev).add(otherId));
      startSpeakingDetection(e.streams[0], otherId);
    };
    pc.onconnectionstatechange = () => {
      // "disconnected" can persist for a long time (or indefinitely, on some
      // browsers) without ever escalating to "failed" - since there's no
      // ICE-restart/reconnect logic here to recover it either way, treat it
      // the same as a hard failure rather than leaving a dead peer marked
      // as connected forever.
      if (pc && (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected")) removePeer(otherId);
    };
    peersRef.current.set(otherId, pc);
    return pc;
  }

  function removePeer(otherId: string) {
    peersRef.current.get(otherId)?.close();
    peersRef.current.delete(otherId);
    audioElsRef.current.get(otherId)?.remove();
    audioElsRef.current.delete(otherId);
    stopSpeakingDetection(otherId);
    pendingCandidatesRef.current.delete(otherId);
    setParticipantIds(prev => { const next = new Set(prev); next.delete(otherId); return next; });
    setSpeakingIds(prev => { const next = new Set(prev); next.delete(otherId); return next; });
  }

  async function flushPendingCandidates(otherId: string, pc: RTCPeerConnection) {
    const queued = pendingCandidatesRef.current.get(otherId);
    if (!queued?.length) return;
    pendingCandidatesRef.current.delete(otherId);
    for (const c of queued) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
  }

  function send(payload: any) {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload });
  }

  // Nur die Seite mit der "kleineren" User-ID initiiert den Offer für ein
  // gegebenes Paar - sonst erzeugen beide Seiten gleichzeitig einen und es
  // kommt zum Glare. Dieselbe Prüfung läuft auf beiden Seiten, darum ist es
  // für jedes Paar immer genau eine Seite, unabhängig davon, wer wann
  // beigetreten ist.
  async function maybeOffer(otherId: string) {
    if (session.user.id >= otherId) return;
    const pc = getOrCreatePeer(otherId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: "offer", from: session.user.id, to: otherId, sdp: offer });
  }

  async function handleSignal(payload: any) {
    if (payload.from === session.user.id) return;
    if (payload.type === "join") {
      // Antworte immer mit "here", unabhängig davon ob wir selbst anbieten -
      // sonst erfährt ein neu Beigetretener mit kleinerer ID nie von einem
      // bereits anwesenden Peer mit größerer ID (der correctly nicht
      // anbietet), und keine Seite initiiert je einen Offer für dieses Paar.
      send({ type: "here", from: session.user.id, to: payload.from });
      await maybeOffer(payload.from).catch(() => removePeer(payload.from));
      return;
    }
    if (payload.type === "here") {
      if (payload.to !== session.user.id) return;
      await maybeOffer(payload.from).catch(() => removePeer(payload.from));
      return;
    }
    if (payload.type === "leave") { removePeer(payload.from); return; }
    if (payload.to !== session.user.id) return;
    try {
      if (payload.type === "offer") {
        const pc = getOrCreatePeer(payload.from);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushPendingCandidates(payload.from, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: "answer", from: session.user.id, to: payload.from, sdp: answer });
      } else if (payload.type === "answer") {
        const pc = peersRef.current.get(payload.from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await flushPendingCandidates(payload.from, pc);
        }
      } else if (payload.type === "ice") {
        const pc = peersRef.current.get(payload.from);
        if (!pc?.remoteDescription) {
          const queue = pendingCandidatesRef.current.get(payload.from) ?? [];
          queue.push(payload.candidate);
          pendingCandidatesRef.current.set(payload.from, queue);
        } else {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => {});
        }
      }
    } catch {
      // Negotiation gescheitert (z.B. ein verspätetes/doppeltes Offer trifft
      // eine Connection im falschen Signaling-State) - Paar sauber
      // fallenlassen statt eines unbehandelten Rejections mit halb
      // ausgehandelter, nie wieder erholender Connection.
      removePeer(payload.from);
    }
  }

  async function enableVoice() {
    if (!roomId) return;
    const rid = roomId;
    setError(""); setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      // The user can leave the room while getUserMedia/getIceServers above
      // (or below) are still pending - without this check, the continuation
      // would keep the mic hot and open a signaling channel for a room
      // that's already been left, with no UI left anywhere to stop it.
      if (roomIdRef.current !== rid) { disableVoice(); return; }
      startSpeakingDetection(stream, session.user.id);
      // The OS/browser can revoke mic access at any point without the app
      // asking for it back - most commonly by backgrounding the tab/app.
      // Without this, the UI would keep showing "connected" indefinitely
      // even though nothing is actually being captured or sent anymore.
      stream.getAudioTracks().forEach(track => {
        track.onended = () => { setError("Mikrofonverbindung unterbrochen"); disableVoice(); };
      });

      const iceRes = await callGameAction(rid, "getIceServers", {});
      if (roomIdRef.current !== rid) { disableVoice(); return; }
      if (iceRes?.iceServers) iceServersRef.current = iceRes.iceServers;

      const ch = supabase.channel(`voice:${rid}`, { config: { broadcast: { self: false } } });
      channelRef.current = ch;
      ch.on("broadcast", { event: "signal" }, ({ payload }: any) => handleSignal(payload));
      ch.subscribe((status: string) => {
        if (status === "SUBSCRIBED") { send({ type: "join", from: session.user.id }); return; }
        // Same idea for the signaling channel itself - a network drop here
        // otherwise leaves the UI stuck on "connected" with no way to ever
        // exchange offers with anyone again.
        if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError("Verbindung zum Sprachchat unterbrochen");
          disableVoice();
        }
      });
      setEnabled(true);
    } catch {
      setError("Mikrofon nicht verfügbar");
    } finally {
      setConnecting(false);
    }
  }

  function disableVoice() {
    send({ type: "leave", from: session.user.id });
    peersRef.current.forEach((_, id) => removePeer(id));
    pendingCandidatesRef.current.clear();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    stopSpeakingDetection(session.user.id);
    // Clear the ref *before* removing the channel, not after - removeChannel
    // can synchronously re-fire the subscribe callback with a "CLOSED"
    // status, which now also calls disableVoice() (see the CLOSED/
    // CHANNEL_ERROR/TIMED_OUT handling in enableVoice). If the ref were
    // still set at that point, the re-entrant call would call
    // removeChannel() again on the same channel, which fires the callback
    // again, and so on - an infinite loop.
    const ch = channelRef.current;
    channelRef.current = null;
    if (ch) supabase.removeChannel(ch);
    setParticipantIds(new Set());
    setSpeakingIds(new Set());
    setMuted(false);
    setEnabled(false);
  }

  // Verbindung sauber abbauen, wenn der Raum komplett verlassen wird (nicht
  // bei jedem Re-Render - deshalb leeres Dependency-Array mit roomId-Ref-Check
  // wäre Overkill hier, roomId ändert sich für diese Komponente ohnehin nie
  // innerhalb ihrer Lebenszeit, da sie pro Raum neu gemountet wird).
  useEffect(() => () => { if (channelRef.current) disableVoice(); }, [roomId]);

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach(t => { t.enabled = !next; });
    setMuted(next);
  }

  return { enabled, connecting, muted, error, participantIds, speakingIds, enableVoice, disableVoice, toggleMute };
}

// ─── Game Room ────────────────────────────────────────────────────────────────
function GameRoom({ roomId, session, edition, onlineUserIds, voice, onLeave }: { roomId: string; session: Session; edition?: string; onlineUserIds: Set<string>; voice: ReturnType<typeof useVoiceChat>; onLeave: () => void }) {
  const aiTriggerPending = useRef(false);
  const aiTriggerLastKey = useRef<string>("");
  const clearTrickPending = useRef(false);
  // Guards against out-of-order network responses clobbering fresher state -
  // see makeSeqGuard(). Both `players` and `room` are overwritten wholesale
  // from several independent async call sites (initial mount, the "rooms
  // changed" refetch, the 5s poll), so both need this: a slow response
  // landing after a newer update would otherwise silently revert a just-
  // played card back into the hand, or current_player/phase back a step,
  // with nothing to correct it until the next unrelated event touches it.
  const playersGuard = useRef(makeSeqGuard()).current;
  const roomGuard = useRef(makeSeqGuard()).current;
  // Temporary diagnostic: a reported "played card stays in hand" bug has
  // survived two rounds of fixes for plausible-but-unconfirmed causes.
  // Logs every time the caller's own hand actually changes, tagged by which
  // of the several setPlayers() call sites produced it - if it happens
  // again, the browser console will show which write path was responsible
  // instead of another round of static-code guessing.
  const handDebugRef = useRef<string>("");
  const logHandChange = (source: string, playersArr: any[]) => {
    const own = playersArr.find((p: any) => p.user_id === session.user.id);
    const ids = (own?.hand ?? []).map((c: any) => c.id).sort().join(",");
    if (ids !== handDebugRef.current) {
      console.log(`[handDebug] ${source}:`, handDebugRef.current || "(none)", "->", ids || "(empty)");
      handDebugRef.current = ids;
    }
  };
  const [showLog, setShowLog] = useState(false);
  const [modalMinimized, setModalMinimized] = useState(true);
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [myIdx, setMyIdx] = useState(-1);
  const [selected, setSelected] = useState<string | null>(null);
  // Card ids are derived purely from suit+value (see buildDeck()), not per-
  // deal, so the SAME id can recur in a later round's hand. Without this,
  // a leftover `selected` from a previous round's card could make the very
  // first tap on a same-id card in a new round skip the "lift, then confirm"
  // step and play it immediately.
  useEffect(() => { setSelected(null); }, [room?.round]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScoresheet, setShowScoresheet] = useState(false);

  // Invite a friend into the Warteraum: fetched on demand, not on mount.
  const [showInvite, setShowInvite] = useState(false);
  const [inviteFriends, setInviteFriends] = useState<{ id: string; username: string; avatar_url: string | null }[] | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const inviteInFlight = useRef<Set<string>>(new Set());

  async function openInvitePicker() {
    setShowInvite(true);
    if (inviteFriends !== null) return;
    const uid = session.user.id;
    const [{ data }, { data: pending }] = await Promise.all([
      supabase.from("friends").select("*").eq("status", "accepted").or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
      supabase.from("room_invites").select("to_user_id").eq("room_id", room.id).eq("from_user_id", uid),
    ]);
    const otherIds = Array.from(new Set((data ?? []).map((f: any) => f.requester_id === uid ? f.addressee_id : f.requester_id)));
    let list: { id: string; username: string; avatar_url: string | null }[] = [];
    if (otherIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id, username, avatar_url").in("id", otherIds);
      list = profs ?? [];
    }
    setInviteFriends(list);
    // Pre-mark anyone we already have a pending invite out to for this room,
    // so "Einladen" doesn't sit there re-clickable for no reason.
    if (pending?.length) setInvitedIds(prev => { const next = new Set(prev); pending.forEach((r: any) => next.add(r.to_user_id)); return next; });
  }

  async function inviteFriend(friendId: string) {
    // Synchronous guard (not just the `disabled` prop, which only updates on
    // the next render) - a rapid double-click can't fire this twice.
    if (inviteInFlight.current.has(friendId) || invitedIds.has(friendId)) return;
    inviteInFlight.current.add(friendId);
    setInviteSending(friendId);
    const { error } = await supabase.from("room_invites").insert({
      room_id: room.id, room_code: room.code, from_user_id: session.user.id,
      from_username: session.user.user_metadata?.username ?? "Spieler", to_user_id: friendId,
    });
    inviteInFlight.current.delete(friendId);
    setInviteSending(null);
    if (!error || error.code === "23505") setInvitedIds(prev => new Set(prev).add(friendId));
  }

  // Add a fellow room player as a friend directly (no username search needed -
  // we already know their user_id from the players list).
  const [friendReqState, setFriendReqState] = useState<Record<string, "sending" | "sent" | "exists" | "error">>({});
  const friendReqInFlight = useRef<Set<string>>(new Set());

  // Pre-check: mark co-players we're already friends with (or already have a
  // pending request with, in either direction) as "exists" up front, instead
  // of only finding out after a wasted insert attempt.
  const otherPlayerIds = players.filter((p: any) => !p.is_ai && p.user_id && p.user_id !== session.user.id).map((p: any) => p.user_id).sort().join(",");
  useEffect(() => {
    if (!otherPlayerIds) return;
    const uid = session.user.id;
    supabase.from("friends").select("requester_id, addressee_id").or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
      .then(({ data }) => {
        if (!data?.length) return;
        const ids = new Set(otherPlayerIds.split(","));
        const connected = data.map((f: any) => f.requester_id === uid ? f.addressee_id : f.requester_id).filter((id: string) => ids.has(id));
        if (!connected.length) return;
        setFriendReqState(prev => {
          const next = { ...prev };
          connected.forEach((id: string) => { if (!next[id]) next[id] = "exists"; });
          return next;
        });
      });
  }, [otherPlayerIds]);

  // Avatars for every real (non-AI) player currently in the room, including self.
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const allPlayerIds = players.filter((p: any) => !p.is_ai && p.user_id).map((p: any) => p.user_id).sort().join(",");
  useEffect(() => {
    if (!allPlayerIds) return;
    supabase.from("profiles").select("id, avatar_url").in("id", allPlayerIds.split(","))
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string | null> = {};
        data.forEach((p: any) => { map[p.id] = p.avatar_url; });
        setAvatars(map);
      });
  }, [allPlayerIds]);

  async function addFriendFromRoom(targetUserId: string) {
    if (friendReqInFlight.current.has(targetUserId)) return;
    const st = friendReqState[targetUserId];
    if (st === "sending" || st === "sent" || st === "exists") return;
    friendReqInFlight.current.add(targetUserId);
    setFriendReqState(prev => ({ ...prev, [targetUserId]: "sending" }));
    const { error } = await supabase.from("friends").insert({ requester_id: session.user.id, addressee_id: targetUserId, status: "pending" });
    friendReqInFlight.current.delete(targetUserId);
    setFriendReqState(prev => ({ ...prev, [targetUserId]: !error ? "sent" : error.code === "23505" ? "exists" : "error" }));
  }

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
    try {
      const res = await callGameAction(roomId, action, extra);
      if (res.error) {
        setError(res.error);
        // Auto-dismiss non-critical errors, keep critical ones
        if (!res.error.includes("Verbindung") && !res.error.includes("Server")) {
          setTimeout(() => setError(""), 4000);
        }
      }
    } catch {
      // Belt-and-suspenders: callGameAction already catches its own errors,
      // but never let an unexpected exception here leave the UI stuck with
      // cards permanently greyed out and no way to retry.
      setError("Verbindung unterbrochen – bitte erneut versuchen");
    } finally {
      setLoading(false);
      actInFlight.current = false;
    }
  }, [roomId]);

  useEffect(() => {
    const roomToken = roomGuard.next();
    supabase.from("rooms").select("id, code, phase, round, max_rounds, dealer, current_player, trump_card, trump_suit, werewolf_suit, original_trump_card, current_trick, last_trick_winner, last_trick_cards, pending_rainbow7, pending_rainbow7_buffer, pending_rainbow9, pending_rainbow9_deferred, pending_witch, pending_vampire_reveal, witch_swap, edition, log, created_at").eq("id", roomId).single().then(({ data, error }) => {
      if (data) { if (roomGuard.isCurrent(roomToken)) setRoom(data); }
      else if (error) console.error("[GameRoom] initial room fetch failed:", error.message);
    });
    const playersToken = playersGuard.next();
    loadPlayersSecure(roomId, session.user.id).then(data => {
      if (data) {
        if (!playersGuard.isCurrent(playersToken)) return; // superseded by a newer update
        logHandChange("initial-mount", data);
        setPlayers(data);
        const mine = data.find((p: any) => p.user_id === session.user.id);
        if (mine) setMyIdx(mine.player_index);
      } else {
        console.error("[GameRoom] initial players fetch failed");
      }
    });
  }, [roomId]);

  useEffect(() => {
    // Both fetches below silently no-op on failure (RLS hiccup, transient
    // network error, expiring session) instead of throwing - logging here so
    // a stuck "card didn't leave my hand" report has something to look at
    // instead of only static code reading next time.
    const refreshState = () => {
      const roomToken = roomGuard.next();
      supabase.from("rooms").select("id, code, phase, round, max_rounds, dealer, current_player, trump_card, trump_suit, werewolf_suit, original_trump_card, current_trick, last_trick_winner, last_trick_cards, pending_rainbow7, pending_rainbow7_buffer, pending_rainbow9, pending_rainbow9_deferred, pending_witch, pending_vampire_reveal, witch_swap, edition, log, created_at").eq("id", roomId).single().then(({ data, error }) => {
        if (data) { if (roomGuard.isCurrent(roomToken)) setRoom(data); }
        else if (error) console.error("[refreshState] room fetch failed:", error.message);
      });
      const playersToken = playersGuard.next();
      loadPlayersSecure(roomId, session.user.id).then(data => {
        if (!data) { console.error("[refreshState] players fetch failed"); return; }
        if (!playersGuard.isCurrent(playersToken)) return; // superseded by a newer update
        logHandChange("poll/refreshState", data);
        setPlayers(data);
      });
    };

    // A channel fires an initial "sync" as soon as it's subscribed, before
    // track() below has run - at that point the presence state is empty, so
    // reporting it would (briefly) mark ourselves as disconnected in our own
    // room. Ignore sync events until we've actually tracked our own presence.
    let tracked = false;
    const ch = supabase.channel(`room:${roomId}`, { config: { presence: { key: session.user.id } } })
      // Reports who's actually got this room open right now, so the server
      // can tell "everyone left mid-game" apart from "someone's still
      // thinking" (see cleanup_stale_rooms() / syncPresence action).
      .on("presence", { event: "sync" }, () => {
        if (!tracked) return;
        callGameAction(roomId, "syncPresence", { presentUserIds: Object.keys(ch.presenceState()) });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, payload => {
        const newRoom = payload.new;
        // Bump first: a realtime payload is always at least as fresh as any
        // REST fetch still in flight from before this event arrived, so an
        // older room fetch resolving after this must not revert it.
        roomGuard.bump();
        setRoom(newRoom);
        const mySeq = playersGuard.next();
        loadPlayersSecure(roomId, session.user.id).then(data => {
          if (data) {
            // Superseded by a newer update - don't clobber fresher state, but
            // still use this (still-reasonably-current) data for the one-shot
            // AI/clearTrick scheduling checks below, which are independently
            // guarded against double-firing.
            if (playersGuard.isCurrent(mySeq)) { logHandChange("rooms:UPDATE-refetch", data); setPlayers(data); }
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
          } else {
            console.error("[room:UPDATE] players refresh failed after room change");
          }
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_players", filter: `room_id=eq.${roomId}` }, (payload) => {
        // Bump first: this event is by definition newer than anything already
        // in flight, so any loadPlayersSecure() fetch still pending from
        // before it (poll, "rooms changed" refetch, initial mount) must not
        // be allowed to overwrite the merge below once it resolves.
        playersGuard.bump();
        if (payload.eventType === "UPDATE" && payload.new) {
          setPlayers(prev => {
            const exists = prev.some(p => p.id === payload.new.id);
            const next = exists
              ? prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p)
              : [...prev, payload.new].sort((a,b) => a.player_index - b.player_index);
            logHandChange("room_players:merge", next);
            return next;
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
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        ch.track({ at: new Date().toISOString() }).then(() => {
          tracked = true;
          callGameAction(roomId, "syncPresence", { presentUserIds: Object.keys(ch.presenceState()) });
        });
      });

    // Poll every 5 seconds as fallback for missed realtime events (read-only, no AI trigger).
    // Backgrounding a tab/PWA (screen lock, app switch - routine on mobile)
    // commonly suspends the socket and throttles this interval far past 5s,
    // so a card played (or any other state change) right before backgrounding
    // could sit stale until something else happens to trigger a refresh.
    // Force an immediate resync the moment the page is foregrounded again,
    // instead of waiting on the throttled poll to eventually catch up.
    const poll = setInterval(refreshState, 5000);
    // Most browsers fire both visibilitychange and focus back-to-back when a
    // backgrounded tab/PWA is reopened - debounce so that doesn't double the
    // REST round-trips on every single foreground event.
    let lastForegroundResync = 0;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastForegroundResync < 1000) return;
      lastForegroundResync = now;
      refreshState();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      // Report our own departure immediately instead of waiting for the
      // Realtime server to notice the socket close and tell everyone else -
      // covers the common "clicked Verlassen" path, not just a killed app.
      const stillPresent = Object.keys(ch.presenceState()).filter(id => id !== session.user.id);
      callGameAction(roomId, "syncPresence", { presentUserIds: stillPresent });
      supabase.removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
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
    <div style={{ ...tableStyle, justifyContent: "center", gap: 10 }}>
      <WizardMascot size={34} style={{ animation: "pulse 1.5s infinite" }} />
      <div style={{ ...cinzel, fontSize: 14, color: C.ivoryDim, animation: "pulse 1.5s infinite" }}>Lade…</div>
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

  const voiceNameFor = (id: string) => id === session.user.id ? "Du" : (players.find((p: any) => p.user_id === id)?.ai_name ?? "Spieler");

  // Für Warteraum/Rundenende - hier ist genug Platz für Text+Teilnehmerliste.
  // Im laufenden Spiel (Header) gibt's stattdessen nur ein kleines Icon, siehe unten.
  const voicePanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
      {voice.enabled && voice.participantIds.size > 0 && (
        <div style={{ ...glass({ padding: "8px 12px" }), display: "flex", flexDirection: "column", gap: 4 }}>
          {[session.user.id, ...voice.participantIds].map((id: string) => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: voice.speakingIds.has(id) ? C.success : C.ivoryDim }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: voice.speakingIds.has(id) ? C.success : "rgba(255,255,255,0.25)" }} />
              {voiceNameFor(id)}
            </div>
          ))}
        </div>
      )}
      {!voice.enabled ? (
        <button onClick={voice.enableVoice} disabled={voice.connecting} style={{ ...goldBtn(false), padding: "8px 14px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, opacity: voice.connecting ? 0.5 : 1 }}>
          <IconMic size={14} /> {voice.connecting ? "Verbinde…" : "Sprachchat aktivieren"}
        </button>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={voice.toggleMute} style={{ ...goldBtn(!voice.muted), padding: "8px 12px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            {voice.muted ? <IconMicOff size={14} /> : <IconMic size={14} />} {voice.muted ? "Stumm" : "Live"}
          </button>
          <button onClick={voice.disableVoice} style={{ ...glass({ padding: "8px 10px" }), border: "none", color: C.ivoryDim, cursor: "pointer", display: "flex", alignItems: "center" }} title="Sprachchat verlassen"><IconX size={15} /></button>
        </div>
      )}
      {voice.error && <div style={{ ...glass({ padding: "6px 10px" }), fontSize: 11, color: "#FF8080" }}>{voice.error}</div>}
    </div>
  );

  // ── Lobby Phase ──
  if (room.phase === "lobby") {
    // KI füllt nur auf 3 auf, wenn nicht genug echte Spieler da sind - darüber
    // spielen ausschließlich die tatsächlich beigetretenen Menschen mit.
    const effectiveAiCount = Math.max(0, 3 - players.length);
    return (
      <div style={{ ...tableStyle, justifyContent: "center", gap: 20 }} className="fade-in">
        <button onClick={() => { if (players.length <= 1 || confirm("Warteraum verlassen?")) { callGameAction(roomId, "leaveRoom", {}); onLeave(); } }}
          style={{ alignSelf: "flex-start", background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 13, textAlign: "left", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <IconArrowLeft size={13} /> Zurück
        </button>
        <div style={{ ...cinzel, fontSize: 24, color: C.gold, display: "flex", alignItems: "center", gap: 10 }}>
          <WizardMascot size={20} />
          Warteraum
        </div>
        <div style={{ ...glass({ padding: "8px 24px" }), ...cinzel, fontSize: 20, letterSpacing: 6, color: C.goldLight }}>{room.code}</div>
        <div style={{ fontSize: 11, color: C.ivoryDim }}>Code mit Freunden teilen</div>
        <div style={{ ...glass({ padding: "4px 14px" }), fontSize: 11, color: room?.edition === "anniversary" ? "#F7DC6F" : C.ivoryDim, display: "flex", alignItems: "center", gap: 6 }}>
          {room?.edition === "anniversary" ? <>⚡ 30 Jahre Edition</> : <><CardIcon size={11}><WizardArt index={0} /></CardIcon> Classic Edition</>}
        </div>

        {!showInvite ? (
          <button onClick={openInvitePicker} style={{ ...goldBtn(false), padding: "7px 16px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><IconUsers size={13} /> Freund einladen</button>
        ) : (
          <div style={{ ...glass({ padding: 14 }), width: "min(320px, 92vw)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ ...cinzel, fontSize: 11, color: C.gold, letterSpacing: 1 }}>FREUND EINLADEN</div>
              <button onClick={() => setShowInvite(false)} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", display: "flex" }}><IconX size={14} /></button>
            </div>
            {inviteFriends === null ? (
              [0, 1].map(i => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="skeleton" style={{ width: 7, height: 7, borderRadius: "50%" }} />
                  <div className="skeleton" style={{ width: `${80 - i * 16}px`, height: 13, borderRadius: 4, flex: "none" }} />
                  <div className="skeleton" style={{ width: 62, height: 24, borderRadius: 16, marginLeft: "auto" }} />
                </div>
              ))
            ) : inviteFriends.length === 0 ? (
              <div style={{ fontSize: 12, color: C.ivoryDim, textAlign: "center" }}>Noch keine Freunde hinzugefügt</div>
            ) : inviteFriends.map(f => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative" as const }}>
                  <Avatar userId={f.id} username={f.username} avatarUrl={f.avatar_url} size={24} />
                  <span style={{ position: "absolute" as const, bottom: -1, right: -1, width: 8, height: 8, borderRadius: "50%", background: onlineUserIds.has(f.id) ? C.success : "rgba(255,255,255,0.25)", boxShadow: `0 0 0 2px ${C.bgDark}` }} title={onlineUserIds.has(f.id) ? "Online" : "Offline"} />
                </div>
                <div style={{ fontSize: 13, color: C.ivory, flex: 1 }}>{f.username}</div>
                <button onClick={() => inviteFriend(f.id)} disabled={invitedIds.has(f.id) || inviteSending === f.id}
                  style={{ ...goldBtn(!invitedIds.has(f.id)), padding: "5px 12px", fontSize: 11, opacity: invitedIds.has(f.id) ? 0.5 : 1 }}>
                  {invitedIds.has(f.id) ? "Eingeladen ✓" : "Einladen"}
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...glass({ padding: 16 }), width: "min(320px, 92vw)" }}>
          {players.map((p: any) => {
            const st = friendReqState[p.user_id];
            // Hidden once sent/already connected - nothing left to do here
            // regardless of whether the other side later accepts or declines.
            const canFriend = !p.is_ai && p.user_id && p.user_id !== session.user.id && st !== "sent" && st !== "exists";
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
                <div style={{ position: "relative" }}>
                  <Avatar userId={p.user_id} username={p.ai_name} avatarUrl={avatars[p.user_id]} size={26} />
                  {!p.is_ai && (
                    <span style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: "50%", background: p.connected ? C.success : "rgba(255,255,255,0.25)", boxShadow: `0 0 0 2px ${C.bgDark}` }} title={p.connected ? "Verbunden" : "Getrennt"} />
                  )}
                </div>
                <div style={{ ...cinzel, fontSize: 13, color: p.user_id === session.user.id ? C.gold : C.ivory }}>
                  {p.ai_name}
                  {p.player_index === 0 && <span style={{ color: C.ivoryDim, fontWeight: 400 }}> (Host)</span>}
                </div>
                {p.user_id === session.user.id && <div style={{ fontSize: 10, color: C.ivoryDim, marginLeft: "auto" }}>Du</div>}
                {canFriend && (
                  <button onClick={() => addFriendFromRoom(p.user_id)} disabled={st === "sending"}
                    title="Als Freund hinzufügen"
                    style={{ marginLeft: "auto", background: "none", border: "none", color: C.ivoryDim, cursor: st === "sending" ? "default" : "pointer", display: "flex", padding: 4, opacity: st === "sending" ? 0.5 : 1 }}>
                    <IconUserPlus size={16} />
                  </button>
                )}
              </div>
            );
          })}
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
        {voicePanel}
      </div>
    );
  }

  // ── Round/Game End ──
  if (room.phase === "roundEnd" || room.phase === "gameEnd") {
    const sorted = [...players].sort((a: any, b: any) => b.score - a.score);
    const lastRound = roundHistory[roundHistory.length - 1];
    return (
      <div style={{ ...tableStyle, justifyContent: "center", gap: 14 }} className="fade-in">
        <div style={{ ...cinzel, fontSize: "clamp(18px,5vw,26px)", color: C.gold }}>
          {room.phase === "gameEnd" ? "🏆 Spiel beendet!" : `Runde ${room.round} beendet`}
        </div>

        {/* Round detail */}
        {lastRound && (
          <div style={{ ...glass({ padding: 16 }), width: "min(420px, 96vw)", overflowX: "auto" }}>
            <div style={{ ...cinzel, fontSize: "var(--text-xs)", color: C.ivoryDim, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" as const }}>Rundenergebnis</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" as const }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px 8px", color: C.ivoryDim, fontWeight: 600, fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase" as const, borderBottom: `1px solid rgba(201,168,76,0.12)` }}>Spieler</th>
                  <th style={{ textAlign: "right", padding: "6px 8px 8px", color: C.ivoryDim, fontWeight: 600, fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase" as const, borderBottom: `1px solid rgba(201,168,76,0.12)` }}>Ansage</th>
                  <th style={{ textAlign: "right", padding: "6px 8px 8px", color: C.ivoryDim, fontWeight: 600, fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase" as const, borderBottom: `1px solid rgba(201,168,76,0.12)` }}>Erg.</th>
                  <th style={{ textAlign: "right", padding: "6px 8px 8px", color: C.ivoryDim, fontWeight: 600, fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase" as const, borderBottom: `1px solid rgba(201,168,76,0.12)` }}>Punkte</th>
                </tr>
              </thead>
              <tbody>
                {lastRound.results?.map((r: any) => {
                  const hit = r.bid === r.got;
                  const delta = hit ? 20 + r.bid * 10 : -Math.abs(r.bid - r.got) * 10;
                  return (
                    <tr key={r.playerIndex}>
                      <td style={{ padding: "9px 8px", borderTop: `1px solid rgba(201,168,76,0.10)`, color: C.ivory, fontSize: 13.5 }}>{r.name}</td>
                      <td style={{ padding: "9px 8px", borderTop: `1px solid rgba(201,168,76,0.10)`, textAlign: "right", color: C.ivoryDim, fontSize: 13.5 }}>{r.bid}</td>
                      <td style={{ padding: "9px 8px", borderTop: `1px solid rgba(201,168,76,0.10)`, textAlign: "right", color: C.ivoryDim, fontSize: 13.5 }}>{r.got}</td>
                      <td style={{ padding: "9px 8px", borderTop: `1px solid rgba(201,168,76,0.10)`, textAlign: "right", fontWeight: 700, fontSize: 13.5, color: hit ? C.success : C.error }}>
                        {delta > 0 ? "+" : ""}{delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Ranking */}
        <div style={{ ...glass({ padding: 14 }), width: "min(360px, 96vw)" }}>
          <div style={{ ...cinzel, fontSize: "var(--text-xs)", color: C.ivoryDim, letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" as const }}>Gesamtranking</div>
          {sorted.map((p: any, i: number) => {
            const st = friendReqState[p.user_id];
            const canFriend = !p.is_ai && p.user_id && p.user_id !== session.user.id && st !== "sent" && st !== "exists";
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: i > 0 ? "1px solid rgba(201,168,76,0.10)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? C.gold : C.ivoryDim, width: 14, display: "inline-block" }}>{i + 1}</span>
                  <Avatar userId={p.user_id} username={p.ai_name} avatarUrl={avatars[p.user_id]} size={22} />
                  <span style={{ ...cinzel, fontSize: "clamp(13px,3.5vw,15px)", fontWeight: i === 0 ? 600 : 400, color: i === 0 ? C.gold : C.ivory }}>{p.ai_name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ ...cinzel, fontWeight: 700, fontSize: "clamp(14px,4vw,17px)", fontVariantNumeric: "tabular-nums" as const, color: i === 0 ? C.gold : C.ivory }}>{p.score}</span>
                  {canFriend && (
                    <button onClick={() => addFriendFromRoom(p.user_id)} disabled={st === "sending"}
                      title="Als Freund hinzufügen"
                      style={{ background: "none", border: "none", color: C.ivoryDim, cursor: st === "sending" ? "default" : "pointer", display: "flex", padding: 2, opacity: st === "sending" ? 0.5 : 1 }}>
                      <IconUserPlus size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {isHost && room.phase === "roundEnd" && (
            <button onClick={() => act("nextRound")} disabled={loading} style={{ ...goldBtn(), padding: "12px 28px", opacity: loading ? 0.5 : 1, cursor: loading ? "default" : "pointer" }}>
              {loading ? "…" : `Weiter → Runde ${room.round + 1}`}
            </button>
          )}
          <button onClick={onLeave} style={{ ...goldBtn(false), padding: "8px 20px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}><IconHome size={14} /> Zurück zur Startseite</button>
          {isHost && room.phase === "gameEnd" && (
            <button onClick={() => act("newGame")} style={{ ...goldBtn(), padding: "12px 28px" }}>Nochmal spielen</button>
          )}
          {!isHost && <div style={{ color: C.ivoryDim, fontSize: 13 }}>Warte auf Host…</div>}
          <button onClick={() => window.location.reload()} style={{ ...goldBtn(false), padding: "12px 20px", fontSize: 12 }}>Raum verlassen</button>
        </div>
        {voicePanel}
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
      background: "rgba(16,22,26,0.97)", borderLeft: `1px solid ${C.glassBorder}`,
      display: "flex", flexDirection: "column" as const,
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
    }} className="slide-in-right">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${C.glassBorder}` }}>
        <div style={{ ...cinzel, fontSize: 14, color: C.gold, display: "flex", alignItems: "center", gap: 6 }}><IconMessageCircle size={15} /> Chat</div>
        <button onClick={() => setShowChat(false)} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", display: "flex" }}><IconX size={18} /></button>
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
    const forbidden = forbiddenDealerBid(players.map((p: any) => p.bid), room.dealer, room.round);
    // Crown the current leader, but only once scores have actually diverged
    // from the 0-0 starting tie.
    const maxScore = Math.max(0, ...players.map((p: any) => p.score));
    const isLeader = (p: any) => maxScore > 0 && p.score === maxScore;
    const runningByRound = computeRunningTotals(players.map((p: any) => p.player_index), roundHistory);
    const lastRoundNum = roundHistory.length ? roundHistory[roundHistory.length - 1].round : null;

    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
        onClick={() => setShowScoresheet(false)}>
        <div style={{
          ...glass({ padding: 0 }), width: "min(700px, 96vw)", maxHeight: "85vh", overflow: "auto", borderRadius: 16,
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${C.glassBorder}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ ...cinzel, fontSize: 10, letterSpacing: 2.5, color: C.ivoryDim, textTransform: "uppercase" as const }}>Runde {room.round}/{room.max_rounds}</div>
              <button onClick={() => setShowScoresheet(false)} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", display: "flex" }}><IconX size={18} /></button>
            </div>
            <div style={{ ...cinzel, fontSize: 18, fontWeight: 600, color: C.ivory }}>Spielblatt</div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="scoresheet-table" style={{ borderCollapse: "collapse", width: "100%", fontVariantNumeric: "tabular-nums" as const }}>
              <thead>
                <tr>
                  <th style={{ padding: "14px 16px 10px", textAlign: "left", color: C.ivoryDim, borderBottom: `1px solid rgba(201,168,76,0.12)`, fontWeight: 600, fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>Runde</th>
                  {players.map((p: any) => (
                    <th key={p.id} style={{ padding: "14px 16px 10px", textAlign: "right", color: C.ivoryDim, borderBottom: `1px solid rgba(201,168,76,0.12)`, fontWeight: 600, fontSize: 10.5, letterSpacing: 0.5, textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>
                      {p.ai_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Past rounds */}
                {roundHistory.map((rh: any) => (
                  <tr key={rh.round}>
                    <td style={{ padding: "11px 16px", borderTop: `1px solid rgba(201,168,76,0.10)`, whiteSpace: "nowrap" }}>
                      <div style={{ ...cinzel, fontSize: 12, color: C.ivory, fontWeight: 600 }}>R{rh.round}</div>
                      <div style={{ fontSize: 10.5, color: C.ivoryDim, marginTop: 1 }}>{players[((rh.round - 1) % players.length)]?.ai_name ?? "?"} gibt</div>
                    </td>
                    {players.map((p: any) => {
                      const r = rh.results?.find((x: any) => x.playerIndex === p.player_index);
                      const total = runningByRound[rh.round]?.[p.player_index];
                      const leaderHere = rh.round === lastRoundNum && isLeader(p);
                      return (
                        <td key={p.id} style={{ padding: "11px 16px", borderTop: `1px solid rgba(201,168,76,0.10)`, textAlign: "right", fontSize: 13.5, whiteSpace: "nowrap" }}>
                          {/* Total first, Ansage after it - matches the real paper
                              block's layout (score in the wide column, bid in the
                              narrow one next to it). */}
                          {r && <span style={{ fontWeight: 700, color: leaderHere ? C.gold : C.ivory }}>{total}</span>}{" "}
                          <span style={{ color: C.ivoryDim }}>{r ? r.bid : "–"}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Current round – live bidding */}
                {room.phase !== "gameEnd" && (
                  <tr>
                    <td style={{ padding: "11px 16px", background: "rgba(201,168,76,0.045)", whiteSpace: "nowrap" }}>
                      <div style={{ ...cinzel, fontSize: 12, color: C.goldLight, fontWeight: 600 }}>R{room.round} ▶</div>
                      <div style={{ fontSize: 10.5, color: C.ivoryDim, marginTop: 1 }}>{players[room.dealer]?.ai_name} gibt</div>
                    </td>
                    {players.map((p: any) => {
                      const pi = p.player_index;
                      const bid = p.bid;
                      const isCurrent = room.phase === "bidding" && room.current_player === pi;
                      const isDealer = room.dealer === pi;
                      const isForbidden = isDealer && forbidden !== null;
                      return (
                        <td key={p.id} style={{ padding: "11px 16px", background: "rgba(201,168,76,0.045)", textAlign: "right", whiteSpace: "nowrap" }}>
                          <span style={{
                            fontSize: 13.5, fontWeight: 600,
                            color: bid !== null ? C.goldLight : isCurrent ? C.gold : C.ivoryDim,
                            animation: isCurrent ? "pulse 1.5s infinite" : "none",
                          }}>
                            {bid !== null ? `A:${bid}` : isCurrent ? "wählt …" : "–"}
                          </span>
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
    <div className="fade-in" style={{
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
        <div style={{ ...cinzel, fontSize: "clamp(13px,2.5vmin,22px)", color: C.gold, letterSpacing: "clamp(2px,0.5vmin,6px)", display: "flex", alignItems: "center", gap: 6 }}>
          <CardIcon size={14}><WizardArt index={0} /></CardIcon> WIZZO
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <button
            onClick={voice.enabled ? voice.toggleMute : voice.enableVoice}
            disabled={voice.connecting}
            style={{ ...goldBtn(voice.enabled && !voice.muted), padding: "4px 7px", display: "flex", opacity: voice.connecting ? 0.5 : 1 }}
            title={!voice.enabled ? "Sprachchat aktivieren" : voice.muted ? "Stummschaltung aufheben" : "Stummschalten"}
          >
            {voice.enabled && voice.muted ? <IconMicOff size={15} /> : <IconMic size={15} />}
          </button>
          {voice.enabled && (
            <button onClick={voice.disableVoice} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: "4px 7px", borderRadius: 6, display: "flex" }} title="Sprachchat verlassen"><IconX size={15} /></button>
          )}
          <button onClick={() => setShowLog(v => !v)} style={{ ...goldBtn(showLog), padding: "4px 7px", display: "flex" }} title="Log"><IconHistory size={15} /></button>
          <button onClick={() => setShowChat(v => !v)} style={{ ...goldBtn(showChat), padding: "4px 7px", position: "relative" as const, display: "flex" }} title="Chat">
            <IconMessageCircle size={15} />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute" as const, top: -6, right: -6,
                background: "#C0392B", color: "#fff", borderRadius: 10,
                fontSize: 9, fontWeight: 700, padding: "1px 5px", minWidth: 16,
              }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
          </button>
          <button onClick={() => setShowScoresheet(true)} style={{ ...goldBtn(false), padding: "4px 7px", display: "flex" }} title="Spielblatt"><IconClipboardList size={15} /></button>
          <button onClick={() => { if (confirm("Spiel verlassen?")) onLeave(); }} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: "4px 7px", borderRadius: 6, display: "flex" }} title="Verlassen"><IconX size={15} /></button>
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
                <div style={{ display: "flex", alignItems: "center", gap: 3, marginLeft: "auto" }}>
                  {!p.is_ai && voice.participantIds.has(p.user_id) && (
                    <IconMic size={9} style={{ color: voice.speakingIds.has(p.user_id) ? C.success : "rgba(255,255,255,0.4)", flexShrink: 0 }} />
                  )}
                  {hasPlayed && <span style={{ fontSize: 9, color: C.gold }}>✓</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ ...cinzel, fontSize: "clamp(11px,2vmin,18px)", color: "#F4D03F", fontWeight: 700 }}>{p.score}</span>
                {hasBid ? (
                  <TrickPile tricksWon={p.tricks_won} bid={p.bid} />
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
                const isWinner = room.phase === "trickEnd" && room.last_trick_winner === t.playerIndex;
                const isBombed = room.phase === "trickEnd" && t.card.specialType === "bomb";
                return (
                  <div key={t.playerIndex} style={{ position: "absolute" as const, textAlign: "center", ...pos }}>
                    <div style={{ fontSize: 8, color: isMe ? C.gold : "rgba(255,255,255,0.6)", marginBottom: 2, ...cinzel }}>
                      {isMe ? "Du" : players[t.playerIndex]?.ai_name}
                    </div>
                    <div style={{ position: "relative" as const, animation: isBombed ? "bombShake 0.5s ease-in-out 2" : undefined }}>
                      <CardView card={t.card} winner={isWinner} small />
                      {isBombed && (
                        <div style={{ position: "absolute" as const, inset: 0, pointerEvents: "none" as const, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 6 }}>
                          <div style={{
                            width: "160%", height: "160%", borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(255,225,140,0.95) 0%, rgba(255,140,40,0.85) 35%, rgba(220,40,20,0.6) 60%, transparent 75%)",
                            animation: "bombBurst 0.7s ease-out forwards",
                          }} />
                        </div>
                      )}
                    </div>
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
            </div>

          </>
        );
      })()}

      {/* My seat + turn indicator - anchored just above the actual hand-card
          height (kept in sync with CardView's non-small clamp), instead of
          being driven by shared flex-flow like before. That decoupling
          avoided the old bug where resizing the cards pushed this badge
          upward as a side effect, but a *fixed* offset would itself get
          overtaken by the cards on larger screens (tablets etc., where the
          card height clamp grows past its floor) - referencing the same
          clamp() here keeps the two in lockstep at every viewport size.
          60px covers: the hand row's own bottom padding (8px) + a selected
          card's upward lift (translateY(-16px) + ~2.5% of its own height
          from scale(1.05)) + enough clearance that the gold glow around a
          lifted card doesn't visually reach the badge either. */}
      <div style={{
        position: "absolute" as const, bottom: "calc(clamp(114px, 15.75vmin, 192px) + 60px + max(8px, env(safe-area-inset-bottom)))",
        left: "50%", transform: "translateX(-50%)", zIndex: 10,
        display: "flex", flexDirection: "column" as const, alignItems: "center",
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
                {voice.enabled && (
                  <IconMic size={9} style={{ color: voice.speakingIds.has(session.user.id) ? C.success : "rgba(255,255,255,0.4)", flexShrink: 0 }} />
                )}
                {hasPlayed && <span style={{ fontSize: 9, color: C.gold }}>✓</span>}
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                <span style={{ ...cinzel, fontSize: "clamp(11px,2vmin,18px)", color: "#F4D03F", fontWeight: 700 }}>{p.score}</span>
                {hasBid ? (
                  <TrickPile tricksWon={p.tricks_won} bid={p.bid} />
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
      </div>

      {/* Hand cards - pinned flush to the true bottom edge, sized and
          positioned independently of the seat/turn-indicator group above. */}
      <div style={{
        position: "absolute" as const, bottom: "max(8px, env(safe-area-inset-bottom))", left: 0, right: 0, zIndex: 10,
        display: "flex", flexDirection: "column" as const, alignItems: "center",
      }}>
        <div style={{ display: "flex", gap: "clamp(3px,1vw,6px)", flexWrap: "nowrap", justifyContent: myHand.length > 6 ? "flex-start" : "center", overflowX: "auto", alignSelf: "stretch", width: "100%", maxWidth: "100vw", minWidth: 0, boxSizing: "border-box" as const, padding: "0 8px 8px", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {myHand.map((card: any) => (
            <CardView key={card.id} card={card}
              selected={selected === card.id}
              disabled={!isPlaying}
              faceDown={room.round === 1}
              onClick={isPlaying ? () => {
                if (selected !== card.id) {
                  // First tap: just lift the card, don't play it yet.
                  setSelected(card.id);
                  return;
                }
                // Second tap on the already-lifted card: confirm and play it.
                if (card.specialType === "wizardfool") {
                  setSpecialAction({ type: "wizardfool", cardId: card.id });
                } else if (card.specialType === "rainbow7") {
                  setSpecialAction({ type: "rainbow7suit", cardId: card.id });
                } else if (card.specialType === "rainbow9") {
                  setSpecialAction({ type: "rainbow9suit", cardId: card.id });
                } else {
                  act("playCard", { cardId: card.id });
                }
                setSelected(null);
              } : undefined}
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
            <span style={{ ...cinzel, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
              Nochmal tippen zum Ausspielen
            </span>
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
                  <button key={i} onClick={() => { act("bid", { bid: i }); setModalMinimized(true); }} disabled={i === dealerForbidden}
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
          {error} <IconX size={11} style={{ opacity: 0.7, verticalAlign: "-1px" }} />
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
      <WizardMascot size={50} />
      <div style={{ ...cinzel, fontSize: 14, color: C.ivoryDim, letterSpacing: 3 }}>WIZZO</div>
    </div>
  );

  return (
    <>
      {session ? <LobbyScreen session={session} /> : <AuthScreen />}
      <InstallBanner />
    </>
  );
}
