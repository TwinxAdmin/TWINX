// ModulePoster — kódból rajzolt előnézet a modul-csempékhez.
//
// Miért SVG és nem fotó: nincs jogtiszta, hiteles mintafotónk minden modulhoz,
// és egy kitalált „ilyen lesz" fotó félrevezetne. Ezek stilizált illusztrációk,
// amik EGY pillantás alatt elmondják, mit csinál a modul — a hirdetéskép
// csempéje viszont a VALÓDI, saját motorunkkal generált mintát mutatja.
//
// Minden szín a TWINX tokenekből jön, hogy a paletta egységes maradjon.

type Kind = "enhance" | "flyer" | "valuation" | "video";

const CORAL = "var(--twx-coral)";
const DARK = "var(--twx-dark)";
const LINE = "var(--twx-line)";

export default function ModulePoster({ kind }: { kind: Kind }) {
  return (
    <svg
      viewBox="0 0 320 180"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {kind === "enhance" && <Enhance />}
      {kind === "flyer" && <Flyer />}
      {kind === "valuation" && <Valuation />}
      {kind === "video" && <Video />}
    </svg>
  );
}

/* Előtte / utána: UGYANAZ a szoba-vázlat kétszer, bal oldalt tompa-hideg
   színekkel, jobb oldalt világos-meleggel. Szándékosan NEM átlátszó réteggel
   és nem clipPath-tal: két egymás melletti, teljesen kirajzolt fél sokkal
   kiszámíthatóbb (a színek pontosan azok, amiket megadtunk). */
function Enhance() {
  return (
    <>
      <Half x={0} wall="#6d737a" floor="#4f545a" win="#8b9199" frame="#454a50" sofa="#5b6068" />
      <Half x={162} wall="#fbf6ef" floor="#d8c3a5" win="#eaf3fb" frame="#c9beb0" sofa="#c2a98c" />

      {/* elválasztó fogantyú — ez teszi „előtte / utána" csúszkává */}
      <rect x="158" y="0" width="4" height="180" fill="#fff" />
      <circle cx="160" cy="90" r="14" fill="#fff" />
      <path d="M155 85l-4 5 4 5M165 85l4 5-4 5" stroke={DARK} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/* Egy 158 széles fél-jelenet: fal, padló, ablak, kanapé. */
function Half({ x, wall, floor, win, frame, sofa }: {
  x: number; wall: string; floor: string; win: string; frame: string; sofa: string;
}) {
  return (
    <>
      <rect x={x} y={0} width={158} height={118} fill={wall} />
      <rect x={x} y={118} width={158} height={62} fill={floor} />
      <rect x={x + 16} y={26} width={56} height={52} rx="3" fill={win} stroke={frame} strokeWidth="3" />
      <path d={`M${x + 44} 26v52M${x + 16} 52h56`} stroke={frame} strokeWidth="3" />
      <rect x={x + 88} y={72} width={56} height={30} rx="7" fill={sofa} />
      <rect x={x + 94} y={102} width={8} height={11} fill={frame} />
      <rect x={x + 130} y={102} width={8} height={11} fill={frame} />
      <circle cx={x + 116} cy={40} r="11" fill={sofa} opacity="0.7" />
    </>
  );
}

/* Hirdetéskép: fotó + fejléc-sáv + ár-doboz — a valódi sablonok ritmusa. */
function Flyer() {
  return (
    <>
      <rect width="320" height="180" fill="var(--twx-cream-card)" />
      <rect x="24" y="14" width="272" height="100" rx="6" fill="#cfc4b6" />
      <path d="M24 92l52-34 40 26 34-22 62 40v12H24z" fill="#a99a89" />
      <circle cx="248" cy="40" r="12" fill="#efe3d2" />
      <rect x="24" y="124" width="150" height="12" rx="3" fill={DARK} />
      <rect x="24" y="144" width="104" height="8" rx="3" fill={LINE} />
      <rect x="206" y="120" width="90" height="36" rx="6" fill={CORAL} />
      <rect x="216" y="130" width="46" height="7" rx="3" fill="#fff" opacity="0.9" />
      <rect x="216" y="142" width="64" height="5" rx="2" fill="#fff" opacity="0.6" />
    </>
  );
}

/* Értékbecslés: riportlap kiemelt árral és összehasonlító oszlopokkal. */
function Valuation() {
  return (
    <>
      <rect width="320" height="180" fill="var(--twx-cream-card)" />
      <rect x="40" y="16" width="240" height="148" rx="8" fill="#fff" stroke={LINE} strokeWidth="2" />
      <rect x="60" y="34" width="76" height="7" rx="3" fill={LINE} />
      <rect x="60" y="52" width="128" height="18" rx="4" fill={CORAL} />
      <rect x="60" y="82" width="160" height="6" rx="3" fill={LINE} />
      <rect x="60" y="96" width="132" height="6" rx="3" fill={LINE} />
      <g fill={DARK} opacity="0.75">
        <rect x="60" y="132" width="18" height="18" rx="2" />
        <rect x="86" y="122" width="18" height="28" rx="2" />
        <rect x="112" y="112" width="18" height="38" rx="2" />
        <rect x="138" y="126" width="18" height="24" rx="2" />
      </g>
      <rect x="196" y="112" width="64" height="38" rx="6" fill="var(--twx-coral-soft)" />
      <rect x="206" y="124" width="44" height="6" rx="3" fill={CORAL} />
      <rect x="206" y="136" width="30" height="5" rx="2" fill={CORAL} opacity="0.6" />
    </>
  );
}

/* Videó: filmkocka lejátszó-gombbal és idővonallal. */
function Video() {
  return (
    <>
      <rect width="320" height="180" fill={DARK} />
      <rect x="30" y="22" width="260" height="112" rx="8" fill="#2a2320" />
      <path d="M30 106l58-38 44 30 38-26 120 62v0H30z" fill="#3d332d" />
      <circle cx="160" cy="78" r="24" fill={CORAL} />
      <path d="M154 68l18 10-18 10z" fill="#1c1005" />
      <rect x="30" y="146" width="260" height="6" rx="3" fill="#3d332d" />
      <rect x="30" y="146" width="104" height="6" rx="3" fill={CORAL} />
      <g fill="#3d332d">
        <rect x="30" y="160" width="34" height="10" rx="2" />
        <rect x="70" y="160" width="34" height="10" rx="2" />
        <rect x="110" y="160" width="34" height="10" rx="2" />
      </g>
    </>
  );
}
