// dashboard/real-estate/land — Telek értékbecslés.
// Sorrend: űrlap validáció -> API. Normál = szinkron; Magas = async job + polling.
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  LAND_FIELDS,
  EMPTY_LAND,
  LAND_LEVELS,
  validateLandInput,
  type LandInput,
  type LandLevel,
} from "@/lib/land";
import { toDownloadUrl } from "@/lib/files";

export default function LandPage() {
  const [values, setValues] = useState<LandInput>({ ...EMPTY_LAND });
  const [level, setLevel] = useState<LandLevel>("normal");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setViewerOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [viewerOpen]);

  // Polling leállítása unmountkor.
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function setField(key: keyof LandInput, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function startPolling(jobId: string) {
    setPolling(true);
    setMessage("A magas szintű kutatás folyamatban… ez néhány percig is eltarthat. Az oldalt nyitva hagyhatod.");
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/real-estate/land/status?job=${jobId}`);
        const data = await res.json();
        if (data.status === "done") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          setResultUrl(data.url);
          setMessage("Kész! A telek ellenőrzés elkészült.");
        } else if (data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPolling(false);
          setServerError(data.error ?? "A kutatás sikertelen. A kredit visszajár.");
          setMessage(null);
        }
      } catch {
        // átmeneti hiba — a következő polling újrapróbálja
      }
    }, 6000);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setMessage(null);
    setResultUrl(null);

    const result = validateLandInput(values);
    setErrors(result.errors);
    if (!result.valid) {
      setServerError("Tölts ki minden kötelező mezőt.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/real-estate/land", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, level }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Hiba történt a feldolgozás során.");
        return;
      }
      if (data.async && data.jobId) {
        startPolling(data.jobId); // magas szint
      } else {
        setResultUrl(data.url); // normál szint kész
        setMessage("Kész! A telek ellenőrzés elkészült.");
      }
    } catch {
      setServerError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || polling;

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-3xl font-semibold">Telek ellenőrzés</h1>
      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        A telek beépíthetőségéről készül tömör, 1 oldalas jelentés (HÉSZ + TAK alapján).
        Minden mező kötelező.
      </p>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LAND_FIELDS.map((field) => (
            <div key={field.key} className={field.fullWidth ? "sm:col-span-2" : ""}>
              <label htmlFor={field.key} className="block text-sm">
                {field.label}
                {field.required && <span className="text-red-600"> *</span>}
              </label>
              <input
                id={field.key}
                type="text"
                value={values[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="twx-input mt-1"
              />
              {errors[field.key] && (
                <p className="mt-1 text-xs text-red-600">{errors[field.key]}</p>
              )}
            </div>
          ))}
        </div>

        {/* Kutatási szint választó */}
        <div>
          <p className="mb-2 text-sm font-medium">Kutatási szint</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(Object.keys(LAND_LEVELS) as LandLevel[]).map((lvl) => {
              const cfg = LAND_LEVELS[lvl];
              const active = level === lvl;
              return (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setLevel(lvl)}
                  className="rounded-xl p-4 text-left transition-colors"
                  style={{
                    background: active ? "var(--twx-coral-soft)" : "var(--twx-cream-card)",
                    border: `1px solid ${active ? "var(--twx-coral)" : "var(--twx-line)"}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg font-medium">{cfg.label}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: "var(--twx-coral)", color: "#1c1005" }}
                    >
                      {cfg.credits} kredit
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {cfg.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <button type="submit" disabled={busy} className="twx-btn w-full">
          {loading
            ? "Indítás…"
            : polling
              ? "Kutatás folyamatban…"
              : `Telek ellenőrzés indítása (${LAND_LEVELS[level].credits} kredit)`}
        </button>
      </form>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {resultUrl && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setViewerOpen(true)} className="twx-btn">
            PDF megtekintése
          </button>
          <a
            href={toDownloadUrl(resultUrl)}
            className="rounded-full px-5 py-2.5 text-sm font-medium transition-colors"
            style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", color: "var(--twx-ink)" }}
          >
            Letöltés
          </a>
        </div>
      )}

      {/* PDF-nézegető modál (popup, nem külön lap) */}
      {viewerOpen && resultUrl && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "rgba(28,24,21,0.72)" }}
          onClick={() => setViewerOpen(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <h2 className="font-display text-lg font-semibold" style={{ color: "var(--twx-on-dark)" }}>
                Telek ellenőrzés
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={toDownloadUrl(resultUrl)}
                  className="rounded-full px-4 py-2 text-sm font-medium"
                  style={{ background: "var(--twx-coral)", color: "#1c1005" }}
                >
                  Letöltés
                </a>
                <a
                  href={resultUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full px-4 py-2 text-sm font-medium"
                  style={{ border: "1px solid rgba(255,255,255,0.35)", color: "var(--twx-on-dark)" }}
                >
                  Új lapon
                </a>
                <button
                  type="button"
                  onClick={() => setViewerOpen(false)}
                  aria-label="Bezárás"
                  className="rounded-full px-3 py-2 text-sm font-medium"
                  style={{ border: "1px solid rgba(255,255,255,0.35)", color: "var(--twx-on-dark)" }}
                >
                  ✕
                </button>
              </div>
            </div>
            <iframe
              src={`${resultUrl}#view=FitH&toolbar=1&navpanes=0`}
              title="Telek ellenőrzés PDF"
              className="w-full flex-1 rounded-xl bg-white"
            />
          </div>
        </div>
      )}
    </main>
  );
}
