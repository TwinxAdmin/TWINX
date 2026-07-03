// (auth)/login — Belépés (wireframe).
// Sorrend: űrlap -> API route (/api/auth/login) -> Supabase signInWithPassword.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!email || !password) {
      setServerError("Add meg az e-mail címet és a jelszót.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error ?? "Hiba történt a belépés során.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setServerError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-8 font-sans">
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Belépés</h1>

        <form onSubmit={onSubmit} noValidate className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-sm">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 p-2 text-sm"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm">
              Jelszó
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 p-2 text-sm"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-gray-800 bg-gray-800 p-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "Belépés…" : "Belépés"}
          </button>
        </form>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}

        <a href="/register" className="block text-sm underline">
          Nincs fiókod? Regisztráció
        </a>
      </div>
    </main>
  );
}
