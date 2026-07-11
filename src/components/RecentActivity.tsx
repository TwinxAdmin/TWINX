// Legutóbbi tevékenység — alapból összecsukva, gombra nyílik.
// A fájlra kattintva NEM új URL nyílik, hanem egy beágyazott nézegető (lightbox):
// a kép animálva megnagyobbodik, mellé kattintva bezárul, nyílgombokkal /
// gombokkal az előző/következő tevékenységre lehet lépni.
"use client";

import { useCallback, useEffect, useState } from "react";
import { toDownloadUrl } from "@/lib/files";

export type ActivityItem = {
  id: string;
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

export default function RecentActivity({ items }: { items: ActivityItem[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setActive(null), 180);
  }, []);

  const go = useCallback(
    (dir: number) => {
      setActive((i) => {
        if (i === null) return i;
        const n = i + dir;
        return n < 0 || n >= items.length ? i : n;
      });
    },
    [items.length]
  );

  useEffect(() => {
    if (active === null) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    // A háttér görgetésének letiltása, amíg nyitva van a nézegető.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [active, close, go]);

  const current = active !== null ? items[active] : null;
  const curKind = current ? kind(current.output_file_url) : "other";

  return (
    <section className="max-w-md">
      <h2 className="font-display text-xl font-medium">Legutóbbi tevékenység</h2>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={items.length === 0}
        className="mt-3 rounded-full px-4 py-2 text-sm font-medium transition-colors"
        style={{
          border: "1px solid var(--twx-line)",
          background: open ? "var(--twx-coral)" : "var(--twx-cream-card)",
          color: open ? "#1c1005" : "var(--twx-ink)",
          opacity: items.length === 0 ? 0.5 : 1,
        }}
      >
        {items.length === 0
          ? "Nincs tevékenység"
          : open
            ? "Elrejtés"
            : `Megjelenítés (${items.length})`}
      </button>

      {open && (
        <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {items.map((h, idx) => {
            const k = kind(h.output_file_url);
            const label =
              k === "pdf" ? "PDF" : k === "video" ? "MP4" : k === "other" ? "Fájl" : "";
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => h.output_file_url && setActive(idx)}
                  className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left text-sm transition-colors hover:bg-black/[0.03]"
                  style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}
                >
                  {k === "image" && h.output_file_url ? (
                    <img
                      src={h.output_file_url}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-lg object-cover"
                      style={{ border: "1px solid var(--twx-line)" }}
                    />
                  ) : (
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
                      style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}
                    >
                      {label}
                    </span>
                  )}

                  <div className="min-w-0">
                    <p className="truncate font-medium">{h.title}</p>
                    <p className="truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      {h.typeLabel} · {new Date(h.created_at).toLocaleString("hu-HU")}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Beágyazott nézegető (lightbox) */}
      {current && (
        <div
          onClick={close}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200"
          style={{
            background: "rgba(12,11,10,0.82)",
            opacity: visible ? 1 : 0,
          }}
        >
          {/* Balra */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            disabled={active === 0}
            aria-label="Előző"
            className="absolute left-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-opacity"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff", opacity: active === 0 ? 0.3 : 1 }}
          >
            ‹
          </button>

          {/* Tartalom */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] max-w-[90vw] flex-col items-center gap-3 transition-all duration-200"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "scale(1)" : "scale(0.94)",
            }}
          >
            {curKind === "image" && current.output_file_url && (
              <img
                src={current.output_file_url}
                alt=""
                className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain"
                style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}
              />
            )}
            {curKind === "video" && current.output_file_url && (
              <video
                src={current.output_file_url}
                controls
                autoPlay
                className="max-h-[80vh] max-w-[90vw] rounded-xl"
                style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}
              />
            )}
            {curKind === "pdf" && current.output_file_url && (
              <iframe
                src={`${current.output_file_url}#view=FitH&toolbar=1&navpanes=0`}
                title={current.title}
                className="h-[86vh] w-[min(96vw,1100px)] rounded-xl bg-white"
                style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}
              />
            )}
            {curKind === "other" && current.output_file_url && (
              <a
                href={current.output_file_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full px-5 py-2.5 text-sm font-medium"
                style={{ background: "var(--twx-coral)", color: "#1c1005" }}
              >
                Fájl megnyitása
              </a>
            )}

            {/* Felirat */}
            <div className="text-center text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
              <span className="font-medium">{current.title}</span>
              <span className="mx-2" style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
              <span>{current.typeLabel}</span>
              <span className="mx-2" style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
              <time dateTime={current.created_at}>
                {new Date(current.created_at).toLocaleString("hu-HU")}
              </time>
              <span className="ml-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                {(active ?? 0) + 1} / {items.length}
              </span>
            </div>

            {/* Megnyitás + Letöltés */}
            {current.output_file_url && (
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href={current.output_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full px-5 py-2 text-sm font-medium"
                  style={{ background: "var(--twx-coral)", color: "#1c1005" }}
                >
                  Megnyitás
                </a>
                <a
                  href={toDownloadUrl(current.output_file_url)}
                  className="rounded-full px-5 py-2 text-sm font-medium"
                  style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
                >
                  Letöltés
                </a>
              </div>
            )}
          </div>

          {/* Jobbra */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            disabled={active === items.length - 1}
            aria-label="Következő"
            className="absolute right-4 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-opacity"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff", opacity: active === items.length - 1 ? 0.3 : 1 }}
          >
            ›
          </button>

          {/* Bezárás */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); close(); }}
            aria-label="Bezárás"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-xl"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}
          >
            ×
          </button>
        </div>
      )}
    </section>
  );
}
