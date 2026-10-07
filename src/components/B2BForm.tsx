// B2B ajánlatkérő űrlap (landing). Validáció -> /api/b2b.
"use client";

import { useState, type FormEvent } from "react";
import { validateLeadInput, CALLBACK_PRESETS } from "@/lib/leads";
import { gaEvent } from "@/lib/analytics";

export default function B2BForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [callbackTime, setCallbackTime] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    const input = { name, email, company, phone, callbackTime, message };
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
      gaEvent("generate_lead", { form: "b2b_egyedi" });
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
        Köszönjük! Megkaptuk az igénylésed — hamarosan keresünk telefonon{callbackTime.trim() ? ` (${callbackTime.trim()})` : ""}.
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
          className="twx-input mt-1"
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
          className="twx-input mt-1"
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="b2b-phone" className="block text-sm">
          Telefonszám <span style={{ color: "var(--twx-coral)" }}>*</span>
        </label>
        <input
          id="b2b-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="pl. +36 30 123 4567"
          className="twx-input mt-1"
        />
        {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
      </div>

      <div>
        <label htmlFor="b2b-callback" className="block text-sm">
          Mikor kereshetünk? <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>(opcionális)</span>
        </label>
        {/* Gyors választás — egy kattintással kitölti; utána szabadon átírható. */}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {CALLBACK_PRESETS.map((p) => {
            const on = callbackTime === p;
            return (
              <button key={p} type="button" onClick={() => setCallbackTime(on ? "" : p)} aria-pressed={on}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium transition"
                style={on
                  ? { background: "var(--twx-coral)", color: "#1c1005", border: "1px solid var(--twx-coral)" }
                  : { background: "#fff", color: "var(--twx-ink-muted)", border: "1px solid var(--twx-line)" }}>
                {p}
              </button>
            );
          })}
        </div>
        <input
          id="b2b-callback"
          type="text"
          value={callbackTime}
          onChange={(e) => setCallbackTime(e.target.value)}
          placeholder="vagy írd be, pl. kedd vagy csütörtök 10 után"
          className="twx-input mt-1.5"
        />
        {errors.callbackTime && <p className="mt-1 text-xs text-red-600">{errors.callbackTime}</p>}
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
          className="twx-input mt-1"
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
          className="twx-input mt-1"
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
        {loading ? "Küldés…" : "Igénylés elküldése"}
      </button>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
    </form>
  );
}
