// SupplierFinder — beszállító-kereső blokk (az Alapanyagok & receptek oldal alján).
// Vizuálisan KÜLÖNÁLLÓ, keretezett blokk, a tetején csalogató infósávval, hogy ne
// folyjon össze a fenti árlistával és recept-táblával.
// Árat szándékosan nem kérünk: az a partner és a beszállító megállapodása.
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showToast } from "@/components/Toast";
import { INGREDIENT_CATEGORIES } from "@/lib/recipes";
import {
  COUNTIES, RADIUS_OPTIONS, SUPPLIER_TYPES, SUPPLIER_PLANS, creditsForCount,
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
  const [volume, setVolume] = useState("");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(3);
  const [running, setRunning] = useState(false);

  const [result, setResult] = useState<{ suppliers: Supplier[]; extras: SupplierExtras } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedSearch[]>([]);
  const [openHistory, setOpenHistory] = useState(false);

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
        body: JSON.stringify({ what, county, city, radius, types, volume, notes, count }),
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

  const openSaved = (s: SavedSearch) => {
    setResult({ suppliers: s.results ?? [], extras: s.extras ?? {} });
    setPdfUrl(s.pdf_url);
    setOpenHistory(false);
  };

  return (
    <section
      className="rounded-3xl p-5 sm:p-6"
      style={{ border: "2px solid var(--twx-coral)", background: "var(--twx-cream-card)" }}
    >
      {/* Csalogató infósáv */}
      <div
        className="mb-5 rounded-2xl p-4"
        style={{ background: "var(--twx-coral-soft)", border: "1px solid rgba(239,122,90,0.35)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "#7a2e17" }}>
          Beszállító-kereső
        </p>
        <h2 className="font-display mt-1 text-xl font-semibold" style={{ color: "#7a2e17" }}>
          Találd meg a termelőt, aki olcsóbban és frissebben szállít
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "#7a2e17" }}>
          A legtöbb étterem azért fizet túl az alapanyagért, mert nincs ideje beszállítót keresni. Add meg, mit keresel
          és hol — a Twinx élő webes kutatással összeszedi a környékbeli termelőket, nagykereskedőket és piacokat,
          <b> forrásmegjelöléssel és elérhetőséggel</b>. A végén kapsz egy letölthető PDF-et, benne egy kész megkereső
          üzenettel, amit csak el kell küldened.
        </p>
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
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Mennyiség / gyakoriság</label>
            <input
              value={volume} onChange={(e) => setVolume(e.target.value)}
              placeholder="pl. heti 50 kg"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--twx-line)", background: "#fff" }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              Ebből tudjuk, kistermelő vagy nagyker illik hozzád.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Megye</label>
            <select value={county} onChange={(e) => setCounty(e.target.value)}
              className="mt-1 box-border h-[38px] w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
              {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Település</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="pl. Kecskemét"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Körzet</label>
            <select value={radius} onChange={(e) => setRadius(e.target.value)}
              className="mt-1 box-border h-[38px] w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
              {RADIUS_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
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

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={search} disabled={running}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--twx-coral)" }}>
            {running ? "Keresés folyamatban…" : `Beszállítók keresése (${creditsForCount(count)} kredit)`}
          </button>
          {history.length > 0 && (
            <button onClick={() => setOpenHistory((o) => !o)} className="text-sm font-medium underline"
              style={{ color: "var(--twx-coral)" }}>
              Korábbi kereséseim ({history.length}) — ingyenes
            </button>
          )}
        </div>

        {/* Korábbi keresések */}
        <AnimatePresence initial={false}>
          {openHistory && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}
            >
              <div className="divide-y rounded-xl border" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                {history.map((s) => (
                  <button key={s.id} onClick={() => openSaved(s)}
                    className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm hover:opacity-80">
                    <span>
                      <b>{s.query?.what}</b>{" "}
                      <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                        · {s.query?.county}{s.query?.city ? `, ${s.query.city}` : ""} · {s.results?.length ?? 0} találat
                      </span>
                    </span>
                    <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      {new Date(s.created_at).toLocaleDateString("hu-HU")}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Találatok */}
      {result && (
        <div className="mt-6 space-y-3">
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
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-base font-semibold">{s.name}</span>
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {[s.location, s.distance].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {s.offering && <p className="mt-1 text-sm">{s.offering}</p>}
                {s.why && <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>{s.why}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {s.phone && <span>📞 <a href={`tel:${s.phone}`} className="underline" style={{ color: "var(--twx-coral)" }}>{s.phone}</a></span>}
                  {s.email && <span>✉ <a href={`mailto:${s.email}`} className="underline" style={{ color: "var(--twx-coral)" }}>{s.email}</a></span>}
                  {s.website && <span>🌐 <a href={s.website} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--twx-coral)" }}>weboldal</a></span>}
                </div>
                {s.source && (
                  <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
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
      )}
    </section>
  );
}
