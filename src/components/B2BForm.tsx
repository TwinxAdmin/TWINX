// B2B ajánlatkérő űrlap (landing). Validáció -> /api/b2b.
"use client";

import { useState, type FormEvent } from "react";
import { validateLeadInput } from "@/lib/leads";

export default function B2BForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    const input = { name, email, company, message };
    const result = validateLeadInput(input);
    setErrors(result.errors);
    if (!result.valid) return;

    setLoading(true);
    try {
      const res = await fetch("/api/b2b", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Hiba történt a küldés során.");
        return;
      }
      setDone(true);
    } catch {
      setServerError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-green-700">
        Köszönjük! Megkaptuk az ajánlatkérésed, hamarosan keresünk.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      <div>
        <label htmlFor="b2b-name" className="block text-sm">
          Név
        </label>
        <input
          id="b2b-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 p-2 text-sm"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="b2b-email" className="block text-sm">
          E-mail
        </label>
        <input
          id="b2b-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 p-2 text-sm"
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="b2b-company" className="block text-sm">
          Cég (opcionális)
        </label>
        <input
          id="b2b-company"
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="w-full border border-gray-300 p-2 text-sm"
        />
        {errors.company && <p className="mt-1 text-xs text-red-600">{errors.company}</p>}
      </div>

      <div>
        <label htmlFor="b2b-message" className="block text-sm">
          Igény leírása
        </label>
        <textarea
          id="b2b-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 p-2 text-sm"
          placeholder="Mondd el, milyen egyedi modulra / megoldásra van szükségetek."
        />
        {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-full px-6 py-2.5 text-sm font-medium disabled:opacity-50"
        style={{ background: "var(--twx-coral)", color: "#1c1005" }}
      >
        {loading ? "Küldés…" : "Ajánlatkérés küldése"}
      </button>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
    </form>
  );
}
