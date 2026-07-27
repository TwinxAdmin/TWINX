// Hirdetés-varázsló: Arculat → Sablon → Képek → Adatok → Előnézet.
// Egy felugró ablakban vezet végig, hogy a partnernek ne kelljen hosszú oldalt görgetnie.
// Az előnézet vízjeles és ingyenes; az elfogadás von kreditet és ad tiszta, letölthető képet.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { showToast } from "@/components/Toast";
import AssetTray, { readTwxDragUrl } from "@/components/AssetTray";
import { compressImage } from "@/lib/image-compress";
import { toDownloadUrl } from "@/lib/files";
import type { BrandingProfile } from "@/lib/branding";
import { BRANDING_FONTS, getBrandingFont } from "@/lib/branding";
import {
  FLYER_TONES, EMPTY_FACTS, EMPTY_TEXT, MAX_FLYER_IMAGES, FLYER_CREDITS,
  type FlyerFacts, type FlyerText,
} from "@/lib/flyer";
import { FLYER_STYLES, FLYER_RATIOS, TEXT_LIMITS, contrastOn } from "@/lib/flyer-design";
import { buildAdHtml } from "@/lib/flyer-templates";
import { renderFlyerToBlob } from "@/lib/flyer-client-render";
import { EMPTY_QUICK_BRAND, quickToProfileData, validateQuickBrand, type QuickBrand } from "@/lib/flyer-brand";
import type { FlyerProfileData } from "@/lib/flyer-template";

const STEPS = ["Arculat", "Sablon", "Képek", "Adatok", "Előnézet"] as const;

export default function FlyerWizard({
  profiles, onClose, onDone,
}: {
  profiles: BrandingProfile[];
  onClose: () => void;
  onDone?: (url: string) => void;
}) {
  const [step, setStep] = useState(0);

  // 1) Arculat
  const [brandMode, setBrandMode] = useState<"saved" | "quick">(profiles.length ? "saved" : "quick");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [quick, setQuick] = useState<QuickBrand>({ ...EMPTY_QUICK_BRAND });
  const [quickErrors, setQuickErrors] = useState<Record<string, string>>({});

  // 2) Sablon
  const [style, setStyle] = useState(FLYER_STYLES[0].id as string);
  const [ratio, setRatio] = useState(FLYER_RATIOS[1].id as string);

  // 3) Képek
  const [images, setImages] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 4) Adatok + szöveg
  const [facts, setFacts] = useState<FlyerFacts>({ ...EMPTY_FACTS });
  const [tone, setTone] = useState(FLYER_TONES[1]?.value ?? "marketinges");
  const [text, setText] = useState<FlyerText>({ ...EMPTY_TEXT });
  const [genLoading, setGenLoading] = useState(false);

  // 5) Előnézet / elfogadás
  const [preview, setPreview] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Az aktuális arculat a sablonhoz.
  const profileData: FlyerProfileData = useMemo(() => {
    if (brandMode === "saved") {
      const p = profiles.find((x) => x.id === profileId);
      if (p) {
        return {
          display_name: p.display_name, title: p.title, phone: p.phone, email: p.email,
          company: p.company, website: p.website, slogan: p.slogan,
          logo_url: p.logo_url, agent_photo_url: p.agent_photo_url,
          accent_color: p.accent_color, font: p.font, theme: p.theme === "dark" ? "dark" : "light",
        };
      }
    }
    return quickToProfileData(quick);
  }, [brandMode, profileId, profiles, quick]);

  // --- Képek kezelése ---
  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_FLYER_IMAGES - images.length;
    if (room <= 0) { showToast(`Legfeljebb ${MAX_FLYER_IMAGES} kép.`, "info"); return; }
    const urls = Array.from(list).slice(0, room).map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...urls]);
  }
  const addUrl = (u: string) =>
    setImages((prev) => (prev.includes(u) || prev.length >= MAX_FLYER_IMAGES ? prev : [...prev, u]));
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, j) => j !== i));
  const moveImage = (from: number, to: number) =>
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const n = [...prev];
      const [m] = n.splice(from, 1);
      n.splice(to, 0, m);
      return n;
    });

  // --- AI szöveg ---
  async function generateText() {
    setGenLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/flyer/text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setText(data.text as FlyerText);
    } catch {
      setError("A szöveg generálása nem sikerült. Kézzel is kitöltheted.");
    } finally { setGenLoading(false); }
  }

  // --- Render ---
  async function buildPreview() {
    setRendering(true);
    setError(null);
    try {
      const r = FLYER_RATIOS.find((x) => x.id === ratio)!;
      const html = buildAdHtml({ style, ratio, images, profile: profileData, text, facts: keyFacts(facts), watermark: true });
      const { blob } = await renderFlyerToBlob(html, r.width, r.height, "image", false);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError("Nem sikerült az előnézet: " + (e as Error).message);
    } finally { setRendering(false); }
  }

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const r = FLYER_RATIOS.find((x) => x.id === ratio)!;
      const html = buildAdHtml({ style, ratio, images, profile: profileData, text, facts: keyFacts(facts), watermark: false });
      const { blob, ext, contentType } = await renderFlyerToBlob(html, r.width, r.height, "image", false);
      const fd = new FormData();
      fd.append("image", new File([blob], `hirdetes.${ext}`, { type: contentType }));
      if (brandMode === "saved") fd.append("profileId", profileId);
      fd.append("style", style);
      fd.append("ratio", ratio);
      fd.append("imageCount", String(images.length));
      fd.append("title", text.title ?? "");
      const res = await fetch("/api/flyer/accept", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFinalUrl(data.url as string);
      onDone?.(data.url as string);
      showToast(data.charged ? `Kész! ${FLYER_CREDITS} kredit levonva.` : "Kész! (ingyenes hozzáférés)", "success");
    } catch (e) {
      setError((e as Error).message || "Nem sikerült az elfogadás.");
    } finally { setAccepting(false); }
  }

  // Az előnézet lépésre lépve automatikusan renderelünk.
  useEffect(() => {
    if (step === 4 && !preview && !rendering) void buildPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  // Beállítás-változásnál az előnézet elavul.
  useEffect(() => { setPreview(null); setFinalUrl(null); }, [style, ratio, images.length, brandMode, profileId]);

  // --- Léptetés ---
  function canNext(): string | null {
    if (step === 0) {
      if (brandMode === "saved") return profileId ? null : "Válassz arculatot.";
      const errs = validateQuickBrand(quick);
      setQuickErrors(errs);
      return Object.keys(errs).length ? "Töltsd ki a kötelező mezőket." : null;
    }
    if (step === 2) return images.length ? null : "Adj hozzá legalább egy képet.";
    if (step === 3) return text.title?.trim() ? null : "Adj címet a hirdetésnek (vagy generáltass szöveget).";
    return null;
  }
  function next() {
    const err = canNext();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  return (
    <div onClick={() => !accepting && !rendering && onClose()} className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.55)" }}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>

        {/* Fejléc + lépésjelző */}
        <div className="border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Új hirdetés</h2>
            <button onClick={onClose} className="rounded-lg px-2 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center gap-1.5">
                <button type="button" onClick={() => i < step && setStep(i)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold"
                  style={{ color: i === step ? "var(--twx-coral)" : i < step ? "var(--twx-ink)" : "var(--twx-ink-muted)" }}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                    style={i <= step
                      ? { background: "var(--twx-coral)", color: "#1c1005" }
                      : { border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                    {i + 1}
                  </span>
                  <span className="hidden sm:inline">{s}</span>
                </button>
                {i < STEPS.length - 1 && <span className="h-px flex-1" style={{ background: "var(--twx-line)" }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Tartalom */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {step === 0 && (
            <StepBrand
              profiles={profiles} brandMode={brandMode} setBrandMode={setBrandMode}
              profileId={profileId} setProfileId={setProfileId}
              quick={quick} setQuick={setQuick} errors={quickErrors}
            />
          )}
          {step === 1 && <StepTemplate style={style} setStyle={setStyle} ratio={ratio} setRatio={setRatio} accent={profileData.accent_color} />}
          {step === 2 && (
            <StepImages
              images={images} addUrl={addUrl} addFiles={addFiles} removeImage={removeImage} moveImage={moveImage}
              dragOver={dragOver} setDragOver={setDragOver} fileRef={fileRef}
            />
          )}
          {step === 3 && (
            <StepFacts facts={facts} setFacts={setFacts} tone={tone} setTone={setTone}
              text={text} setText={setText} generateText={generateText} genLoading={genLoading} />
          )}
          {step === 4 && (
            <StepPreview preview={preview} rendering={rendering} finalUrl={finalUrl} onRebuild={buildPreview} />
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Lábléc */}
        <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || accepting}
            className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ border: "1px solid var(--twx-line)" }}>
            Vissza
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
              Tovább
            </button>
          ) : finalUrl ? (
            <div className="flex gap-2">
              <a href={toDownloadUrl(finalUrl)} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
                Letöltés
              </a>
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)" }}>
                Kész
              </button>
            </div>
          ) : (
            <button type="button" onClick={accept} disabled={accepting || rendering || !preview}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
              {accepting ? "Feldolgozás…" : `Elfogadom (${FLYER_CREDITS} kredit)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** A FlyerFacts-ből a sablon által használt kulcsadatok. */
function keyFacts(f: FlyerFacts) {
  return {
    rooms: f.rooms, size: f.size, propertyType: f.propertyType, condition: f.condition,
    bathrooms: f.bathrooms, extras: [f.custom1, f.custom2].filter(Boolean),
  };
}

// ---------- 1) Arculat ----------
function StepBrand({ profiles, brandMode, setBrandMode, profileId, setProfileId, quick, setQuick, errors }: {
  profiles: BrandingProfile[];
  brandMode: "saved" | "quick";
  setBrandMode: (m: "saved" | "quick") => void;
  profileId: string; setProfileId: (v: string) => void;
  quick: QuickBrand; setQuick: (q: QuickBrand) => void;
  errors: Record<string, string>;
}) {
  const set = <K extends keyof QuickBrand>(k: K, v: QuickBrand[K]) => setQuick({ ...quick, [k]: v });
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setBrandMode("saved")} disabled={!profiles.length}
          className="flex-1 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40"
          style={brandMode === "saved"
            ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" }
            : { background: "#fff", border: "1px solid var(--twx-line)" }}>
          Mentett arculatom
        </button>
        <button type="button" onClick={() => setBrandMode("quick")}
          className="flex-1 rounded-xl px-4 py-2 text-sm font-medium"
          style={brandMode === "quick"
            ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" }
            : { background: "#fff", border: "1px solid var(--twx-line)" }}>
          Most adom meg
        </button>
      </div>

      {brandMode === "saved" ? (
        profiles.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Még nincs mentett arculatod. Válaszd a „Most adom meg" lehetőséget, vagy hozz létre egyet az Arculatom menüben.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {profiles.map((p) => {
              const on = profileId === p.id;
              return (
                <button key={p.id} type="button" onClick={() => setProfileId(p.id)}
                  className="flex items-center gap-3 overflow-hidden rounded-xl p-3 text-left transition hover:shadow-sm"
                  style={{ border: `1px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "var(--twx-coral-soft)" : "#fff" }}>
                  <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: p.accent_color }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.label}</span>
                    <span className="block truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>{p.display_name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Nem kell arculatot létrehoznod — add meg egyszer ide, és ebből készül a hirdetés.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="Név" value={quick.display_name} onChange={(v) => set("display_name", v)} err={errors.display_name} placeholder="pl. Kovács Péter" />
            <TextField label="Titulus" value={quick.title} onChange={(v) => set("title", v)} placeholder="pl. ingatlanértékesítő" />
            <TextField label="Telefon" value={quick.phone} onChange={(v) => set("phone", v)} err={errors.phone} placeholder="pl. 06 70 123 4567" />
            <TextField label="E-mail" value={quick.email} onChange={(v) => set("email", v)} err={errors.email} placeholder="pl. peter@iroda.hu" />
            <TextField label="Cégnév" value={quick.company} onChange={(v) => set("company", v)} placeholder="pl. Iroda Kft." />
            <TextField label="Weboldal" value={quick.website} onChange={(v) => set("website", v)} placeholder="pl. iroda.hu" />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Fő szín</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={quick.accent_color} onChange={(e) => set("accent_color", e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded" style={{ border: "1px solid var(--twx-line)" }} />
                <input type="text" value={quick.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="twx-input w-28 text-sm" />
              </div>
            </div>
            <div className="min-w-[12rem] flex-1">
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Betűtípus</label>
              <select value={quick.font} onChange={(e) => set("font", e.target.value)} className="twx-input mt-1 w-full text-sm">
                {BRANDING_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Téma</label>
              <div className="mt-1 flex gap-1.5">
                {(["light", "dark"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => set("theme", t)}
                    className="rounded-full px-3 py-1.5 text-xs font-medium"
                    style={quick.theme === t
                      ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" }
                      : { background: "#fff", border: "1px solid var(--twx-line)" }}>
                    {t === "light" ? "Világos" : "Sötét"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- 2) Sablon ----------
function StepTemplate({ style, setStyle, ratio, setRatio, accent }: {
  style: string; setStyle: (v: string) => void;
  ratio: string; setRatio: (v: string) => void;
  accent: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold">Stílus</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FLYER_STYLES.map((s) => {
            const on = style === s.id;
            return (
              <button key={s.id} type="button" onClick={() => setStyle(s.id)}
                className="flex gap-3 rounded-xl p-3 text-left transition hover:shadow-sm"
                style={{ border: `1px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "var(--twx-coral-soft)" : "#fff" }}>
                <StyleThumb id={s.id} accent={accent} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold" style={{ color: on ? "#7a2e17" : "var(--twx-ink)" }}>{s.label}</span>
                  <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{s.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Méret</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FLYER_RATIOS.map((r) => {
            const on = ratio === r.id;
            return (
              <button key={r.id} type="button" onClick={() => setRatio(r.id)}
                className="rounded-xl p-3 text-left transition hover:shadow-sm"
                style={{ border: `1px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "var(--twx-coral-soft)" : "#fff" }}>
                <span className="block text-sm font-semibold" style={{ color: on ? "#7a2e17" : "var(--twx-ink)" }}>{r.label}</span>
                <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{r.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Apró vázlat a stílusról — az arculati színnel, hogy látszódjon a karaktere. */
function StyleThumb({ id, accent }: { id: string; accent: string }) {
  const fg = contrastOn(accent);
  const box = "flex h-14 w-11 shrink-0 flex-col overflow-hidden rounded-md";
  if (id === "modern" || id === "bold") {
    return (
      <span className={box} style={{ background: "#cfc7bb", position: "relative" }}>
        <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: id === "bold" ? "52%" : "42%", background: accent, opacity: id === "bold" ? 1 : 0.85 }} />
        <span style={{ position: "absolute", left: 4, right: 4, bottom: 5, height: 3, background: fg, opacity: 0.9 }} />
        <span style={{ position: "absolute", left: 4, width: 14, bottom: 11, height: 3, background: fg, opacity: 0.7 }} />
      </span>
    );
  }
  if (id === "magazin") {
    return (
      <span className={box} style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
        <span style={{ height: 6, background: accent }} />
        <span style={{ flex: 1, background: "#d8d1c6", margin: 3 }} />
        <span style={{ display: "flex", gap: 2, margin: "0 3px 3px" }}>
          <span style={{ flex: 1, height: 10, background: "#e8e2d8" }} />
          <span style={{ width: 14, height: 10, background: accent, opacity: 0.25 }} />
        </span>
      </span>
    );
  }
  if (id === "minimal") {
    return (
      <span className={box} style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
        <span style={{ height: 2, background: accent, margin: "5px 4px 4px" }} />
        <span style={{ flex: 1, background: "#e2dcd2", margin: "0 4px" }} />
        <span style={{ height: 3, width: 18, background: "#cfc7bb", margin: "4px" }} />
      </span>
    );
  }
  return (
    <span className={box} style={{ background: "#f3eee5", border: "1px solid var(--twx-line)" }}>
      <span style={{ height: 7, background: accent }} />
      <span style={{ flex: 1, background: "#d8d1c6", margin: 3 }} />
      <span style={{ height: 3, width: 20, background: "#bdb4a6", margin: "0 3px 5px" }} />
    </span>
  );
}

// ---------- 3) Képek ----------
function StepImages({ images, addUrl, addFiles, removeImage, moveImage, dragOver, setDragOver, fileRef }: {
  images: string[];
  addUrl: (u: string) => void;
  addFiles: (l: FileList | null) => void;
  removeImage: (i: number) => void;
  moveImage: (from: number, to: number) => void;
  dragOver: boolean; setDragOver: (v: boolean) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
        1–{MAX_FLYER_IMAGES} kép. Az első a <strong>főkép</strong> — a nyilakkal átrendezheted. A sablon a képszámhoz igazodik.
      </p>

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const url = readTwxDragUrl(e.dataTransfer);
          if (url) { addUrl(url); return; }
          addFiles(e.dataTransfer.files);
        }}
        className="cursor-pointer rounded-xl border-2 border-dashed p-5 text-center text-sm transition-colors"
        style={{ borderColor: dragOver ? "var(--twx-coral)" : "var(--twx-line)", background: dragOver ? "rgba(239,122,90,0.06)" : "transparent", color: dragOver ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}
      >
        {dragOver ? "Engedd el a képet" : "Húzd ide a képeket, vagy kattints a tallózáshoz"}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((src, i) => (
            <figure key={src + i} className="group relative overflow-hidden rounded-xl bg-white"
              style={{ border: `1px solid ${i === 0 ? "var(--twx-coral)" : "var(--twx-line)"}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="aspect-[4/3] w-full object-cover" />
              <figcaption className="flex items-center justify-between px-2 py-1.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                <span style={{ color: i === 0 ? "var(--twx-coral)" : undefined, fontWeight: i === 0 ? 700 : 500 }}>{i === 0 ? "Főkép" : `${i + 1}.`}</span>
                <span className="flex gap-1">
                  <button type="button" aria-label="Balra" onClick={() => moveImage(i, i - 1)} className="px-1">‹</button>
                  <button type="button" aria-label="Jobbra" onClick={() => moveImage(i, i + 1)} className="px-1">›</button>
                </span>
              </figcaption>
              <button type="button" onClick={() => removeImage(i)} aria-label="Törlés"
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-sm opacity-0 shadow transition group-hover:opacity-100"
                style={{ background: "rgba(255,255,255,0.95)" }}>×</button>
            </figure>
          ))}
        </div>
      )}

      <AssetTray onPick={(u) => addUrl(u)} selectedUrls={images}
        note="Válassz egy mappát, majd kattints egy képre a hirdetéshez adáshoz — vagy húzd a fenti feltöltőre." />
    </div>
  );
}

// ---------- 4) Adatok ----------
function StepFacts({ facts, setFacts, tone, setTone, text, setText, generateText, genLoading }: {
  facts: FlyerFacts; setFacts: (f: FlyerFacts) => void;
  tone: string; setTone: (v: string) => void;
  text: FlyerText; setText: (t: FlyerText) => void;
  generateText: () => void; genLoading: boolean;
}) {
  const setF = <K extends keyof FlyerFacts>(k: K, v: FlyerFacts[K]) => setFacts({ ...facts, [k]: v });
  const setT = <K extends keyof FlyerText>(k: K, v: FlyerText[K]) => setText({ ...text, [k]: v });
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold">Az ingatlan adatai</p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Elhelyezkedés" value={facts.location} onChange={(v) => setF("location", v)} placeholder="pl. Budapest, XIV. kerület" />
          <TextField label="Ár" value={facts.price} onChange={(v) => setF("price", v)} placeholder="pl. 46,5 millió Ft" />
          <TextField label="Típus" value={facts.propertyType} onChange={(v) => setF("propertyType", v)} placeholder="pl. tégla lakás" />
          <TextField label="Méret" value={facts.size} onChange={(v) => setF("size", v)} placeholder="pl. 64 nm" />
          <TextField label="Szobák" value={facts.rooms} onChange={(v) => setF("rooms", v)} placeholder="pl. 3 szoba" />
          <TextField label="Állapot" value={facts.condition} onChange={(v) => setF("condition", v)} placeholder="pl. felújított" />
          <TextField label="Egyedi jellemző" value={facts.custom1} onChange={(v) => setF("custom1", v)} placeholder="pl. panorámás terasz" />
          <TextField label="Egyedi jellemző 2" value={facts.custom2} onChange={(v) => setF("custom2", v)} placeholder="pl. saját kert" />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Hangnem</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)} className="twx-input mt-1 text-sm">
            {FLYER_TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <button type="button" onClick={generateText} disabled={genLoading}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
          {genLoading ? "Szöveg készül…" : "Szöveg generálása"}
        </button>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">A hirdetés szövege</p>
        <LimitField label="Főcím" value={text.title} onChange={(v) => setT("title", v)} max={TEXT_LIMITS.title} />
        <LimitField label="Alcím / lokáció" value={text.subtitle} onChange={(v) => setT("subtitle", v)} max={TEXT_LIMITS.subtitle} />
        <LimitField label="Megjelenő ár" value={text.price} onChange={(v) => setT("price", v)} max={TEXT_LIMITS.price} />
      </div>
    </div>
  );
}

// ---------- 5) Előnézet ----------
function StepPreview({ preview, rendering, finalUrl, onRebuild }: {
  preview: string | null; rendering: boolean; finalUrl: string | null; onRebuild: () => void;
}) {
  return (
    <div className="space-y-3 text-center">
      {rendering ? (
        <p className="py-10 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Előnézet készül…</p>
      ) : finalUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={finalUrl} alt="Kész hirdetés" className="mx-auto max-h-[52vh] rounded-xl" style={{ border: "1px solid var(--twx-line)" }} />
          <p className="text-sm text-green-700">Kész! A hirdetés elmentve — letöltheted.</p>
        </>
      ) : preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Előnézet" className="mx-auto max-h-[52vh] rounded-xl" style={{ border: "1px solid var(--twx-line)" }} />
          <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Ez vízjeles előnézet, ingyenes. Az elfogadás {FLYER_CREDITS} kredit, és tiszta, letölthető hirdetést ad.
          </p>
          <button type="button" onClick={onRebuild} className="text-xs underline" style={{ color: "var(--twx-coral)" }}>
            Előnézet frissítése
          </button>
        </>
      ) : (
        <p className="py-10 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs előnézet.</p>
      )}
    </div>
  );
}

// ---------- Mezők ----------
function TextField({ label, value, onChange, placeholder, err }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; err?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="twx-input mt-1 w-full text-sm" />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
    </div>
  );
}

/** Karakterlimites mező — így a szöveg biztosan elfér a sablonban. */
function LimitField({ label, value, onChange, max }: {
  label: string; value: string; onChange: (v: string) => void; max: number;
}) {
  const len = (value ?? "").length;
  const over = len > max * 0.9;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{label}</label>
        <span className="text-[11px]" style={{ color: over ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>{len}/{max}</span>
      </div>
      <input type="text" value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className="twx-input mt-1 w-full text-sm" />
    </div>
  );
}
