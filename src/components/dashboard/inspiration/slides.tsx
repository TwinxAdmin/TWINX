// Az inspirációs blokk diái (design/portal-vegleges.html). Csak megjelenítés — a választást
// (kinek melyik dia) a Portálközpont oldala végzi. Az animációk osztályai a globals.css-ben: .twx-insp-*.
import Link from "next/link";
import Image from "next/image";

const ENHANCE_HREF = "/dashboard/real-estate/image-enhance";

/** Közös dia-elrendezés: bal oldalt a szöveg, jobb oldalt a látvány (telefonon egymás alatt). */
function SlideLayout({ copy, visual }: { copy: React.ReactNode; visual: React.ReactNode }) {
  return (
    <div className="grid h-full content-start gap-5 px-[18px] pb-12 pt-6 sm:grid-cols-[1.02fr_1fr] sm:content-center sm:items-center sm:gap-[18px] sm:px-10 sm:pb-[46px] sm:pt-[30px]">
      <div className="relative z-[2]">{copy}</div>
      <div className="relative">{visual}</div>
    </div>
  );
}

function Kick({ children, gold = false }: { children: React.ReactNode; gold?: boolean }) {
  return <span className={`twx-insp-kick${gold ? " gold" : ""}`}><i />{children}</span>;
}

function Title({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 mt-3 font-display text-[28px] font-bold leading-[1.06] tracking-[-0.01em] sm:text-[42px]">{children}</h3>;
}

function Text({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[480px] text-[14.5px] leading-relaxed sm:text-[15.5px]" style={{ color: "var(--twx-on-dark-muted)" }}>{children}</p>;
}

function Cta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      className="mt-5 inline-flex h-[46px] items-center justify-center rounded-full px-5 text-[14.5px] font-bold text-white transition-opacity hover:opacity-90"
      style={{ background: "#c4553a", boxShadow: "0 12px 28px rgba(196,85,58,.3)" }}>
      {children}
    </Link>
  );
}

/** Minta értékbecslő riport (világos kártya) — a „MINTA" jelölés mutatja, hogy nem valódi adat. */
export function ReportMock() {
  const bars = [46, 62, 70, 58, 80, 52];
  return (
    <div className="absolute inset-0 flex flex-col gap-2 px-[18px] py-4" style={{ background: "linear-gradient(160deg,#f6f1ea,#ece4d8)", color: "var(--twx-ink)" }}>
      <span className="text-[10px] font-bold tracking-[0.16em]" style={{ color: "#8c8279" }}>BECSÜLT PIACI ÉRTÉK</span>
      <span className="font-display text-[26px] font-bold">63,4 M Ft<small className="ml-1 text-xs font-semibold" style={{ color: "#8c8279" }}>± 4%</small></span>
      <div className="relative h-2 rounded" style={{ background: "linear-gradient(90deg,#f3c9b8,#ef7a5a,#f3c9b8)" }}>
        <i className="absolute -top-1 left-[52%] h-4 w-[3px] rounded-sm" style={{ background: "var(--twx-ink)" }} />
      </div>
      <div className="mt-1 flex h-[50px] items-end gap-1.5">
        {bars.map((h, i) => (
          <b key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 2 ? "#c4553a" : "#d8cdbf" }} />
        ))}
      </div>
      <span className="text-[10.5px]" style={{ color: "#7a7067" }}>6 hasonló eladás az elmúlt 1 évből · PDF-riport</span>
      <span className="absolute bottom-2.5 right-2.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-[0.12em]" style={{ color: "#9a8f85", border: "1px solid #cfc5b9" }}>MINTA</span>
    </div>
  );
}

/** A „gép": a fotó belefut a TWINX-be, és kijön belőle hirdetéskép, videó, értékbecslés, szöveg. */
function Machine() {
  return (
    <svg viewBox="0 0 520 400" className="block h-auto w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="twx-insp-g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb79f" /><stop offset=".6" stopColor="#ef7a5a" /><stop offset="1" stopColor="#e9c77f" />
        </linearGradient>
        <radialGradient id="twx-insp-g2">
          <stop offset="0" stopColor="#ef7a5a" stopOpacity=".55" /><stop offset="1" stopColor="#ef7a5a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path className="twx-insp-flow" d="M118 200 C160 200 180 200 222 200" stroke="#ef7a5a" strokeWidth="2" fill="none" opacity=".8" />
      {[70, 160, 250, 340].map((y) => (
        <path key={y} className="twx-insp-flow" d={`M318 200 C360 200 370 ${y} 410 ${y}`} stroke="#e9c77f" strokeWidth="2" fill="none" opacity=".7" />
      ))}
      <g className="twx-insp-photo">
        <rect x="30" y="150" width="86" height="100" rx="12" fill="#2a221c" stroke="#5b4a3d" />
        <rect x="40" y="160" width="66" height="56" rx="6" fill="#4a3f36" />
        <path d="M44 210 l18 -22 l14 14 l10 -10 l16 18 z" fill="#6c5c4f" />
        <circle cx="92" cy="172" r="6" fill="#7d6b5c" />
        <text x="73" y="270" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill="#cfc6bb">a te fotód</text>
      </g>
      <circle cx="270" cy="200" r="88" fill="url(#twx-insp-g2)" />
      <g className="twx-insp-ring"><circle cx="270" cy="200" r="64" fill="none" stroke="#ef7a5a" strokeOpacity=".45" strokeDasharray="3 9" strokeWidth="2" /></g>
      <g className="twx-insp-ring r2"><circle cx="270" cy="200" r="78" fill="none" stroke="#e9c77f" strokeOpacity=".35" strokeDasharray="1 7" strokeWidth="2" /></g>
      <g className="twx-insp-core">
        <circle cx="270" cy="200" r="46" fill="#1d1714" stroke="url(#twx-insp-g1)" strokeWidth="2.5" />
        <text x="270" y="207" textAnchor="middle" fontFamily="var(--font-display), sans-serif" fontWeight="700" fontSize="20" fill="#f6f0e8">TWIN<tspan fill="#ef7a5a">X</tspan></text>
      </g>
      <g className="twx-insp-out">
        <rect x="410" y="40" width="96" height="60" rx="10" fill="#f6f0e8" />
        <rect x="418" y="48" width="80" height="26" rx="4" fill="#c9b8a6" />
        <rect x="418" y="78" width="50" height="6" rx="3" fill="#1c1815" />
        <rect x="418" y="88" width="34" height="6" rx="3" fill="#c4553a" />
        <text x="458" y="116" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill="#cfc6bb">hirdetéskép</text>
      </g>
      <g className="twx-insp-out o2">
        <rect x="410" y="130" width="96" height="60" rx="10" fill="#2a221c" stroke="#5b4a3d" />
        <g className="twx-insp-play"><circle cx="458" cy="160" r="15" fill="#ef7a5a" /><path d="M453 152 l13 8 l-13 8 z" fill="#fff" /></g>
        <text x="458" y="206" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill="#cfc6bb">videó</text>
      </g>
      <g className="twx-insp-out o3">
        <rect x="410" y="220" width="96" height="60" rx="10" fill="#f6f0e8" />
        {[[422, 252, 20], [438, 242, 30], [454, 236, 36], [470, 246, 26], [486, 240, 32]].map(([x, y, h], i) => (
          <rect key={x} className="twx-insp-bar" x={x} y={y} width="10" height={h} rx="2" fill={i === 2 ? "#c4553a" : "#c9b8a6"} />
        ))}
        <text x="458" y="296" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill="#cfc6bb">értékbecslés</text>
      </g>
      <g className="twx-insp-out o4">
        <rect x="410" y="310" width="96" height="60" rx="10" fill="#f6f0e8" />
        <rect x="420" y="322" width="76" height="6" rx="3" fill="#d8cdbf" />
        <rect x="420" y="334" width="60" height="6" rx="3" fill="#d8cdbf" />
        <svg x="420" y="346" width="76" height="8"><rect className="twx-insp-typing" x="0" y="0" width="66" height="6" rx="3" fill="#1c1815" /></svg>
        <text x="458" y="386" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="10" fill="#cfc6bb">hirdetésszöveg</text>
      </g>
    </svg>
  );
}

/** 1) Mire képes a TWINX — „A mindennapi munkád jobbkeze." */
export function MachineSlide() {
  return (
    <SlideLayout
      copy={<>
        <Kick>MIRE KÉPES A TWINX</Kick>
        <Title>A mindennapi munkád <span className="twx-insp-grad">jobbkeze.</span></Title>
        <Text>Lefotózod az ingatlant — a TWINX percek alatt kész hirdetést, videót, értékbecslést és szöveget készít belőle.</Text>
        <Cta href={ENHANCE_HREF}>Kipróbálom a Képjavítót →</Cta>
      </>}
      visual={<div className="-mx-1.5 sm:mx-0"><Machine /></div>}
    />
  );
}

/** 2) Egy új megbízás, egy délelőtt — 2–3 nap helyett ~20 perc. */
export function MorningSlide() {
  const steps = [
    ["09:00", "Lefotózod a lakást a telefonoddal."],
    ["09:05", "Világos, egyenes, hirdetésre kész fotók."],
    ["09:12", "Hirdetéskép és portálszöveg a saját arculatoddal."],
    ["09:20", "Videó és értékbecslés — küldheted az ügyfélnek."],
  ];
  return (
    <SlideLayout
      copy={<>
        <Kick>EGY ÚJ MEGBÍZÁS, EGY DÉLELŐTT</Kick>
        <Title>2–3 nap helyett <span className="twx-insp-grad">~20 perc.</span></Title>
        <Text>Ami eddig napokig tartott — fotós, grafikus, szövegíró —, most egy kávé mellett kész.</Text>
      </>}
      visual={
        <ol className="relative flex flex-col gap-2.5 pl-[26px] sm:gap-3">
          <span aria-hidden className="absolute bottom-1.5 left-2 top-1.5 w-0.5" style={{ background: "linear-gradient(#ef7a5a,#e9c77f)" }} />
          {steps.map(([t, s]) => (
            <li key={t} className="relative rounded-xl px-3.5 py-2.5" style={{ background: "rgba(255,255,255,.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)" }}>
              <span aria-hidden className="absolute -left-6 top-3.5 h-3 w-3 rounded-full" style={{ background: "#1a1512", boxShadow: "0 0 0 2px var(--twx-coral)" }} />
              <time className="mr-2 font-display text-sm font-bold" style={{ color: "#ffb79f" }}>{t}</time>
              <span className="text-[13.5px]" style={{ color: "#e9e1d7" }}>{s}</span>
            </li>
          ))}
        </ol>
      }
    />
  );
}

/** 3) Ajándék kredit — csak ha tényleg érintetlen próbakredit van nála (a szám mindig a valódi egyenleg). */
export function GiftSlide({ credits }: { credits: number }) {
  const card = "twx-insp-bob absolute overflow-hidden rounded-[14px] shadow-[0_18px_40px_rgba(0,0,0,.45)] w-[140px] h-[180px] sm:w-[200px] sm:h-[250px]";
  const tag = "absolute bottom-2 left-2 rounded-md px-[7px] py-[3px] text-[10px] font-bold tracking-[0.1em] text-white";
  return (
    <SlideLayout
      copy={<>
        <Kick gold>AJÁNDÉK A REGISZTRÁCIÓÉRT</Kick>
        <Title>Van <span className="twx-insp-grad">{credits} ingyen kredited.</span></Title>
        <Text>Próbáld ki a saját ingatlanoddal: feljavított fotó, kész hirdetéskép, értékbecslés — mindegyik 1 kredit.</Text>
        <Cta href={ENHANCE_HREF}>Kezdjük →</Cta>
      </>}
      visual={
        <div className="relative h-[200px] sm:h-[300px]" aria-hidden>
          <div className={`${card} left-0 top-[30px] -rotate-[8deg] sm:left-[4%]`}>
            <Image src="/showcase/enhance-after.jpg" alt="" fill sizes="200px" className="object-cover" />
            <span className={tag} style={{ background: "rgba(20,18,16,.75)" }}>FOTÓ</span>
          </div>
          <div className={`${card} left-[28%] top-1.5 z-[2] flex items-center justify-center sm:left-[31%]`} style={{ background: "#efe8de", animationDelay: ".6s" }}>
            <Image src="/flyer-samples/openhouse-1x1.png" alt="" fill sizes="200px" className="object-contain p-2" />
            <span className={tag} style={{ background: "rgba(20,18,16,.75)" }}>HIRDETÉS</span>
          </div>
          <div className={`${card} left-[56%] top-[34px] rotate-[7deg] sm:left-[58%]`} style={{ animationDelay: "1.2s" }}>
            <ReportMock />
          </div>
        </div>
      }
    />
  );
}
