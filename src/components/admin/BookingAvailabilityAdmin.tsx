// Admin → Foglalások → Időpontok (terv 15 / 5.B): gazda-váltó, heti sablon + „Sablon alkalmazása",
// a következő 4 hét időpontjai napokra bontva, kézi felvétel és törlés („⋯" menüben).
// Fix magasságú dobozok, belül görgetés — a lap nem ugrál.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SelectField from "@/components/SelectField";
import DateField from "@/components/DateField";
import { ActionMenu, MenuDots, MI, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";
import { showToast } from "@/components/Toast";
import {
  BOOKING_DEFAULT_MINUTES, DURATION_OPTIONS, TIME_OPTIONS, WEEKDAYS,
  budapestDayKey, fmtDayKey, fmtTime,
  type AdminSlot, type AvailabilityTemplate, type BookingHost,
} from "@/lib/bookings";

type Payload = { migrated: boolean; error?: string; hosts: BookingHost[]; templates: AvailabilityTemplate[]; slots: AdminSlot[]; notice?: string };

const API = "/api/admin/bookings/availability";
const WEEKDAY_OPTIONS = WEEKDAYS.map((d, i) => ({ value: String(i + 1), label: d[0].toUpperCase() + d.slice(1) }));
const BOX_H = "h-[560px]";

async function call(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: Payload & { error?: string; needsConfirm?: boolean } }> {
  const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

function Card({ title, right, children, footer }: { title: string; right?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className={`twx-card flex ${BOX_H} min-w-0 flex-col overflow-hidden`}>
      <header className="flex h-14 flex-none items-center justify-between gap-3 border-b px-5" style={{ borderColor: "var(--twx-line)" }}>
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {right}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>
      {footer && <footer className="flex-none border-t px-5 py-4" style={{ borderColor: "var(--twx-line)", background: "#fbf8f2" }}>{footer}</footer>}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="flex h-full items-center justify-center px-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>{children}</p>;
}

function TemplateRow({ t, hostName, busy, onToggle, onDelete }: {
  t: AvailabilityTemplate; hostName: string; busy: boolean; onToggle: () => void; onDelete: () => void;
}) {
  const menu = useActionMenu();
  const items: MenuItem[] = [
    { label: t.active ? "Kikapcsolás" : "Bekapcsolás", icon: MI.restore, onClick: onToggle, disabled: busy },
    { kind: "divider" },
    { label: "Törlés", icon: MI.trash, danger: true, onClick: onDelete, disabled: busy,
      hint: "A már létrehozott időpontok megmaradnak." },
  ];
  return (
    <li className="flex items-center gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: "var(--twx-line)", opacity: t.active ? 1 : 0.5 }}
      onContextMenu={menu.openAtEvent}>
      <span className="w-24 flex-none text-sm font-medium">{WEEKDAY_OPTIONS[t.weekday - 1]?.label}</span>
      <span className="flex-1 text-sm tabular-nums">{t.start}–{t.end} <span style={{ color: "var(--twx-ink-muted)" }}>· {t.slotMinutes} perc</span></span>
      <span className="w-20 flex-none truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>{hostName}</span>
      <span className="w-20 flex-none text-right text-[11px]">{!t.active && <span className="twx-badge-muted rounded-full px-2 py-0.5">Kikapcsolva</span>}</span>
      <MenuDots onClick={menu.openAtButton} />
      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}
    </li>
  );
}

function SlotRow({ s, hostName, busy, onDelete, onCancelBooking }: {
  s: AdminSlot; hostName: string; busy: boolean; onDelete: () => void; onCancelBooking: () => void;
}) {
  const menu = useActionMenu();
  const end = new Date(new Date(s.startsAt).getTime() + s.durationMin * 60_000).toISOString();
  const booked = s.status === "foglalt";
  // Foglalt időpontnál a törlés a FOGLALÁST törli (lemondja), az időpont azonnal újra szabad lesz.
  // Magát az időpontot csak szabad állapotban lehet törölni.
  const items: MenuItem[] = booked
    ? [{ label: "Foglalás törlése", icon: MI.trash, danger: true, onClick: onCancelBooking, disabled: busy,
        hint: "Az időpont megmarad, és azonnal újra szabad lesz." }]
    : [{ label: "Időpont törlése", icon: MI.trash, danger: true, onClick: onDelete, disabled: busy,
        hint: "Az időpont eltűnik a foglalható listából." }];
  return (
    <li className="flex h-11 items-center gap-3 border-b last:border-b-0" style={{ borderColor: "var(--twx-line)" }} onContextMenu={menu.openAtEvent}>
      <span className="w-28 flex-none text-sm tabular-nums">{fmtTime(s.startsAt)}–{fmtTime(end)}</span>
      <span className="w-16 flex-none truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>{hostName}</span>
      <span className="min-w-0 flex-1 truncate text-xs">
        {booked ? (
          <span className="inline-flex max-w-full items-center gap-2">
            <span className="twx-badge flex-none">Foglalt</span>
            <span className="truncate" title={s.bookedBy ?? ""}>{s.bookedBy ?? "—"}</span>
          </span>
        ) : (
          <span className="rounded-full px-2 py-0.5 font-semibold" style={{ background: "#e6f2ea", color: "#1f6b43" }}>Szabad</span>
        )}
      </span>
      <MenuDots onClick={menu.openAtButton} />
      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}
    </li>
  );
}

export default function BookingAvailabilityAdmin() {
  const [data, setData] = useState<Payload | null>(null);
  const [host, setHost] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const [confirmSlot, setConfirmSlot] = useState<AdminSlot | null>(null);

  // Sablon-űrlap
  const [tHost, setTHost] = useState("");
  const [tDay, setTDay] = useState("1");
  const [tStart, setTStart] = useState("09:00");
  const [tEnd, setTEnd] = useState("12:00");
  const [tLen, setTLen] = useState(String(BOOKING_DEFAULT_MINUTES));
  // Kézi időpont
  const [sHost, setSHost] = useState("");
  const [sDate, setSDate] = useState("");
  const [sTime, setSTime] = useState("10:00");
  const [sLen, setSLen] = useState(String(BOOKING_DEFAULT_MINUTES));

  const load = useCallback(async () => {
    const r = await fetch(API);
    const d = (await r.json().catch(() => null)) as Payload | null;
    setData(d ?? { migrated: false, hosts: [], templates: [], slots: [] });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const hosts = useMemo(() => data?.hosts ?? [], [data]);
  const hostName = useCallback((id: string) => hosts.find((h) => h.userId === id)?.name ?? "—", [hosts]);
  const hostOptions = hosts.map((h) => ({ value: h.userId, label: h.name }));
  // A gazda-váltó szerinti alapértelmezés az űrlapokban.
  useEffect(() => {
    const def = host !== "all" ? host : hosts[0]?.userId ?? "";
    setTHost(def); setSHost(def);
  }, [host, hosts]);

  async function run(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    try {
      const r = await call(body);
      if (r.status === 409 && r.data.needsConfirm) return r;
      if (!r.ok) { showToast(r.data.error ?? "Nem sikerült.", "error"); return r; }
      setData(r.data);
      if (r.data.notice || ok) showToast(r.data.notice ?? ok ?? "", "success");
      return r;
    } finally { setBusy(false); }
  }

  async function deleteSlot(s: AdminSlot) {
    const r = await run({ action: "delete_slot", id: s.id }, "Időpont törölve.");
    // Ha közben lefoglalták: ne törölje, hanem kérdezzen rá a foglalás törlésére.
    if (r?.status === 409) { showToast("Közben lefoglalták ezt az időpontot.", "info"); void load(); }
  }

  const templates = (data?.templates ?? []).filter((t) => host === "all" || t.hostId === host);
  const days = useMemo(() => {
    const m = new Map<string, AdminSlot[]>();
    for (const s of data?.slots ?? []) {
      if (host !== "all" && s.hostId !== host) continue;
      if (new Date(s.startsAt).getTime() < Date.now()) continue;
      const k = budapestDayKey(s.startsAt);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [data, host]);
  const freeCount = (data?.slots ?? []).filter((s) => s.status === "szabad" && (host === "all" || s.hostId === host)).length;

  if (!data) return <div className={`twx-card ${BOX_H} animate-pulse`} />;
  if (!data.migrated) {
    return <div className="twx-card p-6 text-sm">Futtasd le a <code>20261123190000_bookings.sql</code> migrációt.</div>;
  }

  const pill = (active: boolean) => `h-9 rounded-full px-4 text-sm font-medium transition-colors ${active ? "" : "hover:bg-[#EFE7DD]"}`;
  const todayKey = budapestDayKey(new Date().toISOString());

  return (
    <div className="space-y-4">
      {/* Gazda-váltó */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Gazda:</span>
        {[{ userId: "all", name: "Mindenki" }, ...hosts].map((h) => (
          <button key={h.userId} type="button" onClick={() => setHost(h.userId)} className={pill(host === h.userId)}
            style={host === h.userId ? { background: "var(--twx-dark)", color: "var(--twx-on-dark)" } : { color: "var(--twx-ink)" }}>
            {h.name}
          </button>
        ))}
      </div>

      {hosts.length === 0 && (
        <div className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Még nincs gazda. Vedd fel az adminokat a <code>booking_hosts</code> táblába (lásd a migráció utáni SQL-t), és itt megjelennek.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ===== Heti sablon ===== */}
        <Card
          title="Heti sablon"
          right={
            <button type="button" disabled={busy || templates.length === 0} onClick={() => run({ action: "apply_templates" })}
              className="twx-btn whitespace-nowrap text-xs" title="A következő 4 hétre létrehozza az időpontokat. Ismételhető, nem dupláz.">
              Sablon alkalmazása (4 hét)
            </button>
          }
          footer={
            <form className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_0.8fr_0.8fr_0.8fr_auto]"
              onSubmit={(e) => { e.preventDefault(); void run({ action: "add_template", hostId: tHost, weekday: Number(tDay), start: tStart, end: tEnd, slotMinutes: Number(tLen) }, "Sablon-sor hozzáadva."); }}>
              <SelectField size="sm" value={tHost} onChange={setTHost} options={hostOptions} ariaLabel="Gazda" placeholder="Gazda" />
              <SelectField size="sm" value={tDay} onChange={setTDay} options={WEEKDAY_OPTIONS} ariaLabel="Nap" searchable={false} />
              <SelectField size="sm" value={tStart} onChange={setTStart} options={TIME_OPTIONS} ariaLabel="Kezdés" />
              <SelectField size="sm" value={tEnd} onChange={setTEnd} options={TIME_OPTIONS} ariaLabel="Vége" />
              <SelectField size="sm" value={tLen} onChange={setTLen} options={DURATION_OPTIONS} ariaLabel="Hossz" searchable={false} />
              <button type="submit" disabled={busy || !tHost} className="twx-btn-outline text-xs">Hozzáadás</button>
            </form>
          }
        >
          {templates.length === 0 ? (
            <Empty>Még nincs sablon. Add meg alul, melyik nap mettől meddig érsz rá, majd „Sablon alkalmazása”.</Empty>
          ) : (
            <ul>
              {templates.map((t) => (
                <TemplateRow key={t.id} t={t} hostName={hostName(t.hostId)} busy={busy}
                  onToggle={() => run({ action: "toggle_template", id: t.id, active: !t.active })}
                  onDelete={() => run({ action: "delete_template", id: t.id }, "Sablon-sor törölve.")} />
              ))}
            </ul>
          )}
        </Card>

        {/* ===== Időpontok ===== */}
        <Card
          title="Időpontok — következő 4 hét"
          right={<span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{freeCount} szabad</span>}
          footer={
            <form className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1.3fr_0.8fr_0.8fr_auto]"
              onSubmit={(e) => { e.preventDefault(); void run({ action: "add_slot", hostId: sHost, date: sDate, time: sTime, duration: Number(sLen) }, "Időpont felvéve."); }}>
              <SelectField size="sm" value={sHost} onChange={setSHost} options={hostOptions} ariaLabel="Gazda" placeholder="Gazda" />
              <DateField size="sm" value={sDate} onChange={setSDate} min={todayKey} placeholder="Nap" />
              <SelectField size="sm" value={sTime} onChange={setSTime} options={TIME_OPTIONS} ariaLabel="Idő" />
              <SelectField size="sm" value={sLen} onChange={setSLen} options={DURATION_OPTIONS} ariaLabel="Hossz" searchable={false} />
              <button type="submit" disabled={busy || !sHost || !sDate} className="twx-btn-outline text-xs">Felvétel</button>
            </form>
          }
        >
          {days.length === 0 ? (
            <Empty>Nincs időpont a következő hetekre. Alkalmazd a heti sablont, vagy vegyél fel egyet alul.</Empty>
          ) : (
            <div className="space-y-4">
              {days.map(([key, list]) => (
                <div key={key}>
                  <p className="sticky top-0 z-[1] py-1 text-xs font-semibold uppercase tracking-wider"
                    style={{ background: "var(--twx-cream-card)", color: "var(--twx-ink-muted)" }}>{fmtDayKey(key)}</p>
                  <ul>
                    {list.map((s) => (
                      <SlotRow key={s.id} s={s} hostName={hostName(s.hostId)} busy={busy} onDelete={() => deleteSlot(s)}
                        onCancelBooking={() => setConfirmSlot(s)} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Lefoglalt időpont törlése: megerősítés (a foglalás lemondódik). */}
      {confirmSlot && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.55)" }}
          onMouseDown={() => setConfirmSlot(null)}>
          <div className="twx-card w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <h3 className="font-display text-lg font-semibold">Foglalás törlése</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              {fmtDayKey(budapestDayKey(confirmSlot.startsAt))} {fmtTime(confirmSlot.startsAt)} · {confirmSlot.bookedBy ?? ""}
            </p>
            <p className="mt-3 text-sm">A foglalás lemondódik, az időpont azonnal újra szabad lesz. A látogató e-mailben értesítést kap.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="twx-btn-outline" onClick={() => setConfirmSlot(null)}>Mégse</button>
              <button type="button" className="twx-btn" disabled={busy} style={{ background: "#b5372f", color: "#fff" }}
                onClick={async () => { await run({ action: "cancel_slot_booking", id: confirmSlot.id }); setConfirmSlot(null); }}>Foglalás törlése</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
