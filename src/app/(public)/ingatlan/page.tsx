// twinx.hu/ingatlan — Értékesítési landing ingatlanközvetítőknek.
// Kiküldhető link: bemutatja a TWINX AI modulokat, a 10 kredites akciót, és
// egy jelentkező-űrlappal gyűjti a leadeket. TWINX arculat (sötét-bronz hero →
// világos editorial szekciók), a főoldallal egységes.
import type { Metadata } from "next";
import Wordmark from "@/components/Wordmark";
import ModuleIcon from "@/components/ModuleIcon";
import IngatlanLeadForm from "@/components/IngatlanLeadForm";
import IngatlanCta from "@/components/IngatlanCta";
import Reveal from "@/components/motion/Reveal";
import IngatlanHero from "@/components/IngatlanHero";
import IngatlanServiceTicker from "@/components/IngatlanServiceTicker";
import IngatlanConsultModal, { IngatlanConsultButton } from "@/components/IngatlanConsultModal";
import HeroShowcase from "@/components/landing/HeroShowcase";
import ShowcaseFrame, { ShowcaseBackdrop } from "@/components/landing/ShowcaseFrame";
import { SHOWCASE } from "@/lib/landing";

export const metadata: Metadata = {
  title: "TWINX ingatlanközvetítőknek — profi eszközök a gyorsabb, igényesebb munkához",
  description:
    "Ingatlanközvetítők fejlesztették, ingatlanközvetítőknek. Értékbecslés, hirdetéskép, videó, látványterv és hirdetésszöveg — havidíj nélkül, használat alapon. Az első 50 jelentkező 10 ajándék kreditet kap.",
};

const APPS: { icon: string; title: string; desc: string }[] = [
  { icon: "valuation", title: "Értékbecslő", desc: "Valós piaci adatokon alapuló, azonnali értékbecslés korrekciókkal (eladási, kínálati és gyorsár). Kiváló árazáshoz és ügyfélszerző kampányokhoz." },
  { icon: "visualization", title: "Képjavító", desc: "Rendetlenség eltüntetése és képminőség-javítás egyetlen kattintással — a vonzóbb hirdetésekért." },
  { icon: "flyer", title: "Hirdetési kép készítő", desc: "Profi, figyelemfelkeltő összefoglaló képek a közösségi média felületekre, posztolásra készen." },
  { icon: "video", title: "Videó generálás", desc: "Hangulatos ingatlanbemutató videók pár kattintással — a maximális online elérésért." },
  { icon: "visualization", title: "Látványtervező", desc: "Virtuális felújítás és berendezés. Mutasd meg a vevőknek az ingatlanban rejlő potenciált, az ő stílusukra szabva." },
  { icon: "history", title: "Szöveg ellenőrzés", desc: "Hirdetési szövegek automatikus lektorálása és optimalizálása a legjobb konverzió érdekében." },
  { icon: "flyer", title: "Hirdetési szöveg generátor", desc: "Azonnal posztolható Facebook, Instagram és Google hirdetésszövegek az ingatlan adatai alapján." },
];

// „Hogyan működik" — 3 lépéses folyamatábra.
const STEPS: { icon: string; title: string; desc: string }[] = [
  { icon: "valuation", title: "1. Add meg az adatokat", desc: "Töltsd fel az ingatlan adatait és fotóit — pár mező, pár kattintás." },
  { icon: "video", title: "2. A TWINX legyártja", desc: "Percek alatt elkészül a kész anyag: hirdetéskép, videó, értékbecslés vagy szöveg." },
  { icon: "history", title: "3. Letöltöd, posztolod", desc: "Kész, posztolható tartalom — a saját arculatoddal, azonnal használható formában." },
];

export default function IngatlanLanding() {
  return (
    <main className="font-sans" style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }}>
      {/* ============================ 1) HERO ============================ */}
      <section className="relative overflow-hidden" style={{ background: "var(--twx-dark)", minHeight: "min(92vh, 860px)" }}>
        {/* Filmes hero-háttér: loop-videó asztalon, állókép mobilon; a bal harmad sötét maszkot kap. */}
        <IngatlanHero />

        <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
          {/* A logó a TWINX főoldalra visz. */}
          <a href="/" aria-label="TWINX főoldal">
            <Wordmark className="font-display text-3xl font-semibold" style={{ color: "var(--twx-on-dark)" }} />
          </a>
          <a href="/" className="rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
            style={{ color: "var(--twx-on-dark)", border: "1px solid rgba(255,255,255,0.18)" }}>
            TWINX főoldal →
          </a>
        </nav>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-16 sm:pt-20 lg:py-24">
          {/* Bal oszlop: fix maximális szélesség, hogy a jobb szélre tett
              főcímeknek asztalon biztosan maradjon saját sávja. */}
          <div className="lg:max-w-[540px] xl:max-w-[600px]">
            <p className="font-display text-sm font-semibold uppercase" style={{ color: "var(--twx-coral)", letterSpacing: "0.2em" }}>
              TWINX ingatlanos eszköztár
            </p>
            <h1 className="mt-4 font-display font-semibold leading-[1.02]" style={{ fontSize: "clamp(2.4rem, 6vw, 4.2rem)", color: "var(--twx-on-dark)" }}>
              Turbózd fel az ingatlanközvetítést a TWINX profi eszközeivel!
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>
              Ingatlanközvetítők fejlesztették, ingatlanközvetítőknek. Percek alatt kész,
              igényes anyagok a mindennapi munkádhoz — nincs havi díj, csak a tényleges
              használatért fizetsz.
            </p>

            {/* Az akció PONTOS menete — ne ígérjünk azonnali kreditet, mert
                a kód kiadása jóváhagyáshoz kötött.
                KIEMELVE: tömör, sötét kártya (nem áttetsző) + korall fejléc-sáv,
                erős árnyék és korall derengés, hogy elváljon a hero-képtől. */}
            <div className="twx-gift-pulse relative mt-6 overflow-hidden rounded-2xl"
              style={{
                background: "rgba(18,16,14,0.62)",
                border: "1.5px solid var(--twx-coral)",
                backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
              }}>
              {/* Korall fejléc-sáv — azonnal olvasható, kontrasztos */}
              <div className="flex items-center gap-2 px-5 py-2.5"
                style={{ background: "rgba(239,122,90,0.72)", color: "#1c1005" }}>
                <span aria-hidden className="text-base">🎁</span>
                <span className="text-sm font-bold sm:text-[15px]">Indulási ajándék — az első 50 ingatlanosnak</span>
              </div>
              <ol className="space-y-1.5 px-5 py-4 text-sm sm:text-[15px]" style={{ color: "var(--twx-on-dark)" }}>
                <li>1. Jelentkezel az alábbi űrlapon (nem regisztráció, nincs kötelezettség).</li>
                <li>2. Átnézzük, és jóváhagyás után e-mailben küldünk egy ajándékkódot.</li>
                <li>3. Regisztrálsz, majd belépve beváltod a kódot —{" "}
                  <strong className="rounded px-1.5 py-0.5 font-bold" style={{ background: "rgba(239,122,90,0.22)", color: "var(--twx-coral)" }}>10 ingyenes kredit</strong>
                </li>
              </ol>
            </div>

            <div className="mt-8">
              <IngatlanCta
                intent="kreditek"
                className="rounded-xl px-7 py-4 text-base font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--twx-coral)", color: "#1c1005" }}
              >
                Kérem az ajándékkódot
              </IngatlanCta>
            </div>
          </div>

        </div>

        {/* Mobilon a szöveg alatt, a tartalom sávjában; asztalon a SZEKCIÓ jobb
            alsó sarkához rögzítve (abszolút a section-höz képest, nem a
            max-w konténerhez), így a bal oszlop szövegével nem ütközhet. */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 lg:static lg:mx-0 lg:max-w-none lg:p-0">
          <IngatlanServiceTicker titles={APPS.map((a) => a.title)} />
        </div>
      </section>

      {/* ===================== 2) NÉZD MEG MŰKÖDÉS KÖZBEN ===================== */}
      {/* Ugyanaz a modul-forgó, mint a főoldalon (lib/landing SHOWCASE): képjavító
          és látványterv előtte/utána csúszka, értékbecslés-jelenet, valódi videó a
          telefonon, hirdetéskép. A korábbi „Miért a TWINX?" előny-kártyák helyén. */}
      <section id="mukodes" className="relative overflow-hidden" style={{ background: "var(--twx-dark-2)", color: "var(--twx-on-dark)" }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden
          style={{ background: "radial-gradient(60% 60% at 50% 0%, rgba(239,122,90,0.16), transparent 70%)" }} />
        {/* Pontrács + sebességcsíkok a teljes szekción (ShowcaseFrame.tsx) */}
        <ShowcaseBackdrop />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16">
          <Reveal>
            <h2 className="font-display mx-auto max-w-2xl text-center text-3xl font-medium sm:text-4xl">
              Nézd meg működés közben
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
              Valódi munkák: telefonfotóból hirdetési fotó, adatokból értékbecslés, képekből zenés videó —{" "}
              <span className="whitespace-nowrap">percek alatt.</span>
            </p>
          </Reveal>
          <div className="mt-12">
            <Reveal delay={0.1}>
              <ShowcaseFrame>
                <HeroShowcase slides={SHOWCASE} />
              </ShowcaseFrame>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===================== 2b) HOGYAN MŰKÖDIK (ÁBRA) ===================== */}
      <section className="px-6 py-16 sm:py-20" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: "var(--twx-on-dark)" }}>
              Három lépés, és kész
            </h2>
            <p className="mt-3 max-w-2xl text-base" style={{ color: "var(--twx-on-dark-muted)" }}>
              A feltöltéstől a posztolható anyagig — percek, nem órák.
            </p>
          </Reveal>
          <div className="relative mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.1}>
                <div className="relative h-full rounded-2xl p-6 text-center md:text-left"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl md:mx-0"
                    style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                    <ModuleIcon name={s.icon} className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-medium" style={{ color: "var(--twx-on-dark)" }}>{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== 3) ELÉRHETŐ ALKALMAZÁSOK ===================== */}
      <section className="px-6 py-16 sm:py-20" style={{ background: "var(--twx-cream-card)" }}>
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Elérhető alkalmazások</h2>
            <p className="mt-3 max-w-2xl text-base" style={{ color: "var(--twx-ink-muted)" }}>
              Egy platform, több célalkalmazás — mindegyik a mindennapi ingatlanos munkára szabva.
            </p>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {APPS.map((a, i) => (
              <Reveal key={a.title} delay={i * 0.05}>
                <div className="h-full rounded-2xl p-6" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--twx-coral-soft)", color: "var(--twx-coral)" }}>
                      <ModuleIcon name={a.icon} className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-lg font-medium">{a.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* 3b) „Egy ingatlan, 7 kész anyag" — IDEIGLENESEN KIVÉVE, amíg a
          bemutató-ingatlan valódi kimenetei elkészülnek (docs/showcase-anyagok.md).
          Visszatétel: <IngatlanShowcase /> a saját szekciójában. */}

      {/* ===================== 4) HITELESSÉG (SOCIAL PROOF) ===================== */}
      <section className="px-6 py-16 sm:py-20" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="mx-auto w-full max-w-3xl text-center">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: "var(--twx-on-dark)" }}>
              Élesben tesztelve, a mindennapi piacra szabva
            </h2>
            <p className="mt-5 text-lg leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>
              A TWINX alkalmazásokat a TWINX fejlesztői csapata és a{" "}
              <strong style={{ color: "var(--twx-on-dark)" }}>GDN Mandala iroda</strong> közösen hozta létre.
              Az appokat mi magunk is napi szinten használjuk az irodában, így minden funkció a valódi,
              magyar ingatlanpiaci igényekre és kihívásokra ad azonnali választ.
            </p>
            <div className="mt-8">
              <a href="/" className="inline-block rounded-xl px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/5"
                style={{ color: "var(--twx-on-dark)", border: "1px solid rgba(255,255,255,0.2)" }}>
                Nézd meg a teljes TWINX platformot →
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===================== 5) BŐVEBB TÁJÉKOZTATÁS (CTA) ===================== */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-20 text-center">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Szeretnél többet tudni a TWINX-ről?</h2>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
            Hagyd meg az elérhetőséged, és egy kollégánk felveszi veled a kapcsolatot — bővebben
            mesél a rendszerről, válaszol a kérdéseidre, és segít eldönteni, hogyan illeszthető
            a mindennapi munkádba.
          </p>
          <div className="mt-8">
            {/* Felugró ablak: elérhetőség → minden admin kap e-mailt (leads tábla). */}
            <IngatlanConsultButton
              className="rounded-xl px-7 py-4 text-base font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--twx-coral)", color: "#1c1005" }}
            >
              Bővebb tájékoztatást kérek
            </IngatlanConsultButton>
          </div>
        </Reveal>
      </section>

      {/* ===================== 6) ZÁRÓ ŰRLAP (LEAD) ===================== */}
      <section className="px-6 py-16 sm:py-24" style={{ background: "var(--twx-dark)" }}>
        <div className="mx-auto w-full max-w-2xl">
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: "var(--twx-on-dark)" }}>
              Kérem az ajándékkódot
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>
              Töltsd ki az űrlapot, és ha beleférsz az első 50-be, e-mailben küldjük az
              ajándékkódot, amit regisztráció után, belépve válthatsz be 10 kreditre.
              A jelentkezés ingyenes, és semmire nem kötelez.
            </p>
          </div>
          <div className="mt-8">
            <IngatlanLeadForm />
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-sm" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark-muted)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <a href="/" aria-label="TWINX főoldal">
          <Wordmark className="font-display text-xl font-semibold" style={{ color: "var(--twx-on-dark)" }} />
        </a>
        <p className="mt-2">TWINX Portál · twinx.hu</p>
        <a href="/" className="mt-3 inline-block rounded-full px-4 py-2 text-xs font-medium transition-colors hover:bg-white/5"
          style={{ color: "var(--twx-on-dark)", border: "1px solid rgba(255,255,255,0.18)" }}>
          Vissza a főoldalra →
        </a>
      </footer>
      <IngatlanConsultModal />
    </main>
  );
}
