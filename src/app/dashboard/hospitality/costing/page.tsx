// dashboard/hospitality/costing — Önköltség & profit modul.
// Két fül: (1) Étteremszintű fix költség-profil, (2) Profit kalkulátor: egy induló–záró
// időszakra, kategória-mappákba rendezett ételekkel (beírod az eladott adagot) számolja
// a valós profitot. A bevitel ingyen; a teljes riport (AI + PDF) kredites.
"use client";

import { useEffect, useMemo, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import Skeleton from "@/components/motion/Skeleton";
import { showToast } from "@/components/Toast";
import { categoryLabel, formatHuf, DISH_CATEGORIES, type Dish } from "@/lib/hospitality";
import {
  COST_FIELDS,
  EMPTY_COST_PROFILE,
  costProfileTotal,
  computeCosting,
  toAmount,
  periodDays,
  proratedOverhead,
  type CostProfile,
  type CostingResult,
  type AllocationMethod,
} from "@/lib/costing";

type Tab = "profile" | "profit";

export default function CostingPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [profile, setProfile] = useState<CostProfile>(EMPTY_COST_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [dRes, pRes] = await Promise.all([
          fetch("/api/hospitality/dishes"),
          fetch("/api/hospitality/cost-profile"),
        ]);
        const d = await dRes.json();
        const p = await pRes.json();
        if (dRes.ok) setDishes(d.dishes ?? []);
        if (pRes.ok && p.profile) setProfile(p.profile);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const overhead = costProfileTotal(profile);
  const priced = useMemo(
    () => dishes.filter((d) => d.cost_price != null && d.sale_price != null),
    [dishes]
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Étteremszintű költség" },
    { key: "profit", label: "Profit kalkulátor" },
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <ModuleIntro
        eyebrow="Vendéglátás · Önköltség"
        title="Önköltség & profit"
        subtitle="Kiszámolja egy étel valódi előállítási költségét: az alapanyag mellé rávetíti a fix költségeket (bérlet, bérek, rezsi…) a forgalom szerint. A Profit kalkulátorban egy időszakra beírod, miből mennyi fogyott, és látod a valós profitot. A bevitel ingyenes, a teljes riport kredites."
        icon="cost"
        chips={["Teljes önköltség", "Időszaki profit", "PDF riport"]}
      />

      {/* Fülek */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="rounded-full px-4 py-2 text-sm font-medium transition"
            style={
              tab === t.key
                ? { background: "var(--twx-coral)", color: "#fff" }
                : { background: "var(--twx-cream-card)", color: "var(--twx-ink-muted)", border: "1px solid var(--twx-line)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : tab === "profile" ? (
        <ProfileTab profile={profile} onSaved={setProfile} />
      ) : (
        <ProfitTab priced={priced} overhead={overhead} />
      )}
    </main>
  );
}

// --- Közös input --------------------------------------------------------------
function NumField({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "0"}
      className="w-full rounded-lg border px-3 py-2 text-sm text-right"
      style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
    />
  );
}

// =============================================================================
// 1) Étteremszintű költség-profil
// =============================================================================
function ProfileTab({ profile, onSaved }: { profile: CostProfile; onSaved: (p: CostProfile) => void }) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {};
    for (const f of COST_FIELDS) o[f.key] = profile[f.key] ? String(profile[f.key]) : "";
    return o;
  });
  const [extra, setExtra] = useState<{ label: string; amount: string }[]>(
    () => (profile.extra_items ?? []).map((e) => ({ label: e.label, amount: String(e.amount) }))
  );
  const [saving, setSaving] = useState(false);

  const total =
    COST_FIELDS.reduce((s, f) => s + toAmount(vals[f.key]), 0) +
    extra.reduce((s, e) => s + toAmount(e.amount), 0);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        extra_items: extra
          .map((e) => ({ label: e.label.trim(), amount: toAmount(e.amount) }))
          .filter((e) => e.label && e.amount > 0),
      };
      for (const f of COST_FIELDS) payload[f.key] = toAmount(vals[f.key]);
      const res = await fetch("/api/hospitality/cost-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Mentés sikertelen.", "error"); return; }
      onSaved(data.profile);
      showToast("Költség-profil mentve.", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Add meg az étterem <b>havi</b> fix költségeit. Ezekből számoljuk ki, mennyi rezsi jut egy-egy
        ételre a forgalma szerint (a Profit kalkulátor a választott időszakra arányosítja). Elég egyszer
        beállítani; bármikor frissíthető, és a mentés ingyenes.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {COST_FIELDS.map((f) => (
          <div key={f.key} className="twx-card flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{f.label}</div>
              {f.hint && <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{f.hint}</div>}
            </div>
            <div className="w-36 flex-none">
              <NumField value={vals[f.key] ?? ""} onChange={(v) => setVals((s) => ({ ...s, [f.key]: v }))} />
            </div>
          </div>
        ))}
      </div>

      {/* Egyedi tételek */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Egyedi tételek</h3>
          <button
            onClick={() => setExtra((s) => [...s, { label: "", amount: "" }])}
            className="text-sm font-medium"
            style={{ color: "var(--twx-coral)" }}
          >
            + Tétel hozzáadása
          </button>
        </div>
        {extra.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={e.label}
              onChange={(ev) => setExtra((s) => s.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))}
              placeholder="Megnevezés (pl. szoftver-előfizetés)"
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }}
            />
            <div className="w-32 flex-none">
              <NumField value={e.amount} onChange={(v) => setExtra((s) => s.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
            </div>
            <button
              onClick={() => setExtra((s) => s.filter((_, j) => j !== i))}
              className="flex-none rounded-lg px-2 py-2 text-sm"
              style={{ color: "var(--twx-ink-muted)" }}
              aria-label="Törlés"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4" style={{ background: "var(--twx-coral-soft)" }}>
        <span className="text-sm font-medium" style={{ color: "#7a2e17" }}>Havi összes fix költség</span>
        <span className="font-display text-2xl font-semibold" style={{ color: "#7a2e17" }}>{formatHuf(total)}</span>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--twx-coral)" }}
      >
        {saving ? "Mentés…" : "Költség-profil mentése"}
      </button>
    </div>
  );
}

// =============================================================================
// 2) Profit kalkulátor — időszak + kategória-mappák + kredites riport
// =============================================================================
function ProfitTab({ priced, overhead }: { priced: Dish[]; overhead: number }) {
  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState<string>(today.slice(0, 8) + "01");
  const [end, setEnd] = useState<string>(today);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<AllocationMethod>("revenue");
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const [narrative, setNarrative] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const days = periodDays(start, end);
  const periodOverhead = proratedOverhead(overhead, days);

  // Ételek kategória-mappákba rendezve (csak a nem üres kategóriák).
  const groups = useMemo(
    () =>
      DISH_CATEGORIES.map((c) => ({
        cat: c.value as string,
        label: c.label,
        items: priced.filter((d) => d.category === c.value),
      })).filter((g) => g.items.length),
    [priced]
  );

  const qNum = (id: string) => Math.max(0, Math.floor(Number(qty[id]) || 0));
  const enteredInCat = (items: Dish[]) => items.filter((d) => qNum(d.id) > 0).length;

  // Ingyenes, élő előnézet (kliensoldali számítás az időszakra).
  const preview = useMemo(() => {
    const inputs = priced
      .filter((d) => qNum(d.id) > 0)
      .map((d) => ({
        dish_id: d.id, name: d.name, category: d.category,
        cost_price: d.cost_price as number, sale_price: d.sale_price as number,
        monthly_qty: qNum(d.id),
      }));
    if (!inputs.length || days <= 0) return null;
    return computeCosting(inputs, periodOverhead, method);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priced, qty, periodOverhead, method, days]);

  const toggleCat = (cat: string) =>
    setOpenCats((s) => {
      const n = new Set(s);
      if (n.has(cat)) n.delete(cat); else n.add(cat);
      return n;
    });

  const runReport = async () => {
    const chosen = priced.filter((d) => qNum(d.id) > 0);
    if (!chosen.length) { showToast("Írd be legalább egy ételnél az eladott adagot.", "error"); return; }
    if (days <= 0) { showToast("A záró dátum nem lehet korábbi az indulónál.", "error"); return; }
    setRunning(true);
    try {
      const res = await fetch("/api/hospitality/costing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method, start, end,
          dishes: chosen.map((d) => ({ dish_id: d.id, qty: qNum(d.id) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "A riport lekérése sikertelen.", "error"); return; }
      setNarrative(data.narrative ?? "");
      setPdfUrl(data.pdf_url ?? null);
      showToast(data.charged ? `${data.credits} kredit levonva.` : "Riport kész (ingyenes hozzáférés).", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setRunning(false);
    }
  };

  if (!priced.length) {
    return (
      <div className="twx-card p-5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Nincs árazott ételed. Adj meg előkészítési + eladási árat a Kínálat kezelőben, majd itt kiszámoljuk a valós profitot.
      </div>
    );
  }

  const enteredTotal = priced.filter((d) => qNum(d.id) > 0).length;

  return (
    <div className="space-y-4">
      {overhead === 0 && (
        <div className="twx-card p-3 text-xs" style={{ color: "#b5372f" }}>
          Még nincs havi fix költség megadva az „Étteremszintű költség" fülön — a rezsi-allokáció addig 0. Add meg a fix költségeket a valós önköltséghez.
        </div>
      )}

      <div className="twx-card p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Válaszd ki az <b>időszakot</b>, majd a kategória-mappákban írd be, melyik ételből <b>hány adag</b> fogyott
        ebben az időszakban. A számok itt ingyen frissülnek; a <b>„Riport lekérése"</b> ad teljes, AI-elemzéssel és
        letölthető PDF-fel ellátott elemzést.
      </div>

      {/* Időszak */}
      <div className="twx-card flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Induló dátum</label>
          <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)}
            className="mt-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
        </div>
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Záró dátum</label>
          <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)}
            className="mt-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-cream-card)" }} />
        </div>
        <div className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          {days > 0 ? (
            <>Időszak: <b style={{ color: "var(--twx-ink)" }}>{days} nap</b> · időszaki rezsi: <b style={{ color: "var(--twx-ink)" }}>{formatHuf(periodOverhead)}</b></>
          ) : (
            <span style={{ color: "#b5372f" }}>A záró dátum nem lehet korábbi az indulónál.</span>
          )}
        </div>
      </div>

      {/* Allokáció */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span style={{ color: "var(--twx-ink-muted)" }}>Rezsi szétosztása:</span>
        {([["revenue", "Árbevétel-arányos"], ["unit", "Darab-arányos"]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setMethod(v)}
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={method === v ? { background: "var(--twx-coral)", color: "#fff" } : { border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}
          >
            {l}
          </button>
        ))}
        {enteredTotal > 0 && (
          <span className="ml-auto text-xs" style={{ color: "var(--twx-ink-muted)" }}>{enteredTotal} ételnél van adag megadva</span>
        )}
      </div>

      {/* Kategória-mappák */}
      <div className="space-y-2">
        {groups.map((g) => {
          const open = openCats.has(g.cat);
          const entered = enteredInCat(g.items);
          return (
            <div key={g.cat} className="twx-card overflow-hidden">
              <button
                onClick={() => toggleCat(g.cat)}
                className="flex w-full items-center justify-between gap-3 p-3 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="font-medium">{g.label}</span>
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{g.items.length} étel</span>
                  {entered > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                      {entered} kitöltve
                    </span>
                  )}
                </span>
                <span style={{ color: "var(--twx-ink-muted)", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
              </button>
              {open && (
                <div className="space-y-2 border-t p-3" style={{ borderColor: "var(--twx-line)" }}>
                  {g.items.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="font-medium">{d.name}</span>{" "}
                        <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                          · ár {formatHuf(d.sale_price as number)} · alapanyag {formatHuf(d.cost_price as number)}
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>eladott adag</span>
                        <div className="w-28"><NumField value={qty[d.id] ?? ""} onChange={(v) => setQty((s) => ({ ...s, [d.id]: v }))} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Élő előnézet */}
      {preview && <ResultView result={preview} />}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runReport}
          disabled={running || enteredTotal === 0 || days <= 0}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--twx-coral)" }}
        >
          {running ? "Riport készül…" : "Riport lekérése (1 kredit)"}
        </button>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
            style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            PDF letöltése
          </a>
        )}
      </div>

      {narrative && (
        <div className="twx-card p-5">
          <h3 className="mb-2 font-display text-lg font-medium">AI-elemzés és javaslatok</h3>
          <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: "var(--twx-ink)" }}>{narrative}</div>
        </div>
      )}
    </div>
  );
}

// Számított eredmény megjelenítése (előnézethez és riporthoz is).
function ResultView({ result }: { result: CostingResult }) {
  const t = result.totals;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Időszaki árbevétel" value={formatHuf(t.revenue)} />
        <Stat label="Alapanyagköltség" value={formatHuf(t.ingredientCost)} />
        <Stat label="Rávetített rezsi" value={formatHuf(t.coveredOverhead)} />
        <Stat label="Étterem időszaki profit" value={formatHuf(t.netProfit)} warn={t.netProfit < 0} />
      </div>

      <div className="twx-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--twx-ink-muted)" }} className="text-left">
              <th className="p-3 font-medium">Étel</th>
              <th className="p-3 text-right font-medium">eladott</th>
              <th className="p-3 text-right font-medium">Teljes önktg/adag</th>
              <th className="p-3 text-right font-medium">Valós profit/adag</th>
              <th className="p-3 text-right font-medium">Árrés</th>
              <th className="p-3 text-right font-medium">Időszaki profit</th>
              <th className="p-3 text-right font-medium">Fedezeti db</th>
            </tr>
          </thead>
          <tbody>
            {result.dishes.map((d) => (
              <tr key={d.dish_id} style={{ borderTop: "1px solid var(--twx-line)" }}>
                <td className="p-3 font-medium">{d.name}</td>
                <td className="p-3 text-right">{d.monthly_qty}</td>
                <td className="p-3 text-right">{formatHuf(d.fullUnitCost)}</td>
                <td className="p-3 text-right" style={{ color: d.unitProfit < 0 ? "#b5372f" : "var(--twx-ink)" }}>{formatHuf(d.unitProfit)}</td>
                <td className="p-3 text-right" style={{ color: d.unitMarginPct < 0 ? "#b5372f" : "var(--twx-ink)" }}>{Math.round(d.unitMarginPct)}%</td>
                <td className="p-3 text-right" style={{ color: d.monthlyProfit < 0 ? "#b5372f" : "var(--twx-ink)" }}>{formatHuf(d.monthlyProfit)}</td>
                <td className="p-3 text-right">{d.breakevenQty} db</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
        A „teljes önköltség/adag" az alapanyag + a rá jutó időszaki rezsi egy adagra vetítve. A „fedezeti db" az a
        darabszám, ami az ételre eső időszaki rezsit fedezi.
      </p>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="twx-card p-4">
      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{label}</p>
      <p className="font-display text-xl font-semibold" style={{ color: warn ? "#b5372f" : "var(--twx-ink)" }}>{value}</p>
    </div>
  );
}
