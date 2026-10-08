// ActionMenu — egységes „⋯" művelet-menü kártyákhoz és listasorokhoz (TWINX-szabály: a kártyákon
// NINCS sűrű ikongomb-sor; a műveletek — letöltés, mappába/áthelyezés, átnevezés, törlés — ide kerülnek).
//
// Használat:
//   const menu = useActionMenu();
//   <div onContextMenu={menu.openAtEvent}> … <MenuDots onClick={menu.openAtButton} /> </div>
//   {menu.open && <ActionMenu at={menu.at} items={[…]} onClose={menu.close} />}
//
// Egy tétel lehet egyszerű művelet, link (href → letöltés), vagy almenü (`sub`), ami a fő menü
// MELLETT nyílik ki (rámutatásra vagy kattintásra), a fő menü közben látható marad.
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type MenuItem =
  | { kind?: "action"; label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean; hint?: string }
  | { kind: "link"; label: string; icon?: ReactNode; href: string; download?: boolean }
  | { kind: "sub"; label: string; icon?: ReactNode; title: string; items: SubItem[]; empty?: string }
  | { kind: "divider" };

export type SubItem =
  | { id: string; label: string; checked?: boolean; onClick: () => void | Promise<unknown>; disabled?: boolean; header?: undefined }
  | { id: string; header: string; hint?: string };   // csoport-fejléc az almenüben (pl. „Saját mappáim")

type At = { x: number; y: number; alignRight: boolean };

export function useActionMenu() {
  const [at, setAt] = useState<At | null>(null);
  const openAtButton = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setAt({ x: r.right, y: r.bottom + 6, alignRight: true });
  }, []);
  const openAtEvent = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setAt({ x: e.clientX, y: e.clientY, alignRight: false });
  }, []);
  return { open: at !== null, at, openAtButton, openAtEvent, close: useCallback(() => setAt(null), []) };
}

/** A „⋯" gomb — halvány, keret nélkül; rámutatásra sötétedik. */
export function MenuDots({ onClick, label = "Műveletek", dark = false }: { onClick: (e: React.MouseEvent<HTMLElement>) => void; label?: string; dark?: boolean }) {
  return (
    <button type="button" onClick={onClick} onMouseDown={(e) => e.stopPropagation()} aria-label={label} title={label} aria-haspopup="menu"
      className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors ${dark ? "text-white/60 hover:bg-white/15 hover:text-white" : "text-[#8F857B] hover:bg-[#EFE7DD] hover:text-[#1C1A17]"}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
    </button>
  );
}

const W = 232;   // fő menü szélessége
const SW = 248;  // almenü szélessége

export function ActionMenu({ at, items, onClose }: { at: At | null; items: MenuItem[]; onClose: () => void }) {
  // Almenü: a fő menü MELLETT nyílik (arra, amerre a kis nyíl mutat), a fő menü látszik marad.
  type SubMenu = Extract<MenuItem, { kind: "sub" }>;
  // csak a címkét és a helyet tároljuk — a tartalmat mindig a FRISS `items`-ből vesszük,
  // így kattintás után a ✓ jelek azonnal frissülnek, és az almenü nyitva marad
  const [subOpen, setSubOpen] = useState<{ label: string; top: number } | null>(null);
  const subItem = subOpen ? (items.find((x) => x.kind === "sub" && x.label === subOpen.label) as SubMenu | undefined) : undefined;
  const sub = subOpen && subItem ? { item: subItem, top: subOpen.top } : null;
  const setSub = (v: null) => setSubOpen(v);
  const [busyId, setBusyId] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (sub) setSub(null); else onClose();
    };
    const onScroll = (e: Event) => {
      // a saját (görgethető) almenü görgetése ne zárja be
      if ((e.target as HTMLElement)?.closest?.("[data-twx-menu]")) return;
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose, sub]);

  if (!at || typeof document === "undefined") return null;

  // a képernyőn belül tartjuk; ha alul nincs hely, fölfelé nyílik (alulról horgonyozva)
  const left = Math.min(Math.max(8, at.alignRight ? at.x - W : at.x), window.innerWidth - W - 8);
  const spaceBelow = window.innerHeight - at.y;
  const pos: React.CSSProperties = spaceBelow > 280 ? { top: at.y, left } : { bottom: Math.max(8, window.innerHeight - at.y + 8), left };

  function openSub(it: SubMenu, row: HTMLElement) {
    setSubOpen({ label: it.label, top: row.getBoundingClientRect().top - 6 });
  }

  // almenü helye: jobbra a fő menü mellett; ha ott nincs hely, balra
  let subStyle: React.CSSProperties | null = null;
  let subToLeft = false;
  if (sub && mainRef.current) {
    const m = mainRef.current.getBoundingClientRect();
    subToLeft = m.right + SW + 8 > window.innerWidth;
    const subLeft = subToLeft ? Math.max(8, m.left - SW + 4) : m.right - 4;
    const maxH = 380;
    const top = Math.max(8, Math.min(sub.top, window.innerHeight - maxH - 8));
    subStyle = { top, left: subLeft, width: SW, maxHeight: maxH };
  }

  const chevron = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8F857B" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} aria-hidden />
      <div ref={mainRef} role="menu" data-twx-menu className="fixed z-[71] overflow-hidden rounded-xl py-1.5"
        style={{ ...pos, width: W, background: "#fff", border: "1px solid #E8E1D6", boxShadow: "0 16px 40px rgba(28,24,21,0.18)", color: "#2E2A25" }}>
        {items.map((it, i) => {
          if (it.kind === "divider") return <div key={`d${i}`} className="my-1.5 h-px" style={{ background: "#EFE7DD" }} />;
          if (it.kind === "link") {
            return (
              <a key={it.label} role="menuitem" href={it.href} download={it.download || undefined}
                onMouseEnter={() => setSub(null)} onClick={() => onClose()} className={rowCls}>
                <Ico>{it.icon}</Ico><span className="flex-1">{it.label}</span>
              </a>
            );
          }
          if (it.kind === "sub") {
            const isOpen = sub?.item.label === it.label;
            return (
              <button key={it.label} type="button" role="menuitem" aria-haspopup="menu" aria-expanded={isOpen}
                onMouseEnter={(e) => openSub(it, e.currentTarget)} onClick={(e) => openSub(it, e.currentTarget)}
                className={rowCls} style={isOpen ? { background: "#F7F1EA" } : undefined}>
                <Ico>{it.icon}</Ico><span className="flex-1">{it.label}</span>
                {chevron}
              </button>
            );
          }
          return (
            <button key={it.label} type="button" role="menuitem" disabled={it.disabled} title={it.disabled ? it.hint : undefined}
              onMouseEnter={() => setSub(null)} onClick={() => { onClose(); it.onClick(); }}
              className={`${rowCls} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
              style={it.danger ? { color: "#B4432A" } : undefined}>
              <Ico>{it.icon}</Ico><span className="flex-1">{it.label}</span>
            </button>
          );
        })}
      </div>

      {sub && subStyle && (
        <div role="menu" data-twx-menu aria-label={sub.item.title} className="fixed z-[72] overflow-y-auto overscroll-contain rounded-xl py-1.5"
          style={{ ...subStyle, background: "#fff", border: "1px solid #E8E1D6", boxShadow: "0 16px 40px rgba(28,24,21,0.18)", color: "#2E2A25" }}>
          <p className="px-3.5 pb-1 pt-1 text-[11px] font-semibold" style={{ color: "#6B6258" }}>{sub.item.title}</p>
          {sub.item.items.length === 0 && <p className="px-3.5 py-2 text-xs leading-relaxed" style={{ color: "#8F857B" }}>{sub.item.empty ?? "Nincs választható elem."}</p>}
          {sub.item.items.map((s) => s.header !== undefined ? (
            <p key={s.id} className="mt-1 border-t px-3.5 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] first:mt-0 first:border-t-0"
              style={{ color: "#8F857B", borderColor: "#EFE7DD" }}>
              {s.header}{s.hint && <span className="ml-1 normal-case tracking-normal" style={{ color: "#B3A99E" }}>· {s.hint}</span>}
            </p>
          ) : (
            <button key={s.id} type="button" role="menuitemcheckbox" aria-checked={!!s.checked} disabled={s.disabled || busyId === s.id}
              onClick={async () => {
                // NEM zárjuk be: egy munka egymás után több mappába is betehető
                setBusyId(s.id);
                try { await s.onClick(); } finally { setBusyId(null); }
              }}
              className={`${rowCls} disabled:cursor-default disabled:hover:bg-transparent`}>
              <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold"
                style={s.checked ? { background: "#1F7A4D", color: "#fff" } : { border: "1.5px solid #D5C8B9" }}>{s.checked ? "✓" : ""}</span>
              <span className={`min-w-0 flex-1 truncate ${s.disabled && !s.checked ? "opacity-40" : ""}`}>{s.label}</span>
              {busyId === s.id && <span className="text-[11px]" style={{ color: "#8F857B" }}>…</span>}
            </button>
          ))}
          {sub.item.items.length > 0 && (
            <div className="mt-1.5 flex items-center justify-between gap-2 border-t px-3.5 pt-2" style={{ borderColor: "#EFE7DD" }}>
              <span className="text-[11px] leading-snug" style={{ color: "#8F857B" }}>Több mappát is választhatsz.</span>
              <button type="button" onClick={onClose} className="h-7 flex-none rounded-full px-3 text-[11px] font-semibold" style={{ background: "#1C1A17", color: "#fff" }}>Kész</button>
            </div>
          )}
        </div>
      )}
    </>,
    document.body,
  );
}

const rowCls = "flex h-9 w-full items-center gap-2.5 px-3.5 text-left text-[13px] transition-colors hover:bg-[#F7F1EA]";

function Ico({ children }: { children?: ReactNode }) {
  return (
    <span className="flex w-4 flex-none justify-center" style={{ color: "currentColor", opacity: 0.75 }}>
      {children && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>}
    </span>
  );
}

/** Gyakori ikonok a menükhöz (a `<svg>`-n belüli tartalom). */
export const MI = {
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
  folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M12 11v5" /><path d="M9.5 13.5h5" /></>,
  move: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="m11 10 3 3-3 3" /><path d="M8 13h6" /></>,
  rename: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m6 6 1 14h10l1-14" /></>,
  out: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M9.5 13.5h5" /></>,
  open: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  restore: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
};
