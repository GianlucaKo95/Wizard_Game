import { Card, SUIT_COLORS, SUIT_SYMBOLS, cardLabel } from "./types";

interface Props {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  small?: boolean;
  faceDown?: boolean;
  disabled?: boolean;
}

export function CardView({ card, onClick, selected, small, faceDown, disabled }: Props) {
  const w = small ? 44 : 64;
  const h = small ? 66 : 96;

  const base: React.CSSProperties = {
    width: w, height: h, borderRadius: 6,
    border: selected ? "2px solid #ffd700" : "2px solid #555",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    cursor: onClick && !disabled ? "pointer" : "default",
    userSelect: "none",
    transition: "transform 0.15s, box-shadow 0.15s",
    boxShadow: selected ? "0 0 14px #ffd700" : "0 2px 6px rgba(0,0,0,0.5)",
    fontSize: small ? 13 : 18, fontWeight: "bold",
    position: "relative", flexShrink: 0,
    opacity: disabled ? 0.4 : 1,
  };

  if (faceDown) {
    return <div style={{ ...base, background: "linear-gradient(135deg,#1a1a4e 25%,#2d2d7a 50%,#1a1a4e 75%)" }} />;
  }

  const bg =
    card.type === "wizard" ? "linear-gradient(135deg,#4a0072,#9c27b0)" :
    card.type === "fool"   ? "linear-gradient(135deg,#1a6b1a,#4caf50)" :
    "#fff";
  const color =
    card.type === "wizard" ? "#fff" :
    card.type === "fool"   ? "#fff" :
    SUIT_COLORS[card.suit!];
  const sym =
    card.type === "wizard" ? "🧙" :
    card.type === "fool"   ? "🃏" :
    SUIT_SYMBOLS[card.suit!];
  const label = cardLabel(card);

  return (
    <div style={{ ...base, background: bg, color }}
      onClick={onClick && !disabled ? onClick : undefined}
      onMouseEnter={e => { if (onClick && !disabled) (e.currentTarget as HTMLElement).style.transform = "translateY(-7px)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ""; }}
    >
      <div style={{ position: "absolute", top: 3, left: 5, fontSize: small ? 10 : 12 }}>{label}</div>
      <div style={{ fontSize: small ? 20 : 26 }}>{sym}</div>
      <div style={{ position: "absolute", bottom: 3, right: 5, fontSize: small ? 10 : 12, transform: "rotate(180deg)" }}>{label}</div>
    </div>
  );
}
