// OfficeMessagesRow — az irodai felület üzenet-sora (megjelenési terv):
//   BAL  (világos): Fogadott / Elküldött üzenetek — szűrő: Mind · Feladat · Kész munka · Üzenet · Kreditkérés
//   JOBB (sötét):   Üzenet küldése — típus, címzett (egy kolléga vagy „Mindenki" egy gombnyomással),
//                   szöveg, feladatnál határidő + modul, mappa csatolása; kollégánál Kreditkérés is.
// Mindkét kártya FIX magasságú (a tartalom belül görget), üresen is szép üres állapottal.
// Feladat: „Elvállalom" (Mindenkinél az első vállaló nyer) → „Késznek jelölöm". Olvasatlan: korall pötty.
// Minden változás után „twx-office-messages" esemény → a Feladataim kártya és a fejléc-jelzés is frissül.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OfficeCreditRequest, OfficeFolder } from "@/lib/office";
import { ALLOCATE_MAX } from "@/lib/office";
import { MESSAGE_BODY_MAX, MESSAGE_KIND_LABEL, type MessageKind, type OfficeMessage } from "@/lib/office-messages-shared";
import { selectableModules } from "@/lib/module-favorites";
import { avatarColor, fmtDue, fmtFull, fmtWhen, initials } from "@/lib/office-format";
import { showToast } from "@/components/Toast";
import { EmptyState, Icons, OfficeCard } from "@/components/office/OfficeUi";
import SelectField from "@/components/SelectField";
import DateField from "@/components/DateField";

const HEIGHT = 360;
type Filter = "all" | MessageKind | "credit";
type Box = "inbox" | "sent";
type Member = { userId: string; name: string };
type Item =
  | { type: "msg"; at: string; m: OfficeMessage }
  | { type: "credit"; at: string; c: OfficeCreditRequest };

export const OFFICE_MESSAGES_EVENT = "twx-office-messages";
const notifyChanged = () => window.dispatchEvent(new CustomEvent(OFFICE_MESSAGES_EVENT));

const KIND_CHIP: Record<MessageKind | "credit", { bg: string; fg: string }> = {
  task: { bg: "#FDE6C8", fg: "#7A4A06" },
  done: { bg: "#DDF0E4", fg: "#1F5C38" },
  message: { bg: "#F1EAE1", fg: "#4A433C" },
  credit: { bg: "#FBE1D6", fg: "#A8411F" },
};

export default function OfficeMessagesRow({ canDecide, reloadKey = 0, onDecided }: {
  canDecide: boolean; reloadKey?: number; onDecided?: () => void;
}) {
  const [box, setBox] = useState<Box>("inbox");
  const [filter, setFilter] = useState<Filter>("all");
  const [msgs, setMsgs] = useState<OfficeMessage[] | null>(null);
  const [credits, setCredits] = useState<OfficeCreditRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [meId, setMeId] = useState("");
  const [folders, setFolders] = useState<OfficeFolder[]>([]);
  const [replyTo, setReplyTo] = useState<OfficeMessage | null>(null);
  const [tick, setTick] = useState(0);
  // megnyitott üzenet (kulcs + utolsó pozíció, hogy egy eltűnő tétel — pl. jóváhagyott kreditkérés — után a következőre ugorjunk)
  const [open, setOpen] = useState<{ key: string; idx: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([
        fetch(`/api/office/messages?box=${box}`).then((r) => r.json()),
        box === "inbox" && canDecide ? fetch("/api/office/credit-requests").then((r) => r.json()) : Promise.resolve({ pending: [] }),
      ]);
      if (m.error) setError(m.error); else setError(null);
      setMsgs(m.items ?? []);
      setCredits(c.pending ?? []);
    } catch {
      setError("Nem sikerült betölteni az üzeneteket.");
      setMsgs([]);
    }
  }, [box, canDecide]);

  useEffect(() => { void load(); }, [load, reloadKey, tick]);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(OFFICE_MESSAGES_EVENT, on);
    return () => window.removeEventListener(OFFICE_MESSAGES_EVENT, on);
  }, []);

  useEffect(() => {
    fetch("/api/office/folders").then((r) => r.json()).then((d) => {
      if (d.error) return;
      setMembers(d.members ?? []); setMeId(d.meId ?? ""); setFolders(d.folders ?? []);
    }).catch(() => {});
  }, [reloadKey]);

  const items: Item[] = useMemo(() => {
    const list: Item[] = [
      ...(msgs ?? []).map((m) => ({ type: "msg" as const, at: m.createdAt, m })),
      ...credits.map((c) => ({ type: "credit" as const, at: c.createdAt, c })),
    ];
    return list
      .filter((it) => filter === "all" || (filter === "credit" ? it.type === "credit" : it.type === "msg" && it.m.kind === filter))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [msgs, credits, filter]);

  // ha az utolsó tétel is eltűnt (pl. jóváhagyott kreditkérés), az ablak bezárul
  useEffect(() => { if (open && msgs && items.length === 0) setOpen(null); }, [open, msgs, items.length]);

  const unread = (msgs ?? []).filter((m) => !m.read).length + (box === "inbox" ? credits.length : 0);

  async function patch(id: string | null, action: string, okText?: string) {
    setBusy(id ?? action);
    try {
      const res = await fetch("/api/office/messages", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
      if (okText) showToast(okText, "success");
      notifyChanged();
    } catch {
      showToast("Hálózati hiba.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function decideCredit(c: OfficeCreditRequest, action: "approve" | "reject") {
    setBusy(c.id);
    try {
      const res = await fetch("/api/office/credit-requests", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, action }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
      const first = (c.name || c.email).split(" ").slice(-1)[0];
      showToast(action === "approve" ? `${c.amount} kredit jóváírva — ${first}` : "Kérés elutasítva.", action === "approve" ? "success" : "info");
      onDecided?.();
      notifyChanged();
    } catch {
      showToast("Hálózati hiba.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-stretch gap-4">
      {/* ===================== FOGADOTT / ELKÜLDÖTT ===================== */}
      <OfficeCard title={box === "inbox" ? "Fogadott üzenetek" : "Elküldött üzenetek"} height={HEIGHT} className="flex-[3_1_560px]"
        badge={box === "inbox" && unread > 0
          ? <span className="rounded-full px-2 py-[3px] text-[11px] font-semibold" style={{ background: "#F08A68", color: "#1C1A17" }}>{unread} új</span>
          : undefined}
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "task", "done", "message"] as Filter[]).map((f) => (
              <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>{f === "all" ? "Mind" : MESSAGE_KIND_LABEL[f as MessageKind]}</FilterChip>
            ))}
            {canDecide && box === "inbox" && (
              <FilterChip active={filter === "credit"} onClick={() => setFilter("credit")}>Kreditkérés</FilterChip>
            )}
          </div>
        }>
        <div className="flex h-full flex-col gap-2">
          <div className="flex flex-none items-center justify-between text-xs">
            <div className="flex gap-3">
              <button type="button" onClick={() => setBox("inbox")} className="font-semibold" style={{ color: box === "inbox" ? "#1C1A17" : "#8F857B", textDecoration: box === "inbox" ? "underline" : "none", textUnderlineOffset: 4 }}>Fogadott</button>
              <button type="button" onClick={() => setBox("sent")} className="font-semibold" style={{ color: box === "sent" ? "#1C1A17" : "#8F857B", textDecoration: box === "sent" ? "underline" : "none", textUnderlineOffset: 4 }}>Elküldött</button>
            </div>
            {box === "inbox" && (msgs ?? []).some((m) => !m.read) && (
              <button type="button" onClick={() => void patch(null, "readAll")} className="font-semibold" style={{ color: "#C2512F" }}>Mind olvasott</button>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          {!msgs && !error && <p className="text-sm" style={{ color: "#6B6258" }}>Betöltés…</p>}

          {msgs && items.length === 0 && (
            <div className="min-h-0 flex-1">
              <EmptyState icon={Icons.inbox}
                title={box === "inbox" ? (filter === "all" ? "Nincs új üzeneted" : `Nincs ${MESSAGE_KIND_LABEL[filter as MessageKind | "credit"].toLowerCase()} típusú üzenet`) : "Még nem küldtél üzenetet"}
                text={box === "inbox"
                  ? canDecide
                    ? "Itt jelennek meg a kollégák üzenetei, kész munkái és kredit-kérései — egy kattintással jóváhagyhatod."
                    : "Itt jelennek meg a vezetőd és a kollégáid üzenetei és feladatai."
                  : "Írj egy üzenetet vagy adj ki egy feladatot a jobb oldalon."} />
            </div>
          )}

          {items.length > 0 && (
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl" style={{ border: "1px solid #EFE7DD" }}>
              {items.map((it, i) => (
                <CompactRow key={itemKey(it)} it={it} first={i === 0} box={box} onOpen={() => setOpen({ key: itemKey(it), idx: i })} />
              ))}
            </ul>
          )}
        </div>
      </OfficeCard>

      {open && items.length > 0 && (
        <MessageViewer items={items} open={open} setOpen={setOpen} meId={meId} box={box} busy={busy}
          onClose={() => setOpen(null)}
          onRead={(id) => void patch(id, "read")}
          onAccept={(id) => void patch(id, "accept", "Elvállaltad a feladatot.")}
          onDone={(id) => void patch(id, "done", "Feladat késznek jelölve.")}
          onReopen={(id) => void patch(id, "reopen", "Feladat újranyitva.")}
          onReply={(m) => { setReplyTo(m); setOpen(null); }}
          onDecide={(c, a) => void decideCredit(c, a)} />
      )}

      {/* ===================== ÜZENET KÜLDÉSE ===================== */}
      <SendPanel members={members.filter((m) => m.userId !== meId)} folders={folders} canAskCredit={!canDecide}
        replyTo={replyTo} onClearReply={() => setReplyTo(null)}
        onSent={() => { setBox("sent"); notifyChanged(); }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
const itemKey = (it: Item) => (it.type === "credit" ? `c-${it.c.id}` : it.m.id);

/** Tömör, egysoros lista-elem — kattintásra nyílik a részletes ablak. */
function CompactRow({ it, first, box, onOpen }: { it: Item; first: boolean; box: Box; onOpen: () => void }) {
  const isCredit = it.type === "credit";
  const who = isCredit
    ? { id: it.c.userId, name: it.c.name || it.c.email }
    : box === "sent" ? it.m.recipient : it.m.sender;
  const kind: MessageKind | "credit" = isCredit ? "credit" : it.m.kind;
  const chip = KIND_CHIP[kind];
  const unread = isCredit || !it.m.read;
  const preview = isCredit ? `${it.c.amount} kredit keretet kér${it.c.note ? `: ${it.c.note}` : ""}` : it.m.body;
  const av = avatarColor(who.id ?? "all");
  return (
    <li style={{ borderTop: first ? "none" : "1px solid #EFE7DD" }}>
      <button type="button" onClick={onOpen}
        className="flex h-[52px] w-full items-center gap-3 px-3.5 text-left transition-colors hover:bg-[#FBF6F0]"
        style={{ background: unread ? "#FFF6F1" : "#fff" }}>
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: av.bg, color: av.fg }}>
          {who.id ? initials(who.name) : "∀"}
        </span>
        <strong className={`w-[120px] flex-none truncate text-[13px] ${unread ? "" : "font-medium"}`}>{box === "sent" && !isCredit ? `→ ${who.name}` : who.name}</strong>
        <span className="flex-none whitespace-nowrap rounded-full px-2 py-[2px] text-[11px] font-semibold" style={{ background: chip.bg, color: chip.fg }}>{MESSAGE_KIND_LABEL[kind]}</span>
        <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: unread ? "#2E2A25" : "#6B6258" }}>{preview}</span>
        <span className="flex-none whitespace-nowrap text-[11px]" style={{ color: "#8F857B" }}>{fmtWhen(it.at)}</span>
        <span className="h-2 w-2 flex-none rounded-full" style={{ background: unread ? "#E3683F" : "transparent" }} />
      </button>
    </li>
  );
}

/**
 * Részletes üzenet-ablak — levelezőprogram-szerű elrendezés, FIX méret:
 *   felül eszközsor (típus · lapozó ‹ 3/12 › · bezárás)
 *   fejléc (tárgy, feladó avatarral, címzett, teljes időpont)
 *   törzs (görgethető szöveg)
 *   alul: adatsáv (határidő, állapot, mappa, munka / kért összeg) + művelet-sáv
 * Lapozás: gombok és ←/→ billentyű; Esc bezár.
 */
function MessageViewer({ items, open, setOpen, meId, box, busy, onClose, onRead, onAccept, onDone, onReopen, onReply, onDecide }: {
  items: Item[]; open: { key: string; idx: number }; setOpen: (o: { key: string; idx: number } | null) => void;
  meId: string; box: Box; busy: string | null; onClose: () => void;
  onRead: (id: string) => void; onAccept: (id: string) => void; onDone: (id: string) => void; onReopen: (id: string) => void;
  onReply: (m: OfficeMessage) => void; onDecide: (c: OfficeCreditRequest, a: "approve" | "reject") => void;
}) {
  const found = items.findIndex((it) => itemKey(it) === open.key);
  const idx = found >= 0 ? found : Math.min(open.idx, items.length - 1);
  const it = items[idx];
  const go = useCallback((d: number) => {
    const n = idx + d;
    if (n < 0 || n >= items.length) return;
    setOpen({ key: itemKey(items[n]), idx: n });
  }, [idx, items, setOpen]);

  // olvasottnak jelölés megnyitáskor
  const unreadId = it.type === "msg" && !it.m.read && box === "inbox" ? it.m.id : null;
  useEffect(() => { if (unreadId) onRead(unreadId); }, [unreadId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [go, onClose]);

  const v = viewModel(it, box, meId, busy, { onAccept, onDone, onReopen, onReply, onDecide });
  const chip = KIND_CHIP[v.kind];
  const av = avatarColor(v.fromId ?? "all");

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(12,11,10,0.72)" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={v.title}
        className="flex h-[min(620px,88vh)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl"
        style={{ background: "#FDFBF6", border: "1px solid #E8E1D6", color: "#1C1815", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>

        {/* ── eszközsor ── */}
        <div className="flex h-12 flex-none items-center gap-3 px-4" style={{ borderBottom: "1px solid #EFE7DD", background: "#F7F3EC" }}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "#8F857B" }}>
            {box === "inbox" ? "Fogadott" : "Elküldött"}
          </span>
          <span className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold" style={{ background: chip.bg, color: chip.fg }}>
            {MESSAGE_KIND_LABEL[v.kind]}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <span className="mr-1.5 text-xs tabular-nums" style={{ color: "#6B6258" }}>{idx + 1} / {items.length}</span>
            <IconBtn label="Újabb üzenet (←)" disabled={idx <= 0} onClick={() => go(-1)}>
              <path d="m15 18-6-6 6-6" />
            </IconBtn>
            <IconBtn label="Korábbi üzenet (→)" disabled={idx >= items.length - 1} onClick={() => go(1)}>
              <path d="m9 18 6-6-6-6" />
            </IconBtn>
            <span className="mx-1.5 h-5 w-px" style={{ background: "#E1D6C9" }} />
            <IconBtn label="Bezárás (Esc)" onClick={onClose}>
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </IconBtn>
          </div>
        </div>

        {/* ── fejléc ── */}
        <div className="flex-none px-7 pb-5 pt-6" style={{ borderBottom: "1px solid #EFE7DD" }}>
          <h2 className="font-display text-[22px] font-semibold leading-snug">{v.title}</h2>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-semibold" style={{ background: av.bg, color: av.fg }}>
              {v.fromId ? initials(v.from) : "∀"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold">{v.from}</p>
              <p className="truncate text-xs" style={{ color: "#6B6258" }}>
                <span style={{ color: "#8F857B" }}>Címzett:</span> {v.to}
              </p>
            </div>
            <time className="flex-none text-right text-xs" style={{ color: "#6B6258" }} dateTime={v.at}>{fmtFull(v.at)}</time>
          </div>
        </div>

        {/* ── törzs ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
          {v.body}
        </div>

        {/* ── adatsáv ── */}
        {v.meta.length > 0 && (
          <div className="flex flex-none flex-wrap items-stretch gap-x-6 gap-y-3 px-7 py-3.5" style={{ borderTop: "1px solid #EFE7DD", background: "#F7F3EC" }}>
            {v.meta.map((m) => (
              <div key={m.label} className="flex min-w-0 flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "#8F857B" }}>{m.label}</span>
                <div className="flex min-h-[24px] items-center">{m.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── művelet-sáv ── */}
        <div className="flex h-[64px] flex-none items-center gap-2 px-7" style={{ borderTop: "1px solid #EFE7DD" }}>
          <div className="flex items-center gap-2">{v.secondary}</div>
          <div className="ml-auto flex items-center gap-2">{v.primary}</div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[#EFE7DD] disabled:opacity-30 disabled:hover:bg-transparent">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
    </button>
  );
}

type ViewModel = {
  kind: MessageKind | "credit";
  title: string;
  from: string; fromId: string | null;
  to: string;
  at: string;
  body: React.ReactNode;
  meta: { label: string; value: React.ReactNode }[];
  secondary: React.ReactNode;
  primary: React.ReactNode;
};

const bodyText = (t: string) => (
  <p className="whitespace-pre-line break-words text-[15px] leading-7" style={{ color: "#2E2A25" }}>{t}</p>
);

function viewModel(it: Item, box: Box, meId: string, busy: string | null, h: {
  onAccept: (id: string) => void; onDone: (id: string) => void; onReopen: (id: string) => void;
  onReply: (m: OfficeMessage) => void; onDecide: (c: OfficeCreditRequest, a: "approve" | "reject") => void;
}): ViewModel {
  if (it.type === "credit") {
    const c = it.c;
    const first_ = (c.name || c.email).split(" ").slice(-1)[0];
    const b = busy === c.id;
    return {
      kind: "credit",
      title: `${c.amount} kredit keretet kér`,
      from: c.name || c.email, fromId: c.userId,
      to: "Iroda vezetői",
      at: c.createdAt,
      body: c.note ? bodyText(c.note) : <p className="text-[14px] italic" style={{ color: "#8F857B" }}>Nem írt megjegyzést.</p>,
      meta: [
        { label: "Kért összeg", value: <span className="font-display text-lg font-bold tabular-nums">{c.amount} kredit</span> },
        { label: "Állapot", value: <Pill bg="#FDE6C8" fg="#7A4A06">Döntésre vár</Pill> },
      ],
      secondary: <ActionBtn disabled={b} onClick={() => h.onDecide(c, "reject")}>Elutasítás</ActionBtn>,
      primary: <ActionBtn dark disabled={b} onClick={() => h.onDecide(c, "approve")}>+{c.amount} kredit {first_} keretébe</ActionBtn>,
    };
  }

  const m = it.m;
  const t = m.task;
  const b = busy === m.id;
  const mineToDo = !!t && !m.mine && (t.assignee?.id === meId || (!t.assignee && (m.recipient.id === meId || m.recipient.id === null)));
  const title = m.kind === "task"
    ? (box === "sent" ? "Kiadott feladat" : m.recipient.id === null ? "Új feladat az irodának" : "Új feladat neked")
    : m.kind === "done" ? (box === "sent" ? "Jelzett kész munka" : "Elkészült egy munka")
    : m.parentId ? "Válasz" : "Üzenet";

  const meta: ViewModel["meta"] = [];
  if (m.dueDate) meta.push({ label: "Határidő", value: <DueChip ymd={m.dueDate} done={t?.status === "done"} prefix={false} /> });
  if (t) meta.push({ label: "Állapot", value: <TaskChip status={t.status} assignee={t.assignee?.name ?? null} /> });
  if (m.folder) meta.push({
    label: "Mappa",
    value: (
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-office-folder", { detail: { id: m.folder!.id } }))}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold transition-colors hover:bg-[#F1EAE1]"
        style={{ background: "#fff", border: "1px solid #E1D6C9", color: "#4A433C" }}>
        {Icons.folder}<span className="max-w-[180px] truncate">{m.folder.name}</span>
      </button>
    ),
  });
  if (m.work) meta.push({
    label: "Csatolt munka",
    value: <span className="max-w-[240px] truncate text-[12px] font-semibold" style={{ color: "#4A433C" }}>{m.work.moduleLabel} · {m.work.title}</span>,
  });
  if (m.moduleHref && t) meta.push({ label: "Modul", value: <span className="text-[12px] font-semibold" style={{ color: "#4A433C" }}>{m.moduleLabel ?? "Modul"}</span> });

  const primary: React.ReactNode[] = [];
  if (mineToDo && m.moduleHref && t?.status !== "done") primary.push(
    <a key="mod" href={m.moduleHref} className="inline-flex h-[30px] items-center rounded-full px-3 text-xs font-semibold" style={{ background: "#F08A68", color: "#1C1A17" }}>
      {m.moduleLabel ?? "Modul"} indítása
    </a>,
  );
  if (mineToDo && t?.status === "open") primary.push(<ActionBtn key="acc" dark disabled={b} onClick={() => h.onAccept(m.id)}>Elvállalom</ActionBtn>);
  if (mineToDo && t && t.status !== "done" && (t.status === "accepted" || m.recipient.id === meId)) primary.push(
    <ActionBtn key="done" dark={t.status === "accepted"} disabled={b} onClick={() => h.onDone(m.id)}>Késznek jelölöm</ActionBtn>,
  );
  if (m.mine && t?.status === "done") primary.push(<ActionBtn key="re" disabled={b} onClick={() => h.onReopen(m.id)}>Újranyitás</ActionBtn>);

  const from = box === "sent" ? "Te" : m.sender.name;
  const to = m.recipient.id === null ? "Mindenki (az egész iroda)" : m.recipient.id === meId ? "Neked" : m.recipient.name;

  return {
    kind: m.kind,
    title,
    from, fromId: box === "sent" ? meId || null : m.sender.id,
    to,
    at: m.createdAt,
    body: bodyText(m.body),
    meta,
    secondary: !m.mine ? (
      <ActionBtn disabled={b} onClick={() => h.onReply(m)}>
        <span className="inline-flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 17 4 12l5-5" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></svg>
          Válasz
        </span>
      </ActionBtn>
    ) : null,
    primary: primary.length ? primary : null,
  };
}

function Pill({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return <span className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold" style={{ background: bg, color: fg }}>{children}</span>;
}

function DueChip({ ymd, done = false, prefix = true }: { ymd: string; done?: boolean; prefix?: boolean }) {
  const d = fmtDue(ymd);
  const st = done ? { bg: "#F1EAE1", fg: "#6B6258" } : d.overdue ? { bg: "#FBE1D6", fg: "#A8411F" } : d.soon ? { bg: "#FDE6C8", fg: "#7A4A06" } : { bg: "#F1EAE1", fg: "#4A433C" };
  return <span className="rounded-full px-2 py-[3px] text-[11px] font-semibold" style={{ background: st.bg, color: st.fg }}>{prefix ? "Határidő: " : ""}{d.text}</span>;
}

function TaskChip({ status, assignee }: { status: "open" | "accepted" | "done"; assignee: string | null }) {
  const s = status === "done"
    ? { bg: "#DDF0E4", fg: "#1F5C38", t: `✓ Kész${assignee ? ` — ${assignee}` : ""}` }
    : status === "accepted"
      ? { bg: "#DCE8F5", fg: "#24476B", t: `Folyamatban — ${assignee ?? "?"}` }
      : { bg: "#F1EAE1", fg: "#6B6258", t: "Még senki nem vállalta" };
  return <span className="rounded-full px-2 py-[3px] text-[11px] font-semibold" style={{ background: s.bg, color: s.fg }}>{s.t}</span>;
}

function ActionBtn({ children, dark = false, disabled, onClick }: { children: React.ReactNode; dark?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className="h-[30px] rounded-full px-3 text-xs font-semibold disabled:opacity-50"
      style={dark ? { background: "#1C1A17", color: "#fff" } : { background: "#fff", color: "#1C1A17", border: "1px solid #E1D6C9" }}>
      {children}
    </button>
  );
}

function FilterChip({ children, active = false, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className="rounded-full px-2 py-[3px] text-[11px] font-semibold"
      style={active ? { background: "#1C1A17", color: "#fff" } : { background: "#F1EAE1", color: "#4A433C" }}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Üzenet küldése (sötét panel)
// ---------------------------------------------------------------------------
type SendKind = MessageKind | "credit";

function SendPanel({ members, folders, canAskCredit, replyTo, onClearReply, onSent }: {
  members: Member[]; folders: OfficeFolder[]; canAskCredit: boolean;
  replyTo: OfficeMessage | null; onClearReply: () => void; onSent: () => void;
}) {
  const modules = useMemo(() => selectableModules(), []);
  const [kind, setKind] = useState<SendKind>("task");
  const [to, setTo] = useState<string>("");          // "" = még nincs kiválasztva, "*" = Mindenki
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [moduleHref, setModuleHref] = useState("");
  const [folderId, setFolderId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Válasz: a címzett a feladó, a típus üzenet, kapcsolódik az eredetihez.
  useEffect(() => {
    if (!replyTo) return;
    setKind("message");
    setTo(replyTo.sender.id ?? "");
    setError(null);
  }, [replyTo]);

  const kinds: SendKind[] = canAskCredit ? ["task", "done", "message", "credit"] : ["task", "done", "message"];
  const isCredit = kind === "credit";
  // „Mindenki"-nél csak az egész irodának látható mappa csatolható
  const folderOptions = to === "*" ? folders.filter((f) => f.everyone) : folders;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  async function send() {
    setError(null);
    if (isCredit) {
      const n = Number(amount);
      if (!Number.isInteger(n) || n < 1 || n > ALLOCATE_MAX) { setError(`1 és ${ALLOCATE_MAX} közötti kreditet kérhetsz.`); return; }
      setBusy(true);
      try {
        const res = await fetch("/api/office/credit-requests", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: n, note: body.trim() }),
        });
        const d = await res.json();
        if (!res.ok) { setError(d.errors?.amount ?? d.error ?? "Nem sikerült elküldeni."); return; }
        showToast("Kredit-kérés elküldve a vezetőnek.", "success");
        setAmount(""); setBody("");
      } catch { setError("Hálózati hiba."); } finally { setBusy(false); }
      return;
    }

    if (!to) { setError("Válassz címzettet — vagy nyomd meg a „Mindenki” gombot."); return; }
    if (!body.trim()) { setError("Írd meg az üzenetet."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/office/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, recipientId: to === "*" ? null : to, body,
          dueDate: kind === "task" ? due || null : null,
          moduleHref: kind === "task" ? moduleHref || null : null,
          folderId: folderId || null,
          parentId: replyTo?.id ?? null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        const e = d.errors ? Object.values(d.errors as Record<string, string>)[0] : d.error;
        setError(e ?? "Nem sikerült elküldeni.");
        return;
      }
      showToast(kind === "task" ? "Feladat kiadva." : "Üzenet elküldve.", "success");
      setBody(""); setDue(""); setModuleHref(""); setFolderId(""); onClearReply();
      onSent();
    } catch { setError("Hálózati hiba."); } finally { setBusy(false); }
  }

  const fieldStyle = { background: "#1B1815", border: "1px solid #2E2723", color: "#F3EDE6" } as const;

  return (
    <section className="flex min-w-0 flex-[2_1_380px] flex-col overflow-hidden rounded-2xl"
      style={{
        height: HEIGHT,
        background: "#121110",
        backgroundImage: "radial-gradient(ellipse 320px 200px at 100% 0%, rgba(238,123,91,0.2), transparent 70%)",
        border: "1px solid #2A2420",
        color: "#F3EDE6",
      }}>
      <div className="flex flex-none items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-[18px]">
        <h2 className="font-display text-[17px] font-semibold" style={{ color: "#F6F1EA" }}>{replyTo ? "Válasz" : "Üzenet küldése"}</h2>
        {replyTo && (
          <button type="button" onClick={onClearReply} className="text-xs" style={{ color: "#BFB4A8" }}>Mégse ×</button>
        )}
      </div>

      {/* görgethető tartalom — a panel magassága fix */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-4 sm:px-[18px]">
        {replyTo && (
          <p className="truncate rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "rgba(255,255,255,0.05)", color: "#A89E94" }}>
            ↩ {replyTo.sender.name}: „{replyTo.body}”
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <button key={k} type="button" onClick={() => { setKind(k); setError(null); }} aria-pressed={kind === k}
              className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
              style={kind === k ? { background: "#F08A68", color: "#1C1A17" } : { background: "rgba(255,255,255,0.08)", color: "#BFB4A8" }}>
              {MESSAGE_KIND_LABEL[k]}
            </button>
          ))}
        </div>

        {isCredit ? (
          /* KREDITKÉRÉS — egyszerű: mennyiség + rövid indoklás. Címzett nincs: a kérés
             automatikusan a vezetőkhöz (létrehozó + kiosztó jogú tagok) megy. */
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="flex w-full max-w-[340px] items-center gap-3 rounded-xl px-3 py-2.5" style={fieldStyle}>
              <span className="text-xs" style={{ color: "#8F857B" }}>Hány kredit kell?</span>
              <input value={amount} onChange={(e) => {
                  // max. 4 számjegy, vezető nullák nélkül, legfeljebb ALLOCATE_MAX
                  const digits = e.target.value.replace(/[^0-9]/g, "").replace(/^0+/, "").slice(0, 4);
                  setAmount(digits && Number(digits) > ALLOCATE_MAX ? String(ALLOCATE_MAX) : digits);
                  setError(null);
                }}
                inputMode="numeric" maxLength={4} placeholder="10" aria-label="Kért kredit"
                className="ml-auto w-20 bg-transparent text-right font-display text-2xl font-bold tabular-nums outline-none" style={{ color: "#F6F1EA" }} />
              <span className="text-xs" style={{ color: "#8F857B" }}>kredit</span>
            </div>
            <div className="flex justify-center gap-1.5">
              {[5, 10, 20, 50].map((v) => (
                <button key={v} type="button" onClick={() => { setAmount(String(v)); setError(null); }}
                  className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
                  style={amount === String(v) ? { background: "#F08A68", color: "#1C1A17" } : { background: "rgba(255,255,255,0.08)", color: "#BFB4A8" }}>
                  {v}
                </button>
              ))}
            </div>
            <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={300}
              placeholder="Mire kell? (pl. holnapi bemutatóhoz videó)" aria-label="Mire kell a kredit?"
              className="h-9 w-full max-w-[340px] rounded-full px-3 text-center text-[13px] outline-none" style={fieldStyle} />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setTo(to === "*" ? "" : "*"); setFolderId(""); }} aria-pressed={to === "*"}
                className="h-8 flex-none rounded-full px-3 text-xs font-semibold"
                style={to === "*" ? { background: "#F08A68", color: "#1C1A17" } : { background: "rgba(255,255,255,0.08)", color: "#F3EDE6", border: "1px solid #3A322C" }}>
                Mindenki
              </button>
              <SelectField tone="dark" size="sm" className="min-w-0 flex-1" ariaLabel="Címzett"
                value={to === "*" ? "" : to} onChange={(v) => { setTo(v); setFolderId(""); }}
                placeholder={members.length ? "Válassz kollégát…" : "Még nincs más tag az irodában"}
                options={members.map((m) => ({ value: m.userId, label: m.name }))} />
            </div>

            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={MESSAGE_BODY_MAX} rows={3}
              placeholder={kind === "task" ? "Pl. Kérlek, készíts értékbecslést a Hungária krt. 112-höz péntekig." : kind === "done" ? "Pl. Kész a Thököly úti videó, betettem a mappába." : "Írd ide az üzenetet…"}
              className="min-h-[72px] flex-1 resize-none rounded-lg px-2.5 py-2 text-[13px] outline-none" style={fieldStyle} />

            <div className="grid grid-cols-2 gap-2">
              {kind === "task" && (
                <>
                  <DateField tone="dark" size="sm" className="w-full" value={due} onChange={setDue} min={today}
                    placeholder="Határidő (nem kötelező)" clearable />
                  <SelectField tone="dark" size="sm" ariaLabel="Modul" value={moduleHref} onChange={setModuleHref}
                    placeholder="Modul (nem kötelező)"
                    options={[{ value: "", label: "Modul (nem kötelező)" }, ...modules.map((m) => ({ value: m.href, label: m.label }))]} />
                </>
              )}
              <SelectField tone="dark" size="sm" className="col-span-2" ariaLabel="Mappa csatolása" value={folderId} onChange={setFolderId}
                placeholder={folderOptions.length ? "+ Mappa csatolása (nem kötelező)" : "Nincs csatolható közös mappa"}
                options={[{ value: "", label: folderOptions.length ? "+ Mappa csatolása (nem kötelező)" : "Nincs csatolható közös mappa" }, ...folderOptions.map((f) => ({ value: f.id, label: `${f.name}${f.everyone ? " · mindenki" : ""}` }))]} />
            </div>
          </>
        )}

        {error && <p className="text-xs" style={{ color: "#F4A48A" }}>{error}</p>}

        <div className={`flex items-center gap-2 ${isCredit ? "justify-center" : "justify-between"}`}>
          <span className={`text-[11px] ${isCredit ? "hidden" : ""}`} style={{ color: "#8F857B" }}>
            {isCredit ? " " : to === "*" ? "Az iroda minden tagja megkapja." : " "}
          </span>
          <button type="button" onClick={() => void send()} disabled={busy}
            className="h-9 flex-none rounded-full px-5 text-[13px] font-semibold disabled:opacity-50" style={{ background: "#F08A68", color: "#1C1A17" }}>
            {busy ? "Küldés…" : isCredit ? "Kérés küldése" : "Küldés"}
          </button>
        </div>
      </div>
    </section>
  );
}
