// SupplierFinder — beszállító-kereső blokk (az Alapanyagok & receptek oldal alján).
// Vizuálisan KÜLÖNÁLLÓ, keretezett blokk, a tetején csalogató infósávval, hogy ne
// folyjon össze a fenti árlistával és recept-táblával.
// Árat szándékosan nem kérünk: az a partner és a beszállító megállapodása.
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showToast } from "@/components/Toast";
import SelectField from "@/components/SelectField";
import { INGREDIENT_CATEGORIES } from "@/lib/recipes";
import {
  COUNTIES, RADIUS_OPTIONS, SUPPLIER_TYPES, SUPPLIER_PLANS, QTY_UNITS, FREQUENCIES, creditsForCount,
  type Supplier, type SupplierExtras,
} from "@/lib/suppliers";

type SavedSearch = {
  id: string;
  query: { what: string; county: string; city: string; radius: string; count: number };
  results: Supplier[];
  extras: SupplierExtras;
  pdf_url: string | null;
  created_at: string;
};

export default function SupplierFinder({ ingredientNames }: { ingredientNames: string[] }) {
  const [what, setWhat] = useState("");
  const [county, setCounty] = useState<string>("Pest");
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState("50");
  const [types, setTypes] = useState<string[]>(["ostermelo"]);
  const [qty, setQty] = useState("");
  const [qtyUnit, setQtyUnit] = useState("kg");
  const [frequency, setFrequency] = useState("heti");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(3);
  const [running, setRunning] = useState(false);

  const [result, setResult] = useState<{ suppliers: Supplier[]; extras: SupplierExtras } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedSearch[]>([]);
  const [openDay, setOpenDay] = useState<string | null>(null);      // felugró: egy nap keresései
  const [viewSearch, setViewSearch] = useState<SavedSearch | null>(null); // oldalt nyíló panel

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/hospitality/suppliers");
        const data = await res.json();
        if (res.ok) setHistory(data.searches ?? []);
      } catch { /* előzmény nélkül is működik */ }
    })();
  }, []);

  const toggleType = (v: string) =>
    setTypes((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const search = async () => {
    if (!what.trim()) { showToast("Add meg, milyen alapanyagot keresel.", "error"); return; }
    setRunning(true);
    setResult(null); setPdfUrl(null);
    try {
      const res = await fetch("/api/hospitality/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ what, county, city, radius, types, qty, qtyUnit, frequency, notes, count }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "A keresés nem sikerült.", "error"); return; }
      setResult(data.result);
      setPdfUrl(data.pdf_url ?? null);
      if (data.search) setHistory((h) => [data.search, ...h]);
      showToast(data.charged ? `${data.credits} kredit levonva.` : "Keresés kész (ingyenes hozzáférés).", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setRunning(false);
    }
  };

  // A mentett keresés OLDALT nyílik meg (fix panel). A napi mappa nyitva marad középen,
  // hogy ugyanabból a napból egyből másik keresést is meg lehessen nyitni.
  const openSaved = (s: SavedSearch) => {
    setViewSearch(s);
  };

  // A mentett kereséseket NAPI mappákba rendezzük (legfrissebb elöl).
  const days = (() => {
    const map = new Map<string, SavedSearch[]>();
    for (const s of history) {
      const day = (s.created_at ?? "").slice(0, 10);
      const arr = map.get(day) ?? [];
      arr.push(s);
      map.set(day, arr);
    }
    return [...map.entries()]
      .map(([day, items]) => ({ day, items }))
      .sort((a, b) => (a.day < b.day ? 1 : -1));
  })();

  const dayLabel = (d: string) =>
    new Date(d).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });

  // Hány beszállítót találtunk már UGYANERRE az alapanyagra? (a szerver ezeket kizárja)
  const alreadyFound = (() => {
    const key = what.trim().toLowerCase();
    if (!key) return 0;
    const names = new Set<string>();
    for (const s of history) {
      if ((s.query?.what ?? "").trim().toLowerCase() !== key) continue;
      for (const r of s.results ?? []) if (r?.name) names.add(r.name.trim());
    }
    return names.size;
  })();

  return (
    <section className="twx-card p-5 sm:p-6">
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

        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Milyen típusú beszállító?</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {SUPPLIER_TYPES.map((t) => {
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

        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Egyedi igény (opcionális)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="pl. bio tanúsítvány, számlaképes, házhoz szállít"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
        </div>

        {/* Találatszám = kredit */}
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Hány beszállítót keressünk?</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {SUPPLIER_PLANS.map((p) => {
              const on = count === p.count;
              return (
                <button key={p.count} type="button" onClick={() => setCount(p.count)}
                  className="rounded-xl px-4 py-2 text-sm font-medium transition"
                  style={on
                    ? { background: "var(--twx-coral)", color: "#fff" }
                    : { border: "1px solid var(--twx-line)", color: "var(--twx-ink)", background: "#fff" }}>
                  {p.label} · {p.credits} kredit
                </button>
              );
            })}
          </div>
        </div>

        {/* Ha ugyanerre már keresett: jelezzük, hogy a korábbiakat kizárva keresünk újakat. */}
        {alreadyFound > 0 && (
          <div className="rounded-xl p-3 text-sm" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
            Erre már kerestél korábban, és <b>{alreadyFound}</b> beszállítót találtunk. Az új keresés ezeket
            <b> kizárja</b>, tehát csak olyanokat hoz, akiket még nem láttál — a korábbiak pedig lent, a dátumos
            mappákban bármikor ingyen visszanézhetők.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={search} disabled={running}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--twx-coral)" }}>
            {running ? "Keresés folyamatban…" : `Beszállítók keresése (${creditsForCount(count)} kredit)`}
          </button>
        </div>

        {/* Korábbi keresések — dátum szerinti mappákban */}
        {days.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Korábbi kereséseim</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {days.map((d) => (
                <button key={d.day} onClick={() => setOpenDay(d.day)}
                  className="flex flex-col gap-1 rounded-xl border p-4 text-left transition hover:shadow-md"
                  style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                  <span className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                      strokeLinejoin="round" style={{ color: "var(--twx-coral)" }} aria-hidden>
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                    </svg>
                    <span className="font-display text-sm font-semibold">{dayLabel(d.day)}</span>
                  </span>
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {d.items.length} keresés
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Felugró: egy nap keresései */}
      <AnimatePresence>
        {openDay && (
          <motion.div
            // Ha az oldalpanel nyitva van, a mappa a maradék helyre igazodik, hogy ne takarja el.
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-[padding] duration-300 ${
              viewSearch ? "lg:pr-[30rem]" : ""
            }`}
            style={{ background: "rgba(20,12,8,0.45)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpenDay(null)}
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
                  <div className="font-display text-lg font-semibold">{dayLabel(openDay)}</div>
                  <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {days.find((d) => d.day === openDay)?.items.length ?? 0} keresés ezen a napon
                  </div>
                </div>
                <button onClick={() => setOpenDay(null)} className="rounded-lg px-2 py-1 text-xl"
                  style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {(days.find((d) => d.day === openDay)?.items ?? []).map((s) => (
                  <div key={s.id} className="rounded-xl border p-3" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{s.query?.what}</span>
                      <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                        {new Date(s.created_at).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      {s.query?.county}{s.query?.city ? `, ${s.query.city}` : ""} · {s.results?.length ?? 0} találat
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button onClick={() => openSaved(s)} className="text-sm font-medium underline"
                        style={{ color: "var(--twx-coral)" }}>
                        Megnyitás
                      </button>
                      {s.pdf_url && (
                        <a href={s.pdf_url} target="_blank" rel="noopener noreferrer" download
                          className="text-sm font-medium underline" style={{ color: "var(--twx-ink-muted)" }}>
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
                <button onClick={() => setOpenDay(null)}
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
          <ResultBody result={result} pdfUrl={pdfUrl} />
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
                <button onClick={() => setViewSearch(null)} className="rounded-lg px-2 py-1 text-xl"
                  style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <ResultBody
                  result={{ suppliers: viewSearch.results ?? [], extras: viewSearch.extras ?? {} }}
                  pdfUrl={viewSearch.pdf_url}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}

// A találatok megjelenítése — ugyanaz a friss keresésnél és az oldalt nyíló panelben.
function ResultBody({
  result, pdfUrl,
}: { result: { suppliers: Supplier[]; extras: SupplierExtras }; pdfUrl: string | null }) {
  return (
    <div className="space-y-3">
      {(result.extras.season || result.extras.market) && (
        <div className="rounded-xl p-3 text-sm" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
          {result.extras.season && <p>{result.extras.season}</p>}
          {result.extras.market && <p className="mt-1">{result.extras.market}</p>}
        </div>
      )}

      <h3 className="font-display text-lg font-medium">Találatok ({result.suppliers.length})</h3>
      <div className="space-y-3">
        {result.suppliers.map((s, i) => (
          <div key={`${s.name}-${i}`} className="rounded-xl border p-4" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
            <p className="font-display text-base font-semibold">{s.name}</p>
            {(s.location || s.distance) && (
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                {[s.location, s.distance].filter(Boolean).join(" · ")}
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
        ))}
      </div>

      {result.extras.outreach && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Kész megkereső üzenet</h4>
            <button
              onClick={() => { navigator.clipboard.writeText(result.extras.outreach ?? ""); showToast("Vágólapra másolva.", "info"); }}
              className="text-xs font-medium underline" style={{ color: "var(--twx-coral)" }}>
              Másolás
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm">{result.extras.outreach}</p>
        </div>
      )}

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
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download
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
