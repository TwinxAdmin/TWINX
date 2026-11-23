// twinx.hu — főoldal: rövid, egyedi modulos üzenet (D34, D36; terv: docs/terv/11-fooldal-es-landing-terv.md, 3. szakasz).
// Élesítve 2026-11-23 (Márk döntése). A korábbi, kredites főoldal: _backup/page.landing-v2-kredites.tsx.txt.
//
// Tartalmi szabályok: tegező hangnem; nincs ár, nincs „kredit", nincs kitalált szám vagy idézet.
import type { Metadata } from "next";
import AuthModal from "@/components/AuthModal";
import AuthTrigger from "@/components/AuthTrigger";
import HeroVideo from "@/components/HeroVideo";
import ModuleIcon from "@/components/ModuleIcon";
import Reveal from "@/components/motion/Reveal";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactBlock from "@/components/site/ContactBlock";
import { bookingsOpenFor, getSiteViewer } from "@/lib/site-preview";
import { SITE_LINKS } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TWINX — a te cégedre szabott modul",
  description: "Profi felmérés után a TWINX a napi munkádhoz igazított eszközt épít. Foglalj ingyenes felmérést.",
};

const STEPS = [
  { title: "Felmérünk.", text: "Foglalsz egy ingyenes időpontot, és végigbeszéljük, hol megy el sok időd. Ha már van konkrét ötleted, azzal is jöhetsz." },
  { title: "Megépítjük.", text: "A te folyamatodra szabott modult készítjük el, nem sablont. Az ajánlatot a felmérés után kapod." },
  { title: "Használod.", text: "A modul ott fut, ahol neked a legjobb." },
];

const PLACES = [
  { title: "A TWINX oldalán", text: "A kollégáid a saját fiókjukkal belépnek, és használják a modult, külön app vagy weblap nélkül.", featured: true },
  { title: "Saját app vagy oldal", text: "Megépítjük neked, a te arculatoddal." },
  { title: "A saját weboldaladba építve", text: "Ha hozzáférést adsz, beépítjük." },
  { title: "Ahol már dolgozol", text: "Telegramban, Slackben vagy Excelben." },
];

const REFERENCES = [
  { icon: "visualization", title: "Látványterv", text: "Lakásfotóból felújítási koncepcióterv, 9 stílusban." },
  { icon: "history", title: "Hirdetés-ellenőrző", text: "Bemásolod egy hirdetés linkjét: pontozza, megmondja, mi hiányzik, és újraírja a szöveget." },
  { icon: "valuation", title: "Értékbecslés", text: "Ingatlanadatokból tájékoztató ársáv, egyoldalas PDF-ben." },
];

function Eyebrow({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p className="font-display text-xs font-semibold uppercase sm:text-sm"
      style={{ color: dark ? "var(--twx-coral)" : "#b4553a", letterSpacing: "0.22em" }}>
      {children}
    </p>
  );
}

export default async function HomePage() {
  const viewer = await getSiteViewer();

  return (
    <main className="font-sans" style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }}>
      <SiteHeader viewer={viewer} />

      {/* ===== 1) HERO ===== */}
      <section className="relative flex min-h-[78vh] items-center overflow-hidden"
        style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="pointer-events-none absolute inset-0" aria-hidden style={{ isolation: "isolate" }}>
          <HeroVideo />
        </div>
        <div className="pointer-events-none absolute inset-0" aria-hidden
          style={{ background: "linear-gradient(100deg, rgba(18,16,14,0.94) 0%, rgba(18,16,14,0.78) 45%, rgba(18,16,14,0.45) 100%)" }} />
        <div className="pointer-events-none absolute inset-0" aria-hidden
          style={{ background: "linear-gradient(180deg, transparent 60%, rgba(12,11,10,0.9) 100%)" }} />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <Eyebrow dark>Egyedi modulok cégeknek</Eyebrow>
            <h1 className="font-display mt-5 font-semibold leading-[1.05]" style={{ fontSize: "clamp(2.6rem, 6vw, 4.4rem)" }}>
              A te cégedre szabott modul.
            </h1>
            <p className="mt-6 max-w-xl text-lg" style={{ color: "var(--twx-on-dark-muted)" }}>
              Profi felmérés után a TWINX a napi munkádhoz igazított eszközt épít.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href={SITE_LINKS.contact} className="rounded-full px-7 py-3.5 text-sm font-semibold"
                style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                Ingyenes felmérés
              </a>
              <a href={SITE_LINKS.references} className="rounded-full px-6 py-3.5 text-sm font-medium hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.18)", color: "var(--twx-on-dark)" }}>
                Referenciák
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 2) HOGYAN MŰKÖDIK — 3 egyforma kártya ===== */}
      <section id="hogyan" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20 sm:py-24">
        <Reveal>
          <Eyebrow>Hogyan működik</Eyebrow>
          <h2 className="font-display mt-3 text-3xl font-semibold sm:text-4xl">Három lépés, és a modul a tiéd.</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08} className="h-full">
              <div className="twx-card flex h-full flex-col p-7">
                <span className="font-display flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                  style={{ background: "var(--twx-coral-soft)", color: "#7a3a1e" }}>{i + 1}</span>
                <h3 className="font-display mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== 3) HOL FUT A MODUL — 4 fix méretű kártya, az első kiemelve ===== */}
      <section className="mx-auto max-w-6xl px-6 pb-20 sm:pb-24">
        <Reveal>
          <Eyebrow>Hol fut a modul</Eyebrow>
          <h2 className="font-display mt-3 text-3xl font-semibold sm:text-4xl">Ott, ahol neked a legjobb.</h2>
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLACES.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06} className="h-full">
              <div className="flex h-full min-h-[200px] flex-col rounded-2xl p-6"
                style={p.featured
                  ? { background: "var(--twx-dark)", color: "var(--twx-on-dark)", border: "1px solid rgba(239,122,90,0.45)" }
                  : { background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
                {/* Fix magasságú címke-hely: a kártyák címei egy vonalban maradnak. */}
                <div className="h-6">
                  {p.featured && (
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                      Ajánlott kezdés
                    </span>
                  )}
                </div>
                <h3 className="font-display mt-4 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: p.featured ? "var(--twx-on-dark-muted)" : "var(--twx-ink-muted)" }}>{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== 4) IRODAI FIÓK SÁV — opcionális közös tér ===== */}
      <section className="mx-auto max-w-6xl px-6 pb-20 sm:pb-24">
        <Reveal>
          <div className="flex flex-col gap-6 rounded-3xl p-7 sm:p-9 lg:flex-row lg:items-center lg:justify-between"
            style={{ background: "#efe7da", border: "1px solid var(--twx-line)" }}>
            <div className="flex gap-5">
              <span className="hidden h-12 w-12 flex-none items-center justify-center rounded-2xl sm:flex"
                style={{ background: "var(--twx-dark)", color: "var(--twx-coral)" }}>
                <ModuleIcon name="office" size={22} />
              </span>
              <div className="max-w-2xl">
                <h2 className="font-display text-xl font-semibold sm:text-2xl">Irodai fiók: közös tér, ha együtt dolgoztok.</h2>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
                  Regisztrálj, hozz létre irodai fiókot, és hívd meg a kollégáidat egy közös térbe.
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                  <span className="twx-badge-muted rounded-full px-2 py-0.5 text-[11px] font-bold">Hamarosan</span>
                  Munka küldése egymásnak, tanácskérés, elkészült munkák átnézése.
                </p>
                <p className="mt-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Az egyedi modult nem kell irodai fiókhoz kötni: a hozzáférés a saját fiókodhoz tartozik.
                </p>
              </div>
            </div>
            <div className="flex flex-none gap-3">
              <AuthTrigger mode="register" className="twx-btn rounded-full px-5 py-2.5 text-sm font-semibold">Regisztráció</AuthTrigger>
              <AuthTrigger mode="login" className="twx-btn-outline rounded-full px-5 py-2.5 text-sm font-medium">Belépés</AuthTrigger>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===== 5) REFERENCIA-ELŐZETES ===== */}
      <section className="mx-auto max-w-6xl px-6 pb-20 sm:pb-24">
        <Reveal>
          <Eyebrow>Referencia</Eyebrow>
          <h2 className="font-display mt-3 text-3xl font-semibold sm:text-4xl">Működő példa: egy ingatlaniroda napi eszközei.</h2>
          <p className="mt-3 max-w-2xl text-base" style={{ color: "var(--twx-ink-muted)" }}>
            Ingatlanra készült, de bármilyen területre építünk egyedi modult.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {REFERENCES.map((r, i) => (
            <Reveal key={r.title} delay={i * 0.08} className="h-full">
              <div className="twx-card flex h-full flex-col p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: "var(--twx-dark)", color: "var(--twx-coral)" }}>
                  <ModuleIcon name={r.icon} size={20} />
                </span>
                <h3 className="font-display mt-5 text-lg font-semibold">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>{r.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-8">
          <a href={SITE_LINKS.references} className="twx-btn-outline inline-flex rounded-full px-6 py-3 text-sm font-semibold">
            Referenciák megtekintése
          </a>
        </div>
      </section>

      {/* ===== 6) KAPCSOLATBLOKK ===== */}
      <ContactBlock source="fooldal" bookingOpen={bookingsOpenFor(viewer)}
        prefill={viewer ? { name: viewer.name, email: viewer.email } : undefined} />

      {/* ===== 7) LÁBLÉC ===== */}
      <SiteFooter />

      <AuthModal />
    </main>
  );
}
