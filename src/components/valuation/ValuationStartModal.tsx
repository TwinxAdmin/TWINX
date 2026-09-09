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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,16,12,0.55)" }}>
      <div className="twx-card w-full max-w-lg p-5 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="vsm-title">
        <h2 id="vsm-title" className="text-lg font-semibold">Megjelenés az egyoldalas lapon</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Ezzel az arculattal és ezekkel a fotókkal készül az ügyfélnek adható lap. Később nem módosítható.
        </p>

        {/* Arculat */}
        <div className="mt-4">
          <label className="text-sm font-semibold" htmlFor="vsm-profile">Arculat</label>
          {profiles.length > 0 ? (
            <select
              id="vsm-profile"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="twx-input mt-1"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.label || p.display_name || "Arculat"}</option>
              ))}
              <option value="">TWINX alapstílus (arculat nélkül)</option>
            </select>
          ) : (
            <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Még nincs arculatod — a lap a <strong>TWINX alapstílussal</strong> készül.{" "}
              <a href="/dashboard/branding" className="underline">Arculat beállítása</a>
            </p>
          )}
        </div>

        {/* Fotók */}
        <div className="mt-4">
          <p className="text-sm font-semibold">Fotók a lapon <span className="font-normal" style={{ color: "var(--twx-ink-muted)" }}>(opcionális, max 2)</span></p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {all.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => toggle(p)}
                aria-pressed={isPicked(p.key)}
                className="relative h-16 w-20 overflow-hidden rounded-lg"
                style={{ border: `2px solid ${isPicked(p.key) ? "var(--twx-coral)" : "var(--twx-line)"}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="h-full w-full object-cover" />
                {isPicked(p.key) && (
                  <span className="absolute left-1 top-1 rounded-full px-1.5 text-[10px] font-bold" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>
                    {picked.findIndex((x) => x.key === p.key) + 1}
                  </span>
                )}
              </button>
            ))}
            <label
              className="flex h-16 w-20 cursor-pointer items-center justify-center rounded-lg text-xs font-semibold"
              style={{ border: "1px dashed var(--twx-line)", color: "var(--twx-ink-muted)" }}
            >
              + Kép
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
            </label>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
            {picked.length === 0 ? "Kép nélkül a lap az adatokkal tölti ki a helyet." : `${picked.length} kép kerül a lap aljára.`}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
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
