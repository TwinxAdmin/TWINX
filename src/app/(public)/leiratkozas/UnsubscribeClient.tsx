// A leiratkozás rögzítése betöltéskor (POST), így a levelezők linkellenőrzője nem iratkoztatja le a felhasználót.
"use client";

import { useEffect, useState } from "react";

type Status = "saving" | "done" | "failed";

export default function UnsubscribeClient({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>("saving");

  useEffect(() => {
    let alive = true;
    fetch("/api/activation/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((res) => { if (alive) setStatus(res.ok ? "done" : "failed"); })
      .catch(() => { if (alive) setStatus("failed"); });
    return () => { alive = false; };
  }, [token]);

  if (status === "saving") return <p className="text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>Egy pillanat…</p>;
  return (
    <div className="text-center">
      <h1 className="font-display text-2xl font-semibold">{status === "done" ? "Leiratkoztál" : "Ez most nem sikerült"}</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        {status === "done"
          ? "Több ilyen levelet nem küldünk, és a hírlevélről is levettünk. A fiókod és a kreditjeid megmaradnak."
          : "Kérlek, próbáld újra később, vagy írj nekünk: twinx.hu/kapcsolat"}
      </p>
    </div>
  );
}
