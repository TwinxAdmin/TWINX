// Admin → Foglalások → Beérkezett (terv 15 / 5.A): a foglalások és visszahívási kérések listája.
// Szűrő: állapot + „csak az enyém" (alapból be). Az Új foglalások felül. Soronként „⋯" menü: Állapot módosítása,
// Jegyzet, Lemondás, Céggé alakítás („Hamarosan" — a Cég-táblával, 4. lépés), Értesítés újraküldése.
// A kibontott sorban a teljes leírás (CSAK szövegként), a belső jegyzet és a foglalás története.
// Fix magasságú doboz, belül görgetés.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SelectField from "@/components/SelectField";
import { ActionMenu, MenuDots, MI, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";
import { showToast } from "@/components/Toast";
import {
  BOOKING_NEXT, BOOKING_STATUS_META, budapestDayKey, fmtDayKey, fmtTime,
  type AdminBooking, type BookingEvent, type BookingStatus,
} from "@/lib/bookings";

type Payload = { migrated: boolean; error?: string; me: string; hosts: { id: string; name: string }[]; bookings: AdminBooking[]; notice?: string };
const API = "/api/admin/bookings";

const FILTERS = [
  { value: "aktiv", label: "Aktív (Új, Egyeztetve)" },
  { value: "all", label: "Mind" },
  ...(Object.keys(BOOKING_STATUS_META) as BookingStatus[]).map((s) => ({ value: s, label: BOOKING_STATUS_META[s].label })),
];

const fmtCreated = (iso: string) =>
  new Intl.DateTimeFormat("hu-HU", { timeZone: "Europe/Budapest", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function StatusPill({ s }: { s: BookingStatus }) {
  const m = BOOKING_STATUS_META[s];
  return <span className="inline-flex w-[104px] justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: m.bg, color: m.fg }}>{m.label}</span>;
}

const EVENT_LABEL: Record<string, string> = { letrehozva: "Foglalás létrejött", allapot: "Állapot", lemondva: "Lemondva", ertesites: "Értesítés", jegyzet: "Jegyzet módosítva" };
function eventText(e: BookingEvent): string {
  const d = e.data ?? {};
  if (e.kind === "allapot") return `${BOOKING_STATUS_META[d.from as BookingStatus]?.label ?? d.from} → ${BOOKING_STATUS_META[d.to as BookingStatus]?.label ?? d.to}`;
  if (e.kind === "lemondva") return e.actor === "admin" ? "admin mondta le" : "a látogató mondta le";
  if (e.kind === "ertesites") {
    const yn = (v: unknown) => (v === true ? "elment" : v === false ? "HIBA" : "—");
    return `látogató: ${yn(d.visitor_mail)} · admin e-mail: ${yn(d.admin_mail)} · Telegram: ${d.telegram === null ? "nincs beállítva" : yn(d.telegram)}`;
  }
  return "";
}

function Row({ b, open, onToggle, busy, act }: {
  b: AdminBooking; open: boolean; onToggle: () => void; busy: boolean;
  act: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const menu = useActionMenu();
  const [events, setEvents] = useState<BookingEvent[] | null>(null);
  const [note, setNote] = useState(b.note ?? "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const active = b.status === "uj" || b.status === "egyeztetve";
  const notifyMissing = (!b.visitorMailSentAt && active) || !b.adminNotifiedAt;

  useEffect(() => { setNote(b.note ?? ""); }, [b.note]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`${API}?id=${b.id}`).then((r) => r.json()).then((d) => { if (alive) setEvents(d.events ?? []); }).catch(() => {});
    return () => { alive = false; };
  }, [open, b.id, b.status, b.note, b.visitorMailSentAt, b.adminNotifiedAt]);

  const items: MenuItem[] = [
    { kind: "sub", label: "Állapot módosítása", icon: MI.restore, title: "Új állapot",
      empty: "Ebből az állapotból nincs tovább.",
      items: BOOKING_NEXT[b.status].map((s) => ({ id: s, label: BOOKING_STATUS_META[s].label, onClick: async () => { await act({ action: "set_status", id: b.id, status: s }); menu.close(); } })) },
    { label: "Jegyzet", icon: MI.rename, onClick: () => { if (!open) onToggle(); } },
    { label: "Értesítés újraküldése", icon: MI.send, disabled: busy || !notifyMissing,
      hint: notifyMissing ? "A ki nem ment levelet küldi el újra." : "Minden értesítés kiment.", onClick: () => act({ action: "resend", id: b.id }) },
    { label: "Céggé alakítás", icon: MI.folder, disabled: true, hint: "Hamarosan — a Cégek lappal együtt (4. lépés).", onClick: () => {} },
    { kind: "divider" },
    { label: "Lemondás", icon: MI.trash, danger: true, disabled: busy || !active,
      hint: active ? "Az időpont újra szabad lesz, a látogató értesítést kap." : "Csak aktív foglalás mondható le.", onClick: () => setConfirmCancel(true) },
  ];

  return (
    <li className="border-b last:border-b-0" style={{ borderColor: "var(--twx-line)", background: b.status === "uj" ? "#fff7f2" : undefined }}>
      <div className="flex h-14 cursor-pointer items-center gap-3 px-4 text-sm" onClick={onToggle} onContextMenu={menu.openAtEvent}>
        <StatusPill s={b.status} />
        <span className="w-36 flex-none tabular-nums">
          {b.startsAt ? <>{fmtDayKey(budapestDayKey(b.startsAt)).replace(/,.*$/, "")} {fmtTime(b.startsAt)}</> : <span style={{ color: "var(--twx-ink-muted)" }}>Visszahívás</span>}
        </span>
        <span className="w-14 flex-none truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>{b.hostName ?? "—"}</span>
        <span className="min-w-0 flex-[1.2] truncate font-medium">{b.name} <span className="font-normal" style={{ color: "var(--twx-ink-muted)" }}>· {b.company}</span></span>
        <span className="hidden w-32 flex-none truncate text-xs tabular-nums md:block">{b.phone}</span>
        <span className="hidden min-w-0 flex-1 truncate text-xs lg:block" style={{ color: "var(--twx-ink-muted)" }}>{b.message ?? ""}</span>
        {/* Fix hely a figyelmeztetésnek — nem tolja el a sort. */}
        <span className="w-5 flex-none text-center" title={notifyMissing ? "Az értesítés nem ment ki." : ""}>
          {notifyMissing && <span style={{ color: "#b5372f" }}>!</span>}
        </span>
        <span onClick={(e) => e.stopPropagation()}><MenuDots onClick={menu.openAtButton} /></span>
      </div>
      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}

      {open && (
        <div className="grid gap-5 px-4 pb-5 pt-1 text-sm md:grid-cols-2" style={{ background: "#fbf8f2" }}>
          <div className="space-y-2">
            <p><span style={{ color: "var(--twx-ink-muted)" }}>E-mail:</span> {b.email}</p>
            <p><span style={{ color: "var(--twx-ink-muted)" }}>Telefon:</span> {b.phone}</p>
            <p><span style={{ color: "var(--twx-ink-muted)" }}>Beérkezett:</span> {fmtCreated(b.createdAt)} · forrás: {b.source}{b.registered ? " · regisztrált felhasználó" : ""}</p>
            {b.handledBy && <p><span style={{ color: "var(--twx-ink-muted)" }}>Kezelte:</span> {b.handledBy}</p>}
            <p className="pt-1" style={{ color: "var(--twx-ink-muted)" }}>Mit modernizálna:</p>
            {/* Külső, nem megbízható szöveg — CSAK szövegként. */}
            <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-lg p-3" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
              {b.message || "—"}
            </p>
            {notifyMissing && (
              <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "#fdecea", color: "#8a2a22" }}>
                Nem ment ki minden értesítés{!b.visitorMailSentAt && active ? " (a látogatónak)" : ""}{!b.adminNotifiedAt ? " (nektek)" : ""}.
                Újraküldés a „⋯” menüből.
              </p>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <p className="mb-1" style={{ color: "var(--twx-ink-muted)" }}>Belső jegyzet</p>
              <textarea className="twx-input h-20 w-full resize-none text-sm" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
              <div className="mt-1 flex justify-end">
                <button type="button" className="twx-btn-outline text-xs" disabled={busy || note === (b.note ?? "")}
                  onClick={() => act({ action: "note", id: b.id, note })}>Jegyzet mentése</button>
              </div>
            </div>
            <div>
              <p className="mb-1" style={{ color: "var(--twx-ink-muted)" }}>Története</p>
              <ul className="max-h-36 space-y-1 overflow-y-auto text-xs">
                {events === null ? <li style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</li> : events.map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className="w-24 flex-none tabular-nums" style={{ color: "var(--twx-ink-muted)" }}>{fmtCreated(e.at)}</span>
                    <span><b>{EVENT_LABEL[e.kind] ?? e.kind}</b> {eventText(e)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {confirmCancel && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(18,16,14,0.55)" }}
          onMouseDown={() => setConfirmCancel(false)}>
          <div className="twx-card w-full max-w-md p-6" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <h3 className="font-display text-lg font-semibold">Foglalás lemondása</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              {b.name} · {b.company}{b.startsAt ? ` · ${fmtDayKey(budapestDayKey(b.startsAt))} ${fmtTime(b.startsAt)}` : ""}
            </p>
            <p className="mt-3 text-sm">A foglalás lemondódik, az időpont újra szabad lesz, a látogató e-mailben értesítést kap.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="twx-btn-outline" onClick={() => setConfirmCancel(false)}>Mégse</button>
              <button type="button" className="twx-btn" disabled={busy} style={{ background: "#b5372f", color: "#fff" }}
                onClick={async () => { await act({ action: "cancel", id: b.id }); setConfirmCancel(false); }}>Lemondás</button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export default function BookingInboxAdmin() {
  const [data, setData] = useState<Payload | null>(null);
  const [filter, setFilter] = useState("aktiv");
  const [mine, setMine] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(API);
    setData(((await r.json().catch(() => null)) as Payload | null) ?? { migrated: false, me: "", hosts: [], bookings: [] });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return false; }
      setData(d as Payload);
      if (d.notice) showToast(d.notice, "success");
      return true;
    } finally { setBusy(false); }
  }, []);

  const list = useMemo(() => {
    const all = data?.bookings ?? [];
    const f = all.filter((b) =>
      (filter === "all" || (filter === "aktiv" ? b.status === "uj" || b.status === "egyeztetve" : b.status === filter))
      // „Csak az enyém": a saját időpontjaim + a gazda nélküli visszahívási kérések (azokat bárki viheti).
      && (!mine || b.hostId === data?.me || !b.hostId));
    return [...f].sort((a, b) => (a.status === "uj" ? 0 : 1) - (b.status === "uj" ? 0 : 1) || b.createdAt.localeCompare(a.createdAt));
  }, [data, filter, mine]);

  if (!data) return <div className="twx-card h-[640px] animate-pulse" />;
  if (!data.migrated) return <div className="twx-card p-6 text-sm">Futtasd le a <code>20261123190000_bookings.sql</code> migrációt.</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64"><SelectField size="sm" value={filter} onChange={setFilter} options={FILTERS} ariaLabel="Állapot" searchable={false} /></div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 accent-[#ef7a5a]" />
          Csak az enyém <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>(+ a visszahívási kérések)</span>
        </label>
        <span className="ml-auto text-xs" style={{ color: "var(--twx-ink-muted)" }}>{list.length} tétel</span>
      </div>
      <section className="twx-card h-[640px] overflow-y-auto">
        {list.length === 0 ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            {data.bookings.length === 0 ? "Még nem érkezett foglalás. Ha valaki foglal a kapcsolatblokkban, itt jelenik meg." : "Ezzel a szűrővel nincs találat."}
          </p>
        ) : (
          <ul>
            {list.map((b) => (
              <Row key={b.id} b={b} open={openId === b.id} busy={busy} act={act}
                onToggle={() => setOpenId((v) => (v === b.id ? null : b.id))} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
