// WorkViewer — közös, felugró munka-nézegető (Munkáim kártya, Korábbi munkák, irodai mappák, üzenetek).
//   • kép / videó / PDF az ablakban jelenik meg (a videó itt játszódik le, nem új lapon)
//   • lapozás: ‹ › gombok és ←/→ billentyű; Esc bezár
//   • alsó művelet-sáv: Letöltés · (irodai tagnak, saját munkánál) Áthelyezés · Küldés kollégának
// A felugró választók (mappa, kolléga) a gomb FÖLÖTT nyílnak, így semmi nem mozdul el.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toDownloadUrl } from "@/lib/files";
import { fmtFull } from "@/lib/office-format";
import { showToast } from "@/components/Toast";
import type { WorkFolderLink } from "@/lib/work-folders";

export type ViewerWork = {
  id: string;                 // usage_history.id
  title: string;
  typeLabel: string;
  url: string | null;
  createdAt: string;
  ownerName?: string | null;  // irodai mappában: ki készítette
  mine: boolean;              // csak a saját munkát lehet mappába tenni / elküldeni
  folders?: string[];         // mely közös mappákban van már (ha ismert)
};

type Kind = "image" | "pdf" | "video" | "other";
export function workKind(url: string | null): Kind {
  if (!url) return "other";
  const u = url.split("?")[0].toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(u)) return "image";
  if (/\.pdf$/.test(u)) return "pdf";
  if (/\.(mp4|mov|webm|m4v)$/.test(u)) return "video";
  return "other";
}

type Folder = { id: string; name: string };
type Member = { userId: string; name: string };

export default function WorkViewer({ works, index, onIndex, onClose, canShare = false, initialPop = null }: {
  works: ViewerWork[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  canShare?: boolean;         // irodai tag-e a néző
  initialPop?: "folder" | "send" | null;   // pl. a „megosztás" linkről: rögtön a mappa-választóval nyílik
}) {
  const w = works[Math.min(index, works.length - 1)];
  const [visible, setVisible] = useState(false);
  const [pop, setPop] = useState<"folder" | "send" | null>(initialPop);

  const go = useCallback((d: number) => {
    const n = index + d;
    if (n >= 0 && n < works.length) { onIndex(n); setPop(null); }
  }, [index, works.length, onIndex]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    // capture-fázis + stopImmediatePropagation: ha egy másik ablak (pl. mappa-dialógus) fölött nyílik,
    // az Esc/nyilak csak a nézegetőre hassanak.
    const onKey = (e: KeyboardEvent) => {
      if (["Escape", "ArrowLeft", "ArrowRight"].includes(e.key)) e.stopImmediatePropagation();
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select")) { if (e.key === "Escape") setPop(null); return; }
      if (e.key === "Escape") { if (pop) setPop(null); else onClose(); }
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey, true); document.body.style.overflow = prev; };
  }, [go, onClose, pop]);

  if (!w) return null;
  const k = workKind(w.url);
  const shareable = canShare && w.mine;

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex flex-col transition-opacity duration-200"
      style={{ background: "rgba(10,9,8,0.92)", opacity: visible ? 1 : 0 }}>

      {/* ── felső sáv ── */}
      <div onClick={(e) => e.stopPropagation()} className="flex h-16 flex-none items-center gap-4 px-5 sm:px-8" style={{ color: "#F3EDE6" }}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[17px] font-semibold">{w.title}</p>
          <p className="truncate text-xs" style={{ color: "#A89E94" }}>
            {w.typeLabel}{w.ownerName ? ` · ${w.ownerName}` : ""} · {fmtFull(w.createdAt)}
          </p>
        </div>
        {works.length > 1 && <span className="text-xs tabular-nums" style={{ color: "#A89E94" }}>{index + 1} / {works.length}</span>}
        <RoundBtn label="Bezárás (Esc)" onClick={onClose}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></RoundBtn>
      </div>

      {/* ── tartalom ── */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20">
        {works.length > 1 && (
          <div onClick={(e) => e.stopPropagation()} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 sm:left-6">
            <RoundBtn label="Előző (←)" big disabled={index === 0} onClick={() => go(-1)}><path d="m15 18-6-6 6-6" /></RoundBtn>
          </div>
        )}

        <div onClick={(e) => e.stopPropagation()} className="flex h-full max-h-full w-full items-center justify-center transition-transform duration-200"
          style={{ transform: visible ? "scale(1)" : "scale(0.96)" }}>
          {k === "image" && w.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={w.id} src={w.url} alt={w.title} className="max-h-full max-w-full rounded-xl object-contain" style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }} />
          )}
          {k === "video" && w.url && (
            <video key={w.id} src={w.url} controls autoPlay playsInline className="max-h-full max-w-full rounded-xl bg-black" style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }} />
          )}
          {k === "pdf" && w.url && (
            <iframe key={w.id} src={`${w.url}#view=FitH&toolbar=1&navpanes=0`} title={w.title}
              className="h-full w-[min(100%,1000px)] rounded-xl bg-white" style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.55)" }} />
          )}
          {(k === "other" || !w.url) && (
            <div className="flex w-[min(100%,420px)] flex-col items-center gap-3 rounded-2xl px-8 py-10 text-center" style={{ background: "#1B1815", border: "1px solid #2E2723", color: "#F3EDE6" }}>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-sm font-bold" style={{ background: "rgba(238,123,91,0.16)", color: "#F4A48A" }}>
                {w.url ? "FÁJL" : "—"}
              </span>
              <p className="text-sm" style={{ color: "#A89E94" }}>
                {w.url ? "Ez a fájltípus nem jeleníthető meg az ablakban — töltsd le a megtekintéshez." : "Ehhez a munkához nem tartozik letölthető fájl (a modul oldalán nézhető meg)."}
              </p>
            </div>
          )}
        </div>

        {works.length > 1 && (
          <div onClick={(e) => e.stopPropagation()} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 sm:right-6">
            <RoundBtn label="Következő (→)" big disabled={index >= works.length - 1} onClick={() => go(1)}><path d="m9 18 6-6-6-6" /></RoundBtn>
          </div>
        )}
      </div>

      {/* ── művelet-sáv ── */}
      <div onClick={(e) => e.stopPropagation()} className="flex flex-none flex-wrap items-center justify-center gap-2 px-4 py-4 sm:gap-3">
        {w.url && (
          <a href={toDownloadUrl(w.url)} className="inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold" style={{ background: "#F08A68", color: "#1C1A17" }}>
            <Svg><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></Svg>Letöltés
          </a>
        )}
        {w.mine && (
          <div className="relative">
            <button type="button" onClick={() => setPop(pop === "folder" ? null : "folder")} aria-expanded={pop === "folder"}
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold" style={pop === "folder" ? ghostOn : ghost}>
              <Svg><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M12 11v5" /><path d="M9.5 13.5h5" /></Svg>
              Áthelyezés
            </button>
            {pop === "folder" && <FolderPop key={w.id} work={w} canOffice={canShare} />}
          </div>
        )}
        {shareable && (
          <div className="relative">
            <button type="button" onClick={() => setPop(pop === "send" ? null : "send")} aria-expanded={pop === "send"}
              className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold" style={pop === "send" ? ghostOn : ghost}>
              <Svg><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Svg>
              Küldés kollégának
            </button>
            {pop === "send" && <SendPop key={w.id} work={w} onDone={() => setPop(null)} />}
          </div>
        )}
        {!w.mine && (
          <span className="text-xs" style={{ color: "#8F857B" }}>Ez egy kollégád munkája — csak a sajátodat teheted mappába vagy küldheted tovább.</span>
        )}
      </div>
    </div>
  );
}

const ghost = { background: "rgba(255,255,255,0.08)", color: "#F3EDE6", border: "1px solid rgba(255,255,255,0.16)" };
const ghostOn = { background: "#F3EDE6", color: "#1C1A17", border: "1px solid #F3EDE6" };

function Svg({ children }: { children: React.ReactNode }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>;
}

function RoundBtn({ label, onClick, disabled, big = false, children }: { label: string; onClick: () => void; disabled?: boolean; big?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`flex flex-none items-center justify-center rounded-full transition-colors hover:bg-white/20 disabled:opacity-25 disabled:hover:bg-white/10 ${big ? "h-12 w-12" : "h-10 w-10"}`}
      style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}>
      <svg width={big ? 22 : 18} height={big ? 22 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Irodai adatok (mappák + tagok) — egyszer töltjük be, a két felugró közösen használja
// ---------------------------------------------------------------------------
let officeCache: Promise<{ folders: Folder[]; members: Member[]; meId: string; error?: string }> | null = null;
function loadOffice() {
  if (!officeCache) {
    officeCache = fetch("/api/office/folders").then((r) => r.json()).then((d) => ({
      folders: (d.folders ?? []).map((f: Folder) => ({ id: f.id, name: f.name })),
      members: d.members ?? [],
      meId: d.meId ?? "",
      error: d.error,
    })).catch(() => ({ folders: [], members: [], meId: "", error: "Nem sikerült betölteni." }));
    // 60 mp után újratöltjük (új mappa / új tag)
    setTimeout(() => { officeCache = null; }, 60_000);
  }
  return officeCache;
}

type FixedAt = { top?: number; bottom?: number; left: number };
function PopShell({ title, children, fixedAt, height = 300 }: { title: string; children: React.ReactNode; fixedAt?: FixedAt; height?: number }) {
  return (
    <div className={`${fixedAt ? "fixed z-[60]" : "absolute bottom-[calc(100%+10px)] left-1/2 z-20 -translate-x-1/2"} flex w-[320px] flex-col overflow-hidden rounded-2xl text-left`}
      style={{ maxHeight: height, background: "#1B1815", border: "1px solid #3A322C", color: "#F3EDE6", boxShadow: "0 20px 50px rgba(0,0,0,0.5)", ...(fixedAt ?? {}) }}>
      <p className="flex-none px-4 pb-2 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "#A89E94" }}>{title}</p>
      {children}
    </div>
  );
}

export const FOLDER_POP_H = 380;

/**
 * „Áthelyezés" — egyetlen egyszerű lista: kattintásra a munka bekerül a mappába, újabb kattintásra kikerül.
 * Egy munka több mappában is lehet (✓ jelzi, hol van már). Itt NEM hozunk létre mappát — azt a
 * Korábbi munkák bal sávjában lehet. Két csoport: Saját mappáim · Közös irodai mappák (irodai tagnak).
 */
function FolderPop({ work, canOffice, fixedAt }: {
  work: Pick<ViewerWork, "id">; canOffice: boolean; fixedAt?: FixedAt;
}) {
  const [mine, setMine] = useState<{ folders: Folder[]; error?: string } | null>(null);
  const [office, setOffice] = useState<{ folders: Folder[]; error?: string } | null>(canOffice ? null : { folders: [] });
  const [inMine, setInMine] = useState<Set<string>>(new Set());
  const [inOffice, setInOffice] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/work-folders").then((r) => r.json()).then((d) => {
      setInMine(new Set<string>((d.links ?? []).filter((l: WorkFolderLink) => l.historyId === work.id).map((l: WorkFolderLink) => l.folderId)));
      setMine({ folders: (d.folders ?? []).map((f: Folder) => ({ id: f.id, name: f.name })), error: d.error });
    }).catch(() => setMine({ folders: [], error: "Nem sikerült betölteni." }));
    if (canOffice) {
      void loadOffice().then((d) => setOffice({ folders: d.folders, error: d.error }));
      // a VALÓDI állapot a szerverről: mely közös mappákban van már ez a munka
      fetch(`/api/office/folders/items?historyId=${work.id}`).then((r) => r.json())
        .then((d) => setInOffice(new Set<string>(d.folderIds ?? []))).catch(() => {});
    }
  }, [work.id, canOffice]);

  async function toggle(kind: "mine" | "office", f: Folder) {
    const set = kind === "mine" ? inMine : inOffice;
    const isIn = set.has(f.id);
    setBusy(f.id);
    try {
      const res = await fetch(kind === "mine" ? "/api/work-folders/items" : "/api/office/folders/items", {
        method: isIn ? "DELETE" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: f.id, historyId: work.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
      const next = new Set(set);
      if (isIn) next.delete(f.id); else next.add(f.id);
      (kind === "mine" ? setInMine : setInOffice)(next);
      showToast(isIn ? `Kivetted: „${f.name}”.` : `Betéve: „${f.name}”.`, "success");
      window.dispatchEvent(new CustomEvent("twx-works-changed"));
    } catch {
      showToast("Hálózati hiba.", "error");
    } finally {
      setBusy(null);
    }
  }

  const loading = !mine || !office;
  const noFolders = !loading && mine.folders.length === 0 && office.folders.length === 0;

  return (
    <PopShell title="Áthelyezés" fixedAt={fixedAt} height={FOLDER_POP_H}>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading && <p className="px-2 py-1.5 text-xs" style={{ color: "#A89E94" }}>Betöltés…</p>}
        {mine?.error && <p className="px-2 py-1.5 text-xs text-red-300">{mine.error}</p>}
        {noFolders && (
          <p className="px-2 py-2 text-xs leading-relaxed" style={{ color: "#8F857B" }}>
            Még nincs mappád. A Korábbi munkák oldal bal sávjában a „+” gombbal hozhatsz létre egyet.
          </p>
        )}
        {!loading && mine.folders.length > 0 && (
          <>
            <SectionHead icon={<path d="M7 11V7a5 5 0 0 1 10 0v4" />} rect title="Saját mappáim" hint="csak te látod" />
            {mine.folders.map((f) => (
              <PopRow key={f.id} on={inMine.has(f.id)} busy={busy === f.id} disabled={busy !== null} onClick={() => void toggle("mine", f)} label={f.name} kind="mine" />
            ))}
          </>
        )}
        {!loading && canOffice && office.folders.length > 0 && (
          <>
            {mine.folders.length > 0 && <div className="mx-2 my-2 h-px" style={{ background: "#2E2723" }} />}
            <SectionHead icon={<><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 14.2A5 5 0 0 1 21 19" /></>}
              title="Közös irodai mappák" hint="a kollégák is látják" />
            {office.folders.map((f) => (
              <PopRow key={f.id} on={inOffice.has(f.id)} busy={busy === f.id} disabled={busy !== null} onClick={() => void toggle("office", f)} label={f.name} kind="office" />
            ))}
          </>
        )}
      </div>
      <p className="flex-none px-4 py-2.5 text-[11px] leading-snug" style={{ color: "#8F857B", borderTop: "1px solid #2E2723" }}>
        Kattints egy mappára a betételhez — ✓ jelzi, hol van már. Újabb kattintás kiveszi.
      </p>
    </PopShell>
  );
}

function SectionHead({ icon, title, hint, action, rect = false }: { icon: React.ReactNode; title: string; hint: string; action?: React.ReactNode; rect?: boolean }) {
  return (
    <div className="flex h-8 items-center gap-2 px-2">
      <span style={{ color: "#A89E94" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {rect && <rect x="5" y="11" width="14" height="10" rx="2" />}{icon}
        </svg>
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#E8DED3" }}>{title}</span>
      <span className="text-[10px]" style={{ color: "#8F857B" }}>· {hint}</span>
      <span className="ml-auto">{action}</span>
    </div>
  );
}

function PopRow({ on, busy, disabled, onClick, label, kind }: { on: boolean; busy: boolean; disabled: boolean; onClick: () => void; label: string; kind: "mine" | "office" }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={on}
      className="flex h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] transition-colors hover:bg-white/5 disabled:cursor-default disabled:hover:bg-transparent"
      style={on ? { background: "rgba(111,191,142,0.08)" } : undefined}>
      <span style={{ color: kind === "mine" ? "#E8DED3" : "#F4A48A" }}>
        <Svg><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></Svg>
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {busy ? <span className="text-[11px]" style={{ color: "#A89E94" }}>…</span>
        : on ? <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "#6FBF8E", color: "#0E0C0B" }}>✓</span>
          : <span className="flex h-5 w-5 items-center justify-center rounded-full text-[13px]" style={{ border: "1.5px solid #5A5048", color: "#8F857B" }}>+</span>}
    </button>
  );
}

function SendPop({ work, onDone }: { work: ViewerWork; onDone: () => void }) {
  const [data, setData] = useState<{ members: Member[]; meId: string; error?: string } | null>(null);
  const [to, setTo] = useState<string | null>(null);   // "*" = Mindenki
  const [note, setNote] = useState(`Elkészült: ${work.title}`);
  const [busy, setBusy] = useState(false);
  const noteRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void loadOffice().then(setData); }, []);

  const others = (data?.members ?? []).filter((m) => m.userId !== data?.meId);

  async function send() {
    if (!to || !note.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/office/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "done", recipientId: to === "*" ? null : to, body: note.trim(), historyId: work.id }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? (d.errors ? Object.values(d.errors)[0] as string : "Nem sikerült."), "error"); return; }
      const name = to === "*" ? "az egész irodának" : others.find((m) => m.userId === to)?.name ?? "";
      showToast(`Elküldve ${to === "*" ? name : `neki: ${name}`}.`, "success");
      window.dispatchEvent(new CustomEvent("twx-office-messages"));
      onDone();
    } catch {
      showToast("Hálózati hiba.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PopShell title="Kinek küldöd?">
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {!data && <p className="px-2 py-2 text-xs" style={{ color: "#A89E94" }}>Betöltés…</p>}
        {data?.error && <p className="px-2 py-2 text-xs text-red-300">{data.error}</p>}
        {data && !data.error && (
          <>
            <Pick on={to === "*"} onClick={() => { setTo("*"); noteRef.current?.focus(); }} label="Mindenki" sub="az iroda összes tagja" />
            {others.map((m) => (
              <Pick key={m.userId} on={to === m.userId} onClick={() => { setTo(m.userId); noteRef.current?.focus(); }} label={m.name} />
            ))}
            {others.length === 0 && <p className="px-2 py-2 text-xs" style={{ color: "#A89E94" }}>Még nincs más tag az irodában.</p>}
          </>
        )}
      </div>
      <div className="flex flex-none items-center gap-2 px-3 py-2.5" style={{ borderTop: "1px solid #2E2723" }}>
        <input ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
          onKeyDown={(e) => { if (e.key === "Enter") void send(); }}
          className="h-9 min-w-0 flex-1 rounded-full px-3 text-[13px] outline-none"
          style={{ background: "#0E0C0B", border: "1px solid #2E2723", color: "#F3EDE6" }} aria-label="Rövid üzenet" />
        <button type="button" disabled={!to || !note.trim() || busy} onClick={() => void send()}
          className="h-9 flex-none rounded-full px-3.5 text-xs font-semibold disabled:opacity-40" style={{ background: "#F08A68", color: "#1C1A17" }}>
          {busy ? "…" : "Küldés"}
        </button>
      </div>
    </PopShell>
  );
}

function Pick({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: string; sub?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className="flex h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] transition-colors hover:bg-white/5"
      style={on ? { background: "rgba(240,138,104,0.16)" } : undefined}>
      <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full" style={{ border: `1.5px solid ${on ? "#F08A68" : "#5A5048"}` }}>
        {on && <span className="h-2 w-2 rounded-full" style={{ background: "#F08A68" }} />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {sub && <span className="text-[11px]" style={{ color: "#8F857B" }}>{sub}</span>}
    </button>
  );
}

/**
 * Önálló mappa-választó (pl. a Munkáim lista „megosztás" gombjához): a gomb mellett nyílik,
 * NEM nyitja meg a munkát. Kattintás mellé vagy Esc → bezárul.
 */
export function FolderPicker({ work, anchor, onClose, canOffice = true }: {
  work: Pick<ViewerWork, "id" | "folders">; anchor: DOMRect; onClose: () => void; canOffice?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onScroll = () => onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    // amíg nyitva van, az oldal nem görget (különben a választó elválna a gombtól)
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onScroll);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const W = 320, H = FOLDER_POP_H, GAP = 8;
  // alá nyílik, ha elfér; különben FÖLÉ — alulról horgonyozva, így rövid listánál sem lóg el a gombtól
  const below = window.innerHeight - anchor.bottom > H + GAP + 16;
  const pos: FixedAt = below
    ? { top: anchor.bottom + GAP, left: 0 }
    : { bottom: Math.max(8, window.innerHeight - anchor.top + GAP), left: 0 };
  pos.left = Math.min(Math.max(8, anchor.right - W), window.innerWidth - W - 8);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[59]" onClick={onClose} aria-hidden />
      <FolderPop work={work} canOffice={canOffice} fixedAt={pos} />
    </>,
    document.body,
  );
}
