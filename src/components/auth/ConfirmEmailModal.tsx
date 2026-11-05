// „Már csak egy lépés!” — felugró ablak e-mailes regisztráció után (signup), illetve meg nem erősített fiókkal való
// belépéskor (login). A megerősítő levél gyakran a Gmail Promóciók fülére kerül, ezért itt kap útmutatást és újraküldést.
// Csak az e-mail-címet kapja meg, jelszót nem. Az újraküldés a meglévő /api/auth/resend-confirmation végponton megy;
// a számláló szándékosan csak komponens-állapot (a Supabase saját korlátja frissítés után is véd).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { showToast } from "@/components/Toast";

/** A Supabase címenkénti küldési korlátjához igazodik. */
const COOLDOWN_MS = 60_000;
const MAX_RESENDS = 3;

type Props = {
  mode: "signup" | "login";
  email: string;
  /** Ment-e ki éppen levél az ablak megnyitásakor. Ha igen, a visszaszámláló azonnal indul (a Supabase úgysem küldene). */
  sent?: boolean;
  /** Az ajándék kreditek száma, ha ismert (landingről érkező regisztráció). */
  bonusCredits?: number;
  onClose: () => void;
  /** Csak regisztrációnál: vissza az űrlapra, a mezők kitöltve maradnak. */
  onWrongEmail?: () => void;
};

export default function ConfirmEmailModal({ mode, email, sent = true, bonusCredits, onClose, onWrongEmail }: Props) {
  const [letterSent, setLetterSent] = useState(sent);
  const [resends, setResends] = useState(0);
  const [busy, setBusy] = useState(false);
  const [until, setUntil] = useState(() => (sent ? Date.now() + COOLDOWN_MS : 0));
  const [now, setNow] = useState(() => Date.now());
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Időbélyeg alapú számláló: háttérbe tett lapon sem csúszik el.
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [until]);

  useEffect(() => { panel.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  const limitReached = resends >= MAX_RESENDS;

  function startCooldown() {
    const t = Date.now();
    setNow(t);
    setUntil(t + COOLDOWN_MS);
  }

  async function resend() {
    if (busy || remaining > 0 || limitReached) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        showToast("Kérlek, várj egy kicsit, és próbáld újra.", "info");
        startCooldown();
        return;
      }
      if (!res.ok) throw new Error();
      setResends((n) => n + 1);
      setLetterSent(true);
      startCooldown();
      showToast("Újra elküldtük a levelet.", "success");
    } catch {
      showToast("Most nem sikerült elküldeni. Kérlek, próbáld újra egy kicsit később.", "error");
    } finally {
      setBusy(false);
    }
  }

  const address = <strong style={{ color: "var(--twx-ink)", overflowWrap: "anywhere" }}>{email}</strong>;
  const steps = [
    "Nyisd meg a postafiókodat.",
    "Keresd a TWINX levelét, és kattints az „E-mail cím megerősítése” gombra.",
    bonusCredits
      ? `Utána be tudsz lépni, és már ott vár a ${bonusCredits} ajándék kredited.`
      : "Utána be tudsz lépni, és már ott várnak az ajándék kreditjeid.",
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(12,11,10,0.82)" }}
    >
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="max-h-[92vh] w-full max-w-[420px] overflow-y-auto rounded-2xl p-6 outline-none sm:p-7"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", color: "var(--twx-ink)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-2xl font-semibold leading-tight">
            {mode === "signup" ? "Már csak egy lépés!" : "Erősítsd meg a fiókodat"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Bezárás"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg"
            style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}
          >
            ×
          </button>
        </div>

        {mode === "signup" ? (
          <>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
              Küldtünk egy megerősítő levelet ide: {address}
            </p>
            <ol className="mt-4 space-y-2.5">
              {steps.map((text, i) => (
                <li key={text} className="flex gap-3 text-sm leading-snug">
                  <span
                    className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: "var(--twx-coral)", color: "#1c1005" }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{text}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex gap-2.5 rounded-xl p-3 text-sm leading-snug" style={{ background: "rgba(239,122,90,0.10)", border: "1px solid rgba(239,122,90,0.35)" }}>
              <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 flex-none" fill="none" stroke="var(--twx-coral)" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="12" r="9.5" />
                <path d="M12 11v5.5M12 7.5v.01" />
              </svg>
              <span><strong>Nem találod?</strong> Nézd meg a Promóciók vagy a Spam mappát is. Gmailben gyakran a Promóciók fülre kerül.</span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
            {letterSent ? (
              <>A fiókod még nincs megerősítve. Küldtünk egy levelet ide: {address}. Nézd meg a Promóciók mappát is.</>
            ) : (
              <>A fiókod még nincs megerősítve. Kérj új megerősítő levelet ide: {address}</>
            )}
          </p>
        )}

        {/* Mindkét állapot ugyanolyan magas, hogy az ablak ne ugorjon. */}
        <div className="mt-5 h-12">
          {limitReached ? (
            <p className="flex h-full items-center justify-center text-center text-[13px] leading-snug" style={{ color: "var(--twx-ink-muted)" }}>
              <span>
                Továbbra sem érkezik? Írj nekünk:{" "}
                <Link href="/kapcsolat" className="font-semibold underline" style={{ color: "var(--twx-ink)" }}>twinx.hu/kapcsolat</Link>
              </span>
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void resend()}
              disabled={busy || remaining > 0}
              className="twx-btn h-full w-full tabular-nums"
              style={{ fontSize: 15, fontWeight: 600 }}
            >
              {busy ? "Küldés…" : remaining > 0 ? `Újraküldés ${remaining} mp múlva` : "Levél újraküldése"}
            </button>
          )}
        </div>

        {mode === "signup" && onWrongEmail && (
          <button
            type="button"
            onClick={onWrongEmail}
            className="mt-3 block min-h-11 w-full text-center text-sm underline"
            style={{ color: "var(--twx-ink-muted)" }}
          >
            Rossz e-mail-címet adtam meg
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
