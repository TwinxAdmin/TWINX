// Partner-adatok szerkesztése: teljes név + cég (a Beállítások oldalon).
"use client";

import { useState, type FormEvent } from "react";
import { showToast } from "@/components/Toast";

export default function ProfileForm({
  initialName, initialCompany,
}: { initialName: string; initialCompany: string }) {
  const [name, setName] = useState(initialName);
  const [company, setCompany] = useState(initialCompany);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Adatok mentve.", "success");
    } catch (err) {
      showToast((err as Error).message || "Nem sikerült a mentés.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="twx-card space-y-3 p-5">
      <h2 className="text-sm font-semibold">Partner-adatok</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="p-name" className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
            Teljes név
          </label>
          <input id="p-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="twx-input mt-1 w-full text-sm" placeholder="pl. Nagy Anna" />
        </div>
        <div>
          <label htmlFor="p-company" className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
            Cég, ahol dolgozol
          </label>
          <input id="p-company" type="text" value={company} onChange={(e) => setCompany(e.target.value)}
            className="twx-input mt-1 w-full text-sm" placeholder="pl. Prémium Ingatlanok Kft." />
        </div>
      </div>
      <button type="submit" disabled={saving}
        className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--twx-coral)" }}>
        {saving ? "Mentés…" : "Mentés"}
      </button>
    </form>
  );
}
