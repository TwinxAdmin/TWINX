// (auth)/login — Belépés (wireframe).
// Sorrend: űrlap -> API route (/api/auth/login) -> Supabase signInWithPassword.
"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import GoogleButton from "@/components/GoogleButton";
import Wordmark from "@/components/Wordmark";

export default function LoginPage() {
  // A useSearchParams miatt Suspense kell (Next követelmény).
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Ha a fiók e-mail címe még nincs megerősítve, felajánljuk az újraküldést.
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // A megerősítő link lejárt vagy már fel volt használva (/auth/confirm).
    if (params.get("megerosites") === "hiba") {
      setNeedsConfirm(true);
      setServerError("A megerősítő link lejárt vagy már felhasználtad. Add meg az e-mail címed, és küldünk egy újat.");
    }
  }, [params]);

  /** Új megerősítő levél kérése — a válasz mindig azonos (adatvédelem). */
  async function resendConfirmation() {
    if (!email.trim()) {
      setServerError("Előbb add meg az e-mail címed.");
      return;
    }
    setResending(true);
    setServerError(null);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "A küldés nem sikerült.");
      setNotice(`Elküldtük a megerősítő levelet ide: ${email}. Nézd meg a Spam mappát is.`);
    } catch (e) {
      setServerError((e as Error).message);
    } finally {
      setResending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setNotice(null);
    setNeedsConfirm(false);

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
        if (data.needsConfirmation) setNeedsConfirm(true);
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
        <Link
          href="/"
          className="mb-6 block text-center font-display text-3xl font-semibold tracking-wide"
          style={{ color: "var(--twx-on-dark)" }}
        >
          <Wordmark />
        </Link>
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
          {notice && <p className="mt-3 text-sm" style={{ color: "#2f9e5f" }}>{notice}</p>}

          {/* Meg nem erősített cím: enélkül a partner „bennragadna” a fiókjában. */}
          {needsConfirm && (
            <button type="button" onClick={() => void resendConfirmation()} disabled={resending}
              className="mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-40"
              style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
              {resending ? "Küldés…" : "Új megerősítő levél kérése"}
            </button>
          )}

          <Link href="/register" className="mt-4 block text-sm underline" style={{ color: "var(--twx-coral)" }}>
            Nincs fiókod? Regisztráció
          </Link>
        </div>
      </div>
    </main>
  );
}
