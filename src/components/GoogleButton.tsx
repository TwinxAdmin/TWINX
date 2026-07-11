// Google „egy kattintásos" belépés/regisztráció (Supabase OAuth).
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function GoogleButton({ label = "Folytatás Google-lel" }: { label?: string }) {
  const [loading, setLoading] = useState(false);

  // A Google-belépés csak akkor jelenik meg, ha be van kapcsolva (env flag) ÉS
  // a Supabase-ben be van állítva a Google provider. Alapból rejtve, hogy senki ne
  // fusson a hibába. Bekapcsolás: NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true + redeploy.
  if (process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH !== "true") {
    return null;
  }

  async function onClick() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setLoading(false); // sikeres esetben átirányít a Google-re
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
      style={{ border: "1px solid var(--twx-line)", background: "#ffffff", color: "#1c1815" }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
      {loading ? "Átirányítás…" : label}
    </button>
  );
}
