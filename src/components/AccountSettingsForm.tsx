// Profil-szerkesztés: jelszó és e-mail módosítás (Supabase Auth, böngészőoldali kliens).
"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AccountSettingsForm({ currentEmail }: { currentEmail: string }) {
  const supabase = createClient();

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    if (pw.length < 6) {
      setPwErr("A jelszó legyen legalább 6 karakter.");
      return;
    }
    if (pw !== pw2) {
      setPwErr("A két jelszó nem egyezik.");
      return;
    }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwLoading(false);
    if (error) {
      setPwErr(error.message);
      return;
    }
    setPw("");
    setPw2("");
    setPwMsg("A jelszó megváltozott.");
  }

  async function changeEmail(e: FormEvent) {
    e.preventDefault();
    setEmailMsg(null);
    setEmailErr(null);
    if (!EMAIL_RE.test(email.trim())) {
      setEmailErr("Érvénytelen e-mail cím.");
      return;
    }
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setEmailLoading(false);
    if (error) {
      setEmailErr(error.message);
      return;
    }
    setEmail("");
    setEmailMsg("Megerősítő linket küldtünk az új címre. A változás a megerősítés után lép életbe.");
  }

  return (
    <div className="space-y-6">
      {/* Jelszó */}
      <form onSubmit={changePassword} className="twx-card space-y-3 p-5">
        <h2 className="font-display text-lg font-medium">Jelszó módosítása</h2>
        <div>
          <label className="block text-sm">Új jelszó</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="twx-input mt-1" autoComplete="new-password" />
        </div>
        <div>
          <label className="block text-sm">Új jelszó újra</label>
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="twx-input mt-1" autoComplete="new-password" />
        </div>
        <button type="submit" disabled={pwLoading} className="twx-btn">
          {pwLoading ? "Mentés…" : "Jelszó módosítása"}
        </button>
        {pwErr && <p className="text-sm text-red-600">{pwErr}</p>}
        {pwMsg && <p className="text-sm text-green-700">{pwMsg}</p>}
      </form>

      {/* E-mail */}
      <form onSubmit={changeEmail} className="twx-card space-y-3 p-5">
        <h2 className="font-display text-lg font-medium">E-mail cím módosítása</h2>
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Jelenlegi: {currentEmail || "—"}
        </p>
        <div>
          <label className="block text-sm">Új e-mail cím</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="twx-input mt-1" autoComplete="email" />
        </div>
        <button type="submit" disabled={emailLoading} className="twx-btn">
          {emailLoading ? "Küldés…" : "E-mail módosítása"}
        </button>
        {emailErr && <p className="text-sm text-red-600">{emailErr}</p>}
        {emailMsg && <p className="text-sm text-green-700">{emailMsg}</p>}
      </form>
    </div>
  );
}
