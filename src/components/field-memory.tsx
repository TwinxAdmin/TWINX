// Mező-memória — a korábban beírt szövegeket megjegyzi (böngészőben, localStorage),
// és amikor a felhasználó újra elkezd gépelni egy mezőbe, felajánlja a korábbiakat.
// Egy kattintás → beírja a korábbi szöveget. Kliensoldali, fiók-független.
"use client";

import { useCallback, useEffect, useState } from "react";

type Opts = { min?: number; cap?: number };

/** Egy mező korábbi értékeinek tárolása + felidézése (kulcs szerint). */
export function useFieldMemory(key: string, opts: Opts = {}) {
  const { min = 3, cap = 8 } = opts;
  const storeKey = `twx:mem:${key}`;
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setItems(JSON.parse(raw) as string[]);
    } catch { /* memória nélkül is működik */ }
  }, [storeKey]);

  const write = useCallback((next: string[]) => {
    setItems(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* csendben */ }
  }, [storeKey]);

  const remember = useCallback((value: string) => {
    const val = (value ?? "").trim();
    if (val.length < min) return;
    setItems((prev) => {
      const next = [val, ...prev.filter((x) => x !== val)].slice(0, cap);
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* csendben */ }
      return next;
    });
  }, [storeKey, min, cap]);

  const remove = useCallback((value: string) => {
    setItems((prev) => {
      const next = prev.filter((x) => x !== value);
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* csendben */ }
      return next;
    });
  }, [storeKey]);

  return { items, remember, remove, write };
}

/** A mező alá helyezett javaslat-doboz (csak fókusz alatt, illeszkedő elemekre). */
export function FieldSuggestions({
  open,
  value,
  items,
  onPick,
  onRemove,
  max = 5,
}: {
  open: boolean;
  value: string;
  items: string[];
  onPick: (v: string) => void;
  onRemove?: (v: string) => void;
  max?: number;
}) {
  const q = (value ?? "").trim().toLowerCase();
  const matches = items
    .filter((v) => v && v !== value && (!q || v.toLowerCase().includes(q)))
    .slice(0, max);

  if (!open || matches.length === 0) return null;

  return (
    <div
      className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl"
      style={{ background: "#fff", border: "1px solid var(--twx-line)", boxShadow: "0 12px 28px rgba(0,0,0,0.12)" }}
    >
      <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--twx-ink-muted)" }}>
        Korábban beírt — kattints a kitöltéshez
      </p>
      <div className="py-1">
        {matches.map((m) => (
          <div key={m} className="flex items-center gap-2 px-2">
            <button
              type="button"
              // onMouseDown, hogy a mező blur-je ne zárja be a dobozt a kattintás előtt
              onMouseDown={(e) => { e.preventDefault(); onPick(m); }}
              className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-black/5"
            >
              <span className="block truncate">{m}</span>
            </button>
            {onRemove && (
              <button
                type="button"
                aria-label="Elem törlése az előzményből"
                onMouseDown={(e) => { e.preventDefault(); onRemove(m); }}
                className="shrink-0 rounded-md px-1.5 py-1 text-xs"
                style={{ color: "var(--twx-ink-muted)" }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
