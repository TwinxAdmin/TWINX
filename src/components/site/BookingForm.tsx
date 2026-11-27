// Időpontfoglaló űrlap a kapcsolatblokkban (terv 15 / 1. szakasz). Két lépés egy FIX méretű dobozban:
//   1) Időpont: nap-választó (csak ahol van szabad időpont) + a nap időpontjai (idő · hossz · gazda)
//   2) Adatok: név, cég, e-mail, telefon (kötelező), pár mondat (opcionális), GDPR-pipa
//   → Visszaigazolás ugyanabban a dobozban. Ha nincs szabad időpont: visszahívási kérés időpont nélkül.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { gaEvent } from "@/lib/analytics";
import {
  BOOKING_CONSENT_TEXT, BOOKING_MESSAGE_MAX, budapestDayKey, fmtDayKey, fmtTime, validateBooking,
  type BookingFieldErrors, type BookingSource, type PublicSlot,
} from "@/lib/bookings";

type Step = "time" | "data" | "done";
type Done = { kind: "idopont" | "visszahivas"; startsAt: string | null; hostName: string | null };

const MUTED = "var(--bf-muted)";
const inputCls = "w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[var(--bf-accent)]";
const inputStyle: React.CSSProperties = { background: "var(--bf-input-bg)", border: "1px solid var(--bf-input-line)", color: "var(--bf-ink)" };

function shortDay(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const wd = new Intl.DateTimeFormat("hu-HU", { timeZone: "UTC", weekday: "short" }).format(dt);
  return { wd: wd.replace(".", ""), day: `${m}. ${d}.` };
}

function Field({ label, error, children, optional }: { label: string; error?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs" style={{ color: MUTED }}>{label}{optional && " (nem kötelező)"}</span>
      {children}
      {/* Fix magasságú hibasor — a doboz nem ugrik, ha megjelenik. */}
      <span className="block h-4 pt-0.5 text-[11px]" style={{ color: "var(--bf-err)" }}>{error ?? ""}</span>
    </label>
  );
}

/** Színvilág: "dark" = a korábbi sötét kapcsolatblokk; "light" = B arculat (6. lépés, terv 29) — fehér kártya a korall sávon. */
const TONES: Record<"dark" | "light", Record<string, string>> = {
  dark: {
    "--bf-bg": "#1b1815", "--bf-line": "rgba(255,255,255,0.08)", "--bf-ink": "var(--twx-on-dark)", "--bf-muted": "var(--twx-on-dark-muted)",
    "--bf-accent": "var(--twx-coral)", "--bf-on-accent": "#1c1005", "--bf-soft": "rgba(255,255,255,0.05)", "--bf-accent-soft": "rgba(239,122,90,0.18)",
    "--bf-err": "#F4A48A", "--bf-input-bg": "#121110", "--bf-input-line": "#3A322C", "--bf-link": "var(--twx-coral-soft)",
  },
  light: {
    "--bf-bg": "#ffffff", "--bf-line": "#e3d8cb", "--bf-ink": "#1d1712", "--bf-muted": "#5a4d42",
    "--bf-accent": "#c8401f", "--bf-on-accent": "#ffffff", "--bf-soft": "#f6f1ea", "--bf-accent-soft": "#fff4ee",
    "--bf-err": "#b3381a", "--bf-input-bg": "#ffffff", "--bf-input-line": "#e3d8cb", "--bf-link": "#b3381a",
  },
};

export default function BookingForm({ source, prefill, tone = "dark" }: {
  source: BookingSource; prefill?: { name?: string; email?: string }; tone?: "dark" | "light";
}) {
  const [step, setStep] = useState<Step>("time");
  const [slots, setSlots] = useState<PublicSlot[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<PublicSlot | null>(null);
  const [f, setF] = useState({ name: prefill?.name ?? "", company: "", email: prefill?.email ?? "", phone: "", message: "", consent: false, website: "" });
  const [errors, setErrors] = useState<BookingFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await fetch("/api/bookings", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setSlots([]); setLoadError(d.error ?? "Az időpontokat most nem sikerült betölteni."); return; }
      setSlots(d.slots as PublicSlot[]);
    } catch { setSlots([]); setLoadError("Az időpontokat most nem sikerült betölteni."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const days = useMemo(() => {
    const m = new Map<string, PublicSlot[]>();
    for (const s of slots ?? []) { const k = budapestDayKey(s.startsAt); m.set(k, [...(m.get(k) ?? []), s]); }
    return m;
  }, [slots]);
  const dayKeys = useMemo(() => [...days.keys()], [days]);
  useEffect(() => { if (!day && dayKeys.length) setDay(dayKeys[0]); }, [day, dayKeys]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: k === "consent" ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const errs = validateBooking({ slotId: slot?.id ?? null, ...f });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSending(true);
    try {
      const r = await fetch("/api/bookings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slotId: slot?.id ?? null, ...f, source }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) {
        setDone({ kind: d.kind, startsAt: d.startsAt, hostName: d.hostName });
        setStep("done");
        gaEvent("book_assessment", { kind: d.kind, source });
        return;
      }
      if (d.errors) setErrors(d.errors);
      if (d.code === "idopont_elkelt") {
        // Az adatok megmaradnak; frissül a lista, és vissza az időpont-választáshoz.
        setSlot(null); setDay(null); await load(); setStep("time");
      }
      setFormError(d.error ?? "Most nem sikerült. Próbáld meg később, vagy írj nekünk: office@twinx.hu.");
    } catch {
      setFormError("Most nem sikerült. Próbáld meg később, vagy írj nekünk: office@twinx.hu.");
    } finally { setSending(false); }
  }

  const noSlots = slots !== null && slots.length === 0;

  return (
    <div className="flex h-[560px] flex-col rounded-3xl p-6 sm:p-7" style={{ ...TONES[tone], background: "var(--bf-bg)", border: "1px solid var(--bf-line)", color: "var(--bf-ink)" } as React.CSSProperties}>
      {/* Lépésjelző — fix sor */}
      <div className="flex h-7 flex-none items-center gap-2 text-xs" style={{ color: MUTED }}>
        {(["time", "data"] as const).map((s, i) => {
          const active = step === s || (step === "done" && s === "data");
          return (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>—</span>}
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                style={active ? { background: "var(--bf-accent)", color: "var(--bf-on-accent)" } : { background: "var(--bf-soft)" }}>{i + 1}</span>
              <span style={active ? { color: "var(--bf-ink)" } : undefined}>{s === "time" ? "Időpont" : "Adatok"}</span>
            </span>
          );
        })}
      </div>

      {/* ===== 1) IDŐPONT ===== */}
      {step === "time" && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <h3 className="font-display text-lg font-semibold">Válassz időpontot</h3>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>A kiválasztott időpontban telefonon hívunk, nagyjából 45 percre.</p>

          {slots === null ? (
            <div className="mt-5 flex-1 animate-pulse rounded-2xl" style={{ background: "var(--bf-soft)" }} />
          ) : noSlots ? (
            <div className="mt-5 flex flex-1 flex-col items-start justify-center gap-4 rounded-2xl p-5" style={{ background: "var(--bf-soft)" }}>
              <p className="text-sm">{loadError ?? "Jelenleg nincs szabad időpont, hagyd meg az adataidat, és visszahívunk."}</p>
              <button type="button" onClick={() => { setSlot(null); setStep("data"); }}
                className="rounded-full px-5 py-2.5 text-sm font-semibold" style={{ background: "var(--bf-accent)", color: "var(--bf-on-accent)" }}>
                Tovább az adatokhoz
              </button>
            </div>
          ) : (
            <>
              {/* Nap-választó: vízszintesen görgethető, fix magasság */}
              <div className="mt-4 flex h-[68px] flex-none gap-2 overflow-x-auto pb-1">
                {dayKeys.map((k) => {
                  const { wd, day: dd } = shortDay(k);
                  const on = k === day;
                  return (
                    <button key={k} type="button" onClick={() => { setDay(k); setSlot(null); }}
                      className="flex w-[64px] flex-none flex-col items-center justify-center rounded-xl text-xs transition-colors"
                      style={on ? { background: "var(--bf-accent)", color: "var(--bf-on-accent)" } : { background: "var(--bf-soft)", color: "var(--bf-ink)" }}>
                      <span className="uppercase opacity-80">{wd}</span>
                      <span className="mt-0.5 font-semibold">{dd}</span>
                    </button>
                  );
                })}
              </div>
              {day && <p className="mt-3 flex-none text-xs uppercase tracking-wider" style={{ color: MUTED }}>{fmtDayKey(day)}</p>}
              {/* A nap időpontjai — a dobozon belül görgethető */}
              <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {(day ? days.get(day) ?? [] : []).map((s) => {
                  const on = slot?.id === s.id;
                  return (
                    <li key={s.id}>
                      <button type="button" onClick={() => setSlot(s)}
                        className="flex h-11 w-full items-center justify-between rounded-xl px-4 text-sm transition-colors"
                        style={on ? { background: "var(--bf-accent-soft)", border: "1px solid var(--bf-accent)" } : { background: "var(--bf-soft)", border: "1px solid transparent" }}>
                        <span className="font-semibold tabular-nums">{fmtTime(s.startsAt)}</span>
                        <span style={{ color: MUTED }}>{s.durationMin} perc · {s.hostName}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-none items-center justify-between gap-3 pt-4">
                <button type="button" onClick={() => { setSlot(null); setStep("data"); }} className="text-xs underline-offset-2 hover:underline" style={{ color: MUTED }}>
                  Egyik sem jó? Kérj visszahívást
                </button>
                <button type="button" disabled={!slot} onClick={() => setStep("data")}
                  className="rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-40" style={{ background: "var(--bf-accent)", color: "var(--bf-on-accent)" }}>
                  Tovább
                </button>
              </div>
            </>
          )}
          {formError && <p className="mt-2 flex-none text-xs" style={{ color: "var(--bf-err)" }}>{formError}</p>}
        </div>
      )}

      {/* ===== 2) ADATOK ===== */}
      {step === "data" && (
        <form onSubmit={submit} noValidate className="mt-4 flex min-h-0 flex-1 flex-col">
          {/* Összefoglaló sor — fix magasság */}
          <div className="flex h-10 flex-none items-center justify-between gap-3 rounded-xl px-3.5 text-sm" style={{ background: "var(--bf-soft)" }}>
            <span className="truncate">
              {slot ? <>{fmtDayKey(budapestDayKey(slot.startsAt))}, <b>{fmtTime(slot.startsAt)}</b> · {slot.hostName}</> : "Visszahívást kérsz (időpont nélkül)"}
            </span>
            {!noSlots && (
              <button type="button" onClick={() => { setStep("time"); setFormError(null); }} className="flex-none text-xs underline underline-offset-2" style={{ color: "var(--bf-link)" }}>
                Időpont módosítása
              </button>
            )}
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Field label="Neved" error={errors.name}>
                <input className={inputCls} style={inputStyle} value={f.name} onChange={set("name")} autoComplete="name" maxLength={120} />
              </Field>
              <Field label="Céged" error={errors.company}>
                <input className={inputCls} style={inputStyle} value={f.company} onChange={set("company")} autoComplete="organization" maxLength={160} />
              </Field>
              <Field label="E-mail címed" error={errors.email}>
                <input className={inputCls} style={inputStyle} type="email" value={f.email} onChange={set("email")} autoComplete="email" maxLength={254} />
              </Field>
              <Field label="Telefonszámod" error={errors.phone}>
                <input className={inputCls} style={inputStyle} type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" placeholder="+36 20 123 4567" maxLength={24} />
              </Field>
            </div>
            <Field label="Mit modernizálnál, hol megy el sok időd?" optional error={errors.message}>
              <textarea className={`${inputCls} h-20 resize-none`} style={inputStyle} value={f.message} onChange={set("message")} maxLength={BOOKING_MESSAGE_MAX} />
            </Field>
            {/* Honeypot — embernek láthatatlan, a robot kitölti. */}
            <input type="text" name="website" value={f.website} onChange={set("website")} tabIndex={-1} autoComplete="off"
              className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
            <label className="flex items-start gap-2.5 text-xs leading-relaxed" style={{ color: MUTED }}>
              <input type="checkbox" checked={f.consent} onChange={set("consent")} className="mt-0.5 h-4 w-4 flex-none accent-[#c8401f]" />
              <span>
                {BOOKING_CONSENT_TEXT}{" "}
<a href="/adatkezeles" target="_blank" rel="noopener" className="font-semibold underline" style={{ color: "var(--bf-link)" }}>Adatkezelési tájékoztató</a>
              </span>
            </label>
            <span className="block h-4 pt-0.5 text-[11px]" style={{ color: "var(--bf-err)" }}>{errors.consent ?? ""}</span>
          </div>

          <div className="flex flex-none items-center justify-between gap-3 pt-3">
            <p className="min-h-[2rem] text-xs leading-snug" style={{ color: "var(--bf-err)" }} role="alert">{formError ?? ""}</p>
            <button type="submit" disabled={sending}
              className="flex-none rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--bf-accent)", color: "var(--bf-on-accent)" }}>
              {sending ? "Küldés…" : slot ? "Foglalás elküldése" : "Visszahívást kérek"}
            </button>
          </div>
        </form>
      )}

      {/* ===== VISSZAIGAZOLÁS ===== */}
      {step === "done" && done && (
        <div className="flex flex-1 flex-col items-start justify-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--bf-accent-soft)", color: "var(--bf-accent)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5 9-10" /></svg>
          </span>
          <h3 className="font-display text-2xl font-semibold">Köszönjük!</h3>
          <p className="max-w-md text-base" style={{ color: MUTED }}>
            {done.kind === "idopont" && done.startsAt
              ? <>{fmtDayKey(budapestDayKey(done.startsAt))}, {fmtTime(done.startsAt)} időpontban {done.hostName} hív telefonon. A részleteket e-mailben küldtük.</>
              : "Hamarosan visszahívunk."}
          </p>
        </div>
      )}
    </div>
  );
}
