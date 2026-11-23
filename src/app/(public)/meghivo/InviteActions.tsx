// A meghívó oldal gombjai: belépve „Elfogadom" (POST), kijelentkezve Belépés / Regisztráció (a cím zárolva).
// Fix magasságú terület — az állapotváltáskor nem ugrik a kártya.
"use client";

import { useState } from "react";
import { INVITE_TEXT } from "@/lib/invite-texts";

export default function InviteActions({ token, email, moduleName, loggedIn, sameEmail, next }: {
  token: string; email: string; moduleName: string; loggedIn: boolean; sameEmail: boolean; next: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const openAuth = (mode: "login" | "register") =>
    window.dispatchEvent(new CustomEvent("open-auth", { detail: { mode, email, lockEmail: true, next } }));

  async function accept() {
    setState("busy");
    try {
      const r = await fetch("/api/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { setState("done"); return; }
      setMsg(d.error ?? INVITE_TEXT.invalid); setState("error");
    } catch { setMsg("Most nem sikerült. Próbáld újra később."); setState("error"); }
  }

  const btn = "rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-50";
  return (
    <div className="mt-6 min-h-[120px]">
      {state === "done" ? (
        <>
          <p className="text-base">{INVITE_TEXT.done(moduleName)}</p>
          <a href="/dashboard" className={`${btn} mt-4 inline-flex`} style={{ background: "var(--twx-coral)", color: "#1c1005" }}>Tovább a kezdőlapra</a>
        </>
      ) : !loggedIn ? (
        <>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={btn} style={{ background: "var(--twx-coral)", color: "#1c1005" }} onClick={() => openAuth("login")}>Belépés</button>
            <button type="button" className={btn} style={{ border: "1px solid rgba(255,255,255,0.2)" }} onClick={() => openAuth("register")}>Regisztráció</button>
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--twx-on-dark-muted)" }}>
            Ha még nincs TWINX fiókod, hozz létre egyet ezzel az e-mail címmel. Az e-mail megerősítése után nyisd meg újra ezt a linket.
          </p>
        </>
      ) : !sameEmail ? (
        <p className="text-sm" style={{ color: "#F4A48A" }}>{INVITE_TEXT.otherEmail}</p>
      ) : (
        <>
          <button type="button" className={btn} style={{ background: "var(--twx-coral)", color: "#1c1005" }} disabled={state === "busy"} onClick={accept}>
            {state === "busy" ? "Elfogadás…" : "Elfogadom"}
          </button>
          <p className="mt-3 text-sm" style={{ color: "#F4A48A" }} role="alert">{state === "error" ? msg : ""}</p>
        </>
      )}
    </div>
  );
}
