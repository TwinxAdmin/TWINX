// „MI AZ EGYEDI MODUL?” — ismétlődő animáció (csak két rövid felirattal) a modul fő céljáról:
// sok szétszórt, kézi munkadarab (táblázat, dokumentum, levél) → beáramlik a modulba →
// egy kattintás → egyetlen, kész anyag jön ki. Tiszta SVG (SMIL), JS nélkül; minden elem
// ugyanazon a DUR hosszú idővonalon fut, így végig szinkronban maradnak.
const DUR = "6.5s";
const CORAL = "#ef7a5a";
const INK = "#4a4036";
const LINE = "#d9ccbb";
const CX = 260, CY = 150; // a modul középpontja

type Kind = "sheet" | "doc" | "mail";
const TILES: { x: number; y: number; r: number; kind: Kind }[] = [
  { x: 70, y: 62, r: -8, kind: "sheet" },
  { x: 152, y: 52, r: 6, kind: "doc" },
  { x: 58, y: 150, r: 5, kind: "mail" },
  { x: 145, y: 142, r: -5, kind: "sheet" },
  { x: 76, y: 238, r: 7, kind: "doc" },
  { x: 160, y: 228, r: -6, kind: "mail" },
];

const f = (n: number) => n.toFixed(3);

function Tile({ kind }: { kind: Kind }) {
  return (
    <g>
      <rect x="-27" y="-20" width="54" height="40" rx="6" fill="#fff" stroke={LINE} strokeWidth="1.5" />
      {kind === "sheet" && (
        <g stroke={LINE} strokeWidth="1.2">
          <rect x="-27" y="-20" width="54" height="9" rx="6" fill="#efe6da" stroke="none" />
          <path d="M-27 -2 H27 M-27 9 H27 M-9 -11 V20 M9 -11 V20" />
        </g>
      )}
      {kind === "doc" && (
        <g stroke="#cdbfae" strokeWidth="2.4" strokeLinecap="round">
          <path d="M-18 -10 H14 M-18 -3 H18 M-18 4 H10 M-18 11 H16" />
        </g>
      )}
      {kind === "mail" && <path d="M-27 -19 L0 3 L27 -19" fill="none" stroke="#cdbfae" strokeWidth="1.8" />}
    </g>
  );
}

export default function MainGoalAnimation() {
  return (
    <svg viewBox="0 0 520 340" className="h-auto w-full" role="img"
      aria-label="Előtte egy munkafolyamat órákig tartó kézi munka volt; az egyedi modul ezt percekre gyorsítja">
      <defs>
        <radialGradient id="mg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={CORAL} stopOpacity="0.35" />
          <stop offset="1" stopColor={CORAL} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halvány vezetővonal: modul → kész anyag */}
      <path d={`M${CX + 56} ${CY} H372`} stroke={CORAL} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="4 5" />

      {/* Szétszórt kézi munkadarabok — remegnek, majd beáramlanak a modulba */}
      {TILES.map((t, i) => {
        const s = 0.22 + i * 0.015, e = s + 0.12;
        const kt = `0;${f(s)};${f(e)};1`;
        return (
          <g key={i} transform={`translate(${t.x} ${t.y})`}>
            <g>
              <animateTransform attributeName="transform" type="translate" dur={DUR} repeatCount="indefinite"
                values={`0 0;0 0;${CX - t.x} ${CY - t.y};${CX - t.x} ${CY - t.y}`} keyTimes={kt}
                calcMode="spline" keySplines="0 0 1 1;0.55 0 0.25 1;0 0 1 1" />
              <animateTransform attributeName="transform" type="scale" additive="sum" dur={DUR} repeatCount="indefinite"
                values="1;1;0.25;0.25" keyTimes={kt} />
              <animate attributeName="opacity" dur={DUR} repeatCount="indefinite"
                values="0;1;1;0;0" keyTimes={`0;0.05;${f(e - 0.03)};${f(e)};1`} />
              <g transform={`rotate(${t.r})`}>
                <g>
                  <animateTransform attributeName="transform" type="rotate" values="-3;3;-3" dur={`${(0.5 + i * 0.07).toFixed(2)}s`} repeatCount="indefinite" />
                  <Tile kind={t.kind} />
                </g>
              </g>
            </g>
          </g>
        );
      })}

      {/* Egyetlen kész anyag jön ki a modul mögül, pipával (a modul alatt rajzolva, hogy onnan bújjon elő) */}
      <g>
        <animateTransform attributeName="transform" type="translate" dur={DUR} repeatCount="indefinite"
          values={`${CX + 20} ${CY};${CX + 20} ${CY};432 ${CY};432 ${CY}`} keyTimes="0;0.52;0.6;1"
          calcMode="spline" keySplines="0 0 1 1;0.3 0 0.2 1;0 0 1 1" />
        <animate attributeName="opacity" dur={DUR} repeatCount="indefinite"
          values="0;0;1;1;0;0" keyTimes="0;0.52;0.56;0.92;0.97;1" />
        <rect x="-42" y="-54" width="84" height="108" rx="10" fill="#fff" stroke={CORAL} strokeWidth="1.8" />
        <rect x="-42" y="-54" width="84" height="20" rx="10" fill={CORAL} />
        <rect x="-42" y="-44" width="84" height="10" fill={CORAL} />
        <g stroke="#e3d8ca" strokeWidth="3" strokeLinecap="round">
          <path d="M-28 -18 H24 M-28 -8 H16 M-28 2 H22 M-28 12 H6" />
        </g>
        <circle cx="22" cy="34" r="13" fill={CORAL} />
        <path d="M15.5 34 l4.5 4.5 l8 -8.5" fill="none" stroke="#1c1005" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="20" strokeDashoffset="20">
          <animate attributeName="stroke-dashoffset" dur={DUR} repeatCount="indefinite" values="20;20;0;0" keyTimes="0;0.6;0.66;1" />
        </path>
        {/* Csillanások */}
        {[{ x: -52, y: -50 }, { x: 54, y: -40 }, { x: 50, y: 52 }].map((p, i) => (
          <path key={i} transform={`translate(${p.x} ${p.y})`} d="M0 -7 L1.6 -1.6 L7 0 L1.6 1.6 L0 7 L-1.6 1.6 L-7 0 L-1.6 -1.6 Z" fill={CORAL}>
            <animate attributeName="opacity" dur={DUR} repeatCount="indefinite"
              values="0;0;1;0.3;0.9;0;0" keyTimes={`0;${f(0.6 + i * 0.02)};${f(0.65 + i * 0.02)};0.74;0.82;0.9;1`} />
          </path>
        ))}
      </g>
      {/* A modul: dereng, a fogaskerék forog, a kattintásra „megdobban” */}
      <circle cx={CX} cy={CY} r="70" fill="url(#mg-glow)">
        <animate attributeName="r" dur={DUR} repeatCount="indefinite" values="60;60;84;66;60" keyTimes="0;0.46;0.5;0.6;1" />
      </circle>
      <g transform={`translate(${CX} ${CY})`}>
        <g>
          <animateTransform attributeName="transform" type="scale" dur={DUR} repeatCount="indefinite"
            values="1;1;1.1;1;1" keyTimes="0;0.46;0.49;0.53;1" />
          <rect x="-46" y="-46" width="92" height="92" rx="22" fill="#1c1815" />
          <rect x="-46" y="-46" width="92" height="92" rx="22" fill="none" stroke={CORAL} strokeWidth="2" strokeOpacity="0.8" />
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite" />
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={i} x="-4.5" y="-27" width="9" height="10" rx="2" fill={CORAL} transform={`rotate(${i * 45})`} />
            ))}
            <circle r="19" fill="none" stroke={CORAL} strokeWidth="5" />
          </g>
          <circle r="7" fill="#f4efe7" />
        </g>
      </g>

      {/* Kurzor: odaúszik a modulhoz és rákattint */}
      <g>
        <animateTransform attributeName="transform" type="translate" dur={DUR} repeatCount="indefinite"
          values="335 265;335 265;286 176;286 176" keyTimes="0;0.37;0.45;1"
          calcMode="spline" keySplines="0 0 1 1;0.4 0 0.2 1;0 0 1 1" />
        <animate attributeName="opacity" dur={DUR} repeatCount="indefinite"
          values="0;0;1;1;0;0" keyTimes="0;0.35;0.39;0.52;0.56;1" />
        <g>
          <animateTransform attributeName="transform" type="scale" dur={DUR} repeatCount="indefinite"
            values="1;1;0.78;1;1" keyTimes="0;0.455;0.47;0.49;1" />
          <circle r="12" fill="none" stroke={CORAL} strokeWidth="2">
            <animate attributeName="r" dur={DUR} repeatCount="indefinite" values="2;2;18;18" keyTimes="0;0.46;0.53;1" />
            <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;0;0.9;0;0" keyTimes="0;0.46;0.47;0.53;1" />
          </circle>
          <path d="M0 0 L0 22 L6 16.5 L10.5 26 L14.5 24.2 L10 15 L17.5 15 Z" fill="#fff" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
        </g>
      </g>

      {/* Rövid feliratok: előtte sok idő → az egyedi modul felgyorsítja. Végig, mozdulatlanul olvashatók. */}
      <g fontFamily="inherit">
        <g>
          <text x="24" y="304" fontSize="11" fontWeight="700" letterSpacing="1.6" fill="#8a7f73">ELŐTTE</text>
          <text x="24" y="326" fontSize="16" fontWeight="600" fill={INK}>Órákig tartó kézi munka</text>
        </g>
        <g>
          <text x="496" y="304" textAnchor="end" fontSize="11" fontWeight="700" letterSpacing="1.6" fill={CORAL}>EGYEDI MODULLAL</text>
          <text x="496" y="326" textAnchor="end" fontSize="16" fontWeight="600" fill={INK}>Percek alatt kész</text>
        </g>
      </g>
    </svg>
  );
}
