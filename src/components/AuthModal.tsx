// Belépés / Regisztráció modális ablakban (a landing page-en nyílik, nem külön oldalon).
// Egy példány kell belőle a landingen; az `open-auth` window-eseményre nyílik.
// Esemény: window.dispatchEvent(new CustomEvent("open-auth", { detail: { mode: "login" | "register" } }))
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { validateRegisterInput } from "@/lib/validation";
import GoogleButton from "@/components/GoogleButton";

type Mode = "login" | "register";

export default function AuthModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<Mode>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setErrors({});
    setServerError(null);
    setMessage(null);
    setLoading(false);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setOpen(false), 180);
  }, []);

  // Nyitás esemény + billentyűk
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mode?: Mode } | undefined;
      setMode(detail?.mode ?? "login");
      reset();
      setName("");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      setOpen(true);
    };
    window.addEventListener("open-auth", onOpen);
    return () => window.removeEventListener("open-auth", onOpen);
  }, [reset]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setMessage(null);

    if (mode === "register") {
      const result = validateRegisterInput({ name, email, password, passwordConfirm });
      setErrors(result.errors);
      if (!result.valid) return;
    } else if (!email || !password) {
      setServerError("Add meg az e-mail címet és a jelszót.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          mode === "login"
            ? JSON.stringify({ email, password })
            : JSON.stringify({ name, email, password, passwordConfirm }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Hiba történt.");
        return;
      }

      if (mode === "register" && data.needsConfirmation) {
        setMessage("Sikeres regisztráció! Erősítsd meg az e-mail címed a kiküldött linkkel.");
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

  if (!open) return null;

  const isLogin = mode === "login";

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200"
      style={{ background: "rgba(12,11,10,0.82)", opacity: visible ? 1 : 0 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-7 transition-all duration-200"
        style={{
          background: "var(--twx-cream-card)",
          border: "1px solid var(--twx-line)",
          color: "var(--twx-ink)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.94)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">
            {isLogin ? "Belépés" : "Regisztráció"}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Bezárás"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
            style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm">Teljes név</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="twx-input mt-1"
                autoComplete="name"
                placeholder="pl. Nagy Anna"
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="twx-input mt-1"
              autoComplete="email"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm">Jelszó</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="twx-input mt-1"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm">Jelszó megerősítése</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className="twx-input mt-1"
                autoComplete="new-password"
              />
              {errors.passwordConfirm && <p className="mt-1 text-xs text-red-600">{errors.passwordConfirm}</p>}
            </div>
          )}

          <button type="submit" disabled={loading} className="twx-btn w-full">
            {loading ? "Egy pillanat…" : isLogin ? "Belépés" : "Regisztráció"}
          </button>
        </form>

        {serverError && <p className="mt-3 text-sm text-red-600">{serverError}</p>}
        {message && <p className="mt-3 text-sm text-green-700">{message}</p>}

        <div className="my-5 flex items-center gap-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          <span className="h-px flex-1" style={{ background: "var(--twx-line)" }} />
          vagy
          <span className="h-px flex-1" style={{ background: "var(--twx-line)" }} />
        </div>

        <GoogleButton label={isLogin ? "Belépés Google-fiókkal" : "Regisztráció Google-fiókkal"} />

        <button
          type="button"
          onClick={() => {
            setMode(isLogin ? "register" : "login");
            reset();
          }}
          className="mt-4 block w-full text-center text-sm underline"
          style={{ color: "var(--twx-coral)" }}
        >
          {isLogin ? "Nincs még fiókod? Regisztráció" : "Van már fiókod? Belépés"}
        </button>
      </div>
    </div>
  );
}
