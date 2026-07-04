// Admin kézi kredit-adás egy felhasználónak (e-mail alapján) -> /api/admin/credits.
"use client";

import { useState, type FormEvent } from "react";

export default function AdminCreditForm() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const amt = parseInt(amount, 10);
    if (!email.trim() || !Number.isInteger(amt) || amt <= 0) {
      setError("Add meg az e-mailt és egy pozitív kredit számot.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hiba a jóváírás során.");
        return;
      }
      setMessage(`${amt} kredit jóváírva: ${email.trim()}`);
      setEmail("");
      setAmount("");
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="credit-email" className="block text-sm">
            Felhasználó e-mailje
          </label>
          <input
            id="credit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 p-2 text-sm"
            placeholder="pl. partner@ceg.hu"
          />
        </div>
        <div>
          <label htmlFor="credit-amount" className="block text-sm">
            Kredit mennyiség
          </label>
          <input
            id="credit-amount"
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-300 p-2 text-sm"
            placeholder="pl. 10"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="border border-gray-800 bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? "Jóváírás…" : "Kredit jóváírása (Ingatlan modul)"}
      </button>
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
