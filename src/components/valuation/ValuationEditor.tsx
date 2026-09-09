// ValuationEditor — szerkeszthető értékbecslés élő előnézettel.
// A partner szakaszonként átírja a riportot, majd egy gombbal PDF-et készít.
// A PDF a böngészőben renderelődik UGYANEBBŐL a dizájnból (lásd report-pdf-client).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReportPaper, { PAPER_WIDTH } from "@/components/valuation/ReportPaper";
import OnePagerPaper, { ONEPAGER_W } from "@/components/valuation/OnePagerPaper";
import { paperToPdfBlob, singlePageToPdfBlob, blobToBase64 } from "@/lib/report-pdf-client";
import { buildOnePager, type OnePagerAudit } from "@/lib/valuation-onepager";
import type { BrandingProfile } from "@/lib/branding";
import type { ValuationInput } from "@/lib/valuation";
import {
  addSection,
  moveSection,
  removeSection,
  serializeReportDoc,
  updateSection,
  type ReportDoc,
  type ReportSection,
} from "@/lib/valuation-report";

// A Vercel API-kérés törzse 4,5 MB, a base64 ~1,37× nagyobb a nyers PDF-nél.
const UPLOAD_LIMIT = 2.9 * 1024 * 1024;

/** Megvárja a következő kirajzolást (a rejtett PDF-példány mountolása után). */
function nextPaint(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

export default function ValuationEditor({
  historyId,
  initialDoc,
  dateLabel,
  initialUrl,
  facts,
  audit = null,
  staff = false,
  onSaved,
  onDirtyChange,
}: {
  historyId: string | null;
  initialDoc: ReportDoc;
  dateLabel: string;
  initialUrl?: string | null;
  /** Az űrlap adatai — az egyoldalas laphoz kellenek az ingatlan-jellemzők. */
  facts?: Partial<ValuationInput>;
  /** A motor levezetése — ebből épülnek az egyoldalas lap indoklásai. */
  audit?: OnePagerAudit;
  /** Admin/sales: a részletes (belső) riport nézet is elérhető. Partnernek csak az egyoldalas lap. */
  staff?: boolean;
  onSaved?: (url: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [doc, setDoc] = useState<ReportDoc>(initialDoc);
  // Nézet: az ügyfélnek adható egyoldalas lap (alap); a részletes riport csak
  // a munkatársaknak (admin/sales) belső ellenőrzésre.
  const [view, setView] = useState<"full" | "one">("one");
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  // Az arculat az indító ablakban választott profil; "" = TWINX alapstílus.
  const [profileId, setProfileId] = useState<string>(facts?.brandingProfileId ?? "");
  const [onePagerMode, setOnePagerMode] = useState(false);
  const onePagerRef = useRef<HTMLDivElement>(null);
  // A lap fotói (max 2) — az indító ablakban megadva, a lap alján jelennek meg.
  const pagePhotos = useMemo(() => (facts?.pagePhotos ?? []).slice(0, 2), [facts?.pagePhotos]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "pdf" | "save">(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialUrl ?? null);
  const [dirty, setDirty] = useState(false);
  const [pdfMode, setPdfMode] = useState(false);

  // A mentés mindig a LEGFRISSEBB dokumentumot küldi (az auto-mentés időzítője
  // különben a mount-kori állapotot zárná be).
  const docRef = useRef(doc);
  docRef.current = doc;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const pdfRef = useRef<HTMLDivElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [paperHeight, setPaperHeight] = useState(0);

  useEffect(() => setDoc(initialDoc), [initialDoc]);

  // Arculat-profilok betöltése: az egyoldalas lap ezekkel kap logót, színt,
  // betűtípust és elérhetőséget. Hiba esetén marad a TWINX alapstílus.
  useEffect(() => {
    let alive = true;
    fetch("/api/branding")
      .then((r) => (r.ok ? r.json() : { profiles: [] }))
      .then((d) => {
        if (!alive) return;
        const list: BrandingProfile[] = d.profiles ?? [];
        setProfiles(list);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const profile = profiles.find((p) => p.id === profileId) ?? null;
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
      setScale(Math.min(1, wrap.clientWidth / PAPER_WIDTH));
      setPaperHeight(paper.offsetHeight);
    });
    ro.observe(wrap);
    ro.observe(paper);
    return () => ro.disconnect();
  }, []);

  const patch = useCallback((id: string, p: Partial<Omit<ReportSection, "id">>) => {
    setDirty(true);
    setDoc((prev) => {
      if (id === "__intro") return { ...prev, intro: p.body ?? prev.intro };
      if (id === "__headline") return { ...prev, headlinePrice: p.body ?? prev.headlinePrice };
      return updateSection(prev, id, p);
    });
  }, []);

  const tools = useMemo(
    () => ({
      onChange: patch,
      onMove: (id: string, dir: -1 | 1) => {
        setDirty(true);
        setDoc((prev) => moveSection(prev, id, dir));
      },
      onRemove: (id: string) => {
        setDirty(true);
        setEditingId((cur) => (cur === id ? null : cur));
        setDoc((prev) => removeSection(prev, id));
      },
      onAdd: (afterId: string) => {
        setDirty(true);
        setDoc((prev) => addSection(prev, afterId));
      },
      editingId,
      setEditingId,
    }),
    [editingId, patch]
  );

  async function buildPdf(forUpload = false): Promise<Blob> {
    // A tiszta (gombok nélküli) példányt csak a renderelés idejére tesszük ki a
    // DOM-ba, különben minden billentyűleütésnél kétszer rajzolódna a riport.
    setPdfMode(true);
    try {
      await nextPaint();
      const node = pdfRef.current?.firstElementChild as HTMLElement | null;
      if (!node) throw new Error("A riport nem renderelhető.");

      const blob = await paperToPdfBlob(node);
      if (!forUpload || blob.size <= UPLOAD_LIMIT) return blob;

      // Túl nagy a feltöltéshez: kisebb felbontással újra.
      const smaller = await paperToPdfBlob(node, { scale: 1.4, quality: 0.78 });
      if (smaller.size > UPLOAD_LIMIT) {
        throw new Error(
          "A dokumentum túl nagy a mentéshez. Rövidíts a szakaszokon, vagy tölts le PDF-et közvetlenül."
        );
      }
      return smaller;
    } finally {
      setPdfMode(false);
    }
  }

  async function onDownload() {
    setError(null);
    setBusy("pdf");
    try {
      const blob = await buildPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(doc.title || "ertekbecsles").replace(/[^\w\-áéíóöőúüűÁÉÍÓÖŐÚÜŰ ]+/g, "").trim() || "ertekbecsles"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setError((e as Error).message || "A PDF készítése nem sikerült.");
    } finally {
      setBusy(null);
    }
  }

  /** Az EGYOLDALAS, arculatos lap letöltése — ezt kapja kézhez az ügyfél. */
  async function onDownloadOnePager() {
    setError(null);
    setBusy("pdf");
    setOnePagerMode(true);
    try {
      await nextPaint();
      // A betűtípus a hálózatról jön (Google Fonts) — várjuk meg, különben
      // fallback-fonttal égne bele a PDF-be.
      if (document.fonts?.ready) await document.fonts.ready;
      const node = onePagerRef.current?.querySelector("[data-onepager]") as HTMLElement | null;
      if (!node) throw new Error("A lap nem renderelhető.");
      const blob = await singlePageToPdfBlob(node);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const base = (doc.title || "ertekbecsles").replace(/[^\w\-áéíóöőúüűÁÉÍÓÖŐÚÜŰ ]+/g, "").trim();
      a.href = url;
      a.download = `${base || "ertekbecsles"}-egyoldalas.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setError((e as Error).message || "A PDF készítése nem sikerült.");
    } finally {
      setOnePagerMode(false);
      setBusy(null);
    }
  }

  async function onSave() {
    if (!historyId) {
      setError("Ehhez a becsléshez nem tartozik előzmény-azonosító.");
      return;
    }
    setError(null);
    setBusy("save");
    try {
      const blob = await buildPdf(true);
      const res = await fetch("/api/real-estate/valuation/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: historyId,
          text: serializeReportDoc(docRef.current),
          pdfBase64: await blobToBase64(blob),
        }),
      });
      // Platform-szintű hibánál (pl. 413) a válasz nem JSON — ne dobjon nyers hibát.
      const data = await res.json().catch(() => ({}) as { url?: string; error?: string });
      if (!res.ok) throw new Error(data.error ?? `A mentés nem sikerült (${res.status}).`);
      setPdfUrl(data.url ?? null);
      setSavedAt(new Date().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" }));
      setDirty(false);
      if (data.url) onSaved?.(data.url);
    } catch (e) {
      setError((e as Error).message || "A mentés nem sikerült.");
    } finally {
      setBusy(null);
    }
  }

  // Frissen készült becslésnél egyszer, a háttérben elkészítjük és elmentjük a
  // PDF-et, hogy az előzményekben azonnal legyen letölthető dokumentum. A partner
  // ezután bármikor átírhatja és újramentheti.
  const autoSaved = useRef(false);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useEffect(() => {
    if (autoSaved.current || !historyId || initialUrl) return;
    const t = setTimeout(() => {
      // A jelzőt CSAK a tényleges induláskor állítjuk (a React dev-módban
      // kétszer futtatja az effektet; az elsőt a cleanup leállítja).
      if (autoSaved.current) return;
      autoSaved.current = true;
      saveRef.current();
    }, 800);
    return () => clearTimeout(t);
  }, [historyId, initialUrl]);

  return (
    <div className="space-y-3">
      {/* Eszköztár */}
      <div
        className="twx-card flex flex-wrap items-center gap-2 p-3"
        style={{ position: "sticky", top: 8, zIndex: 20 }}
      >
        {/* Nézetváltó CSAK munkatársnak: részletes riport (belső) vagy egyoldalas lap. */}
        {staff && <div className="flex overflow-hidden rounded-lg" style={{ border: "1px solid var(--twx-line)" }}>
          {(["one", "full"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={view === v
                ? { background: "var(--twx-coral)", color: "#1c1005" }
                : { background: "#fff", color: "var(--twx-ink-muted)" }}>
              {v === "full" ? "Részletes riport" : "Egyoldalas lap"}
            </button>
          ))}
        </div>}

        {view === "one" ? (
          <>
            {profiles.length > 0 && (
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                aria-label="Arculat"
                className="rounded-lg px-3 py-1.5 text-xs"
                style={{ border: "1px solid var(--twx-line)", background: "#fff" }}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.label || p.display_name || "Arculat"}</option>
                ))}
                <option value="">TWINX alapstílus</option>
              </select>
            )}
            <button type="button" className="twx-btn" disabled={busy !== null} onClick={onDownloadOnePager}>
              {busy === "pdf" ? "PDF készül…" : "Egyoldalas PDF letöltése"}
            </button>
            {profiles.length === 0 && (
              <a className="twx-btn-outline" href="/dashboard/branding">Arculat beállítása</a>
            )}

          </>
        ) : (
          <>
            <button type="button" className="twx-btn" disabled={busy !== null} onClick={onSave}>
              {busy === "save" ? "Mentés…" : "Mentés + PDF frissítése"}
            </button>
            <button
              type="button"
              className="twx-btn-outline"
              disabled={busy !== null}
              onClick={onDownload}
            >
              {busy === "pdf" ? "PDF készül…" : "PDF letöltése"}
            </button>
            {pdfUrl && (
              <a className="twx-btn-outline" href={pdfUrl} target="_blank" rel="noreferrer">
                Mentett PDF megnyitása
              </a>
            )}
          </>
        )}
        <span className="ml-auto text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          {error ? (
            <span className="text-red-600">{error}</span>
          ) : savedAt ? (
            `Mentve ${savedAt}`
          ) : dirty ? (
            "Nem mentett módosítások"
          ) : view === "one" ? (
            "Ezt a lapot kapja az ügyfél — a PDF pontosan így készül"
          ) : (
            "A szakaszok a „Szerkeszt” gombbal írhatók át"
          )}
        </span>
      </div>

      {/* Élő előnézet — pontosan az, ami a PDF-be kerül */}
      <div
        ref={previewWrapRef}
        className="overflow-hidden rounded-2xl"
        style={{
          border: "1px solid var(--twx-line)",
          background: "#e9e4db",
          padding: 12,
        }}
      >
        <div style={{ height: paperHeight * scale, position: "relative" }}>
          <div
            ref={paperRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: view === "one" ? ONEPAGER_W : PAPER_WIDTH,
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            {view === "one" ? (
              <OnePagerPaper data={onePager} profile={profile} photos={pagePhotos} />
            ) : (
              <ReportPaper doc={doc} dateLabel={dateLabel} tools={tools} />
            )}
          </div>
        </div>
      </div>

      {/* Rejtett, tiszta változat a PDF-hez — csak a renderelés idejére */}
      {pdfMode && (
        <div
          ref={pdfRef}
          aria-hidden
          style={{ position: "fixed", left: -20000, top: 0, zIndex: -1, background: "#fff" }}
        >
          <ReportPaper doc={doc} dateLabel={dateLabel} forPdf />
        </div>
      )}

      {/* Ugyanez az egyoldalas laphoz (teljes méretben, nem kicsinyítve) */}
      {onePagerMode && (
        <div
          ref={onePagerRef}
          aria-hidden
          style={{ position: "fixed", left: -20000, top: 0, zIndex: -1, background: "#fff" }}
        >
          <OnePagerPaper data={onePager} profile={profile} photos={pagePhotos} />
        </div>
      )}
    </div>
  );
}
