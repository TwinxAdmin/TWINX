// „Mi az egyedi modul?” — az ismertető tartalma (közös: dashboard-oldal + önálló landing).
// Arculat: a /ingatlan landinggel egységes (sötét hero → világos editorial szekciók).
// Az igénylés a B2BModal ablakban történik (open-b2b esemény).
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ModuleIcon from "@/components/ModuleIcon";
import Reveal from "@/components/motion/Reveal";
import B2BModal from "@/components/B2BModal";
import RequestButton from "@/components/custom-module/RequestButton";
import HeroFlow from "@/components/custom-module/HeroFlow";
import BeforeAfter from "@/components/custom-module/BeforeAfter";

const CORAL = "var(--twx-coral)";
const MUTED = { color: "var(--twx-ink-muted)" };

const INDUSTRIES = ["Ingatlaniroda", "Vendéglátás", "Szolgáltató cég", "Kereskedelem", "Építőipar", "Bármilyen ismétlődő folyamat"];

const USE_CASES: { icon: string; title: string; text: string }[] = [
  { icon: "valuation", title: "Ingatlaniroda", text: "Irodai adatlap- és ajánlatgenerátor a saját ingatlanlistádból és arculatodból — minden kolléga egységes, profi anyagot ad ki." },
  { icon: "menu", title: "Vendéglátás", text: "Menü- és árkalkulátor a beszállítói áraidból: ha drágul egy alapanyag, azonnal látod, melyik étel árát kell módosítani." },
  { icon: "pricing", title: "Szolgáltató cég", text: "Ajánlatkészítő a saját díjtételeiddel: a munkatárs megadja az igényt, a rendszer kész, márkázott árajánlatot ad." },
  { icon: "inventory", title: "Kereskedelem", text: "Készlet- és rendelésösszesítő, ami a táblázataidból heti riportot és beszerzési listát készít — magától." },
];

const BENEFITS: { icon: string; title: string; text: string }[] = [
  { icon: "branding", title: "A te arculatoddal", text: "Logó, színek, betűk, sablonok — minden kimenet úgy néz ki, mintha a saját grafikusod készítette volna." },
  { icon: "custom", title: "A te szabályaiddal", text: "A te árazásod, a te számítási logikád, a te folyamatod — nem kell egy általános programhoz alkalmazkodnod." },
  { icon: "info", title: "Csak a tiéd", text: "A modult és az adataidat csak te és az általad megjelölt munkatársak érik el." },
  { icon: "request", title: "Nincs új program", text: "A TWINX-be épül: ugyanott éred el, ahol a többi eszközt, ugyanazzal a belépéssel." },
  { icon: "history", title: "Veled együtt fejlődik", text: "Ha változik a folyamatod, a modul is bővíthető — nem kell elölről kezdeni." },
  { icon: "pro", title: "Magyar csapat, közvetlen kapcsolat", text: "Telefonon egyeztetünk, és ugyanazok az emberek építik a modult, akikkel beszéltél." },
];

const STEPS: { title: string; text: string; tag: string }[] = [
  { title: "Igénylés", text: "Pár mondatban leírod, mire lenne szükséged, és megadod a telefonszámod.", tag: "2 perc" },
  { title: "Telefonos egyeztetés", text: "Felhívunk, és közösen átnézzük a mostani munkafolyamatodat: mi ismétlődik, mi visz el sok időt.", tag: "díjmentes" },
  { title: "Árajánlat", text: "Írásban megkapod, mit tud majd a modul, mennyibe kerül és mikorra készül el.", tag: "kötelezettség nélkül" },
  { title: "Fejlesztés és tesztelés", text: "Megépítjük, és veled együtt kipróbáljuk valós adatokkal — addig finomítjuk, amíg pontosan úgy működik, ahogy kell.", tag: "közösen" },
  { title: "Átadás", text: "A modul megjelenik a „Saját moduljaim” menüben, és ugyanúgy használod, mint a TWINX többi eszközét.", tag: "kész" },
];

const QUALITY: { title: string; text: string }[] = [
  { title: "Biztonságos adattárolás", text: "Titkosított kapcsolat és jogosultság-alapú hozzáférés — minden adat a fiókodhoz kötött." },
  { title: "Saját, ellenőrzött kód", text: "Nem összekattintott külső automatizmusok: a modul a TWINX saját rendszerében fut, így stabil és gyors." },
  { title: "Tesztelés valós adatokkal", text: "Átadás előtt a te adataiddal, a te eseteiddel próbáljuk ki — nem demóval." },
  { title: "Jogosultságok munkatársanként", text: "Te döntöd el, a csapatból ki férhet hozzá a modulhoz." },
];

const FAQ: { q: string; a: string }[] = [
  { q: "Mennyibe kerül egy egyedi modul?", a: "Az ár a modul összetettségétől függ, ezért mindig egyedi árajánlatot adunk. Az egyeztetés és az ajánlat díjmentes, és nem kötelez semmire." },
  { q: "Mennyi idő alatt készül el?", a: "A modul méretétől függ. Az egyeztetés után az árajánlatban pontos ütemtervet kapsz, így előre tudod, mikorra számíthatsz rá." },
  { q: "Mit kell előkészítenem?", a: "Elég, ha el tudod mondani, hogyan dolgozol most, és megmutatod a használt táblázatokat, sablonokat. A többit közösen tisztázzuk." },
  { q: "Ki látja az adataimat?", a: "A modult és a benne kezelt adatokat csak te és az általad megjelölt munkatársak érik el. Más felhasználó nem látja." },
  { q: "Bővíthető később?", a: "Igen. Ha változik a folyamatod, vagy új ötleted van, a modul továbbfejleszthető — nem kell elölről kezdeni." },
];

/**
 * Az egyedi modul ismertető tartalma — KÉT helyen használjuk:
 *  • a TWINX-en belül (`embedded`): /dashboard/egyedi-modul — a felső TWINX menüsor marad,
 *    a szakaszok teljes szélességben futnak alatta (a dashboard tartalomsávjából kilépve);
 *  • önálló, kiküldhető landingként: /egyedi-modul (saját fejléccel + igénylő ablakkal).
 */
export default function CustomModuleShowcase({ embedded = false }: { embedded?: boolean }) {
  return (
    <main className="font-sans" style={{
      background: "var(--twx-cream)", color: "var(--twx-ink)",
      // A TWINX-en belül a dashboard tartalomsávjából (max-w-5xl, py-10) kilépve, teljes szélességben.
      ...(embedded ? { marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)", marginTop: "-2.5rem", marginBottom: "-2.5rem" } : {}),
    }}>
      {/* ============================ 1) HERO ============================ */}
      <section className="relative overflow-hidden" style={{ background: "var(--twx-dark)" }}>
        {/* Halvány rácsháttér + korall derengés — „mérnöki” hangulat */}
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(244,239,231,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(244,239,231,0.045) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 80% 70% at 60% 40%, #000 30%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 60% 40%, #000 30%, transparent 80%)",
          }} />
        <div aria-hidden className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(239,122,90,0.20), rgba(239,122,90,0) 65%)" }} />

        {!embedded && (
        <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
          <Link href="/" aria-label="TWINX főoldal">
            <Wordmark className="font-display text-3xl font-semibold" style={{ color: "var(--twx-on-dark)" }} />
          </Link>
          <a href="/dashboard" className="rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
            style={{ color: "var(--twx-on-dark)", border: "1px solid rgba(255,255,255,0.18)" }}>
            ← Vissza a TWINX-be
          </a>
        </nav>
        )}

        <div className={`relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 pb-20 lg:grid-cols-2 lg:pb-28 ${embedded ? "pt-14 lg:pt-20" : "pt-8 lg:pt-14"}`}>
          <Reveal>
            <p className="font-display text-sm font-semibold uppercase" style={{ color: CORAL, letterSpacing: "0.2em" }}>
              TWINX egyedi modul
            </p>
            <h1 className="mt-4 font-display font-semibold leading-[1.03]" style={{ fontSize: "clamp(2.3rem, 5.4vw, 3.9rem)", color: "var(--twx-on-dark)" }}>
              A te vállalkozásod.{" "}
              <span style={{ color: CORAL }}>A te modulod.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>
              Megépítjük azt az eszközt, ami a te napi munkádat automatizálja — a TWINX-be építve,
              a te adataiddal, sablonjaiddal és arculatoddal. Te csak egy kattintást látsz belőle.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <RequestButton className="rounded-xl px-7 py-4 text-base font-semibold transition-opacity hover:opacity-90"
                style={{ background: CORAL, color: "#1c1005" }}>
                Egyedi modul igénylése
              </RequestButton>
              <a href="#folyamat" className="rounded-xl px-6 py-4 text-base font-medium transition-colors hover:bg-white/5"
                style={{ color: "var(--twx-on-dark)", border: "1px solid rgba(255,255,255,0.2)" }}>
                Hogyan készül? ↓
              </a>
            </div>
            <p className="mt-4 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
              Díjmentes egyeztetés és árajánlat · kötelezettség nélkül
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="rounded-3xl p-4 sm:p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(244,239,231,0.10)" }}>
              <HeroFlow />
            </div>
          </Reveal>
        </div>

        {/* Iparág-sáv */}
        <div className="relative z-10 border-t" style={{ borderColor: "rgba(244,239,231,0.08)" }}>
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-5 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
            <span className="font-semibold" style={{ color: "var(--twx-on-dark)" }}>Kinek?</span>
            {INDUSTRIES.map((x, i) => (
              <span key={x} className="flex items-center gap-6">
                {i > 0 && <span aria-hidden style={{ color: CORAL }}>•</span>}
                {x}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== 2) MI EZ? + ELŐTTE/UTÁNA ===================== */}
      <section className="px-6 py-20">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Mi az egyedi modul?</h2>
            <p className="mt-4 text-base leading-relaxed" style={MUTED}>
              A TWINX moduljai — értékbecslés, videó, hirdetés — mindenkinek ugyanúgy működnek. Az
              <strong style={{ color: "var(--twx-ink)" }}> egyedi modul</strong> ezzel szemben a
              <strong style={{ color: "var(--twx-ink)" }}> te munkafolyamatodra</strong> épül: azt a feladatot végzi el,
              ami nálad rendszeresen ismétlődik, és ma órákat visz el — táblázatokból, sablonokból, kézi másolgatással.
            </p>
            <ul className="mt-6 space-y-3">
              {["Ismétlődő feladatok automatizálása egy kattintásra", "A saját árlistáid, sablonjaid, díjtételeid beépítve", "Több program helyett egyetlen, egységes eszköz"].map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px]">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: CORAL, color: "#1c1005" }}>✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-3xl p-6 sm:p-8" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
              <p className="mb-5 font-display text-lg font-semibold">Példa: egy árajánlat elkészítése</p>
              <BeforeAfter />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== 3) PÉLDÁK ===================== */}
      <section className="px-6 py-20" style={{ background: "var(--twx-cream-card)" }}>
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Mit építhetünk neked?</h2>
            <p className="mt-3 max-w-2xl text-base" style={MUTED}>Néhány példa abból, amit egy egyedi modul el tud végezni. A tiéd a te ötletedből születik.</p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u, i) => (
              <Reveal key={u.title} delay={0.08 * i}>
                <div className="group h-full rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
                  style={{ background: "#fff", border: "1px solid var(--twx-line)", boxShadow: "0 10px 30px rgba(28,24,21,0.05)" }}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
                    style={{ background: "rgba(239,122,90,0.12)", color: CORAL }}>
                    <ModuleIcon name={u.icon} size={22} />
                  </span>
                  <p className="mt-4 font-display text-lg font-semibold">{u.title}</p>
                  <p className="mt-2 text-sm leading-relaxed" style={MUTED}>{u.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== 5) FOLYAMAT ===================== */}
      <section id="folyamat" className="relative overflow-hidden px-6 py-20" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="mx-auto w-full max-w-4xl">
          <Reveal>
            <p className="font-display text-sm font-semibold uppercase" style={{ color: CORAL, letterSpacing: "0.2em" }}>Folyamat</p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Az ötlettől a kész modulig</h2>
            <p className="mt-3 max-w-2xl" style={{ color: "var(--twx-on-dark-muted)" }}>Öt átlátható lépés — minden szakaszban tudod, hol tartunk.</p>
          </Reveal>
          <ol className="relative mt-12 space-y-8 pl-14">
            {/* Függőleges idővonal */}
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

      {/* ===================== 6) AMIT KAPSZ ===================== */}
      <section className="px-6 py-20">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Amit egy TWINX egyedi modullal kapsz</h2>
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

      {/* ===================== 7) PROFI KIVITELEZÉS ===================== */}
      <section className="px-6 pb-20">
        <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-3">
            <div className="p-8 lg:col-span-1" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
              <p className="font-display text-sm font-semibold uppercase" style={{ color: CORAL, letterSpacing: "0.2em" }}>Minőség</p>
              <h2 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Profi kivitelezés, nem gyorsmegoldás</h2>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>
                Ugyanazzal a gondossággal építjük, mint a TWINX saját moduljait — amiket nap mint nap ingatlanosok és vállalkozók használnak.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:col-span-2" style={{ background: "var(--twx-line)" }}>
              {QUALITY.map((q, i) => (
                <Reveal key={q.title} delay={0.06 * i}>
                  <div className="h-full p-6" style={{ background: "var(--twx-cream-card)" }}>
                    <p className="flex items-center gap-2 font-display text-base font-semibold">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: CORAL, color: "#1c1005" }}>✓</span>
                      {q.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed" style={MUTED}>{q.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== 8) GYIK ===================== */}
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

      {/* ===================== 9) ZÁRÓ CTA ===================== */}
      <section className="relative overflow-hidden px-6 py-20" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(239,122,90,0.18), rgba(239,122,90,0) 65%)" }} />
        <Reveal className="relative mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold sm:text-5xl">Van egy ötleted?</h2>
          <p className="mt-4 text-lg" style={{ color: "var(--twx-on-dark-muted)" }}>
            Írd le pár mondatban, mi venne le terhet a válladról. Felhívunk, átbeszéljük, és díjmentes árajánlatot adunk.
          </p>
          <RequestButton className="mt-8 rounded-xl px-8 py-4 text-base font-semibold transition-opacity hover:opacity-90"
            style={{ background: CORAL, color: "#1c1005" }}>
            Egyedi modul igénylése
          </RequestButton>
          <p className="mt-4 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>Kb. 2 perc · telefonszám szükséges a visszahíváshoz</p>
        </Reveal>
      </section>

      {/* Az igénylő ablak (a gombok nyitják) — a TWINX-en belül a dashboard már tartalmazza. */}
      {!embedded && <B2BModal />}
    </main>
  );
}
