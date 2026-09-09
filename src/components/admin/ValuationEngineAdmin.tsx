// Az Értékbecslő motor admin-felülete: csoportosított, magyarázott gombok +
// verziózás (mentés/aktiválás/reset) + száraz próba (dry-run, mentés nélkül).
"use client";

import { useState } from "react";
import { showToast } from "@/components/Toast";
import { type EngineConfig, DEFAULT_ENGINE_CONFIG } from "@/lib/valuation-engine";

type Version = { id: string; version: number; is_active: boolean; note: string | null; created_at: string; params: EngineConfig };

const box: React.CSSProperties = { background: "#fff", border: "1px solid var(--twx-line)", borderRadius: 14, padding: "16px 18px" };
const num = (v: string) => Number(String(v).replace(",", ".")) || 0;

export default function ValuationEngineAdmin({ initialConfig, initialVersions }: { initialConfig: EngineConfig; initialVersions: Version[] }) {
  const [cfg, setCfg] = useState<EngineConfig>(initialConfig);
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [busy, setBusy] = useState(false);
  const active = versions.find((v) => v.is_active);
  const activeVer = active?.version ?? "—";
  const activeDate = active ? new Date(active.created_at).toLocaleString("hu-HU", { dateStyle: "medium", timeStyle: "short" }) : "";
  // Elavult-e az aktív verzió: az állapot-skála kulcsai/értékei eltérnek-e a kód alapértékeitől.
  const defCond = DEFAULT_ENGINE_CONFIG.adjust.condition as Record<string, number>;
  const actCond = (active?.params?.adjust?.condition ?? {}) as Record<string, number>;
  const outdated = !!active && Object.keys(defCond).some((k) => actCond[k] !== defCond[k]);

  // Immutábilis, csoport szintű módosítók.
  const upd = <K extends keyof EngineConfig>(group: K, patch: Partial<EngineConfig[K]>) =>
    setCfg((c) => ({ ...c, [group]: { ...c[group], ...patch } }));
  const updCond = (patch: Partial<EngineConfig["adjust"]["condition"]>) =>
    setCfg((c) => ({ ...c, adjust: { ...c.adjust, condition: { ...c.adjust.condition, ...patch } } }));

  async function api(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/valuation-engine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Hiba.");
      return d;
    } finally { setBusy(false); }
  }

  async function reloadVersions() {
    try {
      const res = await fetch("/api/admin/valuation-engine");
      const d = await res.json();
      if (res.ok) { setVersions(d.versions); setCfg(d.active); }
    } catch { /* csendben */ }
  }

  async function save() {
    try { const d = await api("save", { params: cfg, note: note.trim() || undefined }); showToast(`Mentve és aktiválva (v${d.version}).`, "success"); setNote(""); await reloadVersions(); }
    catch (e) { showToast((e as Error).message, "error"); }
  }
  async function reset() {
    try { const d = await api("reset"); showToast(`Visszaállítva az alapértékre (v${d.version}).`, "success"); await reloadVersions(); }
    catch (e) { showToast((e as Error).message, "error"); }
  }
  async function activate(id: string, v: number) {
    try { await api("activate", { id }); showToast(`A v${v} aktiválva.`, "success"); await reloadVersions(); }
    catch (e) { showToast((e as Error).message, "error"); }
  }
  async function del(id: string, v: number) {
    if (!confirm(`Biztosan törlöd a v${v} verziót? Ez nem vonható vissza.`)) return;
    try { await api("delete", { id }); showToast(`A v${v} törölve.`, "success"); await reloadVersions(); }
    catch (e) { showToast((e as Error).message, "error"); }
  }
  async function rename(id: string, v: number, noteVal: string) {
    try { await api("rename", { id, note: noteVal }); showToast(`A v${v} átnevezve.`, "success"); await reloadVersions(); }
    catch (e) { showToast((e as Error).message, "error"); }
  }
  // Per-sor átnevező mezők (id → szerkesztett érték).
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});

  const [note, setNote] = useState("");

  // --- Száraz próba állapota ---
  const [compsText, setCompsText] = useState("");
  const [dSize, setDSize] = useState("60");
  const [dCond, setDCond] = useState("jó");
  const [dDistrict, setDDistrict] = useState("XIII");
  const [dLoc, setDLoc] = useState("0");
  // Az új (v2) korrekciók bemenetei — enélkül a száraz próba nem mutatná meg őket.
  const [dRooms, setDRooms] = useState("2");
  const [dHalf, setDHalf] = useState("1");
  const [dBaths, setDBaths] = useState("1");
  const [dWc, setDWc] = useState("0");
  const [dBalcony, setDBalcony] = useState("0");
  const [dYear, setDYear] = useState("");
  const [dHeat, setDHeat] = useState<"atlagos" | "modern" | "konvektor" | "tavfutes_atalany">("atlagos");
  const [dFloor, setDFloor] = useState("2");
  const [dLift, setDLift] = useState(true);
  const [dry, setDry] = useState<null | {
    result: { ok: boolean; estimateHuf: number; lowHuf: number; highHuf: number; centralPricePerM2: number; usedCount: number; note: string; steps?: { label: string; deltaPct: number; deltaHuf: number }[] };
    compsParsed: number;
  }>(null);
  async function runDry() {
    try {
      const d = await api("dryrun", {
        params: cfg, compsText,
        subject: {
          sizeM2: num(dSize), condition: dCond, district: dDistrict, isBudapest: true, locationPremiumPct: num(dLoc),
          floorNum: dFloor === "" ? null : num(dFloor), hasLift: dLift, hasBalcony: num(dBalcony) > 0,
          rooms: num(dRooms), halfRooms: num(dHalf), bathrooms: num(dBaths), separateWcs: num(dWc),
          balconyM2: num(dBalcony), buildYear: dYear ? num(dYear) : null, heatingKey: dHeat,
        },
      });
      setDry(d);
    } catch (e) { showToast((e as Error).message, "error"); }
  }
  const ft = (n: number) => `${Math.round(n).toLocaleString("hu-HU")} Ft`;

  // Kis sablon a gomb-sorokhoz.
  const NumRow = ({ label, help, value, onChange, suffix }: { label: string; help: string; value: number; onChange: (n: number) => void; suffix?: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--twx-line)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13 }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--twx-ink-muted)" }}>{help}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <input type="number" value={value} onChange={(e) => onChange(num(e.target.value))} className="twx-input" style={{ width: 96, textAlign: "right" }} />
        {suffix && <span style={{ fontSize: 12, color: "var(--twx-ink-muted)" }}>{suffix}</span>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Fejléc + verzió-sáv */}
      <div style={box} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Értékbecslő motor — beállítások</h1>
          <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Minden gomb egy számítási paraméter.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: outdated ? "#c0392b" : "#1f8f4e" }}>
              Élesben fut: v{activeVer}
            </span>
            {active && (
              <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                {activeDate}{active.note ? ` · ${active.note}` : ""}
              </span>
            )}
            {outdated && (
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: "#fdecea", color: "#c0392b", border: "1px solid #f0b8ab" }}>
                Régi állapot-skála — nyomd meg a „Vissza az alapértékre&rdquo; gombot
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="megjegyzés a verzióhoz (opc.)" className="twx-input" style={{ width: 220 }} />
          <button onClick={reset} disabled={busy} className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>Vissza az alapértékre</button>
          <button onClick={save} disabled={busy} className="rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>Mentés új verzióként</button>
        </div>
      </div>

      {/* Fő kapcsoló */}
      <div style={{ ...box, background: "var(--twx-coral-soft)" }} className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Motor mód</div>
          <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            <b>Ki</b>: a régi AI-becslő fut (jelenlegi működés). <b>Be</b>: a comp-alapú, determinisztikus motor.
          </div>
        </div>
        <select value={cfg.engine.mode} onChange={(e) => upd("engine", { mode: e.target.value as "off" | "on" })} className="twx-input" style={{ width: 120 }}>
          <option value="off">Ki (AI-becslő)</option>
          <option value="on">Be (motor)</option>
        </select>
      </div>

      {/* Comp-szűrés */}
      <div style={box}>
        <div className="text-sm font-semibold">Comp-szűrés</div>
        <div className="mb-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Mely ingatlanok számítanak bele az összehasonlításba.</div>
        <NumRow label="Méret-tűrés" help="Mekkora eltérésű alapterület számít még hasonlónak · alap: 20%" value={cfg.comp.size_tolerance_pct} onChange={(n) => upd("comp", { size_tolerance_pct: n })} suffix="%" />
        <NumRow label="Max hirdetés-kor" help="Ennél régebbi hirdetést nem használ · alap: 6 hó" value={cfg.comp.max_age_months} onChange={(n) => upd("comp", { max_age_months: n })} suffix="hó" />
        <NumRow label="Min. comp-szám" help="Ennyi alatt tágít vagy figyelmeztet · alap: 5" value={cfg.comp.min_count} onChange={(n) => upd("comp", { min_count: n })} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--twx-line)" }}>
          <div><div style={{ fontSize: 13 }}>Csak azonos kerület</div><div style={{ fontSize: 11, color: "var(--twx-ink-muted)" }}>Kerületen kívüli comp kizárása · alap: be</div></div>
          <select value={cfg.comp.same_district_only ? "1" : "0"} onChange={(e) => upd("comp", { same_district_only: e.target.value === "1" })} className="twx-input" style={{ width: 96 }}>
            <option value="1">Be</option><option value="0">Ki</option>
          </select>
        </div>
      </div>

      {/* Outlier + központi ár */}
      <div style={box}>
        <div className="text-sm font-semibold">Kiugró értékek és központi ár</div>
        <div className="mb-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Ez védi ki a „négy jó + egy kilógó” esetet.</div>
        <NumRow label="Outlier sáv" help="A medián ±ennyi %-án kívülit dobja · alap: 25%" value={cfg.outlier.band_pct} onChange={(n) => upd("outlier", { band_pct: n })} suffix="%" />
        <NumRow label="Min. megmaradó" help="Ennyinél kevesebbre nem trimmel · alap: 4" value={cfg.outlier.min_kept} onChange={(n) => upd("outlier", { min_kept: n })} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--twx-line)" }}>
          <div><div style={{ fontSize: 13 }}>Központi ár</div><div style={{ fontSize: 11, color: "var(--twx-ink-muted)" }}>Melyik Ft/m² lesz az alap · alap: medián</div></div>
          <select value={cfg.central.method} onChange={(e) => upd("central", { method: e.target.value as "median" | "weighted" })} className="twx-input" style={{ width: 200 }}>
            <option value="median">Medián (robusztus)</option><option value="weighted">Méret-súlyozott átlag</option>
          </select>
        </div>
      </div>

      {/* Korrekciók + realitás */}
      <div style={box}>
        <div className="text-sm font-semibold">Korrekciók, realitás és kerekítés</div>
        <div className="mb-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Szorzók az állapotra és lokációra, plusz a végső korlátok.</div>
        <NumRow label="Állapot: bontandó / szerkezetkész" help="szorzó · alap: −30%" value={cfg.adjust.condition.bontando} onChange={(n) => updCond({ bontando: n })} suffix="%" />
        <NumRow label="Állapot: felújítandó" help="szorzó · alap: −18%" value={cfg.adjust.condition.felujitando} onChange={(n) => updCond({ felujitando: n })} suffix="%" />
        <NumRow label="Állapot: közepes" help="viszonyítási alap · 0%" value={cfg.adjust.condition.kozepes} onChange={(n) => updCond({ kozepes: n })} suffix="%" />
        <NumRow label="Állapot: jó" help="szorzó · alap: +6%" value={cfg.adjust.condition.jo} onChange={(n) => updCond({ jo: n })} suffix="%" />
        <NumRow label="Állapot: újszerű / felújított" help="szorzó · alap: +14%" value={cfg.adjust.condition.ujszeru} onChange={(n) => updCond({ ujszeru: n })} suffix="%" />
        <NumRow label="Állapot: kiváló / prémium" help="kulcsrakész új építés is · alap: +24%" value={cfg.adjust.condition.premium} onChange={(n) => updCond({ premium: n })} suffix="%" />
        <NumRow label="Extra fürdőszoba" help="az elsőn felül, darabonként · alap: +3%" value={cfg.adjust.extra_bathroom_pct} onChange={(n) => upd("adjust", { extra_bathroom_pct: n })} suffix="%" />
        <NumRow label="Külön WC" help="mellékhelyiség, darabonként · alap: +1,5%" value={cfg.adjust.separate_wc_pct} onChange={(n) => upd("adjust", { separate_wc_pct: n })} suffix="%" />
        <NumRow label="Szoba-sűrűség" help="sok/kevés szoba az alapterülethez (±) · alap: 4%" value={cfg.adjust.room_density_pct} onChange={(n) => upd("adjust", { room_density_pct: n })} suffix="%" />
        <NumRow label="Nagy terasz felára" help="az erkély alapfelárán FELÜL · alap: +3%" value={cfg.adjust.large_terrace_pct} onChange={(n) => upd("adjust", { large_terrace_pct: n })} suffix="%" />
        <NumRow label="Nagy terasz küszöbe" help="ekkora nm felett számít nagynak · alap: 15" value={cfg.adjust.large_terrace_threshold_m2} onChange={(n) => upd("adjust", { large_terrace_threshold_m2: n })} suffix="nm" />
        <NumRow label="Építés: 2010 után" help="alap: +5%" value={cfg.adjust.year_new_pct} onChange={(n) => upd("adjust", { year_new_pct: n })} suffix="%" />
        <NumRow label="Építés: 1980-2010" help="alap: 0%" value={cfg.adjust.year_mid_pct} onChange={(n) => upd("adjust", { year_mid_pct: n })} suffix="%" />
        <NumRow label="Építés: 1980 előtt" help="alap: −4%" value={cfg.adjust.year_old_pct} onChange={(n) => upd("adjust", { year_old_pct: n })} suffix="%" />
        <NumRow label="Fűtés: korszerű" help="hőszivattyú, padlófűtés · alap: +4%" value={cfg.adjust.heating_modern_pct} onChange={(n) => upd("adjust", { heating_modern_pct: n })} suffix="%" />
        <NumRow label="Fűtés: konvektor / elektromos" help="alap: −4%" value={cfg.adjust.heating_convector_pct} onChange={(n) => upd("adjust", { heating_convector_pct: n })} suffix="%" />
        <NumRow label="Fűtés: távfűtés átalánydíjas" help="nem mérhető fogyasztás · alap: −3%" value={cfg.adjust.heating_district_flat_pct} onChange={(n) => upd("adjust", { heating_district_flat_pct: n })} suffix="%" />
        <NumRow label="Lokációs prémium (globális)" help="mikro-lokáció felár/diszkont · alap: 0%" value={cfg.adjust.location_premium_pct} onChange={(n) => upd("adjust", { location_premium_pct: n })} suffix="%" />
        <NumRow label="Földszint" help="földszint / magasföldszint · alap: −3%" value={cfg.adjust.floor_ground_pct} onChange={(n) => upd("adjust", { floor_ground_pct: n })} suffix="%" />
        <NumRow label="Szuterén / alagsor" help="a földszint HELYETT érvényes, erős diszkont · alap: −20%" value={cfg.adjust.floor_basement_pct} onChange={(n) => upd("adjust", { floor_basement_pct: n })} suffix="%" />
        <NumRow label="Magas emelet lift nélkül" help="3.+ emelet lift nélkül · alap: −5%" value={cfg.adjust.floor_high_nolift_pct} onChange={(n) => upd("adjust", { floor_high_nolift_pct: n })} suffix="%" />
        <NumRow label="Lift az épületben" help="felár, ha van lift · alap: +2%" value={cfg.adjust.lift_pct} onChange={(n) => upd("adjust", { lift_pct: n })} suffix="%" />
        <NumRow label="Erkély / terasz" help="felár, ha van erkély · alap: +3%" value={cfg.adjust.balcony_pct} onChange={(n) => upd("adjust", { balcony_pct: n })} suffix="%" />
        <NumRow label="Hirdetési → tranzakciós" help="alku-diszkont a hirdetési árhoz · alap: −7%" value={cfg.realism.asking_to_tx_pct} onChange={(n) => upd("realism", { asking_to_tx_pct: n })} suffix="%" />
        <NumRow label="Korrekciós plafon" help="a lokáció+fotó korrekció max hatása · alap: ±5%" value={cfg.realism.correction_cap_pct} onChange={(n) => upd("realism", { correction_cap_pct: n })} suffix="%" />
        <NumRow label="BP Ft/m² minimum" help="budapesti alsó realitás-küszöb · alap: 1 000 000" value={cfg.realism.bp_min_huf_per_m2} onChange={(n) => upd("realism", { bp_min_huf_per_m2: n })} />
        <NumRow label="Kerekítés lépcső" help="végár kerekítése · alap: 100 000 Ft" value={cfg.rounding.step_huf} onChange={(n) => upd("rounding", { step_huf: n })} />
      </div>

      {/* Száraz próba */}
      <div style={{ ...box, background: "#eef6ff", border: "1px solid #cfe0f5" }}>
        <div className="text-sm font-semibold">Száraz próba — mentés nélkül</div>
        <div className="mb-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Illessz be egy comp-listát (JSON vagy a Perplexity válasza), és nézd meg, a mostani gombokkal mi jönne ki.</div>
        <textarea value={compsText} onChange={(e) => setCompsText(e.target.value)} rows={6} placeholder='{"comps":[{"address":"...","district":"XIII","size_m2":60,"price_huf":92000000,"condition":"jó","listing_date":"2026-06"}]}' className="twx-input w-full" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }} />
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="block"><span className="mb-1 block text-[11px]">Méret (m²)</span><input value={dSize} onChange={(e) => setDSize(e.target.value)} className="twx-input w-full" /></label>
          <label className="block"><span className="mb-1 block text-[11px]">Állapot</span><input value={dCond} onChange={(e) => setDCond(e.target.value)} className="twx-input w-full" /></label>
          <label className="block"><span className="mb-1 block text-[11px]">Kerület</span><input value={dDistrict} onChange={(e) => setDDistrict(e.target.value)} className="twx-input w-full" /></label>
          <label className="block"><span className="mb-1 block text-[11px]">Lok. prémium %</span><input value={dLoc} onChange={(e) => setDLoc(e.target.value)} className="twx-input w-full" /></label>
        </div>
        {/* v2 korrekciók bemenetei */}
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <label className="block"><span className="mb-1 block text-[11px]">Szobák</span><input value={dRooms} onChange={(e) => setDRooms(e.target.value)} className="twx-input w-full" /></label>
          <label className="block"><span className="mb-1 block text-[11px]">Fél szobák</span><input value={dHalf} onChange={(e) => setDHalf(e.target.value)} className="twx-input w-full" /></label>
          <label className="block"><span className="mb-1 block text-[11px]">Fürdőszobák</span><input value={dBaths} onChange={(e) => setDBaths(e.target.value)} className="twx-input w-full" /></label>
          <label className="block"><span className="mb-1 block text-[11px]">Külön WC</span><input value={dWc} onChange={(e) => setDWc(e.target.value)} className="twx-input w-full" /></label>
          <label className="block"><span className="mb-1 block text-[11px]">Erkély / terasz (nm)</span><input value={dBalcony} onChange={(e) => setDBalcony(e.target.value)} className="twx-input w-full" placeholder="0 = nincs" /></label>
          <label className="block"><span className="mb-1 block text-[11px]">Építés éve</span><input value={dYear} onChange={(e) => setDYear(e.target.value)} className="twx-input w-full" placeholder="pl. 1995" /></label>
          <label className="block"><span className="mb-1 block text-[11px]">Fűtés</span>
            <select value={dHeat} onChange={(e) => setDHeat(e.target.value as typeof dHeat)} className="twx-input w-full">
              <option value="atlagos">Átlagos (gázcirkó, távfűtés mérős)</option>
              <option value="modern">Korszerű (hőszivattyú, padlófűtés)</option>
              <option value="konvektor">Konvektor / elektromos</option>
              <option value="tavfutes_atalany">Távfűtés átalánydíjas</option>
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-[11px]">Emelet (0 = fsz.)</span><input value={dFloor} onChange={(e) => setDFloor(e.target.value)} className="twx-input w-full" /></label>
          <label className="flex items-end gap-2 pb-2 text-xs"><input type="checkbox" checked={dLift} onChange={(e) => setDLift(e.target.checked)} /> Van lift</label>
        </div>
        <button onClick={runDry} disabled={busy} className="mt-3 rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{ background: "#1a56c4" }}>Kiszámol</button>
        {dry && (
          <div className="mt-3 rounded-lg p-3 text-sm" style={{ background: "#fff", border: "1px solid #cfe0f5" }}>
            {dry.result.ok ? (
              <>
                <div>Eredmény: <b>{ft(dry.result.estimateHuf)}</b> · sáv {ft(dry.result.lowHuf)} – {ft(dry.result.highHuf)} · {dry.result.centralPricePerM2.toLocaleString("hu-HU")} Ft/m² · {dry.result.usedCount} comp ({dry.compsParsed} beolvasva)</div>
                {/* Levezetés lépésenként — így látszik, melyik korrekció mennyit mozdít. */}
                {dry.result.steps && dry.result.steps.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {dry.result.steps.map((s, i) => (
                      <li key={i}>
                        {s.label}
                        {s.deltaPct ? <b style={{ color: s.deltaPct > 0 ? "#2f9e5f" : "#c0392b" }}> {s.deltaPct > 0 ? "+" : ""}{s.deltaPct}%</b> : null}
                        {s.deltaHuf && s.deltaPct ? <span> · {s.deltaHuf > 0 ? "+" : ""}{ft(s.deltaHuf)}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <span style={{ color: "#c0392b" }}>{dry.result.note} ({dry.compsParsed} comp beolvasva)</span>
            )}
          </div>
        )}
      </div>

      {/* Verziók */}
      <div style={box}>
        <div className="mb-2 text-sm font-semibold">Verziók</div>
        <div className="space-y-1">
          {versions.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ border: "1px solid var(--twx-line)", background: v.is_active ? "var(--twx-coral-soft)" : "#fff" }}>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-sm font-semibold">v{v.version}</span>
                {v.is_active && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: "var(--twx-coral)" }}>aktív</span>}
                {v.is_active ? (
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{v.note || "—"}</span>
                ) : (
                  <input
                    value={renameDraft[v.id] ?? v.note ?? ""}
                    onChange={(e) => setRenameDraft((d) => ({ ...d, [v.id]: e.target.value }))}
                    placeholder="megnevezés…"
                    className="twx-input min-w-0 flex-1 text-xs" style={{ maxWidth: 260 }}
                  />
                )}
                <span className="shrink-0 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{new Date(v.created_at).toLocaleDateString("hu-HU")}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!v.is_active && (renameDraft[v.id] !== undefined && renameDraft[v.id] !== (v.note ?? "")) && (
                  <button onClick={() => rename(v.id, v.version, renameDraft[v.id])} disabled={busy} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>Átnevez</button>
                )}
                {!v.is_active && <button onClick={() => activate(v.id, v.version)} disabled={busy} className="rounded-lg px-3 py-1 text-xs font-semibold" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>Aktiválás</button>}
                {!v.is_active && <button onClick={() => del(v.id, v.version)} disabled={busy} aria-label="Törlés" className="rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ border: "1px solid #f0b8ab", color: "#c0392b", background: "#fff" }}>Törlés</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
