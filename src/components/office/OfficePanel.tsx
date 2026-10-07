// OfficePanel — a saját irodám nézete.
//   • létrehozó: iroda neve, csatlakozási kód (másolással), irodai egyenleg, létszám
//   • tag: iroda neve + a SAJÁT felhasználható kerete (az iroda egyenlegét nem látja)
"use client";

import { useState } from "react";
import type { MyOffice } from "@/lib/office";
import OfficeMembers from "@/components/office/OfficeMembers";
import OfficeTopup from "@/components/office/OfficeTopup";

export default function OfficePanel({ office: initial }: { office: MyOffice }) {
  const [office, setOffice] = useState(initial);
  const isOwner = office.role === "owner";
  const [copied, setCopied] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  async function regenerate() {
    if (!window.confirm("Új csatlakozási kódot generálsz? A régi kód azonnal érvénytelen lesz (a már csatlakozott tagokat nem érinti).")) return;
    setRegenBusy(true);
    setRegenError(null);
    try {
      const res = await fetch("/api/office", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerateCode" }),
      });
      const data = await res.json();
      if (!res.ok) { setRegenError(data.error ?? "Nem sikerült."); return; }
      setOffice(data.office);
    } catch {
      setRegenError("Hálózati hiba.");
    } finally {
      setRegenBusy(false);
    }
  }

  async function refresh() {
    try {
      const d = await fetch("/api/office").then((r) => r.json());
      if (d.office) setOffice(d.office);
    } catch { /* nem kritikus */ }
  }

  async function copyCode() {
    if (!office.joinCode) return;
    try {
      await navigator.clipboard.writeText(office.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* a vágólap nem elérhető — a kód kijelölhető kézzel is */
    }
  }

  return (
    <section className="twx-card space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--twx-coral)" }}>
          {isOwner ? "Te hoztad létre" : "Irodai tag"}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">{office.name}</h2>
      </div>

      {isOwner ? (
        <>
          <div className="rounded-2xl p-5" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
            <p className="text-sm font-medium">Csatlakozási kód</p>
            <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Add át a kollégáidnak: TWINX-fiókkal belépve, az „Irodai fiók → Csatlakozás kóddal” fülön azonnal csatlakozhatnak.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="select-all rounded-xl px-4 py-2 font-mono text-xl font-semibold tracking-widest"
                style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                {office.joinCode}
              </code>
              <button type="button" className="twx-btn-outline" onClick={copyCode}>
                {copied ? "Kimásolva ✓" : "Kód másolása"}
              </button>
              <button type="button" className="text-xs underline" style={{ color: "var(--twx-ink-muted)" }}
                onClick={regenerate} disabled={regenBusy}>
                {regenBusy ? "Generálás…" : "Új kód generálása"}
              </button>
            </div>
            {regenError && <p className="mt-2 text-xs text-red-600">{regenError}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Irodai egyenleg" value={`${office.balance ?? 0} kredit`} />
            <Stat label="Tagok" value={`${office.memberCount ?? 1} fő`} />
          </div>
          <OfficeTopup />

          <OfficeMembers balance={office.balance} onChanged={refresh} />
        </>
      ) : (
        <>
          <Stat
            label="Felhasználható irodai kereted"
            value={office.unlimited ? "Korlátlan" : `${office.allowance} kredit`}
          />
          <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            A saját kreditjeid ettől függetlenül megmaradnak.
          </p>
          {office.canAllocate && <OfficeMembers onChanged={refresh} />}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ border: "1px solid var(--twx-line)" }}>
      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
