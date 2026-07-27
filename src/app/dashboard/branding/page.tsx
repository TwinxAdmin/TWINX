// dashboard/branding — Arculatok: több arculat-profil kezelése (céges, közös belépéshez is).
"use client";
import ModuleIntro from "@/components/ModuleIntro";

import { useEffect, useState, type FormEvent } from "react";
import {
  BRANDING_FONTS,
  BRANDING_THEMES,
  EMPTY_BRANDING,
  type BrandingInput,
  type BrandingProfile,
} from "@/lib/branding";
import { compressImage } from "@/lib/image-compress";
import { makeLogoTransparent } from "@/lib/logo-transparent";
import { cropToSquare, DEFAULT_CROP, type CropState } from "@/lib/crop-image";

// Gyors színpaletta az arculathoz (egyedi szín továbbra is választható).
const PRESET_COLORS = ["#ef7a5a", "#c2410c", "#b45309", "#15803d", "#0e7490", "#1d4ed8", "#6d28d9", "#be123c", "#1f2937"];

// A betűtípus-kártyák mintájához (a render Google Fontsból tölti a végleges betűt).
const FONT_STACK: Record<string, string> = {
  inter: "Inter, system-ui, sans-serif",
  montserrat: "Montserrat, system-ui, sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
  poppins: "Poppins, system-ui, sans-serif",
  clash: "'Space Grotesk', system-ui, sans-serif",
};

export default function BrandingPage() {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BrandingProfile | null>(null);
  const [values, setValues] = useState<BrandingInput>({ ...EMPTY_BRANDING });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoOriginal, setLogoOriginal] = useState<File | null>(null); // tisztítás visszavonásához
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [agentFile, setAgentFile] = useState<File | null>(null);
  const [agentPreview, setAgentPreview] = useState<string | null>(null);
  const [removeAgent, setRemoveAgent] = useState(false);
  const [crop, setCrop] = useState<CropState>(DEFAULT_CROP); // portré-kivágás
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
    setLogoOriginal(null);
    setLogoPreview(null);
    setAgentFile(null);
    setAgentPreview(null);
    setRemoveLogo(false);
    setRemoveAgent(false);
    setCrop(DEFAULT_CROP);
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
    setLogoOriginal(null);
    setLogoPreview(null);
    setAgentFile(null);
    setAgentPreview(null);
    setRemoveLogo(false);
    setRemoveAgent(false);
    setCrop(DEFAULT_CROP);
    setErrors({});
    setServerError(null);
    setShowForm(true);
  }

  // Amit épp mutatunk: az új feltöltés, vagy a meglévő (ha nem törölték).
  const logoSrc = logoPreview ?? (removeLogo ? null : editing?.logo_url ?? null);
  const agentSrc = agentPreview ?? (removeAgent ? null : editing?.agent_photo_url ?? null);

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
      // Logó: SVG marad, egyéb raszter kicsinyítve (Vercel ~4,5 MB limit).
      if (logoFile) {
        // SVG és átlátszó PNG változatlanul megy (a JPEG-tömörítés elvenné az átlátszóságot).
        const keepAsIs = logoFile.type.includes("svg") || logoFile.type.includes("png");
        fd.append("logo", keepAsIs ? logoFile : await compressImage(logoFile, 800, 0.9));
      }
      // Ügynök-fotó: a beállított kivágással, négyzetes portréként.
      if (agentFile) fd.append("agent_photo", await cropToSquare(agentFile, crop, 800));
      // Törlés-jelzések a szervernek.
      if (removeLogo && !logoFile) fd.append("remove_logo", "1");
      if (removeAgent && !agentFile) fd.append("remove_agent_photo", "1");

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
      <ModuleIntro
        eyebrow="Fiók · Arculat"
        title="Arculatom"
        subtitle="A saját (vagy kollégáid) arculata — logó, szín, betűtípus, fotó és elérhetőség. A hirdetések és a videók is ebből dolgoznak: egyszer beállítod, és minden a te márkáddal készül. Kattints egy arculatra a szerkesztéshez."
        icon="branding"
        chips={["Logó & szín", "Saját fotó", "Több profil"]}
      />
      {loading ? (
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => openEdit(p)}
              className="group relative overflow-hidden rounded-2xl bg-white text-left transition hover:shadow-md"
              style={{ border: "1px solid var(--twx-line)", boxShadow: "0 2px 10px rgba(20,12,8,0.06)" }}
            >
              {/* Színsáv az arculat kiemelő színével */}
              <div className="h-1.5 w-full" style={{ background: p.accent_color }} />
              <div className="flex items-center gap-3 p-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                  style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream)" }}>
                  {p.logo_url ? (
                    <img src={p.logo_url} alt="" className="h-full w-full object-contain p-1.5" />
                  ) : (
                    <span className="text-xl" style={{ color: "var(--twx-line)" }}>▦</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-semibold">{p.label}</p>
                  <p className="truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {p.display_name}{p.title ? ` · ${p.title}` : ""}
                  </p>
                  <p className="mt-1 truncate text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                    {[p.company, p.phone].filter(Boolean).join(" · ") || "Nincs megadva elérhetőség"}
                  </p>
                </div>
                {p.agent_photo_url && (
                  <img src={p.agent_photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover"
                    style={{ border: "2px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,.12)" }} />
                )}
              </div>
              <span className="absolute bottom-2 right-3 text-[11px] font-medium opacity-0 transition group-hover:opacity-100" style={{ color: "var(--twx-coral)" }}>
                Szerkesztés →
              </span>
            </button>
          ))}

          {/* Új arculat kártya */}
          <button
            type="button"
            onClick={openNew}
            className="flex min-h-[7rem] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed p-6 text-sm font-medium transition hover:shadow-sm"
            style={{ borderColor: "var(--twx-line)", color: "var(--twx-coral)", background: "#fff" }}
          >
            <span className="text-2xl leading-none">＋</span>
            Új arculat
            <span className="text-[11px] font-normal" style={{ color: "var(--twx-ink-muted)" }}>
              Kollégának vagy másik irodához
            </span>
          </button>
        </div>
      )}

      {showForm && (
        <div onClick={() => !saving && setShowForm(false)} className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.5)" }}>
        <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()}
          className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
          style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
          <div className="flex items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
            <h2 className="font-display text-lg font-medium">
              {editing ? "Arculat szerkesztése" : "Új arculat"}
            </h2>
            <div className="flex items-center gap-2">
              {editing && (
                <button type="button" onClick={() => remove(editing.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ border: "1px solid var(--twx-line)", color: "#dc2626" }}>
                  Törlés
                </button>
              )}
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-2 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">

          {/* Élő előnézet — így néz ki az arculat a hirdetésen és a videó végkártyáján */}
          <div className="rounded-xl p-4" style={{ background: values.theme === "dark" ? "#141210" : "#fff", border: "1px solid var(--twx-line)" }}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                style={{ background: values.theme === "dark" ? "rgba(255,255,255,0.06)" : "var(--twx-cream)" }}>
                {logoSrc ? (
                  <img src={logoSrc ?? ""} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="text-lg" style={{ color: "var(--twx-line)" }}>▦</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: values.theme === "dark" ? "#fff" : "var(--twx-ink)" }}>
                  {values.display_name || "Megjelenő név"}
                </p>
                <p className="truncate text-xs" style={{ color: values.accent_color }}>
                  {values.title || "titulus"}{values.company ? ` · ${values.company}` : ""}
                </p>
                <p className="truncate text-[11px]" style={{ color: values.theme === "dark" ? "rgba(255,255,255,0.6)" : "var(--twx-ink-muted)" }}>
                  {[values.phone, values.email].filter(Boolean).join(" · ") || "telefon · e-mail"}
                </p>
              </div>
              {agentSrc && (
                <img src={agentSrc ?? ""} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover"
                  style={{ border: `2px solid ${values.accent_color}` }} />
              )}
            </div>
            <p className="mt-2 text-[11px]" style={{ color: values.theme === "dark" ? "rgba(255,255,255,0.5)" : "var(--twx-ink-muted)" }}>
              Előnézet — így jelenik meg a hirdetéseiden és a videók végkártyáján.
            </p>
          </div>

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

          {/* Kiemelő szín — gyors paletta + egyedi */}
          <div>
            <label className="block text-sm font-semibold">Kiemelő szín</label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((hex) => {
                const on = values.accent_color.toLowerCase() === hex.toLowerCase();
                return (
                  <button key={hex} type="button" title={hex} onClick={() => setField("accent_color", hex)}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition"
                    style={{ background: hex, border: on ? "2px solid var(--twx-ink)" : "1px solid var(--twx-line)", boxShadow: on ? "0 0 0 3px rgba(20,12,8,0.10)" : "none" }}>
                    {on && <span className="text-sm font-bold" style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>✓</span>}
                  </button>
                );
              })}
              <span className="mx-1 h-6 w-px" style={{ background: "var(--twx-line)" }} />
              <input type="color" value={values.accent_color} onChange={(e) => setField("accent_color", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded" style={{ border: "1px solid var(--twx-line)" }} title="Egyedi szín" />
              <input type="text" value={values.accent_color} onChange={(e) => setField("accent_color", e.target.value)}
                className="twx-input w-28 text-sm" />
            </div>
            {errors.accent_color && <p className="mt-1 text-xs text-red-600">{errors.accent_color}</p>}
          </div>

          {/* Betűtípus — kártyák a betű mintájával */}
          <div>
            <label className="block text-sm font-semibold">Betűtípus</label>
            <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Minden választható betűtípus tartalmazza a magyar ékezeteket.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BRANDING_FONTS.map((f) => {
                const on = values.font === f.value;
                const [name, desc] = f.label.split(" — ");
                return (
                  <button key={f.value} type="button" onClick={() => setField("font", f.value)}
                    className="rounded-xl p-3 text-left transition hover:shadow-sm"
                    style={on
                      ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)" }
                      : { background: "#fff", border: "1px solid var(--twx-line)" }}>
                    <span className="block text-base font-semibold" style={{ fontFamily: FONT_STACK[f.value] ?? "inherit", color: on ? "#7a2e17" : "var(--twx-ink)" }}>
                      Árvíztűrő {name}
                    </span>
                    <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Téma — chipek */}
          <div>
            <label className="block text-sm font-semibold">Téma</label>
            <div className="mt-2 flex gap-2">
              {BRANDING_THEMES.map((t) => {
                const on = values.theme === t.value;
                return (
                  <button key={t.value} type="button" onClick={() => setField("theme", t.value)}
                    className="rounded-full px-4 py-1.5 text-xs font-medium transition"
                    style={on
                      ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" }
                      : { background: "#fff", border: "1px solid var(--twx-line)", color: "var(--twx-ink)" }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold">Logó</label>
            <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Fehér hátterű logó is jó — a hirdetésen fehér alapon jelenik meg. Ha átlátszót szeretnél, alább kitisztíthatod.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              {/* Előnézet világos és sötét háttéren — így látszik, kell-e tisztítás */}
              <div className="flex gap-2">
                {(["light", "dark"] as const).map((bg) => (
                  <div key={bg} className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                    style={{ border: "1px solid var(--twx-line)", background: bg === "dark" ? "#141210" : "#fff" }}>
                    {logoSrc ? (
                      <img src={logoSrc ?? ""} alt="" className="h-full w-full object-contain p-1.5" />
                    ) : (
                      <span className="text-2xl" style={{ color: "var(--twx-line)" }}>▦</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex-1">
                <label
                  htmlFor="logo-input"
                  className="inline-block cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors"
                  style={{ border: "1px solid var(--twx-line)", background: "#fff", color: "var(--twx-ink)" }}
                >
                  {logoSrc ? "Logó cseréje" : "Logó feltöltése"}
                </label>
                {logoSrc && (
                  <button type="button"
                    onClick={() => { setLogoFile(null); setLogoOriginal(null); setLogoPreview(null); setRemoveLogo(true); }}
                    className="ml-2 rounded-full px-3 py-1.5 text-xs font-medium" style={{ border: "1px solid var(--twx-line)", color: "#dc2626" }}>
                    Logó törlése
                  </button>
                )}
                <input
                  id="logo-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setLogoFile(f);
                    setLogoOriginal(f);
                    setLogoPreview(f ? URL.createObjectURL(f) : null);
                  }}
                  className="hidden"
                />
                <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {logoFile ? logoFile.name : "PNG, JPG, WEBP vagy SVG."}
                </p>

                {/* Háttér-tisztítás: előbb az ingyenes, csak utána az AI */}
                {logoFile && !logoFile.type.includes("svg") && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" disabled={cleaning}
                      onClick={async () => {
                        if (!logoFile) return;
                        setCleaning(true);
                        try {
                          const out = await makeLogoTransparent(logoFile);
                          setLogoFile(out);
                          setLogoPreview(URL.createObjectURL(out));
                        } catch { setServerError("A háttér eltávolítása nem sikerült."); }
                        finally { setCleaning(false); }
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                      style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                      {cleaning ? "Feldolgozás…" : "Fehér háttér eltávolítása (ingyenes)"}
                    </button>
                    <button type="button" disabled={cleaning}
                      onClick={async () => {
                        if (!logoOriginal) return;
                        setCleaning(true);
                        setServerError(null);
                        try {
                          const fd = new FormData();
                          fd.append("logo", logoOriginal);
                          const res = await fetch("/api/branding/logo-cleanup", { method: "POST", body: fd });
                          if (!res.ok) throw new Error();
                          const blob = await res.blob();
                          const out = new File([blob], "logo-tisztitott.png", { type: "image/png" });
                          setLogoFile(out);
                          setLogoPreview(URL.createObjectURL(out));
                        } catch { setServerError("Az AI-tisztítás nem sikerült. Próbáld újra."); }
                        finally { setCleaning(false); }
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                      style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)", background: "#fff" }}>
                      Nem lett jó? AI-tisztítás
                    </button>
                    {logoOriginal && logoFile !== logoOriginal && (
                      <button type="button" onClick={() => { setLogoFile(logoOriginal); setLogoPreview(URL.createObjectURL(logoOriginal)); }}
                        className="text-xs underline" style={{ color: "var(--twx-ink-muted)" }}>
                        Vissza az eredetihez
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ügynök-fotó — kivágható: egészalakos képből is lehet mellkép */}
          <div>
            <label className="block text-sm font-semibold">Saját fotó</label>
            <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              A hirdetésen és a videó végkártyáján körben jelenik meg. Nagyítsd és húzd a képet, hogy a megfelelő rész látszódjon.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              {/* Körelőnézet — húzással mozgatható */}
              <div
                className="relative h-28 w-28 shrink-0 cursor-move overflow-hidden rounded-full"
                style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream)" }}
                onPointerDown={(e) => {
                  if (!agentSrc) return;
                  const el = e.currentTarget;
                  el.setPointerCapture(e.pointerId);
                  const start = { px: e.clientX, py: e.clientY, ...crop };
                  const onMove = (ev: PointerEvent) => {
                    setCrop({
                      zoom: start.zoom,
                      x: Math.max(-1, Math.min(1, start.x - (ev.clientX - start.px) / 60)),
                      y: Math.max(-1, Math.min(1, start.y - (ev.clientY - start.py) / 60)),
                    });
                  };
                  const onUp = () => { el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerup", onUp); };
                  el.addEventListener("pointermove", onMove);
                  el.addEventListener("pointerup", onUp);
                }}
              >
                {agentSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={agentSrc}
                    alt=""
                    draggable={false}
                    className="h-full w-full select-none object-cover"
                    style={{ transform: `scale(${crop.zoom})`, objectPosition: `${50 + crop.x * 50}% ${50 + crop.y * 50}%` }}
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl" style={{ color: "var(--twx-line)" }}>☺</span>
                )}
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="agent-input"
                    className="inline-block cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors"
                    style={{ border: "1px solid var(--twx-line)", background: "#fff", color: "var(--twx-ink)" }}
                  >
                    {agentSrc ? "Fotó cseréje" : "Fotó feltöltése"}
                  </label>
                  {agentSrc && (
                    <button type="button"
                      onClick={() => { setAgentFile(null); setAgentPreview(null); setRemoveAgent(true); setCrop(DEFAULT_CROP); }}
                      className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ border: "1px solid var(--twx-line)", color: "#dc2626" }}>
                      Fotó törlése
                    </button>
                  )}
                </div>
                <input
                  id="agent-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setAgentFile(f);
                    setAgentPreview(f ? URL.createObjectURL(f) : null);
                    setRemoveAgent(false);
                    setCrop(DEFAULT_CROP);
                  }}
                  className="hidden"
                />

                {/* Nagyítás csúszka — csak új feltöltésnél tudjuk újravágni */}
                {agentFile && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
                      Nagyítás ({crop.zoom.toFixed(1)}×)
                    </label>
                    <input type="range" min={1} max={3} step={0.1} value={crop.zoom}
                      onChange={(e) => setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))}
                      className="mt-1 w-full max-w-xs" />
                    <p className="mt-1 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                      Húzd a kör alakú előnézetet a kép mozgatásához.
                    </p>
                  </div>
                )}
                {!agentFile && editing?.agent_photo_url && !removeAgent && (
                  <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Az újravágáshoz tölts fel újra egy fotót.
                  </p>
                )}
              </div>
            </div>
          </div>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          </div>

          {/* Mentés-sáv */}
          <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
            <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Az arculatot a hirdetések és a videók is ebből veszik.
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} disabled={saving}
                className="rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink)" }}>
                Mégse
              </button>
              <button type="submit" disabled={saving}
                className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
                {saving ? "Mentés…" : "Mentés"}
              </button>
            </div>
          </div>
        </form>
        </div>
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
