// Időpont-kérés ablak (D73, 8. lépés kiegészítés, Márk kérése 2026-11-27):
//   1) naptár — három különböző hétköznap kiválasztása (holnaptól 60 napig), mindkettőhöz délelőtt / délután;
//   2) adatok — név, e-mail, telefonszám (kötelező), cégnév és megjegyzés (nem kötelező), hozzájárulás;
//   3) küldés → „Köszönjük" képernyő ugyanabban az ablakban.
// Nem a mi szabad időpontjainkat mutatja: az érdeklődő mondja meg, mikor jó neki (Márk vállalta). Az ablak mérete fix,
// belül görget (nincs ugrálás). Esc / háttérkattintás bezár. Mentés: POST /api/callback-request.
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CALLBACK_DAYS, CALLBACK_WINDOW_DAYS, PART_LABEL, addDays, formatDayHu, isSelectable, todayBudapest, validateCallback,
  type CallbackDay, type CallbackInput, type DayPart,
} from "@/lib/callback-request";

const MONTHS = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];
const WD = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

export default function CallbackRequestModal({ open, onClose, prefill }: {
  open: boolean; onClose: () => void; prefill?: { name?: string; email?: string };
}) {
  const today = useMemo(() => todayBudapest(), []);
  const [view, setView] = useState(() => today.slice(0, 7)); // ÉÉÉÉ-HH
  const [days, setDays] = useState<CallbackDay[]>([]);
  const [f, setF] = useState({ name: prefill?.name ?? "", email: prefill?.email ?? "", phone: "", company: "", note: "", consent: false });
  const [website, setWebsite] = useState(""); // csali mező
  const [errors, setErrors] = useState<Partial<Record<keyof CallbackInput, string>>>({});
  const [state, setState] = useState<"form" | "sending" | "done">("form");
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  // naptár-rács (hétfővel kezdődő hetek)
  const [vy, vm] = view.split("-").map(Number);
  const first = new Date(Date.UTC(vy, vm - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${view}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  while (cells.length < 42) cells.push(null); // mindig 6 sor → fix magasság
  const lastAllowed = addDays(today, CALLBACK_WINDOW_DAYS);
  const shiftMonth = (n: number) => { const d = new Date(Date.UTC(vy, vm - 1 + n, 1)); setView(d.toISOString().slice(0, 7)); };
  const canPrev = view > today.slice(0, 7);
  const canNext = view < lastAllowed.slice(0, 7);

  const toggleDay = (iso: string) => {
    setErrors((e) => ({ ...e, days: undefined }));
    setDays((cur) => {
      if (cur.some((d) => d.date === iso)) return cur.filter((d) => d.date !== iso);
      const next = [...cur, { date: iso, part: "de" as DayPart }];
      return next.length > CALLBACK_DAYS ? next.slice(1) : next; // a negyedik a legrégebbit cseréli
    });
  };
  const setPart = (iso: string, part: DayPart) => setDays((cur) => cur.map((d) => (d.date === iso ? { ...d, part } : d)));

  const submit = async () => {
    setServerError("");
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const check = validateCallback({ ...f, days: sorted });
    setErrors(check.errors);
    if (!check.valid) return;
    setState("sending");
    try {
      const r = await fetch("/api/callback-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...check.value, website }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { setState("done"); return; }
      if (d.errors) setErrors(d.errors);
      setServerError(d.error ?? "Most nem sikerült elküldeni. Próbáld újra, vagy írj e-mailt: office@twinx.hu.");
    } catch {
      setServerError("Most nem sikerült elküldeni. Próbáld újra, vagy írj e-mailt: office@twinx.hu.");
    }
    setState("form");
  };

  const input = "h-11 w-full rounded-xl border border-b-line bg-white px-3 text-[15px] text-b-ink outline-none focus:border-b-accent";
  const err = (k: keyof CallbackInput) => <p className="mt-1 h-4 text-xs text-[#b3261e]">{errors[k] ?? ""}</p>;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Visszahívás kérése"
        className="relative flex h-[min(760px,94vh)] w-full max-w-[760px] flex-col overflow-hidden rounded-[24px] bg-b-bg text-b-ink shadow-b-lg">
        <div className="flex h-16 flex-none items-center justify-between border-b border-b-line px-5 sm:px-7">
          <h2 className="font-display text-lg font-bold sm:text-xl">{state === "done" ? "Köszönjük!" : "Visszahívás kérése"}</h2>
          <button type="button" onClick={onClose} aria-label="Bezárás" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-b-surface">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {state === "done" ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-b-accent text-white">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <p className="font-display text-2xl font-bold">Köszönjük, a kérésed megérkezett!</p>
            <p className="mt-3 max-w-md text-[16px] leading-relaxed text-b-ink-2">
              A kollégáink a megadott napok egyikén felhívnak, és megbeszéljük, mikor beszélgessünk bővebben az egyedi modulról, személyesen vagy online. Ha közben kérdésed van, írj nekünk: office@twinx.hu.
            </p>
            <button type="button" onClick={onClose} className="b-btn mt-7">Bezárás</button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              {/* 1) naptár */}
              <p className="text-[15px] font-semibold">1. Mikor hívhatunk? Válassz három hétköznapot</p>
              <p className="mb-3 text-sm text-b-ink-2">Mindegyiknél add meg, hogy délelőtt vagy délután jó. Ekkor felhívunk, és egyeztetjük a bővebb beszélgetés időpontját.</p>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
                <div className="rounded-2xl border border-b-line bg-white p-3">
                  <div className="mb-2 flex h-9 items-center justify-between">
                    <button type="button" disabled={!canPrev} onClick={() => shiftMonth(-1)} aria-label="Előző hónap" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-b-surface disabled:opacity-30">‹</button>
                    <span className="text-[15px] font-semibold capitalize">{vy}. {MONTHS[vm - 1]}</span>
                    <button type="button" disabled={!canNext} onClick={() => shiftMonth(1)} aria-label="Következő hónap" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-b-surface disabled:opacity-30">›</button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-b-ink-3">
                    {WD.map((w) => <span key={w} className="py-1">{w}</span>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {cells.map((iso, i) => {
                      if (!iso) return <span key={i} className="h-9" />;
                      const ok = isSelectable(iso, today);
                      const sel = days.some((d) => d.date === iso);
                      return (
                        <button key={iso} type="button" disabled={!ok} onClick={() => toggleDay(iso)} aria-pressed={sel}
                          className={`h-9 rounded-lg text-sm transition-colors ${sel ? "bg-b-accent font-bold text-white" : ok ? "bg-b-surface-2 text-b-ink hover:bg-b-accent-soft" : "text-b-ink-3/50"}`}>
                          {Number(iso.slice(8))}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* kiválasztott napok + délelőtt / délután — fix magasságú helyek */}
                <div className="flex flex-col gap-2">
                  {Array.from({ length: CALLBACK_DAYS }, (_, k) => k).map((k) => {
                    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
                    const d = sorted[k];
                    return (
                      <div key={k} className={`flex h-[78px] flex-col justify-center rounded-2xl border px-3.5 ${d ? "border-b-accent bg-b-accent-tint" : "border-dashed border-b-line bg-white"}`}>
                        <p className="text-[11px] font-semibold uppercase tracking-[1px] text-b-accent-ink">{k + 1}. nap</p>
                        {d ? (
                          <>
                            <p className="truncate text-[15px] font-semibold capitalize">{formatDayHu(d.date)}</p>
                            <div className="mt-1.5 flex gap-1.5">
                              {(["de", "du"] as DayPart[]).map((p) => (
                                <button key={p} type="button" onClick={() => setPart(d.date, p)} aria-pressed={d.part === p}
                                  className={`h-7 flex-1 rounded-full text-[13px] font-semibold ${d.part === p ? "bg-b-dark text-b-on-dark" : "bg-white text-b-ink-2 ring-1 ring-b-line"}`}>
                                  {PART_LABEL[p]}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : <p className="text-sm text-b-ink-3">Kattints egy napra a naptárban.</p>}
                      </div>
                    );
                  })}
                  {err("days")}
                </div>
              </div>

              {/* 2) adatok */}
              <p className="mt-4 text-[15px] font-semibold">2. Az adataid</p>
              <div className="mt-2 grid gap-x-3 sm:grid-cols-2">
                <label className="block text-sm">Név *<input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />{err("name")}</label>
                <label className="block text-sm">E-mail *<input className={input} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />{err("email")}</label>
                <label className="block text-sm">Telefonszám *<input className={input} type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" placeholder="+36 30 123 4567" />{err("phone")}</label>
                <label className="block text-sm">Cégnév<input className={input} value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} autoComplete="organization" />{err("company")}</label>
              </div>
              <label className="block text-sm">Röviden, miben segítene egy egyedi modul (nem kötelező)
                <textarea className="h-20 w-full resize-none rounded-xl border border-b-line bg-white p-3 text-[15px] outline-none focus:border-b-accent" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
                {err("note")}
              </label>
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden className="hidden" name="website" />
              <label className="mt-1 flex items-start gap-2.5 text-sm text-b-ink-2">
                <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none accent-[#c8401f]" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
                <span>Hozzájárulok, hogy a megadott adataimat a TWINX a visszahíváshoz és a bemutató beszélgetés egyeztetéséhez felhasználja.</span>
              </label>
              {err("consent")}
            </div>

            <div className="flex h-[72px] flex-none items-center justify-between gap-3 border-t border-b-line px-5 sm:px-7">
              <p className="min-w-0 flex-1 truncate text-sm text-[#b3261e]" role="alert">{serverError}</p>
              <button type="button" onClick={submit} disabled={state === "sending"} className="b-btn flex-none px-6 py-3 disabled:opacity-60">
                {state === "sending" ? "Küldés…" : "Visszahívást kérek"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
