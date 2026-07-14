// Marketing videó builder (wireframe). Forrás: korábbi látványtervek VAGY feltöltés.
// Formátum + zenei stílus + képszám-alapú kredit. Indítás -> job -> polling -> eredmény.
"use client";

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

export default function VideoBuilder({ historyImages }: { historyImages: string[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [format, setFormat] = useState("16:9");
  const [musicStyle, setMusicStyle] = useState(MUSIC_STYLES[0]?.slug ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      <h1 className="font-display text-3xl font-semibold">Marketing videó</h1>
      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Válassz {countLabel} képet (korábbi látványtervekből
        vagy feltöltéssel), formátumot és zenei stílust. A kredit a képszámtól függ.
      </p>

      {/* Korábbi látványtervek */}
      {historyImages.length > 0 && (
        <section>
          <h2 className="font-display text-sm font-medium">Korábbi látványtervekből</h2>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {historyImages.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => toggleHistory(url)}
                className="relative rounded-lg border-2"
                style={{ borderColor: selected.has(url) ? "var(--twx-coral)" : "transparent" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Látványterv" className="h-20 w-full object-cover" />
                {selected.has(url) && (
                  <span className="absolute left-0 top-0 px-1 text-xs" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Feltöltés */}
      <section>
        <h2 className="font-display text-sm font-medium">Vagy tölts fel eredeti képeket</h2>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="mt-2 cursor-pointer rounded-xl border-2 border-dashed p-4 text-center text-sm"
          style={{ borderColor: "var(--twx-line)", color: "var(--twx-ink-muted)" }}
        >
          Kattints a tallózáshoz (JPG / PNG / WEBP)
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => addUploads(e.target.files)}
          />
        </div>
        {uploads.length > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {uploads.map((u, i) => (
              <div key={u.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.url} alt="Feltöltés" className="h-20 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeUpload(i)}
                  className="absolute right-0 top-0 px-1 text-xs"
                  style={{ background: "var(--twx-coral)", color: "#1c1005" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Formátum + zene */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="format" className="block text-sm">
            Formátum
          </label>
          <select
            id="format"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="twx-input mt-1"
          >
            {VIDEO_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="music" className="block text-sm">
            Zenei stílus
          </label>
          <select
            id="music"
            value={musicStyle}
            onChange={(e) => setMusicStyle(e.target.value)}
            className="twx-input mt-1"
          >
            {MUSIC_STYLES.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
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
    </main>
  );
}
