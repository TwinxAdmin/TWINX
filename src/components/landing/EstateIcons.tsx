// /ingatlan — „Három lépés, és kész" blokk dekoratív rétege: lebegő,
// korall vonalas ingatlanos ikonok (ház, kulcs, grafikon, kamera, dokumentum,
// térképjel) — a marketingvideó zárókártyájának stílusában.
//
// Tisztán dekoratív: pointer-events nélkül, aria-hidden, a szekció széleire
// és üres sávjaiba pozicionálva, hogy a tartalmat ne zavarja. Csak lg-től
// látszik (kisebb kijelzőn a tartalomra lógna). Az animáció a globals.css
// `twx-float` keyframe-je; ikononként más ütem/késés a természetes hatásért.

type Spot = {
  icon: "house" | "key" | "chart" | "camera" | "doc" | "pin" | "building" | "sold";
  style: React.CSSProperties;
  size?: number;
  dur?: string;
  delay?: string;
  y?: string;
  opacity?: number;
};

// Sűrű, mozgalmas háttér: több ikon, ismétlődő formákkal, eltérő méretben,
// ütemben és átlátszóságban. A tartalom sávjait (videó, karakter, kártyák)
// kerülik, a köztes és szélső részeket töltik ki.
const SPOTS: Spot[] = [
  // felső sáv
  { icon: "house",    style: { top: "4%",  left: "54%" }, size: 46, dur: "6.5s", delay: "0s",    y: "-14px", opacity: 0.5 },
  { icon: "key",      style: { top: "9%",  left: "66%" }, size: 34, dur: "7.5s", delay: "-2s",   y: "-18px", opacity: 0.4 },
  { icon: "chart",    style: { top: "3%",  left: "88%" }, size: 44, dur: "6s",   delay: "-4s",   y: "-11px", opacity: 0.45 },
  { icon: "building", style: { top: "11%", left: "94%" }, size: 36, dur: "8.5s", delay: "-1.5s", y: "-15px", opacity: 0.38 },
  { icon: "pin",      style: { top: "15%", left: "46%" }, size: 28, dur: "5.5s", delay: "-3s",   y: "-12px", opacity: 0.35 },

  // bal oldal
  { icon: "camera",   style: { top: "34%", left: "2%"  }, size: 42, dur: "7s",   delay: "-1s",   y: "-16px", opacity: 0.42 },
  { icon: "doc",      style: { top: "57%", left: "5%"  }, size: 32, dur: "9s",   delay: "-5s",   y: "-13px", opacity: 0.35 },
  { icon: "house",    style: { top: "72%", left: "1.5%"}, size: 38, dur: "6.2s", delay: "-2.5s", y: "-15px", opacity: 0.4 },
  { icon: "sold",     style: { top: "20%", left: "8%"  }, size: 34, dur: "7.8s", delay: "-6s",   y: "-12px", opacity: 0.32 },

  // középső köz (videó és karakter között)
  { icon: "key",      style: { top: "30%", left: "30%" }, size: 26, dur: "6.8s", delay: "-3.5s", y: "-14px", opacity: 0.3 },
  { icon: "building", style: { top: "66%", left: "27%" }, size: 30, dur: "8s",   delay: "-1s",   y: "-16px", opacity: 0.3 },

  // jobb oldal / kártyák mellett
  { icon: "sold",     style: { top: "40%", left: "96%" }, size: 32, dur: "7.2s", delay: "-4.5s", y: "-14px", opacity: 0.35 },
  { icon: "camera",   style: { top: "62%", left: "93%" }, size: 34, dur: "6.6s", delay: "-2s",   y: "-13px", opacity: 0.34 },
  { icon: "chart",    style: { top: "80%", left: "97%" }, size: 28, dur: "9.5s", delay: "-7s",   y: "-11px", opacity: 0.3 },

  // alsó sáv
  { icon: "doc",      style: { bottom: "5%",  left: "14%" }, size: 40, dur: "8s",   delay: "-3s", y: "-13px", opacity: 0.42 },
  { icon: "pin",      style: { bottom: "6%",  left: "72%" }, size: 44, dur: "6.8s", delay: "-5s", y: "-16px", opacity: 0.45 },
  { icon: "house",    style: { bottom: "12%", left: "88%" }, size: 30, dur: "7.4s", delay: "-0.5s", y: "-12px", opacity: 0.33 },
  { icon: "key",      style: { bottom: "3%",  left: "36%" }, size: 26, dur: "9.2s", delay: "-6.5s", y: "-15px", opacity: 0.28 },
  { icon: "building", style: { bottom: "9%",  left: "58%" }, size: 34, dur: "6.4s", delay: "-4s", y: "-14px", opacity: 0.32 },
];

function Glyph({ icon }: { icon: Spot["icon"] }) {
  // Egységes vonalvastagság, lekerekített végek — a zárókártya vékony
  // vonalas stílusa.
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (icon) {
    case "house":
      return (
        <g {...common}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10.5V20h14v-9.5" />
          <path d="M10 20v-5h4v5" />
        </g>
      );
    case "key":
      return (
        <g {...common}>
          <circle cx="7.5" cy="12" r="3.5" />
          <path d="M11 12h10M18 12v3M15 12v2.5" />
        </g>
      );
    case "chart":
      return (
        <g {...common}>
          <path d="M3 18 9 12l4 4 8-9" />
          <path d="M16 7h5v5" />
          <path d="M3 21h18" />
        </g>
      );
    case "camera":
      return (
        <g {...common}>
          <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
          <circle cx="12" cy="13.7" r="3.4" />
          <path d="M8.5 7.5 10 4.5h4l1.5 3" />
        </g>
      );
    case "doc":
      return (
        <g {...common}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 11h6M9 14.5h6M9 18h3.5" />
        </g>
      );
    case "pin":
      return (
        <g {...common}>
          <path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z" />
          <circle cx="12" cy="10" r="2.4" />
        </g>
      );
    case "building":
      return (
        <g {...common}>
          <path d="M4 21V6.5L12 3v18" />
          <path d="M12 9.5h8V21" />
          <path d="M7 9h2M7 12.5h2M7 16h2M15 13h2M15 16.5h2" />
          <path d="M3 21h18" />
        </g>
      );
    case "sold":
      return (
        <g {...common}>
          <rect x="3" y="4" width="14" height="9.5" rx="1.6" />
          <path d="M10 13.5V21M7 21h6" />
          <path d="M6.5 8.5h7" />
        </g>
      );
  }
}

export default function EstateIcons() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
      {SPOTS.map((s, i) => (
        <span
          key={i}
          className="twx-float absolute"
          style={
            {
              ...s.style,
              color: "var(--twx-coral)",
              opacity: s.opacity ?? 0.5,
              width: s.size ?? 42,
              height: s.size ?? 42,
              "--twx-float-dur": s.dur ?? "6.5s",
              "--twx-float-delay": s.delay ?? "0s",
              "--twx-float-y": s.y ?? "-12px",
              "--twx-float-rot-a": `${i % 2 === 0 ? -2 : 2}deg`,
              "--twx-float-rot-b": `${i % 2 === 0 ? 3 : -3}deg`,
            } as React.CSSProperties
          }
        >
          <svg viewBox="0 0 24 24" width="100%" height="100%">
            <Glyph icon={s.icon} />
          </svg>
        </span>
      ))}
    </div>
  );
}
