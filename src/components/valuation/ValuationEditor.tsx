// ValuationEditor — a kész értékbecslés EGYOLDALAS lapja élő előnézettel.
//
// A partner CSAK ezt az egy lapot látja és adja tovább az ügyfélnek: nincs
// részletes riport-nézet és nincs arculat-váltás sem, mert az arculatot és a
// fotókat már az INDÍTÓ ablakban kiválasztotta (ValuationStartModal).
// A műveletek a lap MELLETT, külön oszlopban ülnek és görgetés közben a helyükön
// maradnak — így soha nem takarnak ki semmit a dokumentumból.
//
// 2026-10-18 — SZERKESZTÉS + KÖTELEZŐ ELFOGADÁS:
//   • módosítható: javasolt ár és értéksáv (az nm-ár magától számolódik), cím, alcím, indoklás pontjai;
//     a módosítások KÜLÖN tárolódnak (az eredeti TWINX-becslés érintetlen marad — belső napló);
//   • a szerkesztő KÜLÖN ABLAKBAN nyílik („Szerkesztés" gomb); „Elfogadom a módosításokat" → az ablak bezárul, és a lapon
//     már a módosított változat látszik; az „Elfogadom és véglegesítem" és a „Szerkesztés" gomb a helyén marad;
//   • „Elfogadom és véglegesítem" → ekkor készül el és mentődik a PDF; a Letöltés CSAK utána aktív,
//     és újabb módosításnál visszazárul, amíg újra el nem fogadja;
//   • nincs háttérmentés: piszkozatból nem keletkezik letölthető PDF.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OnePagerPaper, { ONEPAGER_W } from "@/components/valuation/OnePagerPaper";
import { singlePageToPdfBlob, blobToBase64 } from "@/lib/report-pdf-client";
import {
  applyOverrides, buildOnePager, sanitizeOverrides, tidyTitle, OVERRIDE_LIMITS,
  type OnePagerAudit, type OnePagerOverrides,
} from "@/lib/valuation-onepager";
import type { BrandingProfile } from "@/lib/branding";
import type { ValuationInput } from "@/lib/valuation";
import { serializeReportDoc, type ReportDoc } from "@/lib/valuation-report";

/** Megvárja a következő kirajzolást (a rejtett PDF-példány mountolása után). */
function nextPaint(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

function fileBase(title: string): string {
  return (tidyTitle(title) || "ertekbecsles")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "ertekbecsles";
}

const fmt = (n: number) => (n ? Math.round(n).toLocaleString("hu-HU") : "");
const parseNum = (s: string) => Number(String(s).replace(/[^\d]/g, "")) || 0;
const sameOverrides = (a: OnePagerOverrides, b: OnePagerOverrides) =>
  JSON.stringify(sanitizeOverrides(a)) === JSON.stringify(sanitizeOverrides(b));

export default function ValuationEditor({
  historyId,
  initialDoc,
  dateLabel,
  initialUrl,
  initialOverrides = null,
  initialAcceptedAt = null,
  facts,
  audit = null,
  onSaved,
  onClose,
}: {
  historyId: string | null;
  initialDoc: ReportDoc;
  dateLabel: string;
  initialUrl?: string | null;
  /** A korábban elfogadott partneri módosítások (ár, sáv, cím, alcím, indoklás). */
  initialOverrides?: OnePagerOverrides | null;
  /** Mikor fogadták el (null = piszkozat). A régi, PDF-fel rendelkező becslés elfogadottnak számít. */
  initialAcceptedAt?: string | null;
  /** Az űrlap adatai + a becsléskor választott arculat és fotók. */
  facts?: Partial<ValuationInput>;
  /** A motor levezetése — ebből épülnek a lap indoklásai. */
  audit?: OnePagerAudit;
  onSaved?: (url: string, overrides: OnePagerOverrides) => void;
  /** Az eredmény-ablak bezárása (az oldalsó oszlopból is elérhető). */
  onClose?: () => void;
}) {
  const doc = initialDoc;
  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  // Amíg az arculat be nem töltött, NEM készítünk PDF-et: különben a lap
  // a TWINX alapstílussal égne bele a dokumentumba.
  const [brandingReady, setBrandingReady] = useState(false);
  const [pdfMode, setPdfMode] = useState(false);
  const paperForPdfRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<null | "accept" | "download">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  // --- módosítások: a legutóbb ELFOGADOTT állapot és a szerkesztés alatti piszkozat ---
  const [saved, setSaved] = useState<OnePagerOverrides>(() => sanitizeOverrides(initialOverrides));
  const [draft, setDraft] = useState<OnePagerOverrides>(() => sanitizeOverrides(initialOverrides));
  const [accepted, setAccepted] = useState<boolean>(!!initialAcceptedAt || !!initialUrl);
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [rangeTouched, setRangeTouched] = useState(false); // kézzel átírt sáv: az ár módosítása már nem mozgatja
  const dirty = !sameOverrides(draft, saved);
  const canDownload = accepted && !dirty && (!!url || !historyId); // azonosító nélkül (mentés nélkül) a helyben elkészült PDF tölthető le

  const previewWrapRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [paperHeight, setPaperHeight] = useState(0);

  // Az arculat-profilok betöltése: a becsléskor VÁLASZTOTT profilt keressük ki
  // belőlük. Itt már nem lehet váltani — a lap úgy néz ki, ahogy indításkor kérte.
  useEffect(() => {
    let alive = true;
    fetch("/api/branding")
      .then((r) => (r.ok ? r.json() : { profiles: [] }))
      .then((d) => { if (alive) { setProfiles(d.profiles ?? []); setBrandingReady(true); } })
      .catch(() => { if (alive) setBrandingReady(true); });
    return () => { alive = false; };
  }, []);

  const profile = profiles.find((p) => p.id === facts?.brandingProfileId) ?? null;
  const pagePhotos = useMemo(() => (facts?.pagePhotos ?? []).slice(0, 2), [facts?.pagePhotos]);
  /** Az eredeti TWINX-lap (módosítás nélkül) — ehhez képest szerkesztünk, és ide lehet visszaállni. */
  const base = useMemo(() => buildOnePager(doc, facts ?? {}, dateLabel, audit), [doc, facts, dateLabel, audit]);
  const onePager = useMemo(() => applyOverrides(base, draft, facts ?? {}), [base, draft, facts]);

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
      // A betűtípus a hálózatról jön (Google Fonts) — várjuk meg, különben fallback-fonttal égne bele a PDF-be.
      if (document.fonts?.ready) await document.fonts.ready;
      const node = paperForPdfRef.current?.querySelector("[data-onepager]") as HTMLElement | null;
      if (!node) throw new Error("A lap nem renderelhető.");
      return await singlePageToPdfBlob(node, { title: onePagerTitle.current || "Értékbecslés" });
    } finally {
      setPdfMode(false);
    }
  }, []);
  const onePagerTitle = useRef(onePager.title);
  onePagerTitle.current = onePager.title;
  const lastPdf = useRef<Blob | null>(null);

  /** Elfogadás: elkészül a végleges PDF, a szerver elmenti a módosításokkal és az elfogadás idejével. */
  async function onAccept() {
    setError(null);
    setBusy("accept");
    try {
      const clean = sanitizeOverrides(draft);
      const blob = await buildPdf();
      if (historyId) {
        const res = await fetch("/api/real-estate/valuation/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: historyId,
            text: serializeReportDoc(doc),
            overrides: clean,
            accept: true,
            pdfBase64: await blobToBase64(blob),
          }),
        });
        const data = await res.json().catch(() => ({}) as { url?: string; error?: string });
        if (!res.ok || !data.url) throw new Error(data.error || "Az elfogadás mentése nem sikerült. Próbáld újra.");
        setUrl(data.url);
        onSaved?.(data.url, clean);
      }
      lastPdf.current = blob;
      setSaved(clean);
      setDraft(clean);
      setAccepted(true);
    } catch (e) {
      setError((e as Error).message || "Az elfogadás nem sikerült.");
    } finally {
      setBusy(null);
    }
  }

  async function onDownload() {
    if (!canDownload) return;
    setError(null);
    setBusy("download");
    try {
      const blob = lastPdf.current ?? (await buildPdf());
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${fileBase(onePager.title)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 4000);
    } catch (e) {
      setError((e as Error).message || "A PDF készítése nem sikerült.");
    } finally {
      setBusy(null);
    }
  }

  function requestClose() {
    if (dirty) { setConfirmClose(true); return; }
    onClose?.();
  }

  // --- SZERKESZTŐ ABLAK: saját munkapéldánnyal dolgozik; „Elfogadom a módosításokat" → a lapra kerül, „Mégse" → elvész ---
  const [edit, setEdit] = useState<OnePagerOverrides | null>(null); // null = az ablak zárva
  const ed = edit ?? draft;
  const set = (patch: Partial<OnePagerOverrides>) => setEdit((d) => ({ ...(d ?? draft), ...patch }));
  const priceNow = ed.priceHuf ?? base.priceNum;
  const lowNow = ed.lowHuf ?? base.rangeLow;
  const highNow = ed.highHuf ?? base.rangeHigh;
  const reasonsNow = ed.reasons ?? base.reasons;
  const outOfRange = !!(priceNow && lowNow && highNow && (priceNow < lowNow || priceNow > highNow));
  const badRange = !!(lowNow && highNow && highNow <= lowNow);
  const sizeM2 = Number(String(facts?.meret ?? "").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  const ppmNow = priceNow && sizeM2 ? `${Math.round(priceNow / sizeM2).toLocaleString("hu-HU")} Ft/m²` : "";

  function openEditor() { setEdit({ ...draft }); setError(null); }
  function cancelEditor() { setEdit(null); }
  function applyEditor() {
    if (!edit) return;
    setDraft(edit);
    setEdit(null);
    lastPdf.current = null;
  }
  useEffect(() => {
    if (!edit) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setEdit(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edit]);

  function onPrice(v: string) {
    const p = parseNum(v);
    if (!p) { set({ priceHuf: undefined }); return; }
    // A sáv arányosan együtt mozog az árral — amíg a partner kézzel nem írta át.
    if (!rangeTouched && base.priceNum && base.rangeLow && base.rangeHigh) {
      const k = p / base.priceNum;
      const round = (n: number) => Math.round(n / 100_000) * 100_000;
      set({ priceHuf: p, lowHuf: round(base.rangeLow * k), highHuf: round(base.rangeHigh * k) });
    } else set({ priceHuf: p });
  }
  function onRange(which: "lowHuf" | "highHuf", v: string) {
    setRangeTouched(true);
    const n = parseNum(v) || undefined;
    set(which === "lowHuf" ? { lowHuf: n, highHuf: ed.highHuf ?? base.rangeHigh } : { highHuf: n, lowHuf: ed.lowHuf ?? base.rangeLow });
  }
  function setReason(i: number, v: string) {
    const r = [...reasonsNow];
    r[i] = v.slice(0, OVERRIDE_LIMITS.reasonMax);
    set({ reasons: r });
  }
  function removeReason(i: number) {
    if (reasonsNow.length <= OVERRIDE_LIMITS.reasonsMin) return;
    set({ reasons: reasonsNow.filter((_, k) => k !== i) });
  }
  function addReason() {
    if (reasonsNow.length >= OVERRIDE_LIMITS.reasonsMax) return;
    set({ reasons: [...reasonsNow, ""] });
  }
  function resetEditor() {
    setEdit({});
    setRangeTouched(false);
  }

  const hasEdits = Object.keys(sanitizeOverrides(draft)).length > 0;
  const statusLabel = canDownload ? "Elfogadva" : dirty && accepted ? "Módosítva" : "Piszkozat";

  // vékony, letisztult mezők a szerkesztő ablakban
  const fieldLabel = "mb-1 block text-[11px] font-medium";
  const field = "h-9 w-full rounded-lg border px-3 text-sm outline-none transition focus:border-[var(--twx-coral)] focus:ring-2 focus:ring-[rgba(239,122,90,0.18)]";
  const fieldStyle = { borderColor: "var(--twx-line)", background: "#fff", color: "var(--twx-ink)" } as const;
  const sectionTitle = "text-[10.5px] font-semibold uppercase tracking-[0.14em]";

  return (
    <div className="flex flex-col items-start gap-4 md:flex-row">
      {/* BAL: élő előnézet — pontosan az, ami a PDF-be kerül */}
      <div
        ref={previewWrapRef}
        className="order-2 w-full min-w-0 flex-1 overflow-hidden rounded-2xl md:order-1"
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

      {/* JOBB: keskeny művelet-oszlop — asztalon a helyén marad görgetéskor, mobilon a lap fölött */}
      <aside className="order-1 w-full shrink-0 md:sticky md:top-3 md:z-[25] md:order-2 md:w-60">
        <div className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid var(--twx-line)", boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Értékbecslés</p>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={canDownload
                ? { background: "rgba(47,158,95,0.14)", color: "#2f7a4f" }
                : { background: "rgba(239,122,90,0.14)", color: "#a8411f" }}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
            {canDownload
              ? "Elfogadtad — letöltheted. Ha módosítasz, újra el kell fogadnod."
              : "Nézd át a lapot. Ha kell, szerkeszd, majd fogadd el — utána tölthető le."}
          </p>

          {!canDownload && (
            <button type="button" className="twx-btn mt-3 w-full" disabled={busy !== null || !brandingReady}
              title="A becslést átnéztem, a lapon szereplő adatokért felelősséget vállalok."
              onClick={() => void onAccept()}>
              {busy === "accept" ? "Véglegesítés…" : !brandingReady ? "Betöltés…" : "Elfogadom és véglegesítem"}
            </button>
          )}
          <button type="button" className="twx-btn-outline mt-2 w-full" disabled={busy !== null} onClick={openEditor}>
            ✎ Szerkesztés{hasEdits ? " · módosítva" : ""}
          </button>
          <button
            type="button"
            className={canDownload ? "twx-btn mt-2 w-full" : "twx-btn-outline mt-2 w-full disabled:cursor-not-allowed disabled:opacity-40"}
            disabled={!canDownload || busy !== null}
            title={!canDownload ? "Előbb fogadd el a becslést" : undefined}
            onClick={() => void onDownload()}
          >
            {busy === "download" ? "PDF készül…" : "Letöltés (PDF)"}
          </button>
          {!canDownload && (
            <p className="mt-2 text-[10.5px] leading-snug" style={{ color: "var(--twx-ink-muted)" }}>
              Az elfogadással igazolod: a becslést átnézted, a lapon szereplő adatokért felelősséget vállalsz.
            </p>
          )}

          {onClose && !confirmClose && (
            <button type="button" className="mt-3 w-full text-xs underline-offset-2 hover:underline" style={{ color: "var(--twx-ink-muted)" }} onClick={requestClose}>
              Bezárás
            </button>
          )}
          {confirmClose && (
            <div className="mt-2 rounded-lg p-2.5 text-[11px]" style={{ background: "#fff8ec", border: "1px solid #f0d9a8" }}>
              A módosításaid még nincsenek elfogadva. Bezárod nélkülük?
              <div className="mt-2 flex gap-2">
                <button type="button" className="twx-btn-outline flex-1 py-1 text-xs" onClick={() => setConfirmClose(false)}>Maradok</button>
                <button type="button" className="flex-1 rounded-lg py-1 text-xs font-semibold text-white" style={{ background: "#b9432f" }} onClick={() => onClose?.()}>Elvetem</button>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg px-2.5 py-1.5 text-[11px] text-red-700" style={{ background: "#fdecea", border: "1px solid #f0b8ab" }}>
              {error}
            </p>
          )}
        </div>
      </aside>

      {/* ===== SZERKESZTŐ ABLAK — csak a „Szerkesztés" gombra nyílik ===== */}
      {edit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" style={{ background: "rgba(12,11,10,0.55)", backdropFilter: "blur(3px)" }}
          onClick={cancelEditor} role="dialog" aria-modal="true" aria-label="Értékbecslés szerkesztése">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 30px 80px rgba(0,0,0,0.35)" }}
            onClick={(e) => e.stopPropagation()}>
            {/* fejléc */}
            <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--twx-line)" }}>
              <div>
                <p className="font-display text-lg font-semibold">Értékbecslés szerkesztése</p>
                <p className="text-[12px]" style={{ color: "var(--twx-ink-muted)" }}>A módosítások a lapon jelennek meg; az eredeti TWINX-becslés megmarad.</p>
              </div>
              <button type="button" onClick={cancelEditor} aria-label="Bezárás"
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-base" style={{ background: "var(--twx-line)" }}>×</button>
            </div>

            {/* tartalom — a blokkon belül görget */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <section>
                <p className={sectionTitle} style={{ color: "var(--twx-coral)" }}>Fejléc</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={fieldLabel}>Cím</span>
                    <input className={field} style={fieldStyle} maxLength={OVERRIDE_LIMITS.titleMax}
                      value={ed.title ?? base.title} onChange={(e) => set({ title: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className={fieldLabel}>Alcím</span>
                    <input className={field} style={fieldStyle} maxLength={OVERRIDE_LIMITS.subtitleMax}
                      value={ed.subtitle ?? base.subtitle} onChange={(e) => set({ subtitle: e.target.value })} />
                  </label>
                </div>
              </section>

              <section>
                <div className="flex items-baseline justify-between">
                  <p className={sectionTitle} style={{ color: "var(--twx-coral)" }}>Ár</p>
                  {ppmNow && <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>Négyzetméterár: <b style={{ color: "var(--twx-ink)" }}>{ppmNow}</b></span>}
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className={fieldLabel}>Javasolt ár</span>
                    <div className="relative">
                      <input className={`${field} pr-9 font-semibold`} style={fieldStyle} inputMode="numeric" value={fmt(priceNow)} onChange={(e) => onPrice(e.target.value)} />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Ft</span>
                    </div>
                  </label>
                  <label className="block">
                    <span className={fieldLabel}>Óvatos ár</span>
                    <div className="relative">
                      <input className={`${field} pr-9`} style={fieldStyle} inputMode="numeric" value={fmt(lowNow)} onChange={(e) => onRange("lowHuf", e.target.value)} />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Ft</span>
                    </div>
                  </label>
                  <label className="block">
                    <span className={fieldLabel}>Optimista ár</span>
                    <div className="relative">
                      <input className={`${field} pr-9`} style={fieldStyle} inputMode="numeric" value={fmt(highNow)} onChange={(e) => onRange("highHuf", e.target.value)} />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Ft</span>
                    </div>
                  </label>
                </div>
                <p className="mt-1.5 text-[11px]" style={{ color: badRange ? "#b42318" : outOfRange ? "#8a5a00" : "var(--twx-ink-muted)" }}>
                  {badRange
                    ? "Az optimista ár legyen nagyobb az óvatosnál."
                    : outOfRange
                      ? "A javasolt ár a sávon kívül esik — érdemes a sávot is igazítani."
                      : rangeTouched ? "A sávot kézzel állítottad." : "Az ár módosításakor a sáv arányosan követi."}
                </p>
              </section>

              <section>
                <div className="flex items-baseline justify-between">
                  <p className={sectionTitle} style={{ color: "var(--twx-coral)" }}>Miért ennyi? — indoklás</p>
                  <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{reasonsNow.length}/{OVERRIDE_LIMITS.reasonsMax} pont</span>
                </div>
                <ol className="mt-2 space-y-1.5">
                  {reasonsNow.map((r, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "var(--twx-coral)" }}>{i + 1}</span>
                      <input className={`${field} min-w-0 flex-1`} style={fieldStyle} maxLength={OVERRIDE_LIMITS.reasonMax} value={r}
                        placeholder="Egy rövid mondat" onChange={(e) => setReason(i, e.target.value)} />
                      <button type="button" onClick={() => removeReason(i)} disabled={reasonsNow.length <= OVERRIDE_LIMITS.reasonsMin}
                        className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-base disabled:cursor-not-allowed disabled:opacity-30"
                        style={{ color: "var(--twx-ink-muted)" }} aria-label="Pont törlése" title="Pont törlése">×</button>
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={addReason} disabled={reasonsNow.length >= OVERRIDE_LIMITS.reasonsMax}
                  className="mt-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40" style={{ color: "var(--twx-coral)" }}
                  title={reasonsNow.length >= OVERRIDE_LIMITS.reasonsMax ? `Legfeljebb ${OVERRIDE_LIMITS.reasonsMax} pont` : undefined}>
                  + Új pont
                </button>
              </section>
            </div>

            {/* lábléc — mindig látszik */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
              <button type="button" onClick={resetEditor} className="text-xs underline-offset-2 hover:underline" style={{ color: "var(--twx-ink-muted)" }}
                title="Az eredeti TWINX-becslés értékei">
                Visszaállítás az eredetire
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={cancelEditor} className="twx-btn-outline px-4 py-2 text-sm">Mégse</button>
                <button type="button" onClick={applyEditor} disabled={badRange} className="twx-btn px-4 py-2 text-sm disabled:opacity-40"
                  title={badRange ? "Előbb javítsd a sávot" : undefined}>
                  Elfogadom a módosításokat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
