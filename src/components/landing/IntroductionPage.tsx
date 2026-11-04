// A kétnyelvű LinkedIn-bemutatkozó oldal közös tartalma: /bemutatkozas (magyar) és /bemutatkozas/en (angol).
// Sorrend (Márk kérése): rövid bemutatkozás → közös fejlesztés → Prémium 3D (a modul saját bemutatója, mint a Portálban) →
// egyedi modulok (az /egyedi-modul felső része) → most elérhető szolgáltatások → „Nézd meg működés közben" (mint a /ingatlan oldalon) →
// magyarul 10 kredites regisztráció + kapcsolat; angolul csak kapcsolat (a Portál magyar nyelvű, ezért ott nincs regisztrációs ajánlat).
// Görgetéskor sötét és világos váltja egymást; az egymás melletti sötét blokkok (3D, egyedi modul) saját keretet kapnak.
import Image from "next/image";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ModuleIcon from "@/components/ModuleIcon";
import AuthModal from "@/components/AuthModal";
import AuthTrigger from "@/components/AuthTrigger";
import Reveal from "@/components/motion/Reveal";
import HeroShowcase from "@/components/landing/HeroShowcase";
import HtmlLang from "@/components/landing/HtmlLang";
import ShowcaseFrame, { ShowcaseBackdrop } from "@/components/landing/ShowcaseFrame";
import PremiumTourEmbed from "@/components/landing/PremiumTourEmbed";
import AiSystemAnim from "@/components/landing/AiSystemAnim";
import ModuleIdeaButton from "@/components/landing/ModuleIdeaButton";
import CustomModuleHero from "@/components/custom-module/CustomModuleHero";
import B2BModal from "@/components/B2BModal";
import ContactForm from "@/components/contact/ContactForm";
import CookieSettingsLink from "@/components/analytics/CookieSettingsLink";
import { CONTACT_EMAIL } from "@/lib/contact";
import { ENGLISH_PATH, type Lang } from "@/lib/lang";
import { SHOWCASE, SHOWCASE_EN } from "@/lib/landing";
import { LANDING_WELCOME_CREDITS, LINKEDIN_SIGNUP_SOURCE } from "@/lib/onboarding";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";
import { loadStyleSheet } from "@/lib/floorplan3d/stylesheet";

const COPY = {
  hu: {
    home: "TWINX főoldal", langAria: "Nyelv", portraitAlt: "Kovács Márk portréja",
    name: "Kovács Márk", role: "AI-integrációs fejlesztő",
    tagline: "Egyedi AI-eszközök, automatizálás és generatív tartalom cégeknek",
    company: "Twinx.hu társalapító és kreatív média tartalomgyártó",
    bio: "Segítek a cégeknek és csapatoknak az AI-alapú működésre való átállásban – a belső folyamatok automatizálásától a skálázható marketing- és tartalomrendszerekig. Legyen szó a saját termékemről vagy egy csapat mindennapi munkájáról, a célom ugyanaz: az ismétlődő kézi munkából gyorsan működő folyamat legyen.",
    partnerAsk: "Szakmai partnereket keresek közös AI-modulok fejlesztéséhez.", partnerBtn: "Fejlesszünk együtt →",
    now: "Min dolgozom most?", customBtn: "Egyedi modul a cégednek",
    collabTitle: "Fejlesszünk együtt egy AI-modult",
    collabText: "Nem ügyfeleket keresek, hanem szakembereket, akik jól ismerik a saját területüket. Te hozod a szakmai hátteret, én a technikai hátteret és a fejlesztést, és közösen dolgozunk ki egy modult.",
    ideaBtn: "Küldd el az ötleted →", talkBtn: "Keress meg, beszéljünk",
    you: "Te", youText: "Szakmai tudás és a valós feladatok", me: "Én", meText: "Technikai háttér és AI-fejlesztés", both: "Közösen", bothText: "Egy működő AI-modul",
    premium: "✦ Prémium 3D · Fejlesztés alatt",
    servicesTitle: "Most elérhető szolgáltatások",
    servicesText: "Egy platform, több célalkalmazás — mindegyik a mindennapi ingatlanos munkára szabva.",
    partnerNote: "Ezeket a GDN Mandala Irodával együtt fejlesztettük.",
    apps: [
      { icon: "valuation", title: "Értékbecslő", desc: "Valós piaci adatokon alapuló, azonnali értékbecslés korrekciókkal (eladási, kínálati és gyorsár). Kiváló árazáshoz és ügyfélszerző kampányokhoz." },
      { icon: "visualization", title: "Képjavító", desc: "Rendetlenség eltüntetése és képminőség-javítás egyetlen kattintással — a vonzóbb hirdetésekért." },
      { icon: "flyer", title: "Hirdetési kép készítő", desc: "Profi, figyelemfelkeltő összefoglaló képek a közösségi média felületekre, posztolásra készen." },
      { icon: "video", title: "Videó generálás", desc: "Hangulatos ingatlanbemutató videók pár kattintással — a maximális online elérésért." },
      { icon: "visualization", title: "Látványtervező", desc: "Virtuális felújítás és berendezés. Mutasd meg a vevőknek az ingatlanban rejlő potenciált, az ő stílusukra szabva." },
      { icon: "history", title: "Szöveg ellenőrzés", desc: "Hirdetési szövegek automatikus lektorálása és optimalizálása a legjobb konverzió érdekében." },
      { icon: "flyer", title: "Hirdetési szöveg generátor", desc: "Azonnal posztolható Facebook, Instagram és Google hirdetésszövegek az ingatlan adatai alapján." },
    ],
    card3dTitle: "✦ Prémium 3D", card3dText: "Alaprajzból bejárható lakás — fejlesztés alatt.", card3dLink: "Megnézem ↑",
    showTitle: "Nézd meg működés közben", showText: "Valódi munkák: telefonfotóból hirdetési fotó, adatokból értékbecslés, képekből zenés videó —", showEnd: "percek alatt.",
    call: "Inkább hívnál? Kovács Márk · ", terms: "ÁSZF", cookies: "Süti-beállítások",
  },
  en: {
    home: "TWINX home page", langAria: "Language", portraitAlt: "Portrait of Márk Kovács",
    name: "Márk Kovács", role: "AI Integration Developer",
    tagline: "Custom AI tools, automation and generative content for businesses",
    company: "Co-founder of Twinx.hu and creative media producer",
    bio: "I help companies and teams move to AI-driven ways of working, from automating internal processes to scalable marketing and content systems. Whether it's my own product or a team's day-to-day work, my goal is the same: to turn repetitive manual work into a fast, working process.",
    partnerAsk: "I'm looking for professional partners to build AI modules together.", partnerBtn: "Let's build together →",
    now: "What am I working on?", customBtn: "A custom module for your company",
    collabTitle: "Let's build an AI module together",
    collabText: "I'm not looking for clients, but for professionals who know their field inside out. You bring the domain expertise, I bring the technical background and the development, and we shape a module together.",
    ideaBtn: "Send me your idea →", talkBtn: "Get in touch",
    you: "You", youText: "Domain expertise and the real-world tasks", me: "Me", meText: "Technical background and AI development", both: "Together", bothText: "A working AI module",
    premium: "✦ Premium 3D · In development",
    servicesTitle: "Services available now",
    servicesText: "One platform, several purpose-built applications, each made for everyday real estate work.",
    partnerNote: "We built these together with the GDN Mandala office.",
    apps: [
      { icon: "valuation", title: "Property valuation", desc: "Instant valuation based on real market data, with adjustments (sale, asking and quick-sale price). Great for pricing and client-acquisition campaigns." },
      { icon: "visualization", title: "Image enhancer", desc: "Remove clutter and improve image quality with one click, for more attractive listings." },
      { icon: "flyer", title: "Ad image maker", desc: "Professional, eye-catching summary images for social media, ready to post." },
      { icon: "video", title: "Video generator", desc: "Atmospheric property videos in a few clicks, for maximum online reach." },
      { icon: "visualization", title: "Interior visualiser", desc: "Virtual renovation and furnishing. Show buyers a property's potential, tailored to their style." },
      { icon: "history", title: "Text checker", desc: "Automatic proofreading and optimisation of listing texts for the best conversion." },
      { icon: "flyer", title: "Ad copy generator", desc: "Ready-to-post Facebook, Instagram and Google ad copy from the property details." },
    ],
    card3dTitle: "✦ Premium 3D", card3dText: "A walkable flat from a floor plan, in development.", card3dLink: "Take a look ↑",
    showTitle: "See it in action", showText: "Real work: from a phone photo to a listing photo, from data to a valuation, from images to a video with music,", showEnd: "in minutes.",
    call: "", terms: "Terms (in Hungarian)", cookies: "Cookie settings",
  },
};

export default async function IntroductionPage({ lang }: { lang: Lang }) {
  const tx = COPY[lang];
  const en = lang === "en";
  const cfg = floorplan3dConfig();
  const style = await loadStyleSheet("japandi");

  return (
    <main className="font-sans" style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }} lang={lang}>
      <HtmlLang lang={lang} />
      {/* ============ 1) RÖVID BEMUTATKOZÁS (a LinkedIn-profil címével egyezően) ============ */}
      <section className="relative overflow-hidden" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="pointer-events-none absolute -top-40 right-[-10%] h-[760px] w-[760px] rounded-full" aria-hidden
          style={{ background: "radial-gradient(circle, rgba(239,122,90,.2), rgba(239,122,90,0) 66%)" }} />
        <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
          <nav className="flex items-center justify-between pt-6">
            <Link href="/" aria-label={tx.home}><Wordmark className="font-display text-2xl font-bold" /></Link>
            {/* Nyelvváltó: fix méretű, két egyforma gomb */}
            <div className="flex rounded-full p-1" role="group" aria-label={tx.langAria} style={{ background: "rgba(244,239,231,.1)" }}>
              {([["hu", "HU", "/bemutatkozas"], ["en", "EN", ENGLISH_PATH]] as const).map(([code, label, href]) => (
                <Link key={code} href={href} hrefLang={code} aria-current={code === lang ? "page" : undefined}
                  className="flex h-9 w-11 items-center justify-center rounded-full text-[13px] font-bold transition-colors"
                  style={code === lang ? { background: "var(--twx-coral)", color: "#1c1005" } : { color: "var(--twx-on-dark)" }}>
                  {label}
                </Link>
              ))}
            </div>
          </nav>
          <div className="grid grid-cols-1 items-center gap-10 pb-12 pt-10 lg:grid-cols-[1fr_1.06fr] lg:gap-14 lg:pb-20 lg:pt-12">
            <div>
              <div className="flex items-center gap-4 sm:gap-6">
                {/* CV-jellegű portré: fehér kör, a kivágott alak a körön belül — fej, törzs és karok is látszanak (mint a LinkedIn-képen) */}
                <div className="relative h-[116px] w-[116px] flex-none overflow-hidden rounded-full sm:h-[176px] sm:w-[176px]"
                  style={{ background: "#fdfbf6", boxShadow: "0 0 0 4px #fff, 0 16px 40px rgba(0,0,0,.45)" }}>
                  <Image src="/kovacs-mark/assets/portre.png" alt={tx.portraitAlt} width={668} height={1040} priority
                    className="absolute max-w-none" style={{ width: "76%", height: "auto", left: "16%", top: "-18%" }} />
                </div>
                <div className="min-w-0">
                  <h1 className="font-display text-[34px] font-extrabold leading-[1.05] sm:text-6xl">{tx.name}</h1>
                  <p className="mt-2 font-display text-[19px] font-bold leading-tight sm:text-3xl" style={{ color: "var(--twx-coral)" }}>{tx.role}</p>
                </div>
              </div>
              <p className="mt-6 text-lg font-semibold leading-snug sm:text-xl">{tx.tagline}</p>
              <p className="mt-1.5 text-[15px] sm:text-base" style={{ color: "var(--twx-on-dark-muted)" }}>{tx.company}</p>
              <p className="mt-5 max-w-2xl text-[15.5px] leading-relaxed sm:text-[17px]" style={{ color: "#d9d1c6" }}>{tx.bio}</p>
              {/* Kiemelt üzenet: egy ismeretlennek küldött megkeresés fő kérése a közös fejlesztés */}
              <div className="mt-6 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                style={{ background: "rgba(239,122,90,.13)", boxShadow: "inset 0 0 0 1.5px rgba(239,122,90,.75)" }}>
                <p className="font-display text-[16.5px] font-bold leading-snug">{tx.partnerAsk}</p>
                <a href="#kozos-fejlesztes" className="inline-flex h-12 flex-none items-center justify-center rounded-full px-6 text-[15px] font-extrabold transition-opacity hover:opacity-90"
                  style={{ background: "var(--twx-coral)", color: "#1c1005", boxShadow: "0 10px 28px rgba(239,122,90,.4)" }}>
                  {tx.partnerBtn}
                </a>
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href="#premium-3d" className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold" style={{ boxShadow: "inset 0 0 0 1.5px rgba(244,239,231,.32)" }}>
                  {tx.now}
                </a>
                <a href="#egyedi-modul" className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold" style={{ boxShadow: "inset 0 0 0 1.5px rgba(244,239,231,.32)" }}>
                  {tx.customBtn}
                </a>
              </div>
            </div>
            <AiSystemAnim lang={lang} />
          </div>
        </div>
      </section>

      {/* ============ KÖZÖS FEJLESZTÉS — szakemberekkel közösen kidolgozott modulok (nem ügyfélszerzés) ============ */}
      <section id="kozos-fejlesztes" className="scroll-mt-4 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-6 rounded-3xl p-6 sm:p-9 lg:grid-cols-[1fr_1.1fr] lg:gap-10"
          style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
          <div>
            <h2 className="font-display text-3xl font-extrabold leading-tight sm:text-4xl">{tx.collabTitle}</h2>
            <p className="mt-3 text-[15.5px] leading-relaxed sm:text-[17px]" style={{ color: "var(--twx-ink-muted)" }}>{tx.collabText}</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ModuleIdeaButton lang={lang} className="inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] font-bold text-white" style={{ background: "#c4553a" }}>
                {tx.ideaBtn}
              </ModuleIdeaButton>
              <a href="#kapcsolat" className="inline-flex h-12 items-center justify-center rounded-full px-6 text-[15px] font-bold" style={{ boxShadow: "inset 0 0 0 1.5px var(--twx-ink)" }}>
                {tx.talkBtn}
              </a>
            </div>
          </div>
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
            <div className="rounded-2xl p-4" style={{ background: "#fff", boxShadow: "inset 0 0 0 1px var(--twx-line)" }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#c4553a" }}>{tx.you}</p>
              <p className="mt-1 font-display text-[15px] font-bold leading-snug">{tx.youText}</p>
            </div>
            <span aria-hidden className="text-center text-xl font-bold" style={{ color: "#c4553a" }}>+</span>
            <div className="rounded-2xl p-4" style={{ background: "#fff", boxShadow: "inset 0 0 0 1px var(--twx-line)" }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#c4553a" }}>{tx.me}</p>
              <p className="mt-1 font-display text-[15px] font-bold leading-snug">{tx.meText}</p>
            </div>
            <span aria-hidden className="text-center text-xl font-bold" style={{ color: "#c4553a" }}>=</span>
            <div className="rounded-2xl p-4" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--twx-coral)" }}>{tx.both}</p>
              <p className="mt-1 font-display text-[15px] font-bold leading-snug">{tx.bothText}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ 2) PRÉMIUM 3D — a modul saját bemutatója ============ */}
      <section id="premium-3d" className="scroll-mt-4 px-4 pb-8 pt-14 sm:px-6 sm:pb-10 sm:pt-20" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em]"
              style={{ background: "linear-gradient(135deg,#F3D9A4,#D4AA5C)", color: "#2a1d0e" }}>
              {tx.premium}
            </span>
          </Reveal>
          <div className="mt-4 rounded-[28px]" style={{ boxShadow: "0 0 0 1.5px rgba(212,170,92,.6)" }}>
            <PremiumTourEmbed
              lang={lang}
              opts={{ interiorWall: cfg.interiorWallThickness, exteriorWall: cfg.exteriorWallThickness }}
              style={"sheet" in style ? style.sheet : null}
            />
          </div>
        </div>
      </section>

      {/* ============ 3) EGYEDI MODULOK — az /egyedi-modul oldal felső része ============ */}
      <div id="egyedi-modul" className="scroll-mt-4 px-4 pb-14 sm:px-6 sm:pb-20" style={{ background: "var(--twx-dark)" }}>
        <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-[28px]" style={{ boxShadow: "0 0 0 1.5px rgba(239,122,90,.6)" }}>
          {/* az igénylő ablak és az /egyedi-modul oldal magyar, ezért angolul a gomb a lenti kapcsolati űrlapra visz */}
          <CustomModuleHero hideNav heading="h2" processHref="/egyedi-modul#folyamat" lang={lang} requestHref={en ? "#kapcsolat" : undefined} />
        </div>
      </div>

      {/* ============ 4) MOST ELÉRHETŐ SZOLGÁLTATÁSOK (világos) ============ */}
      <section id="szolgaltatasok" className="scroll-mt-4 px-4 py-14 sm:px-6 sm:py-20" style={{ background: "var(--twx-cream-card)" }}>
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">{tx.servicesTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm sm:text-base" style={{ color: "var(--twx-ink-muted)" }}>{tx.servicesText}</p>
            <p className="mt-4 inline-flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-[15px] font-semibold" style={{ background: "var(--twx-coral-soft)", color: "#5e2412" }}>
              <span aria-hidden>🤝</span> {tx.partnerNote}
            </p>
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {tx.apps.map((a, i) => (
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
            {/* A 8. hely: ami még készül (nem üres a rács) */}
            <Reveal delay={tx.apps.length * 0.04}>
              <a href="#premium-3d" className="flex h-full flex-col justify-between gap-2 rounded-xl p-4 transition-opacity hover:opacity-90"
                style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
                <h3 className="font-display text-[15px] font-semibold leading-tight">{tx.card3dTitle}</h3>
                <p className="text-[13px] leading-snug" style={{ color: "var(--twx-on-dark-muted)" }}>{tx.card3dText}</p>
                <span className="text-[13px] font-semibold" style={{ color: "var(--twx-coral)" }}>{tx.card3dLink}</span>
              </a>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ 5) NÉZD MEG MŰKÖDÉS KÖZBEN (sötét) ============ */}
      <section className="relative overflow-hidden" style={{ background: "var(--twx-dark-2)", color: "var(--twx-on-dark)" }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden
          style={{ background: "radial-gradient(60% 60% at 50% 0%, rgba(239,122,90,0.16), transparent 70%)" }} />
        <ShowcaseBackdrop lang={lang} />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16">
          <Reveal>
            <h2 className="font-display mx-auto max-w-2xl text-center text-3xl font-medium sm:text-4xl">{tx.showTitle}</h2>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
              {tx.showText}{" "}
              <span className="whitespace-nowrap">{tx.showEnd}</span>
            </p>
          </Reveal>
          <div className="mt-12">
            <Reveal delay={0.1}>
              <ShowcaseFrame>
                <HeroShowcase slides={en ? SHOWCASE_EN : SHOWCASE} lang={lang} />
              </ShowcaseFrame>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ 6) REGISZTRÁCIÓ + KAPCSOLAT (világos); angolul regisztráció nélkül ============ */}
      <section id="kapcsolat" className="scroll-mt-4 px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="flex flex-col rounded-3xl p-7 sm:p-9" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
            {en ? (
              <>
                <h2 className="font-display text-3xl font-semibold sm:text-4xl">Let&apos;s talk</h2>
                <p className="mt-3 text-[15px]" style={{ color: "var(--twx-on-dark-muted)" }}>
                  Have an idea for a module, or need a custom tool for your company? Write to me using the form or by email.
                </p>
                <div className="mt-auto pt-8">
                  <a href={`mailto:${CONTACT_EMAIL}`} className="block break-all rounded-2xl px-5 py-4 font-display text-xl font-bold transition-opacity hover:opacity-90 sm:text-2xl"
                    style={{ background: "rgba(239,122,90,.13)", boxShadow: "inset 0 0 0 1.5px rgba(239,122,90,.75)", color: "var(--twx-coral)" }}>
                    {CONTACT_EMAIL}
                  </a>
                  <a href="https://twinx.hu" className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-[15px] font-extrabold transition-opacity hover:opacity-90 sm:w-auto"
                    style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                    Visit twinx.hu →
                  </a>
                </div>
                <p className="mt-4 text-xs" style={{ color: "var(--twx-on-dark-muted)" }}>
                  The TWINX portal itself is currently available in Hungarian.
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
            {!en && (
              <a href="tel:+36205630561" className="mt-6 text-sm font-semibold" style={{ color: "var(--twx-on-dark)" }}>
                {tx.call}<span className="whitespace-nowrap">+36 20 563 0561</span>
              </a>
            )}
          </div>
          <ContactForm lang={lang} />
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-sm" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark-muted)" }}>
        <Link href="/" aria-label={tx.home}><Wordmark className="font-display text-xl font-semibold" style={{ color: "var(--twx-on-dark)" }} /></Link>
        <div className="mt-3 flex justify-center gap-4">
          <Link href="/aszf" className="text-xs underline-offset-2 hover:underline" style={{ color: "var(--twx-on-dark-muted)" }}>{tx.terms}</Link>
          <CookieSettingsLink label={tx.cookies} className="text-xs underline-offset-2 hover:underline" style={{ color: "var(--twx-on-dark-muted)" }} />
        </div>
      </footer>
      {!en && <AuthModal />}
      {!en && <B2BModal />}
    </main>
  );
}
