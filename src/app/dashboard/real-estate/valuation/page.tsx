// dashboard/real-estate/valuation — Ingatlan Értékbecslő (wireframe).
// Sorrend: űrlap validáció -> API route (/api/real-estate/valuation).
"use client";

import { useState, type FormEvent } from "react";
import { CONDITION_OPTIONS, validateValuationInput } from "@/lib/valuation";

export default function ValuationPage() {
  const [city, setCity] = useState("");
  const [squareMeters, setSquareMeters] = useState("");
  const [rooms, setRooms] = useState("");
  const [condition, setCondition] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setMessage(null);
    setResultUrl(null);
    setReport(null);

    const input = {
      city,
      squareMeters: Number(squareMeters),
      rooms: Number(rooms),
      condition,
    };

    // 1) Kliensoldali validáció
    const result = validateValuationInput(input);
    setErrors(result.errors);
    if (!result.valid) return;

    // 2) API bekötés
    setLoading(true);
    try {
      const res = await fetch("/api/real-estate/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Hiba történt a feldolgozás során.");
        return;
      }
      if (data.url) setResultUrl(data.url);
      if (data.report) setReport(data.report);
      setMessage(data.message ?? "Kész! Az értékbecslés elkészült.");
    } catch {
      setServerError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Ingatlan Értékbecslő</h1>
      <p className="text-sm text-gray-500">
        Töltsd ki az összes mezőt. Egy értékbecslés 1 kreditbe kerül (admin/sales díjmentes).
      </p>

      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor="city" className="block text-sm">
            Város / Kerület
          </label>
          <input
            id="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full border border-gray-300 p-2 text-sm"
            placeholder="pl. Budapest XIII. kerület"
          />
          {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
        </div>

        <div>
          <label htmlFor="squareMeters" className="block text-sm">
            Négyzetméter (m²)
          </label>
          <input
            id="squareMeters"
            type="number"
            value={squareMeters}
            onChange={(e) => setSquareMeters(e.target.value)}
            className="w-full border border-gray-300 p-2 text-sm"
            min={5}
            max={10000}
          />
          {errors.squareMeters && (
            <p className="mt-1 text-xs text-red-600">{errors.squareMeters}</p>
          )}
        </div>

        <div>
          <label htmlFor="rooms" className="block text-sm">
            Szobák száma
          </label>
          <input
            id="rooms"
            type="number"
            value={rooms}
            onChange={(e) => setRooms(e.target.value)}
            className="w-full border border-gray-300 p-2 text-sm"
            min={1}
            max={50}
            step="0.5"
          />
          {errors.rooms && <p className="mt-1 text-xs text-red-600">{errors.rooms}</p>}
        </div>

        <div>
          <label htmlFor="condition" className="block text-sm">
            Állapot
          </label>
          <select
            id="condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full border border-gray-300 p-2 text-sm"
          >
            <option value="">— Válassz —</option>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {errors.condition && (
            <p className="mt-1 text-xs text-red-600">{errors.condition}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full border border-gray-800 bg-gray-800 p-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Feldolgozás…" : "Értékbecslés indítása"}
        </button>
      </form>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {resultUrl && (
        <a
          href={resultUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block border border-gray-800 px-4 py-2 text-sm underline"
        >
          PDF letöltése
        </a>
      )}

      {report && (
        <div className="whitespace-pre-wrap border border-gray-200 p-4 text-sm">
          {report}
        </div>
      )}
    </main>
  );
}
