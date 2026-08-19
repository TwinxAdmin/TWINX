// WorksBrowser — a „Korábbi munkák" oldal.
//
// Nyitáskor MAPPÁKAT mutat: minden modulnak egy mappája (Hirdetés, Értékbecslés,
// Videó…), borítóképpel és darabszámmal. A mappát megnyitva jön a bélyegképes
// rács, onnan pedig a nézegető (lightbox) — ugyanaz, mint a dashboardon.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toDownloadUrl } from "@/lib/files";
import ModuleIcon from "@/components/ModuleIcon";

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

export default function WorksBrowser({ items }: { items: WorkItem[] }) {
  const [folder, setFolder] = useState<string | null>(null); // melyik modul-mappa van nyitva
  const [active, setActive] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  // Mappák: modulonként egy, csak azokból, amikben tényleg van munka.
  // Az elemek már idő szerint csökkenő sorrendben jönnek, így az első kép
  // egyben a legfrissebb — jó borítónak.
  const folders = useMemo(() => {
    const map = new Map<string, { label: string; items: WorkItem[]; cover: string | null }>();
    for (const it of items) {
      const f = map.get(it.feature) ?? { label: it.typeLabel, items: [], cover: null };
      f.items.push(it);
      if (!f.cover && kind(it.output_file_url) === "image") f.cover = it.output_file_url;
      map.set(it.feature, f);
    }
    return [...map.entries()]
      .map(([feature, v]) => ({ feature, ...v }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [items]);

  const openFolder = folders.find((f) => f.feature === folder) ?? null;
  const shown = openFolder?.items ?? [];

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setActive(null), 180);
  }, []);

  const go = useCallback((dir: number) => {
    setActive((i) => {
      if (i === null) return i;
      const n = i + dir;
      return n < 0 || n >= shown.length ? i : n;
    });
  }, [shown.length]);

  useEffect(() => {
    if (active === null) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [active, close, go]);

  // Szűrőváltásnál a nyitott nézegető indexe elcsúszna — bezárjuk.
  useEffect(() => { setActive(null); }, [filter]);

  const current = active !== null ? shown[active] : null;
  const curKind = current ? kind(current.output_file_url) : "other";

  if (items.length === 0) {
    return (
      <p className="twx-card p-8 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Még nincs elkészült munkád. Válassz egy modult a menüből, és az eredmény itt fog megjelenni.
      </p>
    );
  }

  return (
    <>
      {/* Modul-szűrő */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter("all")}
          className="rounded-full px-3.5 py-1.5 text-sm font-medium transition"
          style={filter === "all"
            ? { background: "var(--twx-coral)", color: "#1c1005" }
            : { border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)" }}>
          Mind ({items.length})
        </button>
        {filters.map((f) => (
          <button key={f.value} type="button" onClick={() => setFilter(f.value)}
            className="rounded-full px-3.5 py-1.5 text-sm font-medium transition"
            style={filter === f.value
              ? { background: "var(--twx-coral)", color: "#1c1005" }
              : { border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)" }}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Rács */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((h, idx) => {
          const k = kind(h.output_file_url);
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => h.output_file_url && setActive(idx)}
              className="group overflow-hidden rounded-2xl text-left transition-shadow hover:shadow-lg"
              style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)" }}
            >
              <div className="relative aspect-[4/3] overflow-hidden" style={{ background: "var(--twx-cream)" }}>
                {k === "image" && h.output_file_url ? (
                  <img src={h.output_file_url} alt=""
                    className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center"
                    style={k === "video"
                      ? { background: "var(--twx-dark)", color: "var(--twx-coral)" }
                      : { background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                    {k === "video" ? (
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                      </svg>
                    ) : (
                      <span className="text-sm font-bold">{k === "pdf" ? "PDF" : "FÁJL"}</span>
                    )}
                  </span>
                )}
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

      {/* Nézegető */}
      {current && (
        <div onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200"
          style={{ background: "rgba(12,11,10,0.82)", opacity: visible ? 1 : 0 }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }}
            disabled={active === 0} aria-label="Előző"
            className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-2xl"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff", opacity: active === 0 ? 0.3 : 1 }}>‹</button>

          <div onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] max-w-[90vw] flex-col items-center gap-3 transition-all duration-200"
            style={{ opacity: visible ? 1 : 0, transform: visible ? "scale(1)" : "scale(0.94)" }}>
            {curKind === "image" && current.output_file_url && (
              <img src={current.output_file_url} alt=""
                className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain"
                style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }} />
            )}
            {curKind === "video" && current.output_file_url && (
              <video src={current.output_file_url} controls autoPlay
                className="max-h-[80vh] max-w-[90vw] rounded-xl"
                style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }} />
            )}
            {curKind === "pdf" && current.output_file_url && (
              <iframe src={`${current.output_file_url}#view=FitH&toolbar=1&navpanes=0`} title={current.title}
                className="h-[86vh] w-[min(96vw,1100px)] rounded-xl bg-white"
                style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }} />
            )}

            <div className="text-center text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
              <span className="font-medium">{current.title}</span>
              <span className="mx-2" style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
              <span>{current.typeLabel}</span>
              <span className="mx-2" style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
              <time dateTime={current.created_at}>{new Date(current.created_at).toLocaleString("hu-HU")}</time>
              <span className="ml-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                {(active ?? 0) + 1} / {shown.length}
              </span>
            </div>

            {current.output_file_url && (
              <div className="flex flex-wrap justify-center gap-3">
                <a href={current.output_file_url} target="_blank" rel="noreferrer"
                  className="rounded-full px-5 py-2 text-sm font-medium"
                  style={{ background: "var(--twx-coral)", color: "#1c1005" }}>Megnyitás</a>
                <a href={toDownloadUrl(current.output_file_url)}
                  className="rounded-full px-5 py-2 text-sm font-medium"
                  style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}>Letöltés</a>
              </div>
            )}
          </div>

          <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }}
            disabled={active === shown.length - 1} aria-label="Következő"
            className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-2xl"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff", opacity: active === shown.length - 1 ? 0.3 : 1 }}>›</button>

          <button type="button" onClick={(e) => { e.stopPropagation(); close(); }} aria-label="Bezárás"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-xl"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}>×</button>
        </div>
      )}
    </>
  );
}
