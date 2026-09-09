// /ingatlan — „Bővebb tájékoztatást kérek" felugró ablak.
// Név, e-mail, telefon (+ opcionális iroda, időpont-preferencia, kérdés) →
// POST /api/ingatlan-consultation → minden admin kap e-mailt.
// Nyitás: bárhonnan a `open-ingatlan-consult` window-eseménnyel
// (lásd IngatlanConsultButton lent). Esc és a háttérre kattintás zár.
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showToast } from "@/components/Toast";

const OPEN_EVENT = "open-ingatlan-consult";

export function IngatlanConsultButton({
  children, className, style,
}: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <button type="button" className={className} style={style}
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}>
      {children}
    </button>
  );
}

export default function IngatlanConsultModal() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [f, setF] = useState({ name: "", email: "", phone: "", office: "", preferred: "", note: "" });
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = () => { setOpen(true); setDone(false); setErrors({}); };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => firstRef.current?.focus(), 80);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; clearTimeout(t); };
  }, [open]);

  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors({});
    try {
      const res = await fetch("/api/ingatlan-consultation", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
      });
      const data = await res.json();
      if (res.status === 422 && data.errors) { setErrors(data.errors); return; }
      if (!res.ok) throw new Error(data.error || "A küldés nem sikerült.");
      setDone(true);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const input = (id: keyof typeof f, label: string, opts: { type?: string; ph?: string; optional?: boolean; area?: boolean } = {}) => (
    <div className={opts.area ? "sm:col-span-2" : ""}>
      <label htmlFor={`ic-${id}`} className="block text-sm font-medium">
        {label}{opts.optional && <span className="ml-1 text-xs font-normal" style={{ color: "var(--twx-ink-muted)" }}>(nem kötelező)</span>}
      </label>
      {opts.area ? (
        <textarea id={`ic-${id}`} value={f[id]} onChange={(e) => set(id)(e.target.value)} placeholder={opts.ph} rows={3}
          className="twx-input mt-1.5 w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ border: `1px solid ${errors[id] ? "var(--twx-coral)" : "var(--twx-line)"}` }} />
      ) : (
        <input id={`ic-${id}`} ref={id === "name" ? firstRef : undefined} type={opts.type ?? "text"} value={f[id]}
          onChange={(e) => set(id)(e.target.value)} placeholder={opts.ph}
          className="twx-input mt-1.5 w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ border: `1px solid ${errors[id] ? "var(--twx-coral)" : "var(--twx-line)"}` }} />
      )}
      {errors[id] && <p className="mt-1 text-xs" style={{ color: "var(--twx-coral)" }}>{errors[id]}</p>}
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ background: "rgba(20,16,14,0.62)", backdropFilter: "blur(4px)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="ic-title"
            initial={{ y: 24, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg rounded-t-3xl p-6 sm:rounded-3xl sm:p-8"
            style={{ background: "var(--twx-cream)", color: "var(--twx-ink)", boxShadow: "0 30px 80px rgba(0,0,0,0.4)" }}>
            <button type="button" aria-label="Bezárás" onClick={() => setOpen(false)}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-lg transition-colors hover:bg-black/5"
              style={{ border: "1px solid var(--twx-line)" }}>×</button>

            {done ? (
              <div className="py-4 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--twx-coral)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1c1005" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5L20 7" /></svg>
                </div>
                <h3 className="font-display text-2xl font-semibold">Köszönjük, megkaptuk!</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
                  Egy kollégánk hamarosan felveszi veled a kapcsolatot e-mailben vagy telefonon,
                  és bővebben mesél a TWINX-ről.
                </p>
                <button type="button" onClick={() => setOpen(false)}
                  className="mt-6 rounded-xl px-6 py-3 text-sm font-semibold" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                  Rendben
                </button>
              </div>
            ) : (
              <>
                <p className="font-display text-xs font-semibold uppercase" style={{ color: "var(--twx-coral)", letterSpacing: "0.2em" }}>
                  Bővebb tájékoztatás
                </p>
                <h3 id="ic-title" className="mt-2 font-display text-2xl font-semibold">Meséljünk neked a TWINX-ről?</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
                  Add meg az elérhetőséged, és egy kollégánk felveszi veled a kapcsolatot, hogy
                  bővebben meséljen a TWINX-ről. Nincs kötelezettség.
                </p>
                <form onSubmit={submit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {input("name", "Teljes neved", { ph: "pl. Nagy Anna" })}
                  {input("email", "E-mail cím", { type: "email", ph: "nev@pelda.hu" })}
                  {input("phone", "Telefonszám", { type: "tel", ph: "+36 30 123 4567" })}
                  {input("office", "Ingatlaniroda", { ph: "pl. Prémium Ingatlanok", optional: true })}
                  {input("preferred", "Mikor kereshetünk?", { ph: "pl. hétköznap 10–12 között", optional: true, area: false })}
                  {input("note", "Mire vagy kíváncsi?", { ph: "pl. az értékbecslő és a videó érdekel leginkább", optional: true, area: true })}
                  <div className="sm:col-span-2">
                    <button type="submit" disabled={busy}
                      className="w-full rounded-xl px-6 py-3.5 text-base font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                      style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                      {busy ? "Küldés…" : "Kérem a tájékoztatást"}
                    </button>
                    <p className="mt-3 text-center text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      Az adataidat kizárólag a kapcsolatfelvételhez használjuk.
                    </p>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
