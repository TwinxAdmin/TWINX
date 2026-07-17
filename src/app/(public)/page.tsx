// twinx.hu — Landing. Saját fejlesztésű, kategorizált AI alkalmazás-ökoszisztéma.
// Sötét cinematic hero → világos editorial szekciók, korall akcent.
import B2BForm from "@/components/B2BForm";
import IdeaForm from "@/components/IdeaForm";
import AuthModal from "@/components/AuthModal";
import AuthTrigger from "@/components/AuthTrigger";
import PricingModal from "@/components/PricingModal";
import PricingTrigger from "@/components/PricingTrigger";
import Wordmark from "@/components/Wordmark";
import HeroVideo from "@/components/HeroVideo";
import Reveal from "@/components/motion/Reveal";
import { getApprovedIdeas } from "@/lib/ideas";

export const runtime = "nodejs";
// A főoldal futásidőben renderel (Supabase-ből tölti a jóváhagyott ötleteket),
// ezért NE prerendereljük build-időben — különben env nélkül elbukna a build.
export const dynamic = "force-dynamic";

const CATEGORIES: {
  title: string;
  status: string;
  desc: string;
  modules?: string[];
}[] = [
  {
    title: "Ingatlan & Látványtervezés",
    status: "Elérhető",
    desc: "Adatalapú értékbecslés, fotórealisztikus látványterv és prémium marketing videó — egy kategóriában.",
    modules: [
      "Ingatlan értékbecslés",
      "Telek ellenőrzés",
      "Látványtervező",
      "Videó",
      "Hirdetéskészítő",
    ],
  },
  {
    title: "Adatelemzés & Automatizáció",
    status: "Hamarosan",
    desc: "Workflow-segédek és elemző motorok a repetitív, szakértelmet igénylő feladatokra.",
  },
  {
    title: "Média & Tartalomgyártás",
    status: "Hamarosan",
    desc: "Képgenerálás és marketing-automatizációk a mindennapi tartalomgyártáshoz.",
  },
];

export default async function LandingPage() {
  const ideas = await getApprovedIdeas(30);

  return (
    <main className="font-sans" style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }}>
      {/* ===== HERO (sötét, cinematic) ===== */}
      <section
        className="relative flex min-h-[92vh] flex-col overflow-hidden"
        style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}
      >
        {/* ===== MÉDIA-SLOT — ide teheted a saját hero-médiádat =====
            Most kép (public/design/hero-bg.jpg) bronz overlay-jel + finom Ken Burns animációval.
            Videóra cseréléshez lásd a lenti kommentet. */}
        <div className="pointer-events-none absolute inset-0" aria-hidden style={{ isolation: "isolate" }}>
          {/* Hero VIDEÓ (public/design/hero.mp4) — kliens-komponens, megbízható auto-indítással.
              A poszter a kép, amíg tölt / ha a böngésző blokkolja az autoplay-t. */}
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
              "linear-gradient(180deg, rgba(18,16,14,0.72) 0%, rgba(18,16,14,0.40) 38%, rgba(12,11,10,0.90) 100%)",
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
          <div className="flex min-w-0 flex-col leading-tight">
            <Wordmark className="font-display text-3xl font-semibold" style={{ color: "var(--twx-on-dark)" }} />
            <span
              className="font-display text-sm font-medium sm:text-base"
              style={{ color: "var(--twx-coral)", letterSpacing: "0.04em" }}
            >
              Automatizált üzleti intelligencia
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
            <a href="#kategoriak" className="hidden hover:text-white sm:inline">Kategóriák</a>
            <PricingTrigger className="hidden hover:text-white sm:inline">Csomagok</PricingTrigger>
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

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-16">
          <p
            className="twx-reveal font-display text-sm font-semibold uppercase"
            style={{ color: "var(--twx-coral)", letterSpacing: "0.22em" }}
          >
            Saját fejlesztésű AI alkalmazás-platform
          </p>
          <h1
            className="twx-reveal mt-4 font-display font-semibold leading-[0.95]"
            style={{ fontSize: "clamp(3.2rem, 10vw, 7rem)", color: "var(--twx-on-dark)", animationDelay: "0.08s" }}
          >
            AI-APPSTORE
          </h1>
          <p
            className="twx-reveal mt-6 max-w-2xl text-lg leading-relaxed"
            style={{ color: "var(--twx-on-dark-muted)", animationDelay: "0.16s" }}
          >
            AI-motorok a mindennapi üzletmenethez, egyetlen kategorizált platformon. Találd
            meg a vállalkozásodhoz passzoló célalkalmazást — havidíjak nélkül, tiszta
            használat alapon.
          </p>
          <div className="twx-reveal mt-9 flex flex-wrap gap-3" style={{ animationDelay: "0.24s" }}>
            <AuthTrigger
              mode="register"
              className="rounded-full px-7 py-3.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--twx-coral)", color: "#1c1005", boxShadow: "0 14px 34px rgba(239,122,90,0.35)" }}
            >
              Kezdés
            </AuthTrigger>
            <a
              href="#kategoriak"
              className="rounded-full border px-7 py-3.5 text-sm font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: "rgba(255,255,255,0.28)", color: "var(--twx-on-dark)" }}
            >
              Kategóriák megtekintése
            </a>
            <a
              href="#egyedi"
              className="rounded-full border px-7 py-3.5 text-sm font-medium transition-colors hover:bg-white/5"
              style={{ borderColor: "rgba(255,255,255,0.28)", color: "var(--twx-on-dark)" }}
            >
              Egyedi fejlesztés
            </a>
          </div>
        </div>

        {/* Görgetés-jelző */}
        <a
          href="#kategoriak"
          className="relative z-10 mx-auto mb-8 flex flex-col items-center gap-1 text-[11px] uppercase tracking-widest transition-opacity hover:opacity-100"
          style={{ color: "var(--twx-on-dark-muted)", opacity: 0.7 }}
          aria-label="Görgess lejjebb"
        >
          Görgess
          <span aria-hidden className="text-base">↓</span>
        </a>
      </section>

      {/* ===== KATEGÓRIÁK (világos) ===== */}
      <section id="kategoriak" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.25em]" style={{ color: "var(--twx-coral)" }}>
            Kategóriák
          </p>
          <h2 className="font-display mt-3 text-4xl font-medium sm:text-5xl">
            Kategorizált AI-eszközök, egy platformon.
          </h2>
          <p className="mt-4 max-w-2xl text-base" style={{ color: "var(--twx-ink-muted)" }}>
            Saját fejlesztésű AI-motorok — mindegyik egy-egy mindennapi üzleti folyamatot
            automatizál. A kínálat folyamatosan bővül.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {CATEGORIES.map((c, i) => {
            const live = c.status === "Elérhető";
            return (
              <Reveal key={c.title} delay={i * 0.1} className="h-full">
              <div
                className="flex h-full flex-col rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(28,24,21,0.10)]"
                style={{
                  background: "var(--twx-cream-card)",
                  border: `1px solid ${live ? "var(--twx-coral)" : "var(--twx-line)"}`,
                }}
              >
                <span
                  className="inline-block self-start rounded-full px-3 py-1 text-xs font-semibold"
                  style={
                    live
                      ? { background: "var(--twx-coral)", color: "#1c1005" }
                      : { background: "var(--twx-line)", color: "var(--twx-ink-muted)" }
                  }
                >
                  {c.status}
                </span>
                <h3 className="font-display mt-4 text-2xl font-medium">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
                  {c.desc}
                </p>

                {live && c.modules && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {c.modules.map((m) => (
                      <span
                        key={m}
                        className="rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}

                {!live && (
                  <span className="mt-5 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>
                    Fejlesztés alatt
                  </span>
                )}
              </div>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-8 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          …és a lista folyamatosan bővül — új kategóriák, új üzleti folyamatokra.
        </p>
      </section>

      {/* ===== CTA sáv (sötét) ===== */}
      <section style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-4xl font-medium">Kezdd el még ma.</h2>
            <p className="mt-3 text-base" style={{ color: "var(--twx-on-dark-muted)" }}>
              Fizess csak azért, amit használsz — havidíjak nélkül.
            </p>
          </div>
          <PricingTrigger
            className="rounded-full px-7 py-3 text-sm font-medium"
            style={{ background: "var(--twx-coral)", color: "#1c1005" }}
          >
            Csomagok
          </PricingTrigger>
        </div>
      </section>

      {/* ===== ÖTLETLÁDA (világos) ===== */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <span
          className="inline-block rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em]"
          style={{ background: "var(--twx-coral)", color: "#1c1005" }}
        >
          Ötletláda
        </span>
        <h2 className="font-display mt-4 text-4xl font-semibold sm:text-6xl">
          Milyen AI-eszközt építsünk legközelebb?
        </h2>
        <p className="mt-4 max-w-2xl text-base" style={{ color: "var(--twx-ink-muted)" }}>
          Van egy jó ötleted egy új célalkalmazáshoz vagy kategóriához? Küldd be — a
          jóváhagyott ötletek itt jelennek meg.
        </p>

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
        <div
          className="rounded-2xl p-8"
          style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.25em]" style={{ color: "var(--twx-coral)" }}>
            Egyedi fejlesztés
          </p>
          <h2 className="font-display mt-3 text-3xl font-medium">Saját AI-motorra van szükségetek?</h2>
          <p className="mb-6 mt-3 max-w-2xl text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Írjátok meg az igényt, és felépítjük a saját, privát AI-célalkalmazásotokat.
          </p>
          <B2BForm />
        </div>
      </section>

      {/* ===== FOOTER (sötét, nagy wordmark) ===== */}
      <footer style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-wrap items-center justify-between gap-6 border-b pb-10" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <div className="flex gap-6 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
              <a href="#kategoriak" className="hover:text-white">Kategóriák</a>
              <PricingTrigger className="hover:text-white">Csomagok</PricingTrigger>
              <AuthTrigger mode="login" className="hover:text-white">Belépés</AuthTrigger>
              <AuthTrigger mode="register" className="hover:text-white">Regisztráció</AuthTrigger>
            </div>
            <p className="text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
              Saját fejlesztésű AI alkalmazás-platform
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
