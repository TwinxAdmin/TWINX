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
  COURSE_OPTIONS,
  VARIETY_OPTIONS,
  timeframeDays,
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
  const [ingredientPlan, setIngredientPlan] = useState<Record<string, string>>({});
  const [cuisineOpen, setCuisineOpen] = useState(false);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<string[]>([]);
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
          const list = (data.dishes ?? []) as { cuisine_style: string | null; main_ingredients: string | null }[];
          setDishCount(list.length);
          const uniq = Array.from(new Set(list.map((d) => d.cuisine_style ?? "").filter(Boolean)));
          setCuisines(uniq.length ? uniq.sort((a, b) => a.localeCompare(b, "hu")) : [...CUISINE_STYLES]);
          // Alapanyagok kigyűjtése (vesszővel elválasztott tag-ek az ételekből).
          const ingSet = new Set<string>();
          for (const d of list) {
            (d.main_ingredients ?? "").split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => ingSet.add(s));
          }
          setIngredients(Array.from(ingSet).sort((a, b) => a.localeCompare(b, "hu")));
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
          dayPlan: Array.from(new Set([...Object.keys(dayPlan), ...Object.keys(ingredientPlan)]))
            .map((day) => ({ day, cuisine: dayPlan[day] || "", ingredient: ingredientPlan[day] || "" }))
            .filter((e) => e.cuisine || e.ingredient),
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
            <label className="block text-sm">Fogásszám</label>
            <select value={courses} onChange={(e) => setCourses(e.target.value)} className="twx-input mt-1">
              {COURSE_OPTIONS.map((c) => (
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

        {/* Napi konyha-beosztás — külön összecsukható legördülő (több napos menünél) */}
        {days > 1 && (
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
                      Naponként add meg a <b>konyhát</b> és/vagy a <b>fő alapanyagot</b> — pl. hétfő olasz + tészta. Üresen hagyva az AI dönt.
                      {ingredients.length === 0 && (
                        <> Alapanyag-választáshoz tölts ki „Fő alapanyagokat" a{" "}
                          <a href="/dashboard/hospitality/inventory" className="underline" style={{ color: "var(--twx-coral)" }}>Kínálat kezelőben</a>.
                        </>
                      )}
                    </p>
                    <div className="mb-1 hidden grid-cols-[3.5rem_1fr_1fr] gap-2 text-xs sm:grid" style={{ color: "var(--twx-ink-muted)" }}>
                      <span />
                      <span>Konyha</span>
                      <span>Fő alapanyag</span>
                    </div>
                    <div className="space-y-2">
                      {planDays.map((d) => (
                        <div key={d.value} className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-2">
                          <span className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>{d.label}</span>
                          <select
                            value={dayPlan[d.value] ?? ""}
                            onChange={(e) => setDayPlan((p) => ({ ...p, [d.value]: e.target.value }))}
                            className="twx-input"
                          >
                            <option value="">— konyha —</option>
                            {cuisines.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <select
                            value={ingredientPlan[d.value] ?? ""}
                            onChange={(e) => setIngredientPlan((p) => ({ ...p, [d.value]: e.target.value }))}
                            className="twx-input"
                            disabled={ingredients.length === 0}
                          >
                            <option value="">— alapanyag —</option>
                            {ingredients.map((ing) => (
                              <option key={ing} value={ing}>{ing}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

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
                    A bevétel/profit hangolásához. Add meg a napi célárat, és/vagy hogy hány menü eladásából mennyi profitot szeretnél — a rendszer az ételek darab-profitjából (eladási − előkészítési ár) ehhez igazítja a menüt.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-sm">Célár (Ft / nap)</label>
                      <input type="number" min={0} value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} className="twx-input mt-1" placeholder="pl. 2500" />
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
