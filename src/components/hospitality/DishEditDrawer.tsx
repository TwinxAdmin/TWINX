// DishEditDrawer — oldalt beúszó szerkesztő panel egy ételhez (Framer Motion).
// Saját mentés gomb; mentés/bezárás után a panel visszabújik (AnimatePresence a szülőben).
"use client";

import { useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { showToast } from "@/components/Toast";
import { compressImage } from "@/lib/image-compress";
import { DISH_CATEGORIES, PROFIT_MARGINS, CUISINE_STYLES, type Dish } from "@/lib/hospitality";

export default function DishEditDrawer({
  dish,
  cuisineOptions,
  onClose,
  onSaved,
}: {
  dish: Dish;
  cuisineOptions: string[];
  onClose: () => void;
  onSaved: (d: Dish) => void;
}) {
  const reduce = useReducedMotion();
  const [form, setForm] = useState({
    name: dish.name,
    description: dish.description ?? "",
    category: dish.category as string,
    cuisine_style: dish.cuisine_style ?? "",
    profit_margin: dish.profit_margin as string,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(dish.image_url ?? null);
  const [imageAction, setImageAction] = useState<"keep" | "new" | "remove">("keep");
  const [dragOver, setDragOver] = useState(false);
  const [cuisineMode, setCuisineMode] = useState<"list" | "custom">(
    dish.cuisine_style && !CUISINE_STYLES.includes(dish.cuisine_style as never) ? "custom" : "list"
  );

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function pickImage(f: File | null) {
    if (f && !f.type.startsWith("image/")) {
      showToast("Csak képfájlt tölthetsz fel.", "error");
      return;
    }
    setImageFile(f);
    setImagePreview(f ? URL.createObjectURL(f) : null);
    setImageAction(f ? "new" : "remove");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("id", dish.id);
      if (imageFile) fd.append("image", await compressImage(imageFile, 1400, 0.82));
      else if (imageAction === "remove") fd.append("remove_image", "1");

      const res = await fetch("/api/hospitality/dishes", { method: "PATCH", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        showToast(data.error ?? "Nem sikerült menteni.", "error");
        return;
      }
      showToast("Étel módosítva.", "success");
      onSaved(data.dish);
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex justify-end"
      style={{ background: "rgba(12,11,10,0.5)" }}
    >
      <motion.aside
        onClick={(e) => e.stopPropagation()}
        initial={{ x: reduce ? 0 : "100%" }}
        animate={{ x: 0 }}
        exit={{ x: reduce ? 0 : "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 40 }}
        className="h-full w-[92vw] max-w-md overflow-y-auto p-6"
        style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-medium">Étel szerkesztése</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Bezárás"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
            style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}
          >
            ×
          </button>
        </div>

        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="block text-sm">Étel neve *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className="twx-input mt-1" />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm">Leírás / összetevők</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="twx-input mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm">Kategória *</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className="twx-input mt-1">
                {DISH_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm">Profitmarzs *</label>
              <select value={form.profit_margin} onChange={(e) => set("profit_margin", e.target.value)} className="twx-input mt-1">
                {PROFIT_MARGINS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm">Konyha típusa</label>
            {cuisineMode === "list" ? (
              <select
                value={form.cuisine_style}
                onChange={(e) => {
                  if (e.target.value === "__add__") { setCuisineMode("custom"); set("cuisine_style", ""); }
                  else set("cuisine_style", e.target.value);
                }}
                className="twx-input mt-1"
              >
                <option value="">— válassz —</option>
                {cuisineOptions.map((c) => (<option key={c} value={c}>{c}</option>))}
                <option value="__add__">+ Saját típus hozzáadása…</option>
              </select>
            ) : (
              <div className="mt-1 flex gap-2">
                <input value={form.cuisine_style} onChange={(e) => set("cuisine_style", e.target.value)} className="twx-input" autoFocus />
                <button type="button" onClick={() => { setCuisineMode("list"); set("cuisine_style", ""); }} className="flex-none rounded-full px-3 text-sm" style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                  Lista
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm">Ételfotó</label>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickImage(e.dataTransfer.files?.[0] ?? null); }}
              className="mt-1 flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors"
              style={{ border: `1.5px dashed ${dragOver ? "var(--twx-coral)" : "var(--twx-line)"}`, background: dragOver ? "rgba(239,122,90,0.06)" : "transparent" }}
            >
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="" className="h-14 w-14 flex-none rounded-lg object-cover" style={{ border: "1px solid var(--twx-line)" }} />
              ) : (
                <span className="flex h-14 w-14 flex-none items-center justify-center rounded-lg" style={{ background: "rgba(239,122,90,0.10)", color: "var(--twx-coral)" }}>+</span>
              )}
              <span className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                {imagePreview ? "Kép — kattints vagy húzz másikat" : "Húzd ide, vagy kattints a tallózáshoz"}
              </span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} />
            </label>
            {imagePreview && (
              <button type="button" onClick={() => pickImage(null)} className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Kép eltávolítása
              </button>
            )}
          </div>

          <button type="submit" disabled={saving} className="twx-btn w-full">
            {saving ? "Mentés…" : "Mentés"}
          </button>
        </form>
      </motion.aside>
    </motion.div>
  );
}
