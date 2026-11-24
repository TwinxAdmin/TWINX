// twinx.hu/referenciak — referencia-landing: az ingatlanos modulok (D38; terv 11 / 6. szakasz).
//
// Élesítve 2026-11-23 (Márk döntése). Tibi hitelesíti a csoportokat és a modulleírásokat (terv 11 / 8. nyitott pont).
//
// Szabályok: az értékbecslés mindig „tájékoztató ársáv"; a látványterv illusztráció („Koncepcióterv" jelölés
// és vízjel marad); a Hirdetésből videó nem szerepel; a 3D bejárás csak „Hamarosan". Nincs ár, „kredit",
// kitalált szám vagy idézet.
import type { Metadata } from "next";
import AuthModal from "@/components/AuthModal";
import ModuleIcon from "@/components/ModuleIcon";
import Reveal from "@/components/motion/Reveal";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import ContactBlock from "@/components/site/ContactBlock";
import GdnShowcase from "@/components/site/b/GdnShowcase";
import { bookingsOpenFor, getSiteViewer } from "@/lib/site-preview";
import { SITE_LINKS } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Referenciák — TWINX ingatlanos modulok",
  description: "A GDN Mandala Ingatlaniroda számára fejlesztett modulok, amelyeket a kollégák naponta használnak.",
};

type RefModule = { icon: string; title: string; text: string; soon?: boolean };

const GROUPS: { title: string; modules: RefModule[] }[] = [
  {
    title: "Az ingatlan bemutatása",
    modules: [
      { icon: "visualization", title: "Képjavító", text: "Lakásfotók feljavítása és rendrakás a képen, hogy a hirdetés vonzóbb legyen." },
      { icon: "visualization", title: "Látványterv", text: "Lakásfotóból felújítási koncepcióterv, 9 stílusban. Illusztráció: a képen „Koncepcióterv” jelölés és vízjel áll." },
      { icon: "flyer", title: "Hirdetéskép-készítő", text: "Posztolásra kész hirdetéskép az ingatlan adataiból és fotóiból, több méretben." },
      { icon: "video", title: "Marketingvideó", text: "Bemutató videó az ingatlan fotóiból, a közösségi felületekre." },
      { icon: "cube", title: "3D bejárás", text: "Bejárható 3D lakás az alaprajzból.", soon: true },
    ],
  },
  {
    title: "A hirdetés és az ár",
    modules: [
      { icon: "history", title: "Hirdetés-ellenőrző", text: "Bemásolod egy hirdetés linkjét: pontozza, megmondja, mi hiányzik, és újraírja a szöveget." },
      { icon: "valuation", title: "Értékbecslés", text: "Ingatlanadatokból tájékoztató ársáv, egyoldalas PDF-ben. Nem hivatalos értékbecslés." },
    ],
  },
  {
    title: "Az iroda és a háttér",
    modules: [
      { icon: "pro", title: "Szakember-kereső", text: "Ügyvéd, energetikus vagy kivitelező keresése az ügyfeleknek." },
      { icon: "office", title: "Irodai fiók", text: "Közös tér a kollégáknak: közös mappák, üzenetek és az elkészült munkák egy helyen." },
    ],
  },
];

function ModuleCard({ m }: { m: RefModule }) {
  // A „Hamarosan" kártya halványabb és nem kattintható (nincs ál-gomb). Egyik kártya sem link: ez bemutató.
  return (
    <div className="flex h-full min-h-[184px] flex-col rounded-2xl p-6"
      style={{
        background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)",
        opacity: m.soon ? 0.55 : 1,
      }}
      aria-disabled={m.soon || undefined}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "var(--twx-dark)", color: "var(--twx-coral)" }}>
          <ModuleIcon name={m.icon} size={18} />
        </span>
        {m.soon && <span className="twx-badge-muted rounded-full px-2 py-0.5 text-[11px] font-bold">Hamarosan</span>}
      </div>
      <h3 className="font-display mt-4 text-lg font-semibold">{m.title}</h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>{m.text}</p>
    </div>
  );
}

export default async function ReferencesPage() {
  const viewer = await getSiteViewer();

  return (
    <main className="font-sans" style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }}>
      <SiteHeader viewer={viewer} />

      {/* ===== 1) HERO — szám és idézet nélkül, amíg nincs GDN által jóváhagyott adat ===== */}
      <section style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <p className="font-display text-xs font-semibold uppercase sm:text-sm" style={{ color: "var(--twx-coral)", letterSpacing: "0.22em" }}>
            Referencia
          </p>
          <h1 className="font-display mt-5 max-w-3xl font-semibold leading-[1.08]" style={{ fontSize: "clamp(2.2rem, 5vw, 3.6rem)" }}>
            A GDN Mandala kollégái naponta használják.
          </h1>
          <p className="mt-6 max-w-2xl text-lg" style={{ color: "var(--twx-on-dark-muted)" }}>
            Ezeket az ingatlanos modulokat a GDN Mandala Ingatlaniroda számára fejlesztettük, a kollégáik napi munkájához igazítva.
          </p>
        </div>
      </section>

      {/* ===== 1/b) INTERAKTÍV BEMUTATÓ — ugyanaz, mint a főoldalon (GdnShowcase; Márk kérése 2026-11-24) ===== */}
      <section className="bg-b-surface text-b-ink">
        <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-8 sm:py-20">
          <p className="b-eyebrow mb-3">Interaktív bemutató</p>
          <h2 className="font-display mb-[26px] text-[28px] font-bold tracking-[-0.6px] sm:text-[36px]">Amit egy ingatlaniroda kapott tőlünk.</h2>
          <GdnShowcase />
        </div>
      </section>

      {/* ===== 2) MODULOK, munkafolyamat szerint ===== */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="flex flex-col gap-16">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <Reveal>
                <h2 className="font-display text-2xl font-semibold sm:text-3xl">{g.title}</h2>
              </Reveal>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {g.modules.map((m, i) => (
                  <Reveal key={m.title} delay={i * 0.05} className="h-full">
                    <ModuleCard m={m} />
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 3) SÁV — bármilyen területre ===== */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <Reveal>
          <div className="flex flex-col gap-5 rounded-3xl p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9"
            style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
            <p className="font-display max-w-xl text-xl font-semibold sm:text-2xl">
              Ingatlanra készült, de bármilyen területre építünk egyedi modult.
            </p>
            <a href={SITE_LINKS.contact} className="inline-flex flex-none items-center justify-center rounded-full px-6 py-3 text-sm font-semibold"
              style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
              Ingyenes felmérés
            </a>
          </div>
        </Reveal>
      </section>

      {/* ===== 4) INGATLAN CSOMAG — diszkrét sor, ár és önkiszolgáló vásárlás nélkül (D30, D40) ===== */}
      <section className="mx-auto max-w-6xl px-6 pb-20 sm:pb-24">
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          <span className="font-semibold" style={{ color: "var(--twx-ink)" }}>Ingatlan csomag.</span>{" "}
          Ingatlanosként a modulokat használhatod: a hozzáférésről egyeztetünk.
        </p>
      </section>

      {/* ===== 5) KAPCSOLATBLOKK (azonos a főoldalival) ===== */}
      <ContactBlock source="referencia" bookingOpen={bookingsOpenFor(viewer)}
        prefill={viewer ? { name: viewer.name, email: viewer.email } : undefined} />
      <SiteFooter />
      <AuthModal />
    </main>
  );
}
