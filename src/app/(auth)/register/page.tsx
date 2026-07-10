// (auth)/register — Regisztráció (wireframe).
// Sorrend: űrlap validáció -> API route (/api/auth/register) -> Supabase Auth.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { validateAuthInput } from "@/lib/validation";
import GoogleButton from "@/components/GoogleButton";
import Wordmark from "@/components/Wordmark";

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
    <main className="flex min-h-screen items-center justify-center p-6 font-sans" style={{ background: "var(--twx-dark)" }}>
      <div className="w-full max-w-sm">
        <a
          href="/"
          className="mb-6 block text-center font-display text-3xl font-semibold tracking-wide"
          style={{ color: "var(--twx-on-dark)" }}
        >
          <Wordmark />
        </a>
        <div className="twx-card p-7">
          <h1 className="font-display text-2xl font-semibold">Regisztráció</h1>

          <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="twx-input mt-1"
                autoComplete="email"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm">Jelszó</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="twx-input mt-1"
                autoComplete="new-password"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            <button type="submit" disabled={loading} className="twx-btn w-full">
              {loading ? "Regisztráció…" : "Regisztráció"}
            </button>
          </form>

          {serverError && <p className="mt-3 text-sm text-red-600">{serverError}</p>}
          {message && <p className="mt-3 text-sm text-green-700">{message}</p>}

          <div className="my-5 flex items-center gap-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            <span className="h-px flex-1" style={{ background: "var(--twx-line)" }} />
            vagy
            <span className="h-px flex-1" style={{ background: "var(--twx-line)" }} />
          </div>

          <GoogleButton label="Regisztráció Google-fiókkal" />

          <a href="/login" className="mt-4 block text-sm underline" style={{ color: "var(--twx-coral)" }}>
            Van már fiókod? Belépés
          </a>
        </div>
      </div>
    </main>
  );
}
