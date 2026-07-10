// dashboard/flyer — Hirdetéskészítő.
// F2: adatforrás — arculat-profil választás + munkakönyvtár (korábbi munkák képei/adatai)
// VAGY saját feltöltés. A szöveg (F3) és a layout/render (F4) külön fázisban jön.
"use client";

import { useEffect, useMemo, useState } from "react";
import type { BrandingProfile } from "@/lib/branding";
import type { LibraryItem } from "@/lib/flyer";

type Source = "library" | "upload";

export default function FlyerPage() {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [source, setSource] = useState<Source>("library");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploads, setUploads] = useState<{ file: File; url: string }[]>([]);
  const [prefill, setPrefill] = useState<LibraryItem["data"] | null>(null);
  const [visibleCount, setVisibleCount] = useState(8); // 2 sor (4 oszlop) alapból

  useEffect(() => {
    (async () => {
      try {
        const [pRes, lRes] = await Promise.all([
          fetch("/api/branding"),
          fetch("/api/flyer/library"),
        ]);
        const p = await pRes.json();
        const l = await lRes.json();
        if (pRes.ok) {
          setProfiles(p.profiles ?? []);
          if ((p.profiles ?? []).length) setProfileId(p.profiles[0].id);
        }
        if (lRes.ok) setLibrary(l.items ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const libraryImages = useMemo(
    () => Array.from(new Set(library.flatMap((i) => i.images))),
    [library]
  );
  const dataItems = useMemo(() => library.filter((i) => i.data), [library]);

  function toggleImage(url: string) {
    setSelectedImages((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  }

  function onUpload(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setUploads((prev) => [...prev, ...next]);
  }

  const chosenCount = source === "library" ? selectedImages.length : uploads.length;

  return (
    <main className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Hirdetéskészítő</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Válaszd ki, kinek a nevében készül, és honnan jönnek a képek/adatok. A szöveget és a
          végső hirdetés-elrendezést a következő lépésben állítjuk be.
        </p>
      </div>

      {/* 1) Arculat-profil */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-medium">1. Arculat</h2>
        {loading ? (
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
        ) : profiles.length === 0 ? (
          <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Még nincs arculatod.{" "}
            <a href="/dashboard/branding" className="underline" style={{ color: "var(--twx-coral)" }}>
              Hozz létre egyet
            </a>{" "}
            a hirdetéshez.
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {profiles.map((p) => {
              const active = profileId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProfileId(p.id)}
                  className="flex items-center gap-3 rounded-xl p-3 text-left transition-colors"
                  style={{
                    border: `1px solid ${active ? "var(--twx-coral)" : "var(--twx-line)"}`,
                    background: active ? "var(--twx-coral-soft)" : "var(--twx-cream-card)",
                  }}
                >
                  {p.logo_url ? (
                    <img src={p.logo_url} alt="" className="h-9 w-9 rounded object-contain" style={{ border: "1px solid var(--twx-line)" }} />
                  ) : (
                    <span className="h-9 w-9 rounded" style={{ background: p.accent_color }} />
                  )}
                  <div>
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{p.display_name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 2) Adatforrás */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-medium">2. Képek és adatok</h2>

        <div className="flex gap-2">
          {(["library", "upload"] as Source[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
              style={{
                border: "1px solid var(--twx-line)",
                background: source === s ? "var(--twx-coral)" : "var(--twx-cream-card)",
                color: source === s ? "#1c1005" : "var(--twx-ink)",
              }}
            >
              {s === "library" ? "Korábbi munkáimból" : "Saját feltöltés"}
            </button>
          ))}
        </div>

        {source === "library" ? (
          <div className="space-y-5">
            {/* Adat-előtöltés */}
            {dataItems.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Adatok betöltése egy korábbi munkából</p>
                <div className="flex flex-wrap gap-2">
                  {dataItems.map((i) => {
                    const active = prefill === i.data;
                    return (
                      <button
                        key={i.id}
                        onClick={() => setPrefill(active ? null : i.data)}
                        className="rounded-full px-3 py-1.5 text-xs transition-colors"
                        style={{
                          border: `1px solid ${active ? "var(--twx-coral)" : "var(--twx-line)"}`,
                          background: active ? "var(--twx-coral-soft)" : "var(--twx-cream-card)",
                          color: "var(--twx-ink)",
                        }}
                      >
                        {i.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Kép-választó */}
            <div>
              <p className="mb-2 text-sm font-medium">Képek kiválasztása (látványtervek, feltöltések)</p>
              {libraryImages.length === 0 ? (
                <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                  Nincs korábbi képed. Válts a „Saját feltöltés" fülre.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {libraryImages.slice(0, visibleCount).map((url) => {
                      const active = selectedImages.includes(url);
                      return (
                        <button
                          key={url}
                          onClick={() => toggleImage(url)}
                          className="relative overflow-hidden rounded-xl"
                          style={{ border: `2px solid ${active ? "var(--twx-coral)" : "var(--twx-line)"}` }}
                        >
                          <img src={url} alt="" className="aspect-[4/3] w-full object-cover" />
                          {active && (
                            <span
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold"
                              style={{ background: "var(--twx-coral)", color: "#1c1005" }}
                            >
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {libraryImages.length > visibleCount && (
                    <button
                      onClick={() => setVisibleCount((c) => c + 8)}
                      className="mt-3 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                      style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", color: "var(--twx-ink)" }}
                    >
                      Továbbiak betöltése ({libraryImages.length - visibleCount})
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label
              htmlFor="flyer-upload"
              className="inline-block cursor-pointer rounded-full px-4 py-2 text-sm font-medium"
              style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", color: "var(--twx-ink)" }}
            >
              Képek feltöltése
            </label>
            <input
              id="flyer-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => onUpload(e.target.files)}
            />
            {uploads.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {uploads.map((u, idx) => (
                  <div key={idx} className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
                    <img src={u.url} alt="" className="aspect-[4/3] w-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Összegzés + következő lépés (F3/F4) */}
      <section className="twx-card space-y-1 p-4 text-sm">
        <p>
          <span style={{ color: "var(--twx-ink-muted)" }}>Arculat:</span>{" "}
          {profiles.find((p) => p.id === profileId)?.label ?? "—"}
        </p>
        <p>
          <span style={{ color: "var(--twx-ink-muted)" }}>Kiválasztott kép:</span> {chosenCount} db
        </p>
        {prefill && (
          <p>
            <span style={{ color: "var(--twx-ink-muted)" }}>Betöltött adat:</span>{" "}
            {[prefill.telepules, prefill.utca, prefill.tipus, prefill.meret].filter(Boolean).join(" · ")}
          </p>
        )}
      </section>

      <button
        disabled
        className="twx-btn w-full"
        title="A szöveg és az elrendezés a következő fázisban készül el"
      >
        Tovább a szöveghez és az elrendezéshez (hamarosan)
      </button>
    </main>
  );
}
