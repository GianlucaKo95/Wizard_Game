import { memo } from "react";
import { Card } from "./types";
import { HOUSES, CHAR_NAMES, WIZARD_CHARS, FOOL_CHARS } from "./cards";
import { NumberArt, WizardArt, FoolArt, DragonArt, FairyArt, WitchArt, WerewolfArt, VampireArt, BombArt, Rainbow7Art, Rainbow9Art, WizardFoolArt } from "./CardArt";

interface Props {
  card: Card;
  onClick?: () => void;
  selected?: boolean;
  small?: boolean;
  faceDown?: boolean;
  disabled?: boolean;
  werewolfSuit?: string; // for coloring werewolf trump card
}

export const CardView = memo(function CardView({ card, onClick, selected, small, faceDown, disabled, werewolfSuit }: Props) {
  const w = small ? 44 : 66;
  const h = small ? 66 : 100;

  const base: React.CSSProperties = {
    width: w, height: h,
    borderRadius: small ? 5 : 8,
    overflow: "hidden",
    border: selected ? "2px solid #C9A84C" : "1px solid rgba(201,168,76,0.2)",
    cursor: onClick && !disabled ? "pointer" : "default",
    userSelect: "none",
    WebkitUserSelect: "none",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    position: "relative",
    flexShrink: 0,
    opacity: disabled ? 0.4 : 1,
    boxShadow: selected
      ? "0 0 18px rgba(201,168,76,0.7), 0 4px 14px rgba(0,0,0,0.6)"
      : "0 3px 10px rgba(0,0,0,0.6)",
    willChange: onClick ? "transform" : "auto",
    transform: "translateZ(0)",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  };

  // Face down card
  if (faceDown) {
    return (
      <div style={{ ...base, background: "#0D1B2A", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 44 66" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
          <rect width="44" height="66" fill="#0D1B2A" />
          {/* Diamond pattern */}
          {Array.from({ length: 6 }, (_, row) =>
            Array.from({ length: 4 }, (_, col) => (
              <rect key={`${row}-${col}`}
                x={col * 11 + (row % 2 === 0 ? 0 : 5.5) - 2}
                y={row * 11 - 2}
                width="6" height="6"
                transform={`rotate(45 ${col * 11 + (row % 2 === 0 ? 3 : 8.5)} ${row * 11 + 3})`}
                fill="none" stroke="rgba(201,168,76,0.2)" strokeWidth="0.5"
              />
            ))
          )}
          {/* Center crest */}
          <text x="22" y="37" textAnchor="middle" fontSize="18" fill="rgba(201,168,76,0.3)">⚡</text>
          <rect x="2" y="2" width="40" height="62" fill="none" stroke="rgba(201,168,76,0.3)" strokeWidth="0.8" rx="3" />
        </svg>
      </div>
    );
  }

  // Determine which art to show
  const isWizard = card.type === "wizard";
  const isFool = card.type === "fool";
  const isSpecial = card.type === "special";

  // Get wizard/fool index from card id
  const getIndex = () => {
    if (card.id.includes("-")) {
      const num = parseInt(card.id.split("-")[1]) || 0;
      return num;
    }
    return 0;
  };

  const house = card.suit ?? "red";
  const houseData = HOUSES[house as keyof typeof HOUSES];
  const charName = CHAR_NAMES[card.value] ?? "";
  const wizChar = WIZARD_CHARS[getIndex() % 4];
  const foolChar = FOOL_CHARS[getIndex() % 4];

  // Special card config
  const specialConfigs: Record<string, { label: string; color: string }> = {
    dragon:     { label: "🐉", color: "#A8C0E8" },
    fairy:      { label: "✦", color: "#D2B4DE" },
    witch:      { label: "N", color: "#C0392B" },
    werewolf:   { label: "W", color: "#F7DC6F" },
    vampire:    { label: "V", color: "#9B59B6" },
    bomb:       { label: "✕", color: "#E8DAEF" },
    rainbow7:   { label: "7½", color: "#F1C40F" },
    rainbow9:   { label: "9¾", color: "#AED6F1" },
    wizardfool: { label: "?", color: "#D3A625" },
  };
  const specialCfg = isSpecial ? specialConfigs[card.id] ?? { label: "?", color: "#fff" } : null;

  const label = isWizard ? "Z" : isFool ? "N" : isSpecial ? (specialCfg?.label ?? "?") : String(card.value);
  const labelColor = isWizard ? "#C9A84C" : isFool ? "#95A5A6" : isSpecial ? (specialCfg?.color ?? "#fff") : houseData?.accent ?? "#fff";
  const cardName = isWizard ? wizChar.name : isFool ? foolChar.name : charName;

  return (
    <div
      className={`card-view no-select${onClick && !disabled ? " card-clickable" : ""}`}
      style={base}
      onClick={onClick && !disabled ? onClick : undefined}
      onPointerEnter={e => {
        if (onClick && !disabled && e.pointerType !== "touch") {
          (e.currentTarget as HTMLElement).style.transform = "translateY(-10px) scale(1.03) translateZ(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 30px rgba(0,0,0,0.7), 0 0 20px rgba(201,168,76,0.4)";
          (e.currentTarget as HTMLElement).style.zIndex = "10";
        }
      }}
      onPointerLeave={e => {
        if (e.pointerType !== "touch") {
          (e.currentTarget as HTMLElement).style.transform = "translateZ(0)";
          (e.currentTarget as HTMLElement).style.boxShadow = selected ? "0 0 18px rgba(201,168,76,0.7)" : "0 3px 10px rgba(0,0,0,0.6)";
          (e.currentTarget as HTMLElement).style.zIndex = "";
        }
      }}
    >
      {/* Card Art */}
      <div style={{ position: "absolute", inset: 0 }}>
        {isSpecial ? (() => {
          const specialImgMap: Record<string, string> = {
            dragon: "Special_Dragon",
            fairy: "Special_Fairy",
            witch: "Special_Witch",
            werewolf: "Special_Werewolf",
            vampire: "Special_Vampire",
            bomb: "Special_Bomb",
            rainbow7: "Special_George",
            rainbow9: "Special_Platform9",
            wizardfool: "Special_Ron",
          };
          const imgName = specialImgMap[card.id];
          const fallback =
            card.id === "dragon"     ? <DragonArt /> :
            card.id === "fairy"      ? <FairyArt /> :
            card.id === "witch"      ? <WitchArt /> :
            card.id === "werewolf"   ? <WerewolfArt suit={werewolfSuit} /> :
            card.id === "vampire"    ? <VampireArt /> :
            card.id === "bomb"       ? <BombArt /> :
            card.id === "rainbow7"   ? <Rainbow7Art /> :
            card.id === "rainbow9"   ? <Rainbow9Art /> :
            card.id === "wizardfool" ? <WizardFoolArt /> :
            <NumberArt value={7} house="red" />;
          if (!imgName) return fallback;
          return (
            <img src={`/cards/${imgName}.png`} alt={imgName}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) parent.setAttribute("data-fallback", "true");
              }} />
          );
        })() : isWizard
          ? (() => {
            const idx = (getIndex() % 4) + 1;
            return (
              <img src={`/cards/Wizard_${idx}.png`} alt={`Wizard ${idx}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            );
          })()
          : isFool
          ? (() => {
            const idx = (getIndex() % 4) + 1;
            return (
              <img src={`/cards/Fool_${idx}.png`} alt={`Fool ${idx}`}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            );
          })()
          : (() => {
            const folderMap: Record<string, string> = {
              red: "Gryffindor",
              blue: "Ravenclaw",
              green: "Slytherin",
              yellow: "Hufflepuff",
            };
            const folder = folderMap[house];
            const imgPath = `/cards/${folder}_${card.value}.png`;
            return (
              <div style={{ position: "relative", width: "100%", height: "100%" }}>
                <img
                  src={imgPath}
                  alt={`${folder} ${card.value}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            );
          })()
        }
      </div>

      {/* Top-left label */}
      {!small && (
        <div style={{
          position: "absolute", top: 3, left: 4,
          background: "rgba(0,0,0,0.7)",
          borderRadius: 3, padding: "1px 4px",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: labelColor, fontFamily: "Cinzel, serif", lineHeight: 1.2 }}>{label}</span>
          {!isWizard && !isFool && houseData && (
            <span style={{ fontSize: 8, color: houseData.accent }}>{houseData.sigil}</span>
          )}
        </div>
      )}

      {/* Small card label */}
      {small && (
        <div style={{ position: "absolute", top: 2, left: 3, fontSize: 9, fontWeight: 700, color: labelColor, fontFamily: "Cinzel, serif", background: "rgba(0,0,0,0.6)", borderRadius: 2, padding: "1px 3px" }}>
          {label}
        </div>
      )}

      {/* Bottom-right label (rotated) */}
      {!small && (
        <div style={{
          position: "absolute", bottom: 3, right: 4,
          background: "rgba(0,0,0,0.7)",
          borderRadius: 3, padding: "1px 4px",
          transform: "rotate(180deg)",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: labelColor, fontFamily: "Cinzel, serif", lineHeight: 1.2 }}>{label}</span>
          {!isWizard && !isFool && houseData && (
            <span style={{ fontSize: 8, color: houseData.accent }}>{houseData.sigil}</span>
          )}
        </div>
      )}

      {/* Selected glow overlay */}
      {selected && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(201,168,76,0.1)", pointerEvents: "none" }} />
      )}
    </div>
  );
});
