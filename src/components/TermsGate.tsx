// TermsGate — belépés utáni elfogadó kártya (D74, 9. lépés): ha a felhasználó még nem fogadta el az AKTUÁLIS ÁSZF-et és
// Adatkezelési tájékoztatót (src/lib/legal.ts → LEGAL_VERSION). Fix méretű, mobilon is olvasható.
//   • „Elfogadom" → POST /api/legal/accept (szerveroldali mentés), az ablak nem jön vissza.
//   • „Később" → az ablak bezárul (oldalfrissítéskor / újrabelépéskor újra feljön); a meglévő anyagok elérhetők, de a
//     modulok NEM indíthatók (szerveroldalon is tiltva: credits.ts → reason "legal").
//   • „Kilépés" → kijelentkezés.
// Megjelenés (Márk kérése 2026-11-27): kis kártya a bal alsó sarokban, elsötétítés nélkül. Adminnak a „Később" helyett
// „Bezárás" (változatonként egyszer, localStorage), és a szöveg jelzi, hogy nem kötelező.
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

  const title = updated ? "Frissítettük az ÁSZF-et és az Adatkezelési tájékoztatót." : "Még egy lépés a használat előtt";

  // Kis kártya a bal alsó sarokban (Márk kérése 2026-11-27), a lebegő „Kapcsolat" gomb fölött; nincs elsötétítés.
  return (
    <div role={admin ? "status" : "dialog"} aria-label="ÁSZF és Adatkezelési tájékoztató elfogadása"
      className="fixed bottom-[212px] left-3 right-3 z-[90] rounded-2xl border border-b-line bg-b-bg p-4 text-b-ink shadow-b-lg md:bottom-[148px] md:right-auto md:w-[360px]">
      <p className="text-[15px] font-semibold leading-snug">{title}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-b-ink-2">
        {admin
          ? <>Adminként nem kötelező most elfogadnod (változat: {LEGAL_VERSION}). </>
          : updated
            ? <>A modulok további használatához kérjük, fogadd el őket. Addig a korábbi anyagaid elérhetők. </>
            : <>A modulok használatához kérjük, fogadd el őket. </>}
        <Links />
      </p>
      <p className="mt-1 h-4 text-xs text-[#b3261e]" role="alert">{error ?? ""}</p>
      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        {!admin && (
          <button type="button" onClick={() => void logout()} disabled={busy} className="mr-auto h-8 rounded-full px-2 text-xs font-semibold text-b-ink-3 hover:bg-b-surface">Kilépés</button>
        )}
        <button type="button" onClick={later} disabled={busy} className="h-8 rounded-full px-3 text-[13px] font-semibold text-b-ink-2 hover:bg-b-surface">
          {admin ? "Bezárás" : "Később"}
        </button>
        <button type="button" onClick={() => void accept()} disabled={busy} className="b-btn h-8 px-4 py-0 text-[13px]">{busy ? "…" : "Elfogadom"}</button>
      </div>
    </div>
  );
}
