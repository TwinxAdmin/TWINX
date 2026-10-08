// OfficeFallbackProvider — „Elfogyott az irodai kereted → folytatod a saját kreditedből?"
//
// EGY helyen oldja meg mind a 16 kreditet vonó modulra: a dashboardon a böngésző fetch-ét
// egyszer „becsomagolja". Ha egy /api/… kérés 402-vel és `code: "office_insufficient"`-tel tér
// vissza (lib/credit-response.ts), felugró ablakban megkérdezi a felhasználót:
//   • Igen → UGYANAZT a kérést újraküldi `x-twx-pay-from: wallet` fejléccel (csak erre az egy
//     műveletre a saját kreditből), és a modul az új választ kapja meg — mintha mi sem történt volna.
//   • Mégse → a modul az eredeti hibaüzenetet kapja.
// Kérdés nélkül soha nem vonunk a saját kreditből. Ha a saját kredit sem elég, feltöltést ajánl.
"use client";

import { useEffect, useState } from "react";
import { OfficeDialog } from "@/components/office/OfficeUi";

type Ask = { needed: number; wallet: number; resolve: (ok: boolean) => void };

let installed = false;
let askFn: ((needed: number, wallet: number) => Promise<boolean>) | null = null;

export default function OfficeFallbackProvider() {
  const [ask, setAsk] = useState<Ask | null>(null);

  useEffect(() => {
    askFn = (needed, wallet) => new Promise<boolean>((resolve) => setAsk({ needed, wallet, resolve }));
    if (installed || typeof window === "undefined") return;
    installed = true;

    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const sameOriginApi = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);
      // A Request objektum törzse csak egyszer olvasható — az esetleges újraküldéshez előre klónozzuk.
      const retryInput = input instanceof Request ? input.clone() : input;

      const res = await original(input, init);
      if (!sameOriginApi || res.status !== 402 || !askFn) return res;

      const data = await res.clone().json().catch(() => null) as { code?: string; needed?: number; wallet?: number } | null;
      if (data?.code !== "office_insufficient") return res;

      const ok = await askFn(data.needed ?? 0, data.wallet ?? 0);
      if (!ok) return res;

      const headers = new Headers(init?.headers ?? (retryInput instanceof Request ? retryInput.headers : undefined));
      headers.set("x-twx-pay-from", "wallet");
      return original(retryInput, { ...init, headers });
    };
  }, []);

  if (!ask) return null;

  const enough = ask.wallet >= ask.needed;
  const close = (ok: boolean) => { ask.resolve(ok); setAsk(null); };

  return (
    <OfficeDialog title="Elfogyott az irodai kereted" onClose={() => close(false)}>
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
          Ehhez a művelethez <strong style={{ color: "var(--twx-ink)" }}>{ask.needed} kredit</strong> kell, de az irodai
          keretedben már nincs ennyi.
          {enough
            ? " Folytathatod a saját kreditedből — csak erre az egy műveletre, utána újra az irodai keretből dolgozol."
            : " A saját kredited sem elég hozzá."}
        </p>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl px-3 py-2.5" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
            <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Szükséges</p>
            <p className="font-display text-lg font-semibold tabular-nums">{ask.needed} kredit</p>
          </div>
          <div className="rounded-xl px-3 py-2.5" style={{ background: "#fff", border: `1px solid ${enough ? "var(--twx-line)" : "#E9B4AD"}` }}>
            <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Saját kredited</p>
            <p className="font-display text-lg font-semibold tabular-nums" style={{ color: enough ? undefined : "#B3261E" }}>{ask.wallet} kredit</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end" style={{ borderColor: "var(--twx-line)" }}>
          <a href="/dashboard/iroda" className="twx-btn-outline text-center" onClick={() => close(false)}>Kredit kérése a vezetőtől</a>
          {enough ? (
            <button type="button" className="twx-btn" onClick={() => close(true)}>
              Folytatás saját kreditből ({ask.needed})
            </button>
          ) : (
            <button type="button" className="twx-btn" onClick={() => { close(false); window.dispatchEvent(new CustomEvent("open-pricing")); }}>
              Saját kredit feltöltése
            </button>
          )}
        </div>
      </div>
    </OfficeDialog>
  );
}
