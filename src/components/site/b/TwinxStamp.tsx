// TWINX pecsét (márka-elem, Márk kérése 2026-11-24; ötlet: a „TWINX élesben" pecsétes kép). Csak díszítés, fix méret,
// enyhén elforgatva. Nincs benne szám vagy állítás — csak a márka és az irány.
export default function TwinxStamp({ className = "", color = "#ff9a7e" }: { className?: string; color?: string }) {
  return (
    <svg aria-hidden focusable="false" viewBox="0 0 260 120" className={`h-[96px] w-[208px] -rotate-6 ${className}`}>
      <g fill="none" stroke={color} strokeOpacity="0.85">
        <rect x="4" y="4" width="252" height="112" rx="14" strokeWidth="4" />
        <rect x="14" y="14" width="232" height="92" rx="9" strokeWidth="1.5" />
      </g>
      <text x="130" y="72" textAnchor="middle" fill={color} fillOpacity="0.9" textLength="190" lengthAdjust="spacingAndGlyphs"
        style={{ fontFamily: "var(--font-display), 'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 46, letterSpacing: 4 }}>
        TWINX
      </text>
      <text x="130" y="94" textAnchor="middle" fill={color} fillOpacity="0.85" textLength="196" lengthAdjust="spacingAndGlyphs"
        style={{ fontFamily: "var(--font-display), 'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 10, letterSpacing: 1.6 }}>
        EGYEDI MODUL · CÉGRE SZABVA
      </text>
    </svg>
  );
}
