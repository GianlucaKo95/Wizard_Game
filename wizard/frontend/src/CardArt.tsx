// SVG character illustrations for each card type

// ─── Shared Portrait Frame ────────────────────────────────────────────────────
export function PortraitFrame({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      {/* Background */}
      <rect width="100" height="140" fill={bg} />
      {/* Inner border */}
      <rect x="3" y="3" width="94" height="134" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" rx="2"/>
      {children}
    </svg>
  );
}

// ─── Number Card Art (value 1-13) ─────────────────────────────────────────────
export function NumberArt({ value, house }: { value: number; house: string }) {
  const configs: Record<number, { head: string; body: string; detail: string; hair: string }> = {
    1:  { head: "#F5CBA7", body: "#2C3E50", detail: "#E74C3C", hair: "#6D4C41" },  // Erstjähriger
    2:  { head: "#BDC3C7", body: "#7F8C8D", detail: "#95A5A6", hair: "#ECF0F1" },  // Geist
    3:  { head: "#F5CBA7", body: "#2980B9", detail: "#F1C40F", hair: "#4A235A" },  // Schüler
    4:  { head: "#F0D9B5", body: "#1A5276", detail: "#C0392B", hair: "#2C3E50" },  // Prefekt
    5:  { head: "#F5CBA7", body: "#922B21", detail: "#F7DC6F", hair: "#7D6608" },  // Quidditch
    6:  { head: "#F0D9B5", body: "#154360", detail: "#2ECC71", hair: "#1C2833" },  // Expelliarmus
    7:  { head: "#FBEEE6", body: "#212F3D", detail: "#8E44AD", hair: "#6E2F1A" },  // Auror
    8:  { head: "#F5CBA7", body: "#0B5345", detail: "#E67E22", hair: "#4A235A" },  // Zaubertrank
    9:  { head: "#D5B895", body: "#4A235A", detail: "#E8DAEF", hair: "#7D6608" },  // Lehrer
    10: { head: "#F0D9B5", body: "#1B2631", detail: "#F1C40F", hair: "#2C3E50" },  // Kopfschüler
    11: { head: "#FBEEE6", body: "#6C3483", detail: "#F7DC6F", hair: "#1C2833" },  // Orden
    12: { head: "#D5B895", body: "#17202A", detail: "#2980B9", hair: "#4A235A" },  // Ministerium
    13: { head: "#E8DAEF", body: "#4A235A", detail: "#F0E6FF", hair: "#7D6608" },  // Großmeister
  };

  const houseColors: Record<string, { robe: string; trim: string }> = {
    red:    { robe: "#740001", trim: "#D3A625" },
    blue:   { robe: "#0C1A40", trim: "#A8C0E8" },
    green:  { robe: "#1A3A2A", trim: "#2EA94B" },
    yellow: { robe: "#372E29", trim: "#F7C948" },
  };

  const c = configs[value] ?? configs[1];
  const h = houseColors[house] ?? houseColors.red;

  // Wand position varies by value
  const wandAngle = -30 + (value % 5) * 15;
  const wandX = 72 + Math.cos((wandAngle * Math.PI) / 180) * 8;
  const wandY = 85 - Math.sin((wandAngle * Math.PI) / 180) * 8;

  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      {/* Sky background gradient */}
      <defs>
        <linearGradient id={`bg${value}${house}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={h.robe} stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0a0a15" />
        </linearGradient>
        <radialGradient id={`glow${value}${house}`} cx="50%" cy="40%" r="40%">
          <stop offset="0%" stopColor={h.trim} stopOpacity="0.2" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="100" height="140" fill={`url(#bg${value}${house})`} />
      <rect width="100" height="140" fill={`url(#glow${value}${house})`} />

      {/* Stone wall texture lines */}
      {[20,35,50,65,80,95,110,125].map(y => (
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      ))}

      {/* Body/Robe */}
      <ellipse cx="50" cy="115" rx="28" ry="35" fill={h.robe} />
      <ellipse cx="50" cy="115" rx="24" ry="32" fill={c.body} />
      {/* Robe trim */}
      <line x1="50" y1="83" x2="50" y2="140" stroke={h.trim} strokeWidth="1.5" />
      <ellipse cx="50" cy="92" rx="10" ry="5" fill={h.robe} stroke={h.trim} strokeWidth="0.8" />

      {/* Neck */}
      <rect x="44" y="72" width="12" height="12" rx="3" fill={c.head} />

      {/* Head */}
      <ellipse cx="50" cy="62" rx="18" ry="20" fill={c.head} />

      {/* Hair */}
      <ellipse cx="50" cy="44" rx="19" ry="10" fill={c.hair} />
      {value <= 6 && <ellipse cx="32" cy="58" rx="5" ry="10" fill={c.hair} />}
      {value <= 6 && <ellipse cx="68" cy="58" rx="5" ry="10" fill={c.hair} />}
      {value >= 9 && (
        <>
          <ellipse cx="50" cy="42" rx="18" ry="8" fill={c.hair} />
          <rect x="32" y="42" width="5" height="14" rx="2" fill={c.hair} />
          <rect x="63" y="42" width="5" height="14" rx="2" fill={c.hair} />
        </>
      )}

      {/* Eyes */}
      <ellipse cx="44" cy="62" rx="3" ry="3.5" fill="white" />
      <ellipse cx="56" cy="62" rx="3" ry="3.5" fill="white" />
      <ellipse cx="44.5" cy="62.5" rx="1.8" ry="2" fill="#1a1a2e" />
      <ellipse cx="56.5" cy="62.5" rx="1.8" ry="2" fill="#1a1a2e" />
      <circle cx="45" cy="62" r="0.6" fill="white" />
      <circle cx="57" cy="62" r="0.6" fill="white" />

      {/* Nose */}
      <path d={`M50 65 Q48 70 46 71 Q50 73 54 71 Q52 70 50 65`} fill={c.head} stroke="rgba(0,0,0,0.2)" strokeWidth="0.3" />

      {/* Mouth – varies by value */}
      {value >= 7
        ? <path d="M45 76 Q50 79 55 76" fill="none" stroke="#8B4513" strokeWidth="1" /> // serious
        : <path d="M45 76 Q50 80 55 76" fill="none" stroke="#8B4513" strokeWidth="1" />  // slight smile
      }

      {/* Glasses for scholars (value 9+) */}
      {value >= 9 && (
        <>
          <circle cx="44" cy="62" r="5" fill="none" stroke={h.trim} strokeWidth="0.8" />
          <circle cx="56" cy="62" r="5" fill="none" stroke={h.trim} strokeWidth="0.8" />
          <line x1="49" y1="62" x2="51" y2="62" stroke={h.trim} strokeWidth="0.8" />
        </>
      )}

      {/* Wand */}
      <line x1="68" y1="90" x2={wandX} y2={wandY} stroke="#8B6914" strokeWidth="2" strokeLinecap="round" />
      <circle cx={wandX} cy={wandY} r="2" fill={h.trim} opacity="0.8" />
      {/* Wand sparkle */}
      <circle cx={wandX} cy={wandY} r="4" fill={h.trim} opacity="0.2" />

      {/* House sigil bottom */}
      <text x="50" y="138" textAnchor="middle" fontSize="6" fill={h.trim} fontFamily="serif" opacity="0.7">
        {house === "red" ? "⚔" : house === "blue" ? "✦" : house === "green" ? "◆" : "✿"}
      </text>

      {/* Inner border */}
      <rect x="2" y="2" width="96" height="136" fill="none" stroke={h.trim} strokeWidth="0.8" rx="3" opacity="0.5" />
    </svg>
  );
}

// ─── Wizard Card Art ──────────────────────────────────────────────────────────
export function WizardArt({ index }: { index: number }) {
  const configs = [
    { // Albus – long white beard, half-moon glasses, purple robes
      bg1: "#2C0D5E", bg2: "#0a0420",
      robe: "#4A0080", trim: "#C9A84C",
      skin: "#E8DAEF", hair: "#ECF0F1",
      beard: true, glasses: true, hat: true,
      hatColor: "#4A0080", eyeColor: "#4169E1",
      detail: "Schulleiter",
    },
    { // Salazar – pale, slicked hair, green robes
      bg1: "#0D2818", bg2: "#020D07",
      robe: "#1A3A2A", trim: "#2EA94B",
      skin: "#D5E8D4", hair: "#2C3E50",
      beard: false, glasses: false, hat: false,
      hatColor: "#1A3A2A", eyeColor: "#27AE60",
      detail: "Gründer",
    },
    { // Tom – pale, no hair, red eyes, dark robes
      bg1: "#3D0000", bg2: "#0D0000",
      robe: "#1A0000", trim: "#C0392B",
      skin: "#D5D8DC", hair: "#1C2833",
      beard: false, glasses: false, hat: false,
      hatColor: "#1A0000", eyeColor: "#C0392B",
      detail: "Dunkler Lord",
    },
    { // Minerva – stern, bun hair, green robes, hat
      bg1: "#1A3A2A", bg2: "#050D08",
      robe: "#0D2818", trim: "#7DCEA0",
      skin: "#F5CBA7", hair: "#1C2833",
      beard: false, glasses: true, hat: true,
      hatColor: "#0D2818", eyeColor: "#117A65",
      detail: "Professorin",
    },
  ];

  const c = configs[index % 4];

  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id={`wbg${index}`} cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor={c.bg1} />
          <stop offset="100%" stopColor={c.bg2} />
        </radialGradient>
        <radialGradient id={`aura${index}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={c.trim} stopOpacity="0.3" />
          <stop offset="100%" stopColor={c.trim} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100" height="140" fill={`url(#wbg${index})`} />

      {/* Magical aura */}
      <ellipse cx="50" cy="70" rx="45" ry="55" fill={`url(#aura${index})`} />

      {/* Stars */}
      {[15,25,75,85,10,90].map((x,i) => (
        <circle key={i} cx={x} cy={8+i*4} r="0.8" fill={c.trim} opacity={0.5+i*0.1} />
      ))}

      {/* Pointed hat */}
      {c.hat && (
        <>
          <polygon points="50,8 35,42 65,42" fill={c.hatColor} />
          <rect x="28" y="40" width="44" height="8" rx="4" fill={c.hatColor} />
          <line x1="35" y1="42" x2="65" y2="42" stroke={c.trim} strokeWidth="1" />
        </>
      )}

      {/* Body */}
      <ellipse cx="50" cy="120" rx="32" ry="30" fill={c.robe} />
      <ellipse cx="50" cy="115" rx="26" ry="26" fill={c.robe} opacity="0.8" />
      <line x1="50" y1="88" x2="50" y2="140" stroke={c.trim} strokeWidth="2" />

      {/* Cloak details */}
      <path d={`M50 88 Q25 100 18 130 Q50 125 50 140`} fill={c.robe} opacity="0.6" />
      <path d={`M50 88 Q75 100 82 130 Q50 125 50 140`} fill={c.robe} opacity="0.6" />

      {/* Arms */}
      <line x1="50" y1="95" x2="22" y2="110" stroke={c.robe} strokeWidth="10" strokeLinecap="round" />
      <line x1="50" y1="95" x2="78" y2="110" stroke={c.robe} strokeWidth="10" strokeLinecap="round" />

      {/* Hands */}
      <ellipse cx="20" cy="112" rx="5" ry="4" fill={c.skin} />
      <ellipse cx="80" cy="112" rx="5" ry="4" fill={c.skin} />

      {/* Wand with magic */}
      <line x1="80" y1="112" x2="95" y2="88" stroke="#8B6914" strokeWidth="2.5" strokeLinecap="round" />
      {[0,1,2,3].map(i => (
        <circle key={i} cx={90+i*2} cy={85-i*3} r={2-i*0.3} fill={c.trim} opacity={0.9-i*0.2} />
      ))}

      {/* Neck */}
      <rect x="44" y="72" width="12" height="16" rx="3" fill={c.skin} />

      {/* Head */}
      <ellipse cx="50" cy={c.hat ? 58 : 62} rx="18" ry="20" fill={c.skin} />

      {/* Hair */}
      {index === 2 // Tom – almost no hair
        ? <ellipse cx="50" cy={c.hat ? 40 : 44}" rx="17" ry="5" fill={c.hair} />
        : index === 3 // Minerva – bun
        ? <>
            <ellipse cx="50" cy={c.hat ? 40 : 44} rx="16" ry="7" fill={c.hair} />
            <circle cx="50" cy={c.hat ? 37 : 41} r="6" fill={c.hair} />
          </>
        : <>
            <ellipse cx="50" cy={c.hat ? 40 : 44} rx="18" ry="9" fill={c.hair} />
            {index === 0 && <ellipse cx="30" cy={c.hat ? 54 : 58} rx="5" ry="12" fill={c.hair} />}
            {index === 0 && <ellipse cx="70" cy={c.hat ? 54 : 58} rx="5" ry="12" fill={c.hair} />}
          </>
      }

      {/* Beard – Albus only */}
      {c.beard && (
        <>
          <ellipse cx="50" cy={78} rx="14" ry="18" fill={c.hair} opacity="0.95" />
          <ellipse cx="50" cy={82} rx="10" ry="14" fill={c.hair} />
        </>
      )}

      {/* Eyes */}
      <ellipse cx="44" cy={c.hat ? 60 : 64} rx="3.5" ry="4" fill="white" />
      <ellipse cx="56" cy={c.hat ? 60 : 64} rx="3.5" ry="4" fill="white" />
      <ellipse cx="44.5" cy={c.hat ? 60.5 : 64.5} rx="2" ry="2.5" fill={c.eyeColor} />
      <ellipse cx="56.5" cy={c.hat ? 60.5 : 64.5} rx="2" ry="2.5" fill={c.eyeColor} />
      <circle cx="44" cy={c.hat ? 59.5 : 63.5} r="0.8" fill="white" />
      <circle cx="56" cy={c.hat ? 59.5 : 63.5} r="0.8" fill="white" />

      {/* Glasses */}
      {c.glasses && (
        <>
          <circle cx="44" cy={c.hat ? 60 : 64} r="5.5" fill="none" stroke={c.trim} strokeWidth="0.8" />
          <circle cx="56" cy={c.hat ? 60 : 64} r="5.5" fill="none" stroke={c.trim} strokeWidth="0.8" />
          <line x1="49.5" y1={c.hat ? 60 : 64} x2="50.5" y2={c.hat ? 60 : 64} stroke={c.trim} strokeWidth="0.8" />
        </>
      )}

      {/* Nose */}
      <path d={`M50 ${c.hat ? 65 : 69} Q48 ${c.hat ? 70 : 74} 46 ${c.hat ? 71 : 75} Q50 ${c.hat ? 73 : 77} 54 ${c.hat ? 71 : 75} Q52 ${c.hat ? 70 : 74} 50 ${c.hat ? 65 : 69}`} fill={c.skin} stroke="rgba(0,0,0,0.15)" strokeWidth="0.3" />

      {/* Name banner */}
      <rect x="10" y="122" width="80" height="12" rx="3" fill="rgba(0,0,0,0.5)" />
      <text x="50" y="131" textAnchor="middle" fontSize="7" fill={c.trim} fontFamily="Georgia, serif" fontWeight="bold">
        {c.detail}
      </text>

      {/* Gold border */}
      <rect x="2" y="2" width="96" height="136" fill="none" stroke={c.trim} strokeWidth="1.2" rx="3" />
      <rect x="4" y="4" width="92" height="132" fill="none" stroke={c.trim} strokeWidth="0.4" rx="2" opacity="0.5" />
    </svg>
  );
}

// ─── Fool Card Art ────────────────────────────────────────────────────────────
export function FoolArt({ index }: { index: number }) {
  const configs = [
    { // Dobby – big ears, tennis-ball eyes, pillowcase
      bg1: "#2C3E50", bg2: "#1a252f",
      skin: "#95A5A6", outfit: "#ECF0F1",
      trim: "#BDC3C7", eyes: "#3D9970",
      detail: "Freier Elf", hat: false, ghost: false,
    },
    { // Peeves – translucent, mischievous grin, jester hat
      bg1: "#6C3483", bg2: "#1a0d20",
      skin: "#D2B4DE", outfit: "#8E44AD",
      trim: "#E8DAEF", eyes: "#FF6B6B",
      detail: "Poltergeist", hat: true, ghost: true,
    },
    { // Neville – round face, warm colors, plant
      bg1: "#1E8449", bg2: "#0a2e17",
      skin: "#F5CBA7", outfit: "#2ECC71",
      trim: "#A9DFBF", eyes: "#5D6D7E",
      detail: "Tollpatsch", hat: false, ghost: false,
    },
    { // Luna – dreamy, radish earrings, spectrespecs
      bg1: "#5D6D7E", bg2: "#1a2029",
      skin: "#FBEEE6", outfit: "#85C1E9",
      trim: "#D6EAF8", eyes: "#A9CCE3",
      detail: "Traumtänzerin", hat: false, ghost: false,
    },
  ];

  const c = configs[index % 4];

  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id={`fbg${index}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={c.bg1} />
          <stop offset="100%" stopColor={c.bg2} />
        </radialGradient>
      </defs>
      <rect width="100" height="140" fill={`url(#fbg${index})`} />

      {/* Ghost effect for Peeves */}
      {c.ghost && <ellipse cx="50" cy="70" rx="40" ry="50" fill={c.skin} opacity="0.08" />}

      {/* Jester hat for Peeves */}
      {c.hat && (
        <>
          <polygon points="35,45 42,15 50,45" fill="#8E44AD" />
          <polygon points="50,45 58,15 65,45" fill="#E74C3C" />
          <circle cx="42" cy="15" r="4" fill="#F1C40F" />
          <circle cx="58" cy="15" r="4" fill="#F1C40F" />
          <rect x="28" y="43" width="44" height="7" rx="3" fill="#6C3483" />
        </>
      )}

      {/* Dobby ears */}
      {index === 0 && (
        <>
          <ellipse cx="28" cy="68" rx="10" ry="16" fill={c.skin} />
          <ellipse cx="72" cy="68" rx="10" ry="16" fill={c.skin} />
          <ellipse cx="28" cy="68" rx="6" ry="11" fill="#7FB3D3" opacity="0.3" />
          <ellipse cx="72" cy="68" rx="6" ry="11" fill="#7FB3D3" opacity="0.3" />
        </>
      )}

      {/* Body */}
      <ellipse cx="50" cy="118" rx="28" ry="28" fill={c.outfit} opacity={c.ghost ? 0.5 : 1} />

      {/* Pillowcase for Dobby */}
      {index === 0 && (
        <rect x="30" y="85" width="40" height="45" rx="5" fill="#ECF0F1" opacity="0.9" />
      )}

      {/* Plant for Neville */}
      {index === 2 && (
        <>
          <line x1="25" y1="105" x2="25" y2="85" stroke="#27AE60" strokeWidth="2" />
          <ellipse cx="20" cy="82" rx="8" ry="5" fill="#27AE60" transform="rotate(-20 20 82)" />
          <ellipse cx="30" cy="78" rx="8" ry="5" fill="#2ECC71" transform="rotate(15 30 78)" />
        </>
      )}

      {/* Luna radish earrings */}
      {index === 3 && (
        <>
          <line x1="30" y1="72" x2="30" y2="82" stroke="#BDC3C7" strokeWidth="0.8" />
          <ellipse cx="30" cy="85" rx="4" ry="6" fill="#E74C3C" />
          <line x1="70" y1="72" x2="70" y2="82" stroke="#BDC3C7" strokeWidth="0.8" />
          <ellipse cx="70" cy="85" rx="4" ry="6" fill="#E74C3C" />
        </>
      )}

      {/* Neck */}
      <rect x="44" y="72" width="12" height="14" rx="3" fill={c.skin} opacity={c.ghost ? 0.7 : 1} />

      {/* Head – bigger for Dobby */}
      <ellipse cx="50" cy={index === 0 ? 60 : 63} rx={index === 0 ? 22 : 18} ry={index === 0 ? 22 : 19} fill={c.skin} opacity={c.ghost ? 0.75 : 1} />

      {/* Hair */}
      {index === 0 // Dobby – no hair, just big head
        ? null
        : index === 1 // Peeves – wild spiky
        ? [[-10,0],[0,-12],[10,0],[18,8],[-18,8]].map(([dx,dy],i) => (
            <ellipse key={i} cx={50+(dx as number)} cy={44+(dy as number)} rx="6" ry="4" fill={c.outfit} opacity="0.8" transform={`rotate(${(dx as number)*3} ${50+(dx as number)} ${44+(dy as number)})`} />
          ))
        : index === 3 // Luna – long straight
        ? <>
            <ellipse cx="50" cy="46" rx="18" ry="8" fill="#F7DC6F" />
            <rect x="28" y="46" width="6" height="30" rx="3" fill="#F7DC6F" />
            <rect x="66" y="46" width="6" height="30" rx="3" fill="#F7DC6F" />
          </>
        : // Neville – short neat
          <ellipse cx="50" cy="46" rx="17" ry="8" fill="#6D4C41" />
      }

      {/* Eyes – big for Dobby */}
      {index === 0
        ? <>
            <ellipse cx="43" cy="62" rx="7" ry="8" fill="#1ABC9C" />
            <ellipse cx="57" cy="62" rx="7" ry="8" fill="#1ABC9C" />
            <ellipse cx="43" cy="62" rx="4" ry="5" fill="#0E6655" />
            <ellipse cx="57" cy="62" rx="4" ry="5" fill="#0E6655" />
            <circle cx="41" cy="60" r="1.5" fill="white" />
            <circle cx="55" cy="60" r="1.5" fill="white" />
          </>
        : <>
            <ellipse cx="43" cy="65" rx="3.5" ry="4" fill="white" />
            <ellipse cx="57" cy="65" rx="3.5" ry="4" fill="white" />
            <ellipse cx="43.5" cy="65.5" rx="2" ry="2.5" fill={c.eyes} />
            <ellipse cx="57.5" cy="65.5" rx="2" ry="2.5" fill={c.eyes} />
            <circle cx="43" cy="64.5" r="0.8" fill="white" />
            <circle cx="57" cy="64.5" r="0.8" fill="white" />
          </>
      }

      {/* Spectrespecs for Luna */}
      {index === 3 && (
        <>
          <rect x="35" y="62" width="12" height="8" rx="4" fill="#FF6B6B" opacity="0.5" />
          <rect x="53" y="62" width="12" height="8" rx="4" fill="#85C1E9" opacity="0.5" />
          <line x1="47" y1="66" x2="53" y2="66" stroke="#BDC3C7" strokeWidth="1" />
        </>
      )}

      {/* Big grin for Peeves */}
      {index === 1
        ? <path d="M40 74 Q50 82 60 74 Q55 78 50 79 Q45 78 40 74" fill="#1a0d20" />
        : index === 0
        ? <path d="M42 70 Q50 76 58 70" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1.2" />
        : <path d="M44 73 Q50 77 56 73" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
      }

      {/* Name banner */}
      <rect x="10" y="122" width="80" height="12" rx="3" fill="rgba(0,0,0,0.5)" />
      <text x="50" y="131" textAnchor="middle" fontSize="7" fill={c.trim} fontFamily="Georgia, serif" fontWeight="bold">
        {c.detail}
      </text>

      {/* Border */}
      <rect x="2" y="2" width="96" height="136" fill="none" stroke={c.trim} strokeWidth="1.2" rx="3" />
    </svg>
  );
}

// ─── Dragon (Seidenschnabel / Hippogriff) ─────────────────────────────────────
export function DragonArt() {
  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="dragbg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#1a3a5c" />
          <stop offset="100%" stopColor="#050d1a" />
        </radialGradient>
      </defs>
      <rect width="100" height="140" fill="url(#dragbg)" />
      {/* Stars */}
      {[10,25,80,90,15,85,50].map((x,i) => <circle key={i} cx={x} cy={5+i*6} r="0.7" fill="#A8C0E8" opacity="0.6" />)}
      {/* Body */}
      <ellipse cx="50" cy="85" rx="28" ry="35" fill="#8B7355" />
      <ellipse cx="50" cy="80" rx="22" ry="28" fill="#A0896B" />
      {/* Wings */}
      <path d="M28 70 Q5 45 15 30 Q30 55 35 65" fill="#6B5B45" opacity="0.9" />
      <path d="M72 70 Q95 45 85 30 Q70 55 65 65" fill="#6B5B45" opacity="0.9" />
      <path d="M28 70 Q8 50 18 35" fill="none" stroke="#8B7355" strokeWidth="1" />
      <path d="M72 70 Q92 50 82 35" fill="none" stroke="#8B7355" strokeWidth="1" />
      {/* Neck */}
      <ellipse cx="50" cy="55" rx="14" ry="18" fill="#8B7355" />
      {/* Head */}
      <ellipse cx="50" cy="38" rx="20" ry="16" fill="#A0896B" />
      {/* Beak */}
      <path d="M38 42 Q35 48 40 50 Q50 45 60 50 Q65 48 62 42" fill="#D4AF37" />
      {/* Eyes */}
      <ellipse cx="42" cy="34" rx="5" ry="5" fill="#FF6B35" />
      <ellipse cx="58" cy="34" rx="5" ry="5" fill="#FF6B35" />
      <ellipse cx="42" cy="34" rx="2.5" ry="3" fill="#1a0800" />
      <ellipse cx="58" cy="34" rx="2.5" ry="3" fill="#1a0800" />
      <circle cx="41" cy="33" r="1" fill="white" />
      <circle cx="57" cy="33" r="1" fill="white" />
      {/* Feathers on head */}
      {[-8,-4,0,4,8].map((dx,i) => <ellipse key={i} cx={50+dx} cy={22+Math.abs(dx)*0.3} rx="2.5" ry="6" fill="#6B5B45" transform={`rotate(${dx*3} ${50+dx} 22)`} />)}
      {/* Claws */}
      <path d="M30 112 L25 125 M28 115 L22 126 M34 114 L30 127" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M70 112 L75 125 M72 115 L78 126 M66 114 L70 127" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
      {/* Name */}
      <rect x="8" y="124" width="84" height="11" rx="3" fill="rgba(0,0,0,0.6)" />
      <text x="50" y="132" textAnchor="middle" fontSize="7" fill="#A8C0E8" fontFamily="Georgia,serif" fontWeight="bold">Seidenschnabel</text>
      <rect x="2" y="2" width="96" height="136" fill="none" stroke="#A8C0E8" strokeWidth="1" rx="3" />
    </svg>
  );
}

// ─── Fairy ────────────────────────────────────────────────────────────────────
export function FairyArt() {
  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="fairybg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#1a0a2e" />
          <stop offset="100%" stopColor="#050208" />
        </radialGradient>
        <radialGradient id="fairyglow" cx="50%" cy="45%" r="35%">
          <stop offset="0%" stopColor="#E8DAEF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="100" height="140" fill="url(#fairybg)" />
      <ellipse cx="50" cy="65" rx="40" ry="50" fill="url(#fairyglow)" />
      {/* Sparkles */}
      {[[15,20],[80,15],[90,50],[10,70],[85,80],[20,100],[75,105]].map(([x,y],i) => (
        <g key={i}>
          <line x1={x} y1={y-4} x2={x} y2={y+4} stroke="#E8DAEF" strokeWidth="0.8" opacity="0.6" />
          <line x1={x-4} y1={y} x2={x+4} y2={y} stroke="#E8DAEF" strokeWidth="0.8" opacity="0.6" />
          <circle cx={x} cy={y} r="1" fill="#E8DAEF" opacity="0.8" />
        </g>
      ))}
      {/* Wings */}
      <ellipse cx="28" cy="65" rx="20" ry="28" fill="#D2B4DE" opacity="0.3" transform="rotate(-20 28 65)" />
      <ellipse cx="72" cy="65" rx="20" ry="28" fill="#D2B4DE" opacity="0.3" transform="rotate(20 72 65)" />
      <ellipse cx="25" cy="70" rx="12" ry="18" fill="#E8DAEF" opacity="0.2" transform="rotate(-20 25 70)" />
      <ellipse cx="75" cy="70" rx="12" ry="18" fill="#E8DAEF" opacity="0.2" transform="rotate(20 75 70)" />
      {/* Wing veins */}
      <path d="M35 60 Q20 45 28 30" fill="none" stroke="#D2B4DE" strokeWidth="0.5" opacity="0.5" />
      <path d="M65 60 Q80 45 72 30" fill="none" stroke="#D2B4DE" strokeWidth="0.5" opacity="0.5" />
      {/* Body */}
      <ellipse cx="50" cy="100" rx="10" ry="20" fill="#8E44AD" opacity="0.8" />
      {/* Dress */}
      <path d="M38 95 Q50 85 62 95 Q65 115 50 120 Q35 115 38 95" fill="#9B59B6" opacity="0.9" />
      {/* Arms */}
      <line x1="50" y1="90" x2="30" y2="100" stroke="#FBEEE6" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="90" x2="70" y2="100" stroke="#FBEEE6" strokeWidth="3" strokeLinecap="round" />
      {/* Head */}
      <ellipse cx="50" cy="72" rx="14" ry="15" fill="#FBEEE6" />
      {/* Hair */}
      <ellipse cx="50" cy="59" rx="14" ry="7" fill="#F7DC6F" />
      <ellipse cx="36" cy="68" rx="4" ry="10" fill="#F7DC6F" />
      <ellipse cx="64" cy="68" rx="4" ry="10" fill="#F7DC6F" />
      {/* Eyes */}
      <ellipse cx="44" cy="73" rx="3" ry="3.5" fill="white" />
      <ellipse cx="56" cy="73" rx="3" ry="3.5" fill="white" />
      <ellipse cx="44" cy="73" rx="1.8" ry="2.2" fill="#8E44AD" />
      <ellipse cx="56" cy="73" rx="1.8" ry="2.2" fill="#8E44AD" />
      <circle cx="43.5" cy="72.5" r="0.7" fill="white" />
      <circle cx="55.5" cy="72.5" r="0.7" fill="white" />
      {/* Smile */}
      <path d="M45 79 Q50 83 55 79" fill="none" stroke="#C39BD3" strokeWidth="1" />
      {/* Wand trail */}
      <line x1="70" y1="100" x2="88" y2="78" stroke="#F7DC6F" strokeWidth="1.5" strokeLinecap="round" />
      {[0,1,2,3].map(i => <circle key={i} cx={82+i*2} cy={75-i*3} r={1.5-i*0.2} fill="#F7DC6F" opacity={0.9-i*0.2} />)}
      {/* Name */}
      <rect x="8" y="124" width="84" height="11" rx="3" fill="rgba(0,0,0,0.6)" />
      <text x="50" y="132" textAnchor="middle" fontSize="7" fill="#D2B4DE" fontFamily="Georgia,serif" fontWeight="bold">Die Fee</text>
      <rect x="2" y="2" width="96" height="136" fill="none" stroke="#D2B4DE" strokeWidth="1" rx="3" />
    </svg>
  );
}

// ─── Witch (Bellatrix) ────────────────────────────────────────────────────────
export function WitchArt() {
  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="witchbg" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#2C0A0A" />
          <stop offset="100%" stopColor="#080003" />
        </radialGradient>
      </defs>
      <rect width="100" height="140" fill="url(#witchbg)" />
      {/* Dramatic light rays */}
      {[30,50,70].map((x,i) => <line key={i} x1={x} y1="0" x2={x+10} y2="140" stroke="#8B0000" strokeWidth="0.3" opacity="0.2" />)}
      {/* Black robe */}
      <ellipse cx="50" cy="118" rx="32" ry="30" fill="#0D0D0D" />
      <path d="M18 100 Q50 88 82 100 Q85 130 50 138 Q15 130 18 100" fill="#1a0000" />
      <line x1="50" y1="85" x2="50" y2="138" stroke="#8B0000" strokeWidth="1.5" />
      {/* Arms dramatically outstretched */}
      <line x1="50" y1="95" x2="15" y2="108" stroke="#0D0D0D" strokeWidth="12" strokeLinecap="round" />
      <line x1="50" y1="95" x2="85" y2="108" stroke="#0D0D0D" strokeWidth="12" strokeLinecap="round" />
      <ellipse cx="13" cy="110" rx="5" ry="4" fill="#D5B895" />
      <ellipse cx="87" cy="110" rx="5" ry="4" fill="#D5B895" />
      {/* Wand with dark magic */}
      <line x1="87" y1="110" x2="98" y2="85" stroke="#4A2040" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="98" cy="83" rx="4" ry="4" fill="#8B0000" opacity="0.8" />
      {[0,1,2].map(i => <circle key={i} cx={95+i} cy={80-i*4} r={2-i*0.4} fill="#C0392B" opacity={0.7-i*0.2} />)}
      {/* Neck */}
      <rect x="44" y="70" width="12" height="16" rx="3" fill="#D5B895" />
      {/* Head */}
      <ellipse cx="50" cy="60" rx="18" ry="20" fill="#D5B895" />
      {/* Wild dark hair */}
      <ellipse cx="50" cy="42" rx="20" ry="10" fill="#0D0D0D" />
      {[[-15,5],[-18,12],[-14,20],[-8,25],[8,25],[14,20],[18,12],[15,5]].map(([dx,dy],i) => (
        <path key={i} d={`M${50+dx} ${42+dy} Q${50+dx*1.3} ${30+dy*0.5} ${50+dx*0.8} ${22+dy*0.2}`} fill="none" stroke="#1a0000" strokeWidth="3" strokeLinecap="round" />
      ))}
      <ellipse cx="30" cy="58" rx="6" ry="14" fill="#0D0D0D" />
      <ellipse cx="70" cy="58" rx="6" ry="14" fill="#0D0D0D" />
      {/* Intense eyes */}
      <ellipse cx="43" cy="60" rx="4" ry="4.5" fill="white" />
      <ellipse cx="57" cy="60" rx="4" ry="4.5" fill="white" />
      <ellipse cx="43" cy="60" rx="2.5" ry="3" fill="#8B0000" />
      <ellipse cx="57" cy="60" rx="2.5" ry="3" fill="#8B0000" />
      <circle cx="42" cy="59" r="1" fill="white" />
      <circle cx="56" cy="59" r="1" fill="white" />
      {/* Maniacal grin */}
      <path d="M42 70 Q50 76 58 70 Q54 73 50 74 Q46 73 42 70" fill="#1a0000" />
      {/* Name */}
      <rect x="8" y="124" width="84" height="11" rx="3" fill="rgba(0,0,0,0.7)" />
      <text x="50" y="132" textAnchor="middle" fontSize="7" fill="#C0392B" fontFamily="Georgia,serif" fontWeight="bold">Bellatrix</text>
      <rect x="2" y="2" width="96" height="136" fill="none" stroke="#8B0000" strokeWidth="1" rx="3" />
    </svg>
  );
}

// ─── Werewolf (Lupin) ─────────────────────────────────────────────────────────
export function WerewolfArt({ suit }: { suit?: string } = {}) {
  const suitColors: Record<string, { moon: string; eyes: string; glow: string }> = {
    red:    { moon: "#E74C3C", eyes: "#FF4444", glow: "#E74C3C" },
    blue:   { moon: "#3498DB", eyes: "#66AAFF", glow: "#3498DB" },
    green:  { moon: "#2ECC71", eyes: "#44FF88", glow: "#2ECC71" },
    yellow: { moon: "#F7DC6F", eyes: "#F7DC6F", glow: "#F7DC6F" },
  };
  const sc = suit ? suitColors[suit] : { moon: "#F7DC6F", eyes: "#F7DC6F", glow: "#F7DC6F" };

  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="wolfbg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#1a1200" />
          <stop offset="100%" stopColor="#050400" />
        </radialGradient>
      </defs>
      <rect width="100" height="140" fill="url(#wolfbg)" />
      {/* Moon */}
      <circle cx="80" cy="18" r="14" fill={sc.moon} opacity="0.9" />
      <circle cx="86" cy="13" r="12" fill="#1a1200" />
      {/* Fur body */}
      <ellipse cx="50" cy="112" rx="30" ry="32" fill="#4A3728" />
      {/* Fur texture */}
      {[[35,95],[42,88],[50,85],[58,88],[65,95],[30,105],[70,105]].map(([x,y],i) => (
        <path key={i} d={`M${x} ${y} Q${x+3} ${y-8} ${x+1} ${y-12}`} fill="none" stroke="#3D2B1F" strokeWidth="2" strokeLinecap="round" />
      ))}
      {/* Arms with claws */}
      <line x1="50" y1="92" x2="18" y2="108" stroke="#4A3728" strokeWidth="12" strokeLinecap="round" />
      <line x1="50" y1="92" x2="82" y2="108" stroke="#4A3728" strokeWidth="12" strokeLinecap="round" />
      {/* Claws left */}
      {[-4,-1,2,5].map((dx,i) => <line key={i} x1={16+i} y1="110" x2={14+dx} y2="122" stroke="#C8B89A" strokeWidth="1.2" strokeLinecap="round" />)}
      {/* Claws right */}
      {[-5,-2,1,4].map((dx,i) => <line key={i} x1={80+i} y1="110" x2={78+dx} y2="122" stroke="#C8B89A" strokeWidth="1.2" strokeLinecap="round" />)}
      {/* Neck/chest fur */}
      <ellipse cx="50" cy="78" rx="16" ry="16" fill="#5C4535" />
      {/* Head – half wolf */}
      <ellipse cx="50" cy="58" rx="22" ry="20" fill="#5C4535" />
      {/* Wolf ears */}
      <polygon points="32,44 26,22 42,38" fill="#4A3728" />
      <polygon points="68,44 74,22 58,38" fill="#4A3728" />
      <polygon points="33,43 29,27 40,38" fill="#8B6B5B" opacity="0.5" />
      <polygon points="67,43 71,27 60,38" fill="#8B6B5B" opacity="0.5" />
      {/* Snout */}
      <ellipse cx="50" cy="68" rx="12" ry="8" fill="#4A3728" />
      <ellipse cx="50" cy="64" rx="7" ry="5" fill="#3D2B1F" />
      {/* Nose */}
      <ellipse cx="50" cy="63" rx="4" ry="3" fill="#1a0d00" />
      {/* Eyes – yellow wolf eyes */}
      <ellipse cx="41" cy="55" rx="5" ry="5" fill={sc.eyes} />
      <ellipse cx="59" cy="55" rx="5" ry="5" fill={sc.eyes} />
      <ellipse cx="41" cy="55" rx="2" ry="3.5" fill="#1a0800" />
      <ellipse cx="59" cy="55" rx="2" ry="3.5" fill="#1a0800" />
      <circle cx="40" cy="54" r="1" fill="white" />
      <circle cx="58" cy="54" r="1" fill="white" />
      {/* Fangs */}
      <polygon points="46,70 44,78 48,70" fill="white" />
      <polygon points="54,70 52,78 56,70" fill="white" />
      {/* Torn robes remnant */}
      <path d="M30 95 Q20 110 18 130" fill="none" stroke="#4A3728" strokeWidth="4" opacity="0.5" />
      <path d="M70 95 Q80 110 82 130" fill="none" stroke="#4A3728" strokeWidth="4" opacity="0.5" />
      {/* Suit color overlay when suit chosen */}
      {suit && <rect width="100" height="140" fill={sc.glow} opacity="0.08" />}
      {/* Name */}
      <rect x="8" y="124" width="84" height="11" rx="3" fill="rgba(0,0,0,0.7)" />
      <text x="50" y="132" textAnchor="middle" fontSize="7" fill={sc.glow} fontFamily="Georgia,serif" fontWeight="bold">Prof. Lupin</text>
      <rect x="2" y="2" width="96" height="136" fill="none" stroke={sc.glow} strokeWidth="1" rx="3" />
    </svg>
  );
}

// ─── Vampire (Quirrell) ───────────────────────────────────────────────────────
export function VampireArt() {
  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="vampbg" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#0a0a1a" />
          <stop offset="100%" stopColor="#020208" />
        </radialGradient>
      </defs>
      <rect width="100" height="140" fill="url(#vampbg)" />
      {/* Shadow Voldemort face behind */}
      <ellipse cx="50" cy="55" rx="30" ry="35" fill="#1a0a0a" opacity="0.6" />
      {[[-5,-8],[5,-10],[0,-15],[-8,-5],[8,-5]].map(([dx,dy],i) => (
        <ellipse key={i} cx={50+dx} cy={55+dy} rx="3" ry="1.5" fill="#4A0000" opacity="0.4" transform={`rotate(${dx*5} ${50+dx} ${55+dy})`} />
      ))}
      {/* Two red shadow eyes */}
      <ellipse cx="38" cy="48" rx="5" ry="3" fill="#8B0000" opacity="0.5" />
      <ellipse cx="62" cy="48" rx="5" ry="3" fill="#8B0000" opacity="0.5" />
      {/* Purple turban */}
      <ellipse cx="50" cy="38" rx="22" ry="12" fill="#6C3483" />
      <ellipse cx="50" cy="32" rx="20" ry="10" fill="#7D3C98" />
      <path d="M30 36 Q50 28 70 36" fill="none" stroke="#9B59B6" strokeWidth="1.5" />
      {/* Turban gem */}
      <ellipse cx="50" cy="38" rx="4" ry="3" fill="#E74C3C" />
      <ellipse cx="50" cy="38" rx="2" ry="1.5" fill="#FF6B6B" />
      {/* Nervous face */}
      <ellipse cx="50" cy="58" rx="16" ry="18" fill="#D5D8DC" />
      {/* Sweat drops */}
      <ellipse cx="34" cy="52" rx="1.5" ry="2.5" fill="#AED6F1" opacity="0.7" />
      <ellipse cx="66" cy="54" rx="1.5" ry="2.5" fill="#AED6F1" opacity="0.7" />
      {/* Shifty eyes */}
      <ellipse cx="43" cy="57" rx="4" ry="4" fill="white" />
      <ellipse cx="57" cy="57" rx="4" ry="4" fill="white" />
      <ellipse cx="44" cy="57" rx="2.2" ry="2.5" fill="#5D6D7E" />
      <ellipse cx="58" cy="57" rx="2.2" ry="2.5" fill="#5D6D7E" />
      <circle cx="43.5" cy="56.5" r="0.8" fill="white" />
      <circle cx="57.5" cy="56.5" r="0.8" fill="white" />
      {/* Nervous expression */}
      <path d="M43 67 Q50 65 57 67" fill="none" stroke="#8B6914" strokeWidth="1" />
      {/* Robes */}
      <ellipse cx="50" cy="110" rx="26" ry="32" fill="#4A235A" />
      <line x1="50" y1="76" x2="50" y2="138" stroke="#6C3483" strokeWidth="1.5" />
      <line x1="50" y1="90" x2="22" y2="108" stroke="#4A235A" strokeWidth="10" strokeLinecap="round" />
      <line x1="50" y1="90" x2="78" y2="108" stroke="#4A235A" strokeWidth="10" strokeLinecap="round" />
      <ellipse cx="20" cy="110" rx="5" ry="4" fill="#D5D8DC" />
      <ellipse cx="80" cy="110" rx="5" ry="4" fill="#D5D8DC" />
      {/* Neck */}
      <rect x="44" y="74" width="12" height="14" rx="3" fill="#D5D8DC" />
      {/* Name */}
      <rect x="8" y="124" width="84" height="11" rx="3" fill="rgba(0,0,0,0.7)" />
      <text x="50" y="132" textAnchor="middle" fontSize="7" fill="#9B59B6" fontFamily="Georgia,serif" fontWeight="bold">Prof. Quirrell</text>
      <rect x="2" y="2" width="96" height="136" fill="none" stroke="#9B59B6" strokeWidth="1" rx="3" />
    </svg>
  );
}

// ─── Bomb (Elderstab) ────────────────────────────────────────────────────────
export function BombArt() {
  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="bombbg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#0D0D0D" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <radialGradient id="bombglow" cx="50%" cy="50%" r="40%">
          <stop offset="0%" stopColor="#E8DAEF" stopOpacity="0.15" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <rect width="100" height="140" fill="url(#bombbg)" />
      <ellipse cx="50" cy="70" rx="45" ry="55" fill="url(#bombglow)" />
      {/* Elder Wand – ornate white wand */}
      <line x1="50" y1="20" x2="50" y2="115" stroke="#E8DAEF" strokeWidth="3" strokeLinecap="round" />
      {/* Elder wand markings */}
      {[30,42,54,66,78,90,102].map((y,i) => (
        <ellipse key={i} cx="50" cy={y} rx="4" ry="2.5" fill="#C8B8D8" opacity="0.7" />
      ))}
      {/* Handle */}
      <ellipse cx="50" cy="112" rx="6" ry="5" fill="#D5D8DC" />
      <ellipse cx="50" cy="112" rx="4" ry="3" fill="#BDC3C7" />
      {/* Top orb */}
      <circle cx="50" cy="18" r="8" fill="#E8DAEF" opacity="0.9" />
      <circle cx="50" cy="18" r="5" fill="#D2B4DE" />
      <circle cx="48" cy="16" r="2" fill="white" opacity="0.6" />
      {/* Explosion rings */}
      {[20,30,40].map((r,i) => (
        <circle key={i} cx="50" cy="65" r={r} fill="none" stroke="#E8DAEF" strokeWidth="0.5" opacity={0.3-i*0.08} strokeDasharray="3,3" />
      ))}
      {/* Elder sign */}
      <circle cx="50" cy="65" r="12" fill="none" stroke="#D2B4DE" strokeWidth="1" opacity="0.4" />
      <line x1="50" y1="53" x2="50" y2="77" stroke="#D2B4DE" strokeWidth="1" opacity="0.4" />
      <line x1="38" y1="72" x2="62" y2="72" stroke="#D2B4DE" strokeWidth="1" opacity="0.4" />
      {/* "ANNULLIERT" text */}
      <rect x="12" y="88" width="76" height="10" rx="2" fill="rgba(0,0,0,0.6)" />
      <text x="50" y="96" textAnchor="middle" fontSize="6" fill="#E8DAEF" fontFamily="Georgia,serif" letterSpacing="1">ANNULLIERT</text>
      {/* Name */}
      <rect x="8" y="124" width="84" height="11" rx="3" fill="rgba(0,0,0,0.7)" />
      <text x="50" y="132" textAnchor="middle" fontSize="7" fill="#E8DAEF" fontFamily="Georgia,serif" fontWeight="bold">Der Elderstab</text>
      <rect x="2" y="2" width="96" height="136" fill="none" stroke="#E8DAEF" strokeWidth="1.2" rx="3" />
    </svg>
  );
}

// ─── Rainbow 7½ (George Weasley) ─────────────────────────────────────────────
export function Rainbow7Art() {
  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="geo7bg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#4A1500" />
          <stop offset="100%" stopColor="#150500" />
        </radialGradient>
      </defs>
      <rect width="100" height="140" fill="url(#geo7bg)" />
      {/* Rainbow arc */}
      {["#E74C3C","#E67E22","#F1C40F","#2ECC71","#3498DB","#9B59B6"].map((color,i) => (
        <path key={i} d={`M${10+i*3} 95 Q50 ${35+i*5} ${90-i*3} 95`} fill="none" stroke={color} strokeWidth="3" opacity="0.7" />
      ))}
      {/* Body */}
      <ellipse cx="50" cy="115" rx="26" ry="28" fill="#922B21" />
      <line x1="50" y1="85" x2="50" y2="138" stroke="#E74C3C" strokeWidth="1.5" />
      <line x1="50" y1="92" x2="22" y2="105" stroke="#922B21" strokeWidth="10" strokeLinecap="round" />
      <line x1="50" y1="92" x2="78" y2="105" stroke="#922B21" strokeWidth="10" strokeLinecap="round" />
      <ellipse cx="20" cy="107" rx="5" ry="4" fill="#F5CBA7" />
      <ellipse cx="80" cy="107" rx="5" ry="4" fill="#F5CBA7" />
      {/* Neck */}
      <rect x="44" y="72" width="12" height="14" rx="3" fill="#F5CBA7" />
      {/* Head */}
      <ellipse cx="50" cy="62" rx="18" ry="19" fill="#F5CBA7" />
      {/* Red hair */}
      <ellipse cx="50" cy="45" rx="19" ry="9" fill="#C0392B" />
      <ellipse cx="32" cy="58" rx="5" ry="12" fill="#C0392B" />
      <ellipse cx="68" cy="58" rx="5" ry="12" fill="#C0392B" />
      {/* MISSING EAR – right side has bandage */}
      <ellipse cx="32" cy="64" rx="4" ry="6" fill="#F5CBA7" />
      {/* Left ear – missing, bandage */}
      <rect x="64" y="60" width="8" height="10" rx="2" fill="#ECF0F1" />
      <line x1="64" y1="63" x2="72" y2="63" stroke="#BDC3C7" strokeWidth="1" />
      <line x1="64" y1="66" x2="72" y2="66" stroke="#BDC3C7" strokeWidth="1" />
      <line x1="64" y1="69" x2="72" y2="69" stroke="#BDC3C7" strokeWidth="1" />
      {/* Eyes – mischievous */}
      <ellipse cx="43" cy="62" rx="3.5" ry="3.5" fill="white" />
      <ellipse cx="57" cy="62" rx="3.5" ry="3.5" fill="white" />
      <ellipse cx="43.5" cy="62.5" rx="2" ry="2" fill="#2C3E50" />
      <ellipse cx="57.5" cy="62.5" rx="2" ry="2" fill="#2C3E50" />
      <circle cx="43" cy="62" r="0.7" fill="white" />
      <circle cx="57" cy="62" r="0.7" fill="white" />
      {/* Big grin */}
      <path d="M42 71 Q50 78 58 71 Q54 75 50 76 Q46 75 42 71" fill="#C0392B" />
      {/* Wand with rainbow sparkles */}
      <line x1="80" y1="107" x2="95" y2="88" stroke="#8B6914" strokeWidth="2" strokeLinecap="round" />
      {["#E74C3C","#F1C40F","#2ECC71","#3498DB"].map((c,i) => (
        <circle key={i} cx={90+i} cy={85-i*3} r={1.8-i*0.2} fill={c} opacity={0.9-i*0.15} />
      ))}
      {/* 7½ value */}
      <rect x="8" y="110" width="30" height="12" rx="3" fill="rgba(0,0,0,0.6)" />
      <text x="23" y="119" textAnchor="middle" fontSize="8" fill="#F1C40F" fontFamily="Georgia,serif" fontWeight="bold">7½</text>
      {/* Name */}
      <rect x="8" y="124" width="84" height="11" rx="3" fill="rgba(0,0,0,0.6)" />
      <text x="50" y="132" textAnchor="middle" fontSize="7" fill="#E74C3C" fontFamily="Georgia,serif" fontWeight="bold">George Weasley</text>
      <rect x="2" y="2" width="96" height="136" fill="none" stroke="#F1C40F" strokeWidth="1" rx="3" />
    </svg>
  );
}

// ─── Rainbow 9¾ (Platform Sign) ───────────────────────────────────────────────
export function Rainbow9Art() {
  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="rail9bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a3a" />
          <stop offset="100%" stopColor="#05050f" />
        </linearGradient>
      </defs>
      <rect width="100" height="140" fill="url(#rail9bg)" />
      {/* Rainbow arc */}
      {["#E74C3C","#E67E22","#F1C40F","#2ECC71","#3498DB","#9B59B6"].map((color,i) => (
        <path key={i} d={`M${8+i*2} 75 Q50 ${20+i*4} ${92-i*2} 75`} fill="none" stroke={color} strokeWidth="2.5" opacity="0.6" />
      ))}
      {/* Platform wall brick texture */}
      {[85,95,105,115,125,135].map((y,ri) => (
        [0,1,2,3,4].map((ci) => (
          <rect key={`${ri}-${ci}`} x={ci*22+(ri%2)*11} y={y} width="20" height="8" rx="1" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        ))
      ))}
      {/* Platform sign post */}
      <rect x="48" y="72" width="4" height="55" fill="#8B8B8B" />
      <rect x="43" y="130" width="14" height="4" rx="2" fill="#6B6B6B" />
      {/* Sign board */}
      <rect x="12" y="45" width="76" height="32" rx="4" fill="#1a1a6e" />
      <rect x="14" y="47" width="72" height="28" rx="3" fill="#2233aa" />
      <rect x="14" y="47" width="72" height="28" rx="3" fill="none" stroke="#F1C40F" strokeWidth="1.5" />
      {/* Sign text */}
      <text x="50" y="58" textAnchor="middle" fontSize="7" fill="#F1C40F" fontFamily="Georgia,serif" fontWeight="bold" letterSpacing="0.5">GLEIS</text>
      <text x="50" y="70" textAnchor="middle" fontSize="13" fill="#F1C40F" fontFamily="Georgia,serif" fontWeight="bold">9¾</text>
      {/* Trolley disappearing into wall */}
      <rect x="25" y="90" width="20" height="28" rx="2" fill="#C8B89A" opacity="0.6" />
      <rect x="27" y="93" width="7" height="10" rx="1" fill="#AED6F1" opacity="0.5" />
      <rect x="36" y="93" width="7" height="10" rx="1" fill="#AED6F1" opacity="0.5" />
      <circle cx="30" cy="119" r="3" fill="#6B6B6B" opacity="0.6" />
      <circle cx="41" cy="119" r="3" fill="#6B6B6B" opacity="0.6" />
      {/* Steam */}
      {[0,1,2].map(i => <ellipse key={i} cx={55+i*8} cy={88-i*5} rx={3+i} ry={2+i} fill="white" opacity={0.15-i*0.04} />)}
      {/* 9¾ value badge */}
      <rect x="62" y="108" width="30" height="12" rx="3" fill="rgba(0,0,0,0.6)" />
      <text x="77" y="117" textAnchor="middle" fontSize="8" fill="#F1C40F" fontFamily="Georgia,serif" fontWeight="bold">9¾</text>
      {/* Name */}
      <rect x="8" y="124" width="84" height="11" rx="3" fill="rgba(0,0,0,0.6)" />
      <text x="50" y="132" textAnchor="middle" fontSize="7" fill="#AED6F1" fontFamily="Georgia,serif" fontWeight="bold">Gleis 9¾</text>
      <rect x="2" y="2" width="96" height="136" fill="none" stroke="#F1C40F" strokeWidth="1" rx="3" />
    </svg>
  );
}

// ─── Wizard-Fool (Ron Weasley) ────────────────────────────────────────────────
export function WizardFoolArt() {
  return (
    <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="ronbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2C0D5E" />
          <stop offset="50%" stopColor="#1a0d2e" />
          <stop offset="100%" stopColor="#1A5C35" />
        </linearGradient>
      </defs>
      <rect width="100" height="140" fill="url(#ronbg)" />
      {/* Split card effect – half wizard / half fool */}
      <line x1="50" y1="0" x2="50" y2="140" stroke="rgba(201,168,76,0.3)" strokeWidth="0.8" strokeDasharray="4,2" />
      {/* Z on left */}
      <text x="25" y="30" textAnchor="middle" fontSize="18" fill="#C9A84C" fontFamily="Cinzel,serif" fontWeight="bold" opacity="0.4">Z</text>
      {/* N on right */}
      <text x="75" y="30" textAnchor="middle" fontSize="18" fill="#2ECC71" fontFamily="Cinzel,serif" fontWeight="bold" opacity="0.4">N</text>
      {/* Body – Gryffindor robes */}
      <ellipse cx="50" cy="115" rx="27" ry="28" fill="#740001" />
      <line x1="50" y1="84" x2="50" y2="138" stroke="#D3A625" strokeWidth="1.5" />
      <line x1="50" y1="92" x2="22" y2="106" stroke="#740001" strokeWidth="10" strokeLinecap="round" />
      <line x1="50" y1="92" x2="78" y2="106" stroke="#740001" strokeWidth="10" strokeLinecap="round" />
      <ellipse cx="20" cy="108" rx="5" ry="4" fill="#F5CBA7" />
      <ellipse cx="80" cy="108" rx="5" ry="4" fill="#F5CBA7" />
      {/* Wand held hesitantly */}
      <line x1="80" y1="108" x2="92" y2="88" stroke="#8B6914" strokeWidth="2" strokeLinecap="round" />
      {/* Question marks around wand tip */}
      <text x="90" y="85" fontSize="8" fill="#C9A84C" opacity="0.7">?</text>
      {/* Neck */}
      <rect x="44" y="72" width="12" height="14" rx="3" fill="#F5CBA7" />
      {/* Head */}
      <ellipse cx="50" cy="61" rx="18" ry="19" fill="#F5CBA7" />
      {/* Red hair */}
      <ellipse cx="50" cy="44" rx="19" ry="9" fill="#C0392B" />
      <ellipse cx="32" cy="57" rx="5" ry="11" fill="#C0392B" />
      <ellipse cx="68" cy="57" rx="5" ry="11" fill="#C0392B" />
      {/* Ears */}
      <ellipse cx="32" cy="63" rx="4" ry="6" fill="#F5CBA7" />
      <ellipse cx="68" cy="63" rx="4" ry="6" fill="#F5CBA7" />
      {/* Eyes – confused expression */}
      <ellipse cx="43" cy="61" rx="3.5" ry="3.5" fill="white" />
      <ellipse cx="57" cy="61" rx="3.5" ry="3.5" fill="white" />
      {/* One eye looking left, other right */}
      <ellipse cx="42" cy="61" rx="2" ry="2" fill="#2C3E50" />
      <ellipse cx="58" cy="61" rx="2" ry="2" fill="#2C3E50" />
      <circle cx="41.5" cy="60.5" r="0.7" fill="white" />
      <circle cx="58.5" cy="60.5" r="0.7" fill="white" />
      {/* Raised eyebrow */}
      <path d="M39 56 Q43 54 47 56" fill="none" stroke="#C0392B" strokeWidth="1" />
      <path d="M53 57 Q57 55 61 57" fill="none" stroke="#C0392B" strokeWidth="1" />
      {/* Uncertain mouth */}
      <path d="M44 70 Q47 68 50 70 Q53 72 56 70" fill="none" stroke="#8B6914" strokeWidth="1" />
      {/* Freckles */}
      {[[40,66],[44,67],[56,67],[60,66],[42,64],[58,64]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="0.8" fill="#C0392B" opacity="0.5" />
      ))}
      {/* Name */}
      <rect x="8" y="124" width="84" height="11" rx="3" fill="rgba(0,0,0,0.6)" />
      <text x="50" y="132" textAnchor="middle" fontSize="7" fill="#D3A625" fontFamily="Georgia,serif" fontWeight="bold">Ron Weasley</text>
      <rect x="2" y="2" width="96" height="136" fill="none" stroke="#D3A625" strokeWidth="1" rx="3" />
    </svg>
  );
}
