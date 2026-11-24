// A „Lemondom" gomb a lemondási oldalon — POST-tal mond le (a link megnyitása önmagában nem).
// B arculat: fehér gomb a korall „selyem" kártyán (mint a foglalási sávban).
"use client";

import { useState } from "react";

export default function CancelBookingClient({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function cancel() {
    setState("busy");
    try {
      const r = await fetch("/api/bookings/cancel", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { setState("done"); return; }
      setMsg(d.error ?? "Most nem sikerült. Próbáld meg később, vagy írj nekünk: office@twinx.hu.");
      setState("error");
    } catch {
      setMsg("Most nem sikerült. Próbáld meg később, vagy írj nekünk: office@twinx.hu.");
      setState("error");
    }
  }

  // Fix magasságú terület — az állapotváltáskor nem ugrik a kártya.
  return (
    <div className="mt-6 min-h-[88px]">
      {state === "done" ? (
        <p className="text-[17px] font-medium text-white">A foglalásodat lemondtuk. A megerősítést e-mailben is elküldtük.</p>
      ) : (
        <>
          <button type="button" onClick={cancel} disabled={state === "busy"}
            className="b-btn-light disabled:opacity-50">
            {state === "busy" ? "Lemondás…" : "Lemondom"}
          </button>
          <p className="mt-3 text-sm font-semibold text-white" role="alert">{state === "error" ? msg : ""}</p>
        </>
      )}
    </div>
  );
}
