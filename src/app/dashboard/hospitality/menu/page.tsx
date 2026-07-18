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
} from "@/lib/hospitality";

export default function MenuGeneratorPage() {
  const [timeframe, setTimeframe] = useState("daily");
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
  const [cuisines, setCuisines] = useState<string[]>([]);
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
          const list = (data.dishes ?? []) as { cuisine_style: string | null }[];
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
          dayPlan: Object.entries(dayPlan)
            .filter(([, cuisine]) => cuisine)
            .map(([day, cuisine]) => ({ day, cuisine })),
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

        {/* Napokra bontott konyha-beosztás — csak heti menünél */}
        {timeframe === "weekly" && (
          <div>
            <label className="block text-sm">Napi konyha-beosztás (opcionális)</label>
            <p className="mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Add meg, melyik napon milyen konyha legyen — pl. hétfő kínai, kedd fitness. Üresen hagyva az AI dönt.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {WEEK_DAYS.map((d) => (
                <div key={d.value} className="flex items-center gap-2">
                  <span className="w-20 flex-none text-sm" style={{ color: "var(--twx-ink-muted)" }}>{d.label}</span>
                  <select
                    value={dayPlan[d.value] ?? ""}
                    onChange={(e) => setDayPlan((p) => ({ ...p, [d.value]: e.target.value }))}
                    className="twx-input"
                  >
                    <option value="">—</option>
                    {cuisines.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
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
