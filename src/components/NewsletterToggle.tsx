// NewsletterToggle — Beállítások: hírlevél ki / be (bármikor). Váltáskor a Brevo is azonnal frissül (/api/newsletter).
"use client";

import { useState } from "react";
import { showToast } from "@/components/Toast";

export default function NewsletterToggle({ initial, since, migrated }: { initial: boolean; since: string | null; migrated: boolean }) {
  const [on, setOn] = useState(initial);
  const [at, setAt] = useState(since);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setBusy(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", value: next, source: "settings" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Nem sikerült menteni.");
      setOn(next);
      setAt(new Date().toISOString());
      showToast(next ? "Feliratkoztál a hírlevélre." : "Leiratkoztál a hírlevélről.", "success");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="twx-card flex items-center gap-4 p-5">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">Hírlevél</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Kérek hírlevelet a TWINX újdonságairól és akcióiról.
          {on && at && <> Feliratkozva: {new Date(at).toLocaleDateString("hu-HU")}.</>}
        </p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="Hírlevél" onClick={() => void toggle()}
        disabled={busy || !migrated} title={migrated ? undefined : "Hamarosan elérhető"}
        className="relative h-7 w-12 flex-none rounded-full transition-colors disabled:opacity-50"
        style={{ background: on ? "#c4553a" : "#D9CFC3" }}>
        <span className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: on ? 24 : 4 }} />
      </button>
    </div>
  );
}
