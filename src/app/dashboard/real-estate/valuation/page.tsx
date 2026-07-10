// dashboard/real-estate/valuation — Ingatlan Értékbecslő (14 mezős, wireframe).
// A partner bevált eszköze alapján. Sorrend: űrlap validáció -> API.
"use client";

import { useState, type FormEvent } from "react";
import {
  VALUATION_FIELDS,
  EMPTY_VALUATION,
  validateValuationInput,
  type ValuationInput,
} from "@/lib/valuation";

export default function ValuationPage() {
  const [values, setValues] = useState<ValuationInput>({ ...EMPTY_VALUATION });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      <h1 className="font-display text-3xl font-semibold">Ingatlan értékbecslés</h1>
      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Válaszd a listából a leggyakoribb értékeket, vagy írj be sajátot. A csillagos
        (*) mezők kötelezők. Egy értékbecslés 1 kredit (admin/sales díjmentes).
      </p>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VALUATION_FIELDS.map((field) => {
            const listId = field.options ? `dl-${field.key}` : undefined;
            return (
              <div
                key={field.key}
                className={field.fullWidth ? "sm:col-span-2" : ""}
              >
                <label htmlFor={field.key} className="block text-sm">
                  {field.label}
                  {field.required && <span className="text-red-600"> *</span>}
                </label>
                <input
                  id={field.key}
                  type="text"
                  list={listId}
                  value={values[field.key]}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="twx-input mt-1"
                />
                {field.options && (
                  <datalist id={listId}>
                    {field.options.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                )}
                {errors[field.key] && (
                  <p className="mt-1 text-xs text-red-600">{errors[field.key]}</p>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="twx-btn w-full"
        >
          {loading ? "Feldolgozás… (akár 30-60 mp)" : "Ingatlan értékbecslés indítása"}
        </button>
      </form>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {resultUrl && (
        <a
          href={resultUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block px-4 py-2 text-sm underline"
          style={{ color: "var(--twx-coral)" }}
        >
          PDF letöltése
        </a>
      )}

      {report && (
        <div className="twx-card whitespace-pre-wrap p-4 text-sm">
          {report}
        </div>
      )}
    </main>
  );
}
