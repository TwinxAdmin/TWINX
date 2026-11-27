// twinx.hu — főoldal (D34, D36; tartalom: docs/terv/11, 3. szakasz). 6. lépés: B arculat (D69, D70; terv 29, minta:
// docs/terv/design/B-fooldal.dc.html). A korábbi, sötét heroval készült változat: git előzmény (2026-11-24 előtt);
// a régebbi, kredites főoldal: _backup/page.landing-v2-kredites.tsx.txt.
//
// Tartalmi szabályok: tegező hangnem; nincs ár, nincs „kredit", nincs kitalált szám vagy idézet. A futó sáv és a
// modul-ablak ÖTLETEK (felcímkézve); az ingatlanos modulok csak a Referenciák részben szerepelnek.
// Szövegek: src/lib/site-copy.ts. Design-tokenek: src/app/globals.css (B ARCULAT blokk).
import type { Metadata } from "next";
import AuthModal from "@/components/AuthModal";
import Reveal from "@/components/motion/Reveal";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactBlock from "@/components/site/ContactBlock";
import IdeaMarquee from "@/components/site/b/IdeaMarquee";
import OfficeShowcase from "@/components/site/b/OfficeShowcase";
import GdnShowcase from "@/components/site/b/GdnShowcase";
import SilkVideo from "@/components/site/b/SilkVideo";
import GlassOrbs from "@/components/site/b/GlassOrbs";
import TimeSkyline from "@/components/site/b/TimeSkyline";
import TwinxStamp from "@/components/site/b/TwinxStamp";
import { bookingsOpenFor, getSiteViewer } from "@/lib/site-preview";
import { SITE_LINKS } from "@/lib/site";
import { GDN_SHOWCASE, HOW_STEPS, RUN_PLACES, WHAT_IS_MODULE } from "@/lib/site-copy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TWINX — a te cégedre szabott modul",
  description: "Profi felmérés után a TWINX a napi munkádhoz igazított eszközt épít. Foglalj ingyenes felmérést.",
};

export default async function HomePage() {
  const viewer = await getSiteViewer();

  return (
    <main className="min-h-screen bg-b-bg font-sans text-b-ink">
      <SiteHeader viewer={viewer} />

      {/* ===== 1) HERO — sötét, a bronz selyemszalagos háttérvideóval (Márk kérése 2026-11-25: a videó a lap tetejére
          került). A szöveg a kép sötét, bal felén áll, balra igazítva; a felső sávval egybeolvadó sötét blokk.
          Alján a futó sáv (üveges kapszulák). ===== */}
      <div className="relative overflow-hidden bg-b-dark text-b-on-dark">
        <SilkVideo />
        <section className="relative mx-auto flex min-h-[520px] max-w-[1100px] items-center px-4 pb-6 pt-16 sm:min-h-[600px] sm:px-8 sm:pt-[90px]">
          <div className="min-w-0 max-w-[620px]">
            <h1 className="font-display mb-[22px] text-[44px] font-bold leading-[1.02] tracking-[-1.2px] sm:text-[64px] lg:text-[76px] lg:tracking-[-2px]">
              A te cégedre<br />szabott modul.
            </h1>
            <p className="mb-[34px] max-w-[560px] text-lg leading-[1.55] text-b-on-dark sm:text-[21px]">
              Profi felmérés után a TWINX a napi munkádhoz igazított eszközt épít. Nem sablont kapsz.
            </p>
            <div className="flex flex-wrap gap-3.5">
              <a href={SITE_LINKS.contact} className="b-btn px-[30px] py-[17px]">Ingyenes felmérés</a>
              <a href="#ref" className="b-btn-outline border-white/45 text-b-on-dark hover:bg-white/10">Referenciák megtekintése</a>
            </div>
          </div>
        </section>

        {/* ===== 2) FUTÓ SÁV — a hero alján, a videóhoz illő üveges kapszulákkal ===== */}
        <div className="relative pb-8"><IdeaMarquee tone="dark" /></div>
      </div>

      {/* ===== 3) IRODAI FIÓK — közös modulok, megosztott munka (animált bemutató) ===== */}
      <OfficeShowcase />

      {/* ===== 4) MI AZ EGYEDI MODUL? — sötét sáv ===== */}
      <section className="relative overflow-hidden bg-b-dark text-b-on-dark">
        {/* Selymes, meleg háttér (CSS): lágy bronz derengés az ábra mögött (változatlan, terv 30). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_76%_50%,rgba(176,118,76,0.30),transparent_65%),radial-gradient(40%_50%_at_76%_58%,rgba(255,122,79,0.14),transparent_70%),radial-gradient(90%_120%_at_0%_100%,rgba(10,6,4,0.55),transparent_60%)]" />
        <div className="relative mx-auto grid min-h-[560px] max-w-[1100px] grid-cols-1 items-center gap-6 px-4 py-16 sm:min-h-[640px] sm:px-8 sm:py-[96px] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Reveal className="min-w-0 max-w-[560px]">
            <p className="mb-4 text-[13px] uppercase tracking-[1.6px] text-b-accent-on-dark">{WHAT_IS_MODULE.eyebrow}</p>
            <h2 className="font-display m-0 mb-7 text-[32px] font-bold leading-[1.1] tracking-[-1px] sm:text-[44px]">{WHAT_IS_MODULE.title}</h2>
            <div className="flex flex-col gap-[18px] text-[17px] leading-[1.65] text-b-on-dark-2 sm:text-lg">
              {WHAT_IS_MODULE.paragraphs.map((p) => <p key={p}>{p}</p>)}
            </div>
            <TwinxStamp className="mt-10" />
          </Reveal>
          {/* Gömbös 3D ábra (terv 30, D72): 7 üveggömb a TWINX előneivel; odagörgetve magától, egérre / érintésre is
              szétrebben. Fix 1:1 doboz. (A „Mutass rá…" felirat Márk kérésére kikerült.) */}
          <div className="relative mx-auto w-full max-w-[640px]">
            {/* Háttér (Márk kérése 2026-11-27, a téglás animáció mögül visszahozva): izzó „időspórolás-városkép" */}
            {/* Elválasztás az ábrától (Márk kérése 2026-11-27): a háttér hidegebb, fakó homok-szürke tónust kap, kicsit
                elmosva (mélységélesség), így a réz gömbök kiemelkednek előtte. */}
            <TimeSkyline className="absolute bottom-[6%] left-1/2 h-auto w-[135%] -translate-x-1/2 opacity-45 [filter:hue-rotate(155deg)_saturate(0.35)_brightness(1.05)_blur(0.8px)]" />
            <GlassOrbs />
          </div>
        </div>
      </section>

      {/* ===== 5) HOGYAN MŰKÖDIK — 3 számozott kártya ===== */}
      <section id="hogyan" className="mx-auto max-w-[1100px] scroll-mt-24 px-4 pb-10 pt-16 sm:px-8 sm:pt-[90px]">
        <Reveal>
          <h2 className="font-display mb-[34px] text-[32px] font-bold tracking-[-0.8px] sm:text-[40px]">Hogyan működik?</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {HOW_STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08} className="h-full">
              <div className="h-full min-h-[190px] rounded-[22px] border border-b-line bg-b-card p-7">
                <span className="font-display mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-b-accent text-xl text-white">{i + 1}</span>
                <h3 className="mb-2 text-[22px] font-semibold">{s.title}</h3>
                <p className="text-[15px] leading-[1.55] text-b-ink-2">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== 6) HOL FUT A MODUL — 4 fix méretű kártya, az első „Ajánlott kezdés" ===== */}
      <section className="mx-auto max-w-[1100px] px-4 pb-10 pt-12 sm:px-8">
        <Reveal>
          <h2 className="font-display mb-[26px] text-[28px] font-bold tracking-[-0.6px] sm:text-[34px]">Hol fut a modul?</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RUN_PLACES.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06} className="h-full">
              <div className={`h-[176px] overflow-hidden rounded-[18px] border-[1.5px] p-[22px] ${p.featured ? "border-b-accent bg-b-accent-tint" : "border-b-line bg-b-card"}`}>
                {/* Fix magasságú címke-hely: a kártyák címei egy vonalban maradnak. */}
                <p className="h-[22px] text-[11px] font-semibold uppercase tracking-[1px] text-b-accent-ink">{p.featured ? "Ajánlott kezdés" : ""}</p>
                <h3 className="mb-2 mt-1 text-lg font-semibold">{p.title}</h3>
                <p className="text-sm leading-normal text-b-ink-2">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== 7) REFERENCIÁK — a GDN Mandalának fejlesztett modulok, interaktív bemutatóval ===== */}
      {/* Teljes szélességű, sötétebb sáv (Márk kérése), hogy a referencia-blokk kiemelkedjen. */}
      <section id="ref" className="scroll-mt-24 bg-b-surface">
      <div className="mx-auto max-w-[1100px] px-4 pb-[70px] pt-14 sm:px-8 sm:pt-16">
        <Reveal>
          <p className="b-eyebrow mb-3">{GDN_SHOWCASE.eyebrow}</p>
          <h2 className="font-display mb-2 text-[28px] font-bold tracking-[-0.6px] sm:text-[36px]">{GDN_SHOWCASE.title}</h2>
          <p className="mb-[26px] max-w-[680px] text-base leading-[1.55] text-b-ink-2">{GDN_SHOWCASE.lead}</p>
        </Reveal>
        <GdnShowcase />
        <div className="mt-8">
          <a href={SITE_LINKS.references} className="b-btn-outline">Referenciák megtekintése</a>
        </div>
      </div>
      </section>

      {/* ===== 8) KAPCSOLAT — korall sáv a meglévő foglalási blokkal ===== */}
      <div className="pt-16">
        <ContactBlock source="fooldal" bookingOpen={bookingsOpenFor(viewer)}
          prefill={viewer ? { name: viewer.name, email: viewer.email } : undefined} />
      </div>

      {/* ===== 9) LÁBLÉC ===== */}
      <SiteFooter />

      <AuthModal />
    </main>
  );
}
