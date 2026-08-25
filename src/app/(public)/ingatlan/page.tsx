// twinx.hu/ingatlan — Értékesítési landing ingatlanközvetítőknek.
// Kiküldhető link: bemutatja a TWINX AI modulokat, a 10 kredites akciót, és
// egy jelentkező-űrlappal gyűjti a leadeket. TWINX arculat (sötét-bronz hero →
// világos editorial szekciók), a főoldallal egységes.
import type { Metadata } from "next";
import Image from "next/image";
import Wordmark from "@/components/Wordmark";
import ModuleIcon from "@/components/ModuleIcon";
import IngatlanLeadForm from "@/components/IngatlanLeadForm";
import IngatlanCta from "@/components/IngatlanCta";
import Reveal from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "TWINX ingatlanközvetítőknek — profi eszközök a gyorsabb, igényesebb munkához",
  description:
    "Ingatlanközvetítők fejlesztették, ingatlanközvetítőknek. Értékbecslés, hirdetéskép, videó, látványterv és hirdetésszöveg — havidíj nélkül, használat alapon. Az első 50 jelentkező 10 ajándék kreditet kap.",
};

const BENEFITS: { icon: string; title: string; desc: string }[] = [
  { icon: "cost", title: "Nincs havi díj", desc: "Teljesen kreditalapú rendszer — csak a ténylegesen elkészített tartalmak után vonunk le kreditet." },
  { icon: "branding", title: "Saját arculat", desc: "Minden kimenet a te adataiddal, fotóddal és az irodád színeivel jelenik meg." },
  { icon: "history", title: "Díjtalan tárolás", desc: "Az elkészült anyagok letölthető és szerkeszthető formában, korlátlan ideig, ingyen elérhetők." },
];

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

// Minta-galéria: valódi kimenetek a saját motorunkból, több formátumban.
const GALLERY: { src: string; alt: string; tag: string; ratio: string }[] = [
  { src: "/flyer-samples/openhouse-9x16.png", alt: "TWINX story formátumú hirdetéskép", tag: "Story · 9:16", ratio: "9 / 16" },
  { src: "/flyer-samples/unit-4x3.png", alt: "TWINX ingatlan összefoglaló hirdetéskép", tag: "Poszt · 4:3", ratio: "4 / 3" },
  { src: "/flyer-samples/premium-1x1.png", alt: "TWINX prémium négyzetes hirdetéskép", tag: "Négyzetes · 1:1", ratio: "1 / 1" },
];

export default function IngatlanLanding() {
  return (
    <main className="font-sans" style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }}>
      {/* ============================ 1) HERO ============================ */}
      <section className="relative overflow-hidden" style={{ background: "var(--twx-dark)" }}>
        <div className="pointer-events-none absolute -left-20 -top-24 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(239,122,90,0.28), transparent 70%)", filter: "blur(40px)" }} aria-hidden />
        <div className="pointer-events-none absolute right-0 top-40 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(249,201,182,0.20), transparent 70%)", filter: "blur(44px)" }} aria-hidden />

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

        <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
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

            <div className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: "rgba(239,122,90,0.16)", color: "var(--twx-coral)", border: "1px solid var(--twx-coral)" }}>
              <span aria-hidden>🎁</span> Akció: az első 50 jelentkező 10 ajándék kreditet kap!
            </div>

            <div className="mt-8">
              <IngatlanCta
                intent="kreditek"
                className="rounded-xl px-7 py-4 text-base font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--twx-coral)", color: "#1c1005" }}
              >
                Kérem a 10 ajándék kreditet!
              </IngatlanCta>
            </div>
          </div>

          {/* Valódi minta a saját motorunkból — rögtön mutatja a kimenet minőségét. */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="overflow-hidden rounded-2xl shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
              <Image src="/flyer-samples/openhouse-1x1.png" alt="TWINX hirdetéskép minta" width={800} height={800} className="h-auto w-full" priority />
            </div>
            <span className="absolute -bottom-3 left-4 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
              Valódi TWINX kimenet
            </span>
          </div>
        </div>
      </section>

      {/* ========================= 2) FŐ ELŐNYÖK ========================= */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Miért a TWINX?</h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.08}>
              <div className="h-full rounded-2xl p-6" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "var(--twx-coral-soft)", color: "var(--twx-coral)" }}>
                  <ModuleIcon name={b.icon} className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-xl font-medium">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>{b.desc}</p>
              </div>
            </Reveal>
          ))}
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
            {/* Összekötő vonal a lépések között (csak nagy képernyőn). */}
            <div className="pointer-events-none absolute left-0 right-0 top-9 hidden md:block" aria-hidden>
              <div className="mx-[16.6%] h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(239,122,90,0.5), transparent)" }} />
            </div>
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

      {/* ===================== 3b) MINTA-GALÉRIA (KÉPEK) ===================== */}
      <section className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-20">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Ilyen anyagok készülnek</h2>
          <p className="mt-3 max-w-2xl text-base" style={{ color: "var(--twx-ink-muted)" }}>
            Valódi TWINX kimenetek — story, poszt és négyzetes formátumban, posztolásra készen.
          </p>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {GALLERY.map((g, i) => (
            <Reveal key={g.src} delay={i * 0.08}>
              <div className="group relative overflow-hidden rounded-2xl shadow-lg transition-transform duration-300 hover:-translate-y-1"
                style={{ border: "1px solid var(--twx-line)", aspectRatio: g.ratio, background: "var(--twx-cream-card)" }}>
                <Image src={g.src} alt={g.alt} fill sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ background: "rgba(28,16,5,0.72)", color: "var(--twx-on-dark)", backdropFilter: "blur(4px)" }}>
                  {g.tag}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

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

      {/* ===================== 5) INGYENES BEMUTATÓ (CTA) ===================== */}
      <section className="mx-auto w-full max-w-4xl px-6 py-16 sm:py-20 text-center">
        <Reveal>
          <h2 className="font-display text-3xl font-semibold sm:text-4xl">Szeretnéd működés közben látni?</h2>
          <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
            Kérj egy 30 perces online bemutatót! Kollégáink lépésről lépésre végigvezetnek a
            rendszeren, és segítenek a kezdeti beállításokban.
          </p>
          <div className="mt-8">
            <IngatlanCta
              intent="bemutato"
              className="rounded-xl px-7 py-4 text-base font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--twx-coral)", color: "#1c1005" }}
            >
              Időpontot foglalok az ingyenes bemutatóra
            </IngatlanCta>
          </div>
        </Reveal>
      </section>

      {/* ===================== 6) ZÁRÓ ŰRLAP (LEAD) ===================== */}
      <section className="px-6 py-16 sm:py-24" style={{ background: "var(--twx-dark)" }}>
        <div className="mx-auto w-full max-w-2xl">
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl" style={{ color: "var(--twx-on-dark)" }}>
              Szerezd meg a 10 ajándék kreditet!
            </h2>
            <p className="mt-4 text-base leading-relaxed" style={{ color: "var(--twx-on-dark-muted)" }}>
              Légy az első 50 jelentkező között, töltsd ki az űrlapot, és kezdd el ingyen
              használni a TWINX-et!
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
    </main>
  );
}
