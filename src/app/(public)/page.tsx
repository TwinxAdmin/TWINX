// twinx.hu — Főoldal. Sötét, cinematic hero → sötét modul-forgó → világos szakaszok.
//
// ÜZENET: iparág-semleges. Nem a technológiáról beszélünk, hanem arról, amit a
// partner kap: betesz valamit, kattint, kész anyagot tölt le. Az ingatlan és a
// vendéglátás példa, nem ígéret. A szövegek és számok forrása: lib/landing.ts.
//
// A korábbi változat: src/app/(public)/_backup/page.landing-v1.tsx.txt
// és a `landing-v1-2026-09-11` git-tag.
import B2BForm from "@/components/B2BForm";
import IdeaForm from "@/components/IdeaForm";
import AuthModal from "@/components/AuthModal";
import AuthTrigger from "@/components/AuthTrigger";
import PricingModal from "@/components/PricingModal";
import PricingTrigger from "@/components/PricingTrigger";
import Wordmark from "@/components/Wordmark";
import HeroVideo from "@/components/HeroVideo";
import Reveal from "@/components/motion/Reveal";
import TrustBar from "@/components/landing/TrustBar";
import HeroShowcase from "@/components/landing/HeroShowcase";
import { getApprovedIdeas } from "@/lib/ideas";
import ShowcaseFrame, { ShowcaseBackdrop } from "@/components/landing/ShowcaseFrame";
import { HERO, TRUST, SHOWCASE, STEPS, PRICING_SENTENCE, CREDIT_COSTS } from "@/lib/landing";
import { CREDIT_PACKAGES } from "@/lib/packages";
import { formatHuf } from "@/lib/billing";

export const runtime = "nodejs";
// A főoldal futásidőben renderel (Supabase-ből tölti a jóváhagyott ötleteket),
// ezért NE prerendereljük build-időben — különben env nélkül elbukna a build.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const ideas = await getApprovedIdeas(30);

  return (
    <main className="font-sans" style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }}>
      {/* ===== HERO (sötét, cinematic) ===== */}
      <section
        className="relative flex min-h-[92vh] flex-col overflow-hidden"
        style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}
      >
        {/* ===== MÉDIA-SLOT =====
            Most: hero-bg.jpg + CSS Ken Burns (HeroVideo). KÉSŐBB két Higgsfield-loop
            jön ide: egy „nyugalmi" (alapból fut) és egy „belélegzés" (a fő gomb
            hover-jére vált át fél másodpercre). A csere a HeroVideo komponensben
            történik — az overlay, a gradiens és a vignetta változatlan marad. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden style={{ isolation: "isolate" }}>
          <HeroVideo />
          {/* Bronz overlay — meleg gradiens blend módban (twinx ráhangolás) */}
          <div
            className="absolute inset-0"
            style={{
              mixBlendMode: "overlay",
              opacity: 0.45,
              background: "linear-gradient(120deg, #ef7a5a 0%, #7a3a1e 45%, #12100e 100%)",
            }}
          />
        </div>

        {/* Sötét gradiens (fentről-lentről) a szöveg olvashatóságához */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(18,16,14,0.72) 0%, rgba(18,16,14,0.40) 38%, rgba(12,11,10,0.92) 100%)",
          }}
          aria-hidden
        />
        {/* Cinematic vignetta (sarkok elsötétítése) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(120% 85% at 22% 32%, transparent 42%, rgba(12,11,10,0.75) 100%)" }}
          aria-hidden
        />
        <div
          className="twx-orb pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(239,122,90,0.40), transparent 70%)", filter: "blur(34px)" }}
          aria-hidden
        />
        <div
          className="twx-orb-2 pointer-events-none absolute right-0 top-40 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(249,201,182,0.26), transparent 70%)", filter: "blur(44px)" }}
          aria-hidden
        />

        <nav className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-6">
          {/* Csak a márkanév — a szlogen a hero fejlécében van, itt összefolyt vele. */}
          <div className="flex min-w-0 items-baseline gap-2 leading-none">
            <Wordmark className="font-display text-3xl font-semibold" style={{ color: "var(--twx-on-dark)" }} />
            <span className="font-display text-xl font-medium sm:text-2xl" style={{ color: "var(--twx-on-dark-muted)" }} aria-hidden>–</span>
            <span className="font-display text-xl font-medium tracking-[0.08em] sm:text-2xl" style={{ color: "var(--twx-on-dark)" }}>
              APPSTORE
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
            <PricingTrigger className="hidden hover:text-white sm:inline">Csomagok</PricingTrigger>
            <a href="#egyedi" className="hidden hover:text-white md:inline">Egyedi fejlesztés</a>
            <AuthTrigger mode="login" className="hover:text-white">Belépés</AuthTrigger>
            <AuthTrigger
              mode="register"
              className="rounded-full px-4 py-2 text-sm font-medium"
              style={{ background: "var(--twx-coral)", color: "#1c1005" }}
            >
              Regisztráció
            </AuthTrigger>
          </div>
        </nav>

        {/* Két oszlop: balra a szöveg (a kép üres terébe), jobbra a kép beszél.
            Mobilon a jobb oszlop eltűnik, a szöveg a kép alsó részére kerül. */}
        <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-8 px-6 py-12 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:py-16">
          <div className="max-w-xl">
            <p
              className="twx-reveal font-display text-xs font-semibold uppercase sm:text-sm"
              style={{ color: "var(--twx-coral)", letterSpacing: "0.22em" }}
            >
              {HERO.eyebrow}
            </p>
            {/* Méret: a második sor („egy kattintásra.") ~8,8 em széles — a 4 rem-es
                felső korlát még belefér a bal oszlopba anélkül, hogy harmadik sorba törne. */}
            <h1
              className="twx-reveal mt-4 font-display font-semibold leading-[1.0] tracking-[-0.01em]"
              style={{ fontSize: "clamp(2.25rem, 6.4vw, 4rem)", color: "var(--twx-on-dark)", animationDelay: "0.08s" }}
            >
              {HERO.titleLine1}
              <br />
              {HERO.titleLine2}
            </h1>
            <p
              className="twx-reveal mt-6 max-w-lg text-base leading-relaxed sm:text-lg"
              style={{ color: "var(--twx-on-dark-muted)", animationDelay: "0.16s" }}
            >
              {HERO.lead}
            </p>
            <div className="twx-reveal mt-9 flex flex-col items-start gap-1.5" style={{ animationDelay: "0.24s" }}>
              <AuthTrigger
                mode="register"
                className="rounded-full px-7 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--twx-coral)", color: "#1c1005", boxShadow: "0 14px 34px rgba(239,122,90,0.35)" }}
              >
                {HERO.cta}
              </AuthTrigger>
              {/* Ajándék-kredit: keret nélkül, csak korall színnel és félkövérrel kiemelve */}
              <span className="pl-1 text-sm font-semibold" style={{ color: "var(--twx-coral)" }}>
                {HERO.ctaNote}
              </span>
            </div>
          </div>
          {/* Jobb oszlop: szándékosan üres — a hero-kép arca és a szövet ide esik. */}
          <div className="hidden md:block" aria-hidden />
        </div>

        {/* „Nézd meg működés közben" — a hero alján, középen, a régi görgetés-jelző helyén */}
        <a
          href="#mukodes"
          className="twx-bob group relative z-10 mx-auto mb-6 inline-flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.18em] transition-colors hover:text-white"
          style={{ color: "var(--twx-on-dark-muted)", animationDelay: "0.4s, 1.2s" }}
        >
          {HERO.secondary}
          <span aria-hidden className="text-base transition-transform group-hover:translate-y-0.5">↓</span>
        </a>

        {/* Bizalmi sáv */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-8">
          <div className="border-t pt-5" style={{ borderColor: "rgba(214,178,140,0.18)" }}>
            <TrustBar items={TRUST} />
          </div>
        </div>
      </section>

      {/* ===== MODUL-FORGÓ (sötét — a hero-ból folyik át) ===== */}
      <section id="mukodes" className="relative overflow-hidden" style={{ background: "var(--twx-dark-2)", color: "var(--twx-on-dark)" }}>
        {/* Halvány bronz derengés a kártya mögött, hogy ne legyen lapos a fekete */}
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

      {/* ===== ÍGY MŰKÖDIK (világos) ===== */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.25em]" style={{ color: "var(--twx-coral)" }}>
            Így működik
          </p>
          <h2 className="font-display mt-3 text-3xl font-medium sm:text-4xl">Három lépés, semmi tanulás.</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1} className="h-full">
              <div className="flex h-full gap-4 rounded-2xl p-6" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
                <span className="font-display text-5xl font-semibold leading-none" style={{ color: "var(--twx-coral)" }}>
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>{s.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== ÁRAZÁS (világos, halvány kártya) ===== */}
      <section id="arak" className="mx-auto max-w-6xl px-6 pb-20 sm:pb-24">
        <Reveal>
          <div className="rounded-3xl p-7 sm:p-10" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
            <p className="text-xs font-medium uppercase tracking-[0.25em]" style={{ color: "var(--twx-coral)" }}>
              Árak
            </p>
            <h2 className="font-display mt-3 max-w-2xl text-3xl font-medium sm:text-4xl">{PRICING_SENTENCE}</h2>

            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
              {/* Kreditcsomagok — a PricingModal adatforrásából */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {CREDIT_PACKAGES.map((p, i) => {
                  const perCredit = p.priceHuf / p.credits;
                  const featured = i === 1;
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col rounded-2xl p-5"
                      style={{
                        background: featured ? "var(--twx-ink)" : "var(--twx-cream)",
                        color: featured ? "var(--twx-cream)" : "var(--twx-ink)",
                        border: `1px solid ${featured ? "var(--twx-ink)" : "var(--twx-line)"}`,
                      }}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: featured ? "var(--twx-coral-soft)" : "var(--twx-ink-muted)" }}>
                        {p.name.split(" – ")[0]}
                      </span>
                      <span className="font-display mt-2 text-3xl font-semibold">{p.credits} kredit</span>
                      <span className="mt-1 text-sm" style={{ color: featured ? "rgba(247,243,236,0.8)" : "var(--twx-ink-muted)" }}>
                        {formatHuf(p.priceHuf)} · {formatHuf(perCredit)} / kredit
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Mi mennyi kreditbe kerül — a modulok lib-jeiből */}
              <div>
                <p className="text-sm font-semibold">Mi mennyi kreditbe kerül</p>
                <ul className="mt-3 divide-y" style={{ borderColor: "var(--twx-line)" }}>
                  {CREDIT_COSTS.map((c) => (
                    <li key={c.label} className="flex items-center justify-between py-2 text-sm" style={{ borderColor: "var(--twx-line)" }}>
                      <span>{c.label}</span>
                      <span className="font-semibold tabular-nums">{c.credits} kredit</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <PricingTrigger
                    className="rounded-full px-6 py-3 text-sm font-semibold"
                    style={{ background: "var(--twx-coral)", color: "#1c1005" }}
                  >
                    Csomagok és igénylés
                  </PricingTrigger>
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>A kredit nem jár le. Sikertelen futásnál visszajár.</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===== ÖTLETLÁDA (világos) ===== */}
      <section className="mx-auto max-w-6xl px-6 pb-20 sm:pb-24">
        <Reveal>
          <span
            className="inline-block rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em]"
            style={{ background: "var(--twx-coral)", color: "#1c1005" }}
          >
            Ötletláda
          </span>
          <h2 className="font-display mt-4 text-4xl font-semibold sm:text-6xl">
            Mit építsünk legközelebb?
          </h2>
          <p className="mt-4 max-w-2xl text-base" style={{ color: "var(--twx-ink-muted)" }}>
            Van egy munka, amit szívesen kiadnál a kezedből? Írd meg — a jóváhagyott ötletek itt jelennek meg.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div
            className="rounded-2xl p-7"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}
          >
            <IdeaForm />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Közösségi ötletek</h3>
            {ideas.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Még nincs jóváhagyott ötlet — legyél te az első!
              </p>
            ) : (
              <ul className="space-y-2">
                {ideas.map((idea) => (
                  <li
                    key={idea.id}
                    className="rounded-xl p-4 text-sm"
                    style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}
                  >
                    <p className="whitespace-pre-wrap">{idea.content}</p>
                    <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      — {idea.authorName || "Névtelen"} ·{" "}
                      {new Date(idea.createdAt).toLocaleDateString("hu-HU")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ===== B2B (világos) ===== */}
      <section id="egyedi" className="mx-auto max-w-6xl px-6 pb-24">
        <Reveal>
          <div
            className="rounded-2xl p-8"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.25em]" style={{ color: "var(--twx-coral)" }}>
              Egyedi fejlesztés
            </p>
            <h2 className="font-display mt-3 text-3xl font-medium">Van egy folyamat, ami csak nálatok van?</h2>
            <p className="mb-6 mt-3 max-w-2xl text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Írjátok meg, mit csináltok kézzel újra és újra — felépítjük rá a saját, privát eszközötöket.
            </p>
            <B2BForm />
          </div>
        </Reveal>
      </section>

      {/* ===== FOOTER (sötét, nagy wordmark) ===== */}
      <footer style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-center justify-between gap-6 border-b pb-10" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <div className="flex flex-wrap gap-6 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
              <a href="#arak" className="hover:text-white">Árak</a>
              <a href="#egyedi" className="hover:text-white">Egyedi fejlesztés</a>
              <AuthTrigger mode="login" className="hover:text-white">Belépés</AuthTrigger>
              <AuthTrigger mode="register" className="hover:text-white">Regisztráció</AuthTrigger>
            </div>
            <p className="text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
              Profi munka, egy kattintásra.
            </p>
          </div>
          <Wordmark
            className="font-display mt-8 block font-semibold leading-none"
            style={{ fontSize: "clamp(4rem, 18vw, 12rem)", color: "var(--twx-on-dark)" }}
          />
        </div>
      </footer>

      {/* Belépés / Regisztráció + Csomagok modális ablakok */}
      <AuthModal />
      <PricingModal />
    </main>
  );
}
