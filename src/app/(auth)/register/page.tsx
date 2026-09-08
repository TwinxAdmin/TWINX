// (auth)/register — Regisztráció (wireframe).
// Sorrend: űrlap validáció -> API route (/api/auth/register) -> Supabase Auth.
"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { validateRegisterInput } from "@/lib/validation";
import GoogleButton from "@/components/GoogleButton";
import Wordmark from "@/components/Wordmark";
import { normalizeInviteCode } from "@/lib/invites";

/** A kód beváltása a friss fiókra. Hiba esetén nem blokkoljuk a belépést —
 *  a kezdőlapon később is beváltható. */
async function redeemInvite(code: string): Promise<void> {
  try {
    await fetch("/api/invite/redeem", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: normalizeInviteCode(code) }),
    });
  } catch { /* a kezdőlapon újrapróbálható */ }
}

export default function RegisterPage() {
  // A useSearchParams miatt Suspense-be kell tenni (Next követelmény).
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  // Ingatlanos ajándékkód — a levélbeli link (?kod=...) automatikusan kitölti.
  const [inviteCode, setInviteCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fromLink = params.get("kod") ?? params.get("kód") ?? "";
    if (fromLink) setInviteCode(normalizeInviteCode(fromLink));
  }, [params]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setMessage(null);

    // 1) Kliensoldali validáció
    const result = validateRegisterInput({ name, email, password, passwordConfirm });
    setErrors(result.errors);
    if (!result.valid) return;

    // 2) API bekötés
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, email, password, passwordConfirm }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Hiba történt a regisztráció során.");
        return;
      }

      if (data.needsConfirmation) {
        setMessage(
          inviteCode.trim()
            ? "Sikeres regisztráció! Erősítsd meg az e-mail címed a kiküldött linkkel — utána a kezdőlapon váltsd be az ajándékkódot."
            : "Sikeres regisztráció! Erősítsd meg az e-mail címed a kiküldött linkkel."
        );
      } else {
        // Van session → azonnal beváltjuk az ajándékkódot, ha adott meg ilyet.
        if (inviteCode.trim()) await redeemInvite(inviteCode);
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
              <label htmlFor="name" className="block text-sm">Teljes név</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="twx-input mt-1"
                autoComplete="name"
                placeholder="pl. Nagy Anna"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label htmlFor="company" className="block text-sm">
                Cég, ahol dolgozol <span style={{ color: "var(--twx-ink-muted)" }}>(nem kötelező)</span>
              </label>
              <input
                id="company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="twx-input mt-1"
                autoComplete="organization"
                placeholder="pl. Prémium Ingatlanok Kft."
              />
            </div>

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

            <div>
              <label htmlFor="inviteCode" className="block text-sm">
                Ajándékkód <span style={{ color: "var(--twx-ink-muted)" }}>(ha kaptál)</span>
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                onBlur={() => setInviteCode((c) => (c.trim() ? normalizeInviteCode(c) : c))}
                className="twx-input mt-1"
                placeholder="TWX-XXXX-XXXX"
                autoComplete="off"
              />
              <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                Az ingatlanos ajándékkóddal a fiókod 10 kredittel indul.
              </p>
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm">Jelszó megerősítése</label>
              <input
                id="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="twx-input mt-1"
                autoComplete="new-password"
              />
              {errors.passwordConfirm && (
                <p className="mt-1 text-xs text-red-600">{errors.passwordConfirm}</p>
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
