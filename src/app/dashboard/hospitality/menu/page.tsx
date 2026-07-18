// dashboard/hospitality/menu — Menü Generátor: paraméterek -> AI napi/heti menü
// a partner saját ételeiből (profit-cél szerint szűrve). Egy generálás 1 kredit.
"use client";

import { useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import { showToast } from "@/components/Toast";
import { TIMEFRAMES, MENU_THEMES, PROFIT_GOALS } from "@/lib/hospitality";

export default function MenuGeneratorPage() {
  const [timeframe, setTimeframe] = useState("daily");
  const [theme, setTheme] = useState("valtozatos");
  const [goal, setGoal] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setMenu(null);
    try {
      const res = await fetch("/api/hospitality/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframe, theme, goal }),
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
        </div>
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Tipp: „Magas" profit-célnál a nagyobb haszonkulcsú ételek kerülnek előtérbe, de a menü
          változatos marad. Előbb vigyél fel elég ételt a{" "}
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
