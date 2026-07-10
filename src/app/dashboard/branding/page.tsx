// dashboard/branding — Arculatok: több arculat-profil kezelése (céges, közös belépéshez is).
"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BRANDING_FONTS,
  BRANDING_THEMES,
  EMPTY_BRANDING,
  type BrandingInput,
  type BrandingProfile,
} from "@/lib/branding";

export default function BrandingPage() {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BrandingProfile | null>(null);
  const [values, setValues] = useState<BrandingInput>({ ...EMPTY_BRANDING });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/branding");
      const data = await res.json();
      if (res.ok) setProfiles(data.profiles ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setValues({ ...EMPTY_BRANDING });
    setLogoFile(null);
    setLogoPreview(null);
    setErrors({});
    setServerError(null);
    setShowForm(true);
  }

  function openEdit(p: BrandingProfile) {
    setEditing(p);
    setValues({
      label: p.label,
      display_name: p.display_name,
      title: p.title,
      phone: p.phone,
      email: p.email,
      company: p.company,
      website: p.website,
      slogan: p.slogan,
      accent_color: p.accent_color,
      font: p.font,
      theme: p.theme,
    });
    setLogoFile(null);
    setLogoPreview(null);
    setErrors({});
    setServerError(null);
    setShowForm(true);
  }

  function setField<K extends keyof BrandingInput>(key: K, val: BrandingInput[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setErrors({});
    setSaving(true);
    try {
      const fd = new FormData();
      if (editing) fd.append("id", editing.id);
      Object.entries(values).forEach(([k, v]) => fd.append(k, String(v)));
      if (logoFile) fd.append("logo", logoFile);

      const res = await fetch("/api/branding", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Hiba a mentés során.");
        return;
      }
      setShowForm(false);
      await load();
    } catch {
      setServerError("Hálózati hiba. Próbáld újra.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Biztosan törlöd ezt az arculat-profilt?")) return;
    await fetch(`/api/branding?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Arculatok</h1>
        <button onClick={openNew} className="twx-btn">
          Új arculat
        </button>
      </div>
      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Több arculatot is létrehozhatsz (pl. külön minden kollégának). Hirdetés készítésekor
        ezek közül választasz — a név, elérhetőség, logó és szín automatikusan bekerül.
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
      ) : profiles.length === 0 && !showForm ? (
        <div
          className="rounded-xl p-6 text-sm"
          style={{ border: "1px dashed var(--twx-line)", color: "var(--twx-ink-muted)" }}
        >
          Még nincs arculatod. Hozz létre egyet az „Új arculat" gombbal.
        </div>
      ) : (
        <ul className="space-y-3">
          {profiles.map((p) => (
            <li key={p.id} className="twx-card flex items-center justify-between gap-4 p-4">
              <button
                type="button"
                onClick={() => {
                  if (showForm && editing?.id === p.id) setShowForm(false);
                  else openEdit(p);
                }}
                className="flex flex-1 items-center gap-3 rounded-lg text-left transition-colors hover:bg-black/[0.03]"
              >
                {p.logo_url ? (
                  <img src={p.logo_url} alt="" className="h-10 w-10 rounded object-contain" style={{ border: "1px solid var(--twx-line)" }} />
                ) : (
                  <span className="h-10 w-10 rounded" style={{ background: p.accent_color }} />
                )}
                <div>
                  <p className="font-medium">{p.label}</p>
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {p.display_name}
                    {p.title ? ` · ${p.title}` : ""}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full" style={{ background: p.accent_color, border: "1px solid var(--twx-line)" }} />
                <button onClick={() => openEdit(p)} className="text-sm underline" style={{ color: "var(--twx-coral)" }}>
                  Szerkeszt
                </button>
                <button onClick={() => remove(p.id)} className="text-sm underline" style={{ color: "var(--twx-ink-muted)" }}>
                  Törlés
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <form onSubmit={onSubmit} className="twx-card space-y-4 p-6">
          <h2 className="font-display text-xl font-medium">
            {editing ? "Arculat szerkesztése" : "Új arculat"}
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Profil neve (belső)" req value={values.label} onChange={(v) => setField("label", v)} err={errors.label} placeholder="pl. Péter" />
            <Field label="Megjelenő név" req value={values.display_name} onChange={(v) => setField("display_name", v)} err={errors.display_name} placeholder="pl. Kovács Péter" />
            <Field label="Titulus" value={values.title} onChange={(v) => setField("title", v)} placeholder="pl. ingatlanértékesítő" />
            <Field label="Telefon" value={values.phone} onChange={(v) => setField("phone", v)} placeholder="pl. 06 70 123 4567" />
            <Field label="E-mail" value={values.email} onChange={(v) => setField("email", v)} err={errors.email} placeholder="pl. peter@iroda.hu" />
            <Field label="Cégnév" value={values.company} onChange={(v) => setField("company", v)} placeholder="pl. Iroda Kft." />
            <Field label="Weboldal" value={values.website} onChange={(v) => setField("website", v)} placeholder="pl. iroda.hu" />
            <Field label="Slogan / megjegyzés" value={values.slogan} onChange={(v) => setField("slogan", v)} placeholder="pl. díjtalan hitelügyintézés" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm">Kiemelő szín</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={values.accent_color} onChange={(e) => setField("accent_color", e.target.value)} className="h-9 w-12 rounded" style={{ border: "1px solid var(--twx-line)" }} />
                <input type="text" value={values.accent_color} onChange={(e) => setField("accent_color", e.target.value)} className="twx-input" />
              </div>
              {errors.accent_color && <p className="mt-1 text-xs text-red-600">{errors.accent_color}</p>}
            </div>
            <div>
              <label className="block text-sm">Betűtípus</label>
              <select value={values.font} onChange={(e) => setField("font", e.target.value)} className="twx-input mt-1">
                {BRANDING_FONTS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm">Téma</label>
              <select value={values.theme} onChange={(e) => setField("theme", e.target.value as "light" | "dark")} className="twx-input mt-1">
                {BRANDING_THEMES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm">Logó</label>
            <div className="mt-1 flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream)" }}
              >
                {logoPreview || editing?.logo_url ? (
                  <img src={logoPreview ?? editing?.logo_url ?? ""} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-2xl" style={{ color: "var(--twx-line)" }}>▦</span>
                )}
              </div>
              <div>
                <label
                  htmlFor="logo-input"
                  className="inline-block cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors"
                  style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", color: "var(--twx-ink)" }}
                >
                  {logoFile || editing?.logo_url ? "Logó cseréje" : "Logó feltöltése"}
                </label>
                <input
                  id="logo-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setLogoFile(f);
                    setLogoPreview(f ? URL.createObjectURL(f) : null);
                  }}
                  className="hidden"
                />
                <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {logoFile ? logoFile.name : "PNG, JPG vagy SVG — átlátszó háttér ajánlott."}
                </p>
              </div>
            </div>
          </div>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="twx-btn">
              {saving ? "Mentés…" : "Mentés"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full px-5 py-2.5 text-sm font-medium" style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", color: "var(--twx-ink)" }}>
              Mégse
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  err,
  placeholder,
  req,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  err?: string;
  placeholder?: string;
  req?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm">
        {label}
        {req && <span className="text-red-600"> *</span>}
      </label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="twx-input mt-1" />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}
