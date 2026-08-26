// Keskeny sávra tervezett „Korábbi munkák" választó (a videó-varázsló jobb margójában).
// Az AssetTray mappa-rácsa szűk helyen összenyomódik, ezért itt LEGÖRDÜLŐBŐL választasz
// mappát, és alatta látod a benne lévő képeket. A képek húzhatók a szerkesztő
// „Húzd ide a képeket" feltöltőjére, vagy egy kattintással hozzáadhatók.
"use client";

import { useEffect, useMemo, useState } from "react";
import { TWX_DRAG_TYPE } from "@/components/AssetTray";
import SelectField, { type SelectOption } from "@/components/SelectField";

type Folder = { id: string | null; key: string; kind: "named" | "date"; label: string; urls: string[] };
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

  // Választható tételek: Kedvencek + mappák (elnevezettek elöl), csoportosítva.
  const entries = useMemo(() => {
    const named = folders.filter((f) => f.kind === "named");
    const dated = folders.filter((f) => f.kind !== "named");
    const list: Array<{ key: string; label: string; urls: string[]; group: string }> = [];
    if (favorites.length) list.push({ key: FAV_KEY, label: `Kedvencek (${favorites.length})`, urls: favorites, group: "Kiemelt" });
    for (const f of named) list.push({ key: f.key, label: `${f.label} (${f.urls.length})`, urls: f.urls, group: "Ingatlan-mappák" });
    for (const f of dated) list.push({ key: f.key, label: `${f.label} (${f.urls.length})`, urls: f.urls, group: "Dátum szerint" });
    return list;
  }, [folders, favorites]);

  const options: SelectOption[] = entries.map((e) => ({ value: e.key, label: e.label, group: e.group }));

  const openUrls = entries.find((e) => e.key === openKey)?.urls ?? [];
  const selected = new Set(selectedUrls);

  return (
    <section className="twx-card p-4">
      <h3 className="text-sm font-semibold">Korábbi munkák</h3>
      <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
        Válassz mappát, majd húzd a képet a feltöltőre — vagy kattints rá.
      </p>

      {loading ? (
        <p className="mt-3 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs korábbi munkád.</p>
      ) : (
        <>
          <div className="mt-3">
            <SelectField
              value={openKey}
              onChange={setOpenKey}
              options={options}
              placeholder="Válassz mappát…"
              ariaLabel="Mappa választása"
            />
          </div>

          {openKey && (
            <div className="mt-3">
              {openUrls.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs kép ebben a mappában.</p>
              ) : (
                <div className="grid max-h-[52vh] grid-cols-2 gap-2 overflow-y-auto">
                  {openUrls.map((url) => {
                    const isSel = selected.has(url);
                    return (
                      <button
                        key={url}
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(TWX_DRAG_TYPE, url);
                          e.dataTransfer.effectAllowed = "copy";
                          // „Szellemkép" az egérhez: a bélyegkép KLÓNJA, a DOM-ba téve.
                          // (Az eredeti elemet nem használhatjuk: a húzás alatti
                          // halványítás és a CORS-os kép miatt sok böngészőben üres marad.)
                          const thumb = e.currentTarget.querySelector("img");
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
                            e.dataTransfer.setDragImage(ghost, 80, 56);
                            window.setTimeout(() => ghost.remove(), 0);
                          }
                          // A halványítás csak a pillanatkép elkészülte UTÁN induljon.
                          window.setTimeout(() => setDragging(url), 0);
                        }}
                        onDragEnd={() => setDragging(null)}
                        onClick={() => onPick?.(url)}
                        title="Húzd a feltöltőre, vagy kattints a hozzáadáshoz"
                        className="relative cursor-grab overflow-hidden rounded-lg border-2 transition-opacity active:cursor-grabbing"
                        style={{
                          borderColor: dragging === url ? "var(--twx-coral)" : isSel ? "var(--twx-coral)" : "var(--twx-line)",
                          opacity: dragging === url ? 0.45 : 1,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Korábbi kép" draggable={false} crossOrigin="anonymous" className="h-20 w-full object-cover" />
                        {isSel && (
                          <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                            style={{ background: "var(--twx-coral)", color: "#1c1005" }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
