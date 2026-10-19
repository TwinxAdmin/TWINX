// VIDEÓLABOR — az ÉLŐ videó-szerkesztő (VideoWizard) labor-módban + eredmények.
//
// Ugyanaz a felület, mint a partnereknél: sablon és méret, képek sorrendje,
// fotónkénti felirat és annak helye (lent / középen), adatok, elérhetőség,
// zene. A különbség: a kész anyagot a SAJÁT TWINX motor rendereli, kredit és
// partner-előzmény nélkül. Az eredmények itt gyűlnek, mérésekkel, és mindegyik
// mellé beilleszthető egy Shotstack-videó az összevetéshez.
"use client";

import { toDownloadUrl } from "@/lib/files";
import { useEffect, useState } from "react";
import VideoWizard from "@/components/video/VideoWizard";
import { showToast } from "@/components/Toast";
import type { BrandingProfile } from "@/lib/branding";

type Result = {
  url: string;
  seconds: number;
  timings: Record<string, number>;
  photoKinds: ("wide" | "matching" | "tall")[];
  fontSource: "local" | "google" | "none";
  music: string | null;
  template?: string;
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
      <EngineSwitch />
      <TemplateAvailability />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5" style={card}>
        <div>
          <h2 className="text-base font-semibold">Próbavideó a saját motorral</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Az élő videó-szerkesztő nyílik meg — a sablonválasztás is ott van, mint a partnernél: sablon és méret, képek sorrendje, fotónkénti felirat (lent / középen), adatok,
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
        <h2 className="text-base font-semibold">{n}. próba <span className="font-normal" style={{ color: "var(--twx-ink-muted)" }}>· {run.template}</span></h2>
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
          <a href={toDownloadUrl(run.url)} className="mt-2 inline-block text-xs underline">Letöltés</a>
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
            <li>Betűk: {run.fontSource === "google" ? "Google Fonts" : run.fontSource === "local" ? "helyi fájl" : "⚠ alapbetű — a sablon betűje nem töltődött be"}</li>
            <li>Zene: {run.music ?? "nincs (üres mappa vagy zene nélkül)"}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// VIDEÓMOTOR-KAPCSOLÓ: melyik rendszer készítse a PARTNEREK videóit.
// A saját TWINX motor az alap; a Shotstack csak tartalék vészhelyzetre.
// ---------------------------------------------------------------------------
type EngineInfo = {
  effective: "twinx" | "shotstack";
  source: "database" | "env" | "default";
  shotstackEnv: string;
  shotstackReady: boolean;
  updatedAt: string | null;
};

const ENGINE_OPTIONS = [
  {
    id: "twinx" as const,
    title: "Saját TWINX motor",
    badge: "AJÁNLOTT",
    text: "A videók a TWINX saját szerverén készülnek, a saját sablonokkal (Aurora, Skandi) és színvilágokkal.",
  },
  {
    id: "shotstack" as const,
    title: "Shotstack — tartalék",
    badge: "VÉSZHELYZET",
    text: "Külső szolgáltatás a régi sablonnal. Csak akkor kapcsold be, ha a saját motorral gond van.",
  },
];

function EngineSwitch() {
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const [saving, setSaving] = useState<"twinx" | "shotstack" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/video-engine", { cache: "no-store" })
      .then((r) => r.json().then((d) => (r.ok ? setInfo(d as EngineInfo) : setError(d.error))))
      .catch(() => setError("A motor állapota nem olvasható."));
  }, []);

  async function choose(id: "twinx" | "shotstack") {
    if (!info || info.effective === id) return;
    if (id === "shotstack" && !window.confirm("Biztosan a Shotstack-tartalékra kapcsolsz? A partnerek videói ettől kezdve a külső szolgáltatással készülnek.")) return;
    setSaving(id); setError(null);
    try {
      const r = await fetch("/api/admin/video-engine", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ renderer: id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Az átkapcsolás nem sikerült.");
      setInfo(d as EngineInfo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl p-5" style={card}>
      <div>
        <h2 className="text-base font-semibold">Videógenerálás motorja</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Ez dönti el, melyik rendszer készíti a <strong>partnerek</strong> videóit. Az átkapcsolás azonnal érvényes,
          újratelepítés nélkül. A már futó videókat nem érinti.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ENGINE_OPTIONS.map((o) => {
          const active = info?.effective === o.id;
          const disabled = !info || saving !== null || (o.id === "shotstack" && !info.shotstackReady);
          return (
            <button key={o.id} type="button" onClick={() => void choose(o.id)} disabled={disabled && !active}
              aria-pressed={active}
              className="rounded-xl p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                border: `2px solid ${active ? (o.id === "twinx" ? "#2e7d52" : "#b7791f") : "var(--twx-line)"}`,
                background: active ? (o.id === "twinx" ? "#eef7f1" : "#fdf3e2") : "#fff",
              }}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full"
                    style={{ border: `2px solid ${active ? (o.id === "twinx" ? "#2e7d52" : "#b7791f") : "var(--twx-line)"}` }}>
                    {active && <span className="h-2 w-2 rounded-full" style={{ background: o.id === "twinx" ? "#2e7d52" : "#b7791f" }} />}
                  </span>
                  {o.title}
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
                  style={{ background: o.id === "twinx" ? "#2e7d52" : "#b7791f", color: "#fff" }}>{o.badge}</span>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{o.text}</p>
              {active && (
                <p className="mt-2 text-xs font-semibold" style={{ color: o.id === "twinx" ? "#2e7d52" : "#8a5a12" }}>
                  {saving ? "Átkapcsolás…" : "● Most ez fut"}
                </p>
              )}
              {o.id === "shotstack" && info && !info.shotstackReady && (
                <p className="mt-2 text-xs" style={{ color: "#8a5a12" }}>Nincs beállítva SHOTSTACK_API_KEY — nem kapcsolható be.</p>
              )}
              {o.id === "shotstack" && info?.shotstackReady && (
                <p className="mt-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  Környezet: {info.shotstackEnv === "v1" ? "éles" : "teszt (vízjeles)"}
                </p>
              )}
            </button>
          );
        })}
      </div>
      {info && info.source !== "database" && (
        <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "#fdf3e2", color: "#8a5a12" }}>
          A kapcsoló még nincs az adatbázisban — futtasd az <code>20261005172806_app-settings.sql</code>-t a Supabase SQL Editorban,
          addig {info.source === "env" ? "a VIDEO_RENDERER beállítás" : "az alapértelmezés (saját motor)"} dönt.
        </p>
      )}
      {error && <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "#fdecea", color: "#a1302a" }}>{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// SABLONOK ELÉRHETŐSÉGE — „Elérhető mindenkinek" pipa sablononként (2026-10-20).
// Pipa nélkül a sablon NEM törlődik: a partnereknél nem jelenik meg és nem indítható (szerveroldalon is tiltva),
// az admin viszont látja „Rejtett" jelöléssel és tesztelheti a fenti szerkesztővel. Mentés gomb nincs — azonnal
// érvényes; a változás naplózva (ki, mikor). Telefonon is: nagy, könnyen eltalálható pipák.
// ---------------------------------------------------------------------------
type TemplateRow = { templateId: string; name: string; tagline: string; colors: string[]; enabled: boolean; updatedAt: string | null; updatedBy: string | null };
type LogRow = { templateId: string; name: string; enabled: boolean; at: string; by: string | null };
type AvailabilityInfo = { migrated: boolean; migration: string; templates: TemplateRow[]; log: LogRow[] };

const when = (iso: string) => new Date(iso).toLocaleString("hu-HU", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

function TemplateAvailability() {
  const [info, setInfo] = useState<AvailabilityInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/video-templates", { cache: "no-store" })
      .then((r) => r.json().then((d) => (r.ok ? setInfo(d as AvailabilityInfo) : setError(d.error))))
      .catch(() => setError("A sablonok állapota nem olvasható."));
  }, []);

  async function toggle(t: TemplateRow) {
    if (!info?.migrated || busy) return;
    const enabled = !t.enabled;
    setBusy(t.templateId); setError(null);
    // Azonnali visszajelzés a felületen; hiba esetén visszaáll.
    setInfo((cur) => cur && { ...cur, templates: cur.templates.map((x) => (x.templateId === t.templateId ? { ...x, enabled } : x)) });
    try {
      const r = await fetch("/api/admin/video-templates", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: t.templateId, enabled }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "A módosítás nem sikerült.");
      setInfo(d as AvailabilityInfo);
      showToast(`${t.name}: ${enabled ? "Elérhető" : "Elrejtve"}`, "success");
    } catch (e) {
      setInfo((cur) => cur && { ...cur, templates: cur.templates.map((x) => (x.templateId === t.templateId ? { ...x, enabled: t.enabled } : x)) });
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl p-5" style={card}>
      <div>
        <h2 className="text-base font-semibold">Sablonok elérhetősége</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Pipa = <strong>elérhető mindenkinek</strong>. Pipa nélkül a sablon rejtett: a partnerek nem látják és nem indíthatnak vele videót,
          de semmi nem törlődik, és te továbbra is tesztelheted a fenti szerkesztőben. Azonnal érvényes, a már futó videókat nem érinti.
        </p>
      </div>

      {!info && !error && <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>}

      {info && (
        <ul className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
          {info.templates.map((t, i) => (
            <li key={t.templateId} style={i ? { borderTop: "1px solid var(--twx-line)" } : undefined}>
              <label className={`flex min-h-[64px] items-center gap-4 px-4 py-3 ${info.migrated ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
                style={{ background: t.enabled ? "#fff" : "#faf6f0" }}
                title={info.migrated ? undefined : `Futtasd le a ${info.migration} migrációt`}>
                <input type="checkbox" checked={t.enabled} disabled={!info.migrated || busy !== null}
                  onChange={() => void toggle(t)}
                  aria-label={`${t.name} — elérhető mindenkinek`}
                  className="h-7 w-7 flex-none cursor-pointer disabled:cursor-not-allowed" style={{ accentColor: "#2e7d52" }} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{t.name}</span>
                    {t.enabled ? (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#eef7f1", color: "#2e7d52" }}>Elérhető</span>
                    ) : (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#fdecea", color: "#a1302a" }}>Rejtett</span>
                    )}
                    {busy === t.templateId && <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>Mentés…</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {t.colors.join(" · ") || t.tagline}
                  </span>
                  {t.updatedAt && (
                    <span className="mt-0.5 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                      Utoljára: {when(t.updatedAt)}{t.updatedBy ? ` · ${t.updatedBy}` : ""}
                    </span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {info && !info.migrated && (
        <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "#fdf3e2", color: "#8a5a12" }}>
          A kapcsoló még nincs az adatbázisban — futtasd a <code>{info.migration}</code>-t a Supabase SQL Editorban. Addig minden sablon elérhető.
        </p>
      )}

      {info && info.log.length > 0 && (
        <details className="rounded-xl px-4 py-2 text-xs" style={{ border: "1px solid var(--twx-line)" }}>
          <summary className="cursor-pointer py-1 font-semibold">Napló — ki és mikor kapcsolta</summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pb-1">
            {info.log.map((l, i) => (
              <li key={`${l.at}-${i}`} style={{ color: "var(--twx-ink-muted)" }}>
                {when(l.at)} — <strong style={{ color: "var(--twx-ink)" }}>{l.name}</strong> {l.enabled ? "bekapcsolva" : "elrejtve"}{l.by ? ` (${l.by})` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "#fdecea", color: "#a1302a" }}>{error}</p>}
    </section>
  );
}
