// Bolt, the robot buddy (ADR-0008): a simple geometric SVG robot.
// Decorative; his words always travel as real text in a speech bubble
// beside him, never baked into the picture.

export function Bolt({ size = 96 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.1)}
      viewBox="0 0 120 132"
      role="img"
      aria-label="Bolt the robot"
      focusable="false"
    >
      {/* antenna */}
      <line x1="60" y1="8" x2="60" y2="24" stroke="#ffc53d" strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="8" r="6" fill="#ffc53d" />
      {/* ears */}
      <rect x="14" y="44" width="8" height="18" rx="4" fill="#ffc53d" />
      <rect x="98" y="44" width="8" height="18" rx="4" fill="#ffc53d" />
      {/* head */}
      <rect x="22" y="24" width="76" height="56" rx="16" fill="#dbe9f2" />
      <rect x="30" y="34" width="60" height="36" rx="10" fill="#0b1e2d" />
      {/* eyes and smile */}
      <circle cx="48" cy="50" r="5" fill="#ffc53d" />
      <circle cx="72" cy="50" r="5" fill="#ffc53d" />
      <path d="M50 62 Q60 68 70 62" fill="none" stroke="#ffc53d" strokeWidth="3.5" strokeLinecap="round" />
      {/* neck and body */}
      <rect x="52" y="80" width="16" height="8" fill="#8fa9bc" />
      <rect x="30" y="88" width="60" height="38" rx="12" fill="#dbe9f2" />
      <circle cx="60" cy="107" r="9" fill="#ffc53d" />
      <path d="M63.5 100 L56.5 108.5 H61 L58.5 114 L66 105.5 H61.5 Z" fill="#0b1e2d" />
      {/* arms */}
      <rect x="16" y="92" width="10" height="26" rx="5" fill="#8fa9bc" />
      <rect x="94" y="92" width="10" height="26" rx="5" fill="#8fa9bc" />
    </svg>
  );
}
