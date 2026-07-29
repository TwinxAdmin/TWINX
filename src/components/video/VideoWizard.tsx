// Videó-varázsló: Arculat → Képek (4-5) → Adatok → Beállítás → Generálás.
// Nincs előnézet: a kész videó azonnal a tárhelyre és az előzmények közé kerül.
// Hang: csak zene. Feliratok: nyitó/záró kártya + a fotók alsó felirat-sávja (Satori).
"use client";

import { useEffect, useRef, useState } from "react";
import { showToast } from "@/components/Toast";
import AssetTray, { readTwxDragUrl } from "@/components/AssetTray";
import ComboField from "@/components/ComboField";
import { compressImage } from "@/lib/image-compress";
import { toDownloadUrl } from "@/lib/files";
import type { BrandingProfile } from "@/lib/branding";
import { BRANDING_FONTS } from "@/lib/branding";
import {
  MIN_VIDEO_IMAGES, MAX_VIDEO_IMAGES, VIDEO_FORMATS, MUSIC_STYLES,
  VIDEO_CREDITS_ALAP, VIDEO_CREDITS_PRO, videoLengthSeconds,
  type VideoCaptionFacts, EMPTY_VIDEO_FACTS,
} from "@/lib/video";
import { PROPERTY_TYPE_OPTIONS, FLOOR_OPTIONS, CONDITION_OPTIONS, STRUCTURE_OPTIONS } from "@/lib/valuation";
import { ROOMS_OPTIONS, BATHROOM_OPTIONS } from "@/lib/flyer";
import type { FlyerProfileData } from "@/lib/flyer-template";

const STEPS = ["Arculat", "Képek", "Adatok", "Beállítás", "Generálás"] as const;

type JobState = { status: string; output_url: string | null; error: string | null };

export default function VideoWizard({
  profiles, onClose, onDone,
}: { profiles: BrandingProfile[]; onClose: () => void; onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 1) Arculat
  const [brandMode, setBrandMode] = useState<"saved" | "quick">(profiles.length ? "saved" : "quick");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [quick, setQuick] = useState({
    display_name: "", title: "", phone: "", email: "", company: "", website: "",
    accent_color: "#1e3a5f", font: BRANDING_FONTS[0].value,
  });

  // 2) Képek (4-5, az első a nyitófotó — PRO-nál ez kap AI-mozgást)
  const [images, setImages] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 3) Adatok (nyitókártya + felirat-sávok)
  const [title, setTitle] = useState("");
  const [street, setStreet] = useState(""); // utca, házszám — a videó neve ebből lesz
  const [facts, setFacts] = useState<VideoCaptionFacts & { propertyType: string }>({
    ...EMPTY_VIDEO_FACTS, propertyType: "",
  });

  // 4) Beállítás
  const [format, setFormat] = useState<string>(VIDEO_FORMATS[0].value);
  const [musicStyle, setMusicStyle] = useState<string>(MUSIC_STYLES[0].slug);
  const [pkg, setPkg] = useState<"alap" | "pro">("alap");

  // 5) Generálás
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);

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
    const room = MAX_VIDEO_IMAGES - images.length;
    if (room <= 0) { showToast(`Legfeljebb ${MAX_VIDEO_IMAGES} kép.`, "info"); return; }
    setImages((prev) => [...prev, ...Array.from(list).slice(0, room).map((f) => URL.createObjectURL(f))]);
  }
  const addUrl = (u: string) =>
    setImages((prev) => (prev.includes(u) || prev.length >= MAX_VIDEO_IMAGES ? prev : [...prev, u]));
  const removeImage = (i: number) => setImages((prev) => prev.filter((_, j) => j !== i));
  const moveImage = (from: number, to: number) =>
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n;
    });

  // --- Generálás indítása ---
  async function generate() {
    setSubmitting(true); setError(null);
    try {
      const fd = new FormData();
      for (const u of images) {
        const b = await (await fetch(u)).blob();
        const f = new File([b], "kep.jpg", { type: b.type || "image/jpeg" });
        fd.append("images", await compressImage(f, 2000, 0.9));
      }
      fd.append("profile", JSON.stringify(profileData));
      fd.append("facts", JSON.stringify(facts));
      fd.append("title", title.trim() || defaultTitle());
      // A videó neve a könyvtárban: az ingatlan címe (település + utca).
      fd.append("propertyAddress", [facts.location, street].map((s) => s.trim()).filter(Boolean).join(", "));
      fd.append("format", format);
      fd.append("musicStyle", musicStyle);
      fd.append("package", pkg);
      const res = await fetch("/api/real-estate/video", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJobId(data.jobId as string);
      setJob({ status: data.status as string, output_url: null, error: null });
      setElapsed(0);
    } catch (e) {
      setError((e as Error).message || "Nem sikerült elindítani a generálást.");
    } finally { setSubmitting(false); }
  }

  function defaultTitle(): string {
    const t = facts.propertyType ? `Eladó ${facts.propertyType.toLowerCase()}` : "Eladó ingatlan";
    return t;
  }

  // Polling a job státuszára (3 mp-enként), amíg kész/hibás nem lesz.
  useEffect(() => {
    if (!jobId || job?.status === "done" || job?.status === "failed") return;
    const t = setInterval(async () => {
      setElapsed((s) => s + 3);
      try {
        const res = await fetch(`/api/real-estate/video/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        setJob({ status: data.status, output_url: data.output_url ?? null, error: data.error ?? null });
        if (data.status === "done") { onDone?.(); showToast("A videó elkészült és mentve!", "success"); }
        if (data.status === "failed") showToast("A videó nem készült el — a kredit visszajárt.", "error");
      } catch { /* következő kör */ }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, job?.status]);

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
    if (step === 1 && (images.length < MIN_VIDEO_IMAGES || images.length > MAX_VIDEO_IMAGES)) {
      setError(`${MIN_VIDEO_IMAGES}-${MAX_VIDEO_IMAGES} kép szükséges.`); return;
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  const setQ = <K extends keyof typeof quick>(k: K, v: string) => setQuick({ ...quick, [k]: v });
  const setF = <K extends keyof typeof facts>(k: K, v: string) => setFacts({ ...facts, [k]: v });
  const busy = submitting || (!!jobId && job?.status !== "done" && job?.status !== "failed");
  const lengthSec = Math.round(videoLengthSeconds(images.length || MIN_VIDEO_IMAGES, pkg === "pro"));

  return (
    <div onClick={() => !busy && onClose()} className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.55)" }}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>

        {/* Fejléc + lépésjelző */}
        <div className="border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Új videó</h2>
            <button onClick={onClose} disabled={busy} className="rounded-lg px-2 text-xl disabled:opacity-40" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center gap-1.5">
                <button type="button" onClick={() => i < step && !jobId && setStep(i)} className="flex items-center gap-1.5 text-[11px] font-semibold"
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Név" value={quick.display_name} onChange={(v) => setQ("display_name", v)} placeholder="pl. Kovács Péter" />
                  <Field label="Titulus" value={quick.title} onChange={(v) => setQ("title", v)} placeholder="pl. ingatlanértékesítő" />
                  <Field label="Telefon" value={quick.phone} onChange={(v) => setQ("phone", v)} placeholder="pl. +36 30 123 4567" />
                  <Field label="E-mail" value={quick.email} onChange={(v) => setQ("email", v)} placeholder="pl. peter@iroda.hu" />
                  <Field label="Cégnév" value={quick.company} onChange={(v) => setQ("company", v)} placeholder="pl. Prémium Ingatlanok" />
                  <div>
                    <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Fő szín</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input type="color" value={quick.accent_color} onChange={(e) => setQ("accent_color", e.target.value)} className="h-9 w-12 cursor-pointer rounded" style={{ border: "1px solid var(--twx-line)" }} />
                      <input type="text" value={quick.accent_color} onChange={(e) => setQ("accent_color", e.target.value)} className="twx-input w-28 text-sm" />
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
                {MIN_VIDEO_IMAGES}–{MAX_VIDEO_IMAGES} kép. Az első a <strong>nyitófotó</strong> —
                PRO csomagnál ez kap AI-mozgást.
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
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {images.map((src, i) => (
                    <figure key={src + i} className="group relative overflow-hidden rounded-xl bg-white"
                      style={{ border: `1px solid ${i === 0 ? "var(--twx-coral)" : "var(--twx-line)"}` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="aspect-[4/3] w-full object-cover" />
                      <figcaption className="flex items-center justify-between px-2 py-1.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                        <span style={{ color: i === 0 ? "var(--twx-coral)" : undefined, fontWeight: i === 0 ? 700 : 500 }}>{i === 0 ? "Nyitó" : `${i + 1}.`}</span>
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
                note="Válassz egy mappát, majd kattints egy képre — vagy húzd a feltöltőre." />
            </div>
          )}

          {/* 3) ADATOK */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold">Nyitókártya</p>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Főcím" value={title} onChange={setTitle} placeholder={defaultTitle()} />
                  <Combo label="Ingatlan típusa" value={facts.propertyType} onChange={(v) => setF("propertyType", v)} options={PROPERTY_TYPE_OPTIONS} placeholder="a főcímhez (pl. Eladó panellakás)" />
                  <Field label="Település, kerület" value={facts.location} onChange={(v) => setF("location", v)} placeholder="pl. Budapest, V. kerület" />
                  <Field label="Utca, házszám" value={street} onChange={setStreet} placeholder="pl. Sas utca 12." />
                  <Field label="Ár" value={facts.price} onChange={(v) => setF("price", v)} placeholder="pl. 100 M Ft" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Felirat-sávok a fotókon</p>
                <p className="mt-0.5 mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Fotónként váltakozó adatok kerülnek a kép aljára — csak amit megadsz.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Méret" value={facts.size} onChange={(v) => setF("size", v)} placeholder="pl. 100 m²" />
                  <Combo label="Szobaszám" value={facts.rooms} onChange={(v) => setF("rooms", v)} options={ROOMS_OPTIONS} placeholder="Válassz vagy írj sajátot" />
                  <Combo label="Fürdő / mellékhelyiség" value={facts.bathrooms} onChange={(v) => setF("bathrooms", v)} options={BATHROOM_OPTIONS} placeholder="Válassz vagy írj sajátot" />
                  <Combo label="Épület szintje" value={facts.floor} onChange={(v) => setF("floor", v)} options={FLOOR_OPTIONS} placeholder="Válassz a listából" />
                  <Combo label="Szerkezet" value={facts.structure} onChange={(v) => setF("structure", v)} options={STRUCTURE_OPTIONS} placeholder="Válassz a listából" />
                  <Combo label="Műszaki állapot" value={facts.condition} onChange={(v) => setF("condition", v)} options={CONDITION_OPTIONS} placeholder="Válassz a listából" />
                </div>
              </div>
            </div>
          )}

          {/* 4) BEÁLLÍTÁS */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold">Méret</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {VIDEO_FORMATS.map((f) => {
                    const on = format === f.value;
                    return (
                      <button key={f.value} type="button" onClick={() => setFormat(f.value)}
                        className="rounded-xl p-3 text-left" style={{ border: `1px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "var(--twx-coral-soft)" : "#fff" }}>
                        <span className="block text-sm font-semibold" style={{ color: on ? "#7a2e17" : "var(--twx-ink)" }}>{f.label}</span>
                        <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{f.value === "9:16" ? "Story, Reels, TikTok" : "Instagram, Facebook"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Zene</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {MUSIC_STYLES.map((m) => {
                    const on = musicStyle === m.slug;
                    return (
                      <button key={m.slug} type="button" onClick={() => setMusicStyle(m.slug)}
                        className="rounded-xl px-3 py-2 text-sm font-medium" style={{ border: `1px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "var(--twx-coral-soft)" : "#fff", color: on ? "#7a2e17" : "var(--twx-ink)" }}>
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Csomag</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => setPkg("alap")}
                    className="rounded-xl p-3 text-left" style={{ border: `1px solid ${pkg === "alap" ? "var(--twx-coral)" : "var(--twx-line)"}`, background: pkg === "alap" ? "var(--twx-coral-soft)" : "#fff" }}>
                    <span className="block text-sm font-semibold" style={{ color: pkg === "alap" ? "#7a2e17" : "var(--twx-ink)" }}>Alap · {VIDEO_CREDITS_ALAP} kredit</span>
                    <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>Finom kameramozgás (Ken Burns) minden fotón</span>
                  </button>
                  <button type="button" onClick={() => setPkg("pro")}
                    className="rounded-xl p-3 text-left" style={{ border: `1px solid ${pkg === "pro" ? "var(--twx-coral)" : "var(--twx-line)"}`, background: pkg === "pro" ? "var(--twx-coral-soft)" : "#fff" }}>
                    <span className="block text-sm font-semibold" style={{ color: pkg === "pro" ? "#7a2e17" : "var(--twx-ink)" }}>PRO · {VIDEO_CREDITS_PRO} kredit</span>
                    <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>A nyitófotó valódi AI-kameramozgást kap</span>
                  </button>
                </div>
              </div>
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                Várható hossz: ~{lengthSec} mp (nyitókártya + {images.length || MIN_VIDEO_IMAGES} fotó + zárókártya). Hang: csak zene.
              </p>
            </div>
          )}

          {/* 5) GENERÁLÁS */}
          {step === 4 && (
            <div className="space-y-4 text-center">
              {!jobId ? (
                <div className="py-8">
                  <p className="text-sm font-medium">Minden készen áll.</p>
                  <p className="mx-auto mt-2 max-w-md text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    A videó generálása 1–3 percig tart. A kész videó azonnal mentésre kerül a
                    Korábbi videóim közé — akkor sem vész el, ha közben bezárod az oldalt.
                    Ha a generálás nem sikerül, a kredit automatikusan visszajár.
                  </p>
                </div>
              ) : job?.status === "done" && job.output_url ? (
                <>
                  <video src={job.output_url} controls className="mx-auto max-h-[50vh] rounded-xl" style={{ border: "1px solid var(--twx-line)" }} />
                  <p className="text-sm text-green-700">Kész! A videó elmentve a Korábbi videóim közé.</p>
                </>
              ) : job?.status === "failed" ? (
                <div className="py-8">
                  <p className="text-sm font-semibold text-red-600">A videó nem készült el.</p>
                  <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {job.error || "Ismeretlen hiba."} A kredit automatikusan visszajárt — próbáld újra.
                  </p>
                </div>
              ) : (
                <div className="py-10">
                  <p className="text-sm font-medium">
                    {job?.status === "animating" ? "AI-mozgás készül a nyitófotóból…" : "A videó renderelése folyik…"}
                  </p>
                  <div className="mx-auto mt-4 h-2 w-64 overflow-hidden rounded-full" style={{ background: "var(--twx-line)" }}>
                    <div className="h-full rounded-full transition-all" style={{ background: "var(--twx-coral)", width: `${Math.min(95, Math.round((elapsed / 150) * 100))}%` }} />
                  </div>
                  <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    ~1–3 perc · nyugodtan itt hagyhatod, a kész videó az előzményekbe kerül
                  </p>
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Lábléc */}
        <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy || !!jobId}
            className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ border: "1px solid var(--twx-line)" }}>
            Vissza
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
              Tovább
            </button>
          ) : job?.status === "done" && job.output_url ? (
            <div className="flex gap-2">
              <a href={toDownloadUrl(job.output_url)} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>Letöltés</a>
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)" }}>Kész</button>
            </div>
          ) : job?.status === "failed" ? (
            <button type="button" onClick={() => { setJobId(null); setJob(null); }} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
              Újrapróbálom
            </button>
          ) : (
            <button type="button" onClick={generate} disabled={busy}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
              {busy ? "Generálás folyamatban…" : `Videó generálása (${pkg === "pro" ? VIDEO_CREDITS_PRO : VIDEO_CREDITS_ALAP} kredit)`}
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
