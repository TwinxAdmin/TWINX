// dashboard/hospitality/inventory — Kínálat Kezelő: a partner saját étel-adatbázisa.
// Étel felvitele (név, leírás, kategória, konyha-stílus, profitmarzs) + lista + törlés.
"use client";

import { useEffect, useState, type FormEvent } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import { showToast } from "@/components/Toast";
import { compressImage } from "@/lib/image-compress";
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageAction, setImageAction] = useState<"keep" | "new" | "remove">("keep");
  const [dragOver, setDragOver] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function pickImage(f: File | null) {
    if (f && !f.type.startsWith("image/")) {
      showToast("Csak képfájlt tölthetsz fel.", "error");
      return;
    }
    setImageFile(f);
    setImagePreview(f ? URL.createObjectURL(f) : null);
    setImageAction(f ? "new" : "remove");
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY });
    setImageFile(null);
    setImagePreview(null);
    setImageAction("keep");
    setCuisineMode("list");
    setErrors({});
  }

  function startEdit(d: Dish) {
    setEditingId(d.id);
    setForm({
      name: d.name,
      description: d.description ?? "",
      category: d.category,
      cuisine_style: d.cuisine_style ?? "",
      profit_margin: d.profit_margin,
    });
    setImageFile(null);
    setImagePreview(d.image_url ?? null);
    setImageAction("keep");
    setCuisineMode(d.cuisine_style && !CUISINE_STYLES.includes(d.cuisine_style as never) ? "custom" : "list");
    setErrors({});
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

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

  async function saveDish(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append("image", await compressImage(imageFile, 1400, 0.82));
      else if (editingId && imageAction === "remove") fd.append("remove_image", "1");

      let res: Response;
      if (editingId) {
        fd.append("id", editingId);
        res = await fetch("/api/hospitality/dishes", { method: "PATCH", body: fd });
      } else {
        res = await fetch("/api/hospitality/dishes", { method: "POST", body: fd });
      }
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        showToast(data.error ?? "Nem sikerült menteni.", "error");
        return;
      }
      if (editingId) {
        setDishes((prev) => prev.map((x) => (x.id === editingId ? data.dish : x)));
        showToast("Étel módosítva.", "success");
      } else {
        setDishes((prev) => [data.dish, ...prev]);
        showToast("Étel hozzáadva.", "success");
      }
      resetForm();
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
      <form onSubmit={saveDish} className="twx-card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">
            {editingId ? "Étel szerkesztése" : "Új étel felvitele"}
          </h2>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Mégse
            </button>
          )}
        </div>
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
        <div>
          <label className="block text-sm">Ételfotó (opcionális)</label>
          <p className="mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            A feltöltött kép ehhez az ételhez tartozik — később ebből dolgozik a menü dizájn.
          </p>
          <label
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickImage(e.dataTransfer.files?.[0] ?? null); }}
            className="flex cursor-pointer items-center gap-4 rounded-xl p-4 transition-colors"
            style={{
              border: `1.5px dashed ${dragOver ? "var(--twx-coral)" : "var(--twx-line)"}`,
              background: dragOver ? "rgba(239,122,90,0.06)" : "transparent",
            }}
          >
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="" className="h-16 w-16 flex-none rounded-lg object-cover" style={{ border: "1px solid var(--twx-line)" }} />
            ) : (
              <span className="flex h-16 w-16 flex-none items-center justify-center rounded-lg" style={{ background: "rgba(239,122,90,0.10)", color: "var(--twx-coral)" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" /><path d="m3 15 4-4 4 4 3-3 7 6" /><circle cx="8.5" cy="9" r="1.5" />
                </svg>
              </span>
            )}
            <div className="min-w-0">
              <span className="block text-sm font-medium" style={{ color: "var(--twx-ink)" }}>
                {imagePreview ? "Kép kiválasztva — kattints másikért" : "Húzd ide a képet, vagy kattints a tallózáshoz"}
              </span>
              <span className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>PNG, JPG vagy WEBP</span>
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
            />
          </label>
          {imagePreview && (
            <button
              type="button"
              onClick={() => pickImage(null)}
              className="mt-2 text-sm"
              style={{ color: "var(--twx-ink-muted)" }}
            >
              Kép eltávolítása
            </button>
          )}
        </div>

        <button type="submit" disabled={saving} className="twx-btn">
          {saving ? "Mentés…" : editingId ? "Módosítások mentése" : "Étel hozzáadása"}
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
              <li key={d.id} className="twx-card flex items-start gap-3 p-4">
                {d.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.image_url} alt="" className="h-14 w-14 flex-none rounded-lg object-cover" style={{ border: "1px solid var(--twx-line)" }} />
                )}
                <div className="min-w-0 flex-1">
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
                <div className="flex flex-none gap-2">
                  <button
                    onClick={() => startEdit(d)}
                    className="rounded-full px-3 py-1 text-sm"
                    style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}
                  >
                    Szerkesztés
                  </button>
                  <button
                    onClick={() => removeDish(d.id)}
                    className="rounded-full px-3 py-1 text-sm"
                    style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}
                  >
                    Törlés
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
