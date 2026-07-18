// dashboard/hospitality/inventory — Kínálat Kezelő: a partner saját étel-adatbázisa.
// Étel felvitele (név, leírás, kategória, konyha-stílus, profitmarzs) + lista + törlés.
"use client";

import { useEffect, useState, type FormEvent } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import { showToast } from "@/components/Toast";
import {
  DISH_CATEGORIES,
  PROFIT_MARGINS,
  CUISINE_STYLES,
  categoryLabel,
  marginLabel,
  type Dish,
} from "@/lib/hospitality";

const EMPTY = { name: "", description: "", category: "foetel", cuisine_style: "", profit_margin: "medium" };

export default function InventoryPage() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cuisineMode, setCuisineMode] = useState<"list" | "custom">("list");

  // Konyhatípusok: alaplista + a partner által korábban felvitt saját típusok.
  const cuisineOptions = Array.from(
    new Set<string>([...CUISINE_STYLES, ...dishes.map((d) => d.cuisine_style ?? "").filter(Boolean)])
  ).sort((a, b) => a.localeCompare(b, "hu"));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/hospitality/dishes");
        const data = await res.json();
        if (res.ok) setDishes(data.dishes ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function addDish(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/hospitality/dishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        showToast(data.error ?? "Nem sikerült menteni.", "error");
        return;
      }
      setDishes((prev) => [data.dish, ...prev]);
      setForm({ ...EMPTY });
      showToast("Étel hozzáadva.", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeDish(id: string) {
    const prev = dishes;
    setDishes((d) => d.filter((x) => x.id !== id));
    const res = await fetch(`/api/hospitality/dishes?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setDishes(prev);
      showToast("Nem sikerült törölni.", "error");
    } else {
      showToast("Étel törölve.", "info");
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Kínálat"
        title="Kínálat kezelő"
        subtitle="Vidd fel az ételeidet a profitmarzzsal együtt — ez a saját, privát étlap-adatbázisod. A menü generátor kizárólag ezekből dolgozik, így az AI sosem talál ki nem létező fogást."
        icon="inventory"
        chips={["Privát adatbázis", "Profitmarzs", "RAG-forrás"]}
      />

      {/* Új étel */}
      <form onSubmit={addDish} className="twx-card space-y-3 p-5">
        <h2 className="font-display text-lg font-medium">Új étel felvitele</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm">Étel neve *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className="twx-input mt-1" placeholder="pl. Gulyásleves" />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm">Leírás / összetevők</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="twx-input mt-1" placeholder="pl. marhalábszár, burgonya, csipetke, füstölt paprika" />
          </div>
          <div>
            <label className="block text-sm">Kategória *</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)} className="twx-input mt-1">
              {DISH_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
          </div>
          <div>
            <label className="block text-sm">Profitmarzs *</label>
            <select value={form.profit_margin} onChange={(e) => set("profit_margin", e.target.value)} className="twx-input mt-1">
              {PROFIT_MARGINS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {errors.profit_margin && <p className="mt-1 text-xs text-red-600">{errors.profit_margin}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm">Konyha típusa</label>
            {cuisineMode === "list" ? (
              <select
                value={form.cuisine_style}
                onChange={(e) => {
                  if (e.target.value === "__add__") {
                    setCuisineMode("custom");
                    set("cuisine_style", "");
                  } else {
                    set("cuisine_style", e.target.value);
                  }
                }}
                className="twx-input mt-1"
              >
                <option value="">— válassz —</option>
                {cuisineOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__add__">+ Saját típus hozzáadása…</option>
              </select>
            ) : (
              <div className="mt-1 flex gap-2">
                <input
                  value={form.cuisine_style}
                  onChange={(e) => set("cuisine_style", e.target.value)}
                  className="twx-input"
                  placeholder="pl. libanoni, perui, baszk…"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setCuisineMode("list"); set("cuisine_style", ""); }}
                  className="flex-none rounded-full px-3 text-sm"
                  style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}
                >
                  Lista
                </button>
              </div>
            )}
          </div>
        </div>
        <button type="submit" disabled={saving} className="twx-btn">
          {saving ? "Mentés…" : "Étel hozzáadása"}
        </button>
      </form>

      {/* Étel-lista */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">Ételeim</h2>
          {!loading && <span className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>{dishes.length} db</span>}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : dishes.length === 0 ? (
          <div className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Még nincs ételed. Vidd fel az elsőt fentebb — utána generálhatsz belőle menüt.
          </div>
        ) : (
          <ul className="space-y-2">
            {dishes.map((d) => (
              <li key={d.id} className="twx-card flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{d.name}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                      {categoryLabel(d.category)}
                    </span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                      {marginLabel(d.profit_margin)} haszon
                    </span>
                    {d.cuisine_style && (
                      <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>· {d.cuisine_style}</span>
                    )}
                  </div>
                  {d.description && (
                    <p className="mt-1 truncate text-sm" style={{ color: "var(--twx-ink-muted)" }}>{d.description}</p>
                  )}
                </div>
                <button
                  onClick={() => removeDish(d.id)}
                  aria-label="Törlés"
                  className="flex-none rounded-full px-3 py-1 text-sm"
                  style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}
                >
                  Törlés
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
