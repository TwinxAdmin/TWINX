// Hirdetés-varázsló: Arculat → Képek → Adatok → Stílus → Előnézet.
// A hirdetést kódból rajzoljuk (nincs AI): a fotókat egy igényes sablonba rendezzük,
// a feliratokat élesen írjuk rá — így az ékezetek, a telefonszám és az e-mail mindig hibátlan.
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
  ROOMS_OPTIONS, BATHROOM_OPTIONS,
  type FlyerFacts, type FlyerText,
} from "@/lib/flyer";
import { PROPERTY_TYPE_OPTIONS, FLOOR_OPTIONS, CONDITION_OPTIONS, STRUCTURE_OPTIONS } from "@/lib/valuation";
import ComboField from "@/components/ComboField";
import { FLYER_SIZES, getFlyerSize, flyerGeom } from "@/lib/flyer-poster";
import type { FlyerProfileData } from "@/lib/flyer-template";

const STEPS = ["Arculat", "Képek", "Adatok", "Méret", "Előnézet"] as const;
const FLYER_MOOD = "luxus"; // egyetlen, prémium megjelenés (a fő szín az arculatból)
const SIZES = FLYER_SIZES;

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

  // 4) Méret (a megjelenés egységes: FLYER_MOOD)
  const mood = FLYER_MOOD;
  const [size, setSize] = useState<string>(SIZES[0].value);

  // 5) Előnézet
  const [heroPos, setHeroPos] = useState({ x: 50, y: 50 }); // a főkép kivágása (%)
  const [thumbSlots, setThumbSlots] = useState<Record<number, "row" | "up1" | "up2">>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [finalUrl, setFinalUrl] = useState<string | null>(null);

  const sizeDef = getFlyerSize(size);

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

  // --- A hirdetés PNG-je a szerveren, Satorival (pixelpontos, valódi betűkkel) ---
  async function buildBlob(watermark: boolean): Promise<{ blob: Blob; ext: string; contentType: string }> {
    // Felül csak a lényeg (szoba + típus) — a részletes adatok lent, ikonosan.
    const chips = [facts.rooms, facts.propertyType].filter(Boolean);
    const details = {
      size: facts.size, rooms: facts.rooms, bathrooms: facts.bathrooms,
      floor: facts.floor, structure: facts.structure, condition: facts.condition,
    };
    const fd = new FormData();
    for (const u of images) {
      const b = await (await fetch(u)).blob();
      const f = new File([b], "kep.jpg", { type: b.type || "image/jpeg" });
      // 2400px bőven elég a 2160-as renderhez; a kérés így a Vercel-limit alatt marad.
      fd.append("images", await compressImage(f, 2400, 0.9));
    }
    fd.append("profile", JSON.stringify(profileData));
    fd.append("mood", mood);
    fd.append("size", size);
    fd.append("watermark", watermark ? "1" : "0");
    fd.append("title", text.title ?? "");
    fd.append("subtitle", text.subtitle ?? "");
    fd.append("price", text.price ?? "");
    fd.append("chips", JSON.stringify(chips));
    fd.append("details", JSON.stringify(details));
    fd.append("heroX", String(heroPos.x));
    fd.append("heroY", String(heroPos.y));
    fd.append("thumbSlots", JSON.stringify([thumbSlots[0] ?? "row", thumbSlots[1] ?? "row"]));
    // A főkép valódi mérete → a szerver a teljes rejtett területen tud mozgatni.
    if (images[0]) {
      try {
        const dim = await new Promise<{ w: number; h: number }>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
          im.onerror = () => reject(new Error("mérés hiba"));
          im.src = images[0];
        });
        fd.append("heroW", String(dim.w));
        fd.append("heroH", String(dim.h));
      } catch { /* mérés nélkül a tartalék (16%) mozgástér él */ }
    }
    const res = await fetch("/api/flyer/render", { method: "POST", body: fd });
    if (!res.ok) throw new Error(await res.text());
    return { blob: await res.blob(), ext: "png", contentType: "image/png" };
  }

  async function makePreview() {
    setRendering(true); setError(null);
    try {
      const { blob } = await buildBlob(true);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      setError("Nem sikerült az előnézet: " + (e as Error).message);
    } finally { setRendering(false); }
  }

  async function accept() {
    setAccepting(true); setError(null);
    try {
      const { blob } = await buildBlob(false);
      // A 2× felbontású PNG nagy — minőségi JPEG-ként töltjük fel (nem skálázzuk).
      const jpeg = await compressImage(new File([blob], "hirdetes.png", { type: "image/png" }), 10000, 0.93);
      const fd = new FormData();
      fd.append("image", jpeg);
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

  // Az előnézet lépésre lépve renderel.
  useEffect(() => {
    if (step === 4 && !preview && !rendering) void makePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => {
    setPreview(null); setFinalUrl(null);
    // Story (9:16): a kis képek alapból FÜGGŐLEGES oszlopban (a jobb szélső fölött) —
    // átüzhetők sorba; más méretnél alapból sorban.
    const def = flyerGeom(sizeDef.w, sizeDef.h).story;
    setThumbSlots(def ? { 0: "up2", 1: "up1" } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, images.length]);

  // A főkép igazítása / kis képek áthelyezése → új render (az effect mindig FRISS állapottal fut).
  function nudgeHero(dx: number, dy: number) {
    if (rendering || accepting || finalUrl) return;
    setHeroPos((p) => ({
      x: Math.max(0, Math.min(100, p.x + dx)),
      y: Math.max(0, Math.min(100, p.y + dy)),
    }));
  }
  useEffect(() => {
    if (step === 4 && !finalUrl) { setPreview(null); void makePreview(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroPos, thumbSlots]);

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
                <p className="mt-0.5 mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Válassz a listából, vagy írj sajátot. Minél több adat, annál gazdagabb a hirdetés.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Település, kerület" value={facts.location} onChange={(v) => setF("location", v)} placeholder="pl. Budapest, V. kerület" />
                  <Field label="Pontosabb helyszín / utca" value={facts.street} onChange={(v) => setF("street", v)} placeholder="pl. Belváros / Váci utca" />
                  <Combo label="Ingatlan típusa" value={facts.propertyType} onChange={(v) => setF("propertyType", v)} options={PROPERTY_TYPE_OPTIONS} placeholder="Válassz vagy írj sajátot" />
                  <Combo label="Szobaszám" value={facts.rooms} onChange={(v) => setF("rooms", v)} options={ROOMS_OPTIONS} placeholder="Válassz vagy írj sajátot" />
                  <Combo label="Épület szintje" value={facts.floor} onChange={(v) => setF("floor", v)} options={FLOOR_OPTIONS} placeholder="Válassz a listából" />
                  <Combo label="Fürdő / mellékhelyiség" value={facts.bathrooms} onChange={(v) => setF("bathrooms", v)} options={BATHROOM_OPTIONS} placeholder="Válassz vagy írj sajátot" />
                  <Combo label="Műszaki állapot" value={facts.condition} onChange={(v) => setF("condition", v)} options={CONDITION_OPTIONS} placeholder="Válassz a listából" />
                  <Combo label="Szerkezet" value={facts.structure} onChange={(v) => setF("structure", v)} options={STRUCTURE_OPTIONS} placeholder="Válassz a listából" />
                  <Field label="Méret" value={facts.size} onChange={(v) => setF("size", v)} placeholder="pl. 125 m²" />
                  <Field label="Ár" value={facts.price} onChange={(v) => setF("price", v)} placeholder="pl. 145.000.000 Ft" />
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

          {/* 4) MÉRET */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold">Méret</p>
                <p className="mt-0.5 mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Válaszd ki, hova készül a hirdetés. A megjelenés egységes, prémium — a fő szín az arculatodból jön.
                </p>
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
              {finalUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={finalUrl} alt="Kész hirdetés" className="mx-auto max-h-[54vh] rounded-xl" style={{ border: "1px solid var(--twx-line)" }} />
                  <p className="text-sm text-green-700">Kész! A hirdetés elmentve.</p>
                </>
              ) : rendering ? (
                <div className="py-12">
                  <p className="text-sm font-medium">A hirdetés készül…</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Néhány másodperc.</p>
                </div>
              ) : preview ? (
                <>
                  <div className="relative mx-auto inline-flex">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Előnézet" draggable={false} className="mx-auto max-h-[54vh] select-none rounded-xl" style={{ border: "1px solid var(--twx-line)" }} />
                    {/* A kis képek áthelyezése: a mozgathatók felhúzhatók a jobb szélső (fix) fölé */}
                    {images.length > 2 && !flyerGeom(sizeDef.w, sizeDef.h).land && (
                      <ThumbSlotOverlay
                        w={sizeDef.w} h={sizeDef.h}
                        count={images.length - 2}
                        slots={thumbSlots}
                        onMove={(i, slot) => setThumbSlots((prev) => ({ ...prev, [i]: slot }))}
                      />
                    )}
                  </div>
                  <HeroControls heroPos={heroPos} nudge={nudgeHero} reset={() => setHeroPos({ x: 50, y: 50 })} disabled={rendering} />
                  {images.length > 2 && (
                    <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      A szaggatott keretű kis képek egérrel áthúzhatók a jobb szélső kép fölötti helyekre.
                    </p>
                  )}
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Vízjeles előnézet, ingyenes. Az elfogadás {FLYER_CREDITS} kredit, és tiszta, letölthető hirdetést ad.
                  </p>
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

function HeroControls({ heroPos, nudge, reset, disabled }: {
  heroPos: { x: number; y: number };
  nudge: (dx: number, dy: number) => void;
  reset: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Főkép igazítása:</span>
      {([
        ["←", 12, 0], ["→", -12, 0], ["↑", 0, 12], ["↓", 0, -12],
      ] as Array<[string, number, number]>).map(([lbl, dx, dy]) => (
        <button key={lbl} type="button" onClick={() => nudge(dx, dy)} disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold disabled:opacity-40"
          style={{ border: "1px solid var(--twx-line)", background: "#fff" }} aria-label={`Főkép ${lbl}`}>
          {lbl}
        </button>
      ))}
      {(heroPos.x !== 50 || heroPos.y !== 50) && (
        <button type="button" onClick={reset} disabled={disabled}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium disabled:opacity-40"
          style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
          Középre
        </button>
      )}
    </div>
  );
}

/** A kis képek áthelyezése az előnézeten: a bal oldaliak felhúzhatók a jobb szélső (fix) fölé.
 *  A pozíciók a sablon geometriáját tükrözik (1080-as alapegység, %-ban). */
function ThumbSlotOverlay({ w, h, count, slots, onMove }: {
  w: number; h: number;
  count: number; // hány NEM-fix kis kép van (1 vagy 2)
  slots: Record<number, "row" | "up1" | "up2">;
  onMove: (i: number, slot: "row" | "up1" | "up2") => void;
}) {
  const [hover, setHover] = useState<string | null>(null); // épp e fölé húzzák a képet
  // KÖZÖS geometria a szerver-renderrel (flyerGeom) — méretenként más kompozíció.
  const g = flyerGeom(w, h);
  const T = g.thumbD, gap = g.gapT, right0 = g.right0;
  const B0 = g.B0;
  const wPct = (px: number) => (px / w) * 100;
  const hPct = (px: number) => (px / h) * 100;

  // Ugyanaz az elrendezési logika, mint a szerveren.
  const pos: Record<number, { right: number; bottom: number }> = {};
  let k = 1;
  for (let i = count - 1; i >= 0; i--) {
    const s = slots[i] ?? "row";
    if (s === "up1") pos[i] = { right: right0, bottom: B0 + (T + gap) };
    else if (s === "up2") pos[i] = { right: right0, bottom: B0 + 2 * (T + gap) };
    else { pos[i] = { right: right0 + k * (T + gap), bottom: B0 }; k++; }
  }
  const used = new Set(Object.values(slots));
  const emptySlots: Array<{ slot: "up1" | "up2" | "row"; right: number; bottom: number }> = [];
  if (!used.has("up1")) emptySlots.push({ slot: "up1", right: right0, bottom: B0 + (T + gap) });
  if (!used.has("up2") && used.has("up1")) emptySlots.push({ slot: "up2", right: right0, bottom: B0 + 2 * (T + gap) });
  if (used.has("up1") || used.has("up2")) emptySlots.push({ slot: "row", right: right0 + k * (T + gap), bottom: B0 });

  const boxStyle = (p: { right: number; bottom: number }): React.CSSProperties => ({
    position: "absolute",
    right: `${wPct(p.right)}%`,
    bottom: `${hPct(p.bottom)}%`,
    width: `${wPct(T)}%`,
    height: `${hPct(T)}%`,
  });

  return (
    <>
      {Array.from({ length: count }).map((_, i) => {
        const moved = (slots[i] ?? "row") !== "row"; // áthelyezett kép: más szín
        return (
          <div key={`d${i}`} draggable
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; }}
            style={{
              ...boxStyle(pos[i]), cursor: "grab", borderRadius: 10,
              border: moved ? "3px solid #ff8a5c" : "2px dashed rgba(255,255,255,0.9)",
              background: moved ? "rgba(255,138,92,0.16)" : "transparent",
              boxShadow: moved ? "0 0 0 2px rgba(255,138,92,0.35)" : undefined,
            }}
            title="Húzd át egy másik helyre"
          />
        );
      })}
      {emptySlots.map((s) => {
        const hovered = hover === s.slot;
        return (
          <div key={s.slot}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setHover(s.slot); }}
            onDragLeave={() => setHover(null)}
            onDrop={(e) => {
              e.preventDefault();
              setHover(null);
              const i = Number(e.dataTransfer.getData("text/plain"));
              if (Number.isInteger(i) && i >= 0 && i < count) onMove(i, s.slot);
            }}
            style={{
              ...boxStyle(s), borderRadius: 10,
              border: hovered ? "3px solid #7ee08a" : "2px dashed rgba(255,255,255,0.6)",
              background: hovered ? "rgba(126,224,138,0.28)" : "rgba(255,255,255,0.14)",
            }}
            title="Ide húzhatod a kis képet"
          />
        );
      })}
    </>
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

function Combo({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: readonly string[]; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{label}</label>
      <ComboField className="mt-1 w-full" value={value} onChange={onChange} options={options} placeholder={placeholder} />
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
