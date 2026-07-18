// dashboard/hospitality/menu — Menü Generátor: paraméterek -> AI napi/heti menü
// a partner saját ételeiből (profit-cél szerint szűrve). Egy generálás 1 kredit.
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ModuleIntro from "@/components/ModuleIntro";
import { showToast } from "@/components/Toast";
import {
  TIMEFRAMES,
  MENU_THEMES,
  PROFIT_GOALS,
  WEEK_DAYS,
  CUISINE_STYLES,
  COURSE_STRUCTURES,
  courseStructure,
  VARIETY_OPTIONS,
  timeframeDays,
  formatHuf,
} from "@/lib/hospitality";

export default function MenuGeneratorPage() {
  const [timeframe, setTimeframe] = useState("1");
  const [theme, setTheme] = useState("valtozatos");
  const [goal, setGoal] = useState("medium");
  const [courses, setCourses] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [variety, setVariety] = useState("normal");
  const [targetCount, setTargetCount] = useState("");
  const [targetProfit, setTargetProfit] = useState("");
  const [profitOpen, setProfitOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [dayPlan, setDayPlan] = useState<Record<string, string>>({});
  // day -> (course-kulcs -> étel neve)
  const [dishPlan, setDishPlan] = useState<Record<string, Record<string, string>>>({});
  const [cuisineOpen, setCuisineOpen] = useState(false);
  const [editDay, setEditDay] = useState<string | null>(null);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [dishesData, setDishesData] = useState<
    { name: string; cuisine_style: string | null; category: string; cost_price: number | null; sale_price: number | null }[]
  >([]);

  // Fogás-slotok a választott struktúra szerint (fogáshoz tartozó étel-kategóriákkal).
  const struct = courseStructure(courses);
  const courseSlots: { key: string; label: string; cats: string[] }[] =
    struct.slots.length ? struct.slots : [{ key: "etel", label: "Konkrét étel", cats: [] }];

  // A kiválasztott konyhához (és fogás-kategóriákhoz) tartozó ételek nevei.
  function dishOptions(cuisine: string, cats: string[]): string[] {
    let src = cuisine
      ? dishesData.filter((d) => (d.cuisine_style ?? "").toLowerCase() === cuisine.toLowerCase())
      : dishesData;
    if (cats.length) src = src.filter((d) => cats.includes(d.category));
    return Array.from(new Set(src.map((d) => d.name).filter(Boolean))).sort((a, b) => a.localeCompare(b, "hu"));
  }
  const [dishCount, setDishCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);

  // A partner felvitt konyhatípusai (a napi választóhoz) + étel-szám.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/hospitality/dishes");
        const data = await res.json();
        if (res.ok) {
          const list = (data.dishes ?? []) as {
            name: string; cuisine_style: string | null; category: string; cost_price: number | null; sale_price: number | null;
          }[];
          setDishesData(list);
          setDishCount(list.length);
          const uniq = Array.from(new Set(list.map((d) => d.cuisine_style ?? "").filter(Boolean)));
          setCuisines(uniq.length ? uniq.sort((a, b) => a.localeCompare(b, "hu")) : [...CUISINE_STYLES]);
        }
      } catch {
        setCuisines([...CUISINE_STYLES]);
      }
    })();
  }, []);

  async function generate() {
    setLoading(true);
    setMenu(null);
    try {
      const res = await fetch("/api/hospitality/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeframe,
          theme,
          goal,
          courses,
          targetPrice,
          variety,
          targetCount,
          targetProfit,
          instruction,
          dayPlan: Array.from(new Set([...Object.keys(dayPlan), ...Object.keys(dishPlan)]))
            .map((day) => ({
              day,
              cuisine: dayPlan[day] || "",
              dishes: Object.values(dishPlan[day] || {}).filter(Boolean),
            }))
            .filter((e) => e.cuisine || e.dishes.length),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Nem sikerült a generálás.", "error");
        return;
      }
      setMenu(data.menu as string);
      showToast(
        data.charged ? "Menü elkészült — 1 kredit levonva." : "Menü elkészült.",
        "success"
      );
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setLoading(false);
    }
  }

  // A napi konyha-beosztáshoz: 7 napnál a hét napjai, egyébként „1. nap, 2. nap…".
  const days = timeframeDays(timeframe);
  const planDays: { value: string; label: string }[] =
    timeframe === "7"
      ? WEEK_DAYS.map((d) => ({ value: d.value, label: d.label }))
      : Array.from({ length: days }, (_, i) => ({ value: `nap${i + 1}`, label: `${i + 1}. nap` }));

  // ---- Profit-figyelmeztetés (determinisztikus, generálás előtt) ----
  const requiredPerMenu =
    Number(targetCount) > 0 && Number(targetProfit) > 0 ? Number(targetProfit) / Number(targetCount) : 0;
  // Profit-becslés fogás-csoportjai: a struktúra szerint; „nincs megkötve"-nél 3 fogás feltételezés.
  const courseCatGroups: string[][] = struct.slots.length
    ? struct.slots.map((s) => s.cats)
    : [["eloetel", "leves"], ["foetel", "koret"], ["desszert"]];
  const profitOf = (d: { cost_price: number | null; sale_price: number | null }) =>
    d.cost_price != null && d.sale_price != null ? d.sale_price - d.cost_price : 0;

  function bestDayProfit(dayValue: string): number {
    const cuisine = (dayPlan[dayValue] ?? "").toLowerCase();
    const pool = dishesData.filter((d) => !cuisine || (d.cuisine_style ?? "").toLowerCase() === cuisine);
    const pinnedNames = new Set(Object.values(dishPlan[dayValue] || {}).filter(Boolean));
    let total = 0;
    for (const cats of courseCatGroups) {
      const pinned = pool.find((d) => pinnedNames.has(d.name) && cats.includes(d.category));
      let chosen = pinned;
      if (!chosen) {
        const cands = pool.filter((d) => cats.includes(d.category));
        if (cands.length) chosen = cands.reduce((b, d) => (profitOf(d) > profitOf(b) ? d : b));
      }
      if (chosen) total += profitOf(chosen);
    }
    return total;
  }

  // Csere-javaslat a legkritikusabb rögzített ételre.
  function swapSuggestion(dayValue: string): string | null {
    const cuisine = (dayPlan[dayValue] ?? "").toLowerCase();
    const pool = dishesData.filter((d) => !cuisine || (d.cuisine_style ?? "").toLowerCase() === cuisine);
    const pinned = Object.values(dishPlan[dayValue] || {})
      .filter(Boolean)
      .map((name) => pool.find((d) => d.name === name))
      .filter((d): d is (typeof dishesData)[number] => Boolean(d));
    if (!pinned.length) return null;
    const worst = pinned.reduce((a, b) => (profitOf(a) < profitOf(b) ? a : b));
    const alts = pool.filter((d) => d.category === worst.category && d.name !== worst.name && profitOf(d) > profitOf(worst));
    if (!alts.length) return null;
    const best = alts.reduce((a, b) => (profitOf(a) > profitOf(b) ? a : b));
    return `Cseréld a rögzített „${worst.name}" (${formatHuf(profitOf(worst))}/db) ételt erre: „${best.name}" (${formatHuf(profitOf(best))}/db, +${formatHuf(profitOf(best) - profitOf(worst))}).`;
  }

  const profitWarning = (() => {
    if (requiredPerMenu <= 0) return null;
    const per = planDays.map((d) => ({ d, best: bestDayProfit(d.value) }));
    const infeasible = per.filter((x) => x.best < requiredPerMenu - 0.5);
    if (!infeasible.length) return null;
    const worst = infeasible.reduce((a, b) => (a.best < b.best ? a : b));
    const avgBest = per.reduce((s, x) => s + x.best, 0) / per.length;
    return {
      required: requiredPerMenu,
      worstLabel: worst.d.label,
      worstBest: worst.best,
      gap: requiredPerMenu - worst.best,
      swap: swapSuggestion(worst.d.value),
      achievableY: Math.max(0, avgBest * Number(targetCount)),
      avgBest,
      dayCount: infeasible.length,
    };
  })();

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Menü"
        title="Menü generátor"
        subtitle="Állítsd be az időtávot, a tematikát és a profit-célt — az AI a saját kínálatodból rak össze egy vonzó menüsort, a haszonkulcsod szerint súlyozva. Egy generálás 1 kredit."
        icon="menu"
        chips={["Napi / Heti", "Profit-cél", "A saját kínálatodból"]}
      />

      <div className="twx-card space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm">Időtáv</label>
            <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="twx-input mt-1">
              {TIMEFRAMES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm">Tematika</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)} className="twx-input mt-1">
              {MENU_THEMES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm">Profit cél</label>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className="twx-input mt-1">
              {PROFIT_GOALS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm">Fogások</label>
            <select value={courses} onChange={(e) => setCourses(e.target.value)} className="twx-input mt-1">
              {COURSE_STRUCTURES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm">Változatosság</label>
            <select value={variety} onChange={(e) => setVariety(e.target.value)} className="twx-input mt-1">
              {VARIETY_OPTIONS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Szabad instrukció */}
        <div>
          <label className="block text-sm">Egyedi instrukció (opcionális)</label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            className="twx-input mt-1"
            placeholder="pl. legyen minden nap egy vegán opció; a hétvége legyen prémium; kerüld a csípőset"
          />
        </div>

        {/* Napi beosztás — összecsukható legördülő (naponként konyha + fő alapanyag), 1 naptól */}
        {days >= 1 && (
          <div className="rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
            <button
              type="button"
              onClick={() => setCuisineOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--twx-coral)" }}>
                Napi beosztás — opcionális
              </span>
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-lg transition-transform duration-200"
                style={{ background: "rgba(239,122,90,0.12)", color: "var(--twx-coral)", transform: cuisineOpen ? "rotate(45deg)" : "none" }}
              >
                +
              </span>
            </button>
            <AnimatePresence initial={false}>
              {cuisineOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="px-4 pb-4">
                    <p className="mb-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      Kattints egy napra — a felugró ablakban add meg a <b>konyhát</b> és fogásonként a <b>konkrét ételt</b>. Amit üresen hagysz, azt a <b>Twinx</b> tölti fel.
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {planDays.map((d) => {
                        const cuisine = dayPlan[d.value] ?? "";
                        const chosen = Object.values(dishPlan[d.value] || {}).filter(Boolean).length;
                        const configured = Boolean(cuisine) || chosen > 0;
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setEditDay(d.value)}
                            className="rounded-xl p-3 text-left transition-all hover:-translate-y-0.5"
                            style={{
                              border: `1px solid ${configured ? "var(--twx-coral)" : "var(--twx-line)"}`,
                              background: configured ? "rgba(239,122,90,0.06)" : "transparent",
                            }}
                          >
                            <span className="block text-sm font-medium">{d.label}</span>
                            <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                              {[cuisine || null, chosen ? `${chosen} étel` : null].filter(Boolean).join(" · ") || "Twinx dönt"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Napi beosztás szerkesztő — felugró ablak */}
        <AnimatePresence>
          {editDay && (() => {
            const d = planDays.find((x) => x.value === editDay);
            if (!d) return null;
            const cuisine = dayPlan[d.value] ?? "";
            return (
              <motion.div
                key="daymodal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditDay(null)}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: "rgba(12,11,10,0.6)" }}
              >
                <motion.div
                  onClick={(e) => e.stopPropagation()}
                  initial={{ scale: 0.94, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="twx-card w-full max-w-md p-5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-display text-lg font-medium">{d.label} — beosztás</h3>
                    <button
                      type="button"
                      onClick={() => setEditDay(null)}
                      aria-label="Bezárás"
                      className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                      style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}
                    >
                      ×
                    </button>
                  </div>
                  <label className="block text-sm">Konyha (opcionális)</label>
                  <select
                    value={cuisine}
                    onChange={(e) => {
                      const c = e.target.value;
                      setDayPlan((p) => ({ ...p, [d.value]: c }));
                      setDishPlan((p) => ({ ...p, [d.value]: {} }));
                    }}
                    className="twx-input mt-1"
                  >
                    <option value="">— konyha —</option>
                    {cuisines.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                  <div className="mt-3 space-y-3">
                    {courseSlots.map((slot) => {
                      const opts = dishOptions(cuisine, slot.cats);
                      return (
                        <div key={slot.key}>
                          <label className="block text-sm">{slot.label}</label>
                          <select
                            value={dishPlan[d.value]?.[slot.key] ?? ""}
                            onChange={(e) =>
                              setDishPlan((p) => ({ ...p, [d.value]: { ...(p[d.value] || {}), [slot.key]: e.target.value } }))
                            }
                            className="twx-input mt-1"
                            disabled={opts.length === 0}
                          >
                            <option value="">{opts.length === 0 ? "— nincs elérhető étel —" : "— Twinx dönt —"}</option>
                            {opts.map((name) => (<option key={name} value={name}>{name}</option>))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => setEditDay(null)} className="twx-btn mt-4 w-full">
                    Kész
                  </button>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Profit-terv — összecsukható (később több opcióval bővíthető) */}
        <div className="rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
          <button
            type="button"
            onClick={() => setProfitOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--twx-coral)" }}>
              Profit-terv — opcionális
            </span>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-lg transition-transform duration-200"
              style={{ background: "rgba(239,122,90,0.12)", color: "var(--twx-coral)", transform: profitOpen ? "rotate(45deg)" : "none" }}
            >
              +
            </span>
          </button>
          <AnimatePresence initial={false}>
            {profitOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: "hidden" }}
              >
                <div className="px-4 pb-4">
                  <p className="mb-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    A bevétel/profit hangolásához. Add meg <b>egy menü célárát</b> (mennyibe kerüljön egy napi menü a vendégnek), és/vagy hogy hány menü eladásából mennyi profitot szeretnél — a rendszer az ételek darab-profitjából (eladási − előkészítési ár) ehhez igazítja a menüt.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-sm">Egy menü célára (Ft)</label>
                      <input type="number" min={0} value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} className="twx-input mt-1" placeholder="pl. 2500 / menü" />
                    </div>
                    <div>
                      <label className="block text-sm">Tervezett eladott menü (db)</label>
                      <input type="number" min={0} value={targetCount} onChange={(e) => setTargetCount(e.target.value)} className="twx-input mt-1" placeholder="pl. 100" />
                    </div>
                    <div>
                      <label className="block text-sm">Cél össz-profit (Ft)</label>
                      <input type="number" min={0} value={targetProfit} onChange={(e) => setTargetProfit(e.target.value)} className="twx-input mt-1" placeholder="pl. 200000" />
                    </div>
                  </div>
                  {Number(targetCount) > 0 && Number(targetProfit) > 0 && (
                    <p className="mt-2 text-sm" style={{ color: "var(--twx-coral)" }}>
                      Ehhez menünként kb. <b>{Math.round(Number(targetProfit) / Number(targetCount)).toLocaleString("hu-HU")} Ft</b> darab-profit szükséges — az AI ehhez igazítja a válogatást.
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {profitWarning && (
          <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(239,122,90,0.08)", border: "1px solid var(--twx-coral)" }}>
            <p className="font-medium" style={{ color: "var(--twx-coral)" }}>⚠ A profit-cél így valószínűleg nem jön ki</p>
            <p className="mt-1" style={{ color: "var(--twx-ink)" }}>
              Menünként ~<b>{formatHuf(profitWarning.required)}</b> darab-profit kellene, de <b>{profitWarning.dayCount}</b> napon
              ez a legjobb esetben sem érhető el. Legkritikusabb: <b>{profitWarning.worstLabel}</b>{" "}
              (max ~{formatHuf(profitWarning.worstBest)}, hiány −{formatHuf(profitWarning.gap)}).
            </p>
            {profitWarning.swap && (
              <p className="mt-2" style={{ color: "var(--twx-ink)" }}>Javaslat: {profitWarning.swap}</p>
            )}
            <p className="mt-2" style={{ color: "var(--twx-ink-muted)" }}>
              Vagy emelj árat pár ételen, vagy vedd lejjebb a célt: {Number(targetCount).toLocaleString("hu-HU")} menüből
              reálisan ~<b>{formatHuf(profitWarning.achievableY)}</b> profit (menünként ~{formatHuf(profitWarning.avgBest)}).
              Generálhatsz így is — a Twinx a lehető legjobb profitot hozza, de a cél nem garantált.
            </p>
          </div>
        )}
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Tipp: „Magas" profit-célnál a nagyobb haszonkulcsú ételek kerülnek előtérbe, de a menü
          változatos marad. {dishCount !== null && <>Jelenleg <b>{dishCount}</b> ételed van. </>}
          Vigyél fel eleget a{" "}
          <a href="/dashboard/hospitality/inventory" className="underline" style={{ color: "var(--twx-coral)" }}>
            Kínálat kezelőben
          </a>
          .
        </p>
        <button onClick={generate} disabled={loading} className="twx-btn">
          {loading ? "Menü készül…" : "Menü generálása (1 kredit)"}
        </button>
      </div>

      {loading && (
        <div className="twx-card p-6 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Az AI összeállítja a menüt a kínálatodból — ez néhány másodperc…
        </div>
      )}

      {menu && (
        <div className="twx-card p-6">
          <h2 className="font-display mb-3 text-lg font-medium">A javasolt menü</h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--twx-ink)" }}>
            {menu}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(menu);
                showToast("Menü a vágólapra másolva.", "info");
              }}
              className="rounded-full px-4 py-2 text-sm font-medium"
              style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink)" }}
            >
              Másolás
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
