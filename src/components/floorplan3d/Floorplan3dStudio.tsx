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
import { ActionMenu, MenuDots, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";
import PlanCanvas, { type Underlay } from "@/components/floorplan3d/PlanCanvas";
import ApartmentViewer, { useApartmentMeasure, type ViewerApi } from "@/components/floorplan3d/ApartmentViewer";
import WalkthroughViewer from "@/components/floorplan3d/WalkthroughViewer";
import { roomViewpoint } from "@/lib/floorplan3d/camera";
import type { SceneOptions } from "@/lib/floorplan3d/scene";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";
import { basicRoomLayout, livingRoomLayout, type FurnitureItem } from "@/lib/floorplan3d/furniture";
import { DOOR_DEFAULT, OPENING_PRESETS, ROOM_KINDS, WINDOW_DEFAULT, presetOf, type AreaGroup, type FloorPlan, type Opening, type Room, type RoomKind } from "@/lib/floorplan3d/plan";
import { addOpening, checkPlan, groupOf, leaveGroup, moveOpening, openingGaps, openingWarnings, patchGroup, removeOpening, roomEdge, setWallLength, toggleGroupMember, type GroupCheck, type OpeningWarning, type RoomCheck } from "@/lib/floorplan3d/geometry";
import type { NormalizeStats } from "@/lib/floorplan3d/normalize";

type Source = "digital" | "hand";
type Stats = NormalizeStats & { model: string; seconds: number; tokensIn: number; tokensOut: number; costUsd: number };

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const MUTED = "var(--twx-ink-muted)";
const STATUS_TEXT: Record<RoomCheck["status"], { t: string; c: string; bg: string }> = {
  ok: { t: "Rendben", c: "#2f7a4f", bg: "rgba(47,158,95,0.12)" },
  deviation: { t: "Eltérés", c: "#C2522D", bg: "rgba(227,104,63,0.12)" },
  approved: { t: "Jóváhagyva", c: "#9A7020", bg: "rgba(214,165,58,0.16)" },
  missing: { t: "Hiányzó m²", c: "#6E655C", bg: "rgba(110,101,92,0.12)" },
};

const fmt = (n: number, d = 2) => n.toLocaleString("hu-HU", { minimumFractionDigits: d, maximumFractionDigits: d });
const parseNum = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

export default function Floorplan3dStudio({ tolerancePct, maxUploadMb, creditsCreate, creditsGeometryFix, sceneOptions, openingCornerMin, styleSheet, styleError }: {
  tolerancePct: number; maxUploadMb: number; creditsCreate: number; creditsGeometryFix: number; sceneOptions: SceneOptions; openingCornerMin: number;
  styleSheet: StyleSheet | null; styleError: string | null;
}) {
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
  const [selRoom, setSelRoom] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<number | null>(null);
  const [selOpening, setSelOpening] = useState<string | null>(null);
  const [showUnderlay, setShowUnderlay] = useState(true);
  const [handAccepted, setHandAccepted] = useState(false);
  const [edgeError, setEdgeError] = useState<string | null>(null);
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
      setStatus("approved"); setConfirming(false); setSelRoom(null); setSelEdge(null); setSelOpening(null);
      setWasApproved(true); setRebuilt(Array.isArray(d.rebuildRooms) ? d.rebuildRooms : null);
    } catch {
      setApproveError("Hálózati hiba. Próbáld újra.");
    } finally {
      setApproving(false);
    }
  }

  const check = useMemo(() => (plan ? checkPlan(plan, tolerancePct) : null), [plan, tolerancePct]);
  const checks = useMemo(() => new Map((check?.rooms ?? []).map((c) => [c.roomId, c])), [check]);
  const room = plan?.rooms.find((r) => r.id === selRoom) ?? null;
  const warnings = useMemo(() => (plan ? openingWarnings(plan, openingCornerMin) : []), [plan, openingCornerMin]);
  const warnedIds = useMemo(() => new Set(warnings.map((w) => w.openingId)), [warnings]);
  /** Nyílászáró kijelölése (a terven vagy a listában): a helyisége és a fala is kijelölődik. */
  function selectOpening(id: string) {
    const o = plan?.openings.find((x) => x.id === id);
    if (!o) return;
    setSelRoom(o.roomId); setSelEdge(o.edge); setSelOpening(id); setEdgeError(null);
  }
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
      setPlan(d.plan); setStats(d.stats); setSelRoom(null); setSelEdge(null); setHandAccepted(false);
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
    setPlan(null); setStats(null); setSelRoom(null); setSelEdge(null); setError(null);
    setProjectId(null); setSave({ state: "idle" }); setFile(null); setFileUrl(null); setSourceMime(null);
    setStatus("draft"); setWasApproved(false); setRebuilt(null); setSelOpening(null); setFurnishing({}); setRoomImages({});
    window.history.replaceState(null, "", window.location.pathname);
  }

  // --- tervmódosítások (mindig a FloorPlan-on) ---
  const patchRoom = (id: string, p: Partial<Room>) => setPlan((pl) => pl && { ...pl, rooms: pl.rooms.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const patchOpening = (id: string, p: Partial<Opening>) => setPlan((pl) => pl && { ...pl, openings: pl.openings.map((o) => (o.id === id ? { ...o, ...p } : o)) });
  function setLength(edge: number, value: number): boolean {
    if (!plan || !room) return false;
    const r = setWallLength(plan, room.id, edge, value);
    if (!r.ok) { setEdgeError(r.error); return false; }
    setEdgeError(null); setPlan(r.plan); return true;
  }
  function toggleOpen(edge: number) {
    if (!room) return;
    const cur = new Set(room.openEdges ?? []);
    if (cur.has(edge)) cur.delete(edge); else cur.add(edge);
    patchRoom(room.id, { openEdges: [...cur].sort((a, b) => a - b) });
  }

  // ======================================================================
  return (
    <div className="flex flex-col gap-5">
      <ModuleIntro eyebrow="Prototípus · csak admin" title="Alaprajzból bejárható 3D lakás" icon="visualization"
        subtitle="Tölts fel egy alaprajzot — digitalizáljuk, te ellenőrzöd és javítod, majd méretpontos, bejárható 3D lakás készül belőle."
        chips={["Méretpontos", "Japandi stílus", "Bejárható link", "9:16 videó"]} />

      <Steps current={!plan ? 1 : status === "draft" ? 2 : 3} />

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
        <ModelStage plan={plan} sceneOptions={sceneOptions} onRestart={restart} rebuilt={rebuilt} styleSheet={styleSheet} styleError={styleError}
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
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="twx-card flex h-[620px] flex-col overflow-hidden p-0">
              <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: "1px solid var(--twx-line)" }}>
                <p className="text-sm font-semibold">Digitalizált terv</p>
                <span className="text-xs" style={{ color: MUTED }}>Kattints egy helyiségre, majd egy falára.</span>
                <span className="ml-auto" />
                <SaveBadge save={save} />
                <label className={`flex items-center gap-1.5 text-xs font-semibold ${underlay ? "cursor-pointer" : "opacity-50"}`}
                  title={underlay ? undefined : "PDF-nél az eredeti rajz nem tehető a terv alá"}>
                  <input type="checkbox" checked={showUnderlay && !!underlay} disabled={!underlay} onChange={(e) => setShowUnderlay(e.target.checked)}
                    style={{ accentColor: "var(--twx-coral)" }} />
                  Eredeti rajz alatta
                </label>
                <button type="button" onClick={restart} className="h-8 rounded-full px-3 text-xs font-semibold" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                  Új feltöltés
                </button>
              </div>
              <div className="min-h-0 flex-1 p-3" style={{ background: "#FBF8F3" }}>
                <PlanCanvas plan={plan} checks={checks} selectedRoom={selRoom} selectedEdge={selEdge}
                  onSelectRoom={(id) => { setSelRoom(id); setSelEdge(null); setSelOpening(null); setEdgeError(null); }}
                  onSelectEdge={(i) => { setSelEdge(i); setSelOpening(null); setEdgeError(null); }}
                  underlay={underlay} showUnderlay={showUnderlay}
                  selectedOpening={selOpening} warned={warnedIds} onSelectOpening={selectOpening}
                  onMoveOpening={(id, off) => setPlan((pl) => pl && moveOpening(pl, id, off))} />
              </div>
              {stats && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-[11.5px]" style={{ borderTop: "1px solid var(--twx-line)", color: MUTED }}>
                  <span>Lépték: {stats.scaleSource === "dimensions" ? `${stats.dimensionCount} méretvonalból` : stats.scaleSource === "legend" ? "a táblázat m²-összegéből" : stats.scaleSource === "areas" ? "a kiírt m²-ekből" : "becsült"}</span>
                  {stats.scaleAgreementPct !== null && <span>méretvonal ↔ m² egyezés: {fmt(Math.abs(stats.scaleAgreementPct), 1)}%</span>}
                  <span>{stats.seconds.toLocaleString("hu-HU")} mp · ~{fmt(stats.costUsd, 3)} $ · {stats.model}</span>
                </div>
              )}
            </div>

            {/* jobb panel — fix magasság, belül görget */}
            <div className="twx-card flex h-[620px] flex-col overflow-hidden p-0">
              {room ? (
                <RoomPanel key={room.id} room={room} check={checks.get(room.id)!} plan={plan} tolerancePct={tolerancePct}
                  selEdge={selEdge} edgeError={edgeError} onBack={() => { setSelRoom(null); setSelEdge(null); }}
                  onSelectEdge={setSelEdge} onPatch={(p) => patchRoom(room.id, p)} onLength={setLength} onToggleOpen={toggleOpen}
                  onAddOpening={(edge, kind) => setPlan((pl) => pl && addOpening(pl, room.id, edge, kind))}
                  onPatchOpening={patchOpening} onRemoveOpening={(id) => setPlan((pl) => pl && removeOpening(pl, id))}
                  groupCheck={check?.groups.find((g) => g.groupId === checks.get(room.id)?.groupId) ?? null} checks={checks}
                  onToggleMember={(other) => setPlan((pl) => pl && toggleGroupMember(pl, room.id, other))}
                  onLeaveGroup={() => setPlan((pl) => pl && leaveGroup(pl, room.id))}
                  onPatchGroup={(gid, p) => setPlan((pl) => pl && patchGroup(pl, gid, p))}
                  warnings={warnings} selOpening={selOpening} onSelectOpening={selectOpening} />
              ) : (
                <RoomList plan={plan} checks={checks} onSelect={(id) => setSelRoom(id)}
                  onCeiling={(v) => setPlan((pl) => pl && { ...pl, ceilingHeight: v })} />
              )}
            </div>
          </div>

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

function ModelStage({ plan, sceneOptions, onRestart, rebuilt, fixPrice, reopening, reopenError, onReopen, styleSheet, styleError, projectId, furnishing, onFurnished, images, onImages }: {
  plan: FloorPlan; sceneOptions: SceneOptions; onRestart: () => void; rebuilt: string[] | null; styleSheet: StyleSheet | null; styleError: string | null;
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
  // a teljes lakás berendezése: nappali (fent) + a többi helyiség (mentett berendezés, ha van; különben „pár bútor" szabály szerint)
  const allFurniture = useMemo(() => {
    const out: FurnitureItem[] = [...(living?.items ?? [])];
    for (const r of plan.rooms) {
      if (r.id === living?.room.id) continue;
      out.push(...(furnishing[r.id]?.items?.length ? furnishing[r.id].items : basicRoomLayout(plan, r)));
    }
    return out;
  }, [plan, furnishing, living]);
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
          30 mm = két összeérő helyiség közé épített vékony válaszfal (a rajzon nem volt fal-rés). Következő lépés: japandi berendezés.
        </p>
      </div>
    </div>
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
  const items = ["Feltöltés", "Javítás és ellenőrzés", "3D és berendezés", "Bejárás és videó"];
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map((t, i) => {
        const n = i + 1, on = n === current, done = n < current, soon = n > 3;
        return (
          <div key={t} className="flex h-11 items-center gap-2 rounded-full px-3 text-[13px] font-semibold"
            style={on ? { background: "#12100e", color: "#fff" } : { background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", color: soon ? MUTED : undefined }}>
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs"
              style={{ background: on ? "#F08A68" : done ? "rgba(47,158,95,0.18)" : "var(--twx-line)", color: on ? "#1C1A17" : undefined }}>{done ? "✓" : n}</span>
            <span className="truncate">{t}</span>
            {soon && <span className="ml-auto flex-none rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--twx-line)" }}>Hamarosan</span>}
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
function scrollWithin(el: HTMLElement | null) {
  const box = el?.closest<HTMLElement>(".overflow-y-auto");
  if (!el || !box) return;
  const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  if (r.top < b.top) box.scrollTop -= b.top - r.top + 8;
  else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 8;
}

/** Szám-mező: gépelés közben szabad szöveg, Enterre / elhagyáskor érvényesül; hibás értéknél visszaáll. */
function NumField({ value, onCommit, suffix, width = 78, placeholder, allowZero = false }: { value: number | null; onCommit: (v: number | null) => boolean | void; suffix?: string; width?: number; placeholder?: string; allowZero?: boolean }) {
  const shown = value === null ? "" : fmt(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  // a MEZŐ aktuális tartalmát olvassuk (nem a draft állapotot): gyors gépelés + azonnali elhagyás után a state még késhet
  function commit(text: string) {
    if (text.trim() === "") { if (onCommit(null) === false) setDraft(shown); return; }
    const v = parseNum(text);
    if (!Number.isFinite(v) || (allowZero ? v < 0 : v <= 0) || onCommit(Math.round(v * 100) / 100) === false) setDraft(shown);
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={(e) => commit(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        inputMode="decimal" placeholder={placeholder} className="h-8 rounded-lg px-2 text-right text-[13px] outline-none focus:border-[var(--twx-coral)]"
        style={{ width, border: "1px solid var(--twx-line)", background: "#fff" }} />
      {suffix && <span className="text-xs" style={{ color: MUTED }}>{suffix}</span>}
    </span>
  );
}

function StatusPill({ status }: { status: RoomCheck["status"] }) {
  const s = STATUS_TEXT[status];
  return <span className="inline-flex h-6 flex-none items-center rounded-full px-2.5 text-[11px] font-bold" style={{ color: s.c, background: s.bg }}>{s.t}</span>;
}

// ---------------------------------------------------------------------------
function RoomList({ plan, checks, onSelect, onCeiling }: { plan: FloorPlan; checks: Map<string, RoomCheck>; onSelect: (id: string) => void; onCeiling: (v: number) => void }) {
  return (
    <>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--twx-line)" }}>
        <p className="text-sm font-semibold">Helyiségek ({plan.rooms.length})</p>
        <p className="text-xs" style={{ color: MUTED }}>Válassz egyet a javításhoz — a terven is rákattinthatsz.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {plan.rooms.map((r) => {
          const c = checks.get(r.id)!;
          return (
            <button key={r.id} type="button" onClick={() => onSelect(r.id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(239,122,90,0.06)]" style={{ borderBottom: "1px solid var(--twx-line)" }}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.name}</span>
                <span className="block text-xs" style={{ color: MUTED }}>
                  {fmt(c.area)} m² számolt{c.groupId ? ` · csoport: ${plan.areaGroups?.find((g) => g.id === c.groupId)?.label ?? ""}` : c.declared ? ` · ${fmt(c.declared)} m² megadott` : ""}{c.diffPct !== null ? ` · ${c.diffPct > 0 ? "+" : ""}${fmt(c.diffPct, 1)}%` : ""}
                </span>
              </span>
              <StatusPill status={c.status} />
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: "1px solid var(--twx-line)" }}>
        <span className="flex-1 text-sm font-semibold">Belmagasság</span>
        <NumField value={plan.ceilingHeight} suffix="m" onCommit={(v) => { if (v === null || v < 2 || v > 5) return false; onCeiling(v); }} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
function RoomPanel(props: {
  room: Room; check: RoomCheck; plan: FloorPlan; tolerancePct: number; selEdge: number | null; edgeError: string | null;
  onBack: () => void; onSelectEdge: (i: number) => void; onPatch: (p: Partial<Room>) => void;
  onLength: (edge: number, v: number) => boolean; onToggleOpen: (edge: number) => void;
  onAddOpening: (edge: number, kind: Opening["kind"]) => void; onPatchOpening: (id: string, p: Partial<Opening>) => void; onRemoveOpening: (id: string) => void;
  groupCheck: GroupCheck | null; checks: Map<string, RoomCheck>;
  warnings: OpeningWarning[]; selOpening: string | null; onSelectOpening: (id: string) => void;
  onToggleMember: (otherId: string) => void; onLeaveGroup: () => void; onPatchGroup: (groupId: string, p: Partial<Pick<AreaGroup, "label" | "declaredArea" | "approved">>) => void;
}) {
  const { room, check, plan, tolerancePct, selEdge } = props;
  const group = groupOf(plan, room.id);
  const openings = plan.openings.filter((o) => o.roomId === room.id);
  const open = new Set(room.openEdges ?? []);
  const edgeRef = useRef<Record<number, HTMLDivElement | null>>({});
  useEffect(() => { if (selEdge !== null) scrollWithin(edgeRef.current[selEdge] ?? null); }, [selEdge]);

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--twx-line)" }}>
        <button type="button" onClick={props.onBack} className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: "var(--twx-line)" }} aria-label="Vissza a listához">←</button>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{room.name || "Névtelen helyiség"}</p>
        <StatusPill status={check.status} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {/* alapadatok */}
        <div className="grid grid-cols-[88px_1fr] items-center gap-x-3 gap-y-2.5 text-[13px]">
          <span className="font-semibold">Név</span>
          <input value={room.name} onChange={(e) => props.onPatch({ name: e.target.value.slice(0, 60) })} className="h-8 rounded-lg px-2 text-[13px] outline-none"
            style={{ border: "1px solid var(--twx-line)", background: "#fff" }} />
          <span className="font-semibold">Típus</span>
          <SelectField size="sm" value={room.kind} onChange={(v) => props.onPatch({ kind: v as RoomKind })} options={ROOM_KINDS.map((k) => ({ value: k.value, label: k.label }))} ariaLabel="Helyiségtípus" />
          <span className="font-semibold">Valós m²</span>
          <span className="flex items-center gap-2">
            {group
              ? <span className="text-xs" style={{ color: MUTED }}>a csoport m²-e számít · saját: {fmt(check.area)}</span>
              : <>
                  <NumField value={room.declaredArea} suffix="m²" placeholder="kötelező" onCommit={(v) => props.onPatch({ declaredArea: v, areaApproved: false })} />
                  <span className="text-xs" style={{ color: MUTED }}>számolt: {fmt(check.area)}</span>
                </>}
          </span>
        </div>
        <GroupBlock room={room} group={group} groupCheck={props.groupCheck} plan={plan} checks={props.checks} tolerancePct={tolerancePct}
          onToggleMember={props.onToggleMember} onLeave={props.onLeaveGroup} onPatch={props.onPatchGroup} />
        {group ? null : check.status === "deviation" || check.status === "approved" ? (
          <div className="mt-3 rounded-xl p-3 text-[12.5px]" style={{ background: STATUS_TEXT[check.status].bg }}>
            <p>A falhosszakból számolt terület <b>{check.diffPct! > 0 ? "+" : ""}{fmt(check.diffPct!, 1)}%</b>-kal tér el a megadottól (tűrés: ±{fmt(tolerancePct, 0)}%). Javítsd a falhosszakat, vagy hagyd jóvá tudatosan.</p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" checked={!!room.areaApproved} onChange={(e) => props.onPatch({ areaApproved: e.target.checked })} style={{ accentColor: "var(--twx-coral)" }} />
              Tudatosan jóváhagyom az eltérést
            </label>
          </div>
        ) : check.status === "missing" ? (
          <p className="mt-3 rounded-xl p-3 text-[12.5px]" style={{ background: STATUS_TEXT.missing.bg }}>Add meg a helyiség valós m²-ét (pl. az alaprajzról vagy a műszaki leírásból) — ezzel ellenőrizzük a méreteket.</p>
        ) : null}

        {/* falak */}
        <p className="mb-1.5 mt-4 text-[12px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>Falak</p>
        <p className="mb-2 text-[11.5px] leading-snug" style={{ color: MUTED }}>Új hossznál a fal jobb / alsó vége mozdul, a mögötte lévő rész vele együtt.</p>
        {props.edgeError && <p className="mb-2 rounded-lg px-2.5 py-1.5 text-[12px] text-red-700" style={{ background: "#FDECEA" }}>{props.edgeError}</p>}
        <div className="flex flex-col gap-1">
          {room.polygon.map((_, i) => {
            const e = roomEdge(room, i);
            return <EdgeRow key={i} index={i} length={e.length} slanted={!e.axis} isOpen={open.has(i)} selected={selEdge === i}
              refEl={(el) => { edgeRef.current[i] = el; }} onSelect={() => props.onSelectEdge(i)}
              onLength={(v) => props.onLength(i, v)} onToggleOpen={() => props.onToggleOpen(i)} onAdd={(k) => props.onAddOpening(i, k)} />;
          })}
        </div>

        {/* nyílászárók */}
        <p className="mb-1.5 mt-4 text-[12px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>Ajtók és ablakok</p>
        {openings.length === 0 ? (
          <p className="rounded-xl px-3 py-3 text-[12.5px]" style={{ background: "#fff", border: "1px dashed var(--twx-line)", color: MUTED }}>
            Ennek a helyiségnek nincs ajtaja vagy ablaka. Egy fal ⋯ menüjéből adhatsz hozzá.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {openings.map((o) => <OpeningRow key={o.id} o={o} room={room} warnings={props.warnings.filter((w) => w.openingId === o.id)}
              selected={props.selOpening === o.id} onSelect={() => props.onSelectOpening(o.id)}
              onPatch={(p) => props.onPatchOpening(o.id, p)} onRemove={() => props.onRemoveOpening(o.id)} />)}
          </div>
        )}
      </div>
    </>
  );
}

/** Összevont ellenőrzés: ha a forrás több helyiséget együtt ad meg (pl. „Hálószoba 34,11 m²" három szobára). */
function GroupBlock({ room, group, groupCheck, plan, checks, tolerancePct, onToggleMember, onLeave, onPatch }: {
  room: Room; group: AreaGroup | null; groupCheck: GroupCheck | null; plan: FloorPlan; checks: Map<string, RoomCheck>; tolerancePct: number;
  onToggleMember: (otherId: string) => void; onLeave: () => void; onPatch: (groupId: string, p: Partial<Pick<AreaGroup, "label" | "declaredArea" | "approved">>) => void;
}) {
  const [picking, setPicking] = useState(false);
  const others = plan.rooms.filter((r) => r.id !== room.id);
  const picker = (
    <div className="mt-2 max-h-[148px] overflow-y-auto rounded-lg" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
      {others.map((r) => {
        const inMine = !!group?.roomIds.includes(r.id);
        const elsewhere = !inMine && !!groupOf(plan, r.id);
        return (
          <label key={r.id} className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[12.5px]" style={{ borderBottom: "1px solid var(--twx-line)" }}>
            <input type="checkbox" checked={inMine} onChange={() => onToggleMember(r.id)} style={{ accentColor: "var(--twx-coral)" }} />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="text-[11px]" style={{ color: MUTED }}>{fmt(checks.get(r.id)?.area ?? 0)} m²{elsewhere ? " · másik csoportban" : ""}</span>
          </label>
        );
      })}
    </div>
  );

  if (!group) {
    return (
      <div className="mt-3 rounded-xl p-3 text-[12.5px]" style={{ background: "#fff", border: "1px dashed var(--twx-line)" }}>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1" style={{ color: MUTED }}>A forrás több helyiséget együtt ad meg (pl. „Hálószoba 34,11 m²”)?</span>
          <button type="button" onClick={() => setPicking((v) => !v)} className="h-7 flex-none rounded-full px-3 text-[12px] font-semibold"
            style={{ border: "1px solid var(--twx-line)", background: picking ? "var(--twx-line)" : "#fff" }}>Összevonás…</button>
        </div>
        {picking && picker}
      </div>
    );
  }
  const st = groupCheck?.status ?? "missing";
  return (
    <div className="mt-3 rounded-xl p-3 text-[12.5px]" style={{ background: STATUS_TEXT[st].bg }}>
      <div className="flex items-center gap-2">
        <span className="font-bold">Összevont ellenőrzés</span>
        <span className="ml-auto"><StatusPill status={st} /></span>
      </div>
      <div className="mt-2 grid grid-cols-[72px_1fr] items-center gap-x-2 gap-y-2">
        <span className="font-semibold">Felirat</span>
        <input value={group.label} onChange={(e) => onPatch(group.id, { label: e.target.value.slice(0, 60) })} className="h-8 rounded-lg px-2 text-[13px] outline-none"
          style={{ border: "1px solid var(--twx-line)", background: "#fff" }} />
        <span className="font-semibold">Közös m²</span>
        <span className="flex items-center gap-2">
          <NumField value={group.declaredArea} suffix="m²" placeholder="kötelező" onCommit={(v) => onPatch(group.id, { declaredArea: v, approved: false })} />
          <span className="text-xs" style={{ color: MUTED }}>tagok összesen: {fmt(groupCheck?.area ?? 0)}</span>
        </span>
      </div>
      <p className="mt-2" style={{ color: MUTED }}>Tagok: {group.roomIds.map((id) => plan.rooms.find((r) => r.id === id)?.name ?? "?").join(", ")}</p>
      {(st === "deviation" || st === "approved") && (
        <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
          <input type="checkbox" checked={!!group.approved} onChange={(e) => onPatch(group.id, { approved: e.target.checked })} style={{ accentColor: "var(--twx-coral)" }} />
          Tudatosan jóváhagyom az eltérést ({groupCheck!.diffPct! > 0 ? "+" : ""}{fmt(groupCheck!.diffPct!, 1)}%, tűrés ±{fmt(tolerancePct, 0)}%)
        </label>
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => setPicking((v) => !v)} className="h-7 rounded-full px-3 text-[12px] font-semibold" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
          {picking ? "Kész" : "Tagok módosítása"}
        </button>
        <button type="button" onClick={onLeave} className="h-7 rounded-full px-3 text-[12px] font-semibold" style={{ color: MUTED }}>Ez a helyiség kilép</button>
      </div>
      {picking && picker}
    </div>
  );
}

function EdgeRow({ index, length, slanted, isOpen, selected, refEl, onSelect, onLength, onToggleOpen, onAdd }: {
  index: number; length: number; slanted: boolean; isOpen: boolean; selected: boolean; refEl: (el: HTMLDivElement | null) => void;
  onSelect: () => void; onLength: (v: number) => boolean; onToggleOpen: () => void; onAdd: (k: Opening["kind"]) => void;
}) {
  const menu = useActionMenu();
  const items: MenuItem[] = [
    { label: "Ajtó hozzáadása", onClick: () => onAdd("door"), disabled: isOpen, hint: isOpen ? "Nyitott határon nincs fal" : undefined },
    { label: "Ablak hozzáadása", onClick: () => onAdd("window"), disabled: isOpen, hint: isOpen ? "Nyitott határon nincs fal" : undefined },
    { label: isOpen ? "Legyen itt fal" : "Nyitott határ (fal nélkül)", onClick: onToggleOpen },
  ];
  return (
    <div ref={refEl} onClick={onSelect} onContextMenu={menu.openAtEvent}
      className="flex h-11 cursor-pointer items-center gap-2 rounded-xl px-2.5 transition-colors"
      style={{ background: selected ? "rgba(227,104,63,0.10)" : "#fff", border: `1px solid ${selected ? "#E3683F" : "var(--twx-line)"}` }}>
      <span className="w-12 flex-none text-[12.5px] font-semibold">{index + 1}. fal</span>
      {isOpen && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--twx-line)" }}>nyitott</span>}
      <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
        {slanted
          ? <span className="text-[12px]" title="Ferde fal hossza az első fázisban nem javítható" style={{ color: MUTED }}>{fmt(length)} m (ferde)</span>
          : <NumField value={Math.round(length * 100) / 100} suffix="m" onCommit={(v) => (v === null ? false : onLength(v))} />}
      </span>
      <MenuDots onClick={menu.openAtButton} label={`${index + 1}. fal műveletei`} />
      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}
    </div>
  );
}

/** Nyílászáró-sor: típus és méret (szabványos lista vagy egyedi), parapet, távolság a két saroktól, nyitásirány, figyelmeztetések. */
function OpeningRow({ o, room, warnings, selected, onSelect, onPatch, onRemove }: {
  o: Opening; room: Room; warnings: OpeningWarning[]; selected: boolean;
  onSelect: () => void; onPatch: (p: Partial<Opening>) => void; onRemove: () => void;
}) {
  const menu = useActionMenu();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selected) scrollWithin(ref.current); }, [selected]);
  const g = openingGaps(room, o);
  const preset = presetOf(o);
  const toKind = (k: Opening["kind"]): Partial<Opening> => k === "window"
    ? { kind: "window", height: WINDOW_DEFAULT.height, sill: WINDOW_DEFAULT.sill, hinge: undefined, swing: undefined }
    : { kind: "door", height: DOOR_DEFAULT.height, sill: 0, hinge: "start", swing: "in" };
  const items: MenuItem[] = [
    ...(o.kind === "door" ? [
      { label: o.swing === "out" ? "Nyíljon befelé" : "Nyíljon kifelé", onClick: () => onPatch({ swing: o.swing === "out" ? "in" : "out" }) } as MenuItem,
      { label: "Zsanér a másik oldalra", onClick: () => onPatch({ hinge: o.hinge === "end" ? "start" : "end" }) } as MenuItem,
    ] : []),
    { label: o.kind === "door" ? "Legyen ablak" : "Legyen ajtó", onClick: () => onPatch(toKind(o.kind === "door" ? "window" : "door")) },
    { label: "Törlés", onClick: onRemove, danger: true },
  ];
  const sizeOk = (v: number | null): v is number => v !== null && v >= 0.3 && v <= 5;
  return (
    <div ref={ref} onClick={onSelect} onContextMenu={menu.openAtEvent} className="flex flex-col gap-1.5 rounded-xl px-2.5 py-2"
      style={{ background: "#fff", border: `1px solid ${selected ? "#E3683F" : "var(--twx-line)"}` }}>
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] font-semibold" style={{ color: o.kind === "door" ? "#2F7F86" : "#3B6FD6" }}>{o.kind === "door" ? "Ajtó" : "Ablak"}</span>
        <span className="text-[11.5px]" style={{ color: MUTED }}>{o.edge + 1}. fal{o.kind === "door" ? ` · ${o.swing === "out" ? "kifelé" : "befelé"} nyílik` : ""}</span>
        <span className="ml-auto" />
        <MenuDots onClick={menu.openAtButton} label="Nyílászáró műveletei" />
        {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}
      </div>
      <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-1.5 text-[12px]">
        <SelectField size="sm" value={preset?.id ?? "custom"} ariaLabel="Méret" onChange={(v) => {
          const p = OPENING_PRESETS.find((x) => x.id === v);
          if (p) onPatch({ width: p.width, height: p.height, sill: p.sill });
        }} options={[...OPENING_PRESETS.filter((p) => p.kind === o.kind).map((p) => ({ value: p.id, label: p.label })), { value: "custom", label: "Egyedi méret" }]} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">szél. <NumField value={o.width} suffix="m" width={58} onCommit={(v) => (sizeOk(v) ? onPatch({ width: v }) : false)} /></span>
          <span className="flex items-center gap-1">mag. <NumField value={o.height} suffix="m" width={58} onCommit={(v) => (sizeOk(v) ? onPatch({ height: v }) : false)} /></span>
          {o.kind === "window" && (
            <span className="flex items-center gap-1">parapet <NumField value={o.sill} suffix="m" width={58} allowZero
              onCommit={(v) => (v !== null && v >= 0 && v <= 2.5 ? onPatch({ sill: v }) : false)} /></span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1" title="A nyílászáró széle és a fal eleje közti távolság">saroktól <NumField value={g.start} suffix="m" width={58} allowZero
            onCommit={(v) => (v !== null && v >= 0 ? onPatch({ offset: v + o.width / 2 }) : false)} /></span>
          <span className="flex items-center gap-1" title="A nyílászáró széle és a fal vége közti távolság">túlsó saroktól <NumField value={g.end} suffix="m" width={58} allowZero
            onCommit={(v) => (v !== null && v >= 0 ? onPatch({ offset: g.wall - v - o.width / 2 }) : false)} /></span>
        </div>
        {warnings.map((w, i) => (
          <p key={i} className="rounded-lg px-2 py-1 text-[11.5px]" style={{ background: "rgba(224,165,38,0.14)", color: "#8A6416" }}>⚠ {w.text}</p>
        ))}
      </div>
    </div>
  );
}
