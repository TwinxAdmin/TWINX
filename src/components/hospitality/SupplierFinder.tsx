// SupplierFinder — beszállító-kereső blokk (a Beszállító-kereső oldalon).
// Vizuálisan KÜLÖNÁLLÓ, keretezett blokk, a tetején csalogató infósávval, hogy ne
// folyjon össze a fenti árlistával és recept-táblával.
// Árat szándékosan nem kérünk: az a partner és a beszállító megállapodása.
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showToast } from "@/components/Toast";
import SelectField from "@/components/SelectField";
import MultiSelectField from "@/components/MultiSelectField";
import { INGREDIENT_CATEGORIES } from "@/lib/recipes";
import {
  COUNTIES, RADIUS_OPTIONS, SUPPLIER_TYPES, SUPPLIER_PLANS, QTY_UNITS, FREQUENCIES,
  CERTIFICATIONS, ORIGIN_OPTIONS, DELIVERY_MODES, MIN_ORDER_OPTIONS,
  PROCESSING_OPTIONS, SEASON_OPTIONS, RANKING_PRIORITIES, COMMON_NEEDS,
  EU_COUNTRIES, SUPPLIER_TYPES_EU, COMMON_NEEDS_EU,
  creditsForCountPro,
  type Supplier, type SupplierExtras, type SupplierScope,
} from "@/lib/suppliers";

const GOLD = "#d7b155"; // PRO (mély kutatás) kiemelő szín

type SavedSearch = {
  id: string;
  query: { what: string; county: string; city: string; radius: string; count: number; scope?: SupplierScope; country?: string; region?: string };
  results: Supplier[];
  extras: SupplierExtras;
  pdf_url: string | null;
  created_at: string;
};

// Egy kedvenc beszállító (egyenként menthető a találatokból).
type FavSupplier = Supplier & { id?: string; source_what?: string | null };

const FAV_KEY = "__fav__"; // a Kedvencek mappa kulcsa
const favKey = (name: string) => name.trim().toLowerCase(); // azonosság névre
// A Supabase publikus PDF-URL alapból új lapon nyílna; a ?download paraméterrel
// a böngésző EGYBŐL letölti (a sima download attribútum cross-origin nem érvényesül).
const pdfDownloadUrl = (url: string) =>
  `${url}${url.includes("?") ? "&" : "?"}download=twinx-beszallitok.pdf`;

export default function SupplierFinder({ ingredientNames }: { ingredientNames: string[] }) {
  const [scope, setScope] = useState<SupplierScope>("domestic"); // Belföld / Külföld (EU)
  const [what, setWhat] = useState("");
  const [county, setCounty] = useState<string>("Pest");
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState("50");
  const [country, setCountry] = useState("barmelyik"); // EU-ország (alap: bármelyik)
  const [region, setRegion] = useState("");               // EU régió/város
  const [types, setTypes] = useState<string[]>(["ostermelo"]);
  const [qty, setQty] = useState("");
  const [qtyUnit, setQtyUnit] = useState("kg");
  const [frequency, setFrequency] = useState("heti");
  // Bővített szűrők
  const [certifications, setCertifications] = useState<string[]>([]);
  const [origin, setOrigin] = useState("");
  const [deliveryModes, setDeliveryModes] = useState<string[]>([]);
  const [minOrder, setMinOrder] = useState("");
  const [processing, setProcessing] = useState<string[]>([]);
  const [season, setSeason] = useState("");
  const [ranking, setRanking] = useState("megbizhatosag");
  const [needs, setNeeds] = useState<string[]>([]);
  const [customCriteria, setCustomCriteria] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [count, setCount] = useState(3);
  const [pro, setPro] = useState(false);         // PRO (mély kutatás) mód
  const [proStatus, setProStatus] = useState(""); // állapotszöveg a PRO polling alatt
  const [running, setRunning] = useState(false);

  const [result, setResult] = useState<{ suppliers: Supplier[]; extras: SupplierExtras } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedSearch[]>([]);
  const [favSuppliers, setFavSuppliers] = useState<FavSupplier[]>([]); // kedvenc beszállítók
  const [openFolder, setOpenFolder] = useState<string | null>(null); // felugró: egy KATEGÓRIA (vagy Kedvencek)
  const [viewSearch, setViewSearch] = useState<SavedSearch | null>(null); // oldalt nyíló panel

  useEffect(() => {
    (async () => {
      try {
        const [hRes, fRes] = await Promise.all([
          fetch("/api/hospitality/suppliers"),
          fetch("/api/hospitality/supplier-favorites"),
        ]);
        const h = await hRes.json();
        const f = await fRes.json();
        if (hRes.ok) setHistory(h.searches ?? []);
        if (fRes.ok) setFavSuppliers(f.favorites ?? []);
      } catch { /* előzmény nélkül is működik */ }
    })();
  }, []);

  // Hatókör-váltáskor a scope-függő választások visszaállnak (más értékkészlet).
  useEffect(() => {
    setTypes(scope === "eu" ? [] : ["ostermelo"]);
    setNeeds([]); setDeliveryModes([]); setOrigin(""); setSeason("");
    setResult(null); setPdfUrl(null); setProStatus("");
    setOpenFolder(null); setViewSearch(null); // a másik hatókör mappái/keresései záruljanak
  }, [scope]);

  // A korábbi keresések a MOSTANI hatókörhöz tartozzanak (a régi, scope nélküli = belföld).
  const scopedHistory = history.filter((s) => (s.query?.scope ?? "domestic") === scope);

  // A scope szerinti opció-készletek.
  const typeOptions = scope === "eu" ? SUPPLIER_TYPES_EU : SUPPLIER_TYPES;
  const needOptions = scope === "eu" ? COMMON_NEEDS_EU : COMMON_NEEDS;

  // Egy KONKRÉT beszállító kedvenc-állapotának kapcsolása (egy kattintás, ingyenes).
  const favSet = new Set(favSuppliers.map((f) => favKey(f.name)));
  const isFav = (s: Supplier) => favSet.has(favKey(s.name));

  const toggleFavSupplier = async (s: Supplier, sourceWhat?: string) => {
    const on = isFav(s);
    if (on) {
      setFavSuppliers((list) => list.filter((f) => favKey(f.name) !== favKey(s.name)));
      try {
        const res = await fetch(`/api/hospitality/supplier-favorites?name=${encodeURIComponent(s.name)}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        showToast("Eltávolítva a kedvencekből.", "info");
      } catch {
        setFavSuppliers((list) => [{ ...s, source_what: sourceWhat ?? null }, ...list]);
        showToast("Nem sikerült menteni. Próbáld újra.", "error");
      }
    } else {
      setFavSuppliers((list) => [{ ...s, source_what: sourceWhat ?? null }, ...list]);
      try {
        const res = await fetch("/api/hospitality/supplier-favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...s, source_what: sourceWhat ?? null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        setFavSuppliers((list) => list.map((f) => (favKey(f.name) === favKey(s.name) ? data.favorite : f)));
        showToast("Kedvencekhez adva.", "success");
      } catch {
        setFavSuppliers((list) => list.filter((f) => favKey(f.name) !== favKey(s.name)));
        showToast("Nem sikerült menteni. Próbáld újra.", "error");
      }
    }
  };

  const toggleType = (v: string) =>
    setTypes((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  // Egy találat (szinkron vagy PRO-kész) megjelenítése.
  const applyResult = (data: { result?: { suppliers: Supplier[]; extras: SupplierExtras }; pdf_url?: string | null; search?: SavedSearch }) => {
    if (data.result) setResult(data.result);
    setPdfUrl(data.pdf_url ?? null);
    if (data.search) setHistory((h) => [data.search as SavedSearch, ...h]);
  };

  // PRO (async) job pollingja a status végponton, amíg kész vagy hiba nem lesz.
  const pollJob = (jobId: string) => {
    setProStatus("Mély kutatás folyamatban… ez akár 1–2 perc is lehet, nyugodtan várj.");
    const started = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(`/api/hospitality/suppliers/status?job=${encodeURIComponent(jobId)}`);
        const data = await res.json();
        if (data.status === "done") {
          applyResult(data);
          showToast("Mély kutatás kész.", "success");
          setRunning(false); setProStatus("");
          return;
        }
        if (data.status === "failed") {
          showToast(data.error ?? "A PRO keresés nem sikerült.", "error");
          setRunning(false); setProStatus("");
          return;
        }
        if (Date.now() - started > 6 * 60 * 1000) {
          showToast("A kutatás a vártnál tovább tart — később az előzményekben megnézheted.", "info");
          setRunning(false); setProStatus("");
          return;
        }
        setTimeout(tick, 4000);
      } catch {
        setTimeout(tick, 6000); // átmeneti hálózati hiba — próbáljuk újra
      }
    };
    setTimeout(tick, 3000);
  };

  const search = async () => {
    if (!what.trim()) { showToast("Add meg, milyen alapanyagot keresel.", "error"); return; }
    setRunning(true);
    setResult(null); setPdfUrl(null); setProStatus("");
    try {
      const res = await fetch("/api/hospitality/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope, what, county, city, radius, country, region, types, qty, qtyUnit, frequency,
          certifications, origin, deliveryModes, minOrder, processing, season, ranking, needs, customCriteria,
          count, pro,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "A keresés nem sikerült.", "error"); setRunning(false); return; }
      if (data.async && data.jobId) { pollJob(data.jobId); return; } // PRO: running marad a polling végéig
      applyResult(data);
      showToast(data.charged ? `${data.credits} kredit levonva.` : "Keresés kész (ingyenes hozzáférés).", "success");
      setRunning(false);
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
      setRunning(false);
    }
  };

  // A mentett keresés OLDALT nyílik meg (fix panel). A mappa nyitva marad középen,
  // hogy ugyanabból a kategóriából egyből másik keresést is meg lehessen nyitni.
  const openSaved = (s: SavedSearch) => {
    setViewSearch(s);
  };

  // A mentett kereséseket KATEGÓRIÁRA (a keresett alapanyagra) csoportosítjuk; a dátum
  // a mappán belül, keresésenként látszik. A legfrissebb kategória van elöl.
  const norm = (v: string) => v.trim().toLowerCase();
  const categories = (() => {
    const map = new Map<string, { label: string; items: SavedSearch[] }>();
    for (const s of scopedHistory) {
      const label = (s.query?.what ?? "").trim() || "Egyéb";
      const key = norm(label);
      const g = map.get(key) ?? { label, items: [] };
      g.items.push(s);
      map.set(key, g);
    }
    return [...map.entries()]
      .map(([key, g]) => ({
        key,
        label: g.label,
        items: g.items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
        latest: g.items.reduce((m, x) => (x.created_at > m ? x.created_at : m), ""),
      }))
      .sort((a, b) => (a.latest < b.latest ? 1 : -1));
  })();

  // Egy kategória mappájának keresései (a Kedvencek mappát külön kezeljük, mert az
  // beszállítókat mutat, nem kereséseket).
  const folderItems = categories.find((c) => c.key === openFolder)?.items ?? [];
  const folderTitle = categories.find((c) => c.key === openFolder)?.label ?? "";

  const dateTimeLabel = (iso: string) =>
    new Date(iso).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" }) +
    " · " + new Date(iso).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });

  // Hány beszállítót találtunk már UGYANERRE az alapanyagra? (a szerver ezeket kizárja)
  const alreadyFound = (() => {
    const key = what.trim().toLowerCase();
    if (!key) return 0;
    const names = new Set<string>();
    for (const s of scopedHistory) {
      if ((s.query?.what ?? "").trim().toLowerCase() !== key) continue;
      for (const r of s.results ?? []) if (r?.name) names.add(r.name.trim());
    }
    return names.size;
  })();

  return (
    <section className="twx-card p-5 sm:p-6">
      {/* Hatókör: Belföld / Külföld (EU) — külön keresés, külön prompt */}
      <div className="mb-5 flex gap-2 rounded-xl p-1" style={{ background: "var(--twx-coral-soft)" }}>
        {[
          { id: "domestic" as const, label: "Belföldi beszállító", desc: "Magyarországon" },
          { id: "eu" as const, label: "Külföldi (EU)", desc: "Import az EU-ból" },
        ].map((t) => (
          <button key={t.id} type="button" onClick={() => setScope(t.id)}
            className="flex-1 rounded-lg px-3 py-2 text-center transition"
            style={scope === t.id ? { background: "#fff", boxShadow: "0 1px 4px rgba(20,12,8,0.12)" } : { background: "transparent" }}>
            <span className="block text-sm font-semibold" style={{ color: scope === t.id ? "var(--twx-coral)" : "#7a2e17" }}>{t.label}</span>
            <span className="block text-[11px]" style={{ color: "#7a2e17", opacity: 0.75 }}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Űrlap */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Mit keresel?</label>
            <input
              value={what} onChange={(e) => setWhat(e.target.value)} list="supplier-what-options"
              placeholder="pl. burgonya, vagy: Zöldség"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--twx-line)", background: "#fff" }}
            />
            <datalist id="supplier-what-options">
              {INGREDIENT_CATEGORIES.map((c) => <option key={c.value} value={c.label} />)}
              {ingredientNames.map((n) => <option key={n} value={n} />)}
            </datalist>
            <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Egy alapanyagra vagy egész kategóriára is kereshetsz — egy termelő általában többfélét szállít.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Mennyiség és gyakoriság</label>
            <div className="mt-1 flex gap-2">
              <input
                inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="50"
                className="w-20 rounded-lg border px-3 py-2 text-right text-sm"
                style={{ borderColor: "var(--twx-line)", background: "#fff" }}
              />
              <SelectField className="w-24" value={qtyUnit} onChange={setQtyUnit}
                options={QTY_UNITS.map((u) => ({ value: u.value, label: u.label }))} />
              <SelectField className="flex-1" value={frequency} onChange={setFrequency}
                options={FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))} />
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Ebből tudjuk, kistermelő vagy nagyker illik hozzád.
            </p>
          </div>
        </div>

        {scope === "domestic" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Megye</label>
              <SelectField className="mt-1 w-full" value={county} onChange={setCounty}
                options={COUNTIES.map((c) => ({ value: c, label: c }))} />
            </div>
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Település</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="pl. Kecskemét"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
            </div>
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Körzet</label>
              <SelectField className="mt-1 w-full" value={radius} onChange={setRadius}
                options={RADIUS_OPTIONS.map((r) => ({ value: r.value, label: r.label }))} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Ország (EU)</label>
              <SelectField className="mt-1 w-full" value={country} onChange={setCountry}
                options={EU_COUNTRIES.map((c) => ({ value: c.value, label: c.label }))} />
            </div>
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Régió / város (opcionális)</label>
              <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="pl. Campania, Nápoly"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Milyen típusú beszállító?</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {typeOptions.map((t) => {
              const on = types.includes(t.value);
              return (
                <button key={t.value} type="button" onClick={() => toggleType(t.value)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition"
                  style={on
                    ? { background: "var(--twx-coral)", color: "#fff" }
                    : { border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)", background: "#fff" }}>
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Részletes szűrés — előbb legördülők, utána chipek + saját szempont */}
        <div className="rounded-xl p-3" style={{ border: "1px solid var(--twx-line)", background: "rgba(239,122,90,0.03)" }}>
          <p className="mb-2 text-xs font-semibold" style={{ color: "#7a2e17" }}>Részletes szűrés (opcionális)</p>

          {/* Minden szűrő legördülőben — a többértékűeknél checkboxos, több is jelölhető.
              Belföldön extra: Eredet, Szezon, Szállítási mód; EU-nál ezek nem relevánsak. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {scope === "domestic" && (
              <div>
                <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Eredet</label>
                <SelectField className="mt-1 w-full" value={origin} onChange={setOrigin}
                  options={ORIGIN_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Minimum rendelés</label>
              <SelectField className="mt-1 w-full" value={minOrder} onChange={setMinOrder}
                options={MIN_ORDER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
            </div>
            {scope === "domestic" && (
              <div>
                <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Szezon / elérhetőség</label>
                <SelectField className="mt-1 w-full" value={season} onChange={setSeason}
                  options={SEASON_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Rangsorolás (mi a legfontosabb?)</label>
              <SelectField className="mt-1 w-full" value={ranking} onChange={setRanking}
                options={RANKING_PRIORITIES.map((o) => ({ value: o.value, label: o.label }))} />
            </div>
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Tanúsítvány <span style={{ opacity: 0.6 }}>(több is kiválasztható)</span></label>
              <MultiSelectField className="mt-1 w-full" values={certifications} onChange={setCertifications} options={CERTIFICATIONS} placeholder="Mindegy" />
            </div>
            {scope === "domestic" && (
              <div>
                <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Szállítási mód <span style={{ opacity: 0.6 }}>(több is kiválasztható)</span></label>
                <MultiSelectField className="mt-1 w-full" values={deliveryModes} onChange={setDeliveryModes} options={DELIVERY_MODES} placeholder="Mindegy" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Feldolgozottság <span style={{ opacity: 0.6 }}>(több is kiválasztható)</span></label>
              <MultiSelectField className="mt-1 w-full" values={processing} onChange={setProcessing} options={PROCESSING_OPTIONS} placeholder="Mindegy" />
            </div>
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Gyakori igény <span style={{ opacity: 0.6 }}>(több is kiválasztható)</span></label>
              <MultiSelectField className="mt-1 w-full" values={needs} onChange={setNeeds} options={needOptions} placeholder="Mindegy" />
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {/* Saját szempont — bármit hozzáadhatsz */}
            <div className="border-t pt-3" style={{ borderColor: "var(--twx-line)" }}>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Saját szempont hozzáadása</label>
              <div className="mt-1 flex gap-2">
                <input value={customInput} onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = customInput.trim(); if (v) { setCustomCriteria((l) => [...l, v]); setCustomInput(""); } } }}
                  placeholder="pl. rövid szállítási határidő, hűtött szállítás"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
                <button type="button"
                  onClick={() => { const v = customInput.trim(); if (v) { setCustomCriteria((l) => [...l, v]); setCustomInput(""); } }}
                  className="flex-none rounded-lg px-3 py-2 text-sm font-semibold" style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>
                  Hozzáad
                </button>
              </div>
              {customCriteria.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {customCriteria.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs" style={{ background: "var(--twx-coral)", color: "#fff" }}>
                      {c}
                      <button type="button" onClick={() => setCustomCriteria((l) => l.filter((_, j) => j !== i))} aria-label="Törlés" className="text-sm leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Találatszám = kredit + PRO (mély kutatás) — egy sorban */}
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Hány beszállítót keressünk?</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {SUPPLIER_PLANS.map((p) => {
              const on = count === p.count;
              const shown = pro ? p.credits * 2 : p.credits;
              return (
                <button key={p.count} type="button" onClick={() => setCount(p.count)}
                  className="rounded-xl px-4 py-2 text-sm font-medium transition"
                  style={on
                    ? { background: pro ? GOLD : "var(--twx-coral)", color: pro ? "#3a2c07" : "#fff" }
                    : { border: "1px solid var(--twx-line)", color: "var(--twx-ink)", background: "#fff" }}>
                  {p.label} · {shown} kredit
                </button>
              );
            })}

            {/* Elválasztó + PRO kapcsoló, ugyanabban a sorban */}
            <span className="mx-1 hidden h-6 w-px sm:block" style={{ background: "var(--twx-line)" }} aria-hidden />
            <button type="button" role="switch" aria-checked={pro} onClick={() => setPro((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition"
              style={pro
                ? { background: GOLD, color: "#3a2c07", boxShadow: "0 2px 10px rgba(197,160,60,0.45)" }
                : { border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)", background: "#fff" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill={pro ? "#3a2c07" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
                <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21.4l1.1-6.5L2.6 10l6.5-.9L12 3Z" />
              </svg>
              PRO · mély kutatás
            </button>
          </div>

          <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            {pro
              ? "PRO bekapcsolva: a Perplexity legmélyebb kutatása, több forrás — dupla kredit, és 1–2 percig is eltarthat."
              : "A legalaposabb kereséshez kapcsold be a PRO-t (dupla kredit, hosszabb, de sokkal alaposabb)."}
          </p>
        </div>

        {/* Ha ugyanerre már keresett: jelezzük, hogy a korábbiakat kizárva keresünk újakat. */}
        {alreadyFound > 0 && (
          <div className="rounded-xl p-3 text-sm" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
            Erre már kerestél korábban, és <b>{alreadyFound}</b> beszállítót találtunk. Az új keresés ezeket
            <b> kizárja</b>, tehát csak olyanokat hoz, akiket még nem láttál — a korábbiak pedig lent, az adott
            alapanyag mappájában bármikor ingyen visszanézhetők.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={search} disabled={running}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={pro ? { background: GOLD, color: "#3a2c07" } : { background: "var(--twx-coral)", color: "#fff" }}>
            {running
              ? (pro ? "Mély kutatás folyamatban…" : "Keresés folyamatban…")
              : `${pro ? "PRO keresés" : "Beszállítók keresése"} (${creditsForCountPro(count, pro)} kredit)`}
          </button>
          {proStatus && <span className="text-xs" style={{ color: "#7a2e17" }}>{proStatus}</span>}
        </div>

        {/* Korábbi keresések — KATEGÓRIA szerinti mappákban (+ Kedvencek elöl) */}
        {(categories.length > 0 || favSuppliers.length > 0) && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Korábbi kereséseim</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Kedvencek mappa — csak a kedvencnek jelölt BESZÁLLÍTÓK */}
              {favSuppliers.length > 0 && (
                <button onClick={() => setOpenFolder(FAV_KEY)}
                  className="flex flex-col gap-1 rounded-xl border p-4 text-left transition hover:shadow-md"
                  style={{ borderColor: "var(--twx-coral)", background: "var(--twx-coral-soft)" }}>
                  <span className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--twx-coral)" stroke="var(--twx-coral)" strokeWidth="1.4"
                      strokeLinejoin="round" aria-hidden>
                      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21.4l1.1-6.5L2.6 10l6.5-.9L12 3Z" />
                    </svg>
                    <span className="font-display text-sm font-semibold" style={{ color: "#7a2e17" }}>Kedvencek</span>
                  </span>
                  <span className="text-xs" style={{ color: "#7a2e17" }}>{favSuppliers.length} beszállító</span>
                </button>
              )}
              {categories.map((c) => (
                <button key={c.key} onClick={() => setOpenFolder(c.key)}
                  className="flex flex-col gap-1 rounded-xl border p-4 text-left transition hover:shadow-md"
                  style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                  <span className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                      strokeLinejoin="round" style={{ color: "var(--twx-coral)" }} aria-hidden>
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                    </svg>
                    <span className="font-display text-sm font-semibold capitalize">{c.label}</span>
                  </span>
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {c.items.length} keresés · {dateTimeLabel(c.latest).split(" · ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Felugró: egy KATEGÓRIA (vagy a Kedvencek) keresései */}
      <AnimatePresence>
        {openFolder && (
          <motion.div
            // Ha az oldalpanel nyitva van, a mappa a maradék helyre igazodik, hogy ne takarja el.
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-[padding] duration-300 ${
              viewSearch ? "lg:pr-[30rem]" : ""
            }`}
            style={{ background: "rgba(20,12,8,0.45)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpenFolder(null)}
          >
            <motion.div
              className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
              style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
              initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
                <div>
                  <div className="font-display text-lg font-semibold capitalize">
                    {openFolder === FAV_KEY ? "Kedvencek" : folderTitle}
                  </div>
                  <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {openFolder === FAV_KEY
                      ? `${favSuppliers.length} kedvenc beszállító`
                      : `${folderItems.length} keresés ebben a kategóriában`}
                  </div>
                </div>
                <button onClick={() => setOpenFolder(null)} className="rounded-lg px-2 py-1 text-xl"
                  style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {/* KEDVENCEK: konkrét beszállító-kártyák (nem keresések) */}
                {openFolder === FAV_KEY ? (
                  favSuppliers.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                      Még nincs kedvenc beszállítód. A találatoknál a csillaggal tehetsz be egyet-egyet ide.
                    </p>
                  ) : (
                    favSuppliers.map((s) => (
                      <SupplierCard key={s.id ?? s.name} s={s} isFav onToggleFav={() => toggleFavSupplier(s)} sourceWhat={s.source_what ?? undefined} />
                    ))
                  )
                ) : (
                  <>
                    {folderItems.length === 0 && (
                      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Ez a mappa üres.</p>
                    )}
                    {folderItems.map((s) => (
                      <div key={s.id} className="rounded-xl border p-3" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                        <div className="min-w-0">
                          <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{dateTimeLabel(s.created_at)}</span>
                          <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                            {s.query?.county}{s.query?.city ? `, ${s.query.city}` : ""} · {s.results?.length ?? 0} találat
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3">
                          <button onClick={() => openSaved(s)} className="text-sm font-medium underline"
                            style={{ color: "var(--twx-coral)" }}>
                            Megnyitás
                          </button>
                          {s.pdf_url && (
                            <a href={pdfDownloadUrl(s.pdf_url)} download="twinx-beszallitok.pdf"
                              className="text-sm font-medium underline" style={{ color: "var(--twx-ink-muted)" }}>
                              PDF
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="flex justify-end border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
                <button onClick={() => setOpenFolder(null)}
                  className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
                  Bezár
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Találatok — friss keresés eredménye */}
      {result && (
        <div className="mt-6">
          <ResultBody result={result} pdfUrl={pdfUrl} isFav={isFav} onToggleFav={(s) => toggleFavSupplier(s, what)} />
        </div>
      )}

      {/* Mentett keresés — OLDALT nyíló panel (a középső tartalom nem mozdul) */}
      <AnimatePresence>
        {viewSearch && (
          <>
            {/* Nincs saját sötétítés: a napi mappa középen látható és használható marad. */}
            <motion.aside
              className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col overflow-hidden"
              style={{ background: "var(--twx-cream-card)", borderLeft: "1px solid var(--twx-line)", boxShadow: "-18px 0 44px rgba(20,12,8,0.18)" }}
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
            >
              <div className="flex items-start justify-between gap-3 border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
                <div className="min-w-0">
                  <div className="font-display text-lg font-semibold">{viewSearch.query?.what}</div>
                  <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {viewSearch.query?.county}
                    {viewSearch.query?.city ? `, ${viewSearch.query.city}` : ""} ·{" "}
                    {new Date(viewSearch.created_at).toLocaleDateString("hu-HU")}
                  </div>
                </div>
                <button onClick={() => setViewSearch(null)} className="flex-none rounded-lg px-2 py-1 text-xl"
                  style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <ResultBody
                  result={{ suppliers: viewSearch.results ?? [], extras: viewSearch.extras ?? {} }}
                  pdfUrl={viewSearch.pdf_url}
                  isFav={isFav}
                  onToggleFav={(s) => toggleFavSupplier(s, viewSearch.query?.what)}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}

// Kész megkereső üzenet doboza — másolás gombbal (belföld és EU-nyelvek egyaránt).
function OutreachBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <button
          onClick={() => { navigator.clipboard.writeText(text); showToast("Vágólapra másolva.", "info"); }}
          className="flex-none text-xs font-medium underline" style={{ color: "var(--twx-coral)" }}>
          Másolás
        </button>
      </div>
      <p className="whitespace-pre-wrap text-sm">{text}</p>
    </div>
  );
}

// Egy beszállító kártyája — csillaggal (kedvencnek jelöl / levesz egy kattintással).
// Ugyanez jelenik meg a találatoknál és a Kedvencek mappában.
function SupplierCard({
  s, isFav, onToggleFav, sourceWhat,
}: {
  s: Supplier & { source_what?: string | null };
  isFav: boolean;
  onToggleFav: () => void;
  sourceWhat?: string;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: isFav ? "var(--twx-coral)" : "var(--twx-line)", background: "#fff" }}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-base font-semibold">{s.name}</p>
        <button onClick={onToggleFav} className="flex-none rounded-lg p-1"
          aria-label={isFav ? "Kedvenc levétele" : "Kedvencnek jelöl"} title={isFav ? "Kedvenc levétele" : "Kedvencnek jelöl"}>
          <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.6" strokeLinejoin="round"
            fill={isFav ? "var(--twx-coral)" : "none"} stroke={isFav ? "var(--twx-coral)" : "var(--twx-ink-muted)"}>
            <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21.4l1.1-6.5L2.6 10l6.5-.9L12 3Z" />
          </svg>
        </button>
      </div>
      {(s.location || s.distance || sourceWhat) && (
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          {[sourceWhat, s.location, s.distance].filter(Boolean).join(" · ")}
        </p>
      )}
      {s.offering && <p className="mt-1 text-sm">{s.offering}</p>}
      {s.why && <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>{s.why}</p>}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {s.phone && <span>📞 <a href={`tel:${s.phone}`} className="underline" style={{ color: "var(--twx-coral)" }}>{s.phone}</a></span>}
        {s.email && <span>✉ <a href={`mailto:${s.email}`} className="underline" style={{ color: "var(--twx-coral)" }}>{s.email}</a></span>}
        {s.website && <span>🌐 <a href={s.website} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--twx-coral)" }}>weboldal</a></span>}
      </div>
      {s.source && (
        <p className="mt-2 break-all text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Forrás: <a href={s.source} target="_blank" rel="noopener noreferrer" className="underline">{s.source}</a>
        </p>
      )}
    </div>
  );
}

// A találatok megjelenítése — ugyanaz a friss keresésnél és az oldalt nyíló panelben.
function ResultBody({
  result, pdfUrl, isFav, onToggleFav,
}: {
  result: { suppliers: Supplier[]; extras: SupplierExtras };
  pdfUrl: string | null;
  isFav: (s: Supplier) => boolean;
  onToggleFav: (s: Supplier) => void;
}) {
  return (
    <div className="space-y-3">
      {(result.extras.season || result.extras.market) && (
        <div className="rounded-xl p-3 text-sm" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
          {result.extras.season && <p>{result.extras.season}</p>}
          {result.extras.market && <p className="mt-1">{result.extras.market}</p>}
        </div>
      )}

      <h3 className="font-display text-lg font-medium">Találatok ({result.suppliers.length})</h3>
      <p className="-mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
        A csillaggal egy-egy beszállítót a <b>Kedvencek</b> közé tehetsz — nem az egész keresést.
      </p>
      <div className="space-y-3">
        {result.suppliers.map((s, i) => (
          <SupplierCard key={`${s.name}-${i}`} s={s} isFav={isFav(s)} onToggleFav={() => onToggleFav(s)} />
        ))}
      </div>

      {/* Külföld (EU): angol + magyar üzenet külön. Belföld: egy magyar üzenet. */}
      {(result.extras.outreachEn || result.extras.outreachHu) ? (
        <>
          {result.extras.outreachEn && <OutreachBox title="Megkereső üzenet — angol (a beszállítónak)" text={result.extras.outreachEn} />}
          {result.extras.outreachHu && <OutreachBox title="Megkereső üzenet — magyar (a te példányod)" text={result.extras.outreachHu} />}
        </>
      ) : result.extras.outreach ? (
        <OutreachBox title="Kész megkereső üzenet" text={result.extras.outreach} />
      ) : null}

      {result.extras.tips?.length ? (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
          <h4 className="mb-2 text-sm font-semibold">Tárgyalási tippek</h4>
          <ul className="space-y-1 text-sm">
            {result.extras.tips.map((t, i) => <li key={i}>• {t}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {pdfUrl && (
          <a href={pdfDownloadUrl(pdfUrl)} download="twinx-beszallitok.pdf"
            className="rounded-xl px-5 py-2.5 text-sm font-semibold"
            style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>
            PDF letöltése
          </a>
        )}
        <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Az elérhetőségek nyilvános forrásokból származnak — hívás előtt érdemes ellenőrizni őket.
        </span>
      </div>
    </div>
  );
}
