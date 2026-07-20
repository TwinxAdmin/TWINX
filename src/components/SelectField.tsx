// SelectField — saját, elegáns legördülő a TWINX arculatához (a DateField párja).
// A natív <select> helyett: egységes megjelenés minden böngészőben, framer-motion
// popover, kereső (ha sok az opció), csoportosítás (optgroup-szerű) és korall kiemelés.
// Nincs új függőség — csak React + Framer Motion.
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export type SelectOption = { value: string; label: string; group?: string };

export default function SelectField({
  value, onChange, options, placeholder = "— válassz —", className, disabled,
  searchable, ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;   // ha nincs megadva: 8+ opciónál automatikusan bekapcsol
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  // A popovert portálon át, FIX pozícióval rendereljük — így semmilyen overflow-y-auto
  // (drawer, görgethető modál) nem vágja el.
  const [rect, setRect] = useState<{ left: number; top: number; width: number; below: boolean } | null>(null);

  const place = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const below = spaceBelow > 280 || spaceBelow > r.top;
    setRect({ left: r.left, top: below ? r.bottom + 6 : r.top - 6, width: r.width, below });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onScrollResize = () => place();
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open]);

  const showSearch = searchable ?? options.length >= 8;
  const selected = options.find((o) => o.value === value);

  // Kattintás kívülre / Esc → bezárás
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Nyitáskor ürül a kereső.
  useEffect(() => { if (!open) setQ(""); }, [open]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [q, options]);

  // Csoportok sorrendben (az első előfordulás szerint), csoport nélküliek külön.
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, SelectOption[]>();
    for (const o of filtered) {
      const g = o.group ?? "";
      if (!map.has(g)) { map.set(g, []); order.push(g); }
      map.get(g)!.push(o);
    }
    return order.map((g) => ({ name: g, items: map.get(g)! }));
  }, [filtered]);

  return (
    <div ref={wrapRef} className={`relative ${className ?? "w-full"}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="box-border flex h-[42px] w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm transition disabled:opacity-60"
        style={{
          borderColor: open ? "var(--twx-coral)" : "var(--twx-line)",
          background: "var(--twx-cream-card)",
          color: selected ? "var(--twx-ink)" : "var(--twx-ink-muted)",
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "var(--twx-coral)", flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && rect && (
          <motion.div
            ref={popRef}
            initial={{ opacity: 0, y: rect.below ? -6 : 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: rect.below ? -6 : 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-[120] overflow-hidden rounded-2xl"
            style={{
              left: rect.left,
              top: rect.below ? rect.top : undefined,
              bottom: rect.below ? undefined : window.innerHeight - rect.top,
              width: Math.max(rect.width, 180),
              background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 18px 44px rgba(20,12,8,0.18)",
            }}
          >
            {showSearch && (
              <div className="border-b p-2" style={{ borderColor: "var(--twx-line)" }}>
                <input
                  autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keresés…"
                  className="w-full rounded-lg border px-3 py-1.5 text-sm"
                  style={{ borderColor: "var(--twx-line)", background: "#fff" }}
                />
              </div>
            )}
            <div className="max-h-64 overflow-y-auto p-1">
              {groups.length === 0 || filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs találat.</p>
              ) : (
                groups.map((g) => (
                  <div key={g.name || "_"}>
                    {g.name && (
                      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>
                        {g.name}
                      </div>
                    )}
                    {g.items.map((o) => {
                      const isSel = o.value === value;
                      return (
                        <button
                          key={o.value || "_empty"}
                          type="button"
                          onClick={() => { onChange(o.value); setOpen(false); }}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition"
                          style={{ background: isSel ? "var(--twx-coral)" : "transparent", color: isSel ? "#fff" : "var(--twx-ink)" }}
                          onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "rgba(239,122,90,0.10)"; }}
                          onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                        >
                          <span className="truncate">{o.label}</span>
                          {isSel && (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }} aria-hidden>
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
