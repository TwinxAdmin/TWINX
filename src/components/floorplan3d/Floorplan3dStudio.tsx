// Floorplan3dStudio — „Alaprajzból bejárható 3D lakás", 1. lépés (PROTOTÍPUS, csak admin):
//   Feltöltés (kép / PDF / kézi rajz fotója + stílus) → digitalizálás (Gemini) → javítás → méret-ellenőrzés.
// A lakásleírás (FloorPlan) az egyetlen igazságforrás; minden javítás azon történik (lib/floorplan3d/geometry).
// Mentés: a digitalizálás után a projekt az adatbázisba kerül (?p=<id> a címben); minden javítás 0,8 mp után automatikusan
// mentődik (PATCH). Újratöltéskor a ?p= alapján visszatölt. Ha a migráció még nem futott, a felület mentés nélkül is működik.
// „3D bejárás indítása": csak ha minden helyiség rendben / tudatosan jóváhagyva → megerősítés (kredit, lezárás) → a szerver újraellenőriz,
// von és lezár (approve). Jóváhagyott tervnél a javítófelület helyén a 3D-modell (ApartmentViewer) + méretpontosság.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import SelectField from "@/components/SelectField";
import PlanEditor from "@/components/floorplan3d/editor/PlanEditor";
import type { Underlay } from "@/components/floorplan3d/editor/Plan2D";
import ApartmentViewer, { useApartmentMeasure, type ViewerApi } from "@/components/floorplan3d/ApartmentViewer";
import WalkthroughViewer from "@/components/floorplan3d/WalkthroughViewer";
import ShareCard from "@/components/floorplan3d/ShareCard";
import ModuleTour from "@/components/floorplan3d/intro/ModuleTour";
import { roomViewpoint } from "@/lib/floorplan3d/camera";
import type { SceneOptions } from "@/lib/floorplan3d/scene";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";
import { apartmentFurniture, livingRoomLayout, type FurnitureItem } from "@/lib/floorplan3d/furniture";
import { type FloorPlan, type Room } from "@/lib/floorplan3d/plan";
import { checkPlan } from "@/lib/floorplan3d/geometry";
import type { NormalizeStats } from "@/lib/floorplan3d/normalize";
import { MUTED, fmt } from "@/components/floorplan3d/editor/parts";

type Source = "digital" | "hand";
type Stats = NormalizeStats & { model: string; seconds: number; tokensIn: number; tokensOut: number; costUsd: number };

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const TOUR_SEEN_KEY = "twx-fp3d-tour-seen"; // a bemutatót első belépéskor mutatjuk (böngészőnként); utána a „Hogyan működik?" gombbal



/** autoTour: első belépéskor magától induljon-e a bemutató (az adminnál nem — a 3D-labornak nem kell; a gombbal ott is megnézhető). */
export default function Floorplan3dStudio({ tolerancePct, maxUploadMb, creditsCreate, creditsGeometryFix, sceneOptions, openingCornerMin, styleSheet, styleError, linkDays, creditsExtend, autoTour }: {
  tolerancePct: number; maxUploadMb: number; creditsCreate: number; creditsGeometryFix: number; sceneOptions: SceneOptions; openingCornerMin: number;
  linkDays: number; creditsExtend: number;
  styleSheet: StyleSheet | null; styleError: string | null; autoTour: boolean;
}) {
  // bemutató (oktató animáció): első belépéskor, de nem folyamatban lévő munka (?p=) megnyitásakor
  const [tour, setTour] = useState(false);
  useEffect(() => {
    if (!autoTour || new URLSearchParams(window.location.search).get("p")) return;
    let seen = true;
    try { seen = !!window.localStorage.getItem(TOUR_SEEN_KEY); } catch { /* tiltott tárhely: nem erőltetjük */ }
    if (!seen) setTour(true);
  }, [autoTour]);
  const closeTour = useCallback(() => {
    setTour(false);
    try { window.localStorage.setItem(TOUR_SEEN_KEY, "1"); } catch { /* nem baj */ }
  }, []);
  // utólagos javítás: már volt jóváhagyva (approved_at) → a díj a geometriai javításé, csak az érintett helyiségek épülnek újra
  const [wasApproved, setWasApproved] = useState(false);
  const [rebuilt, setRebuilt] = useState<string[] | null>(null);
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);
  // 3. lépés: helyiségenkénti berendezés (az építő eredménye, a projektből betöltve / frissen kérve)
  const [furnishing, setFurnishing] = useState<Record<string, Furnishing>>({});
  const [roomImages, setRoomImages] = useState<Record<string, RoomImages>>({});
  const [status, setStatus] = useState<string>("draft");
  const [confirming, setConfirming] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>("digital");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<FloorPlan | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [handAccepted, setHandAccepted] = useState(false);
  const [sourceMime, setSourceMime] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [save, setSave] = useState<{ state: "idle" | "saving" | "saved" | "error"; msg?: string }>({ state: "idle" });
  const [loadingProject, setLoadingProject] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipSave = useRef(true); // betöltés / digitalizálás utáni első állapotot nem mentjük vissza

  useEffect(() => () => { if (fileUrl?.startsWith("blob:")) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  // ?p=<id> → korábbi alaprajz visszatöltése
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("p");
    if (!id) return;
    setLoadingProject(true);
    fetch(`/api/real-estate/floorplan-3d/projects/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        skipSave.current = true;
        setProjectId(d.project.id); setPlan(d.project.plan); setStats(d.project.digitize_stats);
        setSource(d.project.source_kind); setHandAccepted(!!d.project.hand_accepted);
        setSourceMime(d.project.source_mime); setFileUrl(d.sourceUrl); setSave({ state: "saved" }); setStatus(d.project.status ?? "draft");
        setWasApproved(!!d.project.approved_at); setRebuilt(Array.isArray(d.project.rebuild_rooms) ? d.project.rebuild_rooms : null);
        setFurnishing((d.project.furnishing as Record<string, Furnishing> | null) ?? {});
        // a képek aláírt linkjei + a célkép geometria-ellenőrzésének eredménye (a mentett rekordból)
        const imgs: Record<string, RoomImages> = { ...((d.images as Record<string, RoomImages> | undefined) ?? {}) };
        for (const [rid, f] of Object.entries((d.project.furnishing ?? {}) as Record<string, { target?: { fidelity?: RoomImages["fidelity"]; attempts?: unknown[] } }>)) {
          if (f?.target?.fidelity) imgs[rid] = { ...imgs[rid], fidelity: f.target.fidelity, attempts: f.target.attempts?.length };
        }
        setRoomImages(imgs);
      })
      .catch(() => setError("Nem sikerült betölteni az alaprajzot."))
      .finally(() => setLoadingProject(false));
  }, []);

  // automatikus mentés (0,8 mp-cel az utolsó változás után) — jóváhagyott terv nem változik
  useEffect(() => {
    if (!plan || !projectId || status !== "draft") return;
    if (skipSave.current) { skipSave.current = false; return; }
    setSave({ state: "saving" });
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/real-estate/floorplan-3d/projects/${projectId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, handAccepted }),
        });
        const d = await res.json().catch(() => ({}));
        setSave(res.ok ? { state: "saved" } : { state: "error", msg: d.error ?? "Nem sikerült menteni." });
      } catch {
        setSave({ state: "error", msg: "Hálózati hiba — a mentés nem sikerült." });
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, [plan, handAccepted, projectId, status]);

  // utólagos javítás: a kész 3D-ből vissza a 2D javítófelületre (a terv újra szerkeszthető; itt nincs kreditlevonás)
  async function reopen() {
    if (!projectId) return;
    setReopening(true); setReopenError(null);
    try {
      const res = await fetch(`/api/real-estate/floorplan-3d/projects/${projectId}/revise`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setReopenError(d.error ?? "Nem sikerült visszanyitni a javításhoz."); return; }
      skipSave.current = true;
      setStatus("draft"); setConfirming(false); setApproveError(null);
    } catch {
      setReopenError("Hálózati hiba. Próbáld újra.");
    } finally {
      setReopening(false);
    }
  }

  // jóváhagyás: előbb a legfrissebb terv mentése (a késleltetett automatikus mentés ne maradjon le), utána approve
  async function approve() {
    if (!plan || !projectId) return;
    setApproving(true); setApproveError(null);
    try {
      const saved = await fetch(`/api/real-estate/floorplan-3d/projects/${projectId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, handAccepted }),
      });
      if (!saved.ok) { const d = await saved.json().catch(() => ({})); setApproveError(d.error ?? "A terv mentése nem sikerült."); return; }
      const res = await fetch(`/api/real-estate/floorplan-3d/projects/${projectId}/approve`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setApproveError(d.error ?? "A jóváhagyás nem sikerült."); return; }
      skipSave.current = true;
      setStatus("approved"); setConfirming(false);
      setWasApproved(true); setRebuilt(Array.isArray(d.rebuildRooms) ? d.rebuildRooms : null);
    } catch {
      setApproveError("Hálózati hiba. Próbáld újra.");
    } finally {
      setApproving(false);
    }
  }

  const check = useMemo(() => (plan ? checkPlan(plan, tolerancePct) : null), [plan, tolerancePct]);
  const underlay: Underlay = stats && fileUrl && sourceMime !== "application/pdf"
    ? { url: fileUrl, metersPerPixel: stats.metersPerPixel, size: stats.imageSize, offset: stats.imageOffset } : null;
  const ready = !!check?.canBuild && (source !== "hand" || handAccepted);

  function pick(f: File | null | undefined) {
    setError(null);
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) { setError("Csak JPG, PNG, WEBP kép vagy PDF tölthető fel."); return; }
    if (f.size > maxUploadMb * 1024 * 1024) { setError(`A fájl legfeljebb ${maxUploadMb} MB lehet.`); return; }
    if (fileUrl?.startsWith("blob:")) URL.revokeObjectURL(fileUrl);
    setFile(f);
    setSourceMime(f.type);
    setFileUrl(URL.createObjectURL(f));
  }

  async function digitize() {
    if (!file) { setError("Előbb válassz ki egy alaprajzot."); return; }
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("source", source);
      const res = await fetch("/api/real-estate/floorplan-3d/digitize", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.errors?.file ?? d.error ?? "A digitalizálás nem sikerült."); return; }
      skipSave.current = true;
      setPlan(d.plan); setStats(d.stats); setHandAccepted(false);
      setProjectId(d.projectId ?? null);
      setSave(d.projectId ? { state: "saved" } : { state: "error", msg: d.saveError ?? "A terv nincs mentve." });
      if (d.projectId) window.history.replaceState(null, "", `?p=${d.projectId}`);
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setPlan(null); setStats(null); setError(null);
    setProjectId(null); setSave({ state: "idle" }); setFile(null); setFileUrl(null); setSourceMime(null);
    setStatus("draft"); setWasApproved(false); setRebuilt(null); setFurnishing({}); setRoomImages({});
    window.history.replaceState(null, "", window.location.pathname);
  }

  // ======================================================================
  if (tour) {
    return (
      <div className="flex flex-col gap-5">
        <ModuleTour opts={sceneOptions} style={styleSheet} credits={creditsCreate} linkDays={linkDays} creditsExtend={creditsExtend} onStart={closeTour} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <ModuleIntro eyebrow="Prototípus · csak admin" title="Alaprajzból bejárható 3D lakás" icon="visualization"
        subtitle="Tölts fel egy alaprajzot — digitalizáljuk, te ellenőrzöd és javítod, majd méretpontos, bejárható 3D lakás készül belőle."
        chips={["Méretpontos", "2D + 3D szerkesztés", "Bejárás szemmagasságból", "Megosztható link"]} />

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1"><Steps current={!plan ? 1 : status === "draft" ? 2 : 3} /></div>
        <button type="button" onClick={() => setTour(true)} title="A bemutató újranézése (a munkád megmarad)"
          className="h-11 w-[150px] flex-none rounded-full text-[13px] font-semibold"
          style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>▶ Hogyan működik?</button>
      </div>

      {loadingProject ? (
        <div className="twx-card flex h-[300px] items-center justify-center text-sm" style={{ color: MUTED }}>Alaprajz betöltése…</div>
      ) : !plan ? (
        /* ---------------- 1. FELTÖLTÉS ---------------- */
        <div className="twx-card grid gap-5 p-6 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            <Seg value={source} onChange={(v) => setSource(v as Source)}
              items={[{ v: "digital", t: "Digitális alaprajz / PDF" },
                { v: "hand", t: "Kézi rajz fotója", soon: "Parkolóban — első körben a valós (digitális) alaprajzokra fókuszálunk" }]} />
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e: DragEvent) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
              className="flex h-[300px] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl text-center"
              style={{ border: "2px dashed var(--twx-line)", background: "#fff" }}>
              {fileUrl && file?.type !== "application/pdf" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl} alt="Feltöltött alaprajz" className="h-full w-full object-contain p-2" />
              ) : file ? (
                <p className="text-sm font-semibold">📄 {file.name}</p>
              ) : (
                <>
                  <p className="font-display text-lg font-semibold">Húzd ide az alaprajzot</p>
                  <p className="text-sm" style={{ color: MUTED }}>vagy kattints a tallózáshoz · JPG, PNG, WEBP, PDF · max. {maxUploadMb} MB</p>
                </>
              )}
            </div>
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            {error && <p className="rounded-xl px-4 py-2.5 text-sm text-red-700" style={{ background: "#FDECEA" }}>{error}</p>}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1.5 text-sm font-semibold">Stílus a teljes lakásra</p>
              <SelectField value="japandi" onChange={() => {}} disabled options={[{ value: "japandi", label: "Japandi" }]} ariaLabel="Stílus" />
              <p className="mt-1 text-xs" style={{ color: MUTED }}>A teszt időszakban csak a japandi stílus érhető el.</p>
            </div>
            <div className="h-[196px] overflow-y-auto rounded-xl p-3.5 text-[13px] leading-relaxed" style={{ background: "rgba(239,122,90,0.08)", border: "1px solid rgba(239,122,90,0.25)" }}>
              {source === "hand" ? (
                <>
                  <p className="font-semibold">Kézi rajz — így lesz pontos:</p>
                  <ul className="mt-1 list-disc pl-4">
                    <li>vonalzóval, kockás papíron, léptékkel (pl. 1 kocka = 50 cm);</li>
                    <li>minden helyiségben név és m²;</li>
                    <li>legalább egy kiírt falhossz (minél több, annál jobb);</li>
                    <li>felülről, egyenesen fotózva, árnyék nélkül.</li>
                  </ul>
                </>
              ) : (
                <>
                  <p className="font-semibold">Mitől lesz pontos a digitalizálás?</p>
                  <ul className="mt-1 list-disc pl-4">
                    <li>jól olvasható méretvonalak és helyiségenkénti m²;</li>
                    <li>egy lakás egy képen, egyenesen, levágás nélkül;</li>
                    <li>a vízjel nem zavar, de a túl kicsi kép igen.</li>
                  </ul>
                </>
              )}
            </div>
            <button type="button" className="twx-btn w-full" disabled={!file || busy} onClick={() => void digitize()}
              title={!file ? "Előbb válassz ki egy alaprajzot" : undefined}>
              {busy ? "Digitalizálás… (fél–másfél perc)" : "Digitalizálás"}
            </button>
          </div>
        </div>
      ) : status !== "draft" ? (
        /* ---------------- 3. 3D-ALAP (jóváhagyott terv) ---------------- */
        <ModelStage plan={plan} sceneOptions={sceneOptions} linkDays={linkDays} creditsExtend={creditsExtend} onRestart={restart} rebuilt={rebuilt} styleSheet={styleSheet} styleError={styleError}
          projectId={projectId} furnishing={furnishing} onFurnished={(roomId, f) => setFurnishing((cur) => ({ ...cur, [roomId]: { ...cur[roomId], ...f } }))}
          images={roomImages} onImages={(roomId, im) => setRoomImages((cur) => ({ ...cur, [roomId]: { ...cur[roomId], ...im } }))}
          fixPrice={creditsGeometryFix} reopening={reopening} reopenError={reopenError} onReopen={() => void reopen()} />
      ) : (
        /* ---------------- 2. JAVÍTÁS + ELLENŐRZÉS ---------------- */
        <>
          {wasApproved && (
            <p className="rounded-xl px-4 py-2.5 text-sm" style={{ background: "rgba(47,127,134,0.10)", border: "1px solid rgba(47,127,134,0.3)" }}>
              <b>Utólagos javítás.</b> Javítsd a digitalizálás hibáit (pl. ajtó, ablak, falhossz), majd hagyd jóvá újra — {creditsGeometryFix > 0 ? `${creditsGeometryFix} kredit` : "ingyenes"}.
              A 3D-ben csak az érintett helyiségek épülnek újra; a méret-ellenőrzés újra lefut.
            </p>
          )}
          {save.state === "error" && (
            <p className="rounded-xl px-4 py-2.5 text-sm" style={{ background: "#FDECEA", color: "#9B2C1B" }}>
              A terv nincs mentve: {save.msg} A javításokat így is elvégezheted, de újratöltéskor elvesznek.
            </p>
          )}
          <PlanEditor plan={plan} setPlan={(p) => setPlan(p)} tolerancePct={tolerancePct} cornerMin={openingCornerMin} sceneOptions={sceneOptions}
            underlay={underlay}
            headerRight={<>
              <SaveBadge save={save} />
              <button type="button" onClick={restart} className="h-8 rounded-full px-3 text-xs font-semibold" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>Új feltöltés</button>
            </>}
            footer={stats ? (
              <span className="hidden truncate lg:inline">
                Lépték: {stats.scaleSource === "dimensions" ? `${stats.dimensionCount} méretvonalból` : stats.scaleSource === "legend" ? "a táblázat m²-összegéből" : stats.scaleSource === "areas" ? "a kiírt m²-ekből" : "becsült"}
                {stats.scaleAgreementPct !== null ? ` · méretvonal ↔ m²: ${fmt(Math.abs(stats.scaleAgreementPct), 1)}%` : ""} · {stats.seconds.toLocaleString("hu-HU")} mp · ~{fmt(stats.costUsd, 3)} $
              </span>
            ) : null} />

          {/* ---------------- ellenőrző sáv ---------------- */}
          <div className="twx-card flex flex-col gap-3 p-5 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold">
                {check?.canBuild ? "Minden helyiség rendben ✓" : `${check?.rooms.filter((c) => c.status === "ok" || c.status === "approved").length ?? 0} / ${plan.rooms.length} helyiség rendben`}
              </p>
              <p className="mt-0.5 text-[13px]" style={{ color: MUTED }}>
                {check?.issues[0] ?? (check?.canBuild
                  ? "A 3D-építés (és a kreditlevonás) csak a jóváhagyott tervvel indul."
                  : `Helyiségenként add meg a valós m²-t; ±${fmt(tolerancePct, 0)}% fölött javíts, vagy hagyd jóvá tudatosan az eltérést.`)}
              </p>
              {source === "hand" && (
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-[13px]">
                  <input type="checkbox" checked={handAccepted} onChange={(e) => setHandAccepted(e.target.checked)} className="mt-0.5" style={{ accentColor: "var(--twx-coral)" }} />
                  <span>Tudomásul veszem, hogy a kézi rajz pontossága az én felelősségem.</span>
                </label>
              )}
            </div>
            <div className="flex w-full flex-col gap-1.5 lg:w-[300px]">
              {confirming ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirming(false)} disabled={approving} className="h-11 flex-none rounded-full px-4 text-sm font-semibold"
                    style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>Mégse</button>
                  <button type="button" onClick={() => void approve()} disabled={approving} className="twx-btn h-11 min-w-0 flex-1 px-3">
                    {approving ? "Jóváhagyás…" : `Jóváhagyom · ${(wasApproved ? creditsGeometryFix : creditsCreate) > 0 ? `${wasApproved ? creditsGeometryFix : creditsCreate} kredit` : "ingyenes"}`}
                  </button>
                </div>
              ) : (
                <button type="button" disabled={!ready || !projectId} onClick={() => setConfirming(true)} className="twx-btn h-11 w-full px-6 disabled:cursor-not-allowed"
                  title={!projectId ? "A terv nincs mentve — előbb futtasd le a mentés migrációját" : ready ? undefined : "Előbb minden helyiségnek rendben kell lennie (vagy tudatosan jóváhagyva)"}>
                  3D bejárás indítása
                </button>
              )}
              <p className="h-4 text-[11.5px] leading-4" style={{ color: approveError ? "#C2522D" : MUTED }}>
                {approveError ?? (confirming ? (wasApproved ? "Csak az érintett helyiségek épülnek újra." : "Jóváhagyás után a terv nem szerkeszthető.") : " ")}
              </p>
            </div>
          </div>

          {plan.notes && plan.notes.length > 0 && (
            <div className="rounded-2xl px-4 py-3 text-[13px]" style={{ background: "rgba(214,165,58,0.10)", border: "1px solid rgba(214,165,58,0.3)" }}>
              <p className="font-semibold">A digitalizálás megjegyzései</p>
              <ul className="mt-1 list-disc pl-4">{plan.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
/** 3D-alap: a jóváhagyott terv berendezetlen modellje + a KÉSZ modellen mért méretpontosság helyiségenként. */
/**
 * MINŐSÉGI CIKLUS (F3e): körönként fotó a berendezett helyiségről (a célkép nézőpontjából) → kritikus (geometria + stílus) → ha kell,
 * az építő javít → a néző újraépít → következő kör, legfeljebb a konfigurált körszámig. A végén: kész-e, mi nem valósult meg.
 */
function QualityCard({ plan, room, projectId, quality, targetUsable, canCapture, getApi, nextApi, onRound }: {
  plan: FloorPlan; room: Room | null; projectId: string | null; quality: Quality | null; targetUsable: boolean; canCapture: boolean;
  getApi: () => ViewerApi | null; nextApi: () => Promise<ViewerApi>;
  onRound: (roomId: string, q: Quality, items: FurnitureItem[] | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function run() {
    if (!room || !projectId) return;
    setBusy(true); setError(null);
    const view = roomViewpoint(plan, room);
    let rounds: QualityRound[] = [];
    try {
      for (let round = 1; round <= 10; round++) {
        setPhase(`${round}. kör: fotó…`);
        const api = getApi() ?? await nextApi();
        const image = await api.capture(view, { furniture: true });
        setPhase(`${round}. kör: a kritikus és az építő dolgozik… (1–2 perc)`);
        const waitRebuild = nextApi(); // az új bútorlista után a néző újraépül — erre várunk
        const res = await fetch(`/api/real-estate/floorplan-3d/projects/${projectId}/quality`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId: room.id, round, image }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { setError(d.error ?? "A minőségi kör nem sikerült."); return; }
        rounds = [...rounds, { round, score: d.critic.score, geometry: d.critic.geometry, biggest_issue: d.critic.biggestIssue,
          cost_usd: d.critic.costUsd, critic_seconds: d.critic.seconds, builder: null }];
        onRound(room.id, { rounds, final: d.final ?? null }, d.items ?? null);
        if (d.saveError) setError(`Nincs mentve: ${d.saveError}`);
        if (!d.next) return;
        if (d.items) { setPhase(`${round}. kör kész — újraépítés…`); await waitRebuild; }
      }
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally {
      setBusy(false); setPhase("");
    }
  }
  const rounds = quality?.rounds ?? [];
  return (
    <div className="twx-card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Minőségi ciklus{room ? ` — ${room.name}` : ""}</p>
          <p className="text-xs" style={{ color: MUTED }}>Körönként: a kritikus a berendezett 3D-t a célképhez és a stíluslaphoz méri (a geometriát a kód), az építő javít.</p>
        </div>
        <button type="button" onClick={() => void run()} disabled={busy || !room || !projectId || !canCapture || !targetUsable}
          title={!targetUsable ? "Előbb kell egy geometriailag hű célkép (fent)" : "Fizetős AI-hívások: körönként ~0,2 $ és 1–2 perc"}
          className="h-9 w-[230px] flex-none rounded-full text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "#12100e", color: "#fff" }}>
          {busy ? "Fut…" : rounds.length ? "Ciklus újraindítása" : "Minőségi ciklus indítása"}
        </button>
      </div>
      {(phase || error) && (
        <p className="rounded-lg px-3 py-1.5 text-[12px]" style={error ? { background: "#FDECEA", color: "#9B2C1B" } : { background: "rgba(47,127,134,0.10)", color: "#25666c" }}>{error ?? phase}</p>
      )}
      <div className="h-[220px] overflow-y-auto rounded-xl" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
        {rounds.length === 0 ? (
          <p className="flex h-full items-center justify-center px-6 text-center text-[12.5px]" style={{ color: MUTED }}>
            Még nem futott minőségi ciklus. Itt látszik majd körönként a pontszám (1–10), a geometria és a legnagyobb hiányosság.
          </p>
        ) : rounds.map((r) => (
          <div key={r.round} className="flex items-start gap-3 px-3 py-2 text-[12.5px]" style={{ borderBottom: "1px solid var(--twx-line)" }}>
            <span className="w-12 flex-none font-semibold">{r.round}. kör</span>
            <span className="w-14 flex-none font-bold" style={{ color: r.score >= 8 ? "#2f7a4f" : r.score >= 6 ? "#9A7020" : "#C2522D" }}>{r.score}/10</span>
            <span className="w-24 flex-none" style={{ color: r.geometry?.ok ? "#2f7a4f" : "#C2522D" }}>{r.geometry?.ok ? "geometria ✓" : "geometria ✗"}</span>
            <span className="min-w-0 flex-1" style={{ color: MUTED }}>{r.biggest_issue}</span>
          </div>
        ))}
      </div>
      {quality?.final && (
        <div className="rounded-xl px-3 py-2 text-[12.5px]" style={quality.final.done ? { background: "rgba(47,158,95,0.12)" } : { background: "rgba(224,165,38,0.14)" }}>
          <p className="font-semibold">{quality.final.done ? `Kész: a helyiség elérte a célkép szintjét (${quality.final.rounds} kör).` : `Lezárva ${quality.final.rounds} kör után — nem minden valósult meg:`}</p>
          {quality.final.unmet.length > 0 && <ul className="mt-1 list-disc pl-4">{quality.final.unmet.map((u, i) => <li key={i}>{u}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}

/** Egy helyiség képei (aláírt linkek): berendezetlen 3D-fotó és célkép. */
type RoomImages = { empty?: string; target?: string; fidelity?: { kept: number; added: number; ok: boolean }; attempts?: number };

/**
 * CÉLKÉP (F3d): a berendezetlen helyiség fotója szemmagasságból (a nézőből) → Nano Banana a stíluslap + referenciakép alapján.
 * Két fix méretű képhely üres állapottal; a gomb csak stíluslappal és mentett projekttel aktív.
 */
function TargetCard({ plan, room, projectId, images, canCapture, getApi, onImages }: {
  plan: FloorPlan; room: Room | null; projectId: string | null; images: RoomImages; canCapture: boolean;
  getApi: () => ViewerApi | null; onImages: (roomId: string, im: RoomImages) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  async function make() {
    const api = getApi();
    if (!room || !projectId || !api) return;
    setBusy(true); setError(null);
    try {
      const view = roomViewpoint(plan, room);
      const image = await api.capture(view, { furniture: false });
      onImages(room.id, { empty: image });
      const res = await fetch(`/api/real-estate/floorplan-3d/projects/${projectId}/target`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId: room.id, image, view }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "A célkép nem készült el."); return; }
      onImages(room.id, { ...(d.images ?? {}), fidelity: d.target?.fidelity, attempts: d.target?.attempts?.length });
      if (d.saveError) setError(`Nincs mentve: ${d.saveError}`);
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally {
      setBusy(false);
    }
  }
  const pane = (title: string, url: string | undefined, empty: string) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="text-[12px] font-semibold" style={{ color: MUTED }}>{title}</p>
      <div className="flex h-[300px] items-center justify-center overflow-hidden rounded-xl" style={{ background: "#F4F0EA", border: "1px solid var(--twx-line)" }}>
        {url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt={title} className="h-full w-full cursor-zoom-in object-cover" onClick={() => setZoom(url)} />
          : <p className="px-6 text-center text-[12.5px]" style={{ color: MUTED }}>{empty}</p>}
      </div>
    </div>
  );
  return (
    <div className="twx-card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Célkép{room ? ` — ${room.name}` : ""}</p>
          <p className="text-xs" style={{ color: MUTED }}>A berendezetlen, méretpontos helyiséget a Nano Banana a stíluslap szerint rendezi be — a falak, ablakok, ajtók és a nézőpont nem változnak.</p>
        </div>
        <button type="button" onClick={() => void make()} disabled={busy || !room || !projectId || !canCapture}
          title={!room ? "Nincs nappali" : !canCapture ? "Stíluslap nélkül nem készíthető" : "Fizetős képgenerálás (~0,04 $), kb. fél perc"}
          className="h-9 w-[200px] flex-none rounded-full text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "#12100e", color: "#fff" }}>
          {busy ? "Célkép készül… (15–45 mp)" : images.target ? "Új célkép" : "Célkép készítése"}
        </button>
      </div>
      {error && <p className="rounded-lg px-3 py-1.5 text-[12px]" style={{ background: "#FDECEA", color: "#9B2C1B" }}>{error}</p>}
      {images.fidelity && (
        <p className="rounded-lg px-3 py-1.5 text-[12px]"
          style={images.fidelity.ok ? { background: "rgba(47,158,95,0.12)", color: "#2f7a4f" } : { background: "rgba(224,165,38,0.16)", color: "#8A6416" }}>
          Geometria-ellenőrzés: a szerkezeti élek {Math.round(images.fidelity.kept * 100)}%-a maradt meg, {Math.round(images.fidelity.added * 100)}% új
          {images.attempts ? ` · ${images.attempts} próbálkozás` : ""} — {images.fidelity.ok
            ? "a célkép megtartotta a helyiség geometriáját."
            : "⚠ a célkép eltér a valós helyiségtől (falak / ablakok), ezért NEM használható mércének."}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        {pane("Berendezetlen (3D-fotó, szemmagasságból)", images.empty, "Itt jelenik meg a helyiség fotója a 3D-modellből, bútor nélkül.")}
        {pane("Célkép (japandi)", images.target, "Itt jelenik meg a berendezett célkép. A kritikus ehhez méri majd a 3D-berendezést.")}
      </div>
      {zoom && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ background: "rgba(18,16,14,0.8)" }} onClick={() => setZoom(null)} role="dialog" aria-label="Nagyított kép">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Nagyított kép" className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </div>
  );
}

/** Egy helyiség berendezése (az építő vagy a szabályalapú tartalék eredménye — builder.ts FurnishResult). */
type QualityRound = { round: number; score: number; geometry: { ok: boolean; maxErrorMm: number; problems: string[] }; biggest_issue: string; cost_usd: number; critic_seconds: number; builder?: { seconds: number } | null };
type Quality = { rounds: QualityRound[]; final: { done: boolean; rounds: number; unmet: string[] } | null; max_rounds?: number };
type Furnishing = {
  items: FurnitureItem[]; source: "builder" | "builder-repaired" | "rule" | "quality"; rationale: string; issues: string[];
  // az építő mérései — a minőségi ciklus eredményében nincsenek benne (ezért elhagyhatók)
  rounds?: number; seconds?: number; costUsd?: number; quality?: Quality;
};

function ModelStage({ plan, sceneOptions, linkDays, creditsExtend, onRestart, rebuilt, fixPrice, reopening, reopenError, onReopen, styleSheet, styleError, projectId, furnishing, onFurnished, images, onImages }: {
  plan: FloorPlan; sceneOptions: SceneOptions; linkDays: number; creditsExtend: number; onRestart: () => void; rebuilt: string[] | null; styleSheet: StyleSheet | null; styleError: string | null;
  projectId: string | null; furnishing: Record<string, Furnishing>; onFurnished: (roomId: string, f: Furnishing) => void;
  images: Record<string, RoomImages>; onImages: (roomId: string, im: RoomImages) => void;
  fixPrice: number; reopening: boolean; reopenError: string | null; onReopen: () => void;
}) {
  const measures = useApartmentMeasure(plan, sceneOptions);
  const apiRef = useRef<ViewerApi | null>(null);
  // a néző minden újraépítés (pl. új bútorlista) után új API-t ad — a minőségi ciklus erre vár, mielőtt újra fotózna
  const apiWaiters = useRef<((a: ViewerApi) => void)[]>([]);
  const setApi = useCallback((a: ViewerApi | null) => {
    apiRef.current = a;
    if (a) { const w = apiWaiters.current; apiWaiters.current = []; w.forEach((f) => f(a)); }
  }, []);
  const nextApi = useCallback(() => new Promise<ViewerApi>((res) => { apiWaiters.current.push(res); }), []);
  // F3b: a nappali alap-elrendezése (szabályalapú; az építő ebből indul — F3c)
  // a nappali berendezése: az építő mentett eredménye, ha van; különben a szabályalapú alap-elrendezés (F3b)
  const living = useMemo(() => {
    const room = plan.rooms.find((r) => r.kind === "nappali");
    if (!room) return null;
    const saved = furnishing[room.id];
    return saved?.items?.length ? { room, items: saved.items, skipped: saved.issues ?? [], saved } : { room, ...livingRoomLayout(plan, room), saved: null };
  }, [plan, furnishing]);
  // a teljes lakás berendezése (ugyanaz a függvény adja a megosztott linkét is)
  const allFurniture = useMemo(() => apartmentFurniture(plan, furnishing), [plan, furnishing]);
  const [walking, setWalking] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  async function furnish() {
    if (!projectId || !living) return;
    setBuilding(true); setBuildError(null);
    try {
      const res = await fetch(`/api/real-estate/floorplan-3d/projects/${projectId}/furnish`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId: living.room.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setBuildError(d.error ?? "A berendezés nem sikerült."); return; }
      onFurnished(living.room.id, d as Furnishing);
      if (d.saveError) setBuildError(`Nincs mentve: ${d.saveError}`);
    } catch {
      setBuildError("Hálózati hiba. Próbáld újra.");
    } finally {
      setBuilding(false);
    }
  }
  const SOURCE_TEXT: Record<Furnishing["source"], string> = { builder: "építő", "builder-repaired": "építő (javítókörrel)", rule: "szabályalapú tartalék", quality: "minőségi ciklus" };
  const worst = Math.max(0, ...measures.map((m) => m.maxErrorMm));
  const cm = (v: number) => v.toFixed(2).replace(".", ",");
  return (
    <>
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="twx-card flex h-[620px] flex-col overflow-hidden p-0">
        <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid var(--twx-line)" }}>
          <p className="text-sm font-semibold">3D-modell</p>
          <span className="text-xs" style={{ color: MUTED }}>Húzással forgatható, görgővel nagyítható.</span>
          <span className="ml-auto" />
          <button type="button" onClick={() => setWalking(true)} className="h-8 rounded-full px-4 text-xs font-semibold"
            title="Végigsétálhatsz a lakáson szemmagasságból (egér / ujj, W/A/S/D)" style={{ background: "var(--twx-coral)", color: "#fff" }}>Bejárás</button>
          <button type="button" onClick={onReopen} disabled={reopening} className="h-8 rounded-full px-3 text-xs font-semibold disabled:opacity-50"
            title={`Hibát látsz (pl. rossz helyen egy ajtó)? Javítsd a 2D terven — ${fixPrice > 0 ? `${fixPrice} kredit` : "ingyenes"}, és csak az érintett helyiségek épülnek újra.`}
            style={{ background: "#12100e", color: "#fff" }}>{reopening ? "Megnyitás…" : "Vissza a 2D javításhoz"}</button>
          <button type="button" onClick={onRestart} className="h-8 rounded-full px-3 text-xs font-semibold" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>Új alaprajz</button>
        </div>
        <div className="relative min-h-0 flex-1">
          <ApartmentViewer plan={plan} opts={sceneOptions} style={styleSheet} furniture={allFurniture} onApi={setApi} />
          {styleError && <p className="absolute bottom-3 left-3 rounded-lg px-3 py-1.5 text-[12px]" style={{ background: "#FDECEA", color: "#9B2C1B" }}>Stílus nélkül: {styleError}</p>}
        </div>
        <div className="flex h-12 items-center gap-3 px-4 text-[11.5px]" style={{ borderTop: "1px solid var(--twx-line)", color: MUTED }}>
          <p className="min-w-0 flex-1 truncate" title={living?.saved?.rationale || living?.skipped.join(" · ")}>
            {buildError ? <span style={{ color: "#C2522D" }}>{buildError}</span>
              : !living ? "Ebben a lakásban nincs nappali — a prototípus egyelőre a nappalit rendezi be."
              : living.saved
                ? <>Berendezés ({living.room.name}, {SOURCE_TEXT[living.saved.source] ?? living.saved.source}
                    {typeof living.saved.seconds === "number" ? ` · ${living.saved.seconds} mp` : ""}
                    {typeof living.saved.costUsd === "number" ? ` · ~${living.saved.costUsd.toFixed(2)} $` : ""}): {living.saved.rationale || living.items.map((i) => i.label).join(", ")}</>
                : <>Berendezés ({living.room.name}, alap-elrendezés): {living.items.map((i) => i.label).join(", ")}
                    {living.skipped.length ? <span style={{ color: "#9A7020" }}> · kimaradt: {living.skipped.join(" · ")}</span> : null}</>}
          </p>
          {living && (
            <button type="button" onClick={() => void furnish()} disabled={building || !projectId || !styleSheet}
              title={!styleSheet ? "Stíluslap nélkül nem rendezhető be" : "Az építő a stíluslap alapján rendezi be a nappalit (~1–2 perc, fizetős AI-hívás)"}
              className="h-8 w-[210px] flex-none rounded-full text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "#12100e", color: "#fff" }}>
              {building ? "Az építő dolgozik… (1–2 perc)" : living.saved ? "Újra az építővel" : "Berendezés az építővel"}
            </button>
          )}
        </div>
      </div>
      <div className="twx-card flex h-[620px] flex-col overflow-hidden p-0">
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--twx-line)" }}>
          <p className="text-sm font-semibold">Méretpontosság (a kész modellen mérve)</p>
          <p className="text-xs" style={{ color: MUTED }}>Falak közti tiszta méret sugárvetéssel + padlóterület, a jóváhagyott tervhez mérve.</p>
          <p className="mt-2 text-[13px] font-bold" style={{ color: worst === 0 ? "#2f7a4f" : worst <= 30 ? "#9A7020" : "#C2522D" }}>
            {worst === 0 ? "Minden helyiség pontos (0 mm eltérés)" : `Legnagyobb eltérés: ${worst} mm`}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {measures.map((m) => (
            <div key={m.roomId} className="px-4 py-2.5 text-[12.5px]" style={{ borderBottom: "1px solid var(--twx-line)" }}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold">{m.name}</span>
                <span className="font-bold" style={{ color: m.maxErrorMm === 0 ? "#2f7a4f" : m.maxErrorMm <= 30 ? "#9A7020" : "#C2522D" }}>{m.maxErrorMm} mm</span>
              </div>
              <p style={{ color: MUTED }}>
                padló {cm(m.floorArea)} / {cm(m.planArea)} m²
                {m.width ? ` · szél. ${cm(m.width.model)} / ${cm(m.width.plan)} m` : " · szél. nyitott határ"}
                {m.depth ? ` · mély. ${cm(m.depth.model)} / ${cm(m.depth.plan)} m` : " · mély. nyitott határ"}
              </p>
            </div>
          ))}
        </div>
        <p className="px-4 py-2.5 text-[11.5px] leading-snug" style={{ color: MUTED, borderTop: "1px solid var(--twx-line)" }}>
          {reopenError ? <span style={{ color: "#C2522D" }}>{reopenError} </span> : null}
          {rebuilt && rebuilt.length < plan.rooms.length
            ? <>Utólagos javítás után újraépítve: <b>{rebuilt.map((id) => plan.rooms.find((r) => r.id === id)?.name ?? "?").join(", ") || "nincs (geometriai változás nélkül)"}</b>. </>
            : null}
          30 mm = két összeérő helyiség közé épített vékony válaszfal (a rajzon nem volt fal-rés). A falak, ajtók és ablakok a jóváhagyott terv szerint épülnek.
        </p>
      </div>
    </div>
      <ShareCard projectId={projectId} linkDays={linkDays} creditsExtend={creditsExtend} />
      {walking && <WalkthroughViewer plan={plan} opts={sceneOptions} style={styleSheet} furniture={allFurniture} onClose={() => setWalking(false)} />}
      <TargetCard plan={plan} room={living?.room ?? null} projectId={projectId} images={living ? images[living.room.id] ?? {} : {}}
        canCapture={!!styleSheet} getApi={() => apiRef.current} onImages={(roomId, im) => onImages(roomId, im)} />
      <QualityCard plan={plan} room={living?.room ?? null} projectId={projectId} quality={living ? furnishing[living.room.id]?.quality ?? null : null}
        targetUsable={!!(living && images[living.room.id]?.fidelity?.ok)} canCapture={!!styleSheet}
        getApi={() => apiRef.current} nextApi={nextApi}
        onRound={(roomId, q, items) => onFurnished(roomId, { ...(furnishing[roomId] ?? {}), ...(items ? { items, source: "quality" as const } : {}), quality: q } as Furnishing)} />
    </>
  );
}

function SaveBadge({ save }: { save: { state: "idle" | "saving" | "saved" | "error"; msg?: string } }) {
  if (save.state === "idle") return null;
  const t = save.state === "saving" ? "Mentés…" : save.state === "saved" ? "Mentve ✓" : "Nincs mentve";
  const c = save.state === "error" ? "#C2522D" : save.state === "saved" ? "#2f7a4f" : MUTED;
  return <span className="w-[92px] flex-none text-right text-xs font-semibold" style={{ color: c }} title={save.msg}>{t}</span>;
}

function Steps({ current }: { current: number }) {
  const items = ["Feltöltés", "Javítás és ellenőrzés", "3D és berendezés", "Bejárás és link"];
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map((t, i) => {
        const n = i + 1, on = n === current, done = n < current;
        return (
          <div key={t} className="flex h-11 items-center gap-2 rounded-full px-3 text-[13px] font-semibold"
            style={on ? { background: "#12100e", color: "#fff" } : { background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs"
              style={{ background: on ? "#F08A68" : done ? "rgba(47,158,95,0.18)" : "var(--twx-line)", color: on ? "#1C1A17" : undefined }}>{done ? "✓" : n}</span>
            <span className="truncate">{t}</span>
          </div>
        );
      })}
    </div>
  );
}

function Seg<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { v: T; t: string; soon?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full p-1" style={{ background: "var(--twx-line)" }}>
      {items.map((it) => (
        <button key={it.v} type="button" onClick={() => onChange(it.v)} aria-pressed={value === it.v} disabled={!!it.soon} title={it.soon}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          style={value === it.v ? { background: "#12100e", color: "#fff" } : { color: "var(--twx-ink)" }}>
          {it.t}
          {it.soon && <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--twx-cream-card)" }}>Hamarosan</span>}
        </button>
      ))}
    </div>
  );
}

/** A sort CSAK a panel saját görgetősávjában hozza látótérbe (a scrollIntoView az egész oldalt is görgetné — húzás közben ugrálna). */
