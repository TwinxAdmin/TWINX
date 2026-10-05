// VIDEÓLABOR — az ÉLŐ videó-szerkesztő (VideoWizard) labor-módban + eredmények.
//
// Ugyanaz a felület, mint a partnereknél: sablon és méret, képek sorrendje,
// fotónkénti felirat és annak helye (lent / középen), adatok, elérhetőség,
// zene. A különbség: a kész anyagot a SAJÁT TWINX motor rendereli, kredit és
// partner-előzmény nélkül. Az eredmények itt gyűlnek, mérésekkel, és mindegyik
// mellé beilleszthető egy Shotstack-videó az összevetéshez.
"use client";

import { useState } from "react";
import VideoWizard from "@/components/video/VideoWizard";
import type { BrandingProfile } from "@/lib/branding";

type Result = {
  url: string;
  seconds: number;
  timings: Record<string, number>;
  photoKinds: ("wide" | "matching" | "tall")[];
  fontSource: "local" | "google" | "none";
  music: string | null;
  storage?: "supabase" | "local";
  uploadError?: string | null;
};

type Run = Result & { at: string };

const KIND_LABEL = { wide: "széles → pásztázás", matching: "egyező arány → be/ki zoom", tall: "magas → függőleges pásztázás" };
const card = { background: "#fff", border: "1px solid var(--twx-line)" };

export default function VideoLab({ profiles }: { profiles: BrandingProfile[] }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5" style={card}>
        <div>
          <h2 className="text-base font-semibold">Próbavideó a saját motorral</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Az élő videó-szerkesztő nyílik meg: képek sorrendje, fotónkénti felirat (lent / középen), adatok,
            elérhetőség, zene — pontosan úgy, ahogy a partner látja. Kredit és partner-előzmény nélkül.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
          Szerkesztő megnyitása
        </button>
      </section>

      {runs.length === 0 && (
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs próbavideó ebben a munkamenetben.</p>
      )}

      {runs.map((r, idx) => <RunCard key={r.at} run={r} n={runs.length - idx} />)}

      {open && (
        <VideoWizard
          profiles={profiles}
          onClose={() => setOpen(false)}
          lab={{
            endpoint: "/api/admin/video-lab",
            onResult: (d) => setRuns((prev) => [{ ...(d as unknown as Result), at: new Date().toISOString() }, ...prev]),
          }}
        />
      )}
    </div>
  );
}

function RunCard({ run, n }: { run: Run; n: number }) {
  const [shotstackUrl, setShotstackUrl] = useState("");
  return (
    <section className="space-y-4 rounded-2xl p-5" style={card}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{n}. próba</h2>
        <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{new Date(run.at).toLocaleTimeString("hu-HU")}</span>
      </div>
      {run.storage === "local" && (
        <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "#fdf3e2", color: "#8a5a12" }}>
          A videó elkészült, de a Supabase-feltöltés nem sikerült ({run.uploadError}). A labor a gépeden
          félretett példányt játssza le — a próbához ez is megfelel.
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold" style={{ color: "#2e7d52" }}>● Saját TWINX motor</p>
          <video src={run.url} controls playsInline className="w-full rounded-xl" style={{ maxHeight: 640, background: "#000" }} />
          <a href={run.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs underline">Megnyitás új lapon</a>
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
            {run.photoKinds.map((k, i) => <li key={i}>{i + 1}. fotó: {KIND_LABEL[k]}</li>)}
          </ul>
        </div>
        <div>
          <p className="font-semibold" style={{ color: "var(--twx-ink)" }}>Mérések</p>
          <ul className="mt-1 space-y-0.5">
            <li>Videó hossza: {run.seconds} mp</li>
            <li>Készítési idő: {run.timings.total?.toFixed(1)} mp
              (áttűnések {run.timings.transitions?.toFixed(1)} · rétegek {run.timings.layers?.toFixed(1)} · kódolás {run.timings.encode?.toFixed(1)})</li>
            <li>Betűk: {run.fontSource === "google" ? "Manrope (Google Fonts)" : run.fontSource === "local" ? "Manrope (helyi fájl)" : "⚠ alapbetű — a Manrope nem töltődött be"}</li>
            <li>Zene: {run.music ?? "nincs (üres mappa vagy zene nélkül)"}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
