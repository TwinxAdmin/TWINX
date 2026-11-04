// Bemutatkozó animáció: így lesz egy cég ismétlődő kézi munkájából napi szinten használt AI-modul. Négy szakasz, végtelenítve:
// 1. igényfelmérés → 2. a rendszer megépítése (adatforrások, feldolgozás, ellenőrzés, jóváhagyás, kimenetek) → 3. kész modul a
// saját arculattal → 4. mindennapi használat, felszabaduló idő (szemléltetés, nem mért adat). A szakaszra kattintva oda ugrik.
// Fix méretű kártya: váltáskor nem ugrál az oldal.
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Lang } from "@/lib/lang";

const CORAL = "#ef7a5a";
const CREAM = "#f4efe7";
const MUTED = "#a79f94";
const GREEN = "#7ed29f";
const STEP_MS = 7000;

const STEPS_BY = {
  hu: [
    { short: "Felmérés", title: "Felmérjük, mi viszi el az időt", sub: "Végignézzük a napi munkát, és kijelöljük, mit érdemes automatizálni." },
    { short: "Fejlesztés", title: "Megépítjük a rendszert", sub: "A meglévő adataidhoz kötve, gépi ellenőrzéssel és emberi jóváhagyással." },
    { short: "Kész modul", title: "A csapatod kész eszközt kap", sub: "A saját arculatoddal, egy kattintással használható." },
    { short: "Napi használat", title: "Mindennap neked dolgozik", sub: "Ami eddig kézi munka volt, abból gyorsan működő folyamat lesz." },
  ],
  en: [
    { short: "Discovery", title: "We find out what eats up your time", sub: "We walk through the daily work and mark what's worth automating." },
    { short: "Build", title: "We build the system", sub: "Connected to your existing data, with automated checks and human approval." },
    { short: "Ready tool", title: "Your team gets a ready tool", sub: "In your own brand, usable with a single click." },
    { short: "Daily use", title: "It works for you every day", sub: "What used to be manual work becomes a fast, working process." },
  ],
};

/* ---------- 1) Igényfelmérés: a feladatok közül kijelöljük az automatizálhatókat ---------- */
const TASKS_BY = {
  hu: [
    { t: "Árajánlat kézzel", tag: "minden nap", hit: true },
    { t: "Adatbevitel a CRM-be", tag: "ismétlődő", hit: true },
    { t: "Ügyféllevelek megválaszolása", tag: "", hit: false },
    { t: "Heti riport táblázatból", tag: "órákat visz el", hit: true },
    { t: "Stratégiai döntések", tag: "", hit: false },
    { t: "Dokumentumok ellenőrzése", tag: "ismétlődő", hit: true },
  ],
  en: [
    { t: "Writing quotes by hand", tag: "every day", hit: true },
    { t: "Entering data into the CRM", tag: "repetitive", hit: true },
    { t: "Answering client emails", tag: "", hit: false },
    { t: "Weekly report from spreadsheets", tag: "takes hours", hit: true },
    { t: "Strategic decisions", tag: "", hit: false },
    { t: "Checking documents", tag: "repetitive", hit: true },
  ],
};

function Discovery({ reduce, lang }: { reduce: boolean; lang: Lang }) {
  const TASKS = TASKS_BY[lang];
  return (
    <div className="grid h-full grid-cols-2 content-center gap-2 sm:gap-2.5">
      {TASKS.map((x, i) => (
        <motion.div key={x.t} className="relative flex min-h-[68px] flex-col justify-center rounded-xl px-3 py-2"
          initial={{ opacity: 0, y: reduce ? 0 : 10, boxShadow: "inset 0 0 0 1px rgba(244,239,231,.14)", background: "rgba(244,239,231,.05)" }}
          animate={{
            opacity: x.hit ? 1 : [0, 1, 1, 0.42], y: 0,
            boxShadow: x.hit ? "inset 0 0 0 1.5px rgba(239,122,90,.9)" : "inset 0 0 0 1px rgba(244,239,231,.1)",
            background: x.hit ? "rgba(239,122,90,.13)" : "rgba(244,239,231,.03)",
          }}
          transition={{
            opacity: { delay: i * 0.12, duration: x.hit ? 0.3 : 2.4, times: x.hit ? undefined : [0, 0.2, 0.7, 1] },
            y: { delay: i * 0.12, duration: 0.3 },
            boxShadow: { delay: 1.1 + i * 0.32, duration: 0.3 },
            background: { delay: 1.1 + i * 0.32, duration: 0.3 },
          }}>
          <span className="text-[12.5px] font-semibold leading-tight sm:text-[13.5px]" style={{ color: CREAM }}>{x.t}</span>
          {x.tag && (
            <motion.span className="mt-1 text-[10.5px] font-bold sm:text-[11px]" style={{ color: CORAL }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.25 + i * 0.32, duration: 0.3 }}>
              ● {x.tag}
            </motion.span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ---------- 2) A rendszer: adatforrások → feldolgozó lánc (visszacsatolással) → kimenetek ---------- */
const INS_Y = [26, 92, 158, 224], PIPE_Y = [18, 82, 146, 210], OUTS_Y = [62, 125, 188];
const SYSTEM = {
  hu: { ins: ["CRM", "Excel", "E-mail", "PDF"], pipe: ["Adatkinyerés", "AI-feldolgozás", "Gépi ellenőrzés", "Emberi jóváhagyás"], outs: ["Ajánlat", "Riport", "Tartalom"], aria: "Adatforrások, feldolgozó lánc ellenőrzéssel és jóváhagyással, majd kész anyagok" },
  en: { ins: ["CRM", "Excel", "Email", "PDF"], pipe: ["Data extraction", "AI processing", "Automated checks", "Human approval"], outs: ["Quote", "Report", "Content"], aria: "Data sources, a processing chain with checks and approval, then finished materials" },
};
const IN_W = 66, P_X = 104, P_W = 158, O_X = 306, O_W = 84, H_IN = 34, H_P = 44;

function System({ reduce, lang }: { reduce: boolean; lang: Lang }) {
  const sy = SYSTEM[lang];
  const INS = sy.ins.map((t, i) => ({ t, y: INS_Y[i] })), PIPE = sy.pipe.map((t, i) => ({ t, y: PIPE_Y[i] })), OUTS = sy.outs.map((t, i) => ({ t, y: OUTS_Y[i] }));
  const inPaths = INS.map((n) => `M${IN_W} ${n.y + H_IN / 2} C ${IN_W + 22} ${n.y + H_IN / 2}, ${P_X - 22} ${PIPE[0].y + H_P / 2}, ${P_X} ${PIPE[0].y + H_P / 2}`);
  const last = PIPE[PIPE.length - 1];
  const outPaths = OUTS.map((n) => `M${P_X + P_W} ${last.y + H_P / 2} C ${P_X + P_W + 22} ${last.y + H_P / 2}, ${O_X - 22} ${n.y + H_IN / 2}, ${O_X} ${n.y + H_IN / 2}`);
  const pipePaths = PIPE.slice(0, -1).map((n, i) => `M${P_X + P_W / 2} ${n.y + H_P} L${P_X + P_W / 2} ${PIPE[i + 1].y}`);
  const loop = `M${P_X + P_W} ${PIPE[2].y + H_P / 2} C ${P_X + P_W + 26} ${PIPE[2].y + H_P / 2}, ${P_X + P_W + 26} ${PIPE[1].y + H_P / 2}, ${P_X + P_W} ${PIPE[1].y + H_P / 2}`;
  const draw = (delay: number, dur = 0.45) => ({ initial: { pathLength: reduce ? 1 : 0 }, animate: { pathLength: 1 }, transition: { delay: reduce ? 0 : delay, duration: dur } });
  const pop = (delay: number) => ({ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: reduce ? 0 : delay, duration: 0.3 } });

  return (
    <svg viewBox="0 0 390 276" className="h-full w-full" role="img" aria-label={sy.aria}>
      {inPaths.map((d, i) => <motion.path key={d} d={d} fill="none" stroke={CORAL} strokeOpacity=".45" strokeWidth="1.4" {...draw(0.5 + i * 0.08)} />)}
      {pipePaths.map((d, i) => <motion.path key={d} d={d} fill="none" stroke={CORAL} strokeOpacity=".75" strokeWidth="1.6" {...draw(1.2 + i * 0.35, 0.25)} />)}
      <motion.path d={loop} fill="none" stroke={CREAM} strokeOpacity=".5" strokeWidth="1.3" strokeDasharray="3 4" {...pop(2.3)} />
      {outPaths.map((d, i) => <motion.path key={d} d={d} fill="none" stroke={GREEN} strokeOpacity=".55" strokeWidth="1.4" {...draw(2.7 + i * 0.1)} />)}

      {INS.map((n, i) => (
        <motion.g key={n.t} {...pop(i * 0.1)}>
          <rect x="0" y={n.y} width={IN_W} height={H_IN} rx="9" fill="rgba(244,239,231,.06)" stroke="rgba(244,239,231,.2)" />
          <text x={IN_W / 2} y={n.y + H_IN / 2 + 4} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={CREAM}>{n.t}</text>
        </motion.g>
      ))}
      {PIPE.map((n, i) => (
        <motion.g key={n.t} {...pop(0.95 + i * 0.35)}>
          <rect x={P_X} y={n.y} width={P_W} height={H_P} rx="11" fill={i === 1 ? CORAL : "rgba(239,122,90,.13)"} stroke={CORAL} strokeOpacity={i === 1 ? 1 : 0.55} />
          <text x={P_X + P_W / 2} y={n.y + H_P / 2 + 4.5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill={i === 1 ? "#1c1005" : CREAM}>{n.t}</text>
        </motion.g>
      ))}
      {OUTS.map((n, i) => (
        <motion.g key={n.t} {...pop(3 + i * 0.12)}>
          <rect x={O_X} y={n.y} width={O_W} height={H_IN} rx="9" fill="rgba(126,210,159,.12)" stroke={GREEN} strokeOpacity=".6" />
          <text x={O_X + O_W / 2} y={n.y + H_IN / 2 + 4} textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#bfeed3">✓ {n.t}</text>
        </motion.g>
      ))}

      {/* A rendszeren átfutó adat (csak mozgás engedélyezése esetén) */}
      {!reduce && (
        <motion.g {...pop(3.3)}>
          {inPaths.map((d, i) => (
            <circle key={d} r="2.8" fill={CREAM}><animateMotion dur="1.6s" begin={`${i * 0.4}s`} repeatCount="indefinite" path={d} /></circle>
          ))}
          <circle r="3.2" fill={CREAM}><animateMotion dur="2.2s" repeatCount="indefinite" path={`M${P_X + P_W / 2} ${PIPE[0].y + H_P} L${P_X + P_W / 2} ${last.y}`} /></circle>
          {outPaths.map((d, i) => (
            <circle key={d} r="2.8" fill={GREEN}><animateMotion dur="1.6s" begin={`${i * 0.5}s`} repeatCount="indefinite" path={d} /></circle>
          ))}
        </motion.g>
      )}
    </svg>
  );
}

/* ---------- 3) Kész modul: a cég saját felülete, egy kattintás, kész anyag ---------- */
const PRODUCT = {
  hu: { head: "A te céged · Ajánlat-modul", rows: [["Ügyfél", "Minta Kft."], ["Szolgáltatás", "Éves karbantartás"]], btn: "Ajánlat készítése", done: "✓ Márkázott árajánlat kész, mehet az ügyfélnek", mark: "C" },
  en: { head: "Your company · Quote module", rows: [["Client", "Sample Ltd."], ["Service", "Annual maintenance"]], btn: "Create quote", done: "✓ Branded quote ready to send to the client", mark: "C" },
};

function Product({ reduce, lang }: { reduce: boolean; lang: Lang }) {
  const tx = PRODUCT[lang];
  const d = (s: number) => (reduce ? 0 : s);
  return (
    <div className="flex h-full items-center justify-center">
      <motion.div className="w-full max-w-[430px] overflow-hidden rounded-2xl" style={{ background: "#fdfbf6", color: "#1c1815", boxShadow: "0 18px 44px rgba(0,0,0,.45)" }}
        initial={{ opacity: 0, y: reduce ? 0 : 16, scale: reduce ? 1 : 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45 }}>
        <div className="flex h-10 items-center gap-2 px-3.5" style={{ background: "#1c1815", color: CREAM }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold" style={{ background: CORAL, color: "#1c1005" }}>C</span>
          <span className="text-[12.5px] font-bold">{tx.head}</span>
        </div>
        <div className="space-y-2 p-3.5">
          {tx.rows.map(([k, v], i) => (
            <div key={k} className="flex h-9 items-center justify-between rounded-lg px-3 text-[12.5px]" style={{ boxShadow: "inset 0 0 0 1px #e8e1d6" }}>
              <span style={{ color: "#6e655c" }}>{k}</span>
              <motion.b initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d(0.6 + i * 0.5), duration: 0.3 }}>{v}</motion.b>
            </div>
          ))}
          <motion.div className="flex h-10 items-center justify-center rounded-lg text-[13px] font-bold text-white" style={{ background: "#c4553a" }}
            animate={reduce ? undefined : { scale: [1, 1, 0.96, 1] }} transition={{ delay: 1.8, duration: 0.45, times: [0, 0.3, 0.6, 1] }}>
            {tx.btn}
          </motion.div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "#efe8dc" }}>
            <motion.div className="h-full rounded-full" style={{ background: CORAL, transformOrigin: "left" }}
              initial={{ scaleX: reduce ? 1 : 0 }} animate={{ scaleX: 1 }} transition={{ delay: d(2.3), duration: 1.1, ease: "easeInOut" }} />
          </div>
          <motion.div className="flex h-10 items-center gap-2 rounded-lg px-3 text-[12.5px] font-bold" style={{ background: "#e5f1e9", color: "#2f7a4f" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d(3.5), duration: 0.35 }}>
            {tx.done}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- 4) Napi használat: a hét minden napján fut, a kézi munka csökken ---------- */
const DAILY = {
  hu: { days: ["H", "K", "Sze", "Cs", "P"], manual: "Kézi munka", freed: "Felszabadult idő", note: "Szemléltető ábra, a megtakarítás folyamatonként más." },
  en: { days: ["Mon", "Tue", "Wed", "Thu", "Fri"], manual: "Manual work", freed: "Time freed up", note: "Illustrative chart; savings differ by process." },
};

function Daily({ reduce, lang }: { reduce: boolean; lang: Lang }) {
  const tx = DAILY[lang], DAYS = tx.days;
  const d = (s: number) => (reduce ? 0 : s);
  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <div className="grid grid-cols-5 gap-2">
        {DAYS.map((x, i) => (
          <motion.div key={x} className="flex h-[70px] flex-col items-center justify-center gap-1 rounded-xl"
            initial={{ background: "rgba(244,239,231,.05)" }} animate={{ background: "rgba(126,210,159,.15)" }} transition={{ delay: d(0.2 + i * 0.32), duration: 0.3 }}>
            <span className="text-[12px] font-bold" style={{ color: MUTED }}>{x}</span>
            <motion.span className="text-[17px] font-extrabold" style={{ color: GREEN }} initial={{ opacity: 0, scale: reduce ? 1 : 0.5 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: d(0.3 + i * 0.32), duration: 0.3 }}>✓</motion.span>
          </motion.div>
        ))}
      </div>
      <div className="space-y-3">
        <Bar label={tx.manual} color="rgba(244,239,231,.45)" from={1} to={0.2} delay={d(1.6)} reduce={reduce} />
        <Bar label={tx.freed} color={CORAL} from={0.02} to={0.8} delay={d(1.6)} reduce={reduce} />
      </div>
      <p className="text-[11px]" style={{ color: MUTED }}>{tx.note}</p>
    </div>
  );
}

function Bar({ label, color, from, to, delay, reduce }: { label: string; color: string; from: number; to: number; delay: number; reduce: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[12.5px] font-semibold" style={{ color: CREAM }}>{label}</p>
      <div className="h-3 overflow-hidden rounded-full" style={{ background: "rgba(244,239,231,.08)" }}>
        <motion.div className="h-full rounded-full" style={{ background: color, transformOrigin: "left" }}
          initial={{ scaleX: reduce ? to : from }} animate={{ scaleX: to }} transition={{ delay, duration: 1.8, ease: "easeInOut" }} />
      </div>
    </div>
  );
}

/* ---------- A kártya ---------- */
export default function AiSystemAnim({ lang = "hu" }: { lang?: Lang }) {
  const STEPS = STEPS_BY[lang];
  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0);
  const reduce = useReducedMotion() ?? false;
  useEffect(() => {
    const t = setTimeout(() => { setStep((s) => (s + 1) % STEPS_BY.hu.length); setTick((n) => n + 1); }, STEP_MS);
    return () => clearTimeout(t);
  }, [tick]);
  const cur = STEPS[step];

  return (
    <div className="w-full rounded-3xl p-4 sm:p-5" style={{ background: "rgba(28,24,21,.86)", boxShadow: "inset 0 0 0 1px rgba(239,122,90,.32), 0 24px 60px rgba(0,0,0,.4)" }}>
      {/* Szakaszok */}
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label={lang === "en" ? "Stages of development" : "A fejlesztés szakaszai"}>
        {STEPS.map((s, i) => (
          <button key={s.short} type="button" role="tab" aria-selected={i === step} onClick={() => { setStep(i); setTick((n) => n + 1); }}
            className="min-w-0 rounded-lg px-1 pb-1 pt-1.5 text-center">
            <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold"
              style={i === step ? { background: CORAL, color: "#1c1005" } : i < step ? { background: "rgba(239,122,90,.22)", color: CORAL } : { background: "rgba(244,239,231,.08)", color: MUTED }}>
              {i < step ? "✓" : i + 1}
            </span>
            <span className="mt-1 block h-[28px] text-[10.5px] font-semibold leading-tight sm:text-[11.5px]" style={{ color: i === step ? CREAM : MUTED }}>{s.short}</span>
            <span className="block h-[3px] overflow-hidden rounded-full" style={{ background: "rgba(244,239,231,.1)" }}>
              {i === step && (
                <motion.span key={tick} className="block h-full rounded-full" style={{ background: CORAL, transformOrigin: "left" }}
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: STEP_MS / 1000, ease: "linear" }} />
              )}
              {i < step && <span className="block h-full rounded-full" style={{ background: "rgba(239,122,90,.5)" }} />}
            </span>
          </button>
        ))}
      </div>

      {/* Tartalom: fix magasság, a szakaszok ugyanabban a keretben váltanak */}
      <div className="mt-4 h-[66px] sm:h-[62px]">
        <p className="font-display text-[19px] font-bold leading-tight sm:text-[21px]" style={{ color: CREAM }}>{cur.title}</p>
        <p className="mt-1 text-[12.5px] leading-snug sm:text-[13.5px]" style={{ color: "#cfc6bb" }}>{cur.sub}</p>
      </div>
      <div className="mt-3 h-[300px] sm:h-[310px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tick} className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            {step === 0 && <Discovery reduce={reduce} lang={lang} />}
            {step === 1 && <System reduce={reduce} lang={lang} />}
            {step === 2 && <Product reduce={reduce} lang={lang} />}
            {step === 3 && <Daily reduce={reduce} lang={lang} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
