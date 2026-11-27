// TermsGate — belépés utáni elfogadó ablak (D74, 9. lépés): ha a felhasználó még nem fogadta el az AKTUÁLIS ÁSZF-et és
// Adatkezelési tájékoztatót (src/lib/legal.ts → LEGAL_VERSION). Fix méretű, mobilon is olvasható.
//   • „Elfogadom" → POST /api/legal/accept (szerveroldali mentés), az ablak nem jön vissza.
//   • „Később" → az ablak bezárul (oldalfrissítéskor / újrabelépéskor újra feljön); a meglévő anyagok elérhetők, de a
//     modulok NEM indíthatók (szerveroldalon is tiltva: credits.ts → reason "legal").
//   • „Kilépés" → kijelentkezés.
// Adminnak (role = admin) nem akadályozó ablak, hanem egyszeri, bezárható jelzés a képernyő alján.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEGAL_VERSION } from "@/lib/legal";

const ADMIN_KEY = `twx-legal-admin-dismissed-${LEGAL_VERSION}`;

function Links() {
  return (
    <>
      <a href="/aszf" target="_blank" rel="noopener" className="font-semibold text-b-accent-ink underline underline-offset-2">Általános Szerződési Feltételek</a>
      {" · "}
      <a href="/adatkezeles" target="_blank" rel="noopener" className="font-semibold text-b-accent-ink underline underline-offset-2">Adatkezelési tájékoztató</a>
    </>
  );
}

export default function TermsGate({ updated, admin = false }: { updated: boolean; admin?: boolean }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(admin); // admin: a tárolt döntés betöltéséig rejtve (nincs villanás)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    try { setHidden(window.localStorage.getItem(ADMIN_KEY) === "1"); } catch { setHidden(false); }
  }, [admin]);

  async function accept() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/legal/accept", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Nem sikerült menteni. Próbáld újra."); return; }
      setHidden(true);
      router.refresh();
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally { setBusy(false); }
  }
  function later() {
    if (admin) { try { window.localStorage.setItem(ADMIN_KEY, "1"); } catch { /* nincs tároló */ } }
    setHidden(true);
  }
  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/";
  }

  if (hidden) return null;

  const title = updated ? "Frissítettük az Általános Szerződési Feltételeket és az Adatkezelési tájékoztatót." : "Még egy lépés a használat előtt";

  if (admin) {
    return (
      <div role="status" className="fixed bottom-4 left-1/2 z-[90] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-b-line bg-b-card p-4 text-b-ink shadow-b-lg">
        <p className="text-[15px] font-semibold">{title}</p>
        <p className="mt-1 text-sm text-b-ink-2">Adminként nem kötelező most elfogadnod (változat: {LEGAL_VERSION}). <Links /></p>
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className="mr-auto h-4 text-xs text-[#b3261e]">{error ?? ""}</span>
          <button type="button" onClick={later} className="h-9 rounded-full px-4 text-sm font-semibold text-b-ink-2 hover:bg-b-surface">Bezárás</button>
          <button type="button" onClick={() => void accept()} disabled={busy} className="b-btn h-9 px-4 py-0 text-sm">{busy ? "…" : "Elfogadom"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.72)" }}
      role="dialog" aria-modal="true" aria-label="ÁSZF és Adatkezelési tájékoztató elfogadása">
      <div className="flex w-full max-w-[480px] flex-col rounded-[22px] border border-b-line bg-b-bg p-6 text-b-ink shadow-b-lg sm:p-7">
        <h2 className="font-display text-[21px] font-bold leading-snug">{title}</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-b-ink-2">
          {updated
            ? "A TWINX működése megváltozott (cégre szabott egyedi modulok, ingyenes felmérés), ezért új feltételek és új tájékoztató lépett életbe. Kérjük, olvasd el, és fogadd el őket a modulok további használatához."
            : "A TWINX használatához kérjük, olvasd el az Általános Szerződési Feltételeket és az Adatkezelési tájékoztatót, és fogadd el őket."}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed"><Links /></p>
        <p className="mt-3 text-sm text-b-ink-3">Amíg nem fogadod el, a korábbi anyagaid elérhetők, de új modult nem indíthatsz.</p>
        <p className="mt-2 h-5 text-sm text-[#b3261e]" role="alert">{error ?? ""}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => void logout()} disabled={busy} className="h-10 rounded-full px-3 text-sm font-semibold text-b-ink-3 hover:bg-b-surface">Kilépés</button>
          <div className="flex gap-2">
            <button type="button" onClick={later} disabled={busy} className="h-10 rounded-full px-4 text-sm font-semibold text-b-ink-2 ring-1 ring-b-line hover:bg-b-surface">Később</button>
            <button type="button" onClick={() => void accept()} disabled={busy} className="b-btn h-10 px-6 py-0 text-[15px]">{busy ? "Egy pillanat…" : "Elfogadom"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
