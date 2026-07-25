// MultiSelectField — a SelectField párja, de TÖBB opció is kijelölhető (checkbox-os
// legördülő). Ugyanaz a portál + fix pozíció, hogy semmilyen görgethető konténer ne
// vágja el. A gomb a kiválasztottak számát/felsorolását mutatja; a lista nyitva marad.
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export type MultiOption = { value: string; label: string };

export default function MultiSelectField({
  values, onChange, options, placeholder = "— válassz —", className, ariaLabel,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: readonly MultiOption[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
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

  const selectedOpts = options.filter((o) => values.includes(o.value));
  const label =
    selectedOpts.length === 0 ? placeholder
      : selectedOpts.length <= 2 ? selectedOpts.map((o) => o.label).join(", ")
        : `${selectedOpts.length} kiválasztva`;

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div ref={wrapRef} className={`relative ${className ?? "w-full"}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="box-border flex h-[42px] w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm transition"
        style={{
          borderColor: open ? "var(--twx-coral)" : "var(--twx-line)",
          background: "var(--twx-cream-card)",
          color: selectedOpts.length ? "var(--twx-ink)" : "var(--twx-ink-muted)",
        }}
      >
        <span className="truncate">{label}</span>
        <span className="flex items-center gap-1" style={{ flex: "none" }}>
          {selectedOpts.length > 0 && (
            <span className="rounded-full px-1.5 text-[11px] font-semibold" style={{ background: "var(--twx-coral)", color: "#fff" }}>
              {selectedOpts.length}
            </span>
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ color: "var(--twx-coral)", transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
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
                width: Math.max(rect.width, 200),
                background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 18px 44px rgba(20,12,8,0.18)",
              }}
            >
              <div className="max-h-64 overflow-y-auto p-1">
                {options.map((o) => {
                  const on = values.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggle(o.value)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition"
                      style={{ background: on ? "rgba(239,122,90,0.10)" : "transparent", color: "var(--twx-ink)" }}
                    >
                      <span
                        className="flex h-4 w-4 flex-none items-center justify-center rounded"
                        style={on
                          ? { background: "var(--twx-coral)", border: "1px solid var(--twx-coral)" }
                          : { background: "#fff", border: "1px solid var(--twx-line)" }}
                      >
                        {on && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{o.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-between border-t p-2" style={{ borderColor: "var(--twx-line)" }}>
                <button type="button" onClick={() => onChange([])}
                  className="rounded-lg px-2 py-1 text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
                  Törlés
                </button>
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
                  Kész
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
