// dashboard/flyer/history — Korábbi hirdetések.
// A korábban ELFOGADOTT hirdetések külön oldalon (nem a hirdetéskészítőben).
// Kattintásra nézegető (lightbox) nyílik: balra/jobbra lapozás + külön letöltés gomb.
"use client";

import { useCallback, useEffect, useState } from "react";
import { toDownloadUrl } from "@/lib/files";

type FlyerHistoryItem = { id: string; title: string; url: string; createdAt: string };

export default function FlyerHistoryPage() {
  const [flyers, setFlyers] = useState<FlyerHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewIdx, setViewIdx] = useState<number | null>(null); // a nézegetőben látott hirdetés

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/flyer/library");
        const data = await res.json();
        if (res.ok) setFlyers(data.flyers ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const close = useCallback(() => setViewIdx(null), []);
  const prev = useCallback(
    () => setViewIdx((i) => (i === null ? i : (i - 1 + flyers.length) % flyers.length)),
    [flyers.length]
  );
  const next = useCallback(
    () => setViewIdx((i) => (i === null ? i : (i + 1) % flyers.length)),
    [flyers.length]
  );

  // Billentyűzet: nyilak lapoznak, Esc bezár.
  useEffect(() => {
    if (viewIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewIdx, close, prev, next]);

  const current = viewIdx !== null ? flyers[viewIdx] : null;

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Korábbi hirdetések</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Kattints egy hirdetésre a nézegetőhöz — ott lapozhatsz és letöltheted.
        </p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
      ) : flyers.length === 0 ? (
        <div className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Még nincs elkészült hirdetésed.{" "}
          <a href="/dashboard/flyer" className="underline" style={{ color: "var(--twx-coral)" }}>
            Készíts egyet
          </a>
          .
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {flyers.map((f, idx) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setViewIdx(idx)}
              className="overflow-hidden rounded-xl text-left transition-transform hover:-translate-y-0.5"
              style={{ border: "1px solid var(--twx-line)" }}
              title={`${f.title} · ${new Date(f.createdAt).toLocaleDateString("hu-HU")}`}
            >
              <img src={f.url} alt={f.title} className="aspect-[3/4] w-full object-cover" />
              <div className="p-2">
                <p className="truncate text-sm font-medium">{f.title}</p>
                <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {new Date(f.createdAt).toLocaleDateString("hu-HU")}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Nézegető (lightbox) */}
      {current && (
        <div
          onClick={close}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
          style={{ background: "rgba(12,11,10,0.86)" }}
        >
          {/* Fejléc: cím + bezárás */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="mb-3 flex w-full max-w-3xl items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium" style={{ color: "#fff" }}>{current.title}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                {new Date(current.createdAt).toLocaleDateString("hu-HU")} · {(viewIdx ?? 0) + 1}/{flyers.length}
              </p>
            </div>
            <div className="flex flex-none items-center gap-2">
              <a
                href={toDownloadUrl(current.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="twx-btn"
              >
                Letöltés
              </a>
              <button
                type="button"
                onClick={close}
                aria-label="Bezárás"
                className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Kép + lapozó nyilak */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-3xl items-center justify-center gap-3"
          >
            {flyers.length > 1 && (
              <button
                type="button"
                onClick={prev}
                aria-label="Előző"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-xl"
                style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
              >
                ‹
              </button>
            )}
            <img
              src={current.url}
              alt={current.title}
              className="max-h-[76vh] w-auto rounded-lg object-contain"
              style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}
            />
            {flyers.length > 1 && (
              <button
                type="button"
                onClick={next}
                aria-label="Következő"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-xl"
                style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
