// Értékbecslés-jelenet a főoldali modul-forgóba — kódból rajzolt, nem videó.
//
// MIÉRT jelenet és nem PDF-kép: a partnernek nem az a kérdés, hogyan néz ki a
// riport, hanem hogy milyen alapossággal készül. Ezért három felvonás, középre
// komponálva:
//   1) egy RÉSZLETES űrlap (10 mező, két oszlop) magától, gépelve kitöltődik,
//   2) a gomb benyomódik, rövid folyamatjelző fut,
//   3) az űrlap hátrébb húzódik, a helyére beúszik egy ÁLLÓ A4-ES LAP: az ár
//      felpörög, az indoklások sorban megjelennek, végül „PDF letöltve".
// A háttérben halvány, lassan sodródó ingatlan-motívumok (ház, kulcs, m², trend)
// töltik ki az üres teret.
//
// Az egész egy időzítő (t ms) függvénye: minden állapot ebből számolódik, ezért
// újraindításkor tiszta lappal indul. A számok KITALÁLTAK, de hihetők.
"use client";

import { useEffect, useRef, useState } from "react";
import AnimatedNumber from "@/components/motion/AnimatedNumber";

/** Az A4-es lap TERVEZÉSI mérete (px). A színpad magasságához skálázzuk, így a
 *  tipográfia minden képernyőn ugyanaz marad, csak kisebb/nagyobb a lap. */
const PAGE_W = 300;
const PAGE_H = Math.round(PAGE_W * 1.414);

// ---- Forgatókönyv -----------------------------------------------------------
type Field = { label: string; value: string; startMs: number };
const CHAR_MS = 42;
const GAP_MS = 180;

const RAW: Array<[string, string]> = [
  ["Település", "Budapest XIII."],
  ["Utca", "Visegrádi utca"],
  ["Ingatlan típusa", "Tégla lakás"],
  ["Alapterület", "62 m²"],
  ["Szobák", "2 + 1 fél"],
  ["Emelet / lift", "3. / van"],
  ["Építés éve", "2015"],
  ["Állapot", "Újszerű"],
  ["Fűtés", "Gázcirkó"],
  ["Erkély / tájolás", "4 m² / DK"],
];
const FIELDS: Field[] = (() => {
  let t = 350;
  return RAW.map(([label, value]) => {
    const f = { label, value, startMs: t };
    t += value.length * CHAR_MS + GAP_MS;
    return f;
  });
})();
const TYPED_END = FIELDS[FIELDS.length - 1].startMs + FIELDS[FIELDS.length - 1].value.length * CHAR_MS;
const PRESS_AT = TYPED_END + 450;
const STEPS: Array<{ label: string; at: number }> = [
  { label: "Piaci adatok gyűjtése a környékről…", at: PRESS_AT + 300 },
  { label: "14 hasonló ingatlan összevetése…", at: PRESS_AT + 900 },
  { label: "Korrekciók: állapot, emelet, év, fűtés…", at: PRESS_AT + 1500 },
  { label: "Arculatos riport készül…", at: PRESS_AT + 2100 },
];
const REPORT_AT = PRESS_AT + 2700;
const PRICE_AT = REPORT_AT + 400;
const REASON_AT = REPORT_AT + 1200;
const REASON_STEP = 330;
const DONE_AT = REASON_AT + 5 * REASON_STEP + 900;
/** A dia teljes hossza — a forgó ennyit vár a váltással. */
export const VALUATION_DEMO_MS = DONE_AT + 1800;

const PRICE = 79_900_000;
const RANGE: [number, number] = [75_900_000, 83_900_000];
const PPM2 = Math.round(PRICE / 62);
const REASONS = [
  "Újszerű, 2015-ös építés: +8% a kerületi átlaghoz képest",
  "62 m²: a legkeresettebb méretsáv a XIII. kerületben",
  "3. emelet lifttel, DK-i tájolás, erkély: +3%",
  "Korszerű gázcirkó, alacsony rezsi: +1%",
  "14 hasonló, 90 napon belüli hirdetés az alap",
];

function typed(value: string, startMs: number, t: number): string {
  if (t < startMs) return "";
  return value.slice(0, Math.min(value.length, Math.floor((t - startMs) / CHAR_MS)));
}

export default function ValuationDemo({ active }: { active: boolean }) {
  const [t, setT] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // A lap a színpad magasságának 90%-ára skálázódik.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale((e.contentRect.height * 0.9) / PAGE_H));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Óra: csak amíg a dia aktív; inaktívvá válva nullázódik.
  useEffect(() => {
    if (!active) { setT(0); return; }
    const start = performance.now();
    let raf = 0;
    const tick = () => { setT(performance.now() - start); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const activeField = FIELDS.findIndex((f) => t >= f.startMs && typed(f.value, f.startMs, t).length < f.value.length);
  const filled = FIELDS.filter((f) => typed(f.value, f.startMs, t).length === f.value.length).length;
  const allTyped = filled === FIELDS.length;
  const pressed = t >= PRESS_AT && t < PRESS_AT + 280;
  const step = [...STEPS].reverse().find((s) => t >= s.at && t < REPORT_AT);
  const reportIn = t >= REPORT_AT;
  const priceOn = t >= PRICE_AT;
  const done = t >= DONE_AT;

  return (
    <div ref={stageRef} className="relative h-full w-full overflow-hidden"
      style={{ background: "radial-gradient(70% 70% at 50% 45%, rgba(239,122,90,0.16), transparent 70%)" }}>

      {/* ===== Háttér: sodródó ingatlan-motívumok az üres részeken ===== */}
      <Motifs />

      {/* ===== 1–2) RÉSZLETES ŰRLAP — középen, üvegkártyán ===== */}
      <div
        className="absolute left-1/2 top-1/2 w-[80%] max-w-[560px] rounded-2xl p-3 sm:p-4"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.16)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
          color: "var(--twx-on-dark)",
          transform: reportIn ? "translate(-50%, -50%) scale(0.86)" : "translate(-50%, -50%)",
          opacity: reportIn ? 0 : 1,
          transition: "transform .8s cubic-bezier(.22,1,.36,1), opacity .5s",
        }}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--twx-coral)" }}>
            Értékbecslés · az ingatlan adatai
          </div>
          <div className="text-[9px] tabular-nums" style={{ color: "var(--twx-on-dark-muted)" }}>
            {filled}/{FIELDS.length} mező
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:gap-y-2">
          {FIELDS.map((f, i) => {
            const v = typed(f.value, f.startMs, t);
            const focus = i === activeField;
            return (
              <div key={f.label}>
                <div className="mb-0.5 text-[8px] font-medium sm:text-[9px]" style={{ color: "var(--twx-on-dark-muted)" }}>{f.label}</div>
                <div
                  className="flex h-6 items-center rounded-md px-2 text-[10px] font-medium sm:h-7 sm:text-[11px]"
                  style={{
                    background: "rgba(255,255,255,0.94)",
                    color: "var(--twx-ink)",
                    border: `1px solid ${focus ? "var(--twx-coral)" : "rgba(255,255,255,0.35)"}`,
                    boxShadow: focus ? "0 0 0 3px rgba(239,122,90,0.28)" : "none",
                    transition: "box-shadow .2s, border-color .2s",
                  }}
                >
                  <span className="truncate">{v}</span>
                  {focus && <span className="twx-caret ml-px inline-block h-3.5 w-px shrink-0" style={{ background: "var(--twx-ink)" }} />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 h-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.14)" }}>
          <div className="h-full rounded-full" style={{ width: `${(filled / FIELDS.length) * 100}%`, background: "var(--twx-coral)", transition: "width .25s" }} />
        </div>
        <button
          type="button"
          tabIndex={-1}
          className="mt-2.5 w-full rounded-lg py-2 text-[10px] font-semibold sm:text-xs"
          style={{
            background: allTyped ? "var(--twx-coral)" : "rgba(255,255,255,0.10)",
            color: allTyped ? "#1c1005" : "var(--twx-on-dark-muted)",
            transform: pressed ? "scale(0.97)" : "scale(1)",
            boxShadow: pressed ? "inset 0 2px 8px rgba(0,0,0,0.3)" : allTyped ? "0 10px 26px rgba(239,122,90,0.4)" : "none",
            transition: "transform .12s, background .3s, box-shadow .3s, color .3s",
          }}
        >
          Értékbecslés indítása · 1 kredit
        </button>
        <div className="mt-1.5 h-4 text-center text-[9px]" style={{ color: "var(--twx-on-dark-muted)" }}>
          {step && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {step.label}
            </span>
          )}
        </div>
      </div>

      {/* ===== 3) ÁLLÓ A4-ES RIPORT — középre úszik be ===== */}
      <div
        className="absolute left-1/2 top-1/2 flex flex-col overflow-hidden"
        style={{
          width: PAGE_W, height: PAGE_H,
          background: "#fdfbf6", color: "var(--twx-ink)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.08)",
          transformOrigin: "center",
          transform: reportIn
            ? `translate(-50%, -50%) scale(${scale}) rotate(0deg)`
            : `translate(-50%, -36%) scale(${scale * 0.9}) rotate(-2deg)`,
          opacity: reportIn ? 1 : 0,
          transition: "transform .9s cubic-bezier(.22,1,.36,1) .15s, opacity .5s .15s",
        }}
      >
        {/* Arculati fejléc */}
        <div className="flex items-center justify-between px-3 py-2" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
          <div className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded text-[8px] font-bold" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>T</span>
            <span className="text-[9px] font-semibold">TWINX partner</span>
          </div>
          <span className="text-[7px]" style={{ color: "var(--twx-on-dark-muted)" }}>2026. szeptember</span>
        </div>

        <div className="flex flex-1 flex-col px-3 py-2">
          {/* Cím + cím */}
          <div className="text-[7px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--twx-coral)" }}>Piaci értékbecslés</div>
          <div className="font-display mt-0.5 text-[11px] font-semibold leading-tight">Budapest XIII., Visegrádi utca</div>
          <div className="text-[7px]" style={{ color: "var(--twx-ink-muted)" }}>Tégla lakás · 62 m² · 2 + 1 fél · 3. emelet</div>

          {/* Ár-doboz */}
          <div className="mt-2 rounded-md p-2" style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}>
            <div className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: "var(--twx-coral)" }}>Becsült piaci érték</div>
            <div className="font-display mt-0.5 whitespace-nowrap text-[15px] font-semibold leading-none">
              <AnimatedNumber value={priceOn ? PRICE : 0} duration={1500} className="tabular-nums" /> Ft
            </div>
            <div className="mt-0.5 text-[7px]" style={{ color: "var(--twx-on-dark-muted)" }}>
              {PPM2.toLocaleString("hu-HU")} Ft/m² · ±5% sáv
            </div>
            <div className="relative mt-1.5 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.14)" }}>
              <div className="absolute inset-y-0 rounded-full" style={{ left: "16%", right: "16%", background: "rgba(239,122,90,0.45)" }} />
              <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: "50%", background: "var(--twx-coral)", boxShadow: "0 0 0 2px var(--twx-dark)" }} />
            </div>
            <div className="mt-0.5 flex justify-between text-[6.5px] tabular-nums" style={{ color: "var(--twx-on-dark-muted)" }}>
              <span>{(RANGE[0] / 1e6).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M Ft</span>
              <span>{(RANGE[1] / 1e6).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} M Ft</span>
            </div>
          </div>

          {/* Adattábla — két oszlop */}
          <div className="mt-2 text-[7px] font-semibold uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>Az ingatlan adatai</div>
          <div className="mt-0.5 grid grid-cols-2 gap-x-2">
            {FIELDS.map((f) => (
              <div key={f.label} className="flex justify-between gap-1 border-b py-[2px] text-[7px]" style={{ borderColor: "var(--twx-line)" }}>
                <span className="truncate" style={{ color: "var(--twx-ink-muted)" }}>{f.label}</span>
                <span className="truncate text-right font-medium">{f.value}</span>
              </div>
            ))}
          </div>

          {/* Indoklások */}
          <div className="mt-2 text-[7px] font-semibold uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>Miért ennyi az ár?</div>
          <ul className="mt-0.5 space-y-[2px]">
            {REASONS.map((r, i) => {
              const on = t >= REASON_AT + i * REASON_STEP;
              return (
                <li key={r} className="flex items-center gap-1 text-[7px]"
                  style={{ opacity: on ? 1 : 0, transform: on ? "translateY(0)" : "translateY(3px)", transition: "opacity .35s, transform .35s" }}>
                  <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--twx-coral)" }} />
                  <span className="truncate">{r}</span>
                </li>
              );
            })}
          </ul>

          {/* Két fotó-hely — a kész értékbecslésen ide kerül a partner két képe az ingatlanról */}
          {/* Alacsony sáv (fix 34 px), hogy a lap alja biztosan ne vágódjon le. */}
          <div className="mt-auto grid grid-cols-2 gap-1.5 pt-1.5">
            {[1, 2].map((n) => (
              <div key={n} className="flex h-[34px] items-center justify-center gap-1 rounded-md"
                style={{ background: "linear-gradient(135deg, var(--twx-coral-soft), var(--twx-cream))", border: "1px dashed rgba(122,46,23,0.35)", color: "#7a2e17" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" />
                </svg>
                <span className="text-[6.5px] font-semibold">{n}. fotó</span>
              </div>
            ))}
          </div>

          {/* Lábléc */}
          <div className="mt-1.5 flex items-center justify-between border-t pt-1 text-[6.5px]" style={{ borderColor: "var(--twx-line)", color: "var(--twx-ink-muted)" }}>
            <span>TWINX partner · +36 30 000 0000</span>
            <span>1/1</span>
          </div>
        </div>

        {/* „PDF letöltve" */}
        <div className="absolute right-2 top-9 flex items-center gap-1 rounded-full px-2 py-0.5 text-[7px] font-semibold"
          style={{ background: "rgba(22,163,74,0.14)", color: "#15803d", opacity: done ? 1 : 0, transform: done ? "scale(1)" : "scale(0.8)", transition: "opacity .3s, transform .3s" }}>
          ✓ PDF letöltve
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Háttér-motívumok: vonalas ház, kulcs, m², trendvonal, alaprajz — halványan,
// lassan sodródva (a meglévő twx-orb / twx-orb-2 lebegés-animációval).
// ---------------------------------------------------------------------------
function Motifs() {
  const stroke = "rgba(239,122,90,0.55)";
  const common = { fill: "none", stroke, strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden style={{ opacity: 0.22 }}>
      {/* Ház — bal felső */}
      <svg className="twx-orb absolute left-[5%] top-[10%] h-12 w-12 sm:h-16 sm:w-16" viewBox="0 0 24 24" {...common}>
        <path d="M3 11 12 4l9 7" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" />
      </svg>
      {/* Kulcs — jobb felső */}
      <svg className="twx-orb-2 absolute right-[6%] top-[14%] h-10 w-10 sm:h-14 sm:w-14" viewBox="0 0 24 24" {...common}>
        <circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3M21 12v2" />
      </svg>
      {/* Trendvonal — bal alsó */}
      <svg className="twx-orb-2 absolute bottom-[12%] left-[7%] h-14 w-20 sm:h-20 sm:w-28" viewBox="0 0 40 24" {...common}>
        <path d="M2 20 12 13l7 4 9-9 10 5" /><path d="M2 22h36" strokeOpacity="0.5" />
      </svg>
      {/* m² — jobb alsó */}
      <svg className="twx-orb absolute bottom-[14%] right-[8%] h-10 w-14 sm:h-14 sm:w-20" viewBox="0 0 36 24" {...common}>
        <path d="M3 21h30M3 21V6M3 21l3-3M33 21l-3-3M3 6l3 3" strokeOpacity="0.6" />
        <text x="18" y="15" textAnchor="middle" fontSize="9" fontWeight="700" fill={stroke} stroke="none">m²</text>
      </svg>
      {/* Alaprajz — középen fent, egészen halványan */}
      <svg className="twx-orb absolute left-1/2 top-[4%] h-8 w-12 -translate-x-1/2 sm:h-10 sm:w-16" viewBox="0 0 36 24" {...common} strokeOpacity="0.5">
        <rect x="2" y="2" width="32" height="20" /><path d="M14 2v12M14 14h20M2 12h8" />
      </svg>
    </div>
  );
}
