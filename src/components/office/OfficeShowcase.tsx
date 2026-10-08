// „Mi az irodai fiók?" — részletes ismertető oldal (a TWINX-en belül, teljes szélességben).
// Felépítés az egyedi modul ismertetőjével egységes: sötét hero → világos szekciók → folyamat → GYIK → CTA.
import ModuleIcon from "@/components/ModuleIcon";
import Reveal from "@/components/motion/Reveal";
import OfficeHandoffScene from "@/components/office/OfficeHandoffScene";
import OfficeJoinButton from "@/components/office/OfficeJoinButton";

const CORAL = "var(--twx-coral)";
const MUTED = { color: "var(--twx-ink-muted)" };

const BENEFITS: { icon: string; title: string; text: string }[] = [
  { icon: "office", title: "Egy közös irodai egyenleg", text: "A vezető egyszer vásárol kreditet, és abból dolgozik az egész csapat — nem kell mindenkinek külön feltöltenie." },
  { icon: "pricing", title: "Keret kollégánként", text: "Minden kolléga annyi kreditet használhat, amennyit kiosztasz neki. A keretet bármikor emelheted vagy visszaveheted." },
  { icon: "history", title: "Átlátható költés", text: "Látod, ki, melyik modulban, mennyi kreditet használt — nincs meglepetés a hónap végén." },
  { icon: "request", title: "Csatlakozás egy kóddal", text: "A kolléga beírja az irodai kódot, és azonnal a csapat tagja. Nincs papírmunka, nincs várakozás." },
  { icon: "info", title: "A saját kredited megmarad", text: "Az irodai fiók mellett a saját egyenleged is a tiéd. Egy kapcsolóval választod ki, miből dolgozol." },
  { icon: "branding", title: "Egységes, profi kimenet", text: "Közös mappákban a csapat ugyanazokra az anyagokra épít — az ügyfél egységes minőséget kap, bárki is készítette." },
];

const STEPS: { title: string; text: string; tag: string }[] = [
  { title: "Igénylés", text: "Az iroda vezetője megadja az iroda nevét és a várható létszámot.", tag: "2 perc" },
  { title: "Jóváhagyás", text: "A TWINX csapata ellenőrzi és jóváhagyja az igénylést, utána egy kattintással megnyitod az irodai fiókot.", tag: "TWINX" },
  { title: "Kollégák meghívása", text: "Kapsz egy irodai kódot (pl. TWX-8K4P9R). Ezt küldöd el a kollégáknak — ők a „Csatlakozás kóddal” menüben beírják.", tag: "azonnali" },
  { title: "Kredit és keretek", text: "Feltöltöd az irodai egyenleget, és kiosztod a kereteket. Jogosultságot is adhatsz: helyettes kiosztó, vagy korlátlan használat.", tag: "te döntöd el" },
  { title: "Közös munka", text: "A kollégák irodai módban dolgoznak, a kész munkákat pedig megoszthatják a közös irodai mappákban.", tag: "csapatban" },
];

const COLLAB: { n: string; title: string; text: string }[] = [
  { n: "1", title: "Megosztás egy mappába", text: "Egy kész vagy félkész munkát — akár privát módban készültet is — egy kattintással beteszel egy közös irodai mappába." },
  { n: "2", title: "Te döntöd el, ki látja", text: "A mappa az egész irodáé lehet, vagy csak a kiválasztott kollégáké. Ami nincs megosztva, azt senki más nem látja." },
  { n: "3", title: "Folytatás vagy átnézés", text: "A mappa tagja megnyitja a munkát, és folytatja, ahol abbahagytad — vagy átnézi és kijavítja, mielőtt az ügyfélhez kerül." },
  { n: "4", title: "Nincs ütközés, nincs elveszett munka", text: "Amíg valaki szerkeszt, a munka zárolva van neki. Minden mentés új verzió: látod, ki és mikor módosított." },
];

const ROLES: { title: string; text: string; points: string[] }[] = [
  { title: "Vezető (létrehozó)", text: "Az irodai fiók gazdája.", points: ["Kreditet vásárol az irodának", "Keretet oszt ki", "Jogosultságokat ad", "Látja a költést kollégánként"] },
  { title: "Helyettes", text: "„Kioszthat kreditet” jogosultsággal.", points: ["Keretet oszt a kollégáknak", "Kezeli a kredit-kéréseket", "Saját magának nem oszthat"] },
  { title: "Kolléga", text: "Az iroda tagja.", points: ["A saját keretéből dolgozik", "Kredit-kérést küldhet", "Megosztott munkákat folytathat", "Csak a saját keretét látja"] },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Mi lesz a saját kreditjeimmel?", a: "Megmaradnak. Az irodai fiók egy második forrás: a képernyő alján lévő kapcsolóval választod ki, hogy a saját egyenlegedből vagy az irodai keretedből dolgozol." },
  { q: "Látja a vezető minden munkámat?", a: "Nem. Minden munka a készítőjénél marad. A vezető (és bárki más) csak azt látja, amit egy közös irodai mappába megosztasz. A vezető a kredit-felhasználást látja: ki, melyik modulban, mennyit." },
  { q: "Hogyan tudja a kollégám folytatni a munkámat?", a: "Tedd be a munkát egy közös irodai mappába, aminek ő is tagja. Ott megnyitja, és folytathatja vagy átnézheti. Szerkesztés közben a munka zárolva van, így ketten nem írják felül egymást, és minden mentésből új verzió lesz. A szerkesztés jelenleg az értékbecsléseknél érhető el; a többi modul munkái megoszthatók és megnyithatók." },
  { q: "Több irodához is tartozhatok?", a: "Igen. Több irodai fióknak is tagja lehetsz, és akár többet is létrehozhatsz. Az „Irodai fiókjaim” oldalon választod ki, melyikben dolgozol." },
  { q: "Lejárnak az irodai kreditek?", a: "Nem. Ugyanúgy, mint a saját kreditek, az irodai egyenleg sem jár le havonta." },
  { q: "Mi történik, ha egy kolléga kilép?", a: "A vezető eltávolítja a tagok közül. Az irodai egyenleg az irodánál marad, a kolléga megosztott munkái kikerülnek a közös mappákból, a saját munkái és saját kreditjei pedig nála maradnak." },
];

export default function OfficeShowcase() {
  return (
    <main className="font-sans" style={{
      background: "var(--twx-cream)", color: "var(--twx-ink)",
      marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)", marginTop: "-2.5rem", marginBottom: "-7rem",
    }}>
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden" style={{
        background: "var(--twx-dark)",
        borderTop: "1px solid rgba(239,122,90,0.45)", borderBottom: "1px solid rgba(239,122,90,0.25)",
      }}>
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(244,239,231,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(244,239,231,0.045) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 80% 70% at 60% 40%, #000 30%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 60% 40%, #000 30%, transparent 80%)",
          }} />
        <div aria-hidden className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(239,122,90,0.20), rgba(239,122,90,0) 65%)" }} />

        <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1fr_1.05fr] lg:pb-24 lg:pt-20">
          <Reveal>
            <p className="font-display text-sm font-semibold uppercase" style={{ color: CORAL, letterSpacing: "0.2em" }}>Irodai TWINX fiók</p>
            <h1 className="mt-4 font-display font-semibold leading-[1.06]" style={{ fontSize: "clamp(2.1rem, 4.1vw, 3.3rem)", color: "var(--twx-on-dark)" }}>
              Egy iroda. <span style={{ color: CORAL }}>Egy csapat.</span>
              <br />Közös munka.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>
              Közös kreditegyenleg az egész irodának, keret kollégánként, és közös mappák, ahol a munkát
              átadhatod egy kollégának: ő folytatja vagy átnézi, mielőtt az ügyfélhez kerül.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/dashboard/iroda/igenyles" className="rounded-xl px-7 py-4 text-base font-semibold transition-opacity hover:opacity-90"
                style={{ background: CORAL, color: "#1c1005" }}>
                Irodai fiók igénylése
              </a>
              <OfficeJoinButton className="rounded-xl px-6 py-4 text-base font-medium transition-colors hover:bg-white/5"
                style={{ color: "var(--twx-on-dark)", border: "1px solid rgba(255,255,255,0.2)" }}>
                Csatlakozás kóddal
              </OfficeJoinButton>
            </div>
            <p className="mt-4 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
              A kreditek nem járnak le · a saját egyenleged megmarad
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <OfficeHandoffScene />
          </Reveal>
        </div>
      </section>

      {/* ===================== MI EZ + ELŐNYÖK ===================== */}
      <section className="px-6 py-20">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Mi az irodai fiók?</h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed" style={MUTED}>
              Az irodai fiók egy <strong style={{ color: "var(--twx-ink)" }}>közös munkatér</strong> az irodádnak a TWINX-en belül.
              A vezető kezeli a krediteket és a jogosultságokat, a kollégák a saját keretükből dolgoznak, és a munkákat
              <strong style={{ color: "var(--twx-ink)" }}> tudatosan, mappánként</strong> osztják meg egymással.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={0.06 * i}>
                <div className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--twx-dark)", color: CORAL }}>
                    <ModuleIcon name={b.icon} size={20} />
                  </span>
                  <div>
                    <p className="font-display text-base font-semibold">{b.title}</p>
                    <p className="mt-1 text-sm leading-relaxed" style={MUTED}>{b.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== KÖZÖS MUNKA ===================== */}
      <section className="px-6 py-20" style={{ background: "var(--twx-cream-card)" }}>
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <p className="font-display text-sm font-semibold uppercase" style={{ color: CORAL, letterSpacing: "0.2em" }}>Közös munka</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Add át a munkát — a kollégád ott folytatja, ahol abbahagytad</h2>
            <p className="mt-3 max-w-3xl text-base" style={MUTED}>
              Ha többen dolgoztok egy ügyfélen, nem kell fájlokat küldözgetni. Megosztod a munkát egy közös irodai
              mappában, és a kollégád folytatja vagy átnézi. Profi, ellenőrzött anyag megy ki az irodából.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COLLAB.map((c, i) => (
              <Reveal key={c.title} delay={0.08 * i}>
                <div className="h-full rounded-2xl p-5" style={{ background: "#fff", border: "1px solid var(--twx-line)", boxShadow: "0 10px 30px rgba(28,24,21,0.05)" }}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full font-display text-sm font-semibold" style={{ background: CORAL, color: "#1c1005" }}>{c.n}</span>
                  <p className="mt-4 font-display text-lg font-semibold">{c.title}</p>
                  <p className="mt-2 text-sm leading-relaxed" style={MUTED}>{c.text}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Két tipikus helyzet */}
          <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[
              { t: "Folytatás", d: "Anna szabadságra megy, de félbemaradt egy értékbecslés. Beteszi a „Közös ügyfelek” mappába, Péter megnyitja, befejezi és elküldi az ügyfélnek." },
              { t: "Átnézés", d: "Egy junior kolléga elkészíti az anyagot, és megosztja a vezetővel. A vezető átnézi, javít rajta, és a verziónaplóban mindketten látják, mi változott." },
            ].map((x, i) => (
              <Reveal key={x.t} delay={0.08 * i}>
                <div className="h-full rounded-2xl p-6" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(239,122,90,0.16)", color: CORAL }}>Példa · {x.t}</span>
                  <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>{x.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FOLYAMAT ===================== */}
      <section className="relative overflow-hidden px-6 py-20" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="mx-auto w-full max-w-4xl">
          <Reveal>
            <p className="font-display text-sm font-semibold uppercase" style={{ color: CORAL, letterSpacing: "0.2em" }}>Folyamat</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Így indul az irodai fiók</h2>
          </Reveal>
          <ol className="relative mt-12 space-y-8 pl-14">
            <span aria-hidden className="absolute bottom-3 left-[19px] top-3 w-px" style={{ background: "linear-gradient(var(--twx-coral), rgba(239,122,90,0.1))" }} />
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={0.08 * i}>
                <li className="relative">
                  <span className="absolute -left-14 flex h-10 w-10 items-center justify-center rounded-full font-display text-base font-semibold"
                    style={{ background: i === STEPS.length - 1 ? CORAL : "var(--twx-dark)", color: i === STEPS.length - 1 ? "#1c1005" : CORAL, border: `2px solid ${CORAL}` }}>
                    {i + 1}
                  </span>
                  <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(244,239,231,0.10)" }}>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-display text-lg font-semibold">{s.title}</p>
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "rgba(239,122,90,0.16)", color: CORAL }}>{s.tag}</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>{s.text}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ===================== SZEREPKÖRÖK ===================== */}
      <section className="px-6 py-20">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Ki mit csinál az irodában?</h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {ROLES.map((r, i) => (
              <Reveal key={r.title} delay={0.08 * i}>
                <div className="h-full rounded-2xl p-6" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
                  <p className="font-display text-xl font-semibold">{r.title}</p>
                  <p className="mt-1 text-sm" style={MUTED}>{r.text}</p>
                  <ul className="mt-4 space-y-2">
                    {r.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: CORAL, color: "#1c1005" }}>✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== GYIK ===================== */}
      <section className="px-6 pb-20">
        <div className="mx-auto w-full max-w-3xl">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Gyakori kérdések</h2>
          </Reveal>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl px-5 py-4" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-base font-semibold">
                  {f.q}
                  <span aria-hidden className="text-xl transition-transform duration-200 group-open:rotate-45" style={{ color: CORAL }}>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed" style={MUTED}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== ZÁRÓ CTA ===================== */}
      <section className="relative overflow-hidden px-6 pb-36 pt-20" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(239,122,90,0.18), rgba(239,122,90,0) 65%)" }} />
        <Reveal className="relative mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold sm:text-5xl">Dolgozzatok együtt</h2>
          <p className="mt-4 text-lg" style={{ color: "var(--twx-on-dark-muted)" }}>
            Igényeld az irodai fiókot, vagy ha már kaptál kódot a vezetődtől, csatlakozz most.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="/dashboard/iroda/igenyles" className="rounded-xl px-8 py-4 text-base font-semibold transition-opacity hover:opacity-90"
              style={{ background: CORAL, color: "#1c1005" }}>
              Irodai fiók igénylése
            </a>
            <OfficeJoinButton className="rounded-xl px-7 py-4 text-base font-medium transition-colors hover:bg-white/5"
              style={{ color: "var(--twx-on-dark)", border: "1px solid rgba(255,255,255,0.2)" }}>
              Csatlakozás kóddal
            </OfficeJoinButton>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
