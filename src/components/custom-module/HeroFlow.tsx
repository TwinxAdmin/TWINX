// HERO-ÁBRA: a te adataid → a TWINX egyedi modulod → kész anyagok.
// Tiszta SVG, beépített (SMIL) animációval: az adatcsomagok végigfutnak a vonalakon,
// a középső „motor” lassan forog és dereng. Nincs külső kép, nincs JS.
const IN = [
  { y: 70, label: "Árlista", sub: "Excel" },
  { y: 170, label: "Ügyféladatok", sub: "CRM / táblázat" },
  { y: 270, label: "Arculat", sub: "logó, színek" },
];
const OUT = [
  { y: 70, label: "Árajánlat", sub: "márkázott PDF" },
  { y: 170, label: "Hirdetés", sub: "posztolható kép" },
  { y: 270, label: "Riport", sub: "heti összesítő" },
];

export default function HeroFlow() {
  const cx = 260, cy = 170;
  const pathIn = (y: number) => `M118 ${y} C 180 ${y}, 190 ${cy}, ${cx - 62} ${cy}`;
  const pathOut = (y: number) => `M${cx + 62} ${cy} C 330 ${cy}, 340 ${y}, 402 ${y}`;
  return (
    <svg viewBox="0 0 520 340" className="h-auto w-full" role="img" aria-label="A te adataidból a TWINX egyedi modul kész anyagokat készít">
      <defs>
        <radialGradient id="cm-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ef7a5a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ef7a5a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cm-line" x1="0" x2="1">
          <stop offset="0" stopColor="#a79f94" stopOpacity="0.15" />
          <stop offset="1" stopColor="#ef7a5a" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Vonalak */}
      {IN.map((n, i) => <path key={`pi${i}`} id={`cm-in-${i}`} d={pathIn(n.y)} fill="none" stroke="url(#cm-line)" strokeWidth="1.5" strokeDasharray="4 5" />)}
      {OUT.map((n, i) => <path key={`po${i}`} id={`cm-out-${i}`} d={pathOut(n.y)} fill="none" stroke="#ef7a5a" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="4 5" />)}

      {/* Futó adatcsomagok */}
      {IN.map((_, i) => (
        <circle key={`di${i}`} r="4" fill="#f4efe7">
          <animateMotion dur="2.4s" begin={`${i * 0.7}s`} repeatCount="indefinite"><mpath href={`#cm-in-${i}`} /></animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" dur="2.4s" begin={`${i * 0.7}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {OUT.map((_, i) => (
        <circle key={`do${i}`} r="4.5" fill="#ef7a5a">
          <animateMotion dur="2.4s" begin={`${1.2 + i * 0.7}s`} repeatCount="indefinite"><mpath href={`#cm-out-${i}`} /></animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" dur="2.4s" begin={`${1.2 + i * 0.7}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* Bemenetek */}
      {IN.map((n, i) => (
        <g key={`ni${i}`} transform={`translate(8 ${n.y - 26})`}>
          <rect width="110" height="52" rx="12" fill="rgba(255,255,255,0.05)" stroke="rgba(244,239,231,0.18)" />
          <text x="14" y="23" fill="#f4efe7" fontSize="13" fontWeight="600">{n.label}</text>
          <text x="14" y="40" fill="#a79f94" fontSize="10.5">{n.sub}</text>
        </g>
      ))}

      {/* Középső motor */}
      <circle cx={cx} cy={cy} r="96" fill="url(#cm-glow)">
        <animate attributeName="r" values="86;100;86" dur="3.2s" repeatCount="indefinite" />
      </circle>
      <g transform={`translate(${cx} ${cy})`}>
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="18s" repeatCount="indefinite" />
          {Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x="-4" y="-62" width="8" height="12" rx="2" fill="#ef7a5a" opacity="0.85" transform={`rotate(${i * 30})`} />
          ))}
          <circle r="54" fill="none" stroke="#ef7a5a" strokeWidth="2" strokeOpacity="0.6" />
        </g>
        <circle r="46" fill="#1c1815" stroke="rgba(244,239,231,0.25)" />
        <text y="-6" textAnchor="middle" fill="#f4efe7" fontSize="14" fontWeight="700" letterSpacing="1.5">TWINX</text>
        <text y="12" textAnchor="middle" fill="#ef7a5a" fontSize="10.5" fontWeight="600">egyedi modul</text>
      </g>

      {/* Kimenetek */}
      {OUT.map((n, i) => (
        <g key={`no${i}`} transform={`translate(402 ${n.y - 26})`}>
          <rect width="110" height="52" rx="12" fill="rgba(239,122,90,0.12)" stroke="rgba(239,122,90,0.55)" />
          <text x="14" y="23" fill="#f4efe7" fontSize="13" fontWeight="600">{n.label}</text>
          <text x="14" y="40" fill="#f2b8a5" fontSize="10.5">{n.sub}</text>
          <circle cx="96" cy="14" r="6" fill="#ef7a5a">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="2.4s" begin={`${1.6 + i * 0.7}s`} repeatCount="indefinite" />
          </circle>
          <path d="M93 14 l2 2 l4 -4" stroke="#1c1005" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}
