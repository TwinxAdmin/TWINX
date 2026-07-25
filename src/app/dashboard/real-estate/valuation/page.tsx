// dashboard/real-estate/valuation — Ingatlan Értékbecslő (14 mezős, wireframe).
// A partner bevált eszköze alapján. Sorrend: űrlap validáció -> API.
"use client";
import ModuleIntro from "@/components/ModuleIntro";
import ComboField from "@/components/ComboField";

import { useEffect, useState, type FormEvent } from "react";
import {
  VALUATION_FIELDS,
  EMPTY_VALUATION,
  validateValuationInput,
  type ValuationInput,
} from "@/lib/valuation";
import { toDownloadUrl } from "@/lib/files";

export default function ValuationPage() {
  const [values, setValues] = useState<ValuationInput>({ ...EMPTY_VALUATION });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

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

  function setField(key: keyof ValuationInput, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setMessage(null);
    setResultUrl(null);
    setReport(null);

    const result = validateValuationInput(values);
    setErrors(result.errors);
    if (!result.valid) {
      setServerError("Tölts ki minden kötelező mezőt.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/real-estate/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Hiba történt a feldolgozás során.");
        return;
      }
      if (data.url) setResultUrl(data.url);
      if (data.report) setReport(data.report);
      setMessage("Kész! Az értékbecslés elkészült.");
    } catch {
      setServerError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <ModuleIntro
        eyebrow="Ingatlan · Elemzés"
        title="Ingatlan értékbecslés"
        subtitle="Adatalapú, védhető piaci ár percek alatt — a legfontosabb paraméterekből profi, ügyfélnek is átadható becslés. A csillagos (*) mezők kötelezők, egy becslés 1 kredit."
        icon="valuation"
        chips={["Adatalapú", "Percek alatt", "PDF-riport"]}
      />

      <form onSubmit={onSubmit} noValidate className="twx-card space-y-4 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VALUATION_FIELDS.map((field) => (
            <div
              key={field.key}
              className={field.fullWidth ? "sm:col-span-2" : ""}
            >
              <label htmlFor={field.key} className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
                {field.label}
                {field.required && <span style={{ color: "var(--twx-coral)" }}> *</span>}
              </label>
              {field.options ? (
                <ComboField
                  id={field.key}
                  className="mt-1 w-full"
                  value={values[field.key]}
                  onChange={(v) => setField(field.key, v)}
                  options={field.options}
                  placeholder={field.placeholder}
                />
              ) : (
                <input
                  id={field.key}
                  type="text"
                  value={values[field.key]}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="twx-input mt-1"
                />
              )}
              {errors[field.key] && (
                <p className="mt-1 text-xs text-red-600">{errors[field.key]}</p>
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="twx-btn w-full"
        >
          {loading ? "Feldolgozás… (akár 30-60 mp)" : "Ingatlan értékbecslés indítása"}
        </button>
        <p className="text-center text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Költség: <strong>1 kredit</strong> / értékbecslés.
        </p>
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

      {/* PDF-megtekintő ablak */}
      {viewerOpen && resultUrl && (
        <div
          onClick={() => setViewerOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(12,11,10,0.85)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}
          >
            <div className="flex items-center justify-between gap-3 p-3">
              <span className="pl-2 text-sm font-medium">Ingatlan értékbecslés</span>
              <div className="flex items-center gap-2">
                <a
                  href={toDownloadUrl(resultUrl)}
                  className="rounded-full px-4 py-1.5 text-sm font-medium"
                  style={{ background: "var(--twx-coral)", color: "#1c1005" }}
                >
                  Letöltés
                </a>
                <a
                  href={resultUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full px-4 py-1.5 text-sm font-medium"
                  style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream)", color: "var(--twx-ink)" }}
                >
                  Új lapon
                </a>
                <button
                  type="button"
                  onClick={() => setViewerOpen(false)}
                  aria-label="Bezárás"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                  style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}
                >
                  ×
                </button>
              </div>
            </div>
            <iframe src={`${resultUrl}#view=FitH&toolbar=1&navpanes=0`} title="Ingatlan értékbecslés" className="w-full flex-1 bg-white" />
          </div>
        </div>
      )}

      {report && (
        <div className="twx-card whitespace-pre-wrap p-4 text-sm">
          {report}
        </div>
      )}
    </main>
  );
}
