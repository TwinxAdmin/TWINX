// WorksBrowser — a „Korábbi munkák" oldal.
//
// Nyitáskor MAPPÁKAT mutat: minden modulnak egy mappája (Hirdetés, Értékbecslés,
// Videó…), borítóképpel és darabszámmal. A mappát megnyitva jön a bélyegképes
// rács, onnan pedig a nézegető (lightbox) — ugyanaz, mint a dashboardon.
"use client";

import { useEffect, useMemo, useState } from "react";
import WorkViewer from "@/components/works/WorkViewer";
import WorkThumb from "@/components/works/WorkThumb";
import ModuleIcon from "@/components/ModuleIcon";
import { featureFolder } from "@/lib/activity";

// Melyik modulhoz melyik ikon tartozik (lásd ModuleIcon).
const FEATURE_ICON: Record<string, string> = {
  valuation: "valuation",
  "land-valuation": "land",
  visualization: "visualization",
  image_enhance: "visualization",
  video: "video",
  flyer: "flyer",
  "ad-check": "history",
  menu_generator: "menu",
};

export type WorkItem = {
  id: string;
  feature: string;      // usage_history.feature_used
  title: string;
  typeLabel: string;
  output_file_url: string | null;
  created_at: string;
  hidden?: boolean;     // „Törlés" = elrejtés: csak az Elrejtett munkák nézetben látszik
};

type Kind = "image" | "pdf" | "video" | "other";

function kind(url: string | null): Kind {
  if (!url) return "other";
  const u = url.split("?")[0].toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(u)) return "image";
  if (/\.pdf$/.test(u)) return "pdf";
  if (/\.(mp4|mov|webm)$/.test(u)) return "video";
  return "other";
}

function relativeDay(iso: string): string {
  const d = new Date(iso);
  const t = new Date();
  const days = Math.floor(
    (new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000
  );
  if (days <= 0) return "ma";
  if (days === 1) return "tegnap";
  if (days < 7) return `${days} napja`;
  if (days < 30) return `${Math.floor(days / 7)} hete`;
  return d.toLocaleDateString("hu-HU");
}

export default function WorksBrowser({ items, canShareToOffice = false }: { items: WorkItem[]; canShareToOffice?: boolean }) {
  const [folder, setFolder] = useState<string | null>(null); // melyik modul-mappa van nyitva
  const [active, setActive] = useState<number | null>(null);

  // Mappák: modulonként egy, csak azokból, amikben tényleg van munka.
  // Az elemek már idő szerint csökkenő sorrendben jönnek, így az első kép
  // egyben a legfrissebb — jó borítónak.
  const folders = useMemo(() => {
    const map = new Map<string, { items: WorkItem[]; cover: string | null }>();
    for (const it of items) {
      const f = map.get(it.feature) ?? { items: [], cover: null };
      f.items.push(it);
      if (!f.cover && kind(it.output_file_url) === "image") f.cover = it.output_file_url;
      map.set(it.feature, f);
    }
    return [...map.entries()]
      .map(([feature, v]) => ({ feature, ...v, ...featureFolder(feature) }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [items]);

  const openFolder = folders.find((f) => f.feature === folder) ?? null;
  const shown = openFolder?.items ?? [];

  // Mappaváltásnál a nyitott nézegető indexe elcsúszna — bezárjuk.
  useEffect(() => { setActive(null); }, [folder]);


  if (items.length === 0) {
    return (
      <p className="twx-card p-8 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Még nincs elkészült munkád. Válassz egy modult a menüből, és az eredmény itt fog megjelenni.
      </p>
    );
  }

  return (
    <>
      {/* ------------------------------ MAPPÁK ------------------------------ */}
      {!openFolder && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {folders.map((f) => (
            <button
              key={f.feature}
              type="button"
              onClick={() => setFolder(f.feature)}
              className="group overflow-hidden rounded-2xl text-left transition-shadow hover:shadow-lg"
              style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)" }}
            >
              <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "var(--twx-cream)" }}>
                {f.cover ? (
                  <img src={f.cover} alt=""
                    className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center"
                    style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                    <ModuleIcon name={FEATURE_ICON[f.feature] ?? "history"} className="h-10 w-10" />
                  </span>
                )}
                {/* Darabszám-jelvény, hogy egy pillantással látszódjon a mennyiség */}
                <span className="absolute right-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: "rgba(20,12,8,0.72)", color: "#fff" }}>
                  {f.items.length}
                </span>
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2" style={{ color: "var(--twx-coral)" }}>
                  <ModuleIcon name={FEATURE_ICON[f.feature] ?? "history"} className="h-4 w-4 shrink-0" />
                  <span className="truncate font-display text-base font-medium" style={{ color: "var(--twx-ink)" }}>
                    {f.title}
                  </span>
                </div>
                {/* Egy soros magyarázat: ránézésre derüljön ki, mi van a mappában. */}
                <p className="mt-0.5 truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {f.hint}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* --------------------------- MAPPA TARTALMA --------------------------- */}
      {openFolder && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setFolder(null)}
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)" }}>
            ← Vissza a mappákhoz
          </button>
          <p className="font-display text-lg font-medium">
            {openFolder.title}
            <span className="ml-2 text-sm font-normal" style={{ color: "var(--twx-ink-muted)" }}>
              {openFolder.hint} · {openFolder.items.length} db
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((h, idx) => {
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => setActive(idx)}
              className="group overflow-hidden rounded-2xl text-left transition-shadow hover:shadow-lg"
              style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)" }}
            >
              <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "var(--twx-cream)" }}>
                <WorkThumb url={h.output_file_url} />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{h.title}</p>
                <p className="truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {h.typeLabel} · {relativeDay(h.created_at)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Nézegető — a közös, felugró WorkViewer (videó is itt játszódik le) */}
      {active !== null && shown[active] && (
        <WorkViewer index={active} onIndex={setActive} onClose={() => setActive(null)} canShare={canShareToOffice}
          works={shown.map((h) => ({ id: h.id, title: h.title, typeLabel: h.typeLabel, url: h.output_file_url, createdAt: h.created_at, mine: true }))} />
      )}
    </>
  );
}
