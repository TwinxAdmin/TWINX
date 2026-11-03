// twinx.hu/bemutatkozas — LÁTVÁNYTERV (helyi előnézet): a LinkedIn-üzenetekben kiküldhető landing. Nincs élesítve.
// Sorrend (Márk kérése): rövid bemutatkozás → közös fejlesztés → Prémium 3D (a modul saját bemutatója, mint a Portálban) →
// egyedi modulok (az /egyedi-modul felső része) → most elérhető szolgáltatások („Nézd meg működés közben" + alkalmazások, mint a /ingatlan oldalon) →
// 10 kredites regisztráció + kapcsolatfelvétel.
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ModuleIcon from "@/components/ModuleIcon";
import AuthModal from "@/components/AuthModal";
import AuthTrigger from "@/components/AuthTrigger";
import Reveal from "@/components/motion/Reveal";
import HeroShowcase from "@/components/landing/HeroShowcase";
import ShowcaseFrame, { ShowcaseBackdrop } from "@/components/landing/ShowcaseFrame";
import PremiumTourEmbed from "@/components/landing/PremiumTourEmbed";
import AiSystemAnim from "@/components/landing/AiSystemAnim";
import CustomModuleHero from "@/components/custom-module/CustomModuleHero";
import B2BModal from "@/components/B2BModal";
import ContactForm from "@/components/contact/ContactForm";
import CookieSettingsLink from "@/components/analytics/CookieSettingsLink";
import { SHOWCASE } from "@/lib/landing";
import { LANDING_WELCOME_CREDITS, LINKEDIN_SIGNUP_SOURCE } from "@/lib/onboarding";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";
import { loadStyleSheet } from "@/lib/floorplan3d/stylesheet";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Kovács Márk — AI-integrációs fejlesztő | TWINX",
  description: "Egyedi AI-eszközök, automatizálás és generatív tartalom cégeknek. Twinx.hu társalapító és kreatív média tartalomgyártó.",
  robots: { index: false, follow: false },
};

// A /ingatlan oldal listája (változatlan szöveggel).
const APPS: { icon: string; title: string; desc: string }[] = [
  { icon: "valuation", title: "Értékbecslő", desc: "Valós piaci adatokon alapuló, azonnali értékbecslés korrekciókkal (eladási, kínálati és gyorsár). Kiváló árazáshoz és ügyfélszerző kampányokhoz." },
  { icon: "visualization", title: "Képjavító", desc: "Rendetlenség eltüntetése és képminőség-javítás egyetlen kattintással — a vonzóbb hirdetésekért." },
  { icon: "flyer", title: "Hirdetési kép készítő", desc: "Profi, figyelemfelkeltő összefoglaló képek a közösségi média felületekre, posztolásra készen." },
  { icon: "video", title: "Videó generálás", desc: "Hangulatos ingatlanbemutató videók pár kattintással — a maximális online elérésért." },
  { icon: "visualization", title: "Látványtervező", desc: "Virtuális felújítás és berendezés. Mutasd meg a vevőknek az ingatlanban rejlő potenciált, az ő stílusukra szabva." },
  { icon: "history", title: "Szöveg ellenőrzés", desc: "Hirdetési szövegek automatikus lektorálása és optimalizálása a legjobb konverzió érdekében." },
  { icon: "flyer", title: "Hirdetési szöveg generátor", desc: "Azonnal posztolható Facebook, Instagram és Google hirdetésszövegek az ingatlan adatai alapján." },
];

export default async function BemutatkozasPage() {
  const cfg = floorplan3dConfig();
  const style = await loadStyleSheet("japandi");

  return (
    <main className="font-sans" style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }}>
      <p className="px-4 py-2 text-center text-xs font-semibold" style={{ background: "#2a221b", color: "#f3d9a4" }}>
        LÁTVÁNYTERV · helyi előnézet, nincs élesítve
      </p>

      {/* ============ 1) RÖVID BEMUTATKOZÁS (a LinkedIn-profil címével egyezően) ============ */}
      <section className="relative overflow-hidden" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="pointer-events-none absolute -top-40 right-[-10%] h-[760px] w-[760px] rounded-full" aria-hidden
          style={{ background: "radial-gradient(circle, rgba(239,122,90,.2), rgba(239,122,90,0) 66%)" }} />
        <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
          <nav className="flex items-center justify-between pt-6">
            <Link href="/" aria-label="TWINX főoldal"><Wordmark className="font-display text-2xl font-bold" /></Link>
          </nav>
          <div className="grid grid-cols-1 items-center gap-10 pb-12 pt-10 lg:grid-cols-[1fr_1.06fr] lg:gap-14 lg:pb-20 lg:pt-12">
            <div>
              <div className="flex items-center gap-4 sm:gap-6">
                {/* CV-jellegű portré: fehér kör, a kivágott alak a körön belül — fej, törzs és karok is látszanak (mint a LinkedIn-képen) */}
                <div className="relative h-[116px] w-[116px] flex-none overflow-hidden rounded-full sm:h-[176px] sm:w-[176px]"
                  style={{ background: "#fdfbf6", boxShadow: "0 0 0 4px #fff, 0 16px 40px rgba(0,0,0,.45)" }}>
                  <Image src="/kovacs-mark/assets/portre.png" alt="Kovács Márk portréja" width={668} height={1040} priority
                    className="absolute max-w-none" style={{ width: "76%", height: "auto", left: "16%", top: "-18%" }} />
                </div>
                <div className="min-w-0">
                  <h1 className="font-display text-[34px] font-extrabold leading-[1.05] sm:text-6xl">Kovács Márk</h1>
                  <p className="mt-2 font-display text-[19px] font-bold leading-tight sm:text-3xl" style={{ color: "var(--twx-coral)" }}>AI-integrációs fejlesztő</p>
                </div>
              </div>
              <p className="mt-6 text-lg font-semibold leading-snug sm:text-xl">Egyedi AI-eszközök, automatizálás és generatív tartalom cégeknek</p>
              <p className="mt-1.5 text-[15px] sm:text-base" style={{ color: "var(--twx-on-dark-muted)" }}>Twinx.hu társalapító és kreatív média tartalomgyártó</p>
              <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed sm:text-[17px]" style={{ color: "#d9d1c6" }}>
                Segítek a cégeknek és csapatoknak az AI-alapú működésre való átállásban – a belső folyamatok automatizálásától a skálázható marketing- és tartalomrendszerekig. Legyen szó a saját termékemről vagy egy csapat mindennapi munkájáról, a célom ugyanaz: az ismétlődő kézi munkából gyorsan működő folyamat legyen.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href="#egyedi-modul" className="inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] font-bold text-white" style={{ background: "#c4553a" }}>
                  Egyedi modul a cégednek →
                </a>
                <a href="#premium-3d" className="inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] font-bold" style={{ boxShadow: "inset 0 0 0 1.5px rgba(244,239,231,.32)" }}>
                  Min dolgozom most?
                </a>
                <a href="#kozos-fejlesztes" className="inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] font-bold" style={{ boxShadow: "inset 0 0 0 1.5px rgba(244,239,231,.32)" }}>
                  Fejlesszünk együtt
                </a>
              </div>
            </div>
            <AiSystemAnim />
          </div>
        </div>
      </section>

      {/* ============ KÖZÖS FEJLESZTÉS — szakemberekkel közösen kidolgozott modulok (nem ügyfélszerzés) ============ */}
      <section id="kozos-fejlesztes" className="scroll-mt-4 px-4 pt-14 sm:px-6 sm:pt-20">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-6 rounded-3xl p-6 sm:p-9 lg:grid-cols-[1fr_1.1fr] lg:gap-10"
          style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
          <div>
            <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">Fejlesszünk együtt egy AI-modult</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed sm:text-[17px]" style={{ color: "var(--twx-ink-muted)" }}>
              Nem ügyfeleket keresek, hanem szakembereket, akik jól ismerik a saját területüket. Te hozod a szakmai hátteret, én a technikai hátteret és a fejlesztést, és közösen dolgozunk ki egy modult.
            </p>
            <a href="#kapcsolat" className="mt-5 inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] font-bold text-white" style={{ background: "var(--twx-dark)" }}>
              Keress meg, beszéljünk →
            </a>
          </div>
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
            <div className="rounded-2xl p-4" style={{ background: "#fff", boxShadow: "inset 0 0 0 1px var(--twx-line)" }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#c4553a" }}>Te</p>
              <p className="mt-1 font-display text-[15px] font-bold leading-snug">Szakmai tudás és a valós feladatok</p>
            </div>
            <span aria-hidden className="text-center text-xl font-bold" style={{ color: "#c4553a" }}>+</span>
            <div className="rounded-2xl p-4" style={{ background: "#fff", boxShadow: "inset 0 0 0 1px var(--twx-line)" }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#c4553a" }}>Én</p>
              <p className="mt-1 font-display text-[15px] font-bold leading-snug">Technikai háttér és AI-fejlesztés</p>
            </div>
            <span aria-hidden className="text-center text-xl font-bold" style={{ color: "#c4553a" }}>=</span>
            <div className="rounded-2xl p-4" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--twx-coral)" }}>Közösen</p>
              <p className="mt-1 font-display text-[15px] font-bold leading-snug">Egy működő AI-modul</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 2) PRÉMIUM 3D — a modul saját bemutatója ============ */}
      <section id="premium-3d" className="scroll-mt-4 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em]"
              style={{ background: "linear-gradient(135deg,#F3D9A4,#D4AA5C)", color: "#2a1d0e" }}>
              ✦ Prémium 3D · Fejlesztés alatt
            </span>
          </Reveal>
          <div className="mt-4">
            <PremiumTourEmbed
              opts={{ interiorWall: cfg.interiorWallThickness, exteriorWall: cfg.exteriorWallThickness }}
              style={"sheet" in style ? style.sheet : null}
            />
          </div>
        </div>
      </section>

      {/* ============ 3) EGYEDI MODULOK — az /egyedi-modul oldal felső része ============ */}
      <div id="egyedi-modul" className="scroll-mt-4">
        <CustomModuleHero hideNav heading="h2" processHref="/egyedi-modul#folyamat" />
      </div>

      {/* ============ 4) MOST ELÉRHETŐ SZOLGÁLTATÁSOK ============ */}
      <section id="szolgaltatasok" className="relative scroll-mt-4 overflow-hidden" style={{ background: "var(--twx-dark-2)", color: "var(--twx-on-dark)" }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden
          style={{ background: "radial-gradient(60% 60% at 50% 0%, rgba(239,122,90,0.16), transparent 70%)" }} />
        <ShowcaseBackdrop />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16">
          <Reveal>
            <h2 className="font-display mx-auto max-w-2xl text-center text-3xl font-medium sm:text-4xl">Nézd meg működés közben</h2>
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

      <section className="px-4 py-12 sm:px-6 sm:py-14" style={{ background: "var(--twx-cream-card)" }}>
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">Most elérhető szolgáltatások</h2>
            <p className="mt-2 max-w-2xl text-sm sm:text-base" style={{ color: "var(--twx-ink-muted)" }}>
              Egy platform, több célalkalmazás — mindegyik a mindennapi ingatlanos munkára szabva.
            </p>
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {APPS.map((a, i) => (
              <Reveal key={a.title} delay={i * 0.04}>
                <div className="h-full rounded-xl p-4" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--twx-coral-soft)", color: "var(--twx-ink)" }}>
                      <ModuleIcon name={a.icon} className="h-4 w-4" />
                    </div>
                    <h3 className="font-display text-[15px] font-semibold leading-tight">{a.title}</h3>
                  </div>
                  <p className="mt-2 text-[13px] leading-snug" style={{ color: "var(--twx-ink-muted)" }}>{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ 5) REGISZTRÁCIÓ + KAPCSOLAT ============ */}
      <section id="kapcsolat" className="scroll-mt-4 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="flex flex-col rounded-3xl p-7 sm:p-9" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">Regisztrálj, és azonnal {LANDING_WELCOME_CREDITS} kredittel kezdesz</h2>
            <p className="mt-3 text-[15px]" style={{ color: "var(--twx-on-dark-muted)" }}>
              Próbáld ki a saját hirdetéseiden. Nincs havidíj, és a megvásárolt kredit nem jár le.
            </p>
            <div className="mt-auto pt-8">
              <AuthTrigger mode="register" source={LINKEDIN_SIGNUP_SOURCE}
                className="w-full rounded-xl px-8 py-4 text-base font-semibold transition-opacity hover:opacity-90 sm:w-auto"
                style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                Regisztrálok — {LANDING_WELCOME_CREDITS} kredit ajándékba
              </AuthTrigger>
            </div>
            <a href="tel:+36205630561" className="mt-6 text-sm font-semibold" style={{ color: "var(--twx-on-dark)" }}>
              Inkább hívnál? Kovács Márk · <span className="whitespace-nowrap">+36 20 563 0561</span>
            </a>
          </div>
          <ContactForm />
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-sm" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark-muted)" }}>
        <Link href="/" aria-label="TWINX főoldal"><Wordmark className="font-display text-xl font-semibold" style={{ color: "var(--twx-on-dark)" }} /></Link>
        <div className="mt-3 flex justify-center gap-4">
          <Link href="/aszf" className="text-xs underline-offset-2 hover:underline" style={{ color: "var(--twx-on-dark-muted)" }}>ÁSZF</Link>
          <CookieSettingsLink className="text-xs underline-offset-2 hover:underline" style={{ color: "var(--twx-on-dark-muted)" }} />
        </div>
      </footer>
      <AuthModal />
      <B2BModal />
    </main>
  );
}
