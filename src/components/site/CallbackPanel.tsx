// Időpont-egyeztetés (D73, 8. lépés) a foglaló űrlap helyén. Fő út (Márk kérése 2026-11-27): „Időpontot foglalok" gomb →
// ablak naptárral (három hétköznap + délelőtt/délután) és adatokkal → köszönő képernyő. A kollégáink visszahívnak, és a
// hívásban egyeztetjük a bővebb, bemutató beszélgetés idejét (személyesen vagy online); utána jöhet a részletes felmérés.
// Másik út: az e-mail-cím szövegként + „Másolás” gomb (levelezőt nem nyit, sablon nincs — Márk kérése). Telefonszámot nem teszünk ki.
// A „Másolás" gomb: vágólapra (navigator.clipboard), siker / hiba visszajelzés fix méretű helyen (nem ugrik).
"use client";

import { useState } from "react";
import { CALLBACK_EMAIL } from "@/lib/booking-mode";
import CallbackRequestModal from "@/components/site/CallbackRequestModal";

export default function CallbackPanel({ prefill }: { prefill?: { name?: string; email?: string } }) {
  const [modal, setModal] = useState(0); // 0 = zárva; minden nyitás új példány (tiszta űrlap)
  const [copy, setCopy] = useState<"idle" | "ok" | "fail">("idle");
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(CALLBACK_EMAIL);
      setCopy("ok");
    } catch {
      setCopy("fail");
    }
    window.setTimeout(() => setCopy("idle"), 2400);
  };

  return (
    <div className="relative flex min-h-[360px] flex-col rounded-3xl border border-b-line bg-b-card p-6 text-b-ink sm:p-8">
      <h3 className="font-display text-lg font-semibold">Visszahívás kérése</h3>
      <p className="mt-2 text-sm leading-relaxed text-b-ink-2">
        Válassz három neked alkalmas hétköznapot (délelőtt vagy délután), és a kollégáink felhívnak egy rövid egyeztetésre.
      </p>
      <button type="button" onClick={() => setModal((n) => n + 1)} className="b-btn b-pulse mt-5 w-full">
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        Időpontot foglalok
      </button>

      <p className="mt-6 text-[12px] font-semibold uppercase tracking-[1px] text-b-ink-3">Vagy írj nekünk</p>
      {/* E-mail: a cím szövegként + Másolás */}
      <div className="mt-2 flex flex-wrap items-stretch gap-2.5">
        {/* Csak a cím látszik (kijelölhető szövegként) — nem nyit levelezőt, mert nem mindenhol működik (Márk kérése). */}
        <div className="flex min-h-[54px] min-w-0 flex-1 select-all items-center gap-3 rounded-2xl border border-b-line bg-b-surface-2 px-4 text-b-ink">
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
            <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
          </svg>
          <span className="min-w-0 truncate text-[16px] font-bold">{CALLBACK_EMAIL}</span>
        </div>
        <button type="button" onClick={doCopy}
          className="min-h-[54px] w-[104px] flex-none rounded-2xl border border-b-line bg-b-surface-2 text-sm font-semibold text-b-ink transition-colors hover:bg-b-surface">
          Másolás
        </button>
      </div>
      {/* visszajelzés fix magasságú helyen */}
      <p className="mt-2 h-5 text-sm font-medium text-b-ink-2" role="status" aria-live="polite">
        {copy === "ok" ? "Kimásolva." : copy === "fail" ? "Jelöld ki és másold." : ""}
      </p>

      <div className="mt-auto rounded-2xl bg-b-surface-2 p-4 text-sm leading-relaxed text-b-ink-2">
        <p className="font-semibold text-b-ink">Mi történik ezután?</p>
        <p className="mt-1">A megadott napok egyikén felhívunk, és megbeszéljük, mikor tartsunk egy személyes vagy online beszélgetést, ahol bővebben bemutatjuk az egyedi modult. Ha tetszik, ezután jön a részletes felmérés. Ingyenes, és nem kötelez semmire.</p>
      </div>
      {modal > 0 && <CallbackRequestModal key={modal} open onClose={() => setModal(0)} prefill={prefill} />}
    </div>
  );
}
