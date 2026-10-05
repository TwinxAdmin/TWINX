// VIDEÓLABOR — űrlap + eredmény + összevetés a Shotstack-videóval.
// Wireframe-szintű felület (CLAUDE.md: funkcionális UI a 7. fázisig).
"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  variants: { id: string; name: string }[];
  musicStyles: { slug: string; label: string }[];
  profiles: { id: string; label: string }[];
};

type Result = {
  url: string;
  seconds: number;
  timings: Record<string, number>;
  photoKinds: ("wide" | "matching" | "tall")[];
  fontSource: "local" | "google" | "none";
  music: string | null;
};

const KIND_LABEL = { wide: "széles → pásztázás", matching: "egyező arány → be/ki zoom", tall: "magas → függőleges pásztázás" };

const card = { background: "#fff", border: "1px solid var(--twx-line)" };

export default function VideoLab({ variants, musicStyles, profiles }: Props) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [aspect, setAspect] = useState<"9:16" | "1:1">("9:16");
  const [variant, setVariant] = useState(variants[0]?.id ?? "aurora");
  const [music, setMusic] = useState(musicStyles[0]?.slug ?? "none");
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [fields, setFields] = useState({
    address: "Visegrádi utca 212.", location: "Székesfehérvár", type: "Új építésű lakás",
    price: "70 M Ft", size: "40", rooms: "1 szoba", bathrooms: "1 fürdőszoba + külön WC", floor: "1. emelet",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [shotstackUrl, setShotstackUrl] = useState("");
  const [started, setStarted] = useState<number | null>(null);

  const previews = useMemo(() => photos.map((f) => URL.createObjectURL(f)), [photos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  async function run() {
    setError(null); setResult(null);
    if (photos.length < 4 || photos.length > 5) { setError("4–5 fotót tölts fel."); return; }
    setBusy(true); setStarted(Date.now());
    try {
      const fd = new FormData();
      photos.forEach((f) => fd.append("photos", f));
      fd.append("aspect", aspect);
      fd.append("variant", variant);
      fd.append("musicStyle", music);
      if (profileId) fd.append("profileId", profileId);
      Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
      const res = await fetch("/api/admin/video-lab", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Hiba (${res.status})`);
      setResult(d as Result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof fields, label: string) => (
    <label className="block text-xs">
      <span style={{ color: "var(--twx-ink-muted)" }}>{label}</span>
      <input className="twx-input mt-1 w-full text-sm" value={fields[key]}
        onChange={(e) => setFields({ ...fields, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="space-y-5">
      {/* --- Bemenet --- */}
      <section className="space-y-4 rounded-2xl p-5" style={card}>
        <h2 className="text-base font-semibold">1. Fotók (4–5, a sorrend a videó sorrendje)</h2>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 5))} />
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt={`${i + 1}. fotó`} className="h-20 w-auto rounded-lg" style={{ border: "1px solid var(--twx-line)" }} />
            ))}
          </div>
        )}

        <h2 className="pt-2 text-base font-semibold">2. Ingatlan adatai</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("address", "Cím (utca, házszám)")}
          {field("location", "Település / kerület")}
          {field("type", "Típus")}
          {field("price", "Irányár")}
          {field("size", "Alapterület (m²)")}
          {field("rooms", "Szobák")}
          {field("bathrooms", "Fürdő / WC")}
          {field("floor", "Emelet")}
        </div>

        <h2 className="pt-2 text-base font-semibold">3. Beállítások</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="block text-xs">
            <span style={{ color: "var(--twx-ink-muted)" }}>Méret</span>
            <select className="twx-input mt-1 w-full text-sm" value={aspect} onChange={(e) => setAspect(e.target.value as "9:16" | "1:1")}>
              <option value="9:16">9:16 (Reels, TikTok)</option>
              <option value="1:1">1:1 (négyzetes)</option>
            </select>
          </label>
          <label className="block text-xs">
            <span style={{ color: "var(--twx-ink-muted)" }}>Sablon / szín</span>
            <select className="twx-input mt-1 w-full text-sm" value={variant} onChange={(e) => setVariant(e.target.value)}>
              {variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <label className="block text-xs">
            <span style={{ color: "var(--twx-ink-muted)" }}>Zene</span>
            <select className="twx-input mt-1 w-full text-sm" value={music} onChange={(e) => setMusic(e.target.value)}>
              {musicStyles.map((m) => <option key={m.slug} value={m.slug}>{m.label}</option>)}
              <option value="none">Zene nélkül</option>
            </select>
          </label>
          <label className="block text-xs">
            <span style={{ color: "var(--twx-ink-muted)" }}>Arculat (ügynök, logó)</span>
            <select className="twx-input mt-1 w-full text-sm" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">— nincs —</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="button" onClick={run} disabled={busy}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--twx-coral)" }}>
            {busy ? "Készül a videó… (1–3 perc)" : "Videó készítése a saját motorral"}
          </button>
          {busy && started && <Elapsed from={started} />}
          {error && <span className="text-sm" style={{ color: "#c0392b" }}>{error}</span>}
        </div>
      </section>

      {/* --- Eredmény + összevetés --- */}
      {result && (
        <section className="space-y-4 rounded-2xl p-5" style={card}>
          <h2 className="text-base font-semibold">Eredmény</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold" style={{ color: "#2e7d52" }}>● Saját TWINX motor</p>
              <video src={result.url} controls playsInline className="w-full rounded-xl" style={{ maxHeight: 640, background: "#000" }} />
              <a href={result.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">Megnyitás új lapon</a>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold" style={{ color: "var(--twx-ink-muted)" }}>● Shotstack (összevetéshez)</p>
              <input className="twx-input w-full text-sm" placeholder="Illeszd be egy Shotstack-videó linkjét (pl. a videó-előzményekből)"
                value={shotstackUrl} onChange={(e) => setShotstackUrl(e.target.value.trim())} />
              {shotstackUrl && (
                <video src={shotstackUrl} controls playsInline className="mt-2 w-full rounded-xl" style={{ maxHeight: 640, background: "#000" }} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2" style={{ color: "var(--twx-ink-muted)" }}>
            <div>
              <p className="font-semibold" style={{ color: "var(--twx-ink)" }}>Fotók felismerése</p>
              <ul className="mt-1 space-y-0.5">
                {result.photoKinds.map((k, i) => <li key={i}>{i + 1}. fotó: {KIND_LABEL[k]}</li>)}
              </ul>
            </div>
            <div>
              <p className="font-semibold" style={{ color: "var(--twx-ink)" }}>Mérések</p>
              <ul className="mt-1 space-y-0.5">
                <li>Videó hossza: {result.seconds} mp</li>
                <li>Teljes készítési idő: {result.timings.total?.toFixed(1)} mp
                  (áttűnések {result.timings.transitions?.toFixed(1)} · rétegek {result.timings.layers?.toFixed(1)} · kódolás {result.timings.encode?.toFixed(1)})</li>
                <li>Betűk: {result.fontSource === "google" ? "Manrope (Google Fonts)" : result.fontSource === "local" ? "Manrope (helyi fájl)" : "⚠ alapbetű — a Manrope nem töltődött be"}</li>
                <li>Zene: {result.music ?? "nincs (üres mappa vagy zene nélkül)"}</li>
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/** Eltelt idő kijelző a várakozás alatt. */
function Elapsed({ from }: { from: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{Math.round((Date.now() - from) / 1000)} mp</span>;
}
