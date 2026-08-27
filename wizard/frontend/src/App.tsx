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

// ─── Redesign Design System (Menu/Social/Scoring screens) ─────────────────────
// Flat, hard-edged Archivo/Cinzel system for Auth/Lobby/Waiting Room/Round End/
// Rules/Friends/Stats/Profile — deliberately distinct from glass()/goldBtn()/
// segBtn() above, which stay untouched because the game table keeps its
// existing rounded/glass look exactly as-is. No border-radius anywhere here
// (per spec: "bewusst kantig"). Colors reuse the same C tokens.
const archivo: React.CSSProperties = { fontFamily: "'Archivo', system-ui, sans-serif" };

const flatLabel: React.CSSProperties = {
  ...archivo, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
  textTransform: "uppercase", color: C.ivoryDim,
};

const flatRule: React.CSSProperties = { height: 2, background: "rgba(201,168,76,0.45)" };
const flatRuleThin: React.CSSProperties = { height: 1, background: "rgba(201,168,76,0.22)" };

const flatScreen: React.CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column",
  background: C.bgDark, color: C.ivory, minHeight: "100dvh",
  boxSizing: "border-box",
};

const flatPrimaryBtn = (disabled = false): React.CSSProperties => ({
  ...archivo, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: 8, background: C.gold, color: C.bgDark, border: "none", fontWeight: 800, fontSize: 15,
  letterSpacing: "0.02em", padding: "17px 16px", cursor: disabled ? "default" : "pointer",
  textAlign: "left", minHeight: 52, opacity: disabled ? 0.4 : 1,
  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
});

const flatGhostBtn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  ...archivo, background: "transparent", border: "2px solid rgba(201,168,76,0.4)", color: C.ivory,
  fontWeight: 800, fontSize: 12, letterSpacing: "0.04em", padding: "11px 14px", cursor: "pointer",
  textAlign: "left", minHeight: 44, WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
  ...extra,
});

// Segmented pair (login/register, edition, player count …) - flat variant
const flatSegTrack: React.CSSProperties = {
  display: "flex", border: "2px solid rgba(201,168,76,0.4)",
};
const flatSegBtn = (active: boolean): React.CSSProperties => ({
  ...archivo, flex: 1, padding: 12, minHeight: 44, fontWeight: 800, fontSize: 12,
  background: active ? C.gold : "transparent", color: active ? C.bgDark : C.ivory,
  border: "none", cursor: "pointer",
  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
});

const flatInput: React.CSSProperties = {
  ...archivo, border: "2px solid rgba(201,168,76,0.3)", padding: "13px 12px",
  fontWeight: 500, fontSize: 16, color: C.ivory, background: "transparent",
  width: "100%", boxSizing: "border-box", outline: "none", WebkitAppearance: "none",
};

// Kennzahl-Feld (stat tile in a bordered grid)
const flatStat: React.CSSProperties = {
  padding: "13px 14px", borderRight: "1px solid rgba(201,168,76,0.22)",
  borderBottom: "1px solid rgba(201,168,76,0.22)",
};

// List row (friends, waiting room seats, history …)
const flatRow = (first = false): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 10, padding: "11px 0",
  borderBottom: "1px solid rgba(201,168,76,0.22)",
  ...(first ? { borderTop: "2px solid rgba(201,168,76,0.45)" } : {}),
});

// Bottom tab bar - only rendered on Startseite/Freunde/Statistik/Profil (per
// spec, everywhere else - table, waiting room, rules, scoreboard, round end -
// stays without it so those screens keep every pixel of vertical space).
type TabKey = "home" | "friends" | "stats" | "profile";
function TabBar({ active, onChange, friendBadge, onlineFriendCount }: { active: TabKey; onChange: (t: TabKey) => void; friendBadge?: number; onlineFriendCount?: number }) {
  const tabBtn = (on: boolean): React.CSSProperties => ({
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    padding: "9px 0 4px", border: "none", borderTop: `3px solid ${on ? C.gold : "transparent"}`,
    background: "transparent", cursor: "pointer", ...archivo, fontWeight: 600, fontSize: 9,
    letterSpacing: "0.09em", textTransform: "uppercase", color: on ? C.gold : C.ivoryDim,
    minHeight: 44, position: "relative",
  });
  return (
    <div style={{ position: "fixed" as const, left: 0, right: 0, bottom: 0, zIndex: 50, borderTop: "2px solid rgba(201,168,76,0.45)", background: C.bgDark, display: "flex", paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
      <button onClick={() => onChange("home")} style={tabBtn(active === "home")}><IconHome size={19} />Spielen</button>
      <button onClick={() => onChange("friends")} style={tabBtn(active === "friends")}>
        <IconUsers size={19} />Freunde
        {!!friendBadge && (
          <span style={{ position: "absolute", top: 2, right: "28%", background: C.error, color: "#fff", fontSize: 9, fontWeight: 700, minWidth: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
            {friendBadge}
          </span>
        )}
        {!!onlineFriendCount && (
          <span style={{ position: "absolute", top: 2, left: "28%", background: C.success, color: "#fff", fontSize: 9, fontWeight: 700, minWidth: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", borderRadius: "50%" }}>
            {onlineFriendCount}
          </span>
        )}
      </button>
      <button onClick={() => onChange("stats")} style={tabBtn(active === "stats")}><IconBarChart size={19} />Statistik</button>
      <button onClick={() => onChange("profile")} style={tabBtn(active === "profile")}><IconSettings size={19} />Profil</button>
    </div>
  );
}



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

// ─── Redesign Design System: Rechenblock (Papier-Palette, flach) ──────────────
// Same "no border-radius" language as flat* above, just in PAPER colors -
// this is the one screen in the redesign that's paper-themed, not dark.
const paperFlatScreen: React.CSSProperties = {
  flex: 1, display: "flex", flexDirection: "column",
  background: PAPER.bg, color: PAPER.ink, boxSizing: "border-box",
};
const paperFlatLabel: React.CSSProperties = {
  ...archivo, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em",
  textTransform: "uppercase", color: PAPER.inkDim,
};
const paperFlatRule: React.CSSProperties = { height: 2, background: "rgba(90,68,38,0.3)" };
const paperFlatPrimaryBtn = (disabled = false): React.CSSProperties => ({
  ...archivo, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: 8, background: PAPER.gold, color: PAPER.panel, border: "none", fontWeight: 800, fontSize: 15,
  letterSpacing: "0.02em", padding: "17px 16px", cursor: disabled ? "default" : "pointer",
  textAlign: "left", minHeight: 52, opacity: disabled ? 0.4 : 1,
  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
});
const paperFlatGhostBtn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  ...archivo, background: "transparent", border: `2px solid rgba(90,68,38,0.3)`, color: PAPER.ink,
  fontWeight: 800, fontSize: 12, letterSpacing: "0.04em", padding: "11px 14px", cursor: "pointer",
  textAlign: "left", minHeight: 44, WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
  ...extra,
});
const paperFlatSegTrack: React.CSSProperties = { display: "flex", border: `2px solid rgba(90,68,38,0.3)` };
const paperFlatSegBtn = (active: boolean): React.CSSProperties => ({
  ...archivo, flex: 1, padding: 12, minHeight: 44, fontWeight: 800, fontSize: 12,
  background: active ? PAPER.gold : "transparent", color: active ? PAPER.panel : PAPER.ink,
  border: "none", cursor: "pointer",
  WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
});
const paperFlatInput: React.CSSProperties = {
  ...archivo, border: `1px solid rgba(90,68,38,0.3)`, padding: "12px 13px",
  fontWeight: 500, fontSize: 15, color: PAPER.ink, background: PAPER.panel,
  width: "100%", boxSizing: "border-box", outline: "none", WebkitAppearance: "none",
};
const paperFlatCard: React.CSSProperties = {
  background: PAPER.panelAlt, borderTop: "2px solid rgba(90,68,38,0.3)", padding: "9px 10px", marginBottom: 6,
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
    <div style={{ ...flatScreen, padding: "74px 22px 30px" }} className="fade-in">
      <div style={{ ...archivo, fontWeight: 800, fontSize: 52, lineHeight: 0.92, letterSpacing: "-0.03em", color: C.ivory }}>WIZZO</div>
      <div style={{ width: 72, height: 5, background: C.gold, margin: "12px 0 10px" }} />
      <div style={flatLabel}>Das Kartenspiel</div>
      <div style={{ ...flatRule, margin: "26px 0 22px" }} />

      <div style={{ ...flatSegTrack, marginBottom: 22 }}>
        <button onClick={() => { setMode("login"); setError(""); }} style={flatSegBtn(mode === "login")}>Anmelden</button>
        <button onClick={() => { setMode("register"); setError(""); }} style={flatSegBtn(mode === "register")}>Registrieren</button>
      </div>

      <div style={{ ...flatLabel, marginBottom: 6 }}>Name</div>
      <input value={username} onChange={e => setUsername(e.target.value)}
        placeholder="Dein Name" style={{ ...flatInput, marginBottom: 18 }} autoFocus
        onKeyDown={e => e.key === "Enter" && handleSubmit()} />

      <div style={{ ...flatLabel, marginBottom: 6 }}>Passwort</div>
      <input value={password} onChange={e => setPassword(e.target.value)}
        placeholder="Passwort" type="password" style={{ ...flatInput, marginBottom: 26 }}
        onKeyDown={e => e.key === "Enter" && handleSubmit()} />

      <button onClick={handleSubmit} disabled={loading} style={flatPrimaryBtn(loading)}>
        {loading ? "…" : mode === "login" ? "ANMELDEN" : "KONTO ANLEGEN"}
        <span style={{ fontSize: 18 }}>→</span>
      </button>

      {error && (
        <div style={{ background: `${C.error}22`, border: `1px solid ${C.error}55`, padding: "8px 12px", fontSize: 12, color: "#FF8080", textAlign: "center", marginTop: 14 }}>
          {error}
        </div>
      )}

      <div style={{ marginTop: "auto", ...archivo, fontWeight: 400, fontSize: 11, lineHeight: 1.5, color: C.ivoryDim, paddingTop: 20 }}>
        Kein Passwort vergeben? Der Login funktioniert weiter mit dem Namen allein — genau wie heute.
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
function ProfileScreen({ session }: { session: Session }) {
  const username = session.user.user_metadata?.username ?? "Spieler";
  const [nameInput, setNameInput] = useState(username);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Header meta: "Seit ... · N Partien" - createdAt from profiles (own row,
  // readable via RLS), games_played from user_stats (already aggregated).
  const [profileMeta, setProfileMeta] = useState<{ createdAt: string | null; gamesPlayed: number }>({ createdAt: null, gamesPlayed: 0 });
  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("created_at").eq("id", session.user.id).single(),
      supabase.from("user_stats").select("games_played").eq("id", session.user.id).single(),
    ]).then(([{ data: p }, { data: s }]) => {
      setProfileMeta({ createdAt: p?.created_at ?? null, gamesPlayed: s?.games_played ?? 0 });
    });
  }, [session.user.id]);

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
    else { setPwMsg({ text: "Passwort geändert ✓", ok: true }); setPw1(""); setPw2(""); setPwOpen(false); }
  }

  return (
    <div style={{ ...flatScreen, minHeight: "auto" }} className="fade-in">
      <div style={{ padding: "56px 18px 12px" }}>
        <div style={{ ...archivo, fontWeight: 800, fontSize: 19, lineHeight: 1 }}>PROFIL</div>
      </div>
      <div style={flatRule} />

      <div style={{ padding: "22px 18px 0", display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 72, height: 72, flexShrink: 0, background: avatarUrl ? `url(${avatarUrl}) center/cover` : avatarColor(session.user.id), display: "flex", alignItems: "center", justifyContent: "center", ...archivo, fontWeight: 800, fontSize: 30, color: "#fff" }}>
          {!avatarUrl && username.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>{username}</div>
          <div style={{ ...archivo, fontWeight: 400, fontSize: 12, color: C.ivoryDim, marginTop: 3 }}>
            {profileMeta.createdAt ? `Seit ${new Date(profileMeta.createdAt).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}` : ""} · {profileMeta.gamesPlayed} Partien
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
              style={flatGhostBtn({ fontSize: 11, padding: "8px 12px", minHeight: 36, opacity: avatarUploading ? 0.5 : 1 })}>
              {avatarUploading ? "…" : "BILD ÄNDERN"}
            </button>
            {avatarUrl && (
              <button onClick={removeAvatar} disabled={avatarUploading}
                style={flatGhostBtn({ fontSize: 11, padding: "8px 12px", minHeight: 36, opacity: avatarUploading ? 0.5 : 1 })}>
                ENTFERNEN
              </button>
            )}
          </div>
          {avatarMsg && <div style={{ fontSize: 11, color: avatarMsg.ok ? C.success : C.error, marginTop: 6 }}>{avatarMsg.text}</div>}
        </div>
      </div>

      <div style={{ padding: "26px 18px 0" }}>
        <div style={{ ...flatLabel, marginBottom: 6 }}>Name</div>
        <input value={nameInput} onChange={e => { setNameInput(e.target.value); setNameMsg(null); }}
          placeholder="Dein Name" style={flatInput} maxLength={24}
          onKeyDown={e => e.key === "Enter" && saveName()} />
        <button onClick={saveName} disabled={nameSaving || !nameInput.trim() || nameInput.trim() === username}
          style={{ ...flatPrimaryBtn(nameSaving || !nameInput.trim() || nameInput.trim() === username), marginTop: 9, padding: "13px 0", fontSize: 13, justifyContent: "center" }}>
          {nameSaving ? "…" : nameInput.trim() === username ? "NAME GESPEICHERT" : "NAMEN SPEICHERN"}
        </button>
        {nameMsg && <div style={{ fontSize: 12, color: nameMsg.ok ? C.success : "#FF8080", textAlign: "center", marginTop: 8 }}>{nameMsg.text}</div>}
      </div>

      <div style={{ padding: "22px 18px 0" }}>
        <div style={{ ...flatLabel, marginBottom: 6 }}>Passwort</div>
        {!pwOpen ? (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, ...flatInput, color: C.ivoryDim, display: "flex", alignItems: "center" }}>••••••••</div>
            <button onClick={() => setPwOpen(true)} style={flatGhostBtn({ minHeight: "auto" })}>ÄNDERN</button>
          </div>
        ) : (
          <>
            <input value={pw1} onChange={e => { setPw1(e.target.value); setPwMsg(null); }}
              placeholder="Neues Passwort" type="password" style={{ ...flatInput, marginBottom: 8 }} autoComplete="new-password" />
            <input value={pw2} onChange={e => { setPw2(e.target.value); setPwMsg(null); }}
              placeholder="Passwort bestätigen" type="password" style={flatInput} autoComplete="new-password"
              onKeyDown={e => e.key === "Enter" && savePassword()} />
            <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
              <button onClick={() => { setPwOpen(false); setPw1(""); setPw2(""); setPwMsg(null); }} style={flatGhostBtn({ flex: 1, textAlign: "center", justifyContent: "center", display: "flex" })}>ABBRECHEN</button>
              <button onClick={savePassword} disabled={pwSaving || !pw1 || !pw2}
                style={{ ...flatPrimaryBtn(pwSaving || !pw1 || !pw2), flex: 1, justifyContent: "center", padding: "11px 0", fontSize: 12 }}>
                {pwSaving ? "…" : "SPEICHERN"}
              </button>
            </div>
          </>
        )}
        {pwMsg && <div style={{ fontSize: 12, color: pwMsg.ok ? C.success : "#FF8080", textAlign: "center", marginTop: 8 }}>{pwMsg.text}</div>}
      </div>

      {pushSupported && (
        <div style={{ padding: "22px 18px 0" }}>
          <div style={{ ...flatLabel, marginBottom: 4 }}>Benachrichtigungen</div>
          <div style={flatRow(true)}>
            <div style={{ flex: 1 }}>
              <div style={{ ...archivo, fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>„Du bist dran"</div>
              <div style={{ ...archivo, fontWeight: 400, fontSize: 11, color: C.ivoryDim, marginTop: 2 }}>Push, sobald du am Zug bist</div>
            </div>
            <button onClick={togglePush} disabled={pushBusy} style={{
              ...archivo, fontWeight: 800, fontSize: 11, minHeight: 36, padding: "0 14px", border: "none", cursor: "pointer",
              background: pushEnabled ? C.gold : "rgba(255,255,255,0.07)", color: pushEnabled ? C.bgDark : C.ivoryDim,
              opacity: pushBusy ? 0.5 : 1,
            }}>
              {pushBusy ? "…" : pushEnabled ? "AN" : "AUS"}
            </button>
          </div>
          {pushMsg && <div style={{ fontSize: 11, color: pushMsg.ok ? C.success : "#FF8080", marginTop: 6 }}>{pushMsg.text}</div>}
        </div>
      )}

      <div style={{ padding: "26px 18px 30px" }}>
        <button onClick={() => supabase.auth.signOut()}
          style={flatGhostBtn({ width: "100%", textAlign: "center", justifyContent: "center", display: "flex", boxSizing: "border-box", color: C.error, borderColor: "rgba(207,68,68,0.6)" })}>
          ABMELDEN
        </button>
      </div>
    </div>
  );
}

// ─── Friends Screen ───────────────────────────────────────────────────────────
function FriendsScreen({ session, onClose, onlineUserIds, onSpectate }: { session: Session; onClose: () => void; onlineUserIds: Set<string>; onSpectate: (roomId: string) => void }) {
  const uid = session.user.id;
  const [rows, setRows] = useState<any[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewingFriend, setViewingFriend] = useState<{ id: string; name: string; avatar: string | null } | null>(null);

  // Rooms where an accepted friend is currently seated (lobby through active
  // play - friends_active_rooms drops a room the moment their room_players
  // row disappears). Polled rather than realtime-subscribed: this panel is
  // only open briefly, and the discovery view already re-derives everything
  // from auth.uid() server-side on every read, so a cheap 10s refresh is
  // plenty to catch a friend starting a new game while the panel is open.
  const [activeRooms, setActiveRooms] = useState<any[] | null>(null);
  const [spectatingId, setSpectatingId] = useState<string | null>(null);
  const loadActiveRooms = useCallback(() => {
    supabase.from("friends_active_rooms").select("*").then(({ data, error }) => {
      if (error) { console.error("[FriendsScreen] friends_active_rooms fetch failed:", error.message); return; }
      setActiveRooms(data ?? []);
    });
  }, []);
  useEffect(() => {
    loadActiveRooms();
    const poll = setInterval(loadActiveRooms, 10000);
    return () => clearInterval(poll);
  }, [loadActiveRooms]);

  async function spectate(roomId: string) {
    if (spectatingId) return;
    setSpectatingId(roomId);
    const res = await callGameAction(roomId, "spectateRoom", {});
    setSpectatingId(null);
    if (res.error) { setMsg({ text: res.error, ok: false }); return; }
    onSpectate(roomId);
  }

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
  const onlineFriendCount = accepted.filter((f: any) => onlineUserIds.has(f.requester_id === uid ? f.addressee_id : f.requester_id)).length;

  // Deliberately can't tell the caller whether targetUsername exists, is
  // already a friend, or is themself - see the sendFriendRequest case in
  // the edge function for why. The same generic message covers a real
  // send and a silent no-op alike; only a genuine rate-limit error (too
  // many unsuccessful lookups) is shown differently, since that reveals
  // nothing about any specific username.
  async function sendRequest() {
    const uname = query.trim();
    if (!uname) return;
    setSending(true); setMsg(null);
    const res = await callGameAction("", "sendFriendRequest", { username: uname });
    setSending(false);
    setQuery("");
    if (res?.error) setMsg({ text: res.error, ok: false });
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

  if (viewingFriend) return (
    <FriendProfileScreen friendId={viewingFriend.id} friendName={viewingFriend.name} friendAvatar={viewingFriend.avatar}
      onBack={() => setViewingFriend(null)} />
  );

  return (
    <div style={{ ...flatScreen, minHeight: "auto" }} className="fade-in">
      <div style={{ padding: "56px 18px 12px", display: "flex", alignItems: "baseline" }}>
        <div style={{ ...archivo, fontWeight: 800, fontSize: 19, lineHeight: 1 }}>FREUNDE</div>
        <div style={{ ...flatLabel, marginLeft: "auto" }}>{accepted.length} Freunde{onlineFriendCount > 0 ? ` · ${onlineFriendCount} Online` : ""}</div>
      </div>
      <div style={flatRule} />

      <div style={{ padding: "22px 18px 0" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Username eingeben"
            style={{ ...flatInput, flex: 1 }} onKeyDown={e => e.key === "Enter" && sendRequest()} />
          <button onClick={sendRequest} disabled={sending || !query.trim()} style={flatPrimaryBtn(sending || !query.trim())}>
            {sending ? "…" : "SENDEN"}
          </button>
        </div>
        {msg && <div style={{ fontSize: 11, color: msg.ok ? C.success : C.error, marginTop: 8 }}>{msg.text}</div>}
      </div>

      {incoming.length > 0 && (
        <div style={{ padding: "22px 18px 0" }}>
          <div style={{ ...flatLabel, marginBottom: 4 }}>Offene Anfragen · {incoming.length}</div>
          {incoming.map((f: any, i: number) => (
            <div key={f.id} style={flatRow(i === 0)}>
              <div style={{ width: 26, height: 26, background: avatarColor(f.requester_id), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", ...archivo, fontWeight: 600, fontSize: 11, flexShrink: 0 }}>
                {(names[f.requester_id] ?? "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, ...archivo, fontWeight: 600, fontSize: 14 }}>{names[f.requester_id] ?? "…"}</div>
              <button onClick={() => accept(f.id)} disabled={busyId === f.id} style={flatPrimaryBtn(busyId === f.id)}>ANNEHMEN</button>
              <button onClick={() => remove(f.id)} disabled={busyId === f.id} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", display: "flex", padding: 4 }}><IconX size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: "22px 18px 0" }}>
        <div style={{ ...flatLabel, marginBottom: 4 }}>Meine Freunde</div>
        {rows === null ? (
          [0, 1, 2].map(i => (
            <div key={i} style={flatRow(i === 0)}>
              <div className="skeleton" style={{ width: 8, height: 8, borderRadius: "50%" }} />
              <div className="skeleton" style={{ width: `${90 - i * 18}px`, height: 13 }} />
            </div>
          ))
        ) : accepted.length === 0 ? (
          <div style={{ ...flatRow(true), ...archivo, fontWeight: 400, fontSize: 12, color: C.ivoryDim }}>Noch keine Freunde – oben nach Usernamen suchen</div>
        ) : accepted.map((f: any, i: number) => {
          const otherId = f.requester_id === uid ? f.addressee_id : f.requester_id;
          const online = onlineUserIds.has(otherId);
          const activeRoom = (activeRooms ?? []).find(r => r.friend_user_id === otherId);
          return (
            <div key={f.id} style={flatRow(i === 0)}>
              <div style={{ width: 8, height: 8, background: online ? C.success : "rgba(255,255,255,0.25)", flexShrink: 0 }} />
              <button onClick={() => setViewingFriend({ id: otherId, name: names[otherId] ?? "Spieler", avatar: avatars[otherId] ?? null })}
                style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "inherit" }}>
                <div style={{ ...archivo, fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>{names[otherId] ?? "…"}</div>
                <div style={{ ...archivo, fontWeight: 400, fontSize: 11, color: C.ivoryDim, marginTop: 1 }}>
                  {activeRoom ? `Spielt gerade · Runde ${activeRoom.round}` : online ? "Online" : "Offline"}
                </div>
              </button>
              {activeRoom ? (
                <button onClick={() => spectate(activeRoom.room_id)} disabled={spectatingId === activeRoom.room_id}
                  style={flatGhostBtn({ fontSize: 11, padding: "8px 11px", minHeight: 36, opacity: spectatingId === activeRoom.room_id ? 0.5 : 1 })}>ZUSCHAUEN</button>
              ) : (
                <button disabled={!online} style={flatGhostBtn({ fontSize: 11, padding: "8px 11px", minHeight: 36, opacity: online ? 1 : 0.4 })}>EINLADEN</button>
              )}
              <button onClick={() => { if (confirm(`${names[otherId] ?? "Diesen Freund"} wirklich entfernen?`)) remove(f.id); }} disabled={busyId === f.id}
                style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", display: "flex", padding: 4 }}><IconX size={16} /></button>
            </div>
          );
        })}
      </div>

      {outgoing.length > 0 && (
        <div style={{ padding: "22px 18px 30px" }}>
          <div style={{ ...flatLabel, marginBottom: 4 }}>Ausstehend</div>
          {outgoing.map((f: any, i: number) => (
            <div key={f.id} style={flatRow(i === 0)}>
              <div style={{ flex: 1, ...archivo, fontWeight: 400, fontSize: 12, color: C.ivoryDim }}>{names[f.addressee_id] ?? "…"}</div>
              <button onClick={() => remove(f.id)} disabled={busyId === f.id}
                style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", ...archivo, fontSize: 11 }}>Zurückziehen</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Friend Profile (read-only: avatar, member-since, user_stats) ─────────
// user_stats is already readable for any id, not just the caller's own -
// same broad game_stats/profiles select policies the caller's own
// StatsScreen relies on - so this needs no new RLS or migration.
function FriendProfileScreen({ friendId, friendName, friendAvatar, onBack }: { friendId: string; friendName: string; friendAvatar: string | null; onBack: () => void }) {
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    supabase.from("profiles").select("created_at").eq("id", friendId).single().then(({ data }) => setCreatedAt(data?.created_at ?? null));
    supabase.from("user_stats").select("*").eq("id", friendId).single().then(({ data }) => setStats(data ?? null));
  }, [friendId]);

  const accuracyPct = stats?.bid_accuracy_pct != null ? Math.round(stats.bid_accuracy_pct) : 0;

  return (
    <div style={{ ...flatScreen, minHeight: "auto" }} className="fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "56px 18px 12px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", ...archivo, fontWeight: 800, fontSize: 12, color: C.ivory, cursor: "pointer", padding: 0, minHeight: 44, display: "flex", alignItems: "center", gap: 6 }}>← ZURÜCK</button>
        <div style={{ ...flatLabel, marginLeft: "auto" }}>Profil</div>
      </div>
      <div style={flatRule} />

      <div style={{ padding: "22px 18px 20px", display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 72, height: 72, flexShrink: 0, background: friendAvatar ? `url(${friendAvatar}) center/cover` : avatarColor(friendId), display: "flex", alignItems: "center", justifyContent: "center", ...archivo, fontWeight: 800, fontSize: 30, color: "#fff" }}>
          {!friendAvatar && friendName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>{friendName}</div>
          <div style={{ ...archivo, fontWeight: 400, fontSize: 12, color: C.ivoryDim, marginTop: 3 }}>
            {createdAt ? `Seit ${new Date(createdAt).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}` : ""} · {stats?.games_played ?? 0} Partien
          </div>
        </div>
      </div>
      <div style={flatRuleThin} />

      <div style={{ display: "flex", flexWrap: "wrap" }}>
        <div style={{ ...flatStat, width: "50%", boxSizing: "border-box" }}>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{stats?.games_played ?? 0}</div>
          <div style={{ ...flatLabel, marginTop: 6 }}>Spiele</div>
        </div>
        <div style={{ ...flatStat, width: "50%", boxSizing: "border-box", borderRight: "none" }}>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{stats?.games_won ?? 0}</div>
          <div style={{ ...flatLabel, marginTop: 6 }}>Siege</div>
        </div>
        <div style={{ ...flatStat, width: "50%", boxSizing: "border-box" }}>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{stats?.avg_score ?? 0}</div>
          <div style={{ ...flatLabel, marginTop: 6 }}>Ø Punkte</div>
        </div>
        <div style={{ ...flatStat, width: "50%", boxSizing: "border-box", borderRight: "none" }}>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{stats?.avg_placement != null ? String(stats.avg_placement).replace(".", ",") : "–"}</div>
          <div style={{ ...flatLabel, marginTop: 6 }}>Ø Platz</div>
        </div>
      </div>

      <div style={{ padding: "22px 18px 30px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={flatLabel}>Trefferquote der Ansagen</div>
          <div style={{ marginLeft: "auto", ...archivo, fontWeight: 800, fontSize: 22, lineHeight: 1, color: C.gold }}>{accuracyPct}%</div>
        </div>
        <div style={{ height: 14, background: "rgba(255,255,255,0.07)", marginTop: 10, display: "flex" }}>
          <div style={{ width: `${accuracyPct}%`, background: C.gold }} />
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
      <div style={paperFlatCard}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, ...archivo, fontWeight: 600, fontSize: 14, color: PAPER.ink }}>{slot.name}</div>
          <span style={{ ...archivo, fontWeight: 600, fontSize: 10, color: PAPER.success }}>VERKNÜPFT</span>
          <button onClick={() => { onChange({ userId: null, name: "" }); setQuery(""); }}
            style={{ background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", display: "flex" }}><IconX size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...paperFlatCard, position: "relative" }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange({ userId: null, name: e.target.value }); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={`Spieler ${index + 1}: Name oder Nutzer suchen…`}
        style={{ ...paperFlatInput, fontSize: 13, padding: "9px 12px", border: "none", background: "transparent" }}
        maxLength={24}
      />
      {query.trim().length >= 2 && results.length === 0 && (
        <div style={{ ...archivo, fontWeight: 400, fontSize: 10.5, color: PAPER.inkDim, marginTop: 4 }}>
          Kein Treffer — wird als Gast „{query.trim()}" geführt. Punkte zählen nur in dieser Partie.
        </div>
      )}
      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 10, background: PAPER.panel, border: `1px solid ${PAPER.line}`, maxHeight: 170, overflowY: "auto" }}>
          {results.map(r => (
            <button key={r.id} onMouseDown={() => { onChange({ userId: r.id, name: r.username }); setQuery(r.username); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", color: PAPER.ink, padding: "8px 10px", fontSize: 13, cursor: "pointer" }}>
              <div style={{ width: 22, height: 22, background: PAPER.gold, color: PAPER.panel, display: "flex", alignItems: "center", justifyContent: "center", ...archivo, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                {r.username.charAt(0).toUpperCase()}
              </div>
              <span style={{ ...archivo, fontWeight: 500, fontSize: 13, flex: 1 }}>{r.username}</span>
              <span style={{ ...archivo, fontWeight: 600, fontSize: 10, color: PAPER.success }}>Nutzer</span>
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
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <button onClick={() => setStage("roster")} style={{ background: "none", border: "none", ...archivo, fontWeight: 800, fontSize: 12, color: PAPER.ink, cursor: "pointer", padding: 0, minHeight: 44, display: "flex", alignItems: "center", gap: 6 }}>← ZURÜCK</button>
        </div>
        <div style={{ ...paperHand, fontSize: 26, color: PAPER.ink, marginBottom: 4 }}>Reihenfolge festlegen</div>
        <div style={{ ...archivo, fontWeight: 400, fontSize: 13, color: PAPER.inkDim, marginBottom: 16 }}>So wie ihr am Tisch sitzt — bestimmt Geber- und Bietreihenfolge. Zum Sortieren ziehen.</div>
        <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {slots.map((s, i) => {
            const isDragging = dragId === s.id;
            const isMe = s.userId === uid;
            return (
              <div key={s.id} ref={el => { rowRefs.current[i] = el; }}
                style={{
                  ...paperFlatCard,
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 6,
                  position: isDragging ? "relative" : undefined,
                  transform: isDragging ? `translateY(${dragOffsetY}px)` : undefined,
                  zIndex: isDragging ? 10 : undefined,
                  boxShadow: isDragging ? `0 10px 26px ${PAPER.shadow}` : undefined,
                }}>
                <span style={{ ...paperHand, fontSize: 18, color: PAPER.gold, minWidth: 20 }}>{i + 1}.</span>
                <span style={{ flex: 1, ...archivo, fontWeight: 600, fontSize: 14, color: PAPER.ink }}>{s.name}</span>
                {isMe && i === 0 && (
                  <span style={{ ...archivo, fontWeight: 700, fontSize: 10, color: PAPER.gold, whiteSpace: "nowrap" }}>DU · GIBT R1</span>
                )}
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
        <div style={{ marginTop: 18 }}>
          <button onClick={start} disabled={loading} style={paperFlatPrimaryBtn(loading)}>
            {loading ? "…" : "SPIEL STARTEN"}<span style={{ fontSize: 18 }}>→</span>
          </button>
        </div>
        {error && <div style={{ color: PAPER.danger, fontSize: 12, textAlign: "center", marginTop: 10 }}>{error}</div>}
      </div>
    );
  }

  const openSlots = slots.filter(s => !s.name.trim()).length;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ ...paperHand, fontSize: 34, color: PAPER.ink }}>Neues Spiel erfassen</div>
      <div style={{ ...archivo, fontWeight: 400, fontSize: 13, color: PAPER.inkDim, marginTop: 4, marginBottom: 18 }}>
        Registrierte Nutzer suchen — dann landet die Partie auch in deren Statistik. Gäste einfach als Namen eintragen.
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ ...paperFlatLabel, marginBottom: 8 }}>EDITION</div>
        <div style={paperFlatSegTrack}>
          <button onClick={() => setEdition("classic")} style={paperFlatSegBtn(edition === "classic")}>Classic</button>
          <button onClick={() => setEdition("anniversary")} style={paperFlatSegBtn(edition === "anniversary")}>30 Jahre</button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ ...paperFlatLabel, marginBottom: 8 }}>SPIELERANZAHL</div>
        <div style={{ display: "flex" }}>
          {[3, 4, 5, 6].map(n => (
            <button key={n} onClick={() => changeCount(n)} style={paperFlatSegBtn(count === n)}>{n}</button>
          ))}
        </div>
        <div style={{ ...archivo, fontWeight: 400, fontSize: 10.5, color: PAPER.inkDim, marginTop: 6 }}>{Math.floor(60 / count)} Runden · Geber wechselt jede Runde</div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ ...paperFlatLabel, marginBottom: 8 }}>MITSPIELER · REIHENFOLGE AM TISCH</div>
        {slots.map((s, i) => (
          <ManualPlayerSlot key={s.id} index={i} slot={s} excludeIds={excludeIds}
            onChange={v => setSlots(prev => prev.map((p, pi) => pi === i ? { ...p, ...v } : p))} />
        ))}
      </div>

      {openSlots > 0 && (
        <div style={{ color: PAPER.danger, background: "rgba(162,58,46,0.1)", border: "1px solid rgba(162,58,46,0.35)", padding: "8px 12px", fontSize: 11.5, marginTop: 10 }}>
          Noch {openSlots} Mitspieler offen.
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <button onClick={goToOrder} disabled={openSlots > 0} style={paperFlatPrimaryBtn(openSlots > 0)}>
          WEITER → REIHENFOLGE<span style={{ fontSize: 18 }}>→</span>
        </button>
      </div>
      {error && <div style={{ color: PAPER.danger, fontSize: 12, textAlign: "center", marginTop: 10 }}>{error}</div>}

      {pastGames.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div style={{ ...paperFlatLabel, marginBottom: 4 }}>FRÜHERE SPIELE</div>
          {pastGames.slice(0, 8).map((g, i) => (
            <button key={g.id} onClick={() => onViewGame(g)}
              style={{ display: "flex", justifyContent: "space-between", width: "100%", background: "none", border: "none", borderTop: i === 0 ? "2px solid rgba(90,68,38,0.3)" : `1px solid ${PAPER.lineFaint}`, ...archivo, fontWeight: 400, fontSize: 12, color: PAPER.inkDim, padding: "10px 0", cursor: "pointer", textAlign: "left" }}>
              <span>{g.edition === "anniversary" ? "30 Jahre" : "Classic"} · {g.max_rounds} Runden</span>
              <span>{new Date(g.created_at).toLocaleDateString("de-DE")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
      <div style={{ width: "100%", overflowX: "auto" }}>
        <div style={{ ...paperHand, fontSize: 26, color: PAPER.ink }}>{game.edition === "anniversary" ? "30 Jahre" : "Classic"} · {players.length} Spieler</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2, marginBottom: 14 }}>
          <div style={paperFlatLabel}>Runde {Math.min(currentRoundNum, game.max_rounds)}/{game.max_rounds}</div>
          <button onClick={discard} style={{ background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", ...archivo, fontWeight: 600, fontSize: 11 }}>Verwerfen</button>
        </div>
        <div style={{ background: PAPER.panel, border: `1px solid ${PAPER.line}`, padding: 12 }}>
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
                          style={{ ...paperFlatInput, width: 36, padding: "5px 2px", fontSize: 12, textAlign: "center" }} />
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
        </div>
        {editingRound !== null && (() => {
          const r = rounds.find(x => x.round === editingRound);
          if (!r) return null;
          return (
            <div style={{ marginTop: 10, background: PAPER.panelAlt, border: `1px solid ${PAPER.line}`, padding: 12 }}>
              <div style={{ ...paperHand, fontSize: 17, color: PAPER.goldDeep, marginBottom: 8 }}>Runde {editingRound} korrigieren</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {players.map(p => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, ...archivo, fontWeight: 500, fontSize: 12.5, color: PAPER.ink }}>{p.display_name}</span>
                    <input type="number" min={0} max={editingRound} placeholder="Ansage" value={editBid[p.player_index] ?? ""}
                      onChange={e => setEditBid(prev => ({ ...prev, [p.player_index]: e.target.value }))}
                      style={{ ...paperFlatInput, width: 52, padding: "5px 4px", fontSize: 12, textAlign: "center" }} />
                    <span style={{ fontSize: 11.5, color: PAPER.inkDim }}>/</span>
                    <input type="number" min={0} max={editingRound} placeholder="Stiche" value={editGot[p.player_index] ?? ""}
                      onChange={e => setEditGot(prev => ({ ...prev, [p.player_index]: e.target.value }))}
                      style={{ ...paperFlatInput, width: 52, padding: "5px 4px", fontSize: 12, textAlign: "center" }} />
                  </div>
                ))}
              </div>
              {editError && <div style={{ color: PAPER.danger, fontSize: 11, marginTop: 8 }}>{editError}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={cancelEditRound} style={paperFlatGhostBtn({ flex: 1, textAlign: "center", justifyContent: "center", display: "flex", fontSize: 12.5, minHeight: 38 })}>Abbrechen</button>
                <button onClick={() => saveEditedRound(r)} disabled={editSaving} style={{ ...paperFlatPrimaryBtn(editSaving), flex: 1, justifyContent: "center", padding: "8px 0", fontSize: 12.5, minHeight: 38 }}>
                  {editSaving ? "…" : "Speichern"}
                </button>
              </div>
            </div>
          );
        })()}
        {!isDone && pendingBids && nextGoter && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8, gap: 8 }}>
              <div>
                <div style={{ ...paperHand, fontSize: 17, color: PAPER.goldDeep, lineHeight: 1.2 }}>
                  Wie viele Stiche hat <span style={{ color: PAPER.ink }}>{nextGoter.display_name}</span> geholt?
                </div>
              </div>
              <div style={{ ...paperFlatLabel, whiteSpace: "nowrap", flexShrink: 0 }}>Ergebnis · 0–{currentRoundNum}</div>
            </div>
            {players.some(p => gots[p.player_index] !== undefined) && (
              <button onClick={undoLastGot} style={{ background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 11, padding: "2px 0", marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <IconArrowLeft size={11} /> zurück
              </button>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {Array.from({ length: currentRoundNum + 1 }, (_, i) => (
                <button key={i} onClick={() => recordGot(nextGoter.player_index, i)} disabled={saving}
                  style={paperFlatGhostBtn({ flex: 1, minWidth: 44, textAlign: "center", justifyContent: "center", display: "flex", padding: "9px 0", fontSize: 17, opacity: saving ? 0.5 : 1 })}>
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}
        {!isDone && !pendingBids && nextBidder && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8, gap: 8 }}>
              <div style={{ ...paperHand, fontSize: 17, color: PAPER.goldDeep, lineHeight: 1.2 }}>
                Wie viele Stiche sagt <span style={{ color: PAPER.ink }}>{nextBidder.display_name}</span> an?
              </div>
              <div style={{ ...paperFlatLabel, whiteSpace: "nowrap", flexShrink: 0 }}>Ansage · 0–{currentRoundNum}</div>
            </div>
            {biddingOrder.some(p => bids[p.player_index] !== undefined) && (
              <button onClick={undoLastBid} style={{ background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 11, padding: "2px 0", marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <IconArrowLeft size={11} /> zurück
              </button>
            )}
            {dealerForbiddenBid !== null && (
              <div style={{ color: PAPER.danger, fontSize: 10.5, marginBottom: 8, background: "rgba(162,58,46,0.1)", border: `1px solid rgba(162,58,46,0.35)`, padding: "5px 9px" }}>
                ⚠ Stichzwang: {dealerForbiddenBid} ist verboten
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {Array.from({ length: currentRoundNum + 1 }, (_, i) => (
                <button key={i} onClick={() => recordBid(nextBidder.player_index, i)} disabled={i === dealerForbiddenBid || locking}
                  style={paperFlatGhostBtn({ flex: 1, minWidth: 44, textAlign: "center", justifyContent: "center", display: "flex", padding: "9px 0", fontSize: 17, opacity: i === dealerForbiddenBid ? 0.25 : locking ? 0.5 : 1 })}>
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}
        {!isDone && pendingBids && currentRoundNum > 1 && gotSum > 0 && gotSum !== currentRoundNum && (
          <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
            <div style={{ ...archivo, fontWeight: 400, fontSize: 10.5, color: PAPER.inkDim, textAlign: "right" }}>Summe Stiche ({gotSum}) ≠ Runde ({currentRoundNum}) - bei einer Bombe normal.</div>
          </div>
        )}
        {!isDone && pendingBids && !wolkePicking && (
          <button onClick={() => setWolkePicking(true)} style={{ marginTop: 14, background: "none", border: `1px solid ${PAPER.line}`, color: PAPER.inkDim, cursor: "pointer", ...archivo, fontWeight: 400, fontSize: 11.5, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            🚂 9¾ – Vorhersage anpassen
          </button>
        )}
        {!isDone && pendingBids && wolkePicking && wolkePlayer === null && (
          <div style={{ marginTop: 14 }}>
            <div style={{ ...archivo, fontWeight: 400, fontSize: 11, color: PAPER.inkDim, marginBottom: 6 }}>Wer hat den Stich mit der Wolke gewonnen?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {players.map(p => (
                <button key={p.id} onClick={() => setWolkePlayer(p.player_index)}
                  style={paperFlatGhostBtn({ padding: "7px 12px", fontSize: 12 })}>{p.display_name}</button>
              ))}
              <button onClick={() => setWolkePicking(false)} style={{ background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 11.5, padding: "7px 4px" }}>Abbrechen</button>
            </div>
          </div>
        )}
        {!isDone && pendingBids && wolkePicking && wolkePlayer !== null && (() => {
          const p = players.find(pl => pl.player_index === wolkePlayer);
          const current = Number(effectiveBid(wolkePlayer) || 0);
          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...archivo, fontWeight: 400, fontSize: 11, color: PAPER.inkDim, marginBottom: 6 }}>
                <span style={{ color: PAPER.goldDeep, fontWeight: 600 }}>{p?.display_name}</span> — aktuelle Ansage: <span style={{ color: PAPER.goldDeep, fontWeight: 700 }}>{current}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { adjustBid(wolkePlayer, -1); setWolkePicking(false); setWolkePlayer(null); }} disabled={current === 0}
                  style={paperFlatGhostBtn({ flex: 1, textAlign: "center", justifyContent: "center", display: "flex", padding: "9px 0", fontSize: 13, opacity: current === 0 ? 0.4 : 1 })}>
                  −1 → {Math.max(0, current - 1)}
                </button>
                <button onClick={() => { adjustBid(wolkePlayer, 1); setWolkePicking(false); setWolkePlayer(null); }}
                  style={{ ...paperFlatPrimaryBtn(false), flex: 1, justifyContent: "center", padding: "9px 0", fontSize: 13 }}>
                  +1 → {current + 1}
                </button>
              </div>
              <button onClick={() => setWolkePlayer(null)} style={{ marginTop: 6, background: "none", border: "none", color: PAPER.inkDim, cursor: "pointer", fontSize: 10.5, padding: 0 }}>Anderer Spieler</button>
            </div>
          );
        })()}
      </div>

      {error && <div style={{ color: PAPER.danger, fontSize: 12, textAlign: "center", marginTop: 10 }}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 18 }}>
        {!isDone && pendingBids && (
          <button onClick={() => saveRound()} disabled={saving} style={paperFlatPrimaryBtn(saving)}>
            {saving ? "…" : "RUNDE ABSCHLIESSEN"}<span style={{ fontSize: 18 }}>→</span>
          </button>
        )}
        <button onClick={finish} disabled={finishing || rounds.length === 0}
          style={isDone ? paperFlatPrimaryBtn(finishing) : paperFlatGhostBtn({ width: "100%", textAlign: "center", justifyContent: "center", display: "flex", boxSizing: "border-box", opacity: (finishing || rounds.length === 0) ? 0.4 : 1 })}>
          {finishing ? "…" : "SPIEL BEENDEN"}
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
    <div style={{ width: "100%", overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", ...archivo, fontWeight: 800, fontSize: 12, color: PAPER.ink, cursor: "pointer", padding: 0, minHeight: 44, display: "flex", alignItems: "center", gap: 6 }}>← ZURÜCK</button>
        <div style={{ ...paperFlatLabel, marginLeft: "auto" }}>
          {game.edition === "anniversary" ? "30 Jahre" : "Classic"} · {new Date(game.created_at).toLocaleDateString("de-DE")}
        </div>
      </div>
      {loading ? (
        <div className="skeleton" style={{ width: "100%", height: 120 }} />
      ) : (
        <div style={{ background: PAPER.panel, border: `1px solid ${PAPER.line}`, padding: 12 }}>
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
        </div>
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
    <div style={{ ...paperFlatScreen, minHeight: "auto" }} className="fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "56px 18px 12px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", ...archivo, fontWeight: 800, fontSize: 12, color: PAPER.ink, cursor: "pointer", padding: 0, minHeight: 44, display: "flex", alignItems: "center", gap: 6 }}>← ZURÜCK</button>
        <div style={{ ...paperFlatLabel, marginLeft: "auto" }}>Rechenblock</div>
      </div>
      <div style={paperFlatRule} />

      <div style={{ padding: "22px 18px 30px" }}>
        {loading ? (
          <div className="skeleton" style={{ width: 200, height: 40 }} />
        ) : viewingGame ? (
          <ManualFinishedGameView game={viewingGame} onBack={() => setViewingGame(null)} />
        ) : activeGame ? (
          <ManualGamePlay session={session} game={activeGame} players={players} rounds={rounds} onChange={load} />
        ) : (
          <ManualGameSetup uid={uid} pastGames={pastGames} onCreated={load} onViewGame={setViewingGame} />
        )}
      </div>
    </div>
  );
}

// ─── Lobby ────────────────────────────────────────────────────────────────────
// ─── Stats Screen ───────────────────────────────────────────────────────────
function StatsScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    supabase.from("user_stats").select("*").eq("id", session.user.id).single().then(({ data }) => setStats(data));
  }, [session.user.id]);

  // One game_stats row per player per room - group by room_id to get the
  // full standings for each of the user's own past games. game_stats has no
  // per-game timestamp beyond played_at (that's on the user's own row,
  // shared by all rows for that room since they're inserted together), and
  // no direct FK to profiles.username, so a second query resolves names.
  const [pastGames, setPastGames] = useState<{ gameKey: string; playedAt: string; edition: string | null; place: number; score: number; totalRounds: number; playerCount: number; rows: { userId: string; name: string; placement: number; score: number }[] }[] | null>(null);
  const [openGame, setOpenGame] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: mine } = await supabase.from("game_stats")
        .select("room_id, manual_game_id, placement, final_score, total_rounds, played_at")
        .eq("user_id", session.user.id)
        .order("played_at", { ascending: false })
        .limit(20);
      if (!mine || mine.length === 0) { setPastGames([]); return; }

      const roomIds = mine.map(g => g.room_id).filter((id): id is string => !!id);
      // Manual (Rechenblock) games have room_id null - there's no rooms row
      // for them - so their participant count comes from manual_game_players
      // instead, keyed by manual_game_id.
      const manualGameIds = Array.from(new Set(mine.map(g => g.manual_game_id).filter((id): id is string => !!id)));
      const [{ data: allRows }, { data: rooms }, { data: manualPlayers }] = await Promise.all([
        roomIds.length ? supabase.from("game_stats").select("room_id, user_id, placement, final_score").in("room_id", roomIds) : Promise.resolve({ data: [] }),
        roomIds.length ? supabase.from("rooms").select("id, edition").in("id", roomIds) : Promise.resolve({ data: [] }),
        manualGameIds.length ? supabase.from("manual_game_players").select("manual_game_id").in("manual_game_id", manualGameIds) : Promise.resolve({ data: [] }),
      ]);
      const userIds = Array.from(new Set((allRows ?? []).map(r => r.user_id)));
      const { data: profiles } = await supabase.from("profiles").select("id, username").in("id", userIds);
      const nameById = new Map((profiles ?? []).map(p => [p.id, p.username]));
      const editionByRoom = new Map((rooms ?? []).map(r => [r.id, r.edition]));
      const manualPlayerCountByGame = new Map<string, number>();
      for (const mp of manualPlayers ?? []) manualPlayerCountByGame.set(mp.manual_game_id, (manualPlayerCountByGame.get(mp.manual_game_id) ?? 0) + 1);

      setPastGames(mine.map(g => ({
        gameKey: g.room_id ?? g.manual_game_id ?? g.played_at, playedAt: g.played_at, edition: g.room_id ? editionByRoom.get(g.room_id) ?? null : null,
        place: g.placement, score: g.final_score, totalRounds: g.total_rounds,
        playerCount: g.room_id
          ? (allRows ?? []).filter(r => r.room_id === g.room_id).length
          : manualPlayerCountByGame.get(g.manual_game_id ?? "") ?? 0,
        rows: (allRows ?? [])
          .filter(r => r.room_id === g.room_id)
          .map(r => ({ userId: r.user_id, name: nameById.get(r.user_id) ?? "Spieler", placement: r.placement, score: r.final_score }))
          .sort((a, b) => a.placement - b.placement),
      })));
    })();
  }, [session.user.id]);

  const accuracyPct = stats?.bid_accuracy_pct != null ? Math.round(stats.bid_accuracy_pct) : 0;

  return (
    <div style={{ ...flatScreen, minHeight: "auto" }} className="fade-in">
      <div style={{ padding: "56px 18px 12px" }}>
        <div style={{ ...archivo, fontWeight: 800, fontSize: 19, lineHeight: 1 }}>STATISTIK</div>
      </div>
      <div style={flatRule} />

      <div style={{ display: "flex", flexWrap: "wrap" }}>
        <div style={{ ...flatStat, width: "50%", boxSizing: "border-box" }}>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{stats?.games_played ?? 0}</div>
          <div style={{ ...flatLabel, marginTop: 6 }}>Spiele</div>
        </div>
        <div style={{ ...flatStat, width: "50%", boxSizing: "border-box", borderRight: "none" }}>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{stats?.games_won ?? 0}</div>
          <div style={{ ...flatLabel, marginTop: 6 }}>Siege</div>
        </div>
        <div style={{ ...flatStat, width: "50%", boxSizing: "border-box" }}>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{stats?.avg_score ?? 0}</div>
          <div style={{ ...flatLabel, marginTop: 6 }}>Ø Punkte</div>
        </div>
        <div style={{ ...flatStat, width: "50%", boxSizing: "border-box", borderRight: "none" }}>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{stats?.avg_placement != null ? String(stats.avg_placement).replace(".", ",") : "–"}</div>
          <div style={{ ...flatLabel, marginTop: 6 }}>Ø Platz</div>
        </div>
      </div>

      <div style={{ padding: "22px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={flatLabel}>Trefferquote der Ansagen</div>
          <div style={{ marginLeft: "auto", ...archivo, fontWeight: 800, fontSize: 22, lineHeight: 1, color: C.gold }}>{accuracyPct}%</div>
        </div>
        <div style={{ height: 14, background: "rgba(255,255,255,0.07)", marginTop: 10, display: "flex" }}>
          <div style={{ width: `${accuracyPct}%`, background: C.gold }} />
        </div>
      </div>

      <div style={{ padding: "24px 18px 30px" }}>
        <div style={{ ...flatLabel, marginBottom: 4 }}>Letzte Partien</div>
        {pastGames === null && <div style={{ ...archivo, fontSize: 12, color: C.ivoryDim, padding: "20px 0" }}>Lädt…</div>}
        {pastGames?.length === 0 && <div style={{ ...archivo, fontSize: 12, color: C.ivoryDim, padding: "20px 0" }}>Noch keine Partien gespielt.</div>}
        {pastGames?.map((pg, i) => {
          const isOpen = openGame === pg.gameKey;
          const date = new Date(pg.playedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
          return (
            <div key={pg.gameKey} style={{ ...flatRow(i === 0), flexDirection: "column", alignItems: "stretch", gap: 0 }}>
              <button onClick={() => setOpenGame(isOpen ? null : pg.gameKey)}
                style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", minHeight: 44, color: "inherit" }}>
                <span style={{ ...archivo, fontWeight: 700, fontSize: 12.5, color: pg.place === 1 ? C.gold : C.ivory, minWidth: 18 }}>{pg.place}.</span>
                <span style={{ flex: 1, ...archivo, fontWeight: 400, fontSize: 12.5, lineHeight: 1.3, color: C.ivoryDim }}>{pg.playerCount} Spieler · {pg.totalRounds} Runden · {date}</span>
                <span style={{ ...archivo, fontWeight: 800, fontSize: 17, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{pg.score}</span>
                <span style={{ ...archivo, fontWeight: 400, fontSize: 13, lineHeight: 1, color: C.ivoryDim }}>{isOpen ? "▴" : "▾"}</span>
              </button>
              {isOpen && (
                <div style={{ padding: "10px 0 4px" }}>
                  {pg.rows.map(pr => (
                    <div key={pr.userId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid rgba(201,168,76,0.14)" }}>
                      <span style={{ ...archivo, fontWeight: 600, fontSize: 12, color: C.ivoryDim, width: 14 }}>{pr.placement}</span>
                      <span style={{ flex: 1, ...archivo, fontWeight: 500, fontSize: 13, lineHeight: 1.2 }}>{pr.name}</span>
                      <span style={{ ...archivo, fontWeight: 700, fontSize: 13, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{pr.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LobbyScreen({ session }: { session: Session }) {
  const [view, setView] = useState<"home" | "rules" | "profile" | "scoreboard" | "stats" | "friends">("home");
  const [rulesTab, setRulesTab] = useState<"basics" | "score" | "cards" | "special">("basics");
  const [reconnectRoom, setReconnectRoom] = useState<{ roomId: string; code: string; phase: string; dismissible: boolean } | null>(null);

  // Reconnect state now lives on the backend (room_players membership),
  // not in localStorage - this is authoritative for any tab/device the
  // player opens, and the server's inactivity reaper (004_room_cleanup.sql)
  // is what bounds how long a stale membership can hang around.
  const checkReconnect = useCallback(() => {
    supabase.from("room_players")
      .select("room_id, rooms:room_id(id, code, phase, created_at)")
      .eq("user_id", session.user.id)
      .order("created_at", { foreignTable: "rooms", ascending: false })
      .then(async ({ data }) => {
        const active = (data ?? []).map((r: any) => r.rooms).find((r: any) => r && r.phase !== "gameEnd");
        if (!active) { setReconnectRoom(null); return; }
        // Dismissible only once every other seat is AI - otherwise a real
        // human is still relying on this seat and the edge function's
        // leaveRoom will refuse it anyway (see index.ts).
        const { data: others } = await supabase.from("room_players").select("is_ai, user_id").eq("room_id", active.id);
        const dismissible = !(others ?? []).some(p => p.user_id !== session.user.id && !p.is_ai);
        setReconnectRoom({ roomId: active.id, code: active.code, phase: active.phase, dismissible });
      });
  }, [session.user.id]);

  useEffect(() => { checkReconnect(); }, [checkReconnect]);
  const [codeInput, setCodeInput] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  // Set alongside roomId (never on its own) when entering via "Zuschauen"
  // instead of create/join/reconnect - decides whether roomId renders
  // SpectatorRoom (read-only) or GameRoom below.
  const [isSpectating, setIsSpectating] = useState(false);
  const [edition, setEdition] = useState<"classic"|"anniversary">("classic");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const username = session.user.user_metadata?.username ?? "Spieler";
  // Lebt hier (nicht in GameRoom) und übersteht darum Phasenwechsel innerhalb
  // eines Raums - siehe Kommentar bei useVoiceChat.
  const voice = useVoiceChat(roomId, session);

  // Pending friend requests (badge) + incoming room invites (popup): initial
  // fetch, then live via realtime so they arrive even while sitting idle.
  // Accepted friend ids are tracked the same way, so the tab bar can show
  // how many are currently online without FriendsScreen having to be
  // mounted (it unmounts whenever the user leaves that tab).
  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const [acceptedFriendIds, setAcceptedFriendIds] = useState<Set<string>>(new Set());
  const [incomingInvite, setIncomingInvite] = useState<{ id: string; room_code: string; from_username: string } | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  useEffect(() => {
    const uid = session.user.id;
    const refreshPendingCount = () => {
      supabase.from("friends").select("id", { count: "exact", head: true })
        .eq("addressee_id", uid).eq("status", "pending")
        .then(({ count }) => setPendingFriendCount(count ?? 0));
    };
    const refreshAcceptedFriends = () => {
      supabase.from("friends").select("requester_id, addressee_id").eq("status", "accepted")
        .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
        .then(({ data }) => {
          setAcceptedFriendIds(new Set((data ?? []).map(f => f.requester_id === uid ? f.addressee_id : f.requester_id)));
        });
    };
    refreshPendingCount();
    refreshAcceptedFriends();
    supabase.from("room_invites").select("id, room_code, from_username").eq("to_user_id", uid)
      .order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => { if (data && data[0]) setIncomingInvite(data[0]); });

    const ch = supabase.channel(`social:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friends", filter: `addressee_id=eq.${uid}` }, () => { refreshPendingCount(); refreshAcceptedFriends(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "friends", filter: `requester_id=eq.${uid}` }, refreshAcceptedFriends)
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

  // Home-screen header avatar button.
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.from("profiles").select("avatar_url").eq("id", session.user.id).single()
      .then(({ data }) => setMyAvatarUrl(data?.avatar_url ?? null));
  }, [session.user.id]);

  // Home-screen stat tiles (Spiele / Siege / Treffer). Refetches every time
  // the home tab becomes active, not just once on mount - LobbyScreen never
  // unmounts between tabs, so a mount-only fetch would (a) never pick up a
  // game finished since, and (b) never recover from a request that failed
  // because the very first load raced an unrefreshed/expired session token
  // (common right after reopening a PWA that's been closed for a while).
  const [homeStats, setHomeStats] = useState<{ games_played: number; games_won: number; bid_accuracy_pct: number | null } | null>(null);
  useEffect(() => {
    if (view !== "home") return;
    supabase.from("user_stats").select("games_played, games_won, bid_accuracy_pct").eq("id", session.user.id).single()
      .then(({ data }) => setHomeStats(data ?? null));
  }, [session.user.id, view]);

  // "Freunde spielen gerade": friends_active_rooms is one row per friend per
  // room - group by room so two friends in the same game collapse into one
  // row ("Marla, Jonas · Runde 6 · 4 Spieler") instead of two.
  const [friendsPlaying, setFriendsPlaying] = useState<{ roomId: string; names: string[]; round: number; playerCount: number }[]>([]);
  useEffect(() => {
    const load = () => {
      supabase.from("friends_active_rooms").select("*").then(({ data, error }) => {
        if (error) { console.error("[LobbyScreen] friends_active_rooms fetch failed:", error.message); return; }
        const byRoom = new Map<string, { roomId: string; names: string[]; round: number; playerCount: number }>();
        for (const row of data ?? []) {
          const entry = byRoom.get(row.room_id) ?? { roomId: row.room_id, names: [], round: row.round ?? 0, playerCount: row.player_count ?? 0 };
          entry.names.push(row.friend_name ?? "Spieler");
          byRoom.set(row.room_id, entry);
        }
        setFriendsPlaying(Array.from(byRoom.values()));
      });
    };
    load();
    const poll = setInterval(load, 10000);
    return () => clearInterval(poll);
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

  const [dismissingReconnect, setDismissingReconnect] = useState(false);
  async function dismissReconnect() {
    if (!reconnectRoom) return;
    setDismissingReconnect(true);
    const res = await callGameAction(reconnectRoom.roomId, "leaveRoom", {});
    setDismissingReconnect(false);
    // Clear immediately instead of waiting on a second round trip through
    // checkReconnect's two sequential queries - that stacked delay on top
    // of this request's own is what made the banner feel slow to disappear.
    if (!res?.error) setReconnectRoom(null);
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
  if (view === "rules") {
    const HOUSES: { name: string; color: string; img: string }[] = [
      { name: "Gryffindor", color: "#E8503A", img: "Gryffindor_1" },
      { name: "Ravenclaw", color: "#4A90D9", img: "Ravenclaw_1" },
      { name: "Slytherin", color: "#2EA94B", img: "Slytherin_1" },
      { name: "Hufflepuff", color: "#F7C948", img: "Hufflepuff_1" },
    ];
    const SPECIALS: { title: string; tag: string; desc: string; img: string }[] = [
      { title: "Drache", tag: "sticht alles", img: "Special_Dragon", desc: "Schlägt ALLES – auch Zauberer. Einzige Ausnahme: die Fee gewinnt gegen den Drachen." },
      { title: "Fee", tag: "verliert immer", img: "Special_Fairy", desc: "Verliert immer – außer wenn der Drache gespielt wurde. Dann gewinnt die Fee." },
      { title: "Hexe", tag: "gilt als Narr", img: "Special_Witch", desc: "Nach dem Stich darf eine beliebige Karte aus dem Stich gegen eine Handkarte getauscht werden." },
      { title: "Werwolf", tag: "wählt Farbe", img: "Special_Werewolf", desc: "Wird als Trumpfkarte aufgedeckt oder beim Ziehen sofort getauscht. Der Spieler wählt die Anspielfarbe für die gesamte Runde." },
      { title: "Vampir", tag: "kopiert Trumpf", img: "Special_Vampire", desc: "Kopiert die aufgedeckte Trumpfkarte für diesen einen Stich. Ist Trumpf ein Narr (oder kein Trumpf), wirkt der Vampir als Narr." },
      { title: "Bombe", tag: "annulliert", img: "Special_Bomb", desc: "Annulliert den Stich – niemand gewinnt ihn. Vorhersagen können dadurch aufgehen." },
      { title: "Jongleur (7½)", tag: "Wert 7,5", img: "Special_George", desc: "Spieler wählt die Farbe. Nach dem Stich gibt JEDER Spieler eine Karte seiner Wahl an den linken Nachbarn weiter." },
      { title: "Wolke (9¾)", tag: "Wert 9,75", img: "Special_Platform9", desc: "Spieler wählt die Farbe. Der Stichgewinner muss seine Vorhersage um 1 erhöhen oder senken (nicht unter 0)." },
      { title: "Zauberernarr", tag: "beides möglich", img: "Special_Ron", desc: "Beim Ausspielen entscheidet der Spieler: Zauberer oder Narr?" },
    ];
    const cardStyle: React.CSSProperties = {
      width: 76, height: 114, overflow: "hidden", position: "relative", border: "1px solid rgba(201,168,76,0.2)",
      boxShadow: "0 3px 10px rgba(0,0,0,0.6)", flexShrink: 0, backgroundSize: "cover", backgroundPosition: "center top",
    };
    const cardStyleS: React.CSSProperties = {
      width: 36, height: 54, overflow: "hidden", position: "relative", border: "1px solid rgba(201,168,76,0.2)",
      boxShadow: "0 3px 10px rgba(0,0,0,0.6)", flexShrink: 0, backgroundSize: "cover", backgroundPosition: "center top",
    };
    const cardCorner: React.CSSProperties = {
      position: "absolute", background: "rgba(0,0,0,0.7)", padding: "1px 4px",
      display: "flex", flexDirection: "column", alignItems: "center", ...cinzel, lineHeight: 1.2, fontSize: 10,
    };

    return (
      <div style={{ ...flatScreen, minHeight: "auto" }} className="fade-in">
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "56px 18px 12px" }}>
          <button onClick={() => setView("home")} style={{ background: "none", border: "none", ...archivo, fontWeight: 800, fontSize: 12, color: C.ivory, cursor: "pointer", padding: 0, minHeight: 44, display: "flex", alignItems: "center", gap: 6 }}>← ZURÜCK</button>
          <div style={{ ...flatLabel, marginLeft: "auto" }}>Regeln</div>
        </div>
        <div style={flatRule} />

        <div style={{ display: "flex", borderBottom: "2px solid rgba(201,168,76,0.45)" }}>
          {([["basics", "Grundregeln"], ["score", "Wertung"], ["cards", "Karten"], ["special", "Spezial"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setRulesTab(key)} style={{
              flex: 1, border: "none", cursor: "pointer", padding: "13px 6px", minHeight: 46,
              ...archivo, fontWeight: 800, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
              background: rulesTab === key ? C.gold : "transparent", color: rulesTab === key ? C.bgDark : C.ivoryDim,
            }}>{label}</button>
          ))}
        </div>

        {rulesTab === "basics" && (
          <div style={{ padding: "22px 18px 30px" }}>
            <div style={{ ...archivo, fontWeight: 800, fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.02em" }}>Ziel des Spiels</div>
            <div style={{ ...archivo, fontWeight: 400, fontSize: 14, lineHeight: 1.6, color: C.ivoryDim, marginTop: 10 }}>
              Sage vor jeder Runde genau voraus, wie viele Stiche du machen wirst. Wer am Ende die meisten Punkte hat, gewinnt — nicht wer die meisten Stiche holt.
            </div>

            <div style={{ ...flatLabel, margin: "26px 0 4px" }}>Rundenablauf</div>
            {[
              ["Geben", "In Runde 1 bekommt jeder 1 Karte, in Runde 2 zwei, und so weiter. Die oberste Karte des Stapels bestimmt den Trumpf."],
              ["Ansagen", "Reihum sagt jeder seine Stichzahl. Der Geber sagt zuletzt an — und darf die Zahl nicht wählen, mit der die Summe aller Ansagen genau der Rundenzahl entspricht (Stichzwang)."],
              ["Stechen", "Farbzwang: wenn du die angespielte Farbe hast, musst du sie bedienen. Zauberer und Narren darfst du immer legen."],
              ["Werten", "Nach dem letzten Stich werden die Punkte verteilt und die nächste Runde beginnt."],
            ].map(([title, desc], i) => (
              <div key={title} style={{ ...flatRow(i === 0), alignItems: "flex-start" }}>
                <div style={{ ...archivo, fontWeight: 800, fontSize: 13, lineHeight: 1.2, color: C.gold, width: 20 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...archivo, fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{title}</div>
                  <div style={{ ...archivo, fontWeight: 400, fontSize: 12, lineHeight: 1.5, color: C.ivoryDim, marginTop: 3 }}>{desc}</div>
                </div>
              </div>
            ))}

            <div style={{ ...flatLabel, margin: "26px 0 4px" }}>Wer gewinnt den Stich?</div>
            {[
              ["#C9A84C", <>Der <b style={{ color: C.ivory, fontWeight: 600 }}>erste gelegte Zauberer</b> sticht alles.</>],
              ["#C9A84C", <>Sonst die <b style={{ color: C.ivory, fontWeight: 600 }}>höchste Trumpfkarte</b>.</>],
              ["#C9A84C", <>Sonst die <b style={{ color: C.ivory, fontWeight: 600 }}>höchste Karte der angespielten Farbe</b>.</>],
              ["rgba(184,169,138,0.4)", <>Nur Narren im Stich? Dann gewinnt der <b style={{ color: C.ivory, fontWeight: 600 }}>erste Narr</b>.</>],
            ].map(([dot, text], i) => (
              <div key={i} style={flatRow(i === 0)}>
                <div style={{ width: 7, height: 7, background: dot as string, flexShrink: 0 }} />
                <div style={{ flex: 1, ...archivo, fontWeight: 400, fontSize: 13, lineHeight: 1.5, color: C.ivoryDim }}>{text}</div>
              </div>
            ))}
          </div>
        )}

        {rulesTab === "score" && (
          <div style={{ padding: "22px 18px 30px" }}>
            <div style={{ ...archivo, fontWeight: 800, fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.02em" }}>Punkte</div>
            <div style={{ ...archivo, fontWeight: 400, fontSize: 14, lineHeight: 1.6, color: C.ivoryDim, marginTop: 10 }}>
              Nur die exakte Ansage zahlt sich aus. Ein Stich zu viel ist genauso teuer wie einer zu wenig.
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", marginTop: 22, borderTop: "2px solid rgba(201,168,76,0.45)" }}>
              <div style={{ ...flatStat, width: "50%", boxSizing: "border-box" }}><div style={{ ...archivo, fontWeight: 800, fontSize: 30, lineHeight: 1, color: C.success }}>+20</div><div style={{ ...flatLabel, marginTop: 6 }}>Ansage getroffen</div></div>
              <div style={{ ...flatStat, width: "50%", boxSizing: "border-box", borderRight: "none" }}><div style={{ ...archivo, fontWeight: 800, fontSize: 30, lineHeight: 1, color: C.success }}>+10</div><div style={{ ...flatLabel, marginTop: 6 }}>Je Stich dazu</div></div>
              <div style={{ ...flatStat, width: "50%", boxSizing: "border-box" }}><div style={{ ...archivo, fontWeight: 800, fontSize: 30, lineHeight: 1, color: C.error }}>−10</div><div style={{ ...flatLabel, marginTop: 6 }}>Je Stich Abweichung</div></div>
              <div style={{ ...flatStat, width: "50%", boxSizing: "border-box", borderRight: "none" }}><div style={{ ...archivo, fontWeight: 800, fontSize: 30, lineHeight: 1 }}>13</div><div style={{ ...flatLabel, marginTop: 6 }}>Runden bei 4 Spielern</div></div>
            </div>

            <div style={{ ...flatLabel, margin: "26px 0 4px" }}>Beispiele</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 6px", ...flatLabel, borderBottom: "2px solid rgba(201,168,76,0.45)" }}>Ansage</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", ...flatLabel, borderBottom: "2px solid rgba(201,168,76,0.45)" }}>Stiche</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", ...flatLabel, borderBottom: "2px solid rgba(201,168,76,0.45)" }}>Punkte</th>
                </tr>
              </thead>
              <tbody>
                {[[2, 2, 40], [0, 0, 20], [1, 0, -10], [1, 3, -20]].map(([bid, got, pts], i) => (
                  <tr key={i}>
                    <td style={{ padding: "11px 6px", ...archivo, fontSize: 14, color: C.ivoryDim, borderBottom: "1px solid rgba(201,168,76,0.22)" }}>{bid}</td>
                    <td style={{ padding: "11px 6px", textAlign: "right", ...archivo, fontSize: 14, color: C.ivoryDim, borderBottom: "1px solid rgba(201,168,76,0.22)" }}>{got}</td>
                    <td style={{ padding: "11px 6px", textAlign: "right", ...archivo, fontWeight: 800, fontSize: 14, color: pts > 0 ? C.success : C.error, borderBottom: "1px solid rgba(201,168,76,0.22)" }}>
                      {pts > 0 ? `+${pts}` : `−${Math.abs(pts)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ ...archivo, fontWeight: 400, fontSize: 12, lineHeight: 1.5, color: C.ivoryDim, marginTop: 14 }}>
              Die Rundenzahl richtet sich nach der Spielerzahl: 60 Karten geteilt durch die Anzahl Spieler — bei 6 Spielern also 10 Runden, bei 3 Spielern 20.
            </div>
          </div>
        )}

        {rulesTab === "cards" && (
          <div style={{ padding: "22px 18px 30px" }}>
            <div style={{ ...archivo, fontWeight: 800, fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.02em" }}>Das Blatt</div>
            <div style={{ ...archivo, fontWeight: 400, fontSize: 14, lineHeight: 1.6, color: C.ivoryDim, marginTop: 10 }}>
              60 Karten: vier Häuser mit je 1–13, dazu vier Zauberer und vier Narren.
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
              {[
                { img: "Wizard_2", label: "Z", color: "#C9A84C", title: "ZAUBERER", desc: "sticht alles" },
                { img: "Fool_1", label: "N", color: "#E8DAEF", title: "NARR", desc: "verliert immer" },
                { img: "Hufflepuff_13", label: "13", color: "#F7C948", title: "HAUSKARTE", desc: "1 bis 13" },
              ].map(c => (
                <div key={c.title} style={{ textAlign: "center" }}>
                  <div style={{ ...cardStyle, backgroundImage: `url(/cards/${c.img}.webp)` }}>
                    <div style={{ ...cardCorner, top: 3, left: 4, color: c.color }}>{c.label}</div>
                    <div style={{ ...cardCorner, bottom: 3, right: 4, color: c.color, transform: "rotate(180deg)" }}>{c.label}</div>
                  </div>
                  <div style={{ ...cinzel, fontSize: 9, color: C.gold, marginTop: 5 }}>{c.title}</div>
                  <div style={{ ...archivo, fontWeight: 400, fontSize: 9, lineHeight: 1.3, color: C.ivoryDim }}>{c.desc}</div>
                </div>
              ))}
            </div>

            <div style={{ ...flatLabel, margin: "26px 0 4px" }}>Die vier Häuser</div>
            {HOUSES.map((h, i) => (
              <div key={h.name} style={flatRow(i === 0)}>
                <div style={{ width: 9, height: 9, background: h.color, flexShrink: 0 }} />
                <div style={{ flex: 1, ...archivo, fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>{h.name}</div>
                <div style={{ ...archivo, fontWeight: 400, fontSize: 12, color: C.ivoryDim }}>1–13</div>
              </div>
            ))}

            <div style={{ border: "2px solid rgba(201,168,76,0.4)", padding: 16, marginTop: 26 }}>
              <div style={{ ...flatLabel, color: C.gold }}>30 Jahre Edition · 69 Karten</div>
              <div style={{ ...archivo, fontWeight: 400, fontSize: 12, lineHeight: 1.6, color: C.ivoryDim, marginTop: 8 }}>
                Neun Sonderkarten kommen hinzu: Bombe, Regenbogen-7 und -9, Drache, Fee, Hexe, Werwolf, Vampir und der Zauberer-Narr. Sie greifen mitten im Stich ein — wer sie legt, dreht die Runde.
              </div>
              <button onClick={() => setRulesTab("special")} style={flatGhostBtn({ marginTop: 12, padding: "9px 12px", fontSize: 11, minHeight: 38 })}>SONDERKARTEN ANSEHEN</button>
            </div>
          </div>
        )}

        {rulesTab === "special" && (
          <div style={{ padding: "22px 18px 30px" }}>
            <div style={{ ...archivo, fontWeight: 800, fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.02em" }}>Spezialkarten</div>
            <div style={{ ...archivo, fontWeight: 400, fontSize: 14, lineHeight: 1.6, color: C.ivoryDim, marginTop: 10 }}>
              Neun Karten der 30-Jahre-Edition. Jede greift anders in den Stich ein — sie sind der Grund, warum eine sichere Ansage plötzlich platzt.
            </div>

            {SPECIALS.map(sp => (
              <div key={sp.title} style={{ display: "flex", gap: 12, padding: "16px 0", borderBottom: "1px solid rgba(201,168,76,0.22)", alignItems: "flex-start" }}>
                <div style={{ ...cardStyleS, backgroundImage: `url(/cards/${sp.img}.webp)` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <div style={{ ...cinzel, fontSize: 14, color: C.gold, fontWeight: 700 }}>{sp.title}</div>
                    <div style={{ ...flatLabel, marginLeft: "auto", whiteSpace: "nowrap" }}>{sp.tag}</div>
                  </div>
                  <div style={{ ...archivo, fontWeight: 400, fontSize: 12, lineHeight: 1.6, color: C.ivoryDim, marginTop: 5 }}>{sp.desc}</div>
                </div>
              </div>
            ))}

            <div style={{ border: "2px solid rgba(201,168,76,0.4)", padding: 16, marginTop: 22 }}>
              <div style={{ ...flatLabel, color: C.gold }}>Stichhierarchie mit Spezialkarten</div>
              <div style={{ ...archivo, fontWeight: 400, fontSize: 12, lineHeight: 1.7, color: C.ivoryDim, marginTop: 8 }}>
                Fee (nur gegen Drache) → Drache → Zauberer → Trumpf → Anspielfarbe → Narr, Hexe, Vampir ohne Trumpf. Die Bombe hebt den Stich komplett auf.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === "profile") return <ProfileScreen session={session} />;

  if (view === "scoreboard") return <ManualScoreboardScreen session={session} onBack={() => setView("home")} />;

  if (view === "stats") return <StatsScreen session={session} onBack={() => setView("home")} />;

  if (view === "friends") return <FriendsScreen session={session} onClose={() => setView("home")} onlineUserIds={onlineUserIds} onSpectate={(rid) => { setView("home"); setIsSpectating(true); setRoomId(rid); }} />;

  if (roomId && isSpectating) return <SpectatorRoom roomId={roomId} session={session} voice={voice} onLeave={() => {
    callGameAction(roomId, "leaveSpectating", {});
    setRoomId(null);
    setIsSpectating(false);
  }} />;

  if (roomId) return <GameRoom roomId={roomId} session={session} edition={edition} onlineUserIds={onlineUserIds} voice={voice} onLeave={() => { setRoomId(null); checkReconnect(); }} />;

  // compact: skips the big mascot/title hero (only makes sense once, on the
  if (view === "home") return (
    <div style={{ ...flatScreen, minHeight: "auto" }} className="fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "56px 18px 12px" }}>
        <div style={{ ...archivo, fontWeight: 800, fontSize: 19, lineHeight: 1, letterSpacing: "-0.01em", marginRight: "auto" }}>WIZZO</div>
        <button onClick={() => setView("profile")} style={{ width: 32, height: 32, border: "none", cursor: "pointer", padding: 0, background: myAvatarUrl ? `url(${myAvatarUrl}) center/cover` : avatarColor(session.user.id), display: "flex", alignItems: "center", justifyContent: "center", ...archivo, fontWeight: 800, fontSize: 14, color: "#fff" }}>
          {!myAvatarUrl && username.charAt(0).toUpperCase()}
        </button>
      </div>
      <div style={flatRule} />

      {reconnectRoom && (
        <div style={{ background: C.gold, color: C.bgDark, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...archivo, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.75 }}>Laufende Partie</div>
              <div style={{ ...archivo, fontWeight: 800, fontSize: 26, lineHeight: 1.05, letterSpacing: "0.06em", marginTop: 4 }}>{reconnectRoom.code}</div>
            </div>
            <button onClick={reconnect} style={{ ...archivo, background: C.bgDark, color: C.goldLight, border: "none", fontWeight: 800, fontSize: 12, padding: "12px 14px", cursor: "pointer", minHeight: 44 }}>FORTSETZEN →</button>
          </div>
          {reconnectRoom.dismissible && (
            <button onClick={dismissReconnect} disabled={dismissingReconnect}
              style={{ ...archivo, background: "none", border: "1px solid rgba(23,24,20,0.4)", color: C.bgDark, fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", padding: "8px 0", marginTop: 10, width: "100%", cursor: dismissingReconnect ? "default" : "pointer", opacity: dismissingReconnect ? 0.6 : 0.85, minHeight: 36 }}>
              {dismissingReconnect ? "Wird verworfen…" : "VERWERFEN"}
            </button>
          )}
        </div>
      )}

      <div style={{ padding: "20px 18px 0" }}>
        <div style={{ ...flatLabel, marginBottom: 9 }}>Neue Partie</div>
        <div style={{ ...flatSegTrack, marginBottom: 12 }}>
          <button onClick={() => setEdition("classic")} style={flatSegBtn(edition === "classic")}>Classic</button>
          <button onClick={() => setEdition("anniversary")} style={flatSegBtn(edition === "anniversary")}>30 Jahre</button>
        </div>
        <button onClick={createRoom} disabled={loading} style={flatPrimaryBtn(loading)}>
          {loading ? "…" : "SPIEL ERSTELLEN"}<span style={{ fontSize: 18 }}>→</span>
        </button>
        {error && <div style={{ color: "#FF8080", fontSize: 12, textAlign: "center", marginTop: 10 }}>{error}</div>}
      </div>

      <div style={{ padding: "22px 18px 0" }}>
        <div style={{ ...flatLabel, marginBottom: 9 }}>Mit Code beitreten</div>
        <div style={{ position: "relative", marginBottom: 11 }}>
          <div style={{ display: "flex", gap: 7 }}>
            {Array.from({ length: 5 }, (_, i) => {
              const ch = codeInput[i] ?? "";
              const isNextEmpty = codeFocused && i === codeInput.length && codeInput.length < 5;
              return (
                <div key={i} style={{
                  flex: 1, aspectRatio: "1", border: `2px solid ${ch || isNextEmpty ? C.gold : "rgba(201,168,76,0.3)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", ...archivo, fontWeight: 800, fontSize: 22,
                }}>
                  {ch || (isNextEmpty ? <span style={{ color: C.gold }}>|</span> : <span style={{ color: C.ivoryDim }}>·</span>)}
                </div>
              );
            })}
          </div>
          <input
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
            onKeyDown={e => e.key === "Enter" && codeInput.length === 5 && joinRoom()}
            maxLength={5} inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
            aria-label="Raumcode"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, border: "none", background: "transparent", fontSize: 16, color: "transparent", caretColor: "transparent", cursor: "pointer" }}
          />
        </div>
        <button onClick={() => joinRoom()} disabled={loading || codeInput.length < 5}
          style={flatGhostBtn({ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box", opacity: loading || codeInput.length < 5 ? 0.4 : 1 })}>
          {codeInput.length === 5 ? `BEITRETEN · ${codeInput}` : "RAUM BEITRETEN"}<span>→</span>
        </button>
        {error && <div style={{ color: "#FF8080", fontSize: 12, textAlign: "center", marginTop: 10 }}>{error}</div>}
      </div>

      {friendsPlaying.length > 0 && (
        <div style={{ padding: "22px 18px 0" }}>
          <div style={{ ...flatLabel, marginBottom: 9 }}>Freunde spielen gerade</div>
          {friendsPlaying.map((fp, i) => (
            <div key={fp.roomId} style={flatRow(i === 0)}>
              <div style={{ width: 8, height: 8, background: C.success, flexShrink: 0 }} />
              <div style={{ flex: 1, ...archivo, fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>
                {fp.names.join(", ")}
                <div style={{ ...archivo, fontWeight: 400, fontSize: 11, lineHeight: 1.3, color: C.ivoryDim, marginTop: 2 }}>
                  Runde {fp.round} · {fp.playerCount} Spieler
                </div>
              </div>
              <button onClick={async () => {
                const res = await callGameAction(fp.roomId, "spectateRoom", {});
                if (!res?.error) { setIsSpectating(true); setRoomId(fp.roomId); }
              }} style={flatGhostBtn({ padding: "8px 11px", fontSize: 11, minHeight: 36 })}>ZUSCHAUEN</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", margin: "22px 0 0", borderTop: "2px solid rgba(201,168,76,0.45)" }}>
        <div style={flatStat}><div style={{ ...archivo, fontWeight: 800, fontSize: 26, lineHeight: 1 }}>{homeStats?.games_played ?? 0}</div><div style={{ ...flatLabel, marginTop: 5 }}>Spiele</div></div>
        <div style={flatStat}><div style={{ ...archivo, fontWeight: 800, fontSize: 26, lineHeight: 1 }}>{homeStats?.games_won ?? 0}</div><div style={{ ...flatLabel, marginTop: 5 }}>Siege</div></div>
        <div style={{ ...flatStat, borderRight: "none" }}><div style={{ ...archivo, fontWeight: 800, fontSize: 26, lineHeight: 1, color: C.gold }}>{homeStats?.bid_accuracy_pct != null ? `${Math.round(homeStats.bid_accuracy_pct)}%` : "–"}</div><div style={{ ...flatLabel, marginTop: 5 }}>Treffer</div></div>
      </div>

      <div style={{ padding: "18px 18px 30px", display: "flex", gap: 10 }}>
        <button onClick={() => setView("scoreboard")} style={flatGhostBtn({ flex: 1, textAlign: "center", justifyContent: "center", display: "flex" })}>RECHENBLOCK</button>
        <button onClick={() => setView("rules")} style={flatGhostBtn({ flex: 1, textAlign: "center", justifyContent: "center", display: "flex" })}>REGELN</button>
      </div>
    </div>
  );
  })();

  const activeTab: TabKey | null = roomId ? null :
    view === "home" ? "home" : view === "friends" ? "friends" : view === "stats" ? "stats" : view === "profile" ? "profile" : null;

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
      {activeTab ? (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
          <div style={{ flex: 1, paddingBottom: "calc(64px + max(8px, env(safe-area-inset-bottom)))" }}>{screen}</div>
          <TabBar active={activeTab} onChange={setView} friendBadge={pendingFriendCount}
            onlineFriendCount={Array.from(acceptedFriendIds).filter(id => onlineUserIds.has(id)).length} />
        </div>
      ) : screen}
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
  // Session-only, local to this device - never written anywhere shared, so
  // it doesn't survive leaving the room and can't affect what anyone else
  // hears. Kept in a ref alongside the state so the ontrack callback (which
  // closes over this hook's first render) always sees the current set,
  // not a stale one, when a peer's audio element gets (re)created later.
  const [mutedPeerIds, setMutedPeerIdsState] = useState<Set<string>>(new Set());
  const mutedPeerIdsRef = useRef<Set<string>>(new Set());

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
      el.muted = mutedPeerIdsRef.current.has(otherId);
      // The `autoplay` attribute alone is unreliable for an element created
      // outside the direct call stack of a user gesture (it's set here,
      // inside an async ontrack callback, not inside the click handler that
      // started the connection) - some browsers silently never start
      // playback rather than throwing. Calling play() explicitly either
      // starts it or surfaces the rejection instead of a silently-dead peer.
      el.play().catch(err => console.error("[voice] audio play() failed:", err));
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

  // Muting a peer only affects local playback - the audio keeps arriving
  // over the connection, it's just silenced on this one device, so it
  // never touches what that person or anyone else hears.
  function togglePeerMute(otherId: string) {
    const next = new Set(mutedPeerIdsRef.current);
    if (next.has(otherId)) next.delete(otherId); else next.add(otherId);
    mutedPeerIdsRef.current = next;
    setMutedPeerIdsState(next);
    const el = audioElsRef.current.get(otherId);
    if (el) el.muted = next.has(otherId);
  }

  return { enabled, connecting, muted, error, participantIds, speakingIds, mutedPeerIds, enableVoice, disableVoice, toggleMute, togglePeerMute };
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
  const [showLog, setShowLog] = useState(false);
  const [modalMinimized, setModalMinimized] = useState(true);
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  // Who's watching - "niemand wird unbemerkt beobachtet". room_spectators
  // is now readable for any player seated in the same room (see migration
  // 015), so this is a plain fetch, not a new security surface.
  const [showSpectators, setShowSpectators] = useState(false);
  const [spectators, setSpectators] = useState<{ user_id: string; username: string }[]>([]);
  const loadSpectators = useCallback(async () => {
    const { data: rows, error } = await supabase.from("room_spectators").select("user_id").eq("room_id", roomId);
    if (error) { console.error("[loadSpectators] fetch failed:", error.message); return; }
    if (!rows?.length) { setSpectators([]); return; }
    const ids = rows.map((r: any) => r.user_id);
    const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
    setSpectators(ids.map(id => ({ user_id: id, username: profs?.find((p: any) => p.id === id)?.username ?? "Spieler" })));
  }, [roomId]);
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

  // Invite a friend into the Warteraum: list is shown permanently once
  // seated (loaded via the effect below), not behind a toggle anymore.
  const [inviteFriends, setInviteFriends] = useState<{ id: string; username: string; avatar_url: string | null }[] | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [inviteSending, setInviteSending] = useState<string | null>(null);
  const inviteInFlight = useRef<Set<string>>(new Set());

  async function openInvitePicker() {
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
  // Session-only, local to this device - never written anywhere shared, so
  // it doesn't survive leaving the room and can't affect what anyone else
  // sees.
  const [mutedChatIds, setMutedChatIds] = useState<Set<string>>(new Set());
  const toggleChatMute = (id: string) => setMutedChatIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
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
        setPlayers(data);
        const mine = data.find((p: any) => p.user_id === session.user.id);
        if (mine) setMyIdx(mine.player_index);
      } else {
        console.error("[GameRoom] initial players fetch failed");
      }
    });
  }, [roomId]);

  useEffect(() => {
    loadSpectators();
    const ch = supabase.channel(`spectator-watch:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_spectators", filter: `room_id=eq.${roomId}` }, () => loadSpectators())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, loadSpectators]);

  // Redesigned waiting room shows "Freunde einladen" permanently (not behind
  // a toggle) - load it as soon as we're actually sitting in a lobby-phase
  // room, same data openInvitePicker always fetched, just no click needed.
  useEffect(() => {
    if (room?.phase === "lobby" && inviteFriends === null) openInvitePicker();
  }, [room?.phase]);

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
            if (playersGuard.isCurrent(mySeq)) setPlayers(data);
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
            return exists
              ? prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p)
              : [...prev, payload.new].sort((a,b) => a.player_index - b.player_index);
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
              {id !== session.user.id && (
                <button onClick={() => voice.togglePeerMute(id)}
                  title={voice.mutedPeerIds.has(id) ? "Stummschaltung aufheben" : "Für dich stummschalten"}
                  style={{ background: "none", border: "none", padding: 0, marginLeft: 2, display: "flex", cursor: "pointer", color: voice.mutedPeerIds.has(id) ? C.error : C.ivoryDim, opacity: voice.mutedPeerIds.has(id) ? 1 : 0.45 }}>
                  {voice.mutedPeerIds.has(id) ? <IconMicOff size={11} /> : <IconMic size={11} />}
                </button>
              )}
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

  // "Niemand wird unbemerkt beobachtet" - a small badge, present regardless
  // of phase, so spectators are never invisible to the people they're
  // watching. Tap to expand the names (loadSpectators() resolves them from
  // profiles once, not per-render).
  const spectatorBadge = spectators.length > 0 && (
    <div style={{ position: "relative" as const }}>
      <button onClick={() => setShowSpectators(s => !s)} style={{ ...goldBtn(showSpectators), padding: "4px 9px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5 }}>
        👁 {spectators.length}
      </button>
      {showSpectators && (
        <div style={{ position: "absolute" as const, top: "calc(100% + 4px)", right: 0, zIndex: 25, ...glass({ padding: "8px 12px" }), whiteSpace: "nowrap" as const }}>
          <div style={{ ...cinzel, fontSize: 9, color: C.gold, letterSpacing: 1, marginBottom: 4 }}>ZUSCHAUER</div>
          {spectators.map(s => (
            <div key={s.user_id} style={{ fontSize: 12, color: C.ivory, padding: "2px 0" }}>{s.username}</div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Lobby Phase ──
  if (room.phase === "lobby") {
    // KI füllt nur auf 3 auf, wenn nicht genug echte Spieler da sind - darüber
    // spielen ausschließlich die tatsächlich beigetretenen Menschen mit.
    const effectiveAiCount = Math.max(0, 3 - players.length);
    const seatCount = players.length + effectiveAiCount;
    return (
      <div style={{ ...flatScreen, minHeight: "auto" }} className="fade-in">
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "56px 18px 12px" }}>
          <button onClick={() => { if (players.length <= 1 || confirm("Warteraum verlassen?")) { callGameAction(roomId, "leaveRoom", {}); onLeave(); } }}
            style={{ background: "none", border: "none", ...archivo, fontWeight: 800, fontSize: 12, color: C.ivory, cursor: "pointer", padding: 0, minHeight: 44, display: "flex", alignItems: "center", gap: 6 }}>
            ← ZURÜCK
          </button>
          <div style={{ ...flatLabel, marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            Warteraum
            {spectatorBadge}
          </div>
        </div>
        <div style={flatRule} />

        <div style={{ background: C.gold, color: C.bgDark, padding: "26px 18px 22px" }}>
          <div style={{ ...archivo, fontWeight: 600, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.75 }}>Raumcode</div>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 62, lineHeight: 0.95, letterSpacing: "0.04em", margin: "8px 0 6px" }}>{room.code}</div>
          <div style={{ ...archivo, fontWeight: 400, fontSize: 12, lineHeight: 1.4, opacity: 0.8 }}>Code teilen oder Freunde direkt einladen — beide Wege landen im selben Raum.</div>
        </div>

        <div style={{ padding: "8px 18px 0", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ ...glass({ padding: "4px 14px" }), fontSize: 11, color: room?.edition === "anniversary" ? "#F7DC6F" : C.ivoryDim, display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            {room?.edition === "anniversary" ? <>⚡ 30 Jahre Edition</> : <><CardIcon size={11}><WizardArt index={0} /></CardIcon> Classic Edition</>}
          </div>
        </div>

        <div style={{ padding: "12px 18px 0" }}>
          <div style={{ ...flatLabel, marginBottom: 4 }}>Am Tisch · {players.length} von {seatCount}</div>
          {players.map((p, i) => {
            const st = friendReqState[p.user_id];
            const canFriend = !p.is_ai && p.user_id && p.user_id !== session.user.id && st !== "sent" && st !== "exists";
            const isMe = p.user_id === session.user.id;
            return (
              <div key={p.id} style={flatRow(i === 0)}>
                <div style={{ ...archivo, fontWeight: 800, fontSize: 12, color: C.ivoryDim, width: 16 }}>{i + 1}</div>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={{ width: 26, height: 26, background: avatars[p.user_id] ? `url(${avatars[p.user_id]}) center/cover` : avatarColor(p.user_id || p.ai_name), color: "#E4C97A", display: "flex", alignItems: "center", justifyContent: "center", ...archivo, fontWeight: 800, fontSize: 11 }}>
                    {!avatars[p.user_id] && (p.ai_name?.charAt(0).toUpperCase() ?? "?")}
                  </div>
                  {!p.is_ai && (
                    <span style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderRadius: "50%", background: p.connected ? C.success : "rgba(255,255,255,0.25)", boxShadow: `0 0 0 2px ${C.bgDark}` }} title={p.connected ? "Verbunden" : "Getrennt"} />
                  )}
                </div>
                <div style={{ flex: 1, ...archivo, fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>{p.ai_name}</div>
                {isMe ? (
                  <span style={{ background: C.gold, color: C.bgDark, ...archivo, fontWeight: 800, fontSize: 9, letterSpacing: "0.1em", padding: "5px 7px" }}>
                    {p.player_index === 0 ? "HOST · DU" : "DU"}
                  </span>
                ) : !p.is_ai ? (
                  <div style={{ width: 7, height: 7, background: p.connected ? C.success : "rgba(255,255,255,0.25)", flexShrink: 0 }} />
                ) : null}
                {canFriend && (
                  <button onClick={() => addFriendFromRoom(p.user_id)} disabled={st === "sending"}
                    title="Als Freund hinzufügen"
                    style={{ background: "none", border: "none", color: C.ivoryDim, cursor: st === "sending" ? "default" : "pointer", display: "flex", padding: 4, opacity: st === "sending" ? 0.5 : 1 }}>
                    <IconUserPlus size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "20px 18px 0" }}>
          <div style={{ ...flatLabel, marginBottom: 4 }}>Freunde einladen</div>
          {inviteFriends === null ? (
            [0, 1].map(i => (
              <div key={i} style={flatRow(i === 0)}>
                <div className="skeleton" style={{ width: 7, height: 7, borderRadius: "50%" }} />
                <div className="skeleton" style={{ width: `${80 - i * 16}px`, height: 13, borderRadius: 4, flex: "none" }} />
                <div className="skeleton" style={{ width: 62, height: 24, marginLeft: "auto" }} />
              </div>
            ))
          ) : inviteFriends.length === 0 ? (
            <div style={{ ...flatRow(true), ...archivo, fontSize: 12, color: C.ivoryDim }}>Noch keine Freunde hinzugefügt</div>
          ) : inviteFriends.map((f, i) => {
            const online = onlineUserIds.has(f.id);
            const invited = invitedIds.has(f.id);
            return (
              <div key={f.id} style={flatRow(i === 0)}>
                <div style={{ width: 8, height: 8, background: online ? C.success : "rgba(255,255,255,0.25)", flexShrink: 0 }} />
                <div style={{ flex: 1, ...archivo, fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>
                  {f.username} <span style={{ fontWeight: 400, fontSize: 11, color: C.ivoryDim }}>{online ? "" : "· offline"}</span>
                </div>
                <button onClick={() => inviteFriend(f.id)} disabled={invited || inviteSending === f.id || !online}
                  style={flatGhostBtn({
                    padding: "8px 11px", fontSize: 11, minHeight: 36,
                    ...(invited ? { borderColor: C.gold, color: C.gold } : {}),
                    opacity: (!online && !invited) ? 0.45 : 1,
                  })}>
                  {invited ? "EINGELADEN ✓" : "EINLADEN"}
                </button>
              </div>
            );
          })}
        </div>

        {isHost && effectiveAiCount > 0 && (
          <div style={{ padding: "14px 18px 0", ...archivo, fontSize: 11, color: C.ivoryDim }}>+ {effectiveAiCount} KI {effectiveAiCount === 1 ? "wird" : "werden"} beim Start ergänzt</div>
        )}

        <div style={{ padding: "24px 18px 30px" }}>
          {isHost ? (
            <button onClick={() => act("startGame", { aiCount: effectiveAiCount, edition: room?.edition ?? "classic" })} disabled={loading || players.length + effectiveAiCount < 2}
              style={flatPrimaryBtn(loading || players.length + effectiveAiCount < 2)}>
              SPIEL STARTEN<span style={{ fontSize: 18 }}>→</span>
            </button>
          ) : (
            <div style={{ ...archivo, fontSize: 13, color: C.ivoryDim, textAlign: "center", padding: "17px 0" }}>Warte auf den Host…</div>
          )}
          {error && <div style={{ color: "#FF8080", fontSize: 12, textAlign: "center", marginTop: 10 }}>{error}</div>}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>{voicePanel}</div>
        </div>
      </div>
    );
  }

  // ── Round/Game End ──
  if (room.phase === "roundEnd" || room.phase === "gameEnd") {
    const sorted = [...players].sort((a: any, b: any) => b.score - a.score);
    const lastRound = roundHistory[roundHistory.length - 1];
    const isGameEnd = room.phase === "gameEnd";
    return (
      <div style={{ ...flatScreen, minHeight: "auto" }} className="fade-in">
        <div style={{ padding: "64px 18px 0" }}>
          <div style={flatLabel}>{isGameEnd ? "Endstand" : "Rundenergebnis"}</div>
          <div style={{ ...archivo, fontWeight: 800, fontSize: 46, lineHeight: 0.95, letterSpacing: "-0.02em", margin: "8px 0 4px" }}>
            {isGameEnd ? "SPIEL BEENDET" : `RUNDE ${room.round}`}
          </div>
          {!isGameEnd && (
            <div style={{ ...archivo, fontWeight: 600, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: C.gold, display: "flex", alignItems: "center", gap: 8 }}>
              Beendet · {room.round} von {room.max_rounds}
              {spectatorBadge}
            </div>
          )}
        </div>

        {lastRound && (
          <div style={{ padding: "22px 18px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 6px", ...flatLabel, borderBottom: "2px solid rgba(201,168,76,0.45)" }}>Spieler</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", ...flatLabel, borderBottom: "2px solid rgba(201,168,76,0.45)" }}>Ansage</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", ...flatLabel, borderBottom: "2px solid rgba(201,168,76,0.45)" }}>Erg.</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", ...flatLabel, borderBottom: "2px solid rgba(201,168,76,0.45)" }}>Punkte</th>
                </tr>
              </thead>
              <tbody>
                {lastRound.results?.map((r: any) => {
                  const hit = r.bid === r.got;
                  const delta = hit ? 20 + r.bid * 10 : -Math.abs(r.bid - r.got) * 10;
                  return (
                    <tr key={r.playerIndex}>
                      <td style={{ padding: "11px 6px", ...archivo, fontWeight: 600, fontSize: 14, color: C.ivory, borderBottom: "1px solid rgba(201,168,76,0.22)" }}>{r.name}</td>
                      <td style={{ padding: "11px 6px", textAlign: "right", ...archivo, fontWeight: 400, fontSize: 14, color: C.ivoryDim, borderBottom: "1px solid rgba(201,168,76,0.22)" }}>{r.bid}</td>
                      <td style={{ padding: "11px 6px", textAlign: "right", ...archivo, fontWeight: 400, fontSize: 14, color: C.ivoryDim, borderBottom: "1px solid rgba(201,168,76,0.22)" }}>{r.got}</td>
                      <td style={{ padding: "11px 6px", textAlign: "right", ...archivo, fontWeight: 800, fontSize: 14, color: hit ? C.success : C.error, borderBottom: "1px solid rgba(201,168,76,0.22)" }}>
                        {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ padding: "24px 18px 0" }}>
          <div style={{ ...flatLabel, marginBottom: 4 }}>Gesamtstand</div>
          {sorted.map((p: any, i: number) => {
            const st = friendReqState[p.user_id];
            const canFriend = !p.is_ai && p.user_id && p.user_id !== session.user.id && st !== "sent" && st !== "exists";
            const isFirst = i === 0;
            return (
              <div key={p.id} style={flatRow(i === 0)}>
                <div style={{ ...archivo, fontWeight: 800, fontSize: 12, width: 16, color: isFirst ? C.gold : C.ivoryDim }}>{i + 1}</div>
                <div style={{ flex: 1, ...archivo, fontWeight: 600, fontSize: 15, lineHeight: 1.2, color: isFirst ? C.gold : C.ivory }}>{p.ai_name}</div>
                <div style={{ ...archivo, fontWeight: 800, fontSize: 22, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: isFirst ? C.gold : C.ivory }}>{p.score}</div>
                {canFriend && (
                  <button onClick={() => addFriendFromRoom(p.user_id)} disabled={st === "sending"}
                    title="Als Freund hinzufügen"
                    style={{ background: "none", border: "none", color: C.ivoryDim, cursor: st === "sending" ? "default" : "pointer", display: "flex", padding: 2, opacity: st === "sending" ? 0.5 : 1 }}>
                    <IconUserPlus size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "24px 18px 30px", display: "flex", flexDirection: "column", gap: 10 }}>
          {isHost ? (
            isGameEnd ? (
              <button onClick={() => act("newGame")} style={flatPrimaryBtn(false)}>NOCHMAL SPIELEN<span style={{ fontSize: 18 }}>→</span></button>
            ) : (
              <button onClick={() => act("nextRound")} disabled={loading} style={flatPrimaryBtn(loading)}>
                {loading ? "…" : `WEITER → RUNDE ${room.round + 1}`}<span style={{ fontSize: 18 }}>→</span>
              </button>
            )
          ) : (
            <div style={{ ...archivo, fontSize: 13, color: C.ivoryDim, textAlign: "center", padding: "17px 0" }}>Warte auf den Host…</div>
          )}
          <button onClick={onLeave} style={flatGhostBtn({ width: "100%", textAlign: "center", justifyContent: "center", display: "flex", boxSizing: "border-box" })}>ZURÜCK ZUR STARTSEITE</button>
          <div style={{ display: "flex", justifyContent: "center" }}>{voicePanel}</div>
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
      background: "rgba(16,22,26,0.97)", borderLeft: `1px solid ${C.glassBorder}`,
      display: "flex", flexDirection: "column" as const,
      paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)",
    }} className="slide-in-right">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderBottom: `1px solid ${C.glassBorder}` }}>
        <div style={{ ...cinzel, fontSize: 14, color: C.gold, display: "flex", alignItems: "center", gap: 6 }}><IconMessageCircle size={15} /> Chat</div>
        <button onClick={() => setShowChat(false)} style={{ background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", display: "flex" }}><IconX size={18} /></button>
      </div>
      {/* Muted senders - the only way back to unmute once their messages are hidden below */}
      {mutedChatIds.size > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, padding: "8px 12px", borderBottom: `1px solid ${C.glassBorder}` }}>
          {Array.from(mutedChatIds).map(id => (
            <button key={id} onClick={() => toggleChatMute(id)}
              style={{ ...archivo, fontSize: 10, background: "rgba(255,255,255,0.08)", border: "none", color: C.ivoryDim, padding: "4px 8px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {players.find((p: any) => p.user_id === id)?.ai_name ?? "Nutzer"} <IconX size={9} />
            </button>
          ))}
        </div>
      )}
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto" as const, padding: "10px 12px", display: "flex", flexDirection: "column" as const, gap: 8 }}>
        {chatMessages.length === 0 && (
          <div style={{ fontSize: 12, color: C.ivoryDim, textAlign: "center" as const, marginTop: 20 }}>Noch keine Nachrichten</div>
        )}
        {chatMessages.filter((m: any) => m.user_id === session.user.id || !mutedChatIds.has(m.user_id)).map((m: any) => {
          const mine = m.user_id === session.user.id;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              {!mine && (
                <div style={{ fontSize: 9, color: C.gold, marginBottom: 2, ...cinzel, display: "flex", alignItems: "center", gap: 5 }}>
                  {m.username}
                  <button onClick={() => toggleChatMute(m.user_id)} title="Nutzer im Chat stummschalten"
                    style={{ background: "none", border: "none", padding: 0, display: "flex", cursor: "pointer", color: C.ivoryDim, opacity: 0.5 }}>
                    <IconMicOff size={9} />
                  </button>
                </div>
              )}
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
            style={{
              ...goldBtn(voice.enabled),
              ...(voice.enabled && !voice.muted ? { background: C.success, color: C.ivory } : {}),
              padding: "4px 7px", display: "flex", opacity: voice.connecting ? 0.5 : 1,
            }}
            title={!voice.enabled ? "Sprachchat aktivieren" : voice.muted ? "Stummschaltung aufheben" : "Stummschalten"}
          >
            {voice.enabled && voice.muted ? <IconMicOff size={15} /> : <IconMic size={15} />}
          </button>
          {voice.enabled && (
            <button onClick={voice.disableVoice} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: "4px 7px", borderRadius: 6, display: "flex" }} title="Sprachchat verlassen"><IconX size={15} /></button>
          )}
          <button onClick={() => { setShowLog(v => !v); setShowChat(false); }} style={{ ...goldBtn(showLog), padding: "4px 7px", display: "flex" }} title="Log"><IconHistory size={15} /></button>
          <button onClick={() => { setShowChat(v => !v); setShowLog(false); }} style={{ ...goldBtn(showChat), padding: "4px 7px", position: "relative" as const, display: "flex" }} title="Chat">
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
          {spectatorBadge}
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
            case "left":        return { top: "46%", left: "13%",  transform: "translateY(-50%)" };
            case "right":       return { top: "46%", left: "87%", transform: "translate(-100%,-50%)" };
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
                  // Evenly spaced, all center-anchored (translate(-50%,...)) -
                  // the previous version anchored left/right by their edge
                  // and left the middle slot(s) at a fixed 25%/50%/75%
                  // center, which for n=5/6 put an edge card's box almost
                  // exactly on top of its neighbor's once the edge was
                  // pushed inward for the screen-clipping fix.
                  if (isMe)            pos = { bottom: "0%",  left: "50%", transform: "translateX(-50%)" };
                  else if (offset===1) pos = { top: "50%",   left: "8%",  transform: "translate(-50%,-50%)" };
                  else if (offset===2) pos = { top: "0%",    left: "50%", transform: "translateX(-50%)" };
                  else                 pos = { top: "50%",   left: "92%", transform: "translate(-50%,-50%)" };
                } else if (n === 5) {
                  if (isMe)            pos = { bottom: "0%",  left: "50%", transform: "translateX(-50%)" };
                  else if (offset===1) pos = { top: "50%",   left: "8%",  transform: "translate(-50%,-50%)" };
                  else if (offset===2) pos = { top: "0%",    left: "36%", transform: "translateX(-50%)" };
                  else if (offset===3) pos = { top: "0%",    left: "64%", transform: "translateX(-50%)" };
                  else                 pos = { top: "50%",   left: "92%", transform: "translate(-50%,-50%)" };
                } else {
                  if (isMe)            pos = { bottom: "0%",  left: "50%", transform: "translateX(-50%)" };
                  else if (offset===1) pos = { top: "50%",   left: "8%",  transform: "translate(-50%,-50%)" };
                  else if (offset===2) pos = { top: "0%",    left: "29%", transform: "translateX(-50%)" };
                  else if (offset===3) pos = { top: "0%",    left: "50%", transform: "translateX(-50%)" };
                  else if (offset===4) pos = { top: "0%",    left: "71%", transform: "translateX(-50%)" };
                  else                 pos = { top: "50%",   left: "92%", transform: "translate(-50%,-50%)" };
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
        <div style={{
          display: "flex", gap: "clamp(3px,1vw,6px)", flexWrap: "nowrap", justifyContent: myHand.length > 6 ? "flex-start" : "center",
          // Setting overflowX without an explicit overflowY makes browsers
          // treat the unset axis as "auto" too, not "visible" (CSS Overflow
          // spec) - so a selected card's translateY(-16px) lift/scale(1.05)
          // got silently clipped by this row's own top edge. 28px of padding
          // reserves headroom for that lift inside the row's own clip box;
          // the matching negative margin cancels the padding's own layout
          // push so the resting (unselected) hand position doesn't move.
          overflowX: "auto", marginTop: -28,
          alignSelf: "stretch", width: "100%", maxWidth: "100vw", minWidth: 0, boxSizing: "border-box" as const, padding: "28px 8px 8px", WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}>
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

// ─── Spectator Room ───────────────────────────────────────────────────────────
// Deliberately its own component rather than GameRoom+isSpectator flags:
// GameRoom's JSX assumes a real seat throughout (getSeatPositions clamps a
// missing index to player 0, which would otherwise misrender someone else's
// hand/score as "mine"), and it's large enough that threading a spectator
// branch through every phase would risk regressing the just-stabilized
// player experience. This is intentionally simpler: no seat-relative
// layout, no card interaction, no presence tracking (a spectator watching
// doesn't affect "did everyone leave mid-game" cleanup logic) - just the
// read-only facts every player can already see, rendered generically.
function SpectatorRoom({ roomId, session, voice, onLeave }: { roomId: string; session: Session; voice: ReturnType<typeof useVoiceChat>; onLeave: () => void }) {
  const roomGuard = useRef(makeSeqGuard()).current;
  const playersGuard = useRef(makeSeqGuard()).current;
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    const refreshState = () => {
      const roomToken = roomGuard.next();
      supabase.from("rooms").select("id, code, phase, round, max_rounds, dealer, current_player, trump_card, trump_suit, werewolf_suit, current_trick, last_trick_winner, last_trick_cards, edition, log, created_at").eq("id", roomId).single().then(({ data, error }) => {
        if (data) { if (roomGuard.isCurrent(roomToken)) setRoom(data); }
        else if (error) console.error("[SpectatorRoom] room fetch failed:", error.message);
      });
      const playersToken = playersGuard.next();
      loadPlayersSecure(roomId, session.user.id).then(data => {
        if (!data) { console.error("[SpectatorRoom] players fetch failed"); return; }
        if (!playersGuard.isCurrent(playersToken)) return;
        setPlayers(data);
      });
    };

    refreshState();
    // Spectators have no own room_players row, so the raw postgres_changes
    // stream GameRoom uses (RLS-scoped to auth.uid() = user_id) would never
    // deliver anything here - a "rooms" change plus a poll fallback is the
    // whole story for keeping this in sync.
    const ch = supabase.channel(`spectate:${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => refreshState())
      .subscribe();
    const poll = setInterval(refreshState, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") refreshState(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [roomId]);

  if (!room) {
    return <div style={{ ...tableStyle, justifyContent: "center" }}><div style={{ color: C.ivoryDim }}>Lade Partie…</div></div>;
  }

  // Warteraum has no trump, no trick, no seated players yet, and "current
  // player" is meaningless pre-deal - GameRoom itself doesn't reuse the
  // wood-grain table for this phase either (its own lobby is a plain
  // centered screen, see the `room.phase === "lobby"` branch above), so a
  // spectator watching before the game starts gets that same simpler screen
  // instead of an empty table with a misleading "Runde 0" header.
  if (room.phase === "lobby") {
    return (
      <div style={{ ...tableStyle, justifyContent: "center", gap: 20 }} className="fade-in">
        <button onClick={() => { callGameAction(roomId, "leaveSpectating", {}); onLeave(); }} style={{ alignSelf: "flex-start", background: "none", border: "none", color: C.ivoryDim, cursor: "pointer", fontSize: 13, textAlign: "left", padding: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <IconArrowLeft size={13} /> Zuschauen beenden
        </button>
        <div style={{ ...cinzel, fontSize: 24, color: C.gold, display: "flex", alignItems: "center", gap: 10 }}>
          👁 Warteraum
        </div>
        <div style={{ ...glass({ padding: "8px 24px" }), ...cinzel, fontSize: 20, letterSpacing: 6, color: C.goldLight }}>{room.code}</div>
        <div style={{ ...glass({ padding: "4px 14px" }), fontSize: 11, color: room?.edition === "anniversary" ? "#F7DC6F" : C.ivoryDim, display: "flex", alignItems: "center", gap: 6 }}>
          {room?.edition === "anniversary" ? <>⚡ 30 Jahre Edition</> : <><CardIcon size={11}><WizardArt index={0} /></CardIcon> Classic Edition</>}
        </div>

        <div style={{ ...glass({ padding: 16 }), width: "min(320px, 92vw)" }}>
          {players.map((p: any) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
              <span style={{ fontSize: 15 }}>{p.is_ai ? "🤖" : "👤"}</span>
              <div style={{ ...cinzel, fontSize: 13, color: C.ivory }}>
                {p.ai_name}
                {p.player_index === 0 && <span style={{ color: C.ivoryDim, fontWeight: 400 }}> (Host)</span>}
              </div>
              {!p.is_ai && (
                <span style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: p.connected ? C.success : "rgba(255,255,255,0.25)" }} title={p.connected ? "Verbunden" : "Getrennt"} />
              )}
            </div>
          ))}
        </div>

        <div style={{ color: C.ivoryDim, fontSize: 13 }}>Wartet auf den Host…</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {!voice.enabled ? (
            <button onClick={voice.enableVoice} disabled={voice.connecting} style={{ ...goldBtn(false), padding: "8px 14px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6, opacity: voice.connecting ? 0.5 : 1 }}>
              <IconMic size={14} /> {voice.connecting ? "Verbinde…" : "Sprachchat beitreten"}
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
      </div>
    );
  }

  const log: string[] = room.log ?? [];
  const trick: any[] = room.phase === "trickEnd" ? (room.last_trick_cards ?? room.current_trick ?? []) : (room.current_trick ?? []);
  // Purely a layout anchor (seat 0 drawn "closest to camera"), never a hand-
  // ownership marker: unlike GameRoom, no seat here ever renders a real card
  // for anyone (visible_hand is unconditionally null for spectators), so the
  // clamping this helper does for a missing "my seat" can't leak anything -
  // there's nothing seat-specific left for it to mislabel.
  const seats = getSeatPositions(players, 0);
  const n = players.length;

  const seatPos = (position: string): React.CSSProperties => {
    switch (position) {
      case "top":         return { top: "clamp(78px,11vh,140px)", left: "50%", transform: "translateX(-50%)" };
      case "top-left":    return { top: "clamp(78px,11vh,140px)", left: "22%", transform: "translateX(-50%)" };
      case "top-right":   return { top: "clamp(78px,11vh,140px)", left: "78%", transform: "translateX(-50%)" };
      case "left":        return { top: "46%", left: "13%",  transform: "translateY(-50%)" };
      case "right":       return { top: "46%", left: "87%", transform: "translate(-100%,-50%)" };
      default:             return { bottom: "clamp(18px,6vh,60px)", left: "50%", transform: "translateX(-50%)" };
    }
  };

  const PlayerSeat = ({ p, position }: { p: any; position: string }) => {
    const isActive = room.phase === "playing" && Number(room.current_player) === Number(p.player_index);
    const hasBid = p.bid !== null;
    const hasPlayed = trick.some((t: any) => t.playerIndex === p.player_index);
    return (
      <div style={{ position: "absolute" as const, ...seatPos(position), zIndex: 5, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4 }}>
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
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginLeft: "auto" }}>🂠{p.hand_count ?? 0}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in" style={{ height: "100dvh", width: "100%", overflow: "hidden", position: "relative" as const, background: C.bgDark }}>
      {/* Status bar safe-area strip - matches table color */}
      <div style={{ position: "absolute" as const, top: 0, left: 0, right: 0, height: "env(safe-area-inset-top)", background: "#101713", zIndex: 16 }} />

      <div style={{ position: "absolute" as const, top: "env(safe-area-inset-top)", left: 0, right: 0, bottom: 0 }}>
        {/* Table surface: same wood-grain treatment as the live game table */}
        <div style={{ position: "absolute" as const, inset: 0, pointerEvents: "none" as const, background: "radial-gradient(ellipse at 50% 35%, #3b4a41 0%, #232e28 55%, #101713 100%)" }} />
        <div style={{ position: "absolute" as const, inset: 0, pointerEvents: "none" as const, backgroundImage: "repeating-linear-gradient(89deg, rgba(0,0,0,0.16) 0px, transparent 2px, transparent 30px, rgba(255,255,255,0.05) 33px, transparent 36px, transparent 70px), repeating-linear-gradient(91deg, rgba(0,0,0,0.10) 0px, transparent 1px, transparent 55px, rgba(255,255,255,0.03) 57px, transparent 60px, transparent 118px)" }} />
        <div style={{ position: "absolute" as const, inset: 0, pointerEvents: "none" as const, opacity: 0.5, mixBlendMode: "overlay" as const, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.12 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
        <div style={{ position: "absolute" as const, inset: 0, pointerEvents: "none" as const, background: "radial-gradient(ellipse at 50% 40%, transparent 0%, transparent 45%, rgba(0,0,0,0.38) 100%)" }} />

        {/* Header */}
        <div style={{ position: "absolute" as const, top: 0, left: 0, right: 0, zIndex: 15, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px 6px 12px", background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%)" }}>
          <button onClick={() => { callGameAction(roomId, "leaveSpectating", {}); onLeave(); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", cursor: "pointer", fontSize: "clamp(10px,1.8vmin,14px)", display: "inline-flex", alignItems: "center", gap: 4, ...cinzel }}>
            <IconArrowLeft size={13} /> ZUSCHAUEN BEENDEN
          </button>
          <div style={{ ...cinzel, fontSize: "clamp(11px,2vmin,18px)", color: C.gold, letterSpacing: "clamp(1px,0.4vmin,4px)", display: "flex", alignItems: "center", gap: 6 }}>
            👁 {room.code} · RUNDE {room.round}/{room.max_rounds}
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <button onClick={voice.enabled ? voice.toggleMute : voice.enableVoice} disabled={voice.connecting}
              style={{
                ...goldBtn(voice.enabled),
                ...(voice.enabled && !voice.muted ? { background: C.success, color: C.ivory } : {}),
                padding: "4px 7px", display: "flex", opacity: voice.connecting ? 0.5 : 1,
              }}
              title={!voice.enabled ? "Sprachchat beitreten" : voice.muted ? "Stummschaltung aufheben" : "Stummschalten"}>
              {voice.enabled && voice.muted ? <IconMicOff size={15} /> : <IconMic size={15} />}
            </button>
            {voice.enabled && (
              <button onClick={voice.disableVoice} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: "4px 7px", borderRadius: 6, display: "flex" }} title="Sprachchat verlassen"><IconX size={15} /></button>
            )}
            <button onClick={() => setShowLog(v => !v)} style={{ ...goldBtn(showLog), padding: "4px 7px", display: "flex" }} title="Log"><IconHistory size={15} /></button>
          </div>
        </div>

        {voice.error && (
          <div style={{ position: "absolute" as const, top: 44, left: "50%", transform: "translateX(-50%)", zIndex: 15, ...glass({ padding: "6px 10px" }), fontSize: 11, color: "#FF8080", whiteSpace: "nowrap" as const }}>
            {voice.error}
          </div>
        )}

        {/* All seats - every player gets the same glowing-when-active pill, none singled out as "mine" */}
        {seats.map((s: any) => <PlayerSeat key={s.player.id} p={s.player} position={s.position} />)}

        {/* Trumpf - fixed corner */}
        {room.trump_card && (() => {
          const trumpHasChosenSuit = room.trump_card.type === "wizard" ||
            ["wizardfool", "vampire", "rainbow9", "dragon", "rainbow7"].includes(room.trump_card.specialType);
          return (
            <div style={{ position: "absolute" as const, bottom: "26%", left: "clamp(10px,3vw,40px)", textAlign: "center", zIndex: 4 }}>
              <div style={{ position: "relative" as const, display: "inline-block" }}>
                {room.trump_suit && trumpHasChosenSuit && (
                  <div style={{ position: "absolute" as const, top: -10, left: "50%", transform: "translateX(-50%)", background: SUIT_COLORS[room.trump_suit as keyof typeof SUIT_COLORS], color: "#fff", borderRadius: 20, padding: "2px 8px", fontSize: "clamp(8px,1.2vmin,12px)", fontWeight: 700, ...cinzel, whiteSpace: "nowrap" as const, zIndex: 5, boxShadow: "0 2px 6px rgba(0,0,0,0.5)" }}>
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

        {/* Trick cards - center of table, same seat-relative positioning as the live game */}
        <div style={{ position: "absolute" as const, top: "44%", left: "50%", transform: "translate(-50%,-50%)", width: "60%", height: "26%", zIndex: 3 }}>
          {trick.length === 0 && room.phase === "playing" && (
            <div style={{ position: "absolute" as const, top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "center", whiteSpace: "nowrap" as const }}>
              {players[room.current_player]?.ai_name} beginnt…
            </div>
          )}
          {trick.map((t: any) => {
            const offset = (t.playerIndex - 0 + n) % n;
            const isBottom = offset === 0;
            let pos: React.CSSProperties = {};
            if (n <= 3) {
              if (isBottom)          pos = { bottom: "0%", left: "50%", transform: "translateX(-50%)" };
              else if (offset === 1) pos = { top: "0%", left: "30%", transform: "translateX(-50%)" };
              else                   pos = { top: "0%", left: "70%", transform: "translateX(-50%)" };
            } else if (n === 4) {
              // Evenly spaced, all center-anchored (translate(-50%,...)) -
              // anchoring left/right by their edge while the middle slot(s)
              // stayed at a fixed 25%/50%/75% center put an edge card's box
              // almost exactly on top of its neighbor's once the edge was
              // pushed inward for the screen-clipping fix.
              if (isBottom)          pos = { bottom: "0%", left: "50%", transform: "translateX(-50%)" };
              else if (offset === 1) pos = { top: "50%", left: "8%", transform: "translate(-50%,-50%)" };
              else if (offset === 2) pos = { top: "0%", left: "50%", transform: "translateX(-50%)" };
              else                   pos = { top: "50%", left: "92%", transform: "translate(-50%,-50%)" };
            } else if (n === 5) {
              if (isBottom)          pos = { bottom: "0%", left: "50%", transform: "translateX(-50%)" };
              else if (offset === 1) pos = { top: "50%", left: "8%", transform: "translate(-50%,-50%)" };
              else if (offset === 2) pos = { top: "0%", left: "36%", transform: "translateX(-50%)" };
              else if (offset === 3) pos = { top: "0%", left: "64%", transform: "translateX(-50%)" };
              else                   pos = { top: "50%", left: "92%", transform: "translate(-50%,-50%)" };
            } else {
              if (isBottom)          pos = { bottom: "0%", left: "50%", transform: "translateX(-50%)" };
              else if (offset === 1) pos = { top: "50%", left: "8%", transform: "translate(-50%,-50%)" };
              else if (offset === 2) pos = { top: "0%", left: "29%", transform: "translateX(-50%)" };
              else if (offset === 3) pos = { top: "0%", left: "50%", transform: "translateX(-50%)" };
              else if (offset === 4) pos = { top: "0%", left: "71%", transform: "translateX(-50%)" };
              else                   pos = { top: "50%", left: "92%", transform: "translate(-50%,-50%)" };
            }
            const isWinner = room.phase === "trickEnd" && room.last_trick_winner === t.playerIndex;
            const isBombed = room.phase === "trickEnd" && t.card.specialType === "bomb";
            return (
              <div key={t.playerIndex} style={{ position: "absolute" as const, textAlign: "center", ...pos }}>
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", marginBottom: 2, ...cinzel }}>{players[t.playerIndex]?.ai_name}</div>
                <div style={{ position: "relative" as const, animation: isBombed ? "bombShake 0.5s ease-in-out 2" : undefined }}>
                  <CardView card={t.card} winner={isWinner} small />
                  {isBombed && (
                    <div style={{ position: "absolute" as const, inset: 0, pointerEvents: "none" as const, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 6 }}>
                      <div style={{ width: "160%", height: "160%", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,225,140,0.95) 0%, rgba(255,140,40,0.85) 35%, rgba(220,40,20,0.6) 60%, transparent 75%)", animation: "bombBurst 0.7s ease-out forwards" }} />
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

        {/* Log */}
        {showLog && (
          <div style={{ position: "absolute" as const, top: 44, right: 12, zIndex: 20, ...glass({ padding: 8 }), fontSize: "var(--text-xs)", color: C.ivoryDim, width: "min(280px, 70vw)", maxHeight: "50vh", overflowY: "auto" as const }}>
            {log.map((l: string, i: number) => (
              <div key={i} style={{ padding: "2px 0", borderBottom: "1px solid rgba(201,168,76,0.06)" }}>{l}</div>
            ))}
          </div>
        )}
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
