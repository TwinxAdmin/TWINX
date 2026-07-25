// ComboField — a SelectField elegáns dizájnja, DE szabadon is beírható (combobox).
// Az értékbecslő „válassz a listából VAGY írj sajátot" mezőihez: a lista opciói szépen
// legördülnek (portál + fix pozíció), közben tetszőleges saját érték is beírható.
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export default function ComboField({
  id, value, onChange, options, placeholder = "Válassz vagy írj sajátot", className,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; below: boolean } | null>(null);

  const place = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const below = spaceBelow > 260 || spaceBelow > r.top;
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

  // Ha üres a mező vagy pontosan egy opció van beírva → mind látszik; egyébként szűr.
  const list = useMemo(() => {
    const q = value.trim().toLowerCase();
    const isExact = options.some((o) => o.toLowerCase() === q);
    return !q || isExact ? [...options] : options.filter((o) => o.toLowerCase().includes(q));
  }, [value, options]);

  return (
    <div ref={wrapRef} className={`relative ${className ?? "w-full"}`}>
      <div
        className="box-border flex h-[42px] w-full items-center rounded-lg border pr-1 transition"
        style={{ borderColor: open ? "var(--twx-coral)" : "var(--twx-line)", background: "var(--twx-cream-card)" }}
      >
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
          style={{ color: "var(--twx-ink)" }}
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen((o) => !o)}
          aria-label="Lista"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ color: "var(--twx-coral)", transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && rect && list.length > 0 && (
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
              <div className="max-h-64 overflow-y-auto p-1">
                {list.map((o) => {
                  const isSel = o === value;
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => { onChange(o); setOpen(false); }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition"
                      style={{ background: isSel ? "var(--twx-coral)" : "transparent", color: isSel ? "#fff" : "var(--twx-ink)" }}
                      onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "rgba(239,122,90,0.10)"; }}
                      onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span className="truncate">{o}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
