// Közös "korábbi munkák" tálca — minden képes ingatlan-modul alján ugyanaz.
// Dátum-mappák + Kedvencek; egy mappára kattintva a tartalma jobb oldalt animálva
// jön elő. A képeket kattintással (onPick) vagy drag-and-droppal lehet a munkába húzni.
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const TWX_DRAG_TYPE = "application/x-twinx-url";
// A drop-kezelőkben ezzel olvasható ki a tálcából húzott kép URL-je (üres string, ha sima fájl-drop).
export function readTwxDragUrl(dt: DataTransfer): string {
  return dt.getData(TWX_DRAG_TYPE) || "";
}

type Folder = { key: string; label: string; urls: string[] };
const FAV_KEY = "__fav__";

export default function AssetTray({
  onPick,
  selectedUrls = [],
  title = "Korábbi munkák",
  note = "Válassz egy mappát, majd húzd a képet a munkádba, vagy kattints rá a hozzáadáshoz.",
  reloadKey = 0,
}: {
  onPick?: (url: string) => void;
  selectedUrls?: string[];
  title?: string;
  note?: string;
  reloadKey?: number;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/real-estate/assets");
        const data = await res.json();
        if (res.ok) {
          setFolders(data.folders ?? []);
          setFavorites(data.favorites ?? []);
        }
      } catch {
        /* tálca nélkül is működik a modul */
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadKey]);

  // A jobb oldali panel bezárása Esc-re.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const selected = new Set(selectedUrls);
  const openUrls =
    open === FAV_KEY ? favorites : (folders.find((f) => f.key === open)?.urls ?? []);
  const openLabel =
    open === FAV_KEY ? "Kedvencek" : (folders.find((f) => f.key === open)?.label ?? "");

  // Egységes lista: Kedvencek + dátum-mappák. Alapból max 9 látszik; felette kereső + Továbbiak.
  const entries: { key: string; label: string; count: number; fav?: boolean }[] = [
    ...(favorites.length > 0 ? [{ key: FAV_KEY, label: "Kedvencek", count: favorites.length, fav: true }] : []),
    ...folders.map((f) => ({ key: f.key, label: f.label, count: f.urls.length })),
  ];
  const q = query.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => e.label.toLowerCase().includes(q)) : entries;
  const LIMIT = 9;
  const visibleEntries = expanded ? filtered : filtered.slice(0, LIMIT);

  if (loading) {
    return (
      <section className="twx-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
      </section>
    );
  }
  if (folders.length === 0 && favorites.length === 0) {
    return (
      <section className="twx-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Még nincs korábbi munkád. A feljavított képek és a kész látványtervek itt jelennek majd meg, mappákba rendezve.
        </p>
      </section>
    );
  }

  const dragStart = (e: React.DragEvent, url: string) => {
    e.dataTransfer.setData(TWX_DRAG_TYPE, url);
    e.dataTransfer.setData("text/plain", url);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <>
      <section className="twx-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{note}</p>

        {entries.length > LIMIT && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keresés a mappák közt…"
            className="twx-input mt-3 w-full text-sm"
          />
        )}

        {/* Mappák + Kedvencek — rácsban, hogy 9 elférjen; a tartalom jobb oldalt nyílik */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {visibleEntries.map((e) => {
            const on = open === e.key;
            return (
              <button
                key={e.key}
                type="button"
                onClick={() => setOpen((cur) => (cur === e.key ? null : e.key))}
                className="flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition hover:shadow-sm"
                style={{ borderColor: on ? "var(--twx-coral)" : "var(--twx-line)", background: on ? "var(--twx-coral-soft)" : "#fff" }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {e.fav ? (
                    <StarIcon />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" className="shrink-0" style={{ color: "var(--twx-coral)" }} aria-hidden>
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                    </svg>
                  )}
                  <span className="truncate font-display text-sm font-semibold">{e.label}</span>
                </span>
                <span className="shrink-0 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{e.count}</span>
              </button>
            );
          })}
        </div>
        {visibleEntries.length === 0 && (
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs találat.</p>
        )}
        {filtered.length > LIMIT && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 rounded-xl border px-4 py-2 text-xs font-medium transition hover:shadow-sm"
            style={{ borderColor: "var(--twx-line)", color: "var(--twx-coral)", background: "#fff" }}
          >
            {expanded ? "Kevesebb" : `Továbbiak (${filtered.length - LIMIT})`}
          </button>
        )}
      </section>

      {/* Jobb oldalt becsúszó panel — a lap margójában, a kiválasztott mappa képeivel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="drawer"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed right-4 top-28 z-40 flex max-h-[74vh] w-[min(360px,92vw)] flex-col overflow-hidden rounded-2xl"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}
          >
            <div className="flex items-center justify-between border-b p-3" style={{ borderColor: "var(--twx-line)" }}>
              <div className="font-display text-sm font-semibold">{openLabel} · {openUrls.length} kép</div>
              <button onClick={() => setOpen(null)} className="rounded-lg px-2 text-lg" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {openUrls.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs kép ebben a mappában.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {openUrls.map((url) => {
                    const isSel = selected.has(url);
                    return (
                      <button
                        key={url}
                        type="button"
                        draggable
                        onDragStart={(e) => dragStart(e, url)}
                        onClick={() => onPick?.(url)}
                        title={onPick ? "Kattints a hozzáadáshoz, vagy húzd a munkádba" : "Húzd a munkádba"}
                        className="relative cursor-grab overflow-hidden rounded-lg border-2 transition hover:opacity-90 active:cursor-grabbing"
                        style={{ borderColor: isSel ? "var(--twx-coral)" : "var(--twx-line)" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Korábbi kép" draggable={false} className="h-20 w-full object-cover" />
                        {isSel && (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="1.6" strokeLinejoin="round" fill="var(--twx-coral)" stroke="var(--twx-coral)" aria-hidden>
      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21.4l1.1-6.5L2.6 10l6.5-.9L12 3Z" />
    </svg>
  );
}
