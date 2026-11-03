// Az egyedi modul oldal felső része (cím, hívógombok, HeroScene-ábra, „Kinek?" sáv) — közös komponens:
// az /egyedi-modul és a LinkedIn-landing (/bemutatkozas) is ezt használja.
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import Reveal from "@/components/motion/Reveal";
import RequestButton from "@/components/custom-module/RequestButton";
import HeroScene from "@/components/custom-module/HeroScene";

const CORAL = "var(--twx-coral)";
const INDUSTRIES = ["Ingatlaniroda", "Vendéglátás", "Szolgáltató cég", "Kereskedelem", "Építőipar", "Bármilyen ismétlődő folyamat"];

export default function CustomModuleHero({ embedded = false, hideNav = false, processHref = "#folyamat", heading: Heading = "h1" }: {
  embedded?: boolean;
  /** Más oldalba ágyazva nincs saját menüsor. */
  hideNav?: boolean;
  /** A „Hogyan készül?" gomb célja (ha nem az egyedi modul oldalon vagyunk, oda mutat). */
  processHref?: string;
  heading?: "h1" | "h2";
}) {
  return (
    <section className="relative overflow-hidden" style={{
      background: "var(--twx-dark)",
      // A TWINX-en belül halvány narancs keret választja el a szintén sötét felső menüsortól.
      ...(embedded ? { borderTop: "1px solid rgba(239,122,90,0.45)", borderBottom: "1px solid rgba(239,122,90,0.25)", boxShadow: "inset 0 1px 0 rgba(239,122,90,0.12), inset 0 18px 40px -30px rgba(239,122,90,0.35)" } : {}),
    }}>
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

      {!embedded && !hideNav && (
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

      <div className={`relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-6 pb-20 lg:grid-cols-[1fr_1.12fr] lg:pb-28 ${embedded ? "pt-14 lg:pt-20" : "pt-8 lg:pt-14"}`}>
        <Reveal>
          <p className="font-display text-sm font-semibold uppercase" style={{ color: CORAL, letterSpacing: "0.2em" }}>
            TWINX egyedi modul
          </p>
          <Heading className="mt-4 font-display font-semibold leading-[1.06]" style={{ fontSize: "clamp(2.1rem, 4.1vw, 3.3rem)", color: "var(--twx-on-dark)" }}>
            {/* Két sor, mindkettő EGYBEN (a betűméret úgy van belőve, hogy az oszlopba beférjen);
                csak a legkeskenyebb telefonon törhet az első mondat. */}
            <span className="sm:whitespace-nowrap">A te vállalkozásod.</span>
            <br />
            <span className="whitespace-nowrap" style={{ color: CORAL }}>A te modulod.</span>
          </Heading>
          <p className="mt-5 max-w-xl text-lg leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>
            Megépítjük azt az eszközt, ami a te napi munkádat automatizálja — a TWINX-be építve,
            a te adataiddal, sablonjaiddal és arculatoddal. Te csak egy kattintást látsz belőle.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <RequestButton className="rounded-xl px-7 py-4 text-base font-semibold transition-opacity hover:opacity-90"
              style={{ background: CORAL, color: "#1c1005" }}>
              Egyedi modul igénylése
            </RequestButton>
            <a href={processHref} className="rounded-xl px-6 py-4 text-base font-medium transition-colors hover:bg-white/5"
              style={{ color: "var(--twx-on-dark)", border: "1px solid rgba(255,255,255,0.2)" }}>
              Hogyan készül? ↓
            </a>
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
            Díjmentes egyeztetés és árajánlat · kötelezettség nélkül
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <HeroScene />
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
  );
}
