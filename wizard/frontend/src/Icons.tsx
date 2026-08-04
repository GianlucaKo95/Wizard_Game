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
