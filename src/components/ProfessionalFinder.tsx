// ProfessionalFinder — Szakember-kereső (közös, iparág prop). A beszállító-kereső
// mintájára: gazdag szűrő-űrlap → Perplexity keresés → találatok csillaggal (egy-egy
// szakember a Kedvencek közé), kategória-mappák (szakmánként) az előzményhez, PDF.
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showToast } from "@/components/Toast";
import SelectField from "@/components/SelectField";
import {
  COUNTIES, RADIUS_OPTIONS, EMPLOYMENT_TYPES, WORK_ARRANGEMENTS, EXPERIENCE_LEVELS,
  AVAILABILITY_OPTIONS, LANGUAGE_OPTIONS, RATE_PERIODS, ratePeriodLabel, PROFESSIONAL_PLANS,
  detailFieldsFor,
  professionsForTrack, professionLabel, creditsForCount,
  type Industry, type Professional, type ProfessionalExtras,
} from "@/lib/professionals";

type SavedSearch = {
  id: string;
  industry: Industry;
  query: { profession: string; professionCustom?: string; county: string; city: string; radius: string; count: number };
  results: Professional[];
  extras: ProfessionalExtras;
  pdf_url: string | null;
  created_at: string;
};
type FavPro = Professional & { id?: string; source_what?: string | null };

const FAV_KEY = "__fav__";
const favKey = (name: string) => name.trim().toLowerCase();

export default function ProfessionalFinder({ industry }: { industry: Industry }) {
  // Két fő mód: "finder" = online elérhető szolgáltatók keresése; "recruit" = toborzás
  // (egyéni alkalmazottak — később kidolgozzuk).
  const [tab, setTab] = useState<"finder" | "recruit">("finder");

  // A szakmalista a fül szerint vált: "finder" = online elérhető szolgáltatók,
  // "recruit" = egyéni alkalmazottak (toborzás). Mindkettő teljes, részletes űrlappal.
  const professions = [...professionsForTrack(industry, tab)].sort((a, b) => a.label.localeCompare(b.label, "hu"));
  // Toborzás fül csak ott, ahol van egyéni (recruit) szakma — pl. vendéglátás; ingatlannál nincs.
  const hasRecruit = professionsForTrack(industry, "recruit").length > 0;

  const [profession, setProfession] = useState(professions[0]?.value ?? "");
  const [professionCustom, setProfessionCustom] = useState("");
  const [county, setCounty] = useState("Pest");
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState("50");
  const [employment, setEmployment] = useState("barmelyik");
  const [arrangement, setArrangement] = useState("");   // egy érték (legördülő)
  const [experience, setExperience] = useState("");
  const [availability, setAvailability] = useState("");
  const [language, setLanguage] = useState("");         // egy érték (legördülő)
  const [rateAmount, setRateAmount] = useState("");     // szám
  const [ratePeriod, setRatePeriod] = useState("ho");   // időszak (óra/nap/hét/hó)
  // Szakma-specifikus RÉSZLETES szempontok (a lenyíló keresőben, szakma szerint változik).
  const [details, setDetails] = useState<Record<string, string | string[]>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [customCriteria, setCustomCriteria] = useState<string[]>([]); // a partner saját szempontjai
  const [customInput, setCustomInput] = useState("");
  const [count, setCount] = useState(3);
  const [running, setRunning] = useState(false);

  const [result, setResult] = useState<{ professionals: Professional[]; extras: ProfessionalExtras } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedSearch[]>([]);
  const [favs, setFavs] = useState<FavPro[]>([]);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [viewSearch, setViewSearch] = useState<SavedSearch | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [hRes, fRes] = await Promise.all([
          fetch(`/api/professionals?industry=${industry}`),
          fetch(`/api/professional-favorites?industry=${industry}`),
        ]);
        const h = await hRes.json();
        const f = await fRes.json();
        if (hRes.ok) setHistory(h.searches ?? []);
        if (fRes.ok) setFavs(f.favorites ?? []);
      } catch { /* előzmény nélkül is működik */ }
    })();
  }, [industry]);

  // Fülváltáskor a szakma és a szűrők visszaállnak az adott track első szakmájára.
  useEffect(() => {
    const list = professionsForTrack(industry, tab);
    setProfession(list[0]?.value ?? "");
    setProfessionCustom(""); setDetails({}); setCustomCriteria([]); setCustomInput("");
    setResult(null); setPdfUrl(null);
  }, [tab, industry]);

  const isCustom = !professions.some((p) => p.value === profession);
  // Logikus elrendezés: előbb a legördülő (select) mezők, utána a kattintós (chips) mezők.
  const detailFields = [...detailFieldsFor(profession)].sort((a, b) =>
    a.type === b.type ? 0 : a.type === "select" ? -1 : 1
  );

  const search = async () => {
    if (isCustom && !professionCustom.trim()) { showToast("Add meg a keresett szakmát.", "error"); return; }
    setRunning(true);
    setResult(null); setPdfUrl(null);
    try {
      const rate = rateAmount.trim() ? `${rateAmount.trim()} ${ratePeriodLabel(ratePeriod)}` : "";
      const res = await fetch("/api/professionals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry, profession, professionCustom, county, city, radius, employment,
          arrangement: arrangement ? [arrangement] : [],
          experience, availability,
          languages: language ? [language] : [],
          rate,
          details,
          customCriteria,
          count,
        }),
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

  // --- Kedvenc szakember (egyenként) ---------------------------------------
  const favSet = new Set(favs.map((f) => favKey(f.name)));
  const isFav = (s: Professional) => favSet.has(favKey(s.name));
  const toggleFav = async (s: Professional, sourceWhat?: string) => {
    if (isFav(s)) {
      setFavs((l) => l.filter((f) => favKey(f.name) !== favKey(s.name)));
      try {
        const res = await fetch(`/api/professional-favorites?name=${encodeURIComponent(s.name)}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        showToast("Eltávolítva a kedvencekből.", "info");
      } catch {
        setFavs((l) => [{ ...s, source_what: sourceWhat ?? null }, ...l]);
        showToast("Nem sikerült menteni.", "error");
      }
    } else {
      setFavs((l) => [{ ...s, source_what: sourceWhat ?? null }, ...l]);
      try {
        const res = await fetch("/api/professional-favorites", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...s, industry, source_what: sourceWhat ?? null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        setFavs((l) => l.map((f) => (favKey(f.name) === favKey(s.name) ? data.favorite : f)));
        showToast("Kedvencekhez adva.", "success");
      } catch {
        setFavs((l) => l.filter((f) => favKey(f.name) !== favKey(s.name)));
        showToast("Nem sikerült menteni.", "error");
      }
    }
  };

  // --- Előzmény kategória (szakma) szerint ----------------------------------
  const norm = (v: string) => v.trim().toLowerCase();
  const labelOf = (s: SavedSearch) =>
    s.query.profession === "egyeb" ? (s.query.professionCustom || "Egyéb") : professionLabel(industry, s.query.profession);
  const categories = (() => {
    const map = new Map<string, { label: string; items: SavedSearch[] }>();
    for (const s of history) {
      const label = labelOf(s);
      const key = norm(label);
      const g = map.get(key) ?? { label, items: [] };
      g.items.push(s);
      map.set(key, g);
    }
    return [...map.entries()]
      .map(([key, g]) => ({ key, label: g.label, items: g.items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)), latest: g.items.reduce((m, x) => (x.created_at > m ? x.created_at : m), "") }))
      .sort((a, b) => (a.latest < b.latest ? 1 : -1));
  })();
  const folderItems = categories.find((c) => c.key === openFolder)?.items ?? [];
  const folderTitle = categories.find((c) => c.key === openFolder)?.label ?? "";
  const dt = (iso: string) =>
    new Date(iso).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" }) +
    " · " + new Date(iso).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" });


  return (
    <section className="twx-card p-5 sm:p-6">
      {/* Fő módválasztó: Szakember-kereső vs. Toborzás (csak ahol van egyéni szakma) */}
      {hasRecruit && (
      <div className="mb-5 flex gap-2 rounded-xl p-1" style={{ background: "var(--twx-coral-soft)" }}>
        {[
          { id: "finder" as const, label: "Szakember-kereső", desc: "Online elérhető szolgáltatók" },
          { id: "recruit" as const, label: "Toborzás", desc: "Egyéni alkalmazottak" },
        ].map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className="flex-1 rounded-lg px-3 py-2 text-center transition"
            style={tab === t.id
              ? { background: "#fff", boxShadow: "0 1px 4px rgba(20,12,8,0.12)" }
              : { background: "transparent" }}>
            <span className="block text-sm font-semibold" style={{ color: tab === t.id ? "var(--twx-coral)" : "#7a2e17" }}>{t.label}</span>
            <span className="block text-[11px]" style={{ color: "#7a2e17", opacity: 0.75 }}>{t.desc}</span>
          </button>
        ))}
      </div>
      )}

      <div className="space-y-4">
        {tab === "recruit" && (
          <div className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--twx-line)", background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
            <b>Toborzás.</b> Itt egyéni munkatárs profilját állítod össze (séf, szakács, cukrász, felszolgáló, pultos, barista…) a részletes szempontokkal — pontosan azzal a szakmánkénti táblázattal, amit kidolgoztunk. A jelöltek elérésének módja és a kredit-modell még kidolgozás alatt, ezért itt egyelőre nem vonunk kreditet.
          </div>
        )}
        {/* Szakma */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Milyen szakembert keresel?</label>
            <SelectField className="mt-1 w-full" value={profession} onChange={(v) => { setProfession(v); setDetails({}); setCustomCriteria([]); setCustomInput(""); }} searchable
              options={[...professions.map((p) => ({ value: p.value, label: p.label })), { value: "egyeb", label: "Egyéb (beírom)…" }]} />
            {isCustom && (
              <input value={professionCustom} onChange={(e) => setProfessionCustom(e.target.value)}
                placeholder="pl. rendezvényszervező" className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Munkaviszony</label>
            <SelectField className="mt-1 w-full" value={employment} onChange={setEmployment}
              options={EMPLOYMENT_TYPES.map((e) => ({ value: e.value, label: e.label }))} />
          </div>
        </div>

        {/* Terület */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Megye</label>
            <SelectField className="mt-1 w-full" value={county} onChange={setCounty} options={COUNTIES.map((c) => ({ value: c, label: c }))} />
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Település</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="pl. Debrecen"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Körzet</label>
            <SelectField className="mt-1 w-full" value={radius} onChange={setRadius} options={RADIUS_OPTIONS.map((r) => ({ value: r.value, label: r.label }))} />
          </div>
        </div>

        {/* Tapasztalat + elérhetőség + díjazás */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Tapasztalat</label>
            <SelectField className="mt-1 w-full" value={experience} onChange={setExperience} options={EXPERIENCE_LEVELS.map((e) => ({ value: e.value, label: e.label }))} />
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Elérhetőség</label>
            <SelectField className="mt-1 w-full" value={availability} onChange={setAvailability} options={AVAILABILITY_OPTIONS.map((a) => ({ value: a.value, label: a.label }))} />
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Tervezett díjazás (opc.)</label>
            <div className="mt-1 flex gap-2">
              <input inputMode="numeric" value={rateAmount} onChange={(e) => setRateAmount(e.target.value)} placeholder="pl. 450000"
                className="w-28 rounded-lg border px-3 py-2 text-right text-sm" style={{ borderColor: "var(--twx-line)", background: "#fff" }} />
              <SelectField className="flex-1" value={ratePeriod} onChange={setRatePeriod}
                options={RATE_PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
            </div>
          </div>
        </div>

        {/* Foglalkoztatás + nyelvtudás (legördülő) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Foglalkoztatás</label>
            <SelectField className="mt-1 w-full" value={arrangement} onChange={setArrangement}
              options={[{ value: "", label: "Mindegy" }, ...WORK_ARRANGEMENTS.map((a) => ({ value: a.value, label: a.label }))]} />
          </div>
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Nyelvtudás</label>
            <SelectField className="mt-1 w-full" value={language} onChange={setLanguage}
              options={[{ value: "", label: "Mindegy" }, ...LANGUAGE_OPTIONS.map((l) => ({ value: l, label: l[0].toUpperCase() + l.slice(1) }))]} />
          </div>
        </div>

        {/* Részletes keresés — szakma szerint változó, lenyíló. MINDEN szakmánál elérhető:
            a szakmára szabott mezők (ha vannak) + a partner saját szempontjai. */}
        <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
          <button type="button" onClick={() => setDetailsOpen((o) => !o)}
            className="flex w-full items-center justify-between p-3 text-left" style={{ background: "var(--twx-coral-soft)" }}>
            <span className="text-sm font-semibold" style={{ color: "#7a2e17" }}>
              Részletes keresés — {isCustom ? (professionCustom || "egyéni szakma") : professionLabel(industry, profession)}
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-lg transition-transform duration-200"
              style={{ color: "var(--twx-coral)", transform: detailsOpen ? "rotate(45deg)" : "none" }}>+</span>
          </button>
          <AnimatePresence initial={false}>
            {detailsOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
                <div className="space-y-3 p-3">
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Szakmára szabott szempontok — minél többet adsz meg, annál pontosabb a találat.
                  </p>
                  {detailFields.map((f) => (
                    <div key={f.id}>
                      <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{f.label}</label>
                      {f.type === "select" ? (
                        <SelectField className="mt-1 w-full" value={String(details[f.id] ?? "")}
                          onChange={(v) => setDetails((d) => ({ ...d, [f.id]: v }))}
                          options={[{ value: "", label: "Mindegy" }, ...f.options]} />
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-2">
                          {f.options.map((o) => {
                            const arr = (details[f.id] as string[]) ?? [];
                            const on = arr.includes(o.value);
                            return (
                              <button key={o.value} type="button"
                                onClick={() => setDetails((d) => {
                                  const cur = (d[f.id] as string[]) ?? [];
                                  return { ...d, [f.id]: on ? cur.filter((x) => x !== o.value) : [...cur, o.value] };
                                })}
                                className="rounded-full px-3 py-1 text-xs font-medium transition"
                                style={on ? { background: "var(--twx-coral)", color: "#fff" } : { border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)", background: "#fff" }}>
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Saját szempont — bármely szakmánál hozzáadható */}
                  <div className="border-t pt-3" style={{ borderColor: "var(--twx-line)" }}>
                    <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Saját szempont hozzáadása</label>
                    <div className="mt-1 flex gap-2">
                      <input value={customInput} onChange={(e) => setCustomInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = customInput.trim(); if (v) { setCustomCriteria((l) => [...l, v]); setCustomInput(""); } } }}
                        placeholder="pl. dolgozott már hasonló koncepciójú helyen"
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
                          <span key={i} className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs"
                            style={{ background: "var(--twx-coral)", color: "#fff" }}>
                            {c}
                            <button type="button" onClick={() => setCustomCriteria((l) => l.filter((_, j) => j !== i))} aria-label="Törlés" className="text-sm leading-none">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {tab === "finder" ? (
          <>
            {/* Találatszám = kredit */}
            <div>
              <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Hány szakembert keressünk?</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {PROFESSIONAL_PLANS.map((p) => (
                  <button key={p.count} type="button" onClick={() => setCount(p.count)}
                    className="rounded-xl px-4 py-2 text-sm font-medium transition"
                    style={count === p.count ? { background: "var(--twx-coral)", color: "#fff" } : { border: "1px solid var(--twx-line)", color: "var(--twx-ink)", background: "#fff" }}>
                    {p.label} · {p.credits} kredit
                  </button>
                ))}
              </div>
            </div>

            <div>
              <button onClick={search} disabled={running}
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
                {running ? "Keresés folyamatban…" : `Szakemberek keresése (${creditsForCount(count)} kredit)`}
              </button>
            </div>
          </>
        ) : (
          /* Toborzás: a keresés/kredit-logika még kidolgozás alatt */
          <div>
            <button type="button" disabled
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white opacity-60" style={{ background: "var(--twx-coral)" }}>
              Toborzási keresés — hamarosan
            </button>
            <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              A profil összeállítása már működik. A jelöltek elérésének módját és a kredit-modellt a következő lépésben véglegesítjük.
            </p>
          </div>
        )}

        {/* Korábbi keresések — szakma szerinti mappák + Kedvencek */}
        {tab === "finder" && (categories.length > 0 || favs.length > 0) && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Korábbi kereséseim</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {favs.length > 0 && (
                <button onClick={() => setOpenFolder(FAV_KEY)}
                  className="flex flex-col gap-1 rounded-xl border p-4 text-left transition hover:shadow-md"
                  style={{ borderColor: "var(--twx-coral)", background: "var(--twx-coral-soft)" }}>
                  <span className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--twx-coral)" stroke="var(--twx-coral)" strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
                      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21.4l1.1-6.5L2.6 10l6.5-.9L12 3Z" />
                    </svg>
                    <span className="font-display text-sm font-semibold" style={{ color: "#7a2e17" }}>Kedvencek</span>
                  </span>
                  <span className="text-xs" style={{ color: "#7a2e17" }}>{favs.length} szakember</span>
                </button>
              )}
              {categories.map((c) => (
                <button key={c.key} onClick={() => setOpenFolder(c.key)}
                  className="flex flex-col gap-1 rounded-xl border p-4 text-left transition hover:shadow-md"
                  style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                  <span className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" style={{ color: "var(--twx-coral)" }} aria-hidden>
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                    </svg>
                    <span className="font-display text-sm font-semibold capitalize">{c.label}</span>
                  </span>
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{c.items.length} keresés</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Felugró mappa */}
      <AnimatePresence>
        {openFolder && (
          <motion.div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-[padding] duration-300 ${viewSearch ? "lg:pr-[30rem]" : ""}`}
            style={{ background: "rgba(20,12,8,0.45)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpenFolder(null)}>
            <motion.div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
              style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
              initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
                <div>
                  <div className="font-display text-lg font-semibold capitalize">{openFolder === FAV_KEY ? "Kedvencek" : folderTitle}</div>
                  <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {openFolder === FAV_KEY ? `${favs.length} kedvenc szakember` : `${folderItems.length} keresés ebben a szakmában`}
                  </div>
                </div>
                <button onClick={() => setOpenFolder(null)} className="rounded-lg px-2 py-1 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {openFolder === FAV_KEY ? (
                  favs.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs kedvenc szakembered. A találatoknál a csillaggal tehetsz be egyet-egyet.</p>
                  ) : (
                    favs.map((s) => <ProCard key={s.id ?? s.name} s={s} isFav onToggleFav={() => toggleFav(s)} sourceWhat={s.source_what ?? undefined} />)
                  )
                ) : (
                  folderItems.map((s) => (
                    <div key={s.id} className="rounded-xl border p-3" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                      <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{dt(s.created_at)}</div>
                      <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                        {s.query?.county}{s.query?.city ? `, ${s.query.city}` : ""} · {s.results?.length ?? 0} találat
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        <button onClick={() => setViewSearch(s)} className="text-sm font-medium underline" style={{ color: "var(--twx-coral)" }}>Megnyitás</button>
                        {s.pdf_url && <a href={s.pdf_url} target="_blank" rel="noopener noreferrer" download className="text-sm font-medium underline" style={{ color: "var(--twx-ink-muted)" }}>PDF</a>}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
                <button onClick={() => setOpenFolder(null)} className="rounded-xl px-5 py-2 text-sm font-semibold text-white" style={{ background: "var(--twx-coral)" }}>Bezár</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Friss találatok */}
      {tab === "finder" && result && (
        <div className="mt-6">
          <ResultBody result={result} pdfUrl={pdfUrl} isFav={isFav} onToggleFav={(s) => toggleFav(s, isCustom ? professionCustom : professionLabel(industry, profession))} />
        </div>
      )}

      {/* Oldalt nyíló panel */}
      <AnimatePresence>
        {viewSearch && (
          <motion.aside className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-md flex-col overflow-hidden"
            style={{ background: "var(--twx-cream-card)", borderLeft: "1px solid var(--twx-line)", boxShadow: "-18px 0 44px rgba(20,12,8,0.18)" }}
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 32 }}>
            <div className="flex items-start justify-between gap-3 border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
              <div className="min-w-0">
                <div className="font-display text-lg font-semibold capitalize">{labelOf(viewSearch)}</div>
                <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {viewSearch.query?.county}{viewSearch.query?.city ? `, ${viewSearch.query.city}` : ""} · {new Date(viewSearch.created_at).toLocaleDateString("hu-HU")}
                </div>
              </div>
              <button onClick={() => setViewSearch(null)} className="flex-none rounded-lg px-2 py-1 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ResultBody result={{ professionals: viewSearch.results ?? [], extras: viewSearch.extras ?? {} }} pdfUrl={viewSearch.pdf_url}
                isFav={isFav} onToggleFav={(s) => toggleFav(s, labelOf(viewSearch))} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </section>
  );
}

// Egy szakember kártyája — csillaggal (kedvencnek jelöl / levesz).
function ProCard({ s, isFav, onToggleFav, sourceWhat }: {
  s: Professional & { source_what?: string | null }; isFav: boolean; onToggleFav: () => void; sourceWhat?: string;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: isFav ? "var(--twx-coral)" : "var(--twx-line)", background: "#fff" }}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-base font-semibold">{s.name}</p>
        <button onClick={onToggleFav} className="flex-none rounded-lg p-1" aria-label={isFav ? "Kedvenc levétele" : "Kedvencnek jelöl"} title={isFav ? "Kedvenc levétele" : "Kedvencnek jelöl"}>
          <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.6" strokeLinejoin="round" fill={isFav ? "var(--twx-coral)" : "none"} stroke={isFav ? "var(--twx-coral)" : "var(--twx-ink-muted)"}>
            <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21.4l1.1-6.5L2.6 10l6.5-.9L12 3Z" />
          </svg>
        </button>
      </div>
      {[sourceWhat, s.role, s.location, s.distance].filter(Boolean).length > 0 && (
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{[sourceWhat, s.role, s.location, s.distance].filter(Boolean).join(" · ")}</p>
      )}
      {[s.experience && `Tapasztalat: ${s.experience}`, s.availability && `Elérhető: ${s.availability}`, s.rate && `Díjazás: ${s.rate}`].filter(Boolean).length > 0 && (
        <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          {[s.experience && `Tapasztalat: ${s.experience}`, s.availability && `Elérhető: ${s.availability}`, s.rate && `Díjazás: ${s.rate}`].filter(Boolean).join("  ·  ")}
        </p>
      )}
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

function ResultBody({ result, pdfUrl, isFav, onToggleFav }: {
  result: { professionals: Professional[]; extras: ProfessionalExtras };
  pdfUrl: string | null;
  isFav: (s: Professional) => boolean;
  onToggleFav: (s: Professional) => void;
}) {
  return (
    <div className="space-y-3">
      {result.extras.market && (
        <div className="rounded-xl p-3 text-sm" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>{result.extras.market}</div>
      )}
      <h3 className="font-display text-lg font-medium">Találatok ({result.professionals.length})</h3>
      <p className="-mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>A csillaggal egy-egy szakembert a <b>Kedvencek</b> közé tehetsz.</p>
      <div className="space-y-3">
        {result.professionals.map((s, i) => <ProCard key={`${s.name}-${i}`} s={s} isFav={isFav(s)} onToggleFav={() => onToggleFav(s)} />)}
      </div>

      {result.extras.outreach && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Kész megkereső üzenet</h4>
            <button onClick={() => { navigator.clipboard.writeText(result.extras.outreach ?? ""); showToast("Vágólapra másolva.", "info"); }}
              className="text-xs font-medium underline" style={{ color: "var(--twx-coral)" }}>Másolás</button>
          </div>
          <p className="whitespace-pre-wrap text-sm">{result.extras.outreach}</p>
        </div>
      )}

      {result.extras.tips?.length ? (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
          <h4 className="mb-2 text-sm font-semibold">Kiválasztási tippek</h4>
          <ul className="space-y-1 text-sm">{result.extras.tips.map((t, i) => <li key={i}>• {t}</li>)}</ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download className="rounded-xl px-5 py-2.5 text-sm font-semibold" style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>PDF letöltése</a>
        )}
        <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Az elérhetőségek nyilvános forrásokból származnak — megkeresés előtt érdemes ellenőrizni.</span>
      </div>
    </div>
  );
}
