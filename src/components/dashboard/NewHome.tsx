// NewHome — személyre szabott kezdőlap az ÚJ felületen (terv 11 / 4.; 6. lépés: B arculat, terv 29 / 5.,
// minta: docs/terv/design/B-kezdolap.dc.html).
//   • Üdvözlés: „Üdv újra, [Név]!" + „Itt jelennek meg az egyedi moduljaid."
//   • Van modulja: Moduljaim kártyák (fix méret, „⋯" menü).
//   • Nincs modulja: nagy fehér kártya („Még nincs modulod. Építünk egyet neked."), pulzáló „Időpontot foglalok" gomb
//     (a lenti foglalási blokkhoz visz) és 3 lépéses idővonal. Besorolatlan felhasználónál (D31) ugyanez + a terv 22 sora.
//   • Alatta: „Miért érdemes?" (szöveg + MainGoalAnimation) · Legutóbbi munkáim · Irodai fiók („Hamarosan" sorral) · „Tekintsd meg a referenciákat" sor · kapcsolatblokk.
// Az adatok (modulok, munkák) a szerveroldali lekérdezésekből jönnek (dashboard/page.tsx).
import ModuleCards from "@/components/dashboard/ModuleCards";
import SilkRibbons from "@/components/site/b/SilkRibbons";
import MainGoalAnimation from "@/components/custom-module/MainGoalAnimation";
import { WHY_CUSTOM_MODULE } from "@/lib/site-copy";
import ContactBlock from "@/components/site/ContactBlock";
import type { ActivityItem } from "@/components/RecentActivity";
import { SITE_LINKS, type SiteModule } from "@/lib/site";

const UNASSIGNED_TEXT =
  "A fiókod létrejött, de még egyik céghez sincs hozzárendelve. Ha meghívót kaptál, a levélben kattints a Belépés gombra. Ha velünk dolgozol, írj: office@twinx.hu.";

const TIMELINE = [
  { title: "Felmérünk", text: "ingyenes időpont, beszélgetés" },
  { title: "Megépítjük", text: "a te folyamatodra szabva" },
  { title: "Használod", text: "itt, a kezdőlapodon" },
];

function relativeDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (days <= 0) return "ma";
  if (days === 1) return "tegnap";
  if (days < 7) return `${days} napja`;
  return d.toLocaleDateString("hu-HU");
}

export default function NewHome({ name, email, modules, unassigned, works, bookingOpen = true }: {
  name: string; email: string; modules: SiteModule[]; unassigned: boolean; works: ActivityItem[]; bookingOpen?: boolean;
}) {
  // A teljes nevet írjuk ki: a sorrend (vezeték- / keresztnév) a regisztrációtól függ, nem tippelünk.
  const shown = name.trim().replace(/\s+/g, " ");
  const recent = works.slice(0, 3);
  return (
    <main className="space-y-[22px]">
      {/* Üdvözlés */}
      <header className="pb-1 pt-2">
        <p className="mb-2 text-sm font-semibold text-b-accent-ink">{shown ? `Üdv újra, ${shown}!` : "Üdv újra!"}</p>
        <h1 className="font-display text-[32px] font-bold leading-[1.08] tracking-[-1px] sm:text-[46px] sm:tracking-[-1.2px]">
          Itt jelennek meg az egyedi moduljaid.
        </h1>
      </header>

      {/* Moduljaim — vagy a vonzó üres állapot */}
      {modules.length > 0 ? (
        <section aria-label="Moduljaim"><ModuleCards modules={modules} /></section>
      ) : (
        <section className="relative flex flex-wrap items-center gap-9 overflow-hidden rounded-[28px] border border-b-line bg-b-card p-6 pb-24 shadow-b sm:p-10 sm:pb-28">
          <SilkRibbons tone="light" heightClass="h-[130px] sm:h-[160px]" className="opacity-70" />
          {/* A szöveg a szalagok fölött is olvasható: fehér „glow" a betűk körül + sötétebb szövegszín (Márk kérése). */}
          <div className="b-glow-text relative min-w-0 flex-[1_1_420px]">
            <h2 className="font-display mb-3 text-[26px] font-bold leading-tight tracking-[-0.6px] sm:text-[32px]">Még nincs modulod. Építünk egyet neked.</h2>
            <p className="mb-6 max-w-[520px] text-[17px] font-medium leading-[1.55] text-b-ink">
              Az egyedi modul egy, a te munkafolyamatodra szabott eszköz. Foglalj ingyenes felmérést, és megbeszéljük, hol tudunk időt spórolni.
            </p>
            <a href="#kapcsolat" className="b-btn b-pulse">Időpontot foglalok</a>
            {unassigned && <p className="mt-5 max-w-[520px] text-sm font-medium leading-relaxed text-b-ink">{UNASSIGNED_TEXT}</p>}
          </div>
          {/* 3 lépéses idővonal */}
          <ol className="b-glow-text relative w-full min-w-0 flex-[0_1_380px]" aria-label="Hogyan lesz modulod">
            {TIMELINE.map((t, i) => (
              <li key={t.title} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <span className={`font-display flex h-[34px] w-[34px] items-center justify-center rounded-full ${i === 0 ? "bg-b-accent text-white" : "bg-b-surface text-b-ink"}`}>{i + 1}</span>
                  {i < TIMELINE.length - 1 && <span className="h-[34px] w-0.5 bg-b-line" aria-hidden />}
                </div>
                <div className="pt-1">
                  <b>{t.title}</b>
                  <p className="mt-0.5 text-sm font-medium text-b-ink">{t.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Miért érdemes? — rövid indoklás + a korábbi „Mi az egyedi modul?" animáció (MainGoalAnimation). Fix magasságú
          animációs doboz, így nincs ugrálás. Szöveg: site-copy.ts → WHY_CUSTOM_MODULE. */}
      <section className="flex flex-wrap items-center gap-8 rounded-[28px] border border-b-line bg-b-surface p-6 sm:p-9">
        <div className="min-w-0 flex-[1_1_380px]">
          <p className="b-eyebrow mb-3">{WHY_CUSTOM_MODULE.eyebrow}</p>
          <h2 className="font-display mb-4 text-[24px] font-bold leading-tight tracking-[-0.5px] sm:text-[30px]">{WHY_CUSTOM_MODULE.title}</h2>
          <div className="space-y-3 text-[16px] leading-[1.6] text-b-ink-2">
            {WHY_CUSTOM_MODULE.paragraphs.map((p) => <p key={p}>{p}</p>)}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {WHY_CUSTOM_MODULE.chips.map((c) => (
              <span key={c} className="rounded-full border border-b-line bg-b-card px-3.5 py-1.5 text-[13px] font-semibold text-b-ink">{c}</span>
            ))}
          </div>
        </div>
        <div className="flex h-[300px] min-w-0 flex-[1_1_420px] items-center justify-center overflow-hidden rounded-[22px] border border-b-line bg-b-card p-3 sm:h-[340px] sm:p-5">
          <div className="w-full max-w-[520px]"><MainGoalAnimation /></div>
        </div>
      </section>

      {/* Legutóbbi munkáim · Irodai fiók */}
      <div className="flex flex-wrap gap-[18px]">
        <section className="min-h-[140px] min-w-0 flex-[2_1_560px] rounded-[22px] border border-b-line bg-b-card p-[26px]">
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold">Legutóbbi munkáim</h2>
            {works.length > 0 && <a href="/dashboard/munkaim" className="text-sm font-semibold text-b-accent-ink hover:underline">Összes munkám →</a>}
          </div>
          {recent.length === 0 ? (
            <p className="text-[15px] text-b-ink-3">Az elkészült munkáid itt jelennek meg.</p>
          ) : (
            <ul className="divide-y divide-b-line">
              {recent.map((w) => (
                <li key={w.id}>
                  <a href="/dashboard/munkaim" className="flex h-11 items-center justify-between gap-3 text-[15px] hover:text-b-accent-ink">
                    <span className="min-w-0 truncate font-medium">{w.title}</span>
                    <span className="flex-none text-[13px] text-b-ink-2">{w.typeLabel} · {relativeDay(w.created_at)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
        <a href="/dashboard/iroda" className="block min-h-[140px] min-w-0 flex-[1_1_300px] rounded-[22px] border border-b-line bg-b-card p-[26px] transition-shadow hover:shadow-b">
          <h2 className="mb-2 text-lg font-semibold">Irodai fiók</h2>
          <p className="mb-2.5 text-[15px] leading-normal text-b-ink-2">Közös tér, ha együtt dolgoztok.</p>
          <p className="text-[11px] font-semibold uppercase tracking-[1px] text-b-accent-ink">Hamarosan: munka küldése egymásnak</p>
        </a>
      </div>

      {/* Referenciák — csak egy átvezető sor (Márk kérése 2026-11-24): a teljes, interaktív bemutató a Referenciák oldalon van. */}
      {/* Sötét sáv (Márk kérése), mint a felső menüsor: krém szöveg, korall gomb. */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] bg-b-dark px-[26px] py-5 text-b-on-dark shadow-b">
        <p className="text-lg font-semibold">Referenciák</p>
        <a href={SITE_LINKS.references} className="b-btn">Tekintsd meg a referenciákat →</a>
      </section>

      {/* Kapcsolatblokk — az „Időpontot foglalok" ide visz; belépve név és e-mail előre kitöltve */}
      <ContactBlock source="kezdolap" prefill={{ name, email }} bookingOpen={bookingOpen} inset />
    </main>
  );
}
