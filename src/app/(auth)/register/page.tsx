// (auth)/register — Regisztráció (wireframe).
// Sorrend: űrlap validáció -> API route (/api/auth/register) -> Supabase Auth.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { validateAuthInput } from "@/lib/validation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setMessage(null);

    // 1) Kliensoldali validáció
    const result = validateAuthInput({ email, password });
    setErrors(result.errors);
    if (!result.valid) return;

    // 2) API bekötés
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Hiba történt a regisztráció során.");
        return;
      }

      if (data.needsConfirmation) {
        setMessage(
          "Sikeres regisztráció! Erősítsd meg az e-mail címed a kiküldött linkkel."
        );
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setServerError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-8 font-sans">
      <div className="mx-auto max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Regisztráció</h1>

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
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email}</p>
            )}
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
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-gray-800 bg-gray-800 p-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? "Regisztráció…" : "Regisztráció"}
          </button>
        </form>

        {serverError && <p className="text-sm text-red-600">{serverError}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <a href="/login" className="block text-sm underline">
          Van már fiókod? Belépés
        </a>
      </div>
    </main>
  );
}
