// LandingTeamwork — „Dolgozzatok együtt" blokk a landingen (az „Elérhető alkalmazások" alatt):
// a TWINX-en belül elérhető két csapatforma röviden, egy-egy folyamatábrával.
//   • Irodai fiók: a vezető feltölti a közös irodai egyenleget → keretet oszt a kollégáknak → közös mappák
//   • Közös munkatér: egyenrangú társak, mindenki a saját kreditjéből; közös mappa + kredit-átadás egymásnak
// Az ábrák inline SVG-k; a „folyó" szaggatott vonalak finoman mozognak (prefers-reduced-motion esetén állnak).
import Reveal from "@/components/motion/Reveal";
import AuthTrigger from "@/components/AuthTrigger";

const CORAL = "#EF7A5A";
const TEAL = "#2F7F86";
const INK = "#1C1815";
const MUTED = "#6E655C";

export default function LandingTeamwork({ signupSource }: { signupSource: string }) {
  // saját, kicsit sötétebb homok háttér: elválik a fölötte lévő „Elérhető alkalmazások" blokktól,
  // de világos marad az alatta lévő sötét szekcióhoz képest
  return (
    <section id="csapat" className="scroll-mt-6 px-6 py-16 sm:py-20" style={{ background: "#ECE3D6" }}>
      <style>{`
        .twx-flow { stroke-dasharray: 5 6; animation: twxFlow 1.6s linear infinite; }
        @keyframes twxFlow { to { stroke-dashoffset: -22; } }
        @media (prefers-reduced-motion: reduce) { .twx-flow { animation: none; } }
      `}</style>
      <div className="mx-auto w-full max-w-6xl">
        <Reveal>
          <p className="font-display text-sm font-semibold uppercase" style={{ color: CORAL, letterSpacing: "0.2em" }}>Csapatban is</p>
          <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Dolgozzatok együtt a TWINX-ben</h2>
          <p className="mt-3 max-w-2xl text-base" style={{ color: "var(--twx-ink-muted)" }}>
            A TWINX-en belül irodai fiókot vagy közös munkateret is nyithatsz — a munkákat közös mappákban adjátok át egymásnak,
            üzenettel, feladattal, és mindenki ott folytatja, ahol a másik abbahagyta.
          </p>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ---------------- IRODAI FIÓK ---------------- */}
          <Reveal>
            <article className="flex h-full flex-col rounded-2xl p-6" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
              <span className="self-start rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#FBE1D6", color: "#A8411F" }}>⌂ Irodai fiók</span>
              <h3 className="mt-3 font-display text-2xl font-semibold">Egy iroda, egy közös kreditkeret</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
                Az iroda vezetője egyszer tölti fel a közös irodai egyenleget, és kollégánként keretet oszt ki belőle.
                A kollégák a saját keretükből dolgoznak, a vezető pedig látja, ki, melyik alkalmazásban mennyit használt —
                nincs meglepetés a hónap végén.
              </p>
              <div className="mt-5 rounded-xl p-3" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                <OfficeDiagram />
              </div>
              <ul className="mt-4 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                {["Közös irodai egyenleg", "Keret kollégánként", "Költés-kimutatás", "Csatlakozás egy kóddal"].map((p) => (
                  <li key={p} className="flex items-center gap-2"><Check color={CORAL} />{p}</li>
                ))}
              </ul>
            </article>
          </Reveal>

          {/* ---------------- KÖZÖS MUNKATÉR ---------------- */}
          <Reveal delay={0.08}>
            <article className="flex h-full flex-col rounded-2xl p-6" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
              <span className="self-start rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "#DCEFF0", color: "#1F5F65" }}>⚭ Közös munkatér</span>
              <h3 className="mt-3 font-display text-2xl font-semibold">Társak, közös mappák — azonnal</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
                Két-öt kolléga, akik együtt dolgoznak egy-egy ügyön: mindenki a saját kreditjéből, nincs vezető és nincs jóváhagyás.
                Ha valakinek elfogy a kreditje, a társa egy kattintással átadhat neki a sajátjából — a kész anyagok pedig a közös mappában várják a többieket.
              </p>
              <div className="mt-5 rounded-xl p-3" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                <TeamDiagram />
              </div>
              <ul className="mt-4 grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                {["Egyenrangú társak (2–5 fő)", "Saját kredit, átadható", "Közös mappák és üzenetek", "Azonnal létrejön"].map((p) => (
                  <li key={p} className="flex items-center gap-2"><Check color={TEAL} />{p}</li>
                ))}
              </ul>
            </article>
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AuthTrigger mode="register" source={signupSource}
              className="rounded-xl px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
              Regisztrálok, és kipróbálom
            </AuthTrigger>
            <span className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Regisztráció után az <strong style={{ color: "var(--twx-ink)" }}>Irodai fiók</strong> menüben nyitod meg — a saját kreditjeid közben megmaradnak.
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Check({ color }: { color: string }) {
  return (
    <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
      style={{ background: color, color: color === TEAL ? "#fff" : "#1c1005" }}>✓</span>
  );
}

/** Személy-ikon (fej + váll) egy körben. */
function Person({ x, y, fill, stroke, label, sub }: { x: number; y: number; fill: string; stroke: string; label: string; sub?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={20} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <circle cx={x} cy={y - 5} r={6} fill={stroke} />
      <path d={`M${x - 10} ${y + 12} a10 9 0 0 1 20 0`} fill={stroke} />
      <text x={x} y={y + 36} textAnchor="middle" fontSize={11} fontWeight={700} fill={INK}>{label}</text>
      {sub && <text x={x} y={y + 49} textAnchor="middle" fontSize={10} fill={MUTED}>{sub}</text>}
    </g>
  );
}

/** Mappa-ikon felirattal. */
function Folder({ x, y, color, soft, label }: { x: number; y: number; color: string; soft: string; label: string }) {
  return (
    <g>
      <rect x={x - 64} y={y - 18} width={128} height={36} rx={10} fill={soft} stroke={color} strokeWidth={1.5} />
      <path d={`M${x - 50} ${y - 7} h8 l3 3 h12 v12 h-23 z`} fill={color} />
      <text x={x - 20} y={y + 4} fontSize={11} fontWeight={700} fill={INK}>{label}</text>
    </g>
  );
}

/** Irodai fiók: Vezető → Irodai egyenleg → keret a kollégáknak → közös mappa. */
function OfficeDiagram() {
  const soft = "#FBE1D6";
  return (
    <svg viewBox="0 0 360 268" width="100%" role="img" aria-label="Irodai fiók: a vezető feltölti az irodai egyenleget, keretet oszt a kollégáknak, akik közös mappában adják át egymásnak a munkát.">
      {/* vezető */}
      <Person x={60} y={46} fill={soft} stroke={CORAL} label="Vezető" sub="feltölt, kioszt" />
      {/* irodai egyenleg */}
      <line x1={84} y1={46} x2={136} y2={46} stroke={CORAL} strokeWidth={2} className="twx-flow" />
      <g>
        <rect x={140} y={24} width={110} height={44} rx={12} fill={INK} />
        <circle cx={160} cy={46} r={9} fill={CORAL} />
        <text x={160} y={50} textAnchor="middle" fontSize={10} fontWeight={800} fill={INK}>K</text>
        <text x={174} y={42} fontSize={10} fill="#BFB4A8">Irodai egyenleg</text>
        <text x={174} y={57} fontSize={13} fontWeight={800} fill="#fff">200 kredit</text>
      </g>
      {/* keretek */}
      {[70, 180, 290].map((cx, i) => (
        <g key={cx}>
          <path d={`M195 70 C195 92, ${cx} 92, ${cx} 112`} fill="none" stroke={CORAL} strokeWidth={1.8} className="twx-flow" />
          <rect x={cx - 24} y={98} width={48} height={16} rx={8} fill={soft} />
          <text x={cx} y={110} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#A8411F">{["40 keret", "30 keret", "50 keret"][i]}</text>
          <Person x={cx} y={140} fill="#fff" stroke="#8B5E4A" label={["Anna", "Péter", "Bence"][i]} />
        </g>
      ))}
      {/* közös mappa */}
      {[70, 180, 290].map((cx) => (
        <path key={`f${cx}`} d={`M${cx} 182 C${cx} 200, 180 196, 180 214`} fill="none" stroke="#C9B8A8" strokeWidth={1.4} className="twx-flow" />
      ))}
      <Folder x={180} y={228} color={CORAL} soft={soft} label="Közös mappa" />
    </svg>
  );
}

/** Közös munkatér: egyenrangú társak, mindenki saját kreditből; közös mappa + kredit-átadás. */
function TeamDiagram() {
  const soft = "#DCEFF0";
  const mates = [
    { x: 60, name: "Anna", credit: "27 kredit" },
    { x: 180, name: "Péter", credit: "12 kredit" },
    { x: 300, name: "Bence", credit: "40 kredit" },
  ];
  return (
    <svg viewBox="0 -18 360 268" width="100%" role="img" aria-label="Közös munkatér: egyenrangú társak, mindenki a saját kreditjéből dolgozik, közös mappában adják át a munkát, és kreditet adhatnak egymásnak.">
      <defs>
        <marker id="twxArrowTeal" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={TEAL} />
        </marker>
      </defs>
      {/* kredit-átadás Anna → Péter */}
      <path d="M74 34 C96 4, 144 4, 164 32" fill="none" stroke={TEAL} strokeWidth={1.8} markerEnd="url(#twxArrowTeal)" className="twx-flow" />
      <rect x={92} y={-16} width={56} height={16} rx={8} fill={soft} />
      <text x={120} y={-4} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="#1F5F65">+10 kredit</text>

      {mates.map((m) => (
        <g key={m.name}>
          <Person x={m.x} y={52} fill={soft} stroke={TEAL} label={m.name} sub="Társ · saját kredit" />
          {/* saját pénztárca */}
          <rect x={m.x - 36} y={112} width={72} height={20} rx={10} fill="#fff" stroke="#BFDCDF" />
          <circle cx={m.x - 24} cy={122} r={5} fill={TEAL} />
          <text x={m.x - 15} y={126} fontSize={9.5} fontWeight={700} fill={INK}>{m.credit}</text>
          {/* munka a közös mappába */}
          <path d={`M${m.x} 134 C${m.x} 168, 180 162, 180 196`} fill="none" stroke={TEAL} strokeWidth={1.6} className="twx-flow" />
        </g>
      ))}

      <Folder x={180} y={214} color={TEAL} soft={soft} label="Közös mappa" />
      <text x={180} y={246} textAnchor="middle" fontSize={9.5} fill={MUTED}>üzenet · feladat · kész munka</text>
    </svg>
  );
}
