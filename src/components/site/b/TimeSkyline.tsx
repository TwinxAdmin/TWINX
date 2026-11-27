// Időspórolás-„városkép" a „Mi az egyedi modul?" ábrája mögött (Márk kérése 2026-11-25; 2026-11-27-én a gömbös ábra
// mögé visszahozva). Minta: az ügynökségi plakát izzó, drótvázas épületei. Az épületek helyett az IDŐRE és a MODERN,
// DIGITÁLIS munkára utaló tárgyak állnak sorban a horizonton: homokóra, stopper, óratorony, naptárköteg, monitor kóddal,
// laptop, szerverszekrény, chip áramköri vonalakkal, telefon. Izzó korall körvonalak, mögöttük halvány „üveg"
// szellemalakok, alul vízszerű tükröződés. Finom mozgás: forgó mutatók, pergő homok, villogó LED-ek és kurzor —
// „mozgás csökkentése" beállításnál minden áll. Csak díszítés: aria-hidden, nem kattintható, kód rajzolja (nincs kép).

const C = "#ff9a5a";      // izzó körvonal
const F = "rgba(255,140,80,0.05)"; // halvány kitöltés
const G = "rgba(255,170,120,0.22)"; // szellem-körvonal

function Clock({ cx, cy, r, speed = 1 }: { cx: number; cy: number; r: number; speed?: number }) {
  const o = `${cx}px ${cy}px`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={F} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <line key={i} x1={cx + Math.sin(a) * r * 0.78} y1={cy - Math.cos(a) * r * 0.78} x2={cx + Math.sin(a) * r * 0.9} y2={cy - Math.cos(a) * r * 0.9} strokeWidth={i % 3 === 0 ? 2 : 1} />;
      })}
      <line className="tsk-spin" style={{ transformOrigin: o, animationDuration: `${24 / speed}s` }} x1={cx} y1={cy} x2={cx} y2={cy - r * 0.55} strokeWidth={2.2} />
      <line className="tsk-spin" style={{ transformOrigin: o, animationDuration: `${3 / speed}s` }} x1={cx} y1={cy} x2={cx} y2={cy - r * 0.78} strokeWidth={1.2} />
      <circle cx={cx} cy={cy} r={2.5} fill={C} />
    </g>
  );
}

function Hourglass({ x, base, w, h }: { x: number; base: number; w: number; h: number }) {
  const t = base - h, m = base - h / 2;
  return (
    <g>
      <line x1={x - 6} y1={t} x2={x + w + 6} y2={t} strokeWidth={3} />
      <line x1={x - 6} y1={base} x2={x + w + 6} y2={base} strokeWidth={3} />
      <path d={`M${x} ${t + 4} C${x} ${m - 10} ${x + w / 2 - 6} ${m - 6} ${x + w / 2 - 3} ${m} C${x + w / 2 - 6} ${m + 6} ${x} ${m + 10} ${x} ${base - 4}
        M${x + w} ${t + 4} C${x + w} ${m - 10} ${x + w / 2 + 6} ${m - 6} ${x + w / 2 + 3} ${m} C${x + w / 2 + 6} ${m + 6} ${x + w} ${m + 10} ${x + w} ${base - 4}`} fill={F} />
      {/* homok: felül fogy, alul halom, középen pergő szemek */}
      <path d={`M${x + 8} ${t + h * 0.18} L${x + w - 8} ${t + h * 0.18} L${x + w / 2} ${m - 4} Z`} fill="rgba(255,154,90,0.35)" stroke="none" />
      <path d={`M${x + 6} ${base - 4} Q${x + w / 2} ${base - h * 0.2} ${x + w - 6} ${base - 4} Z`} fill="rgba(255,154,90,0.4)" stroke="none" />
      {[0, 1, 2].map((k) => (
        <circle key={k} className="tsk-sand" style={{ animationDelay: `${k * 0.33}s` }} cx={x + w / 2} cy={m + 2} r={1.6} fill={C} stroke="none" />
      ))}
    </g>
  );
}

export default function TimeSkyline({ className = "" }: { className?: string }) {
  const base = 300;
  const skyline = (
    <g fill="none" stroke={C} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {/* szellem-alakok a háttérben (magas, üvegszerű tömbök, mint a plakát drótvázas tornyai) */}
      <g stroke={G} strokeDasharray="3 6" strokeWidth={1.2}>
        <rect x={110} y={base - 230} width={70} height={230} />
        <rect x={430} y={base - 280} width={56} height={280} />
        <rect x={735} y={base - 250} width={80} height={250} />
        <rect x={1015} y={base - 210} width={60} height={210} />
      </g>

      {/* 1) monitor kóddal */}
      <rect x={20} y={base - 140} width={150} height={95} rx={8} fill={F} />
      <path d={`M85 ${base - 45} L80 ${base - 18} M105 ${base - 45} L110 ${base - 18} M64 ${base - 1} L126 ${base - 1}`} />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={34 + (i % 2) * 14} y1={base - 124 + i * 15} x2={34 + (i % 2) * 14 + [70, 52, 88, 40, 64][i]} y2={base - 124 + i * 15} strokeWidth={2} strokeOpacity={0.75} />
      ))}
      <rect className="tsk-blink" x={110} y={base - 69} width={10} height={4} fill={C} stroke="none" />

      {/* 2) homokóra */}
      <Hourglass x={196} base={base} w={58} h={150} />

      {/* 3) szerverszekrény villogó LED-ekkel */}
      <rect x={282} y={base - 200} width={64} height={200} rx={4} fill={F} />
      {Array.from({ length: 7 }, (_, i) => (
        <g key={i}>
          <line x1={290} y1={base - 186 + i * 27} x2={338} y2={base - 186 + i * 27} strokeOpacity={0.6} />
          <circle className="tsk-led" style={{ animationDelay: `${(i * 0.37) % 2}s` }} cx={331} cy={base - 177 + i * 27} r={2.4} fill={C} stroke="none" />
        </g>
      ))}

      {/* 4) stopper */}
      <rect x={398} y={base - 178} width={18} height={10} rx={2} />
      <line x1={407} y1={base - 168} x2={407} y2={base - 160} />
      <circle cx={407} cy={base - 100} r={60} fill={F} />
      <Clock cx={407} cy={base - 100} r={48} speed={3} />
      <path d={`M380 ${base - 40} L372 ${base} M434 ${base - 40} L442 ${base}`} strokeOpacity={0.6} />

      {/* 5) naptárköteg */}
      <rect x={500} y={base - 104} width={96} height={104} rx={6} fill={F} />
      <rect x={508} y={base - 112} width={96} height={104} rx={6} strokeOpacity={0.45} />
      <line x1={500} y1={base - 82} x2={596} y2={base - 82} />
      {[520, 548, 576].map((cx) => <line key={cx} x1={cx} y1={base - 112} x2={cx} y2={base - 96} strokeWidth={3} />)}
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={510 + (i % 4) * 21} y={base - 72 + Math.floor(i / 4) * 21} width={14} height={13} rx={2}
          fill={i === 6 ? "rgba(255,154,90,0.55)" : "none"} strokeOpacity={0.6} />
      ))}

      {/* 6) óratorony */}
      <path d={`M628 ${base} L628 ${base - 210} L652 ${base - 250} L676 ${base - 210} L676 ${base}`} fill={F} />
      <Clock cx={652} cy={base - 180} r={20} />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={640} y={base - 140 + i * 32} width={24} height={18} rx={2} strokeOpacity={0.5} />)}

      {/* 7) chip áramköri vonalakkal */}
      <rect x={720} y={base - 120} width={80} height={80} rx={8} fill={F} />
      <rect x={740} y={base - 100} width={40} height={40} rx={4} strokeOpacity={0.7} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} strokeOpacity={0.7}>
          <line x1={730 + i * 20} y1={base - 120} x2={730 + i * 20} y2={base - 132} />
          <line x1={730 + i * 20} y1={base - 40} x2={730 + i * 20} y2={base - 28} />
        </g>
      ))}
      <path d={`M800 ${base - 90} H830 V${base - 150} H860 M800 ${base - 70} H846 V${base} M720 ${base - 80} H700 V${base - 160}`} strokeOpacity={0.55} />
      <circle className="tsk-led" cx={860} cy={base - 150} r={3} fill={C} stroke="none" />
      <circle className="tsk-led" style={{ animationDelay: "0.8s" }} cx={700} cy={base - 160} r={3} fill={C} stroke="none" />

      {/* 8) laptop */}
      <rect x={872} y={base - 96} width={128} height={80} rx={6} fill={F} />
      <path d={`M860 ${base - 4} L1012 ${base - 4} L1000 ${base - 16} L872 ${base - 16} Z`} />
      <polyline points={`888,${base - 40} 910,${base - 62} 928,${base - 50} 952,${base - 78} 984,${base - 70}`} strokeWidth={2} />

      {/* 9) kis homokóra + telefon */}
      <Hourglass x={1018} base={base} w={30} h={72} />
      <rect x={1062} y={base - 92} width={34} height={92} rx={6} fill={F} />
      <line x1={1072} y1={base - 84} x2={1086} y2={base - 84} strokeOpacity={0.6} />
      <Clock cx={1079} cy={base - 50} r={10} speed={2} />

      {/* horizont */}
      <line x1={0} y1={base} x2={1100} y2={base} strokeOpacity={0.9} />
    </g>
  );

  return (
    <svg aria-hidden focusable="false" viewBox="0 0 1100 420" preserveAspectRatio="xMidYMax meet"
      className={`pointer-events-none ${className}`}>
      <defs>
        <filter id="tsk-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="tsk-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.25" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="tsk-reflect" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="tsk-mask-top"><rect width="1100" height="300" fill="url(#tsk-fade)" /></mask>
        <mask id="tsk-mask-ref"><rect y="300" width="1100" height="120" fill="url(#tsk-reflect)" /></mask>
      </defs>
      <g filter="url(#tsk-glow)" mask="url(#tsk-mask-top)">{skyline}</g>
      {/* tükröződés a „víz" felszínén */}
      <g mask="url(#tsk-mask-ref)" opacity={0.6}>
        <g transform="translate(0 600) scale(1 -1)">{skyline}</g>
      </g>
      {/* meleg pára a horizonton */}
      <rect x="0" y="292" width="1100" height="16" fill="rgba(255,120,60,0.10)" />
      <style>{`
        .tsk-spin { transform-box: view-box; animation: tsk-rot linear infinite; }
        @keyframes tsk-rot { to { transform: rotate(360deg); } }
        .tsk-sand { animation: tsk-fall 1s linear infinite; }
        @keyframes tsk-fall { from { transform: translateY(0); opacity: 1; } to { transform: translateY(26px); opacity: 0; } }
        .tsk-led { animation: tsk-led 2s ease-in-out infinite; }
        @keyframes tsk-led { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        .tsk-blink { animation: tsk-led 1.1s steps(1) infinite; }
        @media (prefers-reduced-motion: reduce) { .tsk-spin, .tsk-sand, .tsk-led, .tsk-blink { animation: none; } }
      `}</style>
    </svg>
  );
}
