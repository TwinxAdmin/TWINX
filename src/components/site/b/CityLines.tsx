// Hangulati háttérelem (B arculat, Márk kérése 2026-11-24): kódból rajzolt, vonalas „modern város" — finom
// épületkontúrok, ablaksorok, egy-két torony, alatta vízszintes fényvonal. Csak díszítés: aria-hidden, nem
// kattintható, abszolút pozícióban a szülő ALJÁN (a szülő legyen `relative overflow-hidden`), így nincs layout shift.
// tone="dark": izzó korall vonalak a sötét sávokon; tone="light": nagyon halvány vonalak a világos háttéren.

type B = { x: number; w: number; h: number; spire?: number; rows?: number };

// Rögzített (nem véletlen) épületsor — szerveren és kliensen ugyanaz, nincs hidratálási eltérés.
const BUILDINGS: B[] = [
  { x: 0, w: 70, h: 90, rows: 4 }, { x: 78, w: 46, h: 150, rows: 7 }, { x: 132, w: 88, h: 110, rows: 5 },
  { x: 228, w: 54, h: 205, spire: 40, rows: 10 }, { x: 290, w: 70, h: 130, rows: 6 }, { x: 368, w: 40, h: 80 },
  { x: 416, w: 96, h: 170, rows: 8 }, { x: 520, w: 50, h: 120, rows: 5 }, { x: 578, w: 64, h: 230, spire: 55, rows: 11 },
  { x: 650, w: 82, h: 140, rows: 6 }, { x: 740, w: 44, h: 95 }, { x: 792, w: 76, h: 185, rows: 9 },
  { x: 876, w: 58, h: 115, rows: 5 }, { x: 942, w: 90, h: 160, rows: 7 }, { x: 1040, w: 48, h: 210, spire: 35, rows: 10 },
  { x: 1096, w: 104, h: 125, rows: 6 },
];
const H = 260;

export default function CityLines({ tone = "dark", className = "", heightClass = "h-[180px] sm:h-[240px]" }: {
  tone?: "dark" | "light"; className?: string; heightClass?: string;
}) {
  const dark = tone === "dark";
  const stroke = dark ? "#ff9a7e" : "#c8401f";
  const main = dark ? 0.3 : 0.16;
  const faint = dark ? 0.12 : 0.08;
  return (
    <svg aria-hidden focusable="false" viewBox={`0 0 1200 ${H}`} preserveAspectRatio="xMidYMax slice"
      className={`pointer-events-none absolute inset-x-0 bottom-0 w-full ${heightClass} ${className}`}>
      <defs>
        <linearGradient id={`cl-fade-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={`cl-mask-${tone}`}><rect width="1200" height={H} fill={`url(#cl-fade-${tone})`} /></mask>
        {dark && (
          <filter id="cl-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        )}
      </defs>
      <g mask={`url(#cl-mask-${tone})`} fill="none" stroke={stroke} strokeWidth="1.2" filter={dark ? "url(#cl-glow)" : undefined}>
        {BUILDINGS.map((b) => {
          const top = H - 8 - b.h;
          return (
            <g key={b.x}>
              <rect x={b.x + 4} y={top} width={b.w - 8} height={b.h} strokeOpacity={main} />
              {b.spire && <path d={`M${b.x + b.w / 2} ${top - b.spire} L${b.x + b.w / 2} ${top}`} strokeOpacity={main} />}
              {Array.from({ length: b.rows ?? 0 }, (_, i) => (
                <path key={i} d={`M${b.x + 12} ${top + 14 + i * 18} H${b.x + b.w - 12}`} strokeOpacity={faint} strokeDasharray="4 6" />
              ))}
            </g>
          );
        })}
        {/* földvonal + finom fényvonal */}
        <path d={`M0 ${H - 8} H1200`} strokeOpacity={main} />
        <path d={`M0 ${H - 2} H1200`} strokeOpacity={faint} strokeDasharray="2 10" />
      </g>
    </svg>
  );
}
