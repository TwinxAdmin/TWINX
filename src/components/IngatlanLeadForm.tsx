// Az /ingatlan landing jelentkező-űrlapja. Név, e-mail, telefon, iroda.
// Az „intent" a küldő gombtól jön (10 kredit vagy bemutató) — a másodlagos CTA-k
// az `open-ingatlan-lead` window-eseménnyel állítják be és görgetnek ide.
"use client";

import { useEffect, useRef, useState } from "react";
import { showToast } from "@/components/Toast";
import type { IngatlanLeadIntent } from "@/lib/ingatlan-lead";

export default function IngatlanLeadForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [office, setOffice] = useState("");
  const [intent, setIntent] = useState<IngatlanLeadIntent>("kreditek");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // A hero és a bemutató gombja ide görget, és beállítja az érdeklődés típusát.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as { intent?: IngatlanLeadIntent } | undefined;
      if (detail?.intent) setIntent(detail.intent);
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("open-ingatlan-lead", onOpen);
    return () => window.removeEventListener("open-ingatlan-lead", onOpen);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await fetch("/api/ingatlan-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, office, intent }),
      });
      const data = await res.json();
      if (res.status === 422 && data.errors) { setErrors(data.errors); return; }
      if (!res.ok) throw new Error(data.error || "A beküldés nem sikerült.");
      setDone(true);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const field = (
    id: keyof typeof errors,
    label: string,
    value: string,
    onChange: (v: string) => void,
    type = "text",
    placeholder = ""
  ) => (
    <div>
      <label htmlFor={`il-${id}`} className="block text-sm font-medium" style={{ color: "var(--twx-on-dark)" }}>
        {label}
      </label>
      <input
        id={`il-${id}`}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${errors[id] ? "#f0a58c" : "rgba(255,255,255,0.14)"}`, color: "var(--twx-on-dark)" }}
      />
      {errors[id] && <p className="mt-1 text-xs" style={{ color: "#f0a58c" }}>{errors[id]}</p>}
    </div>
  );

  return (
    <div ref={sectionRef} className="scroll-mt-8">
      {done ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(239,122,90,0.12)", border: "1px solid var(--twx-coral)" }}>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--twx-coral)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1c1005" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m5 12 5 5L20 7" />
            </svg>
          </div>
          <h3 className="font-display text-2xl font-semibold" style={{ color: "var(--twx-on-dark)" }}>
            Köszönjük a jelentkezést!
          </h3>
          <p className="mt-2 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
            Hamarosan felvesszük veled a kapcsolatot, elküldjük a hozzáférést és beállítjuk
            a 10 ajándék kreditet. Nézd majd az e-mail-fiókodat is.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field("name", "Teljes neved", name, setName, "text", "pl. Nagy Anna")}
          {field("email", "E-mail cím", email, setEmail, "email", "nev@pelda.hu")}
          {field("phone", "Telefonszám", phone, setPhone, "tel", "+36 30 123 4567")}
          {field("office", "Ingatlaniroda neve", office, setOffice, "text", "pl. Prémium Ingatlanok")}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl px-6 py-3.5 text-base font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--twx-coral)", color: "#1c1005" }}
            >
              {busy ? "Küldés…" : "Regisztrálok és kérem a krediteket!"}
            </button>
            <p className="mt-2 text-center text-xs" style={{ color: "var(--twx-on-dark-muted)" }}>
              A jelentkezéssel elfogadod, hogy felvegyük veled a kapcsolatot. Nincs kötelezettség.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
