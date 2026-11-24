// Bronz selyemszalagok (B arculat, Márk döntése 2026-11-24) — a selymes háttérvideó stílusában, kódból rajzolva.
// Hullámzó, csavarodó szalagok (a szélességük a hullám mentén változik, ettől „fordul" a selyem), bronz átmenettel,
// nagyon lassú sodródással. A korábbi vonalas városképet (CityLines) váltja.
//
// Csak díszítés: aria-hidden, nem kattintható, abszolút pozícióban (a szülő legyen `relative overflow-hidden`),
// így nincs layout shift. A pályák rögzítettek (nem véletlenek) → szerveren és kliensen azonos, nincs hidratálási hiba.
// „Mozgás csökkentése" beállításnál a sodródás áll (globals.css: .b-silk).

type Tone = "light" | "accent" | "dark";

type Ribbon = { cy: number; amp: number; freq: number; phase: number; width: number; twist: number };

const RIBBONS: Ribbon[] = [
  { cy: 170, amp: 46, freq: 1.3, phase: 0.2, width: 34, twist: 2.1 },
  { cy: 205, amp: 34, freq: 1.7, phase: 1.6, width: 22, twist: 2.8 },
  { cy: 140, amp: 58, freq: 0.9, phase: 2.9, width: 16, twist: 1.6 },
];

const W = 1200;
const H = 300;

/** Egy szalag kitöltött sávja: a középvonal szinuszos hullám, a szélesség |cos|-szal csavarodik. */
function ribbonPath(r: Ribbon): string {
  const steps = 64;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -60 + t * (W + 120);
    const y = r.cy + r.amp * Math.sin(t * Math.PI * 2 * r.freq + r.phase);
    const half = (r.width * Math.abs(Math.cos(t * Math.PI * r.twist + r.phase)) + 1.2) / 2;
    top.push(`${x.toFixed(1)} ${(y - half).toFixed(1)}`);
    bottom.push(`${x.toFixed(1)} ${(y + half).toFixed(1)}`);
  }
  return `M${top.join(" L")} L${bottom.reverse().join(" L")} Z`;
}

/** A szalag felső éle — vékony fényvonal (a selyem csillanása). */
function edgePath(r: Ribbon): string {
  const steps = 64;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -60 + t * (W + 120);
    const y = r.cy + r.amp * Math.sin(t * Math.PI * 2 * r.freq + r.phase);
    const half = (r.width * Math.abs(Math.cos(t * Math.PI * r.twist + r.phase)) + 1.2) / 2;
    pts.push(`${x.toFixed(1)} ${(y - half).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

const PATHS = RIBBONS.map((r) => ({ fill: ribbonPath(r), edge: edgePath(r) }));

const PALETTE: Record<Tone, { stops: string[]; fill: number; edge: string; edgeOp: number }> = {
  // Világos háttéren: mély bronz → korall → arany csillanás, visszafogottan.
  light: { stops: ["#6b4430", "#c8401f", "#e0a878", "#6b4430"], fill: 0.13, edge: "#b3381a", edgeOp: 0.28 },
  // Korall sávon: krémfehér selyem.
  accent: { stops: ["#ffffff", "#ffe2d6", "#ffffff", "#ffd2c2"], fill: 0.16, edge: "#ffffff", edgeOp: 0.35 },
  // Sötét sávon: izzó bronz.
  dark: { stops: ["#5a3a28", "#ff9a7e", "#e8b48a", "#5a3a28"], fill: 0.22, edge: "#ffb79f", edgeOp: 0.4 },
};

export default function SilkRibbons({ tone = "light", className = "", heightClass = "h-[200px] sm:h-[260px]" }: {
  tone?: Tone; className?: string; heightClass?: string;
}) {
  const p = PALETTE[tone];
  const id = `silk-${tone}`;
  return (
    <svg aria-hidden focusable="false" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-x-0 bottom-0 w-full ${heightClass} ${className}`}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="0">
          {p.stops.map((c, i) => <stop key={i} offset={i / (p.stops.length - 1)} stopColor={c} />)}
        </linearGradient>
        {/* Széleken és felül elhalványul, hogy ne legyen éles vége. */}
        <linearGradient id={`${id}-fx`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.18" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.82" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-m`}><rect width={W} height={H} fill={`url(#${id}-fx)`} /></mask>
      </defs>
      <g mask={`url(#${id}-m)`}>
        {PATHS.map((path, i) => (
          <g key={i} className="b-silk" style={{ animationDelay: `${-i * 6}s`, animationDuration: `${22 + i * 5}s` }}>
            <path d={path.fill} fill={`url(#${id}-g)`} fillOpacity={p.fill} />
            <path d={path.edge} fill="none" stroke={p.edge} strokeOpacity={p.edgeOp} strokeWidth="1" />
          </g>
        ))}
      </g>
    </svg>
  );
}
