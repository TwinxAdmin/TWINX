// Marketing videó builder (wireframe). Forrás: korábbi látványtervek VAGY feltöltés.
// Formátum + zenei stílus + képszám-alapú kredit. Indítás -> job -> polling -> eredmény.
"use client";
import ModuleIntro from "@/components/ModuleIntro";
import SelectField from "@/components/SelectField";
import AssetTray, { readTwxDragUrl } from "@/components/AssetTray";

import { useEffect, useRef, useState } from "react";
import {
  VIDEO_FORMATS,
  MUSIC_STYLES,
  MIN_VIDEO_IMAGES,
  MAX_VIDEO_IMAGES,
  creditForImages,
} from "@/lib/video";
import { compressImage } from "@/lib/image-compress";

type Upload = { file: File; url: string };

export default function VideoBuilder({ historyImages, enhancedImages = [] }: { historyImages: string[]; enhancedImages?: string[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [format, setFormat] = useState("16:9");
  const [musicStyle, setMusicStyle] = useState(MUSIC_STYLES[0]?.slug ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  const count = selected.size + uploads.length;
  const credits = creditForImages(count);
  const validCount = count >= MIN_VIDEO_IMAGES && count <= MAX_VIDEO_IMAGES;
  const countLabel =
    MIN_VIDEO_IMAGES === MAX_VIDEO_IMAGES
      ? `pontosan ${MIN_VIDEO_IMAGES}`
      : `${MIN_VIDEO_IMAGES}-${MAX_VIDEO_IMAGES}`;

  function toggleHistory(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else if (count < MAX_VIDEO_IMAGES) next.add(url);
      return next;
    });
  }

  function addUploads(list: FileList | null) {
    if (!list) return;
    const room = MAX_VIDEO_IMAGES - count;
    const incoming = Array.from(list)
      .slice(0, Math.max(0, room))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setUploads((prev) => [...prev, ...incoming]);
  }

  function removeUpload(i: number) {
    setUploads((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Polling a job státuszra.
  useEffect(() => {
    if (!jobId) return;
    if (status === "done" || status === "failed") return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/real-estate/video/${jobId}`);
        const data = await res.json();
        setStatus(data.status);
        setProgress({ done: data.clipsDone ?? 0, total: data.imageCount ?? 0 });
        if (data.status === "done") setOutputUrl(data.outputUrl ?? null);
        if (data.status === "failed") setError(data.error ?? "A videó generálás sikertelen.");
      } catch {
        /* átmeneti hálózati hiba - próbáljuk újra a következő ticknél */
      }
    }, 4000);
    return () => clearInterval(t);
  }, [jobId, status]);

  async function onSubmit() {
    setError(null);
    if (!validCount) {
      setError(`Válassz ${countLabel} képet (most: ${count}).`);
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("format", format);
      fd.append("musicStyle", musicStyle);
      fd.append("historyUrls", JSON.stringify([...selected]));
      // Feltöltés előtti kicsinyítés (Vercel ~4,5 MB kérés-limit).
      const compressed = await Promise.all(uploads.map((u) => compressImage(u.file)));
      for (const f of compressed) fd.append("images", f);

      const res = await fetch("/api/real-estate/video", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hiba a videó indításakor.");
        return;
      }
      setJobId(data.jobId);
      setStatus("animating");
      setProgress({ done: 0, total: count });
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  // Folyamat / eredmény nézet.
  if (jobId) {
    return (
      <main className="mx-auto max-w-2xl space-y-4">
        <h1 className="font-display text-3xl font-semibold">Marketing videó</h1>
        {status !== "done" && status !== "failed" && (
          <div className="twx-card p-4 text-sm">
            <p className="font-medium">Feldolgozás folyamatban…</p>
            <p className="mt-1" style={{ color: "var(--twx-ink-muted)" }}>
              {status === "rendering"
                ? "Vágás és zene ráillesztése…"
                : `Animálás: ${progress?.done ?? 0}/${progress?.total ?? 0} snitt kész`}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Ez több percig is eltarthat. Az oldal automatikusan frissül.
            </p>
          </div>
        )}
        {status === "done" && outputUrl && (
          <div className="space-y-2">
            <p className="text-sm text-green-700">Kész a videó!</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={outputUrl} controls className="w-full" />
            <a href={outputUrl} target="_blank" rel="noreferrer" className="block text-sm underline" style={{ color: "var(--twx-coral)" }}>
              Letöltés
            </a>
          </div>
        )}
        {status === "failed" && (
          <p className="text-sm text-red-600">
            {error ?? "A videó generálás sikertelen. A kreditet visszatérítettük."}
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <ModuleIntro
        eyebrow="Ingatlan · Videó"
        title="Marketing videó"
        subtitle={`Profi, zenés bemutató videó a feltöltött fotókból — az ingatlan pár másodpercben eladható a közösségi médiában. Válassz ${countLabel} képet, formátumot és zenei stílust. A kredit a képszámtól függ.`}
        icon="video"
        chips={["Fotókból", "Zenével", "Social-kész"]}
      />

      <div className="twx-card space-y-5 p-5 sm:p-6">
      {/* Feltöltés — korábbi munkák az alábbi tálcából választhatók */}
      <section>
        <h2 className="font-display text-sm font-medium">Tölts fel képeket, vagy válassz a korábbi munkáidból (lent)</h2>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const url = readTwxDragUrl(e.dataTransfer);
            if (url) { toggleHistory(url); return; }
            addUploads(e.dataTransfer.files);
          }}
          className="mt-2 cursor-pointer rounded-xl border-2 border-dashed p-4 text-center text-sm transition-colors"
          style={{
            borderColor: dragOver ? "var(--twx-coral)" : "var(--twx-line)",
            background: dragOver ? "rgba(239,122,90,0.06)" : "transparent",
            color: dragOver ? "var(--twx-coral)" : "var(--twx-ink-muted)",
          }}
        >
          {dragOver
            ? "Engedd el a képet a hozzáadáshoz"
            : "Kattints a tallózáshoz, vagy húzz ide egy korábbi képet (JPG / PNG / WEBP)"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => addUploads(e.target.files)}
          />
        </div>
        {/* Kiválasztott képek — a tálcából behúzottak és a feltöltöttek egy helyen */}
        {(selected.size > 0 || uploads.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...selected].map((url) => (
              <figure key={url} className="group relative overflow-hidden rounded-xl bg-white transition"
                style={{ border: "1px solid var(--twx-line)", boxShadow: "0 2px 10px rgba(20,12,8,0.06)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Kiválasztott kép" className="aspect-[4/3] w-full object-cover" />
                <figcaption className="px-2 py-1.5 text-[11px] font-medium" style={{ color: "var(--twx-ink-muted)" }}>Korábbi munkából</figcaption>
                <button type="button" onClick={() => toggleHistory(url)} aria-label="Eltávolítás"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-sm opacity-0 shadow transition group-hover:opacity-100"
                  style={{ background: "rgba(255,255,255,0.95)", color: "var(--twx-ink)" }}>×</button>
              </figure>
            ))}
            {uploads.map((u, i) => (
              <figure key={u.url} className="group relative overflow-hidden rounded-xl bg-white transition"
                style={{ border: "1px solid var(--twx-line)", boxShadow: "0 2px 10px rgba(20,12,8,0.06)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.url} alt="Feltöltött kép" className="aspect-[4/3] w-full object-cover" />
                <figcaption className="px-2 py-1.5 text-[11px] font-medium" style={{ color: "var(--twx-ink-muted)" }}>Feltöltött</figcaption>
                <button type="button" onClick={() => removeUpload(i)} aria-label="Eltávolítás"
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-sm opacity-0 shadow transition group-hover:opacity-100"
                  style={{ background: "rgba(255,255,255,0.95)", color: "var(--twx-ink)" }}>×</button>
              </figure>
            ))}
          </div>
        )}
      </section>

      {/* Formátum + zene */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Formátum</label>
          <SelectField className="mt-1 w-full" value={format} onChange={setFormat}
            options={VIDEO_FORMATS.map((f) => ({ value: f.value, label: f.label }))} />
        </div>
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Zenei stílus</label>
          <SelectField className="mt-1 w-full" value={musicStyle} onChange={setMusicStyle}
            options={MUSIC_STYLES.map((s) => ({ value: s.slug, label: s.label }))} />
        </div>
      </div>

      <div className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Kiválasztva: {count} kép ·{" "}
        {validCount ? (
          <span className="font-medium">{credits} kredit</span>
        ) : (
          <span className="text-red-600">
            válassz {countLabel} képet
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || !validCount}
        className="twx-btn w-full"
      >
        {loading ? "Indítás…" : "Videó generálása"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {/* Közös tálca: korábbi munkák mappákban + kedvencek */}
      <AssetTray
        onPick={(u) => toggleHistory(u)}
        selectedUrls={[...selected]}
        note="Válassz egy mappát, majd húzd a képet a feltöltőre, vagy kattints rá a videóhoz adáshoz."
      />
    </main>
  );
}
