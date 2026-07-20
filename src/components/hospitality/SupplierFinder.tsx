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

// Egy kedvenc beszállító (egyenként menthető a találatokból).
type FavSupplier = Supplier & { id?: string; source_what?: string | null };

const FAV_KEY = "__fav__"; // a Kedvencek mappa kulcsa
const favKey = (name: string) => name.trim().toLowerCase(); // azonosság névre

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
    for (const s of history) {
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
            <b> kizárja</b>, tehát csak olyanokat hoz, akiket még nem láttál — a korábbiak pedig lent, az adott
            alapanyag mappájában bármikor ingyen visszanézhetők.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={search} disabled={running}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "var(--twx-coral)" }}>
            {running ? "Keresés folyamatban…" : `Beszállítók keresése (${creditsForCount(count)} kredit)`}
          </button>
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
                            <a href={s.pdf_url} target="_blank" rel="noopener noreferrer" download
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
