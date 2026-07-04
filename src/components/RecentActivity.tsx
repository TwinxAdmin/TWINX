// Legutóbbi tevékenység — alapból összecsukva, gombra nyílik.
// Kinyitva görgethető listában preview képekkel / PDF- és videólinkkel,
// hogy ne nyújtsa meg feleslegesen az oldalt.
"use client";

import { useState } from "react";

export type ActivityItem = {
  id: string;
  serviceName: string;
  feature_used: string;
  output_file_url: string | null;
  created_at: string;
};

function kind(url: string | null): "image" | "pdf" | "video" | "other" {
  if (!url) return "other";
  const u = url.split("?")[0].toLowerCase();
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(u)) return "image";
  if (/\.pdf$/.test(u)) return "pdf";
  if (/\.(mp4|mov|webm)$/.test(u)) return "video";
  return "other";
}

export default function RecentActivity({ items }: { items: ActivityItem[] }) {
  const [open, setOpen] = useState(false);

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
          {items.map((h) => {
            const k = kind(h.output_file_url);
            const label =
              k === "pdf" ? "PDF" : k === "video" ? "MP4" : k === "other" ? "Fájl" : "";
            return (
              <li key={h.id}>
                <a
                  href={h.output_file_url ?? "#"}
                  target={h.output_file_url ? "_blank" : undefined}
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl p-2.5 text-sm transition-colors hover:bg-black/[0.03]"
                  style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}
                >
                  {/* Fájl / preview */}
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

                  {/* Név + dátum közvetlenül mellette */}
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {h.serviceName} · {h.feature_used}
                    </p>
                    <time
                      dateTime={h.created_at}
                      className="text-xs"
                      style={{ color: "var(--twx-ink-muted)" }}
                    >
                      {new Date(h.created_at).toLocaleString("hu-HU")}
                    </time>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
