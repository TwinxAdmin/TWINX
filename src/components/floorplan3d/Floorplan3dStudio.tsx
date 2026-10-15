// Floorplan3dStudio — „Alaprajzból bejárható 3D lakás", 1. lépés (PROTOTÍPUS, csak admin):
//   Feltöltés (kép / PDF / kézi rajz fotója + stílus) → digitalizálás (Gemini) → javítás → méret-ellenőrzés.
// A lakásleírás (FloorPlan) az egyetlen igazságforrás; minden javítás azon történik (lib/floorplan3d/geometry).
// Mentés: a digitalizálás után a projekt az adatbázisba kerül (?p=<id> a címben); minden javítás 0,8 mp után automatikusan
// mentődik (PATCH). Újratöltéskor a ?p= alapján visszatölt. Ha a migráció még nem futott, a felület mentés nélkül is működik.
// A „3D bejárás indítása" csak akkor lehetne aktív, ha minden helyiség rendben / tudatosan jóváhagyva — a 3D a 2. lépésben jön.
"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import SelectField from "@/components/SelectField";
import { ActionMenu, MenuDots, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";
import PlanCanvas, { type Underlay } from "@/components/floorplan3d/PlanCanvas";
import { ROOM_KINDS, type FloorPlan, type Opening, type Room, type RoomKind } from "@/lib/floorplan3d/plan";
import { addOpening, checkPlan, removeOpening, roomEdge, setWallLength, type RoomCheck } from "@/lib/floorplan3d/geometry";
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

export default function Floorplan3dStudio({ tolerancePct, maxUploadMb }: { tolerancePct: number; maxUploadMb: number }) {
  const [source, setSource] = useState<Source>("digital");
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<FloorPlan | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selRoom, setSelRoom] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<number | null>(null);
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
        setSourceMime(d.project.source_mime); setFileUrl(d.sourceUrl); setSave({ state: "saved" });
      })
      .catch(() => setError("Nem sikerült betölteni az alaprajzot."))
      .finally(() => setLoadingProject(false));
  }, []);

  // automatikus mentés (0,8 mp-cel az utolsó változás után)
  useEffect(() => {
    if (!plan || !projectId) return;
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
  }, [plan, handAccepted, projectId]);

  const check = useMemo(() => (plan ? checkPlan(plan, tolerancePct) : null), [plan, tolerancePct]);
  const checks = useMemo(() => new Map((check?.rooms ?? []).map((c) => [c.roomId, c])), [check]);
  const room = plan?.rooms.find((r) => r.id === selRoom) ?? null;
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

      <Steps current={plan ? 2 : 1} />

      {loadingProject ? (
        <div className="twx-card flex h-[300px] items-center justify-center text-sm" style={{ color: MUTED }}>Alaprajz betöltése…</div>
      ) : !plan ? (
        /* ---------------- 1. FELTÖLTÉS ---------------- */
        <div className="twx-card grid gap-5 p-6 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            <Seg value={source} onChange={(v) => setSource(v as Source)}
              items={[{ v: "digital", t: "Digitális alaprajz / PDF" }, { v: "hand", t: "Kézi rajz fotója" }]} />
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
      ) : (
        /* ---------------- 2. JAVÍTÁS + ELLENŐRZÉS ---------------- */
        <>
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
                  onSelectRoom={(id) => { setSelRoom(id); setSelEdge(null); setEdgeError(null); }}
                  onSelectEdge={(i) => { setSelEdge(i); setEdgeError(null); }}
                  underlay={underlay} showUnderlay={showUnderlay} />
              </div>
              {stats && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-[11.5px]" style={{ borderTop: "1px solid var(--twx-line)", color: MUTED }}>
                  <span>Lépték: {stats.scaleSource === "dimensions" ? `${stats.dimensionCount} méretvonalból` : stats.scaleSource === "areas" ? "a kiírt m²-ekből" : "becsült"}</span>
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
                  onPatchOpening={patchOpening} onRemoveOpening={(id) => setPlan((pl) => pl && removeOpening(pl, id))} />
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
            <button type="button" disabled className="twx-btn h-11 w-full px-6 disabled:cursor-not-allowed lg:w-[240px]"
              title={ready ? "Hamarosan — a 3D-építés a 2. fejlesztési lépésben készül el" : "Előbb minden helyiségnek rendben kell lennie (vagy tudatosan jóváhagyva)"}>
              3D bejárás indítása
            </button>
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
function SaveBadge({ save }: { save: { state: "idle" | "saving" | "saved" | "error"; msg?: string } }) {
  if (save.state === "idle") return null;
  const t = save.state === "saving" ? "Mentés…" : save.state === "saved" ? "Mentve ✓" : "Nincs mentve";
  const c = save.state === "error" ? "#C2522D" : save.state === "saved" ? "#2f7a4f" : MUTED;
  return <span className="w-[92px] flex-none text-right text-xs font-semibold" style={{ color: c }} title={save.msg}>{t}</span>;
}

function Steps({ current }: { current: number }) {
  const items = ["Feltöltés", "Javítás és ellenőrzés", "Stílus és berendezés", "Bejárás és videó"];
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map((t, i) => {
        const n = i + 1, on = n === current, done = n < current, soon = n > 2;
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

function Seg<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { v: T; t: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full p-1" style={{ background: "var(--twx-line)" }}>
      {items.map((it) => (
        <button key={it.v} type="button" onClick={() => onChange(it.v)} aria-pressed={value === it.v}
          className="h-9 rounded-full text-[13px] font-semibold transition-colors"
          style={value === it.v ? { background: "#12100e", color: "#fff" } : { color: "var(--twx-ink)" }}>{it.t}</button>
      ))}
    </div>
  );
}

/** Szám-mező: gépelés közben szabad szöveg, Enterre / elhagyáskor érvényesül; hibás értéknél visszaáll. */
function NumField({ value, onCommit, suffix, width = 78, placeholder }: { value: number | null; onCommit: (v: number | null) => boolean | void; suffix?: string; width?: number; placeholder?: string }) {
  const shown = value === null ? "" : fmt(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  function commit() {
    if (draft.trim() === "") { if (onCommit(null) === false) setDraft(shown); return; }
    const v = parseNum(draft);
    if (!Number.isFinite(v) || v <= 0 || onCommit(Math.round(v * 100) / 100) === false) setDraft(shown);
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
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
                  {fmt(c.area)} m² számolt{c.declared ? ` · ${fmt(c.declared)} m² megadott` : ""}{c.diffPct !== null ? ` · ${c.diffPct > 0 ? "+" : ""}${fmt(c.diffPct, 1)}%` : ""}
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
}) {
  const { room, check, plan, tolerancePct, selEdge } = props;
  const openings = plan.openings.filter((o) => o.roomId === room.id);
  const open = new Set(room.openEdges ?? []);
  const edgeRef = useRef<Record<number, HTMLDivElement | null>>({});
  useEffect(() => { if (selEdge !== null) edgeRef.current[selEdge]?.scrollIntoView({ block: "nearest" }); }, [selEdge]);

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
            <NumField value={room.declaredArea} suffix="m²" placeholder="kötelező" onCommit={(v) => props.onPatch({ declaredArea: v, areaApproved: false })} />
            <span className="text-xs" style={{ color: MUTED }}>számolt: {fmt(check.area)}</span>
          </span>
        </div>
        {check.status === "deviation" || check.status === "approved" ? (
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
            {openings.map((o) => <OpeningRow key={o.id} o={o} edgeLen={roomEdge(room, o.edge).length}
              onPatch={(p) => props.onPatchOpening(o.id, p)} onRemove={() => props.onRemoveOpening(o.id)} onSelectEdge={() => props.onSelectEdge(o.edge)} />)}
          </div>
        )}
      </div>
    </>
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

function OpeningRow({ o, edgeLen, onPatch, onRemove, onSelectEdge }: { o: Opening; edgeLen: number; onPatch: (p: Partial<Opening>) => void; onRemove: () => void; onSelectEdge: () => void }) {
  const menu = useActionMenu();
  const items: MenuItem[] = [
    ...(o.kind === "door" ? [
      { label: o.swing === "out" ? "Nyíljon befelé" : "Nyíljon kifelé", onClick: () => onPatch({ swing: o.swing === "out" ? "in" : "out" }) } as MenuItem,
      { label: "Zsanér a másik oldalra", onClick: () => onPatch({ hinge: o.hinge === "end" ? "start" : "end" }) } as MenuItem,
    ] : []),
    { label: "Törlés", onClick: onRemove, danger: true },
  ];
  return (
    <div onClick={onSelectEdge} onContextMenu={menu.openAtEvent} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl px-2.5 py-2"
      style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
      <span className="w-12 flex-none text-[12.5px] font-semibold" style={{ color: o.kind === "door" ? "#2F7F86" : "#3B6FD6" }}>{o.kind === "door" ? "Ajtó" : "Ablak"}</span>
      <span className="text-[11.5px]" style={{ color: MUTED }}>{o.edge + 1}. fal</span>
      {o.kind === "door" && <span className="text-[11px]" style={{ color: MUTED }}>· {o.swing === "out" ? "kifelé" : "befelé"}</span>}
      <span className="ml-auto" />
      <MenuDots onClick={menu.openAtButton} label="Nyílászáró műveletei" />
      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}
      <div className="flex w-full items-center gap-3 text-[12px]" onClick={(e) => e.stopPropagation()}>
        <span className="flex items-center gap-1.5">szél. <NumField value={o.width} suffix="m" width={62}
          onCommit={(v) => { if (v === null || v < 0.4 || v > edgeLen) return false; onPatch({ width: v, offset: Math.min(Math.max(o.offset, v / 2), edgeLen - v / 2) }); }} /></span>
        <span className="flex items-center gap-1.5">közép <NumField value={o.offset} suffix="m" width={62}
          onCommit={(v) => { if (v === null || v < o.width / 2 || v > edgeLen - o.width / 2) return false; onPatch({ offset: v }); }} /></span>
      </div>
    </div>
  );
}
