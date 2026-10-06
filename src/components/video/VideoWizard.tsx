// Videó-varázsló: Arculat → Képek (4-5) → Adatok → Beállítás → Generálás.
// Nincs előnézet: a kész videó azonnal a tárhelyre és az előzmények közé kerül.
// Hang: csak zene. Feliratok: nyitó/záró kártya + a fotók alsó felirat-sávja (Satori).
"use client";

import { useEffect, useRef, useState } from "react";
import { showToast } from "@/components/Toast";
import { readTwxDragUrl } from "@/components/AssetTray";
import AssetPicker from "@/components/video/AssetPicker";
import ComboField from "@/components/ComboField";
import { useFieldMemory, FieldSuggestions } from "@/components/field-memory";
import { compressImage } from "@/lib/image-compress";
import { toDownloadUrl } from "@/lib/files";
import type { BrandingProfile } from "@/lib/branding";
import { BRANDING_FONTS } from "@/lib/branding";
import {
  MUSIC_STYLES,
  VIDEO_CREDITS_ALAP, videoLengthSeconds,
  MAX_PHOTO_CAPTION,
  type VideoCaptionFacts, EMPTY_VIDEO_FACTS,
} from "@/lib/video";
import {
  VIDEO_DESIGNS, getDesign, imageCountOk, imageCountLabel, imageRange,
  ASPECT_LABEL, ASPECT_HINT, type VideoDesign, type VideoAspect,
} from "@/lib/video-templates";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/valuation";
import { readyColorVariants, getColorVariant, type VideoColorId } from "@/lib/video-color";
import { engineGallery, engineFamilies, type EngineFamily, type EngineGalleryItem } from "@/lib/video-engine/templates/index";

/** A státusz-végpont diagnosztikája — elakadásnál ez mondja meg, hol tart a lánc. */
type VideoDebug = {
  phase?: string;
  /** Saját motor: rövid állapotszöveg. */
  engine?: string;
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

const STEPS = ["Sablon", "Képek", "Beállítás", "Generálás"] as const;


/**
 * Videólabor-mód (admin): UGYANEZ a szerkesztő, de a kész anyag a saját TWINX
 * motorhoz megy (`endpoint`), kredit és partner-előzmény nélkül. A válasz
 * (videó-URL + mérések) az `onResult`-ba érkezik.
 */
export type VideoWizardLab = {
  endpoint: string;
  onResult: (data: Record<string, unknown>) => void;
  /** További mezők a kéréshez. */
  extraFields?: Record<string, string>;
};

/** A saját motor sablonjai — a labor-módban ezek közül választ a „partner". */
const ENGINE_GALLERY = engineGallery();
const ENGINE_FAMILIES = engineFamilies();

export default function VideoWizard({
  profiles, onClose, onDone, lab, engineMode,
}: {
  profiles: BrandingProfile[]; onClose: () => void; onDone?: () => void; lab?: VideoWizardLab;
  /** A SAJÁT TWINX motor fut → a saját sablonok (Aurora, Skandi …) közül lehet választani. */
  engineMode?: boolean;
}) {
  // Saját-motoros sablonválasztó: a Videólaborban mindig, a partnereknél ha a motor „twinx".
  const engine = Boolean(lab) || Boolean(engineMode);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 0) Sablon (dizájn) + méret — ez köti a formátumot és a képszámot.
  const [designId, setDesignId] = useState<string>(VIDEO_DESIGNS[0].id);
  const design: VideoDesign = getDesign(designId) ?? VIDEO_DESIGNS[0];
  // MÉRET: egy vagy KÉT méret is kijelölhető — ugyanazokból a fotókból mindegyikben
  // elkészül a videó (méretenként külön kredit). Az első kijelölt az „elsődleges”.
  const [aspects, setAspects] = useState<VideoAspect[]>([design.aspects[0]]);
  const aspect: VideoAspect = aspects[0];

  // Szín-variáns: ugyanaz a sablon, csak más kiemelő színnel. Csak az élesített
  // (feltöltött grafikájú) színek jelennek meg.
  const colorChoices = readyColorVariants();
  const [colorId, setColorId] = useState<VideoColorId>("sarga");

  // Labor-mód: a saját motor sablonja (Aurora, Nocturne, Skandi …) — ugyanúgy
  // csempéken választható, mint a partnernél; a méretet a sablon köti.
  const [engineId, setEngineId] = useState<string>(ENGINE_GALLERY[0]?.id ?? "aurora");
  const engineItem = ENGINE_GALLERY.find((e) => e.id === engineId) ?? ENGINE_GALLERY[0];
  const aspectsOffered: VideoAspect[] = engine
    ? design.aspects.filter((a) => (engineItem?.aspects as string[] | undefined)?.includes(a) ?? true)
    : design.aspects;
  const engineFamily = ENGINE_FAMILIES.find((f) => f.colors.some((c) => c.id === engineId));
  const engineColor = engineFamily?.colors.find((c) => c.id === engineId);
  const templateLabel = engine
    ? engineFamily && engineColor ? `${engineFamily.name} · ${engineColor.colorName}` : engineItem?.name ?? design.name
    : design.name;
  // Családonként megjegyezzük a választott színt — kártyaváltáskor az marad.
  const [familyColor, setFamilyColor] = useState<Record<string, string>>({});
  // Fotónkénti felirat hossza: az új sablonoknál annyi, ami kitölti a feliratdobozt.
  const captionMax = engine ? engineItem?.captionMaxChars ?? MAX_PHOTO_CAPTION : MAX_PHOTO_CAPTION;
  function pickEngine(id: string) {
    const e = ENGINE_GALLERY.find((x) => x.id === id);
    setEngineId(id);
    if (e) setAspects((cur) => {
      const ok = cur.filter((a) => (e.aspects as string[]).includes(a));
      return ok.length ? ok : [e.aspects[0] as VideoAspect];
    });
  }

  // Dizájnváltáskor a méret a dizájn első elérhető arányára ugrik.
  function pickDesign(id: string) {
    const d = getDesign(id) ?? VIDEO_DESIGNS[0];
    setDesignId(id);
    setAspects((cur) => {
      const ok = cur.filter((a) => d.aspects.includes(a));
      return ok.length ? ok : [d.aspects[0]];
    });
  }

  /** Kredit: méretenként egy videó ára. */
  const totalCredits = VIDEO_CREDITS_ALAP * aspects.length;

  // KEDVENC SABLONOK (csillag a kártyán) + szűrő: Összes sablon / Kedvencek.
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favOnly, setFavOnly] = useState(false);
  useEffect(() => {
    if (!engine) return;
    let alive = true;
    fetch("/api/real-estate/video/favorites")
      .then((r) => (r.ok ? r.json() : { favorites: [] }))
      .then((d: { favorites?: string[] }) => { if (alive) setFavorites(new Set(d.favorites ?? [])); })
      .catch(() => { /* kedvencek nélkül is működik */ });
    return () => { alive = false; };
  }, [engine]);
  async function toggleFavorite(templateId: string) {
    const on = !favorites.has(templateId);
    const nextSet = new Set(favorites);
    if (on) nextSet.add(templateId); else nextSet.delete(templateId);
    setFavorites(nextSet); // azonnal látszik; hiba esetén visszaállítjuk
    try {
      const res = await fetch("/api/real-estate/video/favorites", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, favorite: on }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error);
    } catch (e) {
      setFavorites((cur) => { const r = new Set(cur); if (on) r.delete(templateId); else r.add(templateId); return r; });
      showToast((e as Error).message || "Nem sikerült menteni a kedvencet.", "error");
    }
  }
  const visibleFamilies = favOnly ? ENGINE_FAMILIES.filter((f) => favorites.has(f.templateId)) : ENGINE_FAMILIES;

  // 1) Képek (5, az első a NYITÓKÉP). Minden fotóhoz saját, szabad felirat tartozik.
  type CaptionPos = "bottom" | "center";
  type Shot = { url: string; caption: string; captionPos: CaptionPos };
  const [shots, setShots] = useState<Shot[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Zárókép: NINCS feltöltött fotó — a sablon egyszínű hátterén szöveges összegzés
  // (az ingatlan fő adatai + az ingatlanos elérhetősége).
  // Az elérhetőség kézzel megadható, vagy egy korábbi arculati profilból betölthető.
  const [contact, setContact] = useState({ name: "", phone: "", email: "" });
  const [profileId, setProfileId] = useState<string>("");

  // Az ingatlan adatai — EGYSZER megadva, a nyitó- és a záróképen is megjelennek.
  const [title] = useState("");
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
  const [musicStyle, setMusicStyle] = useState<string>(VIDEO_DESIGNS[0].defaultMusic);
  const pkg: "alap" | "pro" = "alap";

  // Dizájnváltáskor a zenei alapértelmezés kövesse a dizájnt (a partner átállíthatja).
  useEffect(() => {
    setMusicStyle(design.defaultMusic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId]);

  // 5) Generálás
  // Méretenként egy-egy generálás („run”): saját job, állapot, kész videó.
  type Run = { aspect: VideoAspect; jobId: string | null; status: string; output_url: string | null; error: string | null; debug: VideoDebug | null };
  const [runs, setRuns] = useState<Run[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const started = runs.length > 0;
  const isFinished = (r: Run) => r.status === "done" || r.status === "failed";
  const allFinished = started && runs.every(isFinished);
  // Indítási hiba miatt el sem indult méretek (pl. kevés kredit a másodikhoz).
  const missing = started ? aspects.filter((a) => !runs.some((r) => r.aspect === a)) : [];
  const upsertRun = (rs: Run[], r: Run) =>
    [...rs.filter((x) => x.aspect !== r.aspect), r].sort((a, b) => aspects.indexOf(a.aspect) - aspects.indexOf(b.aspect));

  // Az elérhetőség a záróképre kerül. A kézzel megadott érték az elsődleges;
  // a kiválasztott korábbi arculatból a logó/fotó/szín/betű egészíti ki.
  const selectedProfile = profiles.find((x) => x.id === profileId) ?? null;
  const profileData: FlyerProfileData = {
    display_name: contact.name || selectedProfile?.display_name || "",
    title: selectedProfile?.title || "",
    phone: contact.phone || selectedProfile?.phone || "",
    email: contact.email || selectedProfile?.email || "",
    company: selectedProfile?.company || "",
    website: selectedProfile?.website || "",
    slogan: "",
    logo_url: selectedProfile?.logo_url ?? null,
    agent_photo_url: selectedProfile?.agent_photo_url ?? null,
    accent_color: selectedProfile?.accent_color || "#1e3a5f",
    font: selectedProfile?.font || BRANDING_FONTS[0].value,
    theme: "light",
  };

  // „Betöltés korábbi arculatból": a kiválasztott profil elérhetőségét bemásolja.
  function loadContactFromProfile(id: string) {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setProfileId(id);
    setContact({ name: p.display_name || "", phone: p.phone || "", email: p.email || "" });
  }

  // --- Képek (fotónkénti felirattal) ---
  function addFiles(list: FileList | null) {
    if (!list) return;
    const max = imageRange(design, aspect).max;
    const room = max - shots.length;
    if (room <= 0) { showToast(`Ehhez a mérethez legfeljebb ${max} kép.`, "info"); return; }
    setShots((prev) => [...prev, ...Array.from(list).slice(0, room).map((f) => ({ url: URL.createObjectURL(f), caption: "", captionPos: "bottom" as CaptionPos }))]);
  }
  const addUrl = (u: string) =>
    setShots((prev) => (prev.some((s) => s.url === u) || prev.length >= imageRange(design, aspect).max ? prev : [...prev, { url: u, caption: "", captionPos: "bottom" as CaptionPos }]));
  const removeImage = (i: number) => setShots((prev) => prev.filter((_, j) => j !== i));
  const moveImage = (from: number, to: number) =>
    setShots((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n;
    });
  const setCaption = (i: number, text: string) =>
    setShots((prev) => prev.map((s, j) => (j === i ? { ...s, caption: text } : s)));
  const setCaptionPos = (i: number, pos: CaptionPos) =>
    setShots((prev) => prev.map((s, j) => (j === i ? { ...s, captionPos: pos } : s)));

  // --- Generálás indítása (minden kijelölt méretre külön job, ugyanazokkal a fotókkal) ---
  async function generate(only?: VideoAspect[]) {
    const targets = only ?? aspects;
    setSubmitting(true); setError(null);
    try {
      // A fotók EGYSZER készülnek elő — minden méret ugyanazokat kapja.
      const images: File[] = [];
      for (const s of shots) {
        const b = await (await fetch(s.url)).blob();
        const f = new File([b], "kep.jpg", { type: b.type || "image/jpeg" });
        images.push(await compressImage(f, 2000, 0.9));
      }
      const failures: string[] = [];
      let okCount = 0;
      for (const asp of targets) {
        const fd = new FormData();
        for (const im of images) fd.append("images", im);
        // Fotónkénti szabad feliratok — a képek sorrendjéhez igazítva.
        // (Az 1. kép a nyitókép; ahhoz nem felirat, hanem az összefoglaló adatok tartoznak.)
        fd.append("captions", JSON.stringify(shots.map((s) => s.caption.trim())));
        // Képenkénti felirat-pozíció: lent vagy középen (középen vonal fölötte és alatta).
        fd.append("captionPositions", JSON.stringify(shots.map((s) => s.captionPos)));
        fd.append("colorVariant", colorId);
        fd.append("profile", JSON.stringify(profileData));
        fd.append("facts", JSON.stringify(facts));
        fd.append("title", title.trim() || defaultTitle());
        // A videó neve a könyvtárban: az ingatlan címe (település + utca).
        fd.append("propertyAddress", [facts.location, facts.address].map((s) => s.trim()).filter(Boolean).join(", "));
        fd.append("format", asp);
        fd.append("designId", designId);
        fd.append("aspect", asp);
        fd.append("musicStyle", musicStyle);
        fd.append("package", pkg);
        if (engine) fd.append("engineTemplate", engineId);
        Object.entries(lab?.extraFields ?? {}).forEach(([k, v]) => fd.append(k, v));
        try {
          const res = await fetch(lab?.endpoint ?? "/api/real-estate/video", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          okCount++;
          if (lab) {
            // A labor szinkron fut: a válaszban már a kész videó van — nincs állapot-lekérdezés.
            setRuns((rs) => upsertRun(rs, { aspect: asp, jobId: "lab", status: "done", output_url: data.url as string, error: null, debug: null }));
            lab.onResult(data as Record<string, unknown>);
          } else {
            setRuns((rs) => upsertRun(rs, { aspect: asp, jobId: data.jobId as string, status: data.status as string, output_url: null, error: null, debug: null }));
          }
        } catch (e) {
          failures.push(`${ASPECT_LABEL[asp]}: ${(e as Error).message || "nem sikerült elindítani."}`);
        }
      }
      if (okCount > 0 && !lab) {
        // Sikeres indításkor jegyezzük meg a beírt szabadszöveges értékeket.
        titleMem.remember(title.trim());
        locationMem.remember(facts.location.trim());
        addressMem.remember(facts.address.trim());
        priceMem.remember(facts.price.trim());
        sizeMem.remember(facts.size.trim());
        setElapsed(0);
      }
      if (failures.length) setError(failures.join(" · "));
    } catch (e) {
      setError((e as Error).message || "Nem sikerült elindítani a generálást.");
    } finally { setSubmitting(false); }
  }

  // Emberi nyelvű állapot a diagnosztikából — hogy egy elakadásnál lássuk, hol tart.
  function describeProgress(d: VideoDebug): string {
    const parts: string[] = [];
    if (d.engine) parts.push(d.engine);
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

  // Polling: minden még futó méret státusza 3 mp-enként, amíg kész/hibás nem lesz.
  const pendingKey = runs.filter((r) => !isFinished(r) && r.jobId && r.jobId !== "lab").map((r) => `${r.jobId}|${r.aspect}`).join(",");
  useEffect(() => {
    if (!pendingKey) return;
    const pending = pendingKey.split(",").map((x) => { const [id, asp] = x.split("|"); return { id, asp: asp as VideoAspect }; });
    const t = setInterval(async () => {
      setElapsed((s) => s + 3);
      for (const { id, asp } of pending) {
        try {
          const res = await fetch(`/api/real-estate/video/${id}`);
          if (!res.ok) continue;
          const data = await res.json();
          setRuns((rs) => rs.map((r) => (r.jobId === id
            ? { ...r, status: data.status, output_url: data.output_url ?? null, error: data.error ?? null, debug: data.debug ?? null }
            : r)));
          const label = pending.length > 1 || aspects.length > 1 ? ` (${ASPECT_LABEL[asp]})` : "";
          if (data.status === "done") { onDone?.(); showToast(`A videó${label} elkészült és mentve!`, "success"); }
          if (data.status === "failed") showToast(`A videó${label} nem készült el — a kredit visszajárt.`, "error");
        } catch { /* következő kör */ }
      }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  function next() {
    // 1) Képek — a dizájn+méret KÖTÖTTSÉGE szerint (nyitókép + további képek).
    if (step === 1) {
      // Minden kijelölt méretnek meg kell felelnie (a sablonok képszáma méretenként azonos lehet vagy eltérhet).
      const bad = aspects.find((a) => !imageCountOk(design, a, shots.length));
      if (bad) {
        setError(`${aspects.length > 1 ? `A(z) ${ASPECT_LABEL[bad]} mérethez` : "Ehhez a mérethez"} ${imageCountLabel(design, bad).toLowerCase()} szükséges (most ${shots.length}).`);
        return;
      }
    }
    setError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  const setF = <K extends keyof typeof facts>(k: K, v: string) => setFacts({ ...facts, [k]: v });
  const busy = submitting || runs.some((r) => !isFinished(r));
  const lengthSec = Math.round(videoLengthSeconds(shots.length || imageRange(design, aspect).min, false));

  // --- Bezárás-védelem: egy véletlen kattintás ne törölje a megkezdett munkát ---
  const [confirmClose, setConfirmClose] = useState(false);
  const hasWork = shots.length > 0 || !!contact.name || Object.values(facts).some((v) => String(v ?? "").trim());

  function requestClose() {
    if (busy) return;
    if (hasWork && !started) { setConfirmClose(true); return; }
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
  }, [confirmClose, hasWork, busy, started]);

  return (
    // A háttérre kattintás NEM zár be — véletlen mellékattintással elveszne a munka.
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.55)" }}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>

        {/* Fejléc + lépésjelző */}
        <div className="border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">{lab ? "Videólabor — saját TWINX motor" : "Új videó"}</h2>
            <button onClick={requestClose} disabled={busy} className="rounded-lg px-2 text-xl disabled:opacity-40" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center gap-1.5">
                <button type="button" onClick={() => i < step && !started && setStep(i)} className="flex items-center gap-1.5 text-[11px] font-semibold"
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
        {/* Az 1. lépésnél a sablonlista görög, a méret-sáv FIX marad alul. */}
        <div className={step === 0 ? "flex min-h-0 flex-1 flex-col p-5 sm:p-6" : "flex-1 overflow-y-auto p-5 sm:p-6"}>
          {/* 0) SABLON — dizájn + méret választás */}
          {step === 0 && (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <p className="shrink-0 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Válaszd ki a <strong>sablont</strong>, majd a <strong>méretet</strong>.{" "}
                {engine ? "Minden sablonnak saját stílusa, áttűnése és színvilága van." : "A sablonok felépítése azonos — a kiemelő szín különbözteti meg őket."}
              </p>
              {/* SABLONLISTA — GÖRGETHETŐ (több sablonnál ez a rész gördül, a méret-sáv alatta fix) */}
              <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
                {engine ? (
                  visibleFamilies.length === 0 ? (
                    <div className="rounded-xl px-4 py-8 text-center text-sm" style={{ border: "1px dashed var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                      Még nincs kedvenc sablonod. A kártyák bal felső sarkában lévő <span style={{ color: "#e0a82e" }}>☆</span> csillaggal jelölheted meg őket.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {visibleFamilies.map((f) => {
                        const colorId = familyColor[f.templateId] ?? f.colors[0]?.id;
                        return (
                          <EngineFamilyCard key={f.templateId} family={f} colorId={colorId}
                            on={engineFamily?.templateId === f.templateId} photo={design.previewPhoto}
                            favorite={favorites.has(f.templateId)} onToggleFavorite={() => toggleFavorite(f.templateId)}
                            onPick={(id) => { setFamilyColor((m) => ({ ...m, [f.templateId]: id })); pickEngine(id); }} />
                        );
                      })}
                    </div>
                  )
                ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {VIDEO_DESIGNS.flatMap((d) =>
                    (d.kind === "json" ? colorChoices : [getColorVariant("sarga")]).map((v) => {
                      const on = d.id === designId && (d.kind !== "json" || v.id === colorId);
                      // Több szín esetén a szín adja a nevet, egyébként a sablon neve.
                      const label = d.kind === "json" && colorChoices.length > 1 ? v.title : d.name;
                      return (
                        <button
                          key={`${d.id}-${v.id}`}
                          type="button"
                          onClick={() => { pickDesign(d.id); setColorId(v.id); }}
                          aria-pressed={on}
                          className="overflow-hidden rounded-xl text-left transition"
                          style={{
                            border: on ? "2px solid var(--twx-coral)" : "1px solid var(--twx-line)",
                            boxShadow: on ? "0 8px 22px rgba(239,122,90,0.20)" : "0 1px 2px rgba(0,0,0,0.04)",
                            background: "#fff",
                          }}
                        >
                          {/* Előnézet: fotó + ferde arculati panel + a videó tipográfiája */}
                          <div className="relative aspect-[3/4] w-full overflow-hidden"
                            style={{ background: `linear-gradient(150deg, ${d.preview.from}, ${d.preview.to})` }}>
                            {d.previewPhoto && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={d.previewPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            )}
                            {/* Ferde panel — mint a videó nyitóképén */}
                            <span className="absolute" style={{
                              left: "-26%", top: "-14%", width: "92%", height: "128%",
                              background: d.preview.from, opacity: 0.94, transform: "skewX(-9deg)",
                            }} />
                            {/* Vékony arculati él a panel szélén */}
                            <span className="absolute" style={{
                              left: "64%", top: "-14%", width: 4, height: "128%",
                              background: v.swatch.accent, transform: "skewX(-9deg)",
                            }} />
                            {/* Tipográfia: kis vonal, cím, lokáció, adatok, ár */}
                            <div className="absolute inset-y-0 left-0 flex w-[64%] flex-col justify-center px-2">
                              <span className="mb-1 block h-[2px] w-4 rounded-sm" style={{ background: v.swatch.accent }} />
                              <span className="text-[10px] font-bold leading-tight" style={{ color: v.swatch.accent }}>
                                Sas utca 22.
                              </span>
                              <span className="mt-0.5 text-[7px] font-medium leading-tight" style={{ color: "rgba(255,255,255,0.92)" }}>
                                Budapest V. kerület
                              </span>
                              <span className="mt-1.5 text-[6px] font-bold tracking-widest" style={{ color: v.swatch.accent }}>
                                ÚJ ÉPÍTÉSŰ LAKÁS
                              </span>
                              <span className="mt-1.5 text-[7px] font-semibold leading-tight" style={{ color: "rgba(255,255,255,0.88)" }}>
                                50 m² · 1 + 1 fél szoba
                              </span>
                              <span className="mt-1.5 text-[11px] font-extrabold leading-none" style={{ color: v.swatch.accent }}>
                                60 M Ft
                              </span>
                            </div>
                          </div>
                          {/* Csak a név — a leírás tooltipben, hogy sok sablon is elférjen */}
                          <div className="truncate px-2 py-1.5 text-[11px] font-semibold leading-tight"
                            title={d.tagline}
                            style={{ color: "var(--twx-ink)" }}>
                            {label}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                )}
              </div>

              {/* FIX SÁV — balra a méret (egymás alatt + „Mindkettő”), jobbra a sablon-szűrő */}
              <div className="shrink-0 rounded-xl p-3" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
                <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--twx-ink-muted)" }}>Méret</p>
                    {/* Egymás alatt, kompakt sorok: arány-ikon + címke + súgó. Kattintásra ez az EGY méret. */}
                    <div className="mt-1.5 inline-flex flex-col gap-1">
                      {aspectsOffered.map((a) => {
                        const active = aspects.includes(a);
                        const portrait = a === "9:16";
                        return (
                          <button key={a} type="button" onClick={() => setAspects([a])} aria-pressed={active}
                            className="group flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-3 text-left transition"
                            style={{ background: active ? "var(--twx-coral-soft)" : "transparent" }}>
                            {/* Kis arány-ikon: álló téglalap vagy négyzet — ránézésre értelmezhető. */}
                            <span className="flex h-7 w-7 items-center justify-center rounded-md"
                              style={{ background: active ? "var(--twx-coral)" : "#fff", border: `1px solid ${active ? "var(--twx-coral)" : "var(--twx-line)"}` }}>
                              <span className="block rounded-[2px]"
                                style={{ width: portrait ? 9 : 14, height: portrait ? 16 : 14, background: active ? "#1c1005" : "var(--twx-ink-muted)", opacity: active ? 0.9 : 0.55 }} />
                            </span>
                            <span className="text-[13px] font-semibold" style={{ color: active ? "#7a2e17" : "var(--twx-ink)" }}>{ASPECT_LABEL[a]}</span>
                            <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>· {ASPECT_HINT[a]}</span>
                          </button>
                        );
                      })}
                      {/* Mindkettő: kipipálva mindkét méretben elkészül a videó. */}
                      {aspectsOffered.length > 1 && (() => {
                        const both = aspectsOffered.every((a) => aspects.includes(a));
                        return (
                          <label className="mt-0.5 flex cursor-pointer select-none items-center gap-2.5 rounded-lg py-1 pl-1 pr-3"
                            style={{ background: both ? "var(--twx-coral-soft)" : "transparent" }}>
                            <input type="checkbox" checked={both}
                              onChange={(e) => setAspects(e.target.checked ? [...aspectsOffered] : [aspectsOffered[0]])}
                              className="h-4 w-4 accent-[var(--twx-coral)]" style={{ marginLeft: 6, marginRight: 6 }} />
                            <span className="text-[13px] font-semibold" style={{ color: both ? "#7a2e17" : "var(--twx-ink)" }}>Mindkettő</span>
                          </label>
                        );
                      })()}
                    </div>
                    {!lab && (
                      <p className="mt-2">
                        <span className="rounded-md px-2 py-0.5 text-[13px] font-bold" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                          Összesen: {totalCredits} kredit
                        </span>
                      </p>
                    )}
                  </div>
                  {engine && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--twx-ink-muted)" }}>Sablonok</p>
                      {/* Egymás alatt, mint a méretek: alapból az összes, a csillagozottakra szűkíthető. */}
                      <div className="mt-1.5 inline-flex flex-col gap-1" role="tablist">
                        {[
                          { id: false, icon: "▦", label: "Összes sablon" },
                          { id: true, icon: "★", label: `Kedvencek${favorites.size ? ` (${favorites.size})` : ""}` },
                        ].map((t) => {
                          const active = favOnly === t.id;
                          return (
                            <button key={String(t.id)} type="button" role="tab" aria-selected={active} onClick={() => setFavOnly(t.id)}
                              className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-3 text-left transition"
                              style={{ background: active ? "var(--twx-coral-soft)" : "transparent" }}>
                              <span className="flex h-7 w-7 items-center justify-center rounded-md text-[13px]"
                                style={{ background: active ? "var(--twx-coral)" : "#fff", border: `1px solid ${active ? "var(--twx-coral)" : "var(--twx-line)"}`, color: active ? "#1c1005" : t.id ? "#e0a82e" : "var(--twx-ink-muted)" }}>
                                {t.icon}
                              </span>
                              <span className="text-[13px] font-semibold" style={{ color: active ? "#7a2e17" : "var(--twx-ink)" }}>{t.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 1) KÉPEK — nyitókép (nagy) + további képek + zárókép infó */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                <strong>{templateLabel} · {aspect}</strong>: {imageCountLabel(design, aspect).toLowerCase()} szükséges
                {" "}(most {shots.length}). Az <strong>első kép a nyitókép</strong> — ezzel indul a videó, és ezen jelennek
                meg az ingatlan fő adatai. A többi képhez opcionálisan írhatsz feliratot. A záróképre (fotó nélkül) az
                adatok és az elérhetőséged kerülnek.
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
              {/* NYITÓKÉP — nagy, kiemelt + az ingatlan fő adatai */}
              {shots.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)" }}>
                  <p className="text-sm font-semibold" style={{ color: "#7a2e17" }}>1. Nyitókép — ezzel indul a videó</p>
                  <p className="mt-0.5 mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Ezen jelennek meg az első infók: típus, elhelyezkedés, ár, méret, szoba. Ugyanezek a záróképen is.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={shots[0].url} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" style={{ border: "2px solid var(--twx-coral)" }} />
                      <span className="absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-bold shadow" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>Nyitókép</span>
                      <button type="button" onClick={() => removeImage(0)} aria-label="Nyitókép törlése" className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full text-sm shadow" style={{ background: "#fff" }}>×</button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {/* Sorrend: típus + ár egy sorban → alatta a helyszín (település, utca) → végül a méretek */}
                      <Combo label="Ingatlan típusa" value={facts.propertyType} onChange={(v) => setF("propertyType", v)} options={PROPERTY_TYPE_OPTIONS} placeholder="pl. Eladó panellakás" />
                      <MemField label="Ár" value={facts.price} onChange={(v) => setF("price", v)} placeholder="pl. 59,9 M Ft" mem={priceMem} />
                      <MemField label="Elhelyezkedés" value={facts.location} onChange={(v) => setF("location", v)} placeholder="pl. Budapest, XIII. kerület" mem={locationMem} />
                      <MemField label="Utca, házszám (opcionális)" value={facts.address} onChange={(v) => setF("address", v)} placeholder="pl. Sas utca 12." mem={addressMem} />
                      <MemField label="Méret" value={facts.size} onChange={(v) => setF("size", v)} placeholder="pl. 74 m²" mem={sizeMem} />
                      <Combo label="Szobaszám" value={facts.rooms} onChange={(v) => setF("rooms", v)} options={ROOMS_OPTIONS} placeholder="pl. 3" />
                      <Combo label="Fürdő / wc" value={facts.bathrooms} onChange={(v) => setF("bathrooms", v)} options={BATHROOM_OPTIONS} placeholder="pl. 1" />
                    </div>
                  </div>
                </div>
              )}

              {/* TOVÁBBI KÉPEK — kisebbek + opcionális felirat */}
              {shots.length > 1 && (
                <div>
                  <p className="text-sm font-semibold">További képek — felirat opcionális</p>
                  <ul className="mt-2 space-y-2.5">
                    {shots.slice(1).map((s, idx) => {
                      const i = idx + 1;
                      return (
                        <li key={s.url + i} className="flex items-center gap-3 rounded-xl p-2.5" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                          <div className="relative shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.url} alt="" className="h-14 w-20 rounded-lg object-cover" style={{ border: "1px solid var(--twx-line)" }} />
                            <span className="absolute -left-1.5 -top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold shadow" style={{ background: "var(--twx-ink)", color: "#fff" }}>{i + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            {captionMax > MAX_PHOTO_CAPTION ? (
                              // Hosszú-feliratos sablon: kétsoros mező + karakterszámláló — a
                              // megengedett hossz pont kitölti a videó feliratdobozát.
                              <div className="relative">
                                <textarea value={s.caption} maxLength={captionMax} rows={2}
                                  onChange={(e) => setCaption(i, e.target.value.replace(/\n/g, " "))}
                                  placeholder="Felirat ehhez a képhez (nem kötelező)"
                                  className="w-full resize-none rounded-lg px-3 py-2 pr-14 text-sm font-medium outline-none"
                                  style={{ border: "1.5px solid var(--twx-line)", background: "var(--twx-cream)", color: "var(--twx-ink)" }} />
                                <span className="pointer-events-none absolute bottom-2 right-2.5 text-[10px] font-semibold"
                                  style={{ color: s.caption.length >= captionMax ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>
                                  {s.caption.length}/{captionMax}
                                </span>
                              </div>
                            ) : (
                            <input type="text" value={s.caption} maxLength={captionMax} onChange={(e) => setCaption(i, e.target.value)}
                              placeholder="Felirat ehhez a képhez (nem kötelező)"
                              className="w-full rounded-lg px-3 py-2 text-sm font-medium outline-none"
                              style={{ border: "1.5px solid var(--twx-line)", background: "var(--twx-cream)", color: "var(--twx-ink)" }} />
                            )}
                            {/* Felirat helye a képen — kis, elegáns kapcsoló */}
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--twx-ink-muted)" }}>
                                Felirat helye
                              </span>
                              <div className="inline-flex overflow-hidden rounded-full" style={{ border: "1px solid var(--twx-line)", background: "#fff", opacity: s.caption.trim() ? 1 : 0.55 }}>
                                {([
                                  { key: "bottom" as CaptionPos, label: "Lent" },
                                  { key: "center" as CaptionPos, label: "Középen" },
                                ]).map((o) => {
                                  const on = s.captionPos === o.key;
                                  return (
                                    <button key={o.key} type="button" onClick={() => setCaptionPos(i, o.key)}
                                      aria-pressed={on} title={o.key === "center" ? "Középen — vonal a felirat fölött és alatt" : "Lent — vonal a felirat fölött"}
                                      className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold transition-colors"
                                      style={{ background: on ? "var(--twx-ink)" : "transparent", color: on ? "#fff" : "var(--twx-ink-muted)" }}>
                                      {/* mini piktogram: hol ül a szövegsáv a képen */}
                                      <span className="flex h-3.5 w-2.5 flex-col rounded-[3px]"
                                        style={{ border: `1px solid ${on ? "rgba(255,255,255,0.65)" : "var(--twx-line)"}`, justifyContent: o.key === "center" ? "center" : "flex-end", padding: "1px" }}>
                                        <span className="block h-[2px] w-full rounded-full" style={{ background: on ? "#fff" : "var(--twx-ink-muted)" }} />
                                      </span>
                                      {o.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col gap-1">
                            <button type="button" aria-label="Feljebb (a nyitókép felé)" onClick={() => moveImage(i, i - 1)}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-sm" style={{ border: "1px solid var(--twx-line)" }}>↑</button>
                            <button type="button" aria-label="Lejjebb" onClick={() => moveImage(i, i + 1)} disabled={i === shots.length - 1}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-sm disabled:opacity-30" style={{ border: "1px solid var(--twx-line)" }}>↓</button>
                            <button type="button" aria-label="Törlés" onClick={() => removeImage(i)}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-sm" style={{ border: "1px solid var(--twx-line)", color: "#b4462f" }}>×</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {/* ZÁRÓKÉP — fotó NÉLKÜL: adatok + elérhetőség a sablon színes hátterén */}
              <div className="rounded-xl p-3" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
                <p className="text-sm font-semibold">Zárókép — ingatlanos elérhetőség</p>
                {profiles.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--twx-ink-muted)" }}>
                      Betöltés korábbi arculatból
                    </p>
                    <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {profiles.map((p) => {
                        const on = profileId === p.id;
                        const who = p.display_name || p.label || "";
                        const initials = who.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
                        return (
                          <button key={p.id} type="button" onClick={() => loadContactFromProfile(p.id)}
                            className="flex items-center gap-2.5 rounded-xl p-2 text-left transition hover:shadow-sm"
                            style={{ border: `1.5px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`, background: on ? "var(--twx-coral-soft)" : "#fff" }}>
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                              style={{ background: p.accent_color || "var(--twx-ink)", color: "#fff" }}>
                              {initials || "?"}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold" style={{ color: on ? "#7a2e17" : "var(--twx-ink)" }}>{who}</span>
                              <span className="block truncate text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{p.phone || p.email || "nincs elérhetőség"}</span>
                            </span>
                            {on && (
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                                style={{ background: "var(--twx-coral)", color: "#1c1005" }}>✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Field label="Név" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} placeholder="pl. Kovács Márk" />
                  <Field label="Telefon" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} placeholder="pl. +36 30 123 4567" />
                  <Field label="E-mail (opcionális)" value={contact.email} onChange={(v) => setContact({ ...contact, email: v })} placeholder="pl. mark@iroda.hu" />
                </div>
              </div>
            </div>
          )}

          {/* 2) BEÁLLÍTÁS */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold">{aspects.length > 1 ? "Méretek" : "Méret"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl p-3" style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream)" }}>
                  {aspects.map((a) => (
                    <span key={a} className="rounded-md px-2 py-1 text-xs font-semibold" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>{a}</span>
                  ))}
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    A <strong>{templateLabel}</strong> sablon {aspects.map((a) => <strong key={a}>{ASPECT_LABEL[a]}</strong>).reduce<React.ReactNode[]>((acc, el, k) => (k ? [...acc, " és ", el] : [el]), [])}
                    {" "}{aspects.length > 1 ? "méretben — mindkettő elkészül." : "mérete."} Módosításhoz válts az első lépésben.
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
                    <span className="block text-sm font-semibold" style={{ color: "#7a2e17" }}>
                      Standard · {VIDEO_CREDITS_ALAP} kredit / méret{aspects.length > 1 ? ` · összesen ${totalCredits} kredit` : ""}
                    </span>
                    <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>Finom kameramozgás (Ken Burns) minden fotón</span>
                  </div>
                </div>
              </div>
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                Várható hossz: ~{lengthSec} mp (nyitókép + {shots.length || imageRange(design, aspect).min} fotó + záró összegző). Hang: csak zene.
              </p>
            </div>
          )}

          {/* 5) GENERÁLÁS — méretenként egy-egy videó */}
          {step === 3 && (
            <div className="space-y-4 text-center">
              {!started && lab && submitting ? (
                <div className="py-10">
                  <p className="text-sm font-medium">A saját TWINX motor készíti a {aspects.length > 1 ? "videókat" : "videót"}…</p>
                  <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Ez méretenként 1–3 perc. Ne zárd be az ablakot.
                  </p>
                </div>
              ) : !started ? (
                <div className="py-8">
                  <p className="text-sm font-medium">Minden készen áll.</p>
                  <p className="mx-auto mt-2 max-w-md text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {aspects.length > 1 && (
                      <><strong>{aspects.map((a) => ASPECT_LABEL[a]).join(" és ")}</strong> méretben készül — ugyanazokból a fotókból
                        {lab ? "." : `, méretenként ${VIDEO_CREDITS_ALAP} kredit (összesen ${totalCredits}).`}{" "}</>
                    )}
                    A videó generálása 1–3 percig tart. A kész videó azonnal mentésre kerül a
                    Korábbi videóim közé — akkor sem vész el, ha közben bezárod az oldalt.
                    Ha a generálás nem sikerül, a kredit automatikusan visszajár.
                  </p>
                </div>
              ) : (
                <div className={`grid gap-4 ${runs.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {runs.map((r) => (
                    <div key={r.aspect} className="rounded-xl p-3" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                      {runs.length > 1 && (
                        <p className="mb-2 text-xs font-semibold" style={{ color: "var(--twx-ink-muted)" }}>{ASPECT_LABEL[r.aspect]} · {r.aspect}</p>
                      )}
                      {r.status === "done" && r.output_url ? (
                        <>
                          <video src={r.output_url} controls className="mx-auto max-h-[46vh] rounded-xl" style={{ border: "1px solid var(--twx-line)" }} />
                          <p className="mt-2 text-sm text-green-700">
                            {lab ? "Kész! (Videólabor — nem kerül a partner-előzmények közé.)" : "Kész! Elmentve a Korábbi videóim közé."}
                          </p>
                          {runs.length > 1 && (
                            <a href={toDownloadUrl(r.output_url)} className="mt-2 inline-block rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
                              Letöltés ({r.aspect})
                            </a>
                          )}
                        </>
                      ) : r.status === "failed" ? (
                        <div className="py-6">
                          <p className="text-sm font-semibold text-red-600">A videó nem készült el.</p>
                          <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                            {r.error || "Ismeretlen hiba."} A kredit automatikusan visszajárt — próbáld újra.
                          </p>
                        </div>
                      ) : (
                        <div className="py-8">
                          <p className="text-sm font-medium">
                            {r.status === "animating" ? "AI-snittek készülnek minden fotóból — ez több percig is tarthat…" : "A videó renderelése folyik…"}
                            {r.debug ? <span className="mt-1 block text-[11px] opacity-70">{describeProgress(r.debug)}</span> : null}
                          </p>
                          <div className="mx-auto mt-4 h-2 w-full max-w-64 overflow-hidden rounded-full" style={{ background: "var(--twx-line)" }}>
                            <div className="h-full rounded-full transition-all" style={{ background: "var(--twx-coral)", width: `${Math.min(95, Math.round((elapsed / 150) * 100))}%` }} />
                          </div>
                          <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                            ~1–3 perc · nyugodtan itt hagyhatod, a kész videó az előzményekbe kerül
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>

        {/* Lábléc */}
        <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy || started}
            className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ border: "1px solid var(--twx-line)" }}>
            Vissza
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
              Tovább
            </button>
          ) : allFinished ? (
            <div className="flex gap-2">
              {/* Sikertelen (vagy el sem indult) méret: csak azt indítjuk újra. */}
              {(runs.some((r) => r.status === "failed") || missing.length > 0) && (
                <button type="button" disabled={busy}
                  onClick={() => {
                    const retry = [...runs.filter((r) => r.status === "failed").map((r) => r.aspect), ...missing];
                    setRuns((rs) => rs.filter((r) => r.status !== "failed"));
                    void generate(retry);
                  }}
                  className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
                  Újrapróbálom{aspects.length > 1 ? " (a sikertelen méretet)" : ""}
                </button>
              )}
              {runs.length === 1 && runs[0].status === "done" && runs[0].output_url && !missing.length && (
                <a href={toDownloadUrl(runs[0].output_url)} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>Letöltés</a>
              )}
              {runs.some((r) => r.status === "done") && (
                <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)" }}>Kész</button>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => void generate()} disabled={busy || started}
              className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
              {busy || started
                ? "Generálás folyamatban…"
                : lab
                  ? (aspects.length > 1 ? "Próbavideók (2 méret) a saját motorral" : "Próbavideó a saját motorral")
                  : `${aspects.length > 1 ? `Videók generálása (${aspects.length} méret` : "Videó generálása ("} · ${totalCredits} kredit)`}
            </button>
          )}
        </div>
      </div>

      {/* KORÁBBI MUNKÁK — a MODALON KÍVÜL, a lap jobb margójában (csak a Képek lépésnél).
          Így nem vágja ketté a feltöltést és a zárókép-adatokat. */}
      {step === 1 && (
        <div className="absolute right-4 top-1/2 hidden w-[340px] max-h-[88vh] -translate-y-1/2 overflow-y-auto xl:block">
          <AssetPicker onPick={(u) => addUrl(u)} selectedUrls={shots.map((s) => s.url)} />
        </div>
      )}

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

/**
 * Saját-motoros SABLONKÁRTYA: bal oldalt az előnézet (a sablon nyitóképének
 * kompozíciója a kiválasztott szín VALÓDI palettájával), jobb oldalt a név és a
 * kör alakú színválasztó gombok. Színváltáskor az előnézet azonnal átszíneződik.
 *   Aurora-család: sötét ferde panel · Skandi-család: krém „háztető" panel alul.
 */
function EngineFamilyCard({ family, colorId, on, photo, onPick, favorite, onToggleFavorite }: {
  family: EngineFamily; colorId: string; on: boolean; photo?: string; onPick: (id: string) => void;
  /** Kedvenc-e (csillag a bal felső sarokban); onToggleFavorite nélkül nincs csillag. */
  favorite?: boolean; onToggleFavorite?: () => void;
}) {
  const color = family.colors.find((c) => c.id === colorId) ?? family.colors[0];
  if (!color) return null;
  // Bal oldalt NAGY előnézet (a kártya 42%-a — jól látszik a sablon), jobb oldalt a
  // név és a KIEMELT színvilág-választó (kétszínű kör + a szín neve, „pirula" gombként).
  return (
    <div className="relative flex items-stretch overflow-hidden rounded-xl transition"
      style={{
        // A keret vastagsága MINDIG 2 px (csak a színe vált) — így kijelöléskor nem
        // szűkül a belső tér, és a színgombok nem ugranak át új sorba.
        border: `2px solid ${on ? "var(--twx-coral)" : "var(--twx-line)"}`,
        boxShadow: on ? "0 6px 18px rgba(239,122,90,0.18)" : "0 1px 2px rgba(0,0,0,0.04)",
        background: "#fff",
      }}>
      {/* KEDVENC: pici csillag a kártya bal felső sarkában */}
      {onToggleFavorite && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          aria-pressed={favorite} aria-label={favorite ? `${family.name}: eltávolítás a kedvencekből` : `${family.name}: hozzáadás a kedvencekhez`}
          title={favorite ? "Kedvenc — kattints az eltávolításhoz" : "Hozzáadás a kedvencekhez"}
          className="absolute left-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[14px] leading-none shadow-sm transition hover:scale-110"
          style={{ background: "rgba(255,255,255,0.94)", color: favorite ? "#e0a82e" : "#9a8f85" }}>
          {favorite ? "★" : "☆"}
        </button>
      )}
      <button type="button" onClick={() => onPick(color.id)} aria-pressed={on} className="w-[42%] shrink-0" aria-label={`${family.name} sablon`}>
        <EnginePreview item={color} photo={photo} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 p-3">
        <button type="button" onClick={() => onPick(color.id)} className="min-w-0 text-left">
          <p className="text-sm font-semibold leading-tight" style={{ color: "var(--twx-ink)" }}>{family.name}</p>
          <p className="mt-0.5 text-[11px] leading-snug" title={family.tagline} style={{ color: "var(--twx-ink-muted)" }}>{family.tagline}</p>
        </button>
        {/* FIX elrendezés: a színgombok mindig EGYMÁS ALATT, teljes szélességben — így a
            színvilág neve mindig kiolvasható, és kijelöléskor sem mozdul semmi. */}
        <div role="radiogroup" aria-label={`${family.name} színvilága`} className="flex flex-col gap-1.5">
          {family.colors.map((c) => {
            const active = c.id === color.id;
            return (
              <button key={c.id} type="button" role="radio" aria-checked={active}
                onClick={() => onPick(c.id)} title={`Színvilág: ${c.colorName}`}
                className="flex min-w-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-[11px] font-semibold transition"
                style={{
                  border: `1.5px solid ${active ? c.palette.accent : "var(--twx-line)"}`,
                  background: active ? "var(--twx-coral-soft)" : "#fff",
                  color: active ? "var(--twx-ink)" : "var(--twx-ink-muted)",
                }}>
                {/* Kétszínű kör: alapszín + kiemelő szín — a színvilág egy pillantásra */}
                <span className="relative block h-5 w-5 shrink-0 overflow-hidden rounded-full"
                  style={{ background: c.palette.base, boxShadow: active ? `0 0 0 2px #fff, 0 0 0 3.5px ${c.palette.accent}` : "inset 0 0 0 1px rgba(0,0,0,0.12)" }}>
                  <span className="absolute inset-y-0 right-0 w-1/2" style={{ background: c.palette.accent }} />
                </span>
                <span className="min-w-0 flex-1 truncate text-left">{c.colorName}</span>
                <span aria-hidden className="w-2.5 shrink-0 text-center" style={{ color: "var(--twx-coral)", visibility: active ? "visible" : "hidden" }}>✓</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** A sablon nyitóképének kicsinyített előnézete a megadott palettával. */
function EnginePreview({ item, photo }: { item: EngineGalleryItem; photo?: string }) {
  const p = item.palette;
  const skandi = item.templateId === "skandi";
  // Skandi „háztető": a kiemelő-színű él és a krém panel — ugyanaz a forma, mint a videóban
  // (csúcs középen ~54%-nál, oldalak ~63%-nál), a csúcson kis gyűrűvel.
  const roofEdge = "polygon(0% 62%, 50% 53%, 100% 62%, 100% 100%, 0% 100%)";
  const roofPanel = "polygon(0% 63.2%, 50% 54.2%, 100% 63.2%, 100% 100%, 0% 100%)";
  return (
    <div className="relative aspect-[3/4] h-full w-full overflow-hidden" style={{ background: `linear-gradient(150deg, ${p.base}, ${p.shadow})` }}>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {item.templateId === "mozaik" ? (
        // Mozaik: a VALÓDI motor nyitóképe (9:16, a végállapot) — pontosan az, amit a videó mutat.
        // Újragyártás sablonváltozáskor: public/video-previews/mozaik-9x16.jpg (docs/video-motor-allapot.md).
        <span className="absolute inset-0 flex justify-center" style={{ background: p.base }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/video-previews/mozaik-9x16.jpg" alt="" className="h-full w-auto max-w-none object-contain" />
        </span>
      ) : item.templateId === "prestige" ? (
        <>
          {/* Prestige: sötét átmenet alul, arany ikonsor felül, talpas cím, arany ár */}
          <span className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${p.shadow}99 0%, transparent 22%, transparent 45%, ${p.shadow}f0 80%)` }} />
          <span className="absolute inset-[5%]" style={{ border: `1px solid ${p.accent}88` }} />
          <div className="absolute inset-x-0 flex items-center justify-center gap-[6%]" style={{ top: "8%" }}>
            {["⌂", "⚿", "⌖"].map((g) => <span key={g} className="text-[8px] leading-none" style={{ color: p.accent }}>{g}</span>)}
          </div>
          <div className="absolute inset-x-0 bottom-[9%] flex flex-col px-[12%]">
            <span className="text-[5.5px] tracking-widest" style={{ color: p.accent }}>ÚJ ÉPÍTÉSŰ LAKÁS</span>
            <span className="mt-0.5 font-serif text-[11px] font-semibold leading-tight" style={{ color: p.text }}>Sas utca 22.</span>
            <span className="mt-1 font-serif text-[11px] font-semibold leading-none" style={{ color: p.accent }}>60 M Ft</span>
          </div>
        </>
      ) : skandi ? (
        <>
          <span className="absolute inset-0" style={{ background: p.accent, clipPath: roofEdge }} />
          <span className="absolute inset-0" style={{ background: p.base, opacity: 0.97, clipPath: roofPanel }} />
          <span className="absolute rounded-full" style={{ left: "calc(50% - 5px)", top: "calc(54.2% - 5px)", width: 10, height: 10, background: p.accent }} />
          <span className="absolute rounded-full" style={{ left: "calc(50% - 2.5px)", top: "calc(54.2% - 2.5px)", width: 5, height: 5, background: p.base }} />
          <div className="absolute inset-x-0 bottom-0 flex flex-col justify-center px-2.5" style={{ top: "64%" }}>
            <span className="text-[5.5px] font-semibold tracking-widest" style={{ color: p.accent }}>ÚJ ÉPÍTÉSŰ LAKÁS</span>
            <span className="mt-0.5 text-[10px] font-medium leading-tight" style={{ color: p.text }}>Sas utca 22.</span>
            <span className="text-[7px] leading-tight" style={{ color: p.muted }}>Budapest V. kerület</span>
            <span className="mt-1 text-[11px] font-medium leading-none" style={{ color: p.text }}>60 M Ft</span>
          </div>
        </>
      ) : (
        <>
          <span className="absolute" style={{ left: "-26%", top: "-14%", width: "92%", height: "128%", background: p.base, opacity: 0.94, transform: "skewX(-9deg)" }} />
          <span className="absolute" style={{ left: "64%", top: "-14%", width: 4, height: "128%", background: p.accent, transform: "skewX(-9deg)" }} />
          <div className="absolute inset-y-0 left-0 flex w-[64%] flex-col justify-center px-2">
            <span className="mb-1 block h-[2px] w-4 rounded-sm" style={{ background: p.accent }} />
            <span className="text-[10px] font-bold leading-tight" style={{ color: p.accent }}>Sas utca 22.</span>
            <span className="mt-0.5 text-[7px] font-medium leading-tight" style={{ color: "rgba(255,255,255,0.92)" }}>Budapest V. kerület</span>
            <span className="mt-1.5 text-[6px] font-bold tracking-widest" style={{ color: p.accent }}>ÚJ ÉPÍTÉSŰ LAKÁS</span>
            <span className="mt-1.5 text-[11px] font-extrabold leading-none" style={{ color: p.accent }}>60 M Ft</span>
          </div>
        </>
      )}
    </div>
  );
}
