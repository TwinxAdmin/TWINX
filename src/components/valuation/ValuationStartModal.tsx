// ValuationStartModal — az értékbecslés INDÍTÁSA előtti ablak.
//
// Itt választja ki a partner, hogy az egyoldalas lap melyik arculattal készüljön
// (arculat nélkül a TWINX alapstílus megy ki), és opcionálisan legfeljebb két
// fotót ad hozzá, ami a lap ALJÁN jelenik meg. A választás a becsléssel együtt
// mentődik, így az előzményekből újranyitva is ugyanaz a lap jön elő.
"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandingProfile } from "@/lib/branding";
import { compressImage } from "@/lib/image-compress";
import SelectField from "@/components/SelectField";

/** Egy jelölt kép: már feltöltött fájl (előnézettel) vagy rendszerbeli URL. */
export type PagePhotoPick = { key: string; preview: string; file?: File; url?: string };

export default function ValuationStartModal({
  open,
  candidates,
  busy,
  onCancel,
  onStart,
}: {
  open: boolean;
  /** Az űrlapon már megadott fotók — ezek közül egy kattintással választható. */
  candidates: PagePhotoPick[];
  busy: boolean;
  onCancel: () => void;
  onStart: (choice: { profileId: string; photos: PagePhotoPick[] }) => void;
}) {
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [picked, setPicked] = useState<PagePhotoPick[]>([]);
  const [extra, setExtra] = useState<PagePhotoPick[]>([]); // itt hozzáadott új fájlok

  // Arculatok: csak a sajátjai jönnek. Ha van, az első az alapértelmezett.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch("/api/branding")
      .then((r) => (r.ok ? r.json() : { profiles: [] }))
      .then((d) => {
        if (!alive) return;
        const list: BrandingProfile[] = d.profiles ?? [];
        setProfiles(list);
        setProfileId((cur) => cur || list[0]?.id || "");
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  // Nyitáskor EGYSZER: az első (max 2) már feltöltött fotó legyen kiválasztva.
  // Fontos, hogy csak a NYITÁS pillanatában fusson — különben minden újrarajzolás
  // visszaállítaná a kijelölést, és a modalban hozzáadott képek kiesnének.
  const wasOpen = useRef(false);
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;
  useEffect(() => {
    if (open && !wasOpen.current) {
      setPicked(candidatesRef.current.slice(0, 2));
      setExtra([]);
    }
    wasOpen.current = open;
  }, [open]);

  // Az előnézeti URL-eket CSAK a komponens megszűnésekor engedjük el (korábban
  // minden új kép hozzáadásakor lefutott, és elrontotta a már felvett bélyegképeket).
  const extraRef = useRef(extra);
  extraRef.current = extra;
  useEffect(() => () => extraRef.current.forEach((e) => URL.revokeObjectURL(e.preview)), []);

  if (!open) return null;

  const all = [...candidates, ...extra];
  const isPicked = (k: string) => picked.some((p) => p.key === k);
  function toggle(p: PagePhotoPick) {
    setPicked((cur) => {
      if (cur.some((x) => x.key === p.key)) return cur.filter((x) => x.key !== p.key);
      if (cur.length >= 2) return [cur[1], p]; // a legrégebbi választás kiesik
      return [...cur, p];
    });
  }
  // A telefonról jövő fotó könnyen 8 MB fölött van — a szerver az ekkorát
  // eldobná, ezért feltöltés előtt itt is tömörítünk (mint az űrlapon).
  async function addFiles(files: FileList | null) {
    if (!files) return;
    const picks = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 2);
    if (!picks.length) return;
    const next: PagePhotoPick[] = [];
    for (const raw of picks) {
      const f = await compressImage(raw, 1600, 0.82);
      next.push({ key: `new-${f.name}-${f.size}-${Date.now()}-${next.length}`, preview: URL.createObjectURL(f), file: f });
    }
    setExtra((cur) => [...cur, ...next]);
    setPicked((cur) => [...cur, ...next].slice(-2));
  }

  // A választott arculat előnézete: szín + logó, hogy látszódjon, mi megy ki.
  const active = profiles.find((p) => p.id === profileId) ?? null;
  const accent = active && /^#[0-9a-fA-F]{6}$/.test(active.accent_color) ? active.accent_color : "#ef7a5a";

  /** Egységes blokk-keret a két választóhoz. */
  const block: React.CSSProperties = {
    background: "var(--twx-cream-card)",
    border: "1px solid var(--twx-line)",
    borderRadius: 16,
    padding: 16,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4" style={{ background: "rgba(20,16,12,0.6)" }}>
      <div
        className="w-full max-w-lg rounded-3xl p-6"
        style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vsm-title"
      >
        <h2 id="vsm-title" className="text-xl font-semibold">Megjelenés az egyoldalas lapon</h2>
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
          Ezzel az arculattal és ezekkel a fotókkal készül az ügyfélnek adható lap.
          A becslés indítása után már nem módosítható.
        </p>

        {/* ---------- ARCULAT ---------- */}
        <div className="mt-5" style={block}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Arculat</p>
            <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>1. lépés</span>
          </div>

          {profiles.length > 0 ? (
            <>
              <div className="mt-2.5">
                <SelectField
                  value={profileId}
                  onChange={setProfileId}
                  ariaLabel="Arculat"
                  options={[
                    ...profiles.map((p) => ({ value: p.id, label: p.label || p.display_name || "Arculat" })),
                    { value: "", label: "TWINX alapstílus (arculat nélkül)" },
                  ]}
                />
              </div>

              {/* Élő ízelítő: a lap fejlécének színe és a logó. */}
              <div
                className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "#fff", border: "1px solid var(--twx-line)" }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                  style={{ background: accent }}
                >
                  {active?.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={active.logo_url} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[9px] font-bold text-white">TWX</span>
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">
                    {active?.display_name || "TWINX alapstílus"}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                    {active?.title || active?.company || "A lap a TWINX alapszíneivel készül"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
              Még nincs arculatod — a lap a <strong>TWINX alapstílussal</strong> készül.{" "}
              <a href="/dashboard/branding" className="font-semibold underline">Arculat beállítása</a>
            </p>
          )}
        </div>

        {/* ---------- FOTÓK ---------- */}
        <div className="mt-3" style={block}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              Fotók a lapon{" "}
              <span className="font-normal" style={{ color: "var(--twx-ink-muted)" }}>(opcionális)</span>
            </p>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: picked.length ? "var(--twx-coral-soft)" : "#fff", border: "1px solid var(--twx-line)" }}
            >
              {picked.length} / 2
            </span>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2.5">
            {all.map((p) => {
              const on = isPicked(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => toggle(p)}
                  aria-pressed={on}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl transition-all"
                  style={{
                    outline: on ? `2.5px solid ${accent}` : "1px solid var(--twx-line)",
                    outlineOffset: on ? 1 : 0,
                    boxShadow: on ? "0 4px 14px rgba(0,0,0,0.16)" : "none",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.preview}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    style={{ opacity: on ? 1 : 0.72 }}
                  />
                  {on && (
                    <span
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: accent, boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
                    >
                      {picked.findIndex((x) => x.key === p.key) + 1}
                    </span>
                  )}
                </button>
              );
            })}

            <label
              className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl transition-colors hover:bg-white"
              style={{ border: "1.5px dashed var(--twx-line)", color: "var(--twx-ink-muted)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-[10px] font-semibold">Feltöltés</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }}
              />
            </label>
          </div>

          <p className="mt-2.5 text-[11px] leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
            {picked.length === 0
              ? "Kép nélkül a lap az adatokkal tölti ki a helyet."
              : `A kiválasztott ${picked.length === 1 ? "kép" : "két kép"} a lap aljára kerül, a sorszám szerinti sorrendben.`}
          </p>
        </div>

        {/* ---------- MŰVELETEK ---------- */}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="twx-btn-outline" onClick={onCancel} disabled={busy}>Mégse</button>
          <button
            type="button"
            className="twx-btn"
            disabled={busy}
            onClick={() => onStart({ profileId, photos: picked })}
          >
            {busy ? "Indítás…" : "Értékbecslés indítása (1 kredit)"}
          </button>
        </div>
      </div>
    </div>
  );
}
