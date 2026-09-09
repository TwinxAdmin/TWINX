// ValuationEditor — a kész értékbecslés EGYOLDALAS lapja élő előnézettel.
//
// A partner CSAK ezt az egy lapot látja és adja tovább az ügyfélnek: nincs
// részletes riport-nézet és nincs arculat-váltás sem, mert az arculatot és a
// fotókat már az INDÍTÓ ablakban kiválasztotta (ValuationStartModal).
// A letöltő gomb a görgetés közben is a helyén marad (sticky), így nem kell
// visszagörgetni a lap tetejére.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OnePagerPaper, { ONEPAGER_W } from "@/components/valuation/OnePagerPaper";
import { singlePageToPdfBlob, blobToBase64 } from "@/lib/report-pdf-client";
import { buildOnePager, type OnePagerAudit } from "@/lib/valuation-onepager";
import type { BrandingProfile } from "@/lib/branding";
import type { ValuationInput } from "@/lib/valuation";
import { serializeReportDoc, type ReportDoc } from "@/lib/valuation-report";

/** Megvárja a következő kirajzolást (a rejtett PDF-példány mountolása után). */
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

/** Fájlnév a becslés címéből. */
function fileBase(title: string): string {
  return (
    String(title || "ertekbecsles")
      .replace(/[^\w\-áéíóöőúüűÁÉÍÓÖŐÚÜŰ ]+/g, "")
      .trim() || "ertekbecsles"
  );
}

export default function ValuationEditor({
  historyId,
  initialDoc,
  dateLabel,
  initialUrl,
  facts,
  audit = null,
  onSaved,
}: {
  historyId: string | null;
  initialDoc: ReportDoc;
  dateLabel: string;
  initialUrl?: string | null;
  /** Az űrlap adatai + a becsléskor választott arculat és fotók. */
  facts?: Partial<ValuationInput>;
  /** A motor levezetése — ebből épülnek a lap indoklásai. */
  audit?: OnePagerAudit;
  onSaved?: (url: string) => void;
}) {
  const [doc, setDoc] = useState<ReportDoc>(initialDoc);
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [pdfMode, setPdfMode] = useState(false);
  const paperForPdfRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewWrapRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [paperHeight, setPaperHeight] = useState(0);

  const docRef = useRef(doc);
  docRef.current = doc;

  useEffect(() => setDoc(initialDoc), [initialDoc]);

  // Az arculat-profilok betöltése: a becsléskor VÁLASZTOTT profilt keressük ki
  // belőlük. Itt már nem lehet váltani — a lap úgy néz ki, ahogy indításkor kérte.
  useEffect(() => {
    let alive = true;
    fetch("/api/branding")
      .then((r) => (r.ok ? r.json() : { profiles: [] }))
      .then((d) => { if (alive) setProfiles(d.profiles ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const profile = profiles.find((p) => p.id === facts?.brandingProfileId) ?? null;
  const pagePhotos = useMemo(() => (facts?.pagePhotos ?? []).slice(0, 2), [facts?.pagePhotos]);
  const onePager = useMemo(
    () => buildOnePager(doc, facts ?? {}, dateLabel, audit),
    [doc, facts, dateLabel, audit]
  );

  // A lap A4 szélességű; a nézetben arányosan kicsinyítjük a rendelkezésre álló helyre.
  useEffect(() => {
    const wrap = previewWrapRef.current;
    const paper = paperRef.current;
    if (!wrap || !paper) return;
    const ro = new ResizeObserver(() => {
      setScale(Math.min(1, wrap.clientWidth / ONEPAGER_W));
      setPaperHeight(paper.offsetHeight);
    });
    ro.observe(wrap);
    ro.observe(paper);
    return () => ro.disconnect();
  }, []);

  /** A lap PDF-fé alakítása — a rejtett, teljes méretű példányból. */
  const buildPdf = useCallback(async (): Promise<Blob> => {
    setPdfMode(true);
    try {
      await nextPaint();
      // A betűtípus a hálózatról jön (Google Fonts) — várjuk meg, különben
      // fallback-fonttal égne bele a PDF-be.
      if (document.fonts?.ready) await document.fonts.ready;
      const node = paperForPdfRef.current?.querySelector("[data-onepager]") as HTMLElement | null;
      if (!node) throw new Error("A lap nem renderelhető.");
      return await singlePageToPdfBlob(node);
    } finally {
      setPdfMode(false);
    }
  }, []);

  async function onDownload() {
    setError(null);
    setBusy(true);
    try {
      const blob = await buildPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase(doc.title)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setError((e as Error).message || "A PDF készítése nem sikerült.");
    } finally {
      setBusy(false);
    }
  }

  /** Háttérmentés: a kész lap PDF-je az előzményekbe kerül (a partner nem várja meg). */
  const save = useCallback(async () => {
    if (!historyId) return;
    try {
      const blob = await buildPdf();
      const res = await fetch("/api/real-estate/valuation/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: historyId,
          text: serializeReportDoc(docRef.current),
          pdfBase64: await blobToBase64(blob),
        }),
      });
      const data = await res.json().catch(() => ({}) as { url?: string });
      if (res.ok && data.url) onSaved?.(data.url);
    } catch {
      // A háttérmentés hibája ne zavarja a partnert — a letöltés így is működik.
    }
  }, [historyId, buildPdf, onSaved]);

  // Frissen készült becslésnél egyszer, a háttérben elmentjük a lapot, hogy az
  // előzményekben azonnal legyen letölthető dokumentum.
  const autoSaved = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (autoSaved.current || !historyId || initialUrl) return;
    const t = setTimeout(() => {
      if (autoSaved.current) return;
      autoSaved.current = true;
      saveRef.current();
    }, 800);
    return () => clearTimeout(t);
  }, [historyId, initialUrl]);

  return (
    <div className="space-y-3">
      {/* Letöltés — görgetés közben is a helyén marad. */}
      <div
        className="flex flex-wrap items-center gap-3"
        // A modális fejléc alatt ragad meg, így görgetéskor is elérhető marad.
        style={{ position: "sticky", top: 56, zIndex: 25 }}
      >
        <button
          type="button"
          className="twx-btn"
          disabled={busy}
          onClick={onDownload}
          style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.18)" }}
        >
          {busy ? "PDF készül…" : "Értékbecslés letöltése"}
        </button>
        {error && (
          <span
            className="rounded-lg px-2.5 py-1 text-xs text-red-700"
            style={{ background: "#fdecea", border: "1px solid #f0b8ab" }}
          >
            {error}
          </span>
        )}
      </div>

      {/* Élő előnézet — pontosan az, ami a PDF-be kerül */}
      <div
        ref={previewWrapRef}
        className="overflow-hidden rounded-2xl"
        style={{ border: "1px solid var(--twx-line)", background: "#e9e4db", padding: 12 }}
      >
        <div style={{ height: paperHeight * scale, position: "relative" }}>
          <div
            ref={paperRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: ONEPAGER_W,
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            <OnePagerPaper data={onePager} profile={profile} photos={pagePhotos} />
          </div>
        </div>
      </div>

      {/* Rejtett, teljes méretű példány a PDF-hez — csak a renderelés idejére */}
      {pdfMode && (
        <div
          ref={paperForPdfRef}
          aria-hidden
          style={{ position: "fixed", left: -20000, top: 0, zIndex: -1, background: "#fff" }}
        >
          <OnePagerPaper data={onePager} profile={profile} photos={pagePhotos} />
        </div>
      )}
    </div>
  );
}
