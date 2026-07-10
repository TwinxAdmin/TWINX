// dashboard/flyer — Hirdetéskészítő.
// F2: adatforrás — arculat-profil választás + munkakönyvtár (korábbi munkák képei/adatai)
// VAGY saját feltöltés. A szöveg (F3) és a layout/render (F4) külön fázisban jön.
"use client";

import { useEffect, useMemo, useState } from "react";
import type { BrandingProfile } from "@/lib/branding";
import { MAX_FLYER_IMAGES, type LibraryItem } from "@/lib/flyer";

export default function FlyerPage() {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploads, setUploads] = useState<{ file: File; url: string }[]>([]);
  const [prefill, setPrefill] = useState<LibraryItem["data"] | null>(null);
  const [visibleCount, setVisibleCount] = useState(8); // 2 sor (4 oszlop) alapból
  const [infoItem, setInfoItem] = useState<LibraryItem | null>(null); // összefoglaló ablak

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
    setSelectedImages((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length + uploads.length >= MAX_FLYER_IMAGES) return prev; // max elérve
      return [...prev, url];
    });
  }

  function onUpload(files: FileList | null) {
    if (!files) return;
    setUploads((prev) => {
      const remaining = MAX_FLYER_IMAGES - prev.length - selectedImages.length;
      if (remaining <= 0) return prev;
      const next = Array.from(files)
        .slice(0, remaining)
        .map((file) => ({ file, url: URL.createObjectURL(file) }));
      return [...prev, ...next];
    });
  }

  function removeUpload(idx: number) {
    setUploads((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = selectedImages.length + uploads.length;

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
                    onClick={() => setInfoItem(i)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors"
                    style={{
                      border: `1px solid ${active ? "var(--twx-coral)" : "var(--twx-line)"}`,
                      background: active ? "var(--twx-coral-soft)" : "var(--twx-cream-card)",
                      color: "var(--twx-ink)",
                    }}
                  >
                    {active && <span style={{ color: "var(--twx-coral)" }}>✓</span>}
                    {i.title}
                    <span style={{ color: "var(--twx-ink-muted)" }}>ⓘ</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Kép-választó: könyvtár mindig látszik + saját feltöltés felugró ablakban */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Képek kiválasztása</p>
            <span className="text-xs" style={{ color: total >= MAX_FLYER_IMAGES ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>
              {total}/{MAX_FLYER_IMAGES} kép (egyoldalas hirdetés)
            </span>
          </div>

          <button
            onClick={() => setUploadOpen(true)}
            disabled={total >= MAX_FLYER_IMAGES}
            className="mb-3 rounded-full px-4 py-2 text-sm font-medium transition-opacity"
            style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", color: "var(--twx-ink)", opacity: total >= MAX_FLYER_IMAGES ? 0.5 : 1 }}
          >
            + Saját kép feltöltése
          </button>

          {/* Feltöltött képek (a fő nézetben is látszanak) */}
          {uploads.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {uploads.map((u, idx) => (
                <div key={idx} className="relative overflow-hidden rounded-xl" style={{ border: "2px solid var(--twx-coral)" }}>
                  <img src={u.url} alt="" className="aspect-[4/3] w-full object-cover" />
                  <button
                    onClick={() => removeUpload(idx)}
                    aria-label="Törlés"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-sm"
                    style={{ background: "rgba(12,11,10,0.7)", color: "#fff" }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {libraryImages.length === 0 ? (
            <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Nincs korábbi képed. Tölts fel sajátot a „Saját kép feltöltése" gombbal.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {libraryImages.slice(0, visibleCount).map((url) => {
                  const active = selectedImages.includes(url);
                  const blocked = !active && total >= MAX_FLYER_IMAGES;
                  return (
                    <button
                      key={url}
                      onClick={() => toggleImage(url)}
                      disabled={blocked}
                      className="relative overflow-hidden rounded-xl transition-opacity"
                      style={{ border: `2px solid ${active ? "var(--twx-coral)" : "var(--twx-line)"}`, opacity: blocked ? 0.4 : 1, cursor: blocked ? "not-allowed" : "pointer" }}
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
      </section>

      {/* Összegzés + következő lépés (F3/F4) */}
      <section className="twx-card space-y-1 p-4 text-sm">
        <p>
          <span style={{ color: "var(--twx-ink-muted)" }}>Arculat:</span>{" "}
          {profiles.find((p) => p.id === profileId)?.label ?? "—"}
        </p>
        <p>
          <span style={{ color: "var(--twx-ink-muted)" }}>Kiválasztott kép:</span> {total} db
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

      {/* Saját kép feltöltése — felugró ablak (a könyvtár mögötte marad) */}
      {uploadOpen && (
        <div
          onClick={() => setUploadOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(12,11,10,0.82)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", color: "var(--twx-ink)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold">Saját kép feltöltése</h3>
              <button
                onClick={() => setUploadOpen(false)}
                aria-label="Bezárás"
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}
              >
                ×
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <label
                htmlFor="flyer-upload"
                className="inline-block rounded-full px-4 py-2 text-sm font-medium"
                style={{
                  border: "1px solid var(--twx-line)",
                  background: "var(--twx-cream)",
                  color: "var(--twx-ink)",
                  cursor: total >= MAX_FLYER_IMAGES ? "not-allowed" : "pointer",
                  opacity: total >= MAX_FLYER_IMAGES ? 0.5 : 1,
                }}
              >
                Tallózás…
              </label>
              <span className="text-xs" style={{ color: total >= MAX_FLYER_IMAGES ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>
                {total}/{MAX_FLYER_IMAGES} kép
              </span>
            </div>
            <input
              id="flyer-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={total >= MAX_FLYER_IMAGES}
              className="hidden"
              onChange={(e) => onUpload(e.target.files)}
            />

            {uploads.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {uploads.map((u, idx) => (
                  <div key={idx} className="relative overflow-hidden rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
                    <img src={u.url} alt="" className="aspect-[4/3] w-full object-cover" />
                    <button
                      onClick={() => removeUpload(idx)}
                      aria-label="Törlés"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-sm"
                      style={{ background: "rgba(12,11,10,0.7)", color: "#fff" }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setUploadOpen(false)} className="twx-btn mt-5">
              Kész
            </button>
          </div>
        </div>
      )}

      {/* Összefoglaló ablak egy korábbi munka adatairól */}
      {infoItem && (
        <div
          onClick={() => setInfoItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(12,11,10,0.82)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl p-6"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", color: "var(--twx-ink)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-semibold">{infoItem.title}</h3>
                <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {infoItem.typeLabel} · {new Date(infoItem.createdAt).toLocaleDateString("hu-HU")}
                </p>
              </div>
              <button
                onClick={() => setInfoItem(null)}
                aria-label="Bezárás"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
                style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}
              >
                ×
              </button>
            </div>

            {infoItem.details.length > 0 ? (
              <dl className="mt-4 space-y-1.5">
                {infoItem.details.map((d) => (
                  <div key={d.label} className="flex gap-3 text-sm">
                    <dt className="min-w-[130px] shrink-0" style={{ color: "var(--twx-ink-muted)" }}>{d.label}</dt>
                    <dd className="flex-1">{d.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Ehhez a munkához nincs részletes adat.
              </p>
            )}

            {infoItem.pdfUrl && (
              <a href={infoItem.pdfUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm underline" style={{ color: "var(--twx-coral)" }}>
                Eredeti PDF megnyitása
              </a>
            )}

            <div className="mt-5 flex gap-3">
              {infoItem.data && (
                <button
                  onClick={() => {
                    setPrefill(prefill === infoItem.data ? null : infoItem.data);
                    setInfoItem(null);
                  }}
                  className="twx-btn"
                >
                  {prefill === infoItem.data ? "Betöltés visszavonása" : "Adatok betöltése"}
                </button>
              )}
              <button
                onClick={() => setInfoItem(null)}
                className="rounded-full px-5 py-2.5 text-sm font-medium"
                style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream)", color: "var(--twx-ink)" }}
              >
                Bezárás
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
