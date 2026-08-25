// Videó-varázsló: Arculat → Képek (4-5) → Adatok → Beállítás → Generálás.
// Nincs előnézet: a kész videó azonnal a tárhelyre és az előzmények közé kerül.
// Hang: csak zene. Feliratok: nyitó/záró kártya + a fotók alsó felirat-sávja (Satori).
"use client";

import { useEffect, useRef, useState } from "react";
import { showToast } from "@/components/Toast";
import AssetTray, { readTwxDragUrl } from "@/components/AssetTray";
import ComboField from "@/components/ComboField";
import { useFieldMemory, FieldSuggestions } from "@/components/field-memory";
import { compressImage } from "@/lib/image-compress";
import { toDownloadUrl } from "@/lib/files";
import type { BrandingProfile } from "@/lib/branding";
import { BRANDING_FONTS } from "@/lib/branding";
import {
  MUSIC_STYLES,
  VIDEO_CREDITS_ALAP, videoLengthSeconds,
  MAX_PHOTO_CAPTION, MAX_CLOSING_CAPTION,
  type VideoCaptionFacts, EMPTY_VIDEO_FACTS,
} from "@/lib/video";
import {
  VIDEO_DESIGNS, getDesign, imageCountOk, imageCountLabel, imageRange,
  ASPECT_LABEL, type VideoDesign, type VideoAspect,
} from "@/lib/video-templates";
import VideoTemplatePreview from "@/components/video/VideoTemplatePreview";
import { PROPERTY_TYPE_OPTIONS, FLOOR_OPTIONS } from "@/lib/valuation";

/** A státusz-végpont diagnosztikája — elakadásnál ez mondja meg, hol tart a lánc. */
type VideoDebug = {
  phase?: string;
  ageMinutes?: number;
  clips?: string[];
  falDetail?: string;
  shotstackStatus?: string;
  shotstackError?: string;
  clipError?: string;
  renderError?: string;
  downloadError?: string;
  uploadError?: string;
};
import { ROOMS_OPTIONS, BATHROOM_OPTIONS } from "@/lib/flyer";
import type { FlyerProfileData } from "@/lib/flyer-template";

const STEPS = ["Sablon", "Arculat", "Képek", "Adatok", "Beállítás", "Generálás"] as const;

type JobState = { status: string; output_url: string | null; error: string | null };

export default function VideoWizard({
  profiles, onClose, onDone,
}: { profiles: BrandingProfile[]; onClose: () => void; onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 0) Sablon (dizájn) + méret — ez köti a formátumot és a képszámot.
  const [designId, setDesignId] = useState<string>(VIDEO_DESIGNS[0].id);
  const design: VideoDesign = getDesign(designId) ?? VIDEO_DESIGNS[0];
  const [aspect, setAspect] = useState<VideoAspect>(design.aspects[0]);

  // Dizájnváltáskor a méret a dizájn első elérhető arányára ugrik.
  function pickDesign(id: string) {
    const d = getDesign(id) ?? VIDEO_DESIGNS[0];
    setDesignId(id);
    setAspect(d.aspects.includes(aspect) ? aspect : d.aspects[0]);
  }

  // 1) Arculat
  const [brandMode, setBrandMode] = useState<"saved" | "quick">(profiles.length ? "saved" : "quick");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [quick, setQuick] = useState({
    display_name: "", title: "", phone: "", email: "", company: "", website: "",
    accent_color: "#1e3a5f", font: BRANDING_FONTS[0].value,
  });

  // 2) Képek (4-5, az első a nyitófotó — PRO-nál ez kap AI-mozgást).
  // Minden fotóhoz saját, szabad felirat tartozik (a képpel együtt utazik).
  type Shot = { url: string; caption: string };
  const [shots, setShots] = useState<Shot[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Záró kép: mindkét dizájn támogatja. A satori nagy összegző felirattal rakja rá;
  // a Modern Sárga (JSON) a záró szegmens hátterét cseréli erre, a ráírt infók
  // (cím, ár, adatok, elérhetőség) a sablon záró kártyájáról jönnek.
  const isJson = design.kind === "json";
  const supportsClosing = true;
  const [closing, setClosing] = useState<Shot>({ url: "", caption: "" });
  const closingRef = useRef<HTMLInputElement>(null);

  // 3) Adatok (nyitókártya + felirat-sávok)
  const [debug, setDebug] = useState<VideoDebug | null>(null);
  const [title, setTitle] = useState("");
  const [facts, setFacts] = useState<VideoCaptionFacts & { propertyType: string }>({
    ...EMPTY_VIDEO_FACTS, propertyType: "",
  });

  // Mező-memória a szabadszöveges adatlap-mezőkhöz (kliensoldali, fiók-független).
  const titleMem = useFieldMemory("video:title", { min: 3 });
  const locationMem = useFieldMemory("video:location", { min: 3 });
  const addressMem = useFieldMemory("video:address", { min: 3 });
  const priceMem = useFieldMemory("video:price", { min: 2 });
  const sizeMem = useFieldMemory("video:size", { min: 2 });

  // 4) Beállítás — a formátumot a dizájn+méret köti; a zene és a csomag választható.
  const format = aspect; // a választott méret
  const [musicStyle, setMusicStyle] = useState<string>(VIDEO_DESIGNS[0].defaultMusic);
  const pkg: "alap" | "pro" = "alap";

  // Dizájnváltáskor a zenei alapértelmezés kövesse a dizájnt (a partner átállíthatja).
  useEffect(() => {
    setMusicStyle(design.defaultMusic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId]);

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

  // --- Képek (fotónkénti felirattal) ---
  function addFiles(list: FileList | null) {
    if (!list) return;
    const max = imageRange(design, aspect).max;
    const room = max - shots.length;
    if (room <= 0) { showToast(`Ehhez a mérethez legfeljebb ${max} kép.`, "info"); return; }
    setShots((prev) => [...prev, ...Array.from(list).slice(0, room).map((f) => ({ url: URL.createObjectURL(f), caption: "" }))]);
  }
  const addUrl = (u: string) =>
    setShots((prev) => (prev.some((s) => s.url === u) || prev.length >= imageRange(design, aspect).max ? prev : [...prev, { url: u, caption: "" }]));
  const removeImage = (i: number) => setShots((prev) => prev.filter((_, j) => j !== i));
  const moveImage = (from: number, to: number) =>
    setShots((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n;
    });
  const setCaption = (i: number, text: string) =>
    setShots((prev) => prev.map((s, j) => (j === i ? { ...s, caption: text } : s)));

  // --- Záró kép ---
  function setClosingFiles(list: FileList | null) {
    const f = list?.[0]; if (!f) return;
    setClosing((c) => ({ url: URL.createObjectURL(f), caption: c.caption }));
  }
  const setClosingUrl = (u: string) => setClosing((c) => ({ url: u, caption: c.caption }));
  const setClosingCaption = (t: string) => setClosing((c) => ({ ...c, caption: t }));

  // --- Generálás indítása ---
  async function generate() {
    setSubmitting(true); setError(null);
    try {
      const fd = new FormData();
      for (const s of shots) {
        const b = await (await fetch(s.url)).blob();
        const f = new File([b], "kep.jpg", { type: b.type || "image/jpeg" });
        fd.append("images", await compressImage(f, 2000, 0.9));
      }
      // Fotónkénti szabad feliratok — a képek sorrendjéhez igazítva.
      fd.append("captions", JSON.stringify(shots.map((s) => s.caption.trim())));
      // Záró kép (satori dizájnnál): háttérfotó + összegző felirat.
      if (supportsClosing && closing.url) {
        const b = await (await fetch(closing.url)).blob();
        const f = new File([b], "zaro.jpg", { type: b.type || "image/jpeg" });
        fd.append("closingImage", await compressImage(f, 2000, 0.9));
        fd.append("closingCaption", closing.caption.trim());
      }
      fd.append("profile", JSON.stringify(profileData));
      fd.append("facts", JSON.stringify(facts));
      fd.append("title", title.trim() || defaultTitle());
      // A videó neve a könyvtárban: az ingatlan címe (település + utca).
      fd.append("propertyAddress", [facts.location, facts.address].map((s) => s.trim()).filter(Boolean).join(", "));
      fd.append("format", format);
      fd.append("designId", designId);
      fd.append("aspect", aspect);
      fd.append("musicStyle", musicStyle);
      fd.append("package", pkg);
      const res = await fetch("/api/real-estate/video", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Sikeres indításkor jegyezzük meg a beírt szabadszöveges értékeket.
      titleMem.remember(title.trim());
      locationMem.remember(facts.location.trim());
      addressMem.remember(facts.address.trim());
      priceMem.remember(facts.price.trim());
      sizeMem.remember(facts.size.trim());
      setJobId(data.jobId as string);
      setJob({ status: data.status as string, output_url: null, error: null });
      setElapsed(0);
    } catch (e) {
      setError((e as Error).message || "Nem sikerült elindítani a generálást.");
    } finally { setSubmitting(false); }
  }

  // Emberi nyelvű állapot a diagnosztikából — hogy egy elakadásnál lássuk, hol tart.
  function describeProgress(d: VideoDebug): string {
    const parts: string[] = [];
    if (Array.isArray(d.clips)) {
      const done = d.clips.filter((c) => c.includes("kész")).length;
      parts.push(`AI-snittek: ${done}/${d.clips.length} kész`);
    }
    if (d.shotstackStatus) {
      const map: Record<string, string> = {
        queued: "sorban áll", fetching: "elemeket tölt le", rendering: "renderel",
        saving: "menti", done: "kész", failed: "hiba",
      };
      parts.push(`Vágás: ${map[d.shotstackStatus] ?? d.shotstackStatus}`);
    }
    if (d.falDetail) parts.push(d.falDetail);
    if (typeof d.ageMinutes === "number" && d.ageMinutes > 0) parts.push(`${d.ageMinutes} perce fut`);
    const problem = d.clipError || d.renderError || d.shotstackError || d.downloadError || d.uploadError;
    if (problem) parts.push(`⚠ ${problem}`);
    return parts.join(" · ");
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
        setDebug(data.debug ?? null);
        if (data.status === "done") { onDone?.(); showToast("A videó elkészült és mentve!", "success"); }
        if (data.status === "failed") showToast("A videó nem készült el — a kredit visszajárt.", "error");
      } catch { /* következő kör */ }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, job?.status]);

  function next() {
    // 1) Arculat
    if (step === 1) {
      if (brandMode === "saved" && !profileId) { setError("Válassz arculatot."); return; }
      if (brandMode === "quick" && !quick.display_name.trim() && !quick.company.trim()) {
        setError("Adj meg egy nevet vagy cégnevet."); return;
      }
      if (brandMode === "quick" && !quick.phone.trim() && !quick.email.trim()) {
        setError("Adj meg legalább egy elérhetőséget."); return;
      }
    }
    // 2) Képek — a dizájn+méret KÖTÖTTSÉGE szerint + a záró kép (satori).
    if (step === 2) {
      if (!imageCountOk(design, aspect, shots.length)) {
        setError(`Ehhez a mérethez ${imageCountLabel(design, aspect).toLowerCase()} szükséges (most ${shots.length}).`);
        return;
      }
      // Satori: a záró kép + összegző kötelező. Modern Sárga (JSON): a záró kép
      // opcionális (ha nincs, a sablon az 1. fotót ismétli a végén, mint eddig).
      if (!isJson && !closing.url) {
        setError("Tölts fel egy záró képet is (szép háttérfotó a végére)."); return;
      }
      if (!isJson && !closing.caption.trim()) {
        setError("Írj a záró képhez egy rövid, jól látható összegzőt az ingatlanról."); return;
      }
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  const setQ = <K extends keyof typeof quick>(k: K, v: string) => setQuick({ ...quick, [k]: v });
  const setF = <K extends keyof typeof facts>(k: K, v: string) => setFacts({ ...facts, [k]: v });
  const busy = submitting || (!!jobId && job?.status !== "done" && job?.status !== "failed");
  const lengthSec = Math.round(videoLengthSeconds(shots.length || imageRange(design, aspect).min, false));

  // --- Bezárás-védelem: egy véletlen kattintás ne törölje a megkezdett munkát ---
  const [confirmClose, setConfirmClose] = useState(false);
  const hasWork = shots.length > 0 || !!closing.url || Object.values(facts).some((v) => String(v ?? "").trim());

  function requestClose() {
    if (busy) return;
    if (hasWork && !jobId) { setConfirmClose(true); return; }
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmClose) { setConfirmClose(false); return; }
      requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmClose, hasWork, busy, jobId]);

  return (
    // A háttérre kattintás NEM zár be — véletlen mellékattintással elveszne a munka.
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.55)" }}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>

        {/* Fejléc + lépésjelző */}
        <div className="border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Új videó</h2>
            <button onClick={requestClose} disabled={busy} className="rounded-lg px-2 text-xl disabled:opacity-40" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
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
          {/* 0) SABLON — dizájn + méret választás */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Először válaszd ki, <strong>melyik dizájnnal</strong> dolgozol, és <strong>milyen méretben</strong>.
                Ugyanaz a dizájn több arányban is elérhető — a méretre kattintva választhatsz.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {VIDEO_DESIGNS.map((d) => {
                  const on = d.id === designId;
                  return (
                    <div
                      key={d.id}
                      className="overflow-hidden rounded-xl transition"
                      style={{
                        border: on ? "2px solid var(--twx-coral)" : "1px solid var(--twx-line)",
                        boxShadow: on ? "0 6px 20px rgba(239,122,90,0.18)" : "none",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => pickDesign(d.id)}
                        className="block w-full text-left"
                      >
                        <div
                          className="flex items-center justify-center"
                          style={{ height: 88, background: `linear-gradient(135deg, ${d.preview.from}, ${d.preview.to})`, color: d.preview.ink }}
                        >
                          <div className="font-display text-base font-bold">{d.name}</div>
                        </div>
                      </button>
                      {/* Méret-választó — csak a dizájn elérhető arányai */}
                      <div className="flex flex-wrap gap-1.5 p-3">
                        {d.aspects.map((a) => {
                          const active = on && a === aspect;
                          return (
                            <button
                              key={a}
                              type="button"
                              onClick={() => { pickDesign(d.id); setAspect(a); }}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold"
                              style={{
                                border: `1px solid ${active ? "var(--twx-coral)" : "var(--twx-line)"}`,
                                background: active ? "var(--twx-coral)" : "#fff",
                                color: active ? "#1c1005" : "var(--twx-ink)",
                              }}
                            >
                              {a}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Élő előnézet: így épül fel a kész videó a választott sablonnal + mérettel. */}
              <div className="rounded-xl p-3" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
                <p className="mb-2 text-xs font-semibold" style={{ color: "var(--twx-ink)" }}>
                  Előnézet: {design.name} · {ASPECT_LABEL[aspect]}
                </p>
                <VideoTemplatePreview design={design} aspect={aspect} accent={profileData.accent_color} font={profileData.font} />
                <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {imageCountLabel(design, aspect)}. A képek lépésnél pontosan ennyit kérünk.
                </p>
              </div>
            </div>
          )}

          {/* 1) ARCULAT */}
          {step === 1 && (
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

          {/* 2) KÉPEK — fotónkénti felirattal + záró kép */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                <strong>{design.name} · {aspect}</strong>: {imageCountLabel(design, aspect).toLowerCase()} szükséges
                {" "}(most {shots.length}). Az első a <strong>nyitófotó</strong>.
                {supportsClosing && " Minden képhez írhatsz saját feliratot — az a fotó alján jelenik meg a videóban."}
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
              {shots.length > 0 && (
                <ul className="space-y-2.5">
                  {shots.map((s, i) => (
                    <li key={s.url + i} className="flex items-center gap-3 rounded-xl p-2.5"
                      style={{ background: "#fff", border: `1px solid ${i === 0 ? "var(--twx-coral)" : "var(--twx-line)"}` }}>
                      {/* Kis bélyegkép + sorszám */}
                      <div className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.url} alt="" className="h-16 w-24 rounded-lg object-cover" style={{ border: "1px solid var(--twx-line)" }} />
                        <span className="absolute -left-1.5 -top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold shadow"
                          style={{ background: i === 0 ? "var(--twx-coral)" : "var(--twx-ink)", color: i === 0 ? "#1c1005" : "#fff" }}>
                          {i === 0 ? "Nyitó" : i + 1}
                        </span>
                      </div>
                      {/* Kiemelt felirat-mező */}
                      <div className="min-w-0 flex-1">
                        <label className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--twx-coral)" }}>
                          Felirat a képhez
                        </label>
                        <input
                          type="text"
                          value={s.caption}
                          maxLength={MAX_PHOTO_CAPTION}
                          onChange={(e) => setCaption(i, e.target.value)}
                          placeholder={i === 2 ? "pl. Szépen felújított, 15 m² fürdő" : "Írd ide, mi látszik a képen (nem kötelező)"}
                          className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-medium outline-none"
                          style={{ border: "1.5px solid var(--twx-line)", background: "var(--twx-cream)", color: "var(--twx-ink)" }}
                        />
                      </div>
                      {/* Sorrend + törlés */}
                      <div className="flex shrink-0 flex-col gap-1">
                        <button type="button" aria-label="Feljebb" onClick={() => moveImage(i, i - 1)} disabled={i === 0}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-sm disabled:opacity-30" style={{ border: "1px solid var(--twx-line)" }}>↑</button>
                        <button type="button" aria-label="Lejjebb" onClick={() => moveImage(i, i + 1)} disabled={i === shots.length - 1}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-sm disabled:opacity-30" style={{ border: "1px solid var(--twx-line)" }}>↓</button>
                        <button type="button" aria-label="Törlés" onClick={() => removeImage(i)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-sm" style={{ border: "1px solid var(--twx-line)", color: "#b4462f" }}>×</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <AssetTray onPick={(u) => addUrl(u)} selectedUrls={shots.map((s) => s.url)}
                note="Válassz egy mappát, majd kattints egy képre — vagy húzd a feltöltőre." />

              {/* ZÁRÓ KÉP — a feltöltött és tallózható képek ALATT */}
              <div className="rounded-xl p-3" style={{ background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)" }}>
                <p className="text-sm font-semibold" style={{ color: "#7a2e17" }}>
                  Záró kép {isJson && <span className="font-normal" style={{ color: "var(--twx-ink-muted)" }}>(nem kötelező)</span>}
                </p>
                <p className="mt-0.5 mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {isJson
                    ? "Ez lesz a videó záró képének háttere. A rá kerülő infók (cím, ár, adatok, elérhetőség) az Adatok lépésből jönnek. Ha üresen hagyod, az első fotó ismétlődik a végén."
                    : "Egy szép háttérfotó, rajta jól olvasható összegzővel az ingatlanról (9:16 és 1:1 is social-ready)."}
                </p>
                <div className="flex items-start gap-3">
                  {/* Kis előnézet / feltöltő */}
                  {closing.url ? (
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={closing.url} alt="" className="h-24 w-36 rounded-lg object-cover" style={{ border: "1px solid var(--twx-line)" }} />
                      <button type="button" onClick={() => setClosing({ url: "", caption: closing.caption })} aria-label="Záró kép törlése"
                        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-sm shadow" style={{ background: "#fff" }}>×</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => closingRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault(); setDragOver(false);
                        const url = readTwxDragUrl(e.dataTransfer);
                        if (url) { setClosingUrl(url); return; }
                        setClosingFiles(e.dataTransfer.files);
                      }}
                      className="flex h-24 w-36 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-2 text-center text-xs"
                      style={{ borderColor: "var(--twx-coral)", color: "var(--twx-ink-muted)", background: "#fff" }}>
                      Húzd ide, vagy kattints a tallózáshoz
                      <input ref={closingRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        onChange={(e) => { setClosingFiles(e.target.files); e.currentTarget.value = ""; }} />
                    </div>
                  )}
                  {/* JSON: mi kerül rá (előnézet) · Satori: szabad összegző */}
                  <div className="min-w-0 flex-1">
                    {isJson ? (
                      <div className="rounded-lg p-2.5 text-xs" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                        <p className="font-semibold" style={{ color: "var(--twx-ink)" }}>A záró képre kerül:</p>
                        <ul className="mt-1 space-y-0.5" style={{ color: "var(--twx-ink-muted)" }}>
                          <li>Cím: {facts.location || facts.address || "az Adatok lépésből"}</li>
                          <li>Ár: {facts.price || "az Adatok lépésből"}</li>
                          <li>Adatok: méret · szoba · fürdő · emelet (az Adatok lépésből)</li>
                          <li>Elérhetőség: {profileData.display_name || profileData.company || "az arculatodból"}{profileData.phone ? ` · ${profileData.phone}` : ""}</li>
                        </ul>
                      </div>
                    ) : (
                      <>
                        <label className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#7a2e17" }}>Összegző felirat</label>
                        <input
                          type="text"
                          value={closing.caption}
                          maxLength={MAX_CLOSING_CAPTION}
                          onChange={(e) => setClosingCaption(e.target.value)}
                          placeholder="pl. Eladó 3 szobás, felújított panellakás · 74 m² · 59,9 M Ft"
                          className="mt-1 w-full rounded-lg px-3 py-2 text-sm font-medium outline-none"
                          style={{ border: "1.5px solid var(--twx-line)", background: "#fff", color: "var(--twx-ink)" }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3) ADATOK */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold">Nyitókártya</p>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <MemField label="Főcím" value={title} onChange={setTitle} placeholder={defaultTitle()} mem={titleMem} />
                  <Combo label="Ingatlan típusa" value={facts.propertyType} onChange={(v) => setF("propertyType", v)} options={PROPERTY_TYPE_OPTIONS} placeholder="a főcímhez (pl. Eladó panellakás)" />
                  <MemField label="Település, kerület" value={facts.location} onChange={(v) => setF("location", v)} placeholder="pl. Budapest, V. kerület" mem={locationMem} />
                  <MemField label="Utca, házszám" value={facts.address} onChange={(v) => setF("address", v)} placeholder="pl. Sas utca 12." mem={addressMem} />
                  <MemField label="Ár" value={facts.price} onChange={(v) => setF("price", v)} placeholder="pl. 100 M Ft" mem={priceMem} />
                </div>
              </div>
              <p className="rounded-xl p-3 text-xs" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                A fotók feliratait a <strong>Képek</strong> lépésben, képenként adod meg.
              </p>
              {isJson && (
                <div>
                  <p className="text-sm font-semibold">Záró kártya adatai</p>
                  <p className="mt-0.5 mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Ezek a videó végén, a záró kártyán jelennek meg: méret · szoba · fürdő · emelet. Csak amit megadsz.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MemField label="Méret" value={facts.size} onChange={(v) => setF("size", v)} placeholder="pl. 100 m²" mem={sizeMem} />
                    <Combo label="Szobaszám" value={facts.rooms} onChange={(v) => setF("rooms", v)} options={ROOMS_OPTIONS} placeholder="Válassz vagy írj sajátot" />
                    <Combo label="Fürdő / wc" value={facts.bathrooms} onChange={(v) => setF("bathrooms", v)} options={BATHROOM_OPTIONS} placeholder="Válassz vagy írj sajátot" />
                    <Combo label="Emelet" value={facts.floor} onChange={(v) => setF("floor", v)} options={FLOOR_OPTIONS} placeholder="Válassz a listából" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4) BEÁLLÍTÁS */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold">Méret</p>
                <div className="mt-2 flex items-center gap-2 rounded-xl p-3" style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream)" }}>
                  <span className="rounded-md px-2 py-1 text-xs font-semibold" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>{format}</span>
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    A <strong>{design.name}</strong> dizájn <strong>{ASPECT_LABEL[aspect]}</strong> mérete. Módosításhoz válts az első lépésben.
                  </span>
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
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <div className="rounded-xl p-3 text-left" style={{ border: "1px solid var(--twx-coral)", background: "var(--twx-coral-soft)" }}>
                    <span className="block text-sm font-semibold" style={{ color: "#7a2e17" }}>Standard · {VIDEO_CREDITS_ALAP} kredit</span>
                    <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>Finom kameramozgás (Ken Burns) minden fotón</span>
                  </div>
                </div>
              </div>
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                Várható hossz: ~{lengthSec} mp (nyitókártya + {shots.length || imageRange(design, aspect).min} fotó + {supportsClosing ? "záró kép" : "zárókártya"}). Hang: csak zene.
              </p>
            </div>
          )}

          {/* 5) GENERÁLÁS */}
          {step === 5 && (
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
                    {job?.status === "animating" ? "AI-snittek készülnek minden fotóból — ez több percig is tarthat…" : "A videó renderelése folyik…"}
                    {debug ? <span className="mt-1 block text-[11px] opacity-70">{describeProgress(debug)}</span> : null}
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
              {busy ? "Generálás folyamatban…" : `Videó generálása (${VIDEO_CREDITS_ALAP} kredit)`}
            </button>
          )}
        </div>
      </div>

      {/* Megerősítés bezárás előtt — csak ha van elveszíthető munka */}
      {confirmClose && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,8,0.55)" }}>
          <div className="w-full max-w-sm rounded-2xl p-5"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>
            <h3 className="font-display text-base font-semibold">Bezárod a szerkesztőt?</h3>
            <p className="mt-1.5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              A megkezdett videó — a feltöltött fotók és a megadott adatok — elvész,
              és elölről kell kezdened.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmClose(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "var(--twx-coral)" }}>
                Folytatom a szerkesztést
              </button>
              <button type="button" onClick={() => { setConfirmClose(false); onClose(); }}
                className="rounded-xl px-4 py-2 text-sm font-medium"
                style={{ border: "1px solid var(--twx-line)" }}>
                Bezárás, munka elvetése
              </button>
            </div>
          </div>
        </div>
      )}
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

// Mint a Field, de a mező alatt felajánlja a korábban beírt értékeket (fókusz alatt).
function MemField({ label, value, onChange, placeholder, mem }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  mem: { items: string[]; remove: (v: string) => void };
}) {
  const [focus, setFocus] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{label}</label>
      <div className="relative">
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          className="twx-input mt-1 w-full text-sm" />
        <FieldSuggestions open={focus} value={value} items={mem.items} onPick={onChange} onRemove={mem.remove} />
      </div>
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
