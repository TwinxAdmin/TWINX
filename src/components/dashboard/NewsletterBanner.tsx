// NewsletterBanner — kis, bezárható sáv a Portálközpont tetején: „Szeretnél értesülni a TWINX újdonságairól?"
// Csak annak látszik, aki még nem kér hírlevelet és nem zárta be (a meglévő és a Google-lal regisztrált felhasználóknak).
// Nem lebeg semmi fölött: a lap része, fix magasságú; „Igen, kérem" → hírlevél be + Brevo „Hírlevél" lista; × → többé nem jön elő.
"use client";

import { useState } from "react";
import { showToast } from "@/components/Toast";

export default function NewsletterBanner() {
  const [state, setState] = useState<"open" | "busy" | "done" | "closed">("open");
  if (state === "closed") return null;

  async function post(body: object) {
    const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Nem sikerült menteni.");
  }

  async function yes() {
    setState("busy");
    try {
      await post({ action: "set", value: true, source: "portal" });
      setState("done");
      window.setTimeout(() => setState("closed"), 2500);
    } catch (e) {
      showToast((e as Error).message, "error");
      setState("open");
    }
  }

  function close() {
    setState("closed");
    void post({ action: "dismiss" }).catch(() => null);
  }

  return (
    <div role="region" aria-label="Hírlevél" className="flex min-h-[52px] items-center gap-3 rounded-2xl px-4 py-2"
      style={{ background: "#FFF3EC", border: "1px solid #F6CDBD" }}>
      <span aria-hidden className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: "#fde4d9", color: "#c4553a" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
      </span>
      <p className="min-w-0 flex-1 text-sm">
        {state === "done" ? "Köszönjük! Elsőként értesítünk az újdonságokról." : "Szeretnél értesülni a TWINX újdonságairól?"}
      </p>
      {state !== "done" && (
        <button type="button" onClick={() => void yes()} disabled={state === "busy"}
          className="h-9 flex-none rounded-full px-4 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "#c4553a" }}>
          {state === "busy" ? "Mentés…" : "Igen, kérem"}
        </button>
      )}
      <button type="button" onClick={close} aria-label="Bezárás" title="Bezárás"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-lg leading-none hover:bg-black/5" style={{ color: "var(--twx-ink-muted)" }}>
        ×
      </button>
    </div>
  );
}
