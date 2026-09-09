// (auth)/register — Regisztráció (wireframe).
// Sorrend: űrlap validáció -> API route (/api/auth/register) -> Supabase Auth.
"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { validateRegisterInput } from "@/lib/validation";
import GoogleButton from "@/components/GoogleButton";
import Wordmark from "@/components/Wordmark";
import { normalizeInviteCode } from "@/lib/invites";

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
  // Ajándékkód: itt SZÁNDÉKOSAN nem kérjük be. A beváltás a belépés utáni
  // kezdőlapon, az egyenleg mellett történik — így a Google-fiókkal belépőknek
  // és az e-mail-megerősítéses regisztrálóknak is ugyanaz az útja.
  // A levélbeli linkből (?kod=...) csak emlékeztetőt mutatunk.
  const [linkCode, setLinkCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Sikerképernyő: „session” = azonnal beléptetve (jelszavas vagy Google),
  // „confirm” = előbb meg kell erősíteni az e-mail címet.
  const [done, setDone] = useState<null | "session" | "confirm">(null);

  useEffect(() => {
    const fromLink = params.get("kod") ?? params.get("kód") ?? "";
    if (fromLink) setLinkCode(normalizeInviteCode(fromLink));
    // A Google-fiókos ág innen tér vissza (?siker=1), így ott is látszik
    // a visszajelzés — nem esik be szó nélkül a kezdőlapra.
    if (params.get("siker")) setDone("session");
  }, [params]);

  /** „Bezárás”: ha az ablakot a rendszer nyitotta, tényleg becsukjuk;
   *  ha nem (rendes böngészőfül), a nyitóoldalra lépünk vissza. */
  function closeWindow() {
    window.close();
    setTimeout(() => { if (!window.closed) window.location.href = "/"; }, 150);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

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

      // Mindkét ág a sikerképernyőre visz — a felhasználó maga dönti el,
      // belép-e most, vagy bezárja az ablakot.
      setDone(data.needsConfirmation ? "confirm" : "session");
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
        {/* ---------------- SIKERKÉPERNYŐ ----------------
            Jelszavas és Google-fiókos regisztráció után is ugyanez fogadja a
            felhasználót: látja, hogy sikerült, és ő dönti el, belép-e most,
            vagy bezárja az ablakot. */}
        {done ? (
          <div className="twx-card p-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "rgba(47,158,95,0.14)", color: "#2f9e5f", fontSize: 28 }} aria-hidden>
              ✓
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold">Sikeres regisztráció!</h1>

            {done === "confirm" ? (
              <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Küldtünk egy megerősítő levelet a <strong>{email}</strong> címre.
                Kattints benne a linkre, utána be tudsz lépni a TWINX-be.
              </p>
            ) : (
              <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                A fiókod elkészült, és be is vagy jelentkezve. Bármikor visszatérhetsz
                ide a belépéssel.
              </p>
            )}

            {linkCode && (
              <div className="mt-4 rounded-xl p-3 text-left text-sm"
                style={{ background: "rgba(239,122,90,0.10)", border: "1px solid rgba(239,122,90,0.35)" }}>
                <p className="font-semibold">Ajándékkódod: <span className="tracking-wider">{linkCode}</span></p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  A kezdőlapon, az egyenleged mellett találod az „Ajándékkód beváltása” gombot.
                </p>
              </div>
            )}

            <div className="mt-6 space-y-2">
              {done === "session" && (
                <button type="button" className="twx-btn w-full"
                  onClick={() => { router.push("/dashboard"); router.refresh(); }}>
                  Belépek a TWINX-be
                </button>
              )}
              <button type="button" onClick={closeWindow}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium"
                style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                Ablak bezárása
              </button>
            </div>
          </div>
        ) : (
        <div className="twx-card p-7">
          <h1 className="font-display text-2xl font-semibold">Regisztráció</h1>

          {/* Aki a kódos levélből érkezett: itt még nincs teendője a kóddal,
              csak jelezzük, hol lesz. A beváltás belépés után, a kezdőlapon van. */}
          {linkCode && (
            <div className="mt-4 rounded-xl p-3 text-sm"
              style={{ background: "rgba(239,122,90,0.10)", border: "1px solid rgba(239,122,90,0.35)" }}>
              <p className="font-semibold">Ajándékkódod: <span className="tracking-wider">{linkCode}</span></p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                Először regisztrálj — belépés után a kezdőlapon, az egyenleged mellett tudod beváltani.
              </p>
            </div>
          )}

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

          <div className="my-5 flex items-center gap-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            <span className="h-px flex-1" style={{ background: "var(--twx-line)" }} />
            vagy
            <span className="h-px flex-1" style={{ background: "var(--twx-line)" }} />
          </div>

          {/* A Google után is ide térünk vissza (?siker=1), hogy a visszajelzés
              azonos legyen a jelszavas úttal. A kód-emlékeztetőt is visszük. */}
          <GoogleButton
            label="Regisztráció Google-fiókkal"
            next={`/register?siker=1${linkCode ? `&kod=${encodeURIComponent(linkCode)}` : ""}`}
          />

          <Link href="/login" className="mt-4 block text-sm underline" style={{ color: "var(--twx-coral)" }}>
            Van már fiókod? Belépés
          </Link>
        </div>
        )}
      </div>
    </main>
  );
}
