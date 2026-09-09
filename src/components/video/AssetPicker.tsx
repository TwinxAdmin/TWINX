// Keskeny sávra tervezett „Korábbi munkák" választó (a videó-varázsló jobb margójában).
// Az AssetTray mappa-rácsa szűk helyen összenyomódik, ezért itt HARMONIKA van:
// minden mappa EGYSZERRE látszik a nevével és a képszámával, csoportosítva
// (Kedvencek · Ingatlan-mappák · Dátum szerint), és a kattintott mappa alatt
// kinyílnak a képei. A képek húzhatók a szerkesztő „Húzd ide a képeket"
// feltöltőjére, vagy egy kattintással hozzáadhatók.
"use client";

import { useEffect, useMemo, useState } from "react";
import { TWX_DRAG_TYPE } from "@/components/AssetTray";

type Folder = { id: string | null; key: string; kind: "named" | "date"; label: string; urls: string[] };
type Entry = { key: string; label: string; urls: string[]; kind: "fav" | "named" | "date" };
const FAV_KEY = "__fav__";

export default function AssetPicker({
  onPick,
  selectedUrls = [],
}: {
  onPick?: (url: string) => void;
  selectedUrls?: string[];
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string>("");
  // Épp húzott kép — a forrás-bélyeg halványodik, így látszik, mit fogtál meg.
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/real-estate/assets");
        const data = await res.json();
        if (!alive || !res.ok) return;
        setFolders(data.folders ?? []);
        setFavorites(data.favorites ?? []);
      } catch { /* csendben — a tálca opcionális */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // Csoportok: Kedvencek · elnevezett ingatlan-mappák · dátum-mappák.
  const groups = useMemo(() => {
    const out: Array<{ title: string; entries: Entry[] }> = [];
    if (favorites.length) out.push({ title: "Kiemelt", entries: [{ key: FAV_KEY, label: "Kedvencek", urls: favorites, kind: "fav" }] });
    const named = folders.filter((f) => f.kind === "named").map<Entry>((f) => ({ key: f.key, label: f.label, urls: f.urls, kind: "named" }));
    const dated = folders.filter((f) => f.kind !== "named").map<Entry>((f) => ({ key: f.key, label: f.label, urls: f.urls, kind: "date" }));
    if (named.length) out.push({ title: "Ingatlan-mappák", entries: named });
    if (dated.length) out.push({ title: "Dátum szerint", entries: dated });
    return out;
  }, [folders, favorites]);

  const total = groups.reduce((n, g) => n + g.entries.length, 0);
  const selected = new Set(selectedUrls);

  return (
    <section className="twx-card p-4">
      <h3 className="text-sm font-semibold">Korábbi munkák</h3>
      <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
        Nyiss meg egy mappát, és kattints a képre — vagy húzd a feltöltőre.
      </p>

      {loading ? (
        <p className="mt-3 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
      ) : total === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs korábbi munkád.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--twx-ink-muted)" }}>
                {g.title}
              </p>
              <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                {g.entries.map((e, i) => {
                  const open = openKey === e.key;
                  return (
                    <div key={e.key} style={{ borderTop: i > 0 ? "1px solid var(--twx-line)" : undefined }}>
                      {/* Mappa-sor: ikon · név · darabszám · nyíl */}
                      <button
                        type="button"
                        onClick={() => setOpenKey(open ? "" : e.key)}
                        aria-expanded={open}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition"
                        style={{ background: open ? "var(--twx-coral-soft)" : "transparent" }}
                      >
                        {e.kind === "fav" ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--twx-coral)" stroke="var(--twx-coral)" strokeWidth="1.5" strokeLinejoin="round" className="shrink-0" aria-hidden>
                            <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" />
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="shrink-0" style={{ color: open ? "#7a2e17" : "var(--twx-coral)" }} aria-hidden>
                            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                          </svg>
                        )}
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: open ? "#7a2e17" : "var(--twx-ink)" }}>
                          {e.label}
                        </span>
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ background: open ? "#fff" : "var(--twx-cream)", color: "var(--twx-ink-muted)" }}>
                          {e.urls.length}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className="shrink-0 transition-transform" style={{ color: "var(--twx-ink-muted)", transform: open ? "rotate(90deg)" : "none" }} aria-hidden>
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                      </button>

                      {/* A nyitott mappa képei — a sor alatt, 3 oszlopban */}
                      {open && (
                        <div className="px-2 pb-2 pt-1" style={{ background: "var(--twx-coral-soft)" }}>
                          {e.urls.length === 0 ? (
                            <p className="px-1 py-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Nincs kép ebben a mappában.</p>
                          ) : (
                            <div className="grid max-h-[40vh] grid-cols-3 gap-1.5 overflow-y-auto">
                              {e.urls.map((url) => {
                                const isSel = selected.has(url);
                                return (
                                  <button
                                    key={url}
                                    type="button"
                                    draggable
                                    onDragStart={(ev) => {
                                      ev.dataTransfer.setData(TWX_DRAG_TYPE, url);
                                      ev.dataTransfer.effectAllowed = "copy";
                                      // „Szellemkép" az egérhez: a bélyegkép KLÓNJA, a DOM-ba téve.
                                      // (Az eredeti elemet nem használhatjuk: a húzás alatti
                                      // halványítás és a CORS-os kép miatt sok böngészőben üres marad.)
                                      const thumb = ev.currentTarget.querySelector("img");
                                      if (thumb) {
                                        const ghost = thumb.cloneNode(true) as HTMLImageElement;
                                        ghost.style.position = "fixed";
                                        ghost.style.left = "-10000px";
                                        ghost.style.top = "0";
                                        ghost.style.width = "160px";
                                        ghost.style.height = "112px";
                                        ghost.style.objectFit = "cover";
                                        ghost.style.borderRadius = "10px";
                                        ghost.style.border = "2px solid #ef7a5a";
                                        ghost.style.boxShadow = "0 10px 26px rgba(0,0,0,0.35)";
                                        ghost.style.pointerEvents = "none";
                                        document.body.appendChild(ghost);
                                        ev.dataTransfer.setDragImage(ghost, 80, 56);
                                        window.setTimeout(() => ghost.remove(), 0);
                                      }
                                      // A halványítás csak a pillanatkép elkészülte UTÁN induljon.
                                      window.setTimeout(() => setDragging(url), 0);
                                    }}
                                    onDragEnd={() => setDragging(null)}
                                    onClick={() => onPick?.(url)}
                                    title="Húzd a feltöltőre, vagy kattints a hozzáadáshoz"
                                    className="relative cursor-grab overflow-hidden rounded-md border-2 bg-white transition-opacity active:cursor-grabbing"
                                    style={{
                                      borderColor: dragging === url || isSel ? "var(--twx-coral)" : "#fff",
                                      opacity: dragging === url ? 0.45 : 1,
                                    }}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt="Korábbi kép" draggable={false} crossOrigin="anonymous" className="aspect-[4/3] w-full object-cover" />
                                    {isSel && (
                                      <span className="absolute bottom-1 right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] font-bold"
                                        style={{ background: "var(--twx-coral)", color: "#1c1005", width: 18, height: 18 }}>✓</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
