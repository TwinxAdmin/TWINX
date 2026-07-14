// dashboard/flyer/history — Korábbi hirdetések.
// A korábban ELFOGADOTT hirdetések külön oldalon (nem a hirdetéskészítőben),
// hogy később ne csak ingatlanos hirdetéseket lehessen itt gyűjteni.
"use client";

import { useEffect, useState } from "react";
import { toDownloadUrl } from "@/lib/files";

type FlyerHistoryItem = { id: string; title: string; url: string; createdAt: string };

export default function FlyerHistoryPage() {
  const [flyers, setFlyers] = useState<FlyerHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Korábbi hirdetések</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          A korábban elfogadott hirdetéseid. Kattints egy hirdetésre a letöltéshez.
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
          {flyers.map((f) => (
            <a
              key={f.id}
              href={toDownloadUrl(f.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-xl"
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
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
