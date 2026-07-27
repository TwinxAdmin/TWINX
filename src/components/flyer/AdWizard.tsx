// Hirdetés-varázsló: Arculat → Képek → Adatok → Stílus → Előnézet.
// A hátteret a Nano Banana komponálja a partner fotóiból (szöveg nélkül), a feliratokat
// mi írjuk rá élesen — így az ékezetek, a telefonszám és az e-mail mindig hibátlan.
"use client";

import { useEffect, useRef, useState } from "react";
import { showToast } from "@/components/Toast";
import AssetTray, { readTwxDragUrl } from "@/components/AssetTray";
import { compressImage } from "@/lib/image-compress";
import { toDownloadUrl } from "@/lib/files";
import type { BrandingProfile } from "@/lib/branding";
import { BRANDING_FONTS } from "@/lib/branding";
import {
  FLYER_TONES, EMPTY_FACTS, EMPTY_TEXT, MAX_FLYER_IMAGES, FLYER_CREDITS,
  type FlyerFacts, type FlyerText,
} from "@/lib/flyer";
import { FLYER_MOODS } from "@/lib/flyer-compose";
import { ZONES, readZone, type ZoneReading } from "@/lib/flyer-zones";
import { buildOverlayHtml } from "@/lib/flyer-overlay";
import { renderFlyerToBlob } from "@/lib/flyer-client-render";
import type { FlyerProfileData } from "@/lib/flyer-template";

const STEPS = ["Arculat", "Képek", "Adatok", "Stílus", "Előnézet"] as const;

const SIZES = [
  { value: "1:1", label: "Négyzet 1:1", hint: "Instagram, Facebook", w: 1080, h: 1080, en: "square 1:1" },
  { value: "9:16", label: "Álló 9:16", hint: "Story, Reels", w: 1080, h: 1920, en: "vertical 9:16" },
  { value: "4:3", label: "Fekvő 4:3", hint: "Portálok, e-mail", w: 1440, h: 1080, en: "landscape 4:3" },
];

export default function AdWizard({
  profiles, onClose, onDone,
}: { profiles: BrandingProfile[]; onClose: () => void; onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 1) Arculat — mentett vagy egyszeri
  const [brandMode, setBrandMode] = useState<"saved" | "quick">(profiles.length ? "saved" : "quick");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [quick, setQuick] = useState({
    display_name: "", title: "", phone: "", email: "", company: "", website: "",
    accent_color: "#1e3a5f", font: BRANDING_FONTS[0].value,
  });

  // 2) Képek
  const [images, setImages] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 3) Adatok + szöveg
  const [facts, setFacts] = useState<FlyerFacts>({ ...EMPTY_FACTS });
  const [tone, setTone] = useState(FLYER_TONES[1]?.value ?? "marketinges");
  const [text, setText] = useState<FlyerText>({ ...EMPTY_TEXT });
  const [genLoading, setGenLoading] = useState(false);

  // 4) Stílus
  const [mood, setMood] = useState(FLYER_MOODS[0].value);
  const [size, setSize] = useState(SIZES[0].value);

  // 5) Háttér + előnézet
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);

  const sizeDef = SIZES.find((s) => s.value === size)!;

  const profileData: FlyerProfileData = (() => {
    const p = brandMode === "saved" ? profiles.find((x) => x.id === profileId) : null;
    if (p) {
      return {
        display_name: p.display_name, title: p.title, phone: p.phone, email: p.email,
        company: p.company, website: p.website, slogan: p.slogan,
        logo_url: p.logo_url, agent_photo_url: p.agent_photo_url,
        accent_color: p.accent_color, font: p.font, theme: p.theme === "dark" ? "dark" : "light",
      };
    }
    return {
      display_name: quick.display_name, title: quick.title, phone: quick.phone, email: quick.email,
      company: quick.company, website: quick.website, slogan: "",
      logo_url: null, agent_photo_url: null,
      accent_color: quick.accent_color, font: quick.font, theme: "light",
    };
  })();

  // --- Képek ---
  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_FLYER_IMAGES - images.length;
    if (room <= 0) { showToast(`Legfeljebb ${MAX_FLYER_IMAGES} kép.`, "info"); return; }
    setImages((prev) => [...prev, ...Array.from(list).slice(0, room).map((f) => URL.createObjectURL(f))]);
  }
  const addUrl = (u: string) =>
    setImages((prev) => (prev.includes(u) || prev.length >= MAX_FLYER_IMAGES ? prev : [...prev, u]));
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, j) => j !== i));
  const moveImage = (from: number, to: number) =>
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n;
    });

  // --- AI szöveg ---
  async function generateText() {
    setGenLoading(true); setError(null);
    try {
      const res = await fetch("/api/flyer/text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts, tone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setText(data.text as FlyerText);
    } catch {
      setError("A szöveg generálása nem sikerült — kézzel is kitöltheted.");
    } finally { setGenLoading(false); }
  }

  // --- AI háttér (Nano Banana) ---
  async function composeBackground() {
    setComposing(true); setError(null); setPreview(null); setFinalUrl(null);
    try {
      const fd = new FormData();
      for (const u of images) {
        const blob = await (await fetch(u)).blob();
        const file = new File([blob], "kep.jpg", { type: blob.type || "image/jpeg" });
        fd.append("images", await compressImage(file, 1400, 0.9));
      }
      fd.append("accent", profileData.accent_color);
      fd.append("mood", mood);
      fd.append("ratioLabel", sizeDef.en);
      const res = await fetch("/api/flyer/compose", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBgUrl(data.url as string);
      return data.url as string;
    } catch (e) {
      setError("A háttér elkészítése nem sikerült: " + (e as Error).message);
      return null;
    } finally { setComposing(false); }
  }

  // --- Szövegréteg a háttérre ---
  async function buildPreview(bg: string, watermark = true) {
    const [header, price, facts2] = await Promise.all([
      readZone(bg, ZONES.header), readZone(bg, ZONES.price), readZone(bg, ZONES.facts),
    ]);
    const chips = [facts.rooms, facts.size, facts.propertyType, facts.condition].filter(Boolean);
    const html = buildOverlayHtml({
      bgUrl: bg, width: sizeDef.w, height: sizeDef.h,
      profile: profileData,
      text: { title: text.title, subtitle: text.subtitle, price: text.price, chips },
      readings: { header, price, facts: facts2 } as { header: ZoneReading; price: ZoneReading; facts: ZoneReading },
      watermark,
    });
    return renderFlyerToBlob(html, sizeDef.w, sizeDef.h, "image", false);
  }

  async function makePreview() {
    setRendering(true); setError(null);
    try {
      const bg = bgUrl ?? (await composeBackground());
      if (!bg) return;
      const { blob } = await buildPreview(bg, true);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError("Nem sikerült az előnézet: " + (e as Error).message);
    } finally { setRendering(false); }
  }

  async function accept() {
    if (!bgUrl) return;
    setAccepting(true); setError(null);
    try {
      const { blob, ext, contentType } = await buildPreview(bgUrl, false);
      const fd = new FormData();
      fd.append("image", new File([blob], `hirdetes.${ext}`, { type: contentType }));
      if (brandMode === "saved") fd.append("profileId", profileId);
      fd.append("title", text.title ?? "");
      const res = await fetch("/api/flyer/accept", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFinalUrl(data.url as string);
      onDone?.();
      showToast(data.charged ? `Kész! ${FLYER_CREDITS} kredit levonva.` : "Kész!", "success");
    } catch (e) {
      setError((e as Error).message || "Nem sikerült az elfogadás.");
    } finally { setAccepting(false); }
  }

  // Az előnézet lépésre lépve indul a folyamat.
  useEffect(() => {
    if (step === 4 && !preview && !rendering && !composing) void makePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => { setBgUrl(null); setPreview(null); setFinalUrl(null); }, [mood, size, images.length]);

  function next() {
    if (step === 0) {
      if (brandMode === "saved" && !profileId) { setError("Válassz arculatot."); return; }
      if (brandMode === "quick" && !quick.display_name.trim() && !quick.company.trim()) {
        setError("Adj meg egy nevet vagy cégnevet."); return;
      }
      if (brandMode === "quick" && !quick.phone.trim() && !quick.email.trim()) {
        setError("Adj meg legalább egy elérhetőséget."); return;
      }
    }
    if (step === 1 && !images.length) { setError("Adj hozzá legalább egy képet."); return; }
    if (step === 2 && !text.title?.trim()) { setError("Adj címet a hirdetésnek."); return; }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  const set = <K extends keyof typeof quick>(k: K, v: string) => setQuick({ ...quick, [k]: v });
  const setF = <K extends keyof FlyerFacts>(k: K, v: string) => setFacts({ ...facts, [k]: v });
  const setT = <K extends keyof FlyerText>(k: K, v: FlyerText[K]) => setText({ ...text, [k]: v });

  return (
    <div onClick={() => !accepting && !rendering && !composing && onClose()} className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.55)" }}>
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
                <button type="button" onClick={() => i < step && setStep(i)} className="flex items-center gap-1.5 text-[11px] font-semibold"
                  style={{ color: i === step ? "var(--twx-coral)" : i < step ? "var(--twx-ink)" : "var(--twx-ink-muted)" }}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                    style={i <= step ? { background: "var(--twx-coral)", color: "#1c1005" } : { border: "1px solid var(--twx-line)" }}>{i + 1}</span>
                  <span className="hidden sm:inline">{s}</span>
                </button>
                {i < STEPS.length - 1 && <span className="h-px flex-1" style={{ background: "var(--twx-line)" }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Tartalom */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {/* 1) ARCULAT */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setBrandMode("saved")} disabled={!profiles.length}
                  className="flex-1 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40"
                  style={brandMode === "saved" ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" } : { background: "#fff", border: "1px solid var(--twx-line)" }}>
                  Mentett arculatom
                </button>
                <button type="button" onClick={() => setBrandMode("quick")}
                  className="flex-1 rounded-xl px-4 py-2 text-sm font-medium"
                  style={brandMode === "quick" ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" } : { background: "#fff", border: "1px solid var(--twx-line)" }}>
                  Most adom meg
                </button>
              </div>

              {brandMode === "saved" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {profiles.map((p) => {
                    const on = profileId === p.id;
                    return (
                      <button key={p.id} type="button" onClick={() => setProfileId(p.id)}
                        className="flex items-center gap-3 rounded-xl p-3 text-left transition hover:shadow-sm"
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
              ) : (
                <div className="space-y-3">
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Nem kell arculatot létrehoznod — ezekből készül a hirdetés.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Név" value={quick.display_name} onChange={(v) => set("display_name", v)} placeholder="pl. Kovács Péter" />
                    <Field label="Titulus" value={quick.title} onChange={(v) => set("title", v)} placeholder="pl. ingatlanértékesítő" />
                    <Field label="Telefon" value={quick.phone} onChange={(v) => set("phone", v)} placeholder="pl. +36 30 123 4567" />
                    <Field label="E-mail" value={quick.email} onChange={(v) => set("email", v)} placeholder="pl. peter@iroda.hu" />
                    <Field label="Cégnév" value={quick.company} onChange={(v) => set("company", v)} placeholder="pl. Prémium Ingatlanok" />
                    <Field label="Weboldal" value={quick.website} onChange={(v) => set("website", v)} placeholder="pl. iroda.hu" />
                  </div>
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Fő szín</label>
                      <div className="mt-1 flex items-center gap-2">
                        <input type="color" value={quick.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="h-9 w-12 cursor-pointer rounded" style={{ border: "1px solid var(--twx-line)" }} />
                        <input type="text" value={quick.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="twx-input w-28 text-sm" />
                      </div>
                    </div>
                    <div className="min-w-[12rem] flex-1">
                      <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Betűtípus</label>
                      <select value={quick.font} onChange={(e) => set("font", e.target.value)} className="twx-input mt-1 w-full text-sm">
                        {BRANDING_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2) KÉPEK */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                1–{MAX_FLYER_IMAGES} kép. Az első a <strong>főkép</strong> — ez lesz a hirdetés nagy képe.
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
                style={{ borderColor: dragOver ? "var(--twx-coral)" : "var(--twx-line)", background: dragOver ? "rgba(239,122,90,0.06)" : "transparent", color: dragOver ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>
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
                note="Válassz egy mappát, majd kattints egy képre a hirdetéshez adáshoz — vagy húzd a feltöltőre." />
            </div>
          )}

          {/* 3) ADATOK */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold">Az ingatlan adatai</p>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Elhelyezkedés" value={facts.location} onChange={(v) => setF("location", v)} placeholder="pl. Budapest, V. kerület" />
                  <Field label="Ár" value={facts.price} onChange={(v) => setF("price", v)} placeholder="pl. 145.000.000 Ft" />
                  <Field label="Típus" value={facts.propertyType} onChange={(v) => setF("propertyType", v)} placeholder="pl. penthouse" />
                  <Field label="Méret" value={facts.size} onChange={(v) => setF("size", v)} placeholder="pl. 125 m²" />
                  <Field label="Szobák" value={facts.rooms} onChange={(v) => setF("rooms", v)} placeholder="pl. 3 szobás" />
                  <Field label="Állapot / extra" value={facts.condition} onChange={(v) => setF("condition", v)} placeholder="pl. panorámás erkély" />
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
                <Limit label="Főcím" value={text.title} onChange={(v) => setT("title", v)} max={52} />
                <Limit label="Alcím" value={text.subtitle} onChange={(v) => setT("subtitle", v)} max={58} />
                <Limit label="Megjelenő ár" value={text.price} onChange={(v) => setT("price", v)} max={18} />
              </div>
            </div>
          )}

          {/* 4) STÍLUS */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold">Hangulat</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Ez adja a hirdetés dizájnját — a képeidet ebben a stílusban rendezi el az AI.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {FLYER_MOODS.map((m) => {
                    const on = mood === m.value;
                    return (
                      <button key={m.value} type="button" onClick={() => setMood(m.value)}
                        className="rounded-xl p-3 text-left transition hover:shadow-sm"
                        style={{ border: `1px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "var(--twx-coral-soft)" : "#fff" }}>
                        <span className="block text-sm font-semibold" style={{ color: on ? "#7a2e17" : "var(--twx-ink)" }}>{m.label}</span>
                        <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{m.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Méret</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {SIZES.map((s) => {
                    const on = size === s.value;
                    return (
                      <button key={s.value} type="button" onClick={() => setSize(s.value)}
                        className="rounded-xl p-3 text-left transition hover:shadow-sm"
                        style={{ border: `1px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "var(--twx-coral-soft)" : "#fff" }}>
                        <span className="block text-sm font-semibold" style={{ color: on ? "#7a2e17" : "var(--twx-ink)" }}>{s.label}</span>
                        <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{s.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 5) ELŐNÉZET */}
          {step === 4 && (
            <div className="space-y-3 text-center">
              {composing || rendering ? (
                <div className="py-12">
                  <p className="text-sm font-medium">{composing ? "A hirdetés készül…" : "Feliratok elhelyezése…"}</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Ez fél percig is eltarthat.</p>
                </div>
              ) : finalUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={finalUrl} alt="Kész hirdetés" className="mx-auto max-h-[54vh] rounded-xl" style={{ border: "1px solid var(--twx-line)" }} />
                  <p className="text-sm text-green-700">Kész! A hirdetés elmentve.</p>
                </>
              ) : preview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Előnézet" className="mx-auto max-h-[54vh] rounded-xl" style={{ border: "1px solid var(--twx-line)" }} />
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Vízjeles előnézet, ingyenes. Az elfogadás {FLYER_CREDITS} kredit, és tiszta, letölthető hirdetést ad.
                  </p>
                  <button type="button" onClick={async () => { setBgUrl(null); setPreview(null); await makePreview(); }}
                    className="text-xs underline" style={{ color: "var(--twx-coral)" }}>
                    Nem tetszik? Új változat kérése
                  </button>
                </>
              ) : (
                <p className="py-10 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs előnézet.</p>
              )}
            </div>
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
            <button type="button" onClick={next} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
              Tovább
            </button>
          ) : finalUrl ? (
            <div className="flex gap-2">
              <a href={toDownloadUrl(finalUrl)} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>Letöltés</a>
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)" }}>Kész</button>
            </div>
          ) : (
            <button type="button" onClick={accept} disabled={accepting || rendering || composing || !preview}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
              {accepting ? "Feldolgozás…" : `Elfogadom (${FLYER_CREDITS} kredit)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="twx-input mt-1 w-full text-sm" />
    </div>
  );
}

function Limit({ label, value, onChange, max }: {
  label: string; value: string; onChange: (v: string) => void; max: number;
}) {
  const len = (value ?? "").length;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{label}</label>
        <span className="text-[11px]" style={{ color: len > max * 0.9 ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>{len}/{max}</span>
      </div>
      <input type="text" value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className="twx-input mt-1 w-full text-sm" />
    </div>
  );
}
