// (auth)/login — Belépés (wireframe).
// Sorrend: űrlap -> API route (/api/auth/login) -> Supabase signInWithPassword.
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import GoogleButton from "@/components/GoogleButton";
import Wordmark from "@/components/Wordmark";

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
          <h1 className="font-display text-2xl font-semibold">Belépés</h1>

          <div className="mt-5">
            <GoogleButton label="Belépés Google-fiókkal" />
          </div>

          <div className="my-5 flex items-center gap-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            <span className="h-px flex-1" style={{ background: "var(--twx-line)" }} />
            vagy e-maillel
            <span className="h-px flex-1" style={{ background: "var(--twx-line)" }} />
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
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
            </div>

            <div>
              <label htmlFor="password" className="block text-sm">Jelszó</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="twx-input mt-1"
                autoComplete="current-password"
              />
            </div>

            <button type="submit" disabled={loading} className="twx-btn w-full">
              {loading ? "Belépés…" : "Belépés"}
            </button>
          </form>

          {serverError && <p className="mt-3 text-sm text-red-600">{serverError}</p>}

          <a href="/register" className="mt-4 block text-sm underline" style={{ color: "var(--twx-coral)" }}>
            Nincs fiókod? Regisztráció
          </a>
        </div>
      </div>
    </main>
  );
}
