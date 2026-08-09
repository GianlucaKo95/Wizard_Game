// Small stroke-based UI icons (chrome only - back/close/settings/etc.).
// Thematic emoji (🧙🐉🧛🐺💥 …) stay as emoji, this is not a replacement
// for those. All icons use currentColor so they inherit each button's
// existing text color automatically.

type IconProps = { size?: number; style?: React.CSSProperties };

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24",
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round", strokeLinejoin: "round",
});

export const IconX = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const IconArrowLeft = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export const IconSettings = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <line x1="4" y1="6" x2="20" y2="6" /><circle cx="14" cy="6" r="2" />
    <line x1="4" y1="12" x2="20" y2="12" /><circle cx="8" cy="12" r="2" />
    <line x1="4" y1="18" x2="20" y2="18" /><circle cx="16" cy="18" r="2" />
  </svg>
);

export const IconUsers = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const IconUserPlus = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="17" y1="11" x2="23" y2="11" />
  </svg>
);

export const IconHome = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h5v-6h4v6h5V10" />
  </svg>
);

export const IconClipboardList = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <line x1="9" y1="10" x2="15" y2="10" />
    <line x1="9" y1="14" x2="15" y2="14" />
    <line x1="9" y1="18" x2="13" y2="18" />
  </svg>
);

export const IconMessageCircle = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

export const IconHistory = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <line x1="8" y1="6" x2="20" y2="6" /><circle cx="4" cy="6" r="1" />
    <line x1="8" y1="12" x2="20" y2="12" /><circle cx="4" cy="12" r="1" />
    <line x1="8" y1="18" x2="20" y2="18" /><circle cx="4" cy="18" r="1" />
  </svg>
);

// ─── Stats icons (Profil) ──────────────────────────────────────────────────
export const IconCards = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="3" y="8" width="12" height="15" rx="2" transform="rotate(-10 9 15.5)" />
    <rect x="8" y="3" width="13" height="17" rx="2" />
  </svg>
);

export const IconTrophy = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M7 5H4a2 2 0 0 0 0 4h1.5" />
    <path d="M17 5h3a2 2 0 0 1 0 4h-1.5" />
    <path d="M12 14v4" />
    <path d="M8 21h8" />
    <path d="M9.5 21c0-2 1-2.5 2.5-3 1.5.5 2.5 1 2.5 3" />
  </svg>
);

export const IconStar = ({ size = 16, style }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style}>
    <polygon points="12 2 15.1 8.6 22 9.6 17 14.6 18.2 21.8 12 18.4 5.8 21.8 7 14.6 2 9.6 8.9 8.6" />
  </svg>
);

export const IconTarget = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPercent = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

export const IconLayers = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <polygon points="12 3 2 8.5 12 14 22 8.5 12 3" />
    <polyline points="2 15.5 12 21 22 15.5" />
    <polyline points="2 12 12 17.5 22 12" />
  </svg>
);

export const IconBarChart = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <line x1="6" y1="20" x2="6" y2="15" />
    <line x1="12" y1="20" x2="12" y2="9" />
    <line x1="18" y1="20" x2="18" y2="4" />
  </svg>
);

export const IconMic = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);

export const IconMicOff = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M9 9v3a3 3 0 0 0 4.6 2.55" />
    <path d="M15 6.5V5a3 3 0 0 0-5.94-.6" />
    <path d="M5 10a7 7 0 0 0 10.5 6.06" />
    <path d="M19 10a7 7 0 0 1-.34 2.16" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);

export const IconBell = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

export const IconBellOff = ({ size = 16, style }: IconProps) => (
  <svg {...base(size)} style={style}>
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M8.7 3.7A6 6 0 0 1 18 8c0 3.5.9 5.8 1.6 7.1" />
    <path d="M6 8c0 7-3 9-3 9h13" />
    <path d="M18 17h3s-.7-.9-1.3-2.5" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
