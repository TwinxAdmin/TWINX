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

  const selected = new Set(selectedUrls);
  const openUrls =
    open === FAV_KEY ? favorites : (folders.find((f) => f.key === open)?.urls ?? []);
  const openLabel =
    open === FAV_KEY ? "Kedvencek" : (folders.find((f) => f.key === open)?.label ?? "");

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
    <section className="twx-card p-5 sm:p-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{note}</p>

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,240px)_1fr]">
        {/* Mappák + Kedvencek */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
          {favorites.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(FAV_KEY)}
              className="flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition hover:shadow-sm"
              style={{
                borderColor: "var(--twx-coral)",
                background: open === FAV_KEY ? "var(--twx-coral)" : "var(--twx-coral-soft)",
              }}
            >
              <span className="flex items-center gap-2">
                <StarIcon />
                <span className="font-display text-sm font-semibold" style={{ color: open === FAV_KEY ? "#1c1005" : "#7a2e17" }}>Kedvencek</span>
              </span>
              <span className="text-xs" style={{ color: open === FAV_KEY ? "#1c1005" : "#7a2e17" }}>{favorites.length}</span>
            </button>
          )}
          {folders.map((f) => {
            const on = open === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setOpen(f.key)}
                className="flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition hover:shadow-sm"
                style={{ borderColor: on ? "var(--twx-coral)" : "var(--twx-line)", background: on ? "var(--twx-coral-soft)" : "#fff" }}
              >
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" style={{ color: "var(--twx-coral)" }} aria-hidden>
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                  </svg>
                  <span className="font-display text-sm font-semibold">{f.label}</span>
                </span>
                <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{f.urls.length}</span>
              </button>
            );
          })}
        </div>

        {/* Jobb oldali panel — a kiválasztott mappa tartalma animálva */}
        <div className="min-h-[7rem] rounded-xl p-1">
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div
                key={open}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <div className="mb-2 text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{openLabel} · {openUrls.length} kép</div>
                {openUrls.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs kép ebben a mappában.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
              </motion.div>
            ) : (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-24 items-center justify-center text-center text-sm"
                style={{ color: "var(--twx-ink-muted)" }}
              >
                Kattints egy mappára a képek megtekintéséhez.
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="1.6" strokeLinejoin="round" fill="var(--twx-coral)" stroke="var(--twx-coral)" aria-hidden>
      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21.4l1.1-6.5L2.6 10l6.5-.9L12 3Z" />
    </svg>
  );
}
