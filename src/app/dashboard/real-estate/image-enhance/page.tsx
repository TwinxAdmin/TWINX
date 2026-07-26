// dashboard/real-estate/image-enhance — Képjavító.
// Két művelet: Feljavítás (fal.ai) és Rendrakás (Nano Banana). Mindkettőre kattintva
// egy ablak nyílik, ahol a tallózás, a feldolgozás és az eredmény is látszik. Az
// elkészült képen egy gombbal rögtön futtatható a MÁSIK művelet (átjátszás).
// Max 4 kép. Dátum-mappák + Kedvencek a korábbi munkákhoz. Nagy nézet: lightbox.
"use client";

import { useEffect, useRef, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import AssetTray from "@/components/AssetTray";
import { showToast } from "@/components/Toast";
import { compressImage } from "@/lib/image-compress";
import {
  ENHANCE_MODES, MAX_IMAGES, ALLOWED_IMAGE_TYPES,
  type EnhanceMode,
} from "@/lib/image-enhance";

type Pick = { file: File; url: string };
type Item = { original: string; enhanced: string };
type Job = { id: string; mode: string; items: Item[]; created_at: string };
type Fav = { id?: string; original: string | null; enhanced: string; mode?: string | null };

const FAV_KEY = "__fav__";
const API = "/api/real-estate/image-enhance";
const dl = (url: string) => `${url}${url.includes("?") ? "&" : "?"}download=twinx-kep.jpg`;
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });
const modeLabel = (m: string) => ENHANCE_MODES.find((x) => x.value === m)?.label ?? m;
const otherMode = (m: EnhanceMode): EnhanceMode => (m === "feljavitas" ? "rendrakas" : "feljavitas");

export default function ImageEnhancePage() {
  // Aktív ablak (melyik művelettel indítottunk); null = nincs nyitva.
  const [session, setSession] = useState<EnhanceMode | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Item[]>([]);
  const [producedMode, setProducedMode] = useState<EnhanceMode | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [history, setHistory] = useState<Job[]>([]);
  const [favs, setFavs] = useState<Fav[]>([]);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ items: Item[]; index: number } | null>(null);
  const [view, setView] = useState<"enhanced" | "original">("enhanced");
  const [assetsReload, setAssetsReload] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [jRes, fRes] = await Promise.all([
          fetch(API),
          fetch(`${API}/favorites`),
        ]);
        const j = await jRes.json();
        const f = await fRes.json();
        if (jRes.ok) setHistory(j.jobs ?? []);
        if (fRes.ok) setFavs(f.favorites ?? []);
      } catch { /* előzmény nélkül is működik */ }
    })();
  }, []);

  // --- Ablak nyitása / zárása ---
  function openSession(m: EnhanceMode) {
    setSession(m);
    setPicks([]);
    setResults([]);
    setProducedMode(null);
  }
  function closeSession() {
    setSession(null);
    setPicks([]);
    setResults([]);
    setProducedMode(null);
  }
  function resetToUpload() {
    setResults([]);
    setProducedMode(null);
    setPicks([]);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => ALLOWED_IMAGE_TYPES.includes(f.type));
    if (!incoming.length) { showToast("Csak JPG, PNG vagy WEBP tölthető fel.", "error"); return; }
    setPicks((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) { showToast(`Legfeljebb ${MAX_IMAGES} kép.`, "info"); return prev; }
      return [...prev, ...incoming.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))];
    });
  }
  const removePick = (i: number) => setPicks((prev) => prev.filter((_, j) => j !== i));

  // Egy feldolgozás lefuttatása a megadott móddal, a megadott fájlokon.
  async function process(m: EnhanceMode, files: File[]): Promise<boolean> {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("mode", m);
      for (const f of files) fd.append("images", await compressImage(f, 1600, 0.85));
      const res = await fetch(API, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? data.errors?.images ?? "A feldolgozás nem sikerült.", "error"); return false; }
      setResults(data.items ?? []);
      setProducedMode(m);
      if (data.job) setHistory((h) => [data.job as Job, ...h]);
      setAssetsReload((n) => n + 1);
      showToast(data.charged ? "Kész! 1 kredit levonva." : "Kész! (ingyenes hozzáférés)", "success");
      return true;
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
      return false;
    } finally {
      setLoading(false);
    }
  }

  // Indítás a feltöltött képekkel.
  async function runInitial() {
    if (!session) return;
    if (!picks.length) { showToast("Tölts fel legalább egy képet.", "error"); return; }
    const ok = await process(session, picks.map((p) => p.file));
    if (ok) setPicks([]);
  }

  // Átjátszás: a MÁSIK műveletet futtatja az elkészült képeken.
  async function runChain() {
    if (!producedMode || !results.length) return;
    const target = otherMode(producedMode);
    setLoading(true);
    let files: File[];
    try {
      files = await Promise.all(results.map(async (it, i) => {
        const r = await fetch(it.enhanced);
        if (!r.ok) throw new Error();
        const blob = await r.blob();
        return new File([blob], `twinx-${i}.jpg`, { type: blob.type || "image/jpeg" });
      }));
    } catch {
      setLoading(false);
      showToast("Nem sikerült betölteni az elkészült képet.", "error");
      return;
    }
    await process(target, files);
  }

  // --- Kedvenc kép (egyenként) ---
  const favSet = new Set(favs.map((f) => f.enhanced));
  const isFav = (it: Item) => favSet.has(it.enhanced);
  const toggleFav = async (it: Item) => {
    if (isFav(it)) {
      setFavs((l) => l.filter((f) => f.enhanced !== it.enhanced));
      try {
        const res = await fetch(`${API}/favorites?enhanced=${encodeURIComponent(it.enhanced)}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        showToast("Eltávolítva a kedvencekből.", "info");
      } catch { setFavs((l) => [{ ...it }, ...l]); showToast("Nem sikerült menteni.", "error"); }
    } else {
      setFavs((l) => [{ ...it }, ...l]);
      try {
        const res = await fetch(`${API}/favorites`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enhanced: it.enhanced, original: it.original, mode: producedMode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error();
        setFavs((l) => l.map((f) => (f.enhanced === it.enhanced ? data.favorite : f)));
        showToast("Kedvencekhez adva.", "success");
      } catch { setFavs((l) => l.filter((f) => f.enhanced !== it.enhanced)); showToast("Nem sikerült menteni.", "error"); }
    }
  };

  // --- Dátum-mappák ---
  const folders = (() => {
    const map = new Map<string, { label: string; items: Item[]; latest: string }>();
    for (const j of history) {
      const key = dayKey(j.created_at);
      const g = map.get(key) ?? { label: dayLabel(j.created_at), items: [], latest: j.created_at };
      g.items.push(...(j.items ?? []));
      if (j.created_at > g.latest) g.latest = j.created_at;
      map.set(key, g);
    }
    return [...map.entries()].map(([key, g]) => ({ key, ...g })).sort((a, b) => (a.latest < b.latest ? 1 : -1));
  })();
  const favItems: Item[] = favs.map((f) => ({ original: f.original ?? f.enhanced, enhanced: f.enhanced }));
  const folderItems = openFolder === FAV_KEY ? favItems : (folders.find((f) => f.key === openFolder)?.items ?? []);
  const folderTitle = openFolder === FAV_KEY ? "Kedvencek" : (folders.find((f) => f.key === openFolder)?.label ?? "");

  const openLightbox = (items: Item[], index: number) => { setView("enhanced"); setLightbox({ items, index }); };
  const step = (d: number) => setLightbox((lb) => lb ? { ...lb, index: (lb.index + d + lb.items.length) % lb.items.length } : lb);

  // Lightbox billentyűk
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const cur = lightbox ? lightbox.items[lightbox.index] : null;

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Ingatlan · Fotó"
        title="Képjavító"
        subtitle="Válaszd a Feljavítást vagy a Rendrakást — a felugró ablakban töltsd fel a fotókat, ott fut le a folyamat, és rögtön látod az eredményt. Az elkészült képen egy gombbal futtathatod a másik műveletet is. Az ingatlanon semmit nem változtatunk. Egy feldolgozás 1 kredit."
        icon="visualization"
        chips={["Feljavítás", "Rendrakás", "Hű a valósághoz"]}
      />

      {/* Két művelet — kattintásra ablak nyílik */}
      <section className="twx-card p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ENHANCE_MODES.map((m) => (
            <button key={m.value} type="button" onClick={() => openSession(m.value)}
              className="rounded-xl p-5 text-left transition hover:shadow-md"
              style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
              <div className="font-display text-lg font-semibold" style={{ color: "var(--twx-ink)" }}>{m.label}</div>
              <div className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{m.desc}</div>
              <span className="mt-3 inline-block text-sm font-medium" style={{ color: "var(--twx-coral)" }}>Indítás →</span>
            </button>
          ))}
        </div>
      </section>

      {/* Közös tálca: korábbi munkák mappákban + kedvencek (kattintásra nagy nézet) */}
      <AssetTray
        onPick={(u) => openLightbox([{ original: u, enhanced: u }], 0)}
        reloadKey={assetsReload}
        note="Válassz egy mappát, majd kattints egy képre a nagy nézethez, letöltéshez vagy kedvencnek jelöléshez."
      />

      {/* Munka-ablak: tallózás → folyamat → eredmény */}
      {session && (
        <div onClick={loading ? undefined : closeSession} className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.5)" }}>
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
              <div className="font-display text-lg font-semibold">
                {producedMode ? `${modeLabel(producedMode)} — kész` : modeLabel(session)}
              </div>
              <button onClick={closeSession} disabled={loading} className="rounded-lg px-2 py-1 text-xl disabled:opacity-40" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              {results.length === 0 ? (
                <>
                  {/* Feltöltő */}
                  <div>
                    <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Fotók ({picks.length}/{MAX_IMAGES})</label>
                    <div
                      onClick={() => inputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                      className="mt-1 cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors"
                      style={{ borderColor: dragOver ? "var(--twx-coral)" : "var(--twx-line)", background: dragOver ? "rgba(239,122,90,0.06)" : "transparent", color: "var(--twx-ink-muted)" }}
                    >
                      Húzd ide a képeket, vagy kattints a tallózáshoz — JPG, PNG, WEBP (max {MAX_IMAGES} kép)
                      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                        onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
                    </div>

                    {picks.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {picks.map((p, i) => (
                          <div key={p.url} className="relative overflow-hidden rounded-lg" style={{ border: "1px solid var(--twx-line)" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt="Feltöltött fotó" className="h-24 w-full object-cover" />
                            <button type="button" onClick={() => removePick(i)} aria-label="Eltávolítás"
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-sm"
                              style={{ background: "rgba(20,12,8,0.6)", color: "#fff" }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={runInitial} disabled={loading || !picks.length}
                    className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: "var(--twx-coral)" }}>
                    {loading ? "Feldolgozás… (néhány másodperc képenként)" : `${modeLabel(session)} indítása (1 kredit)`}
                  </button>
                </>
              ) : (
                <>
                  {/* Eredmény — kis képek, kattintásra nagy nézet */}
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    Kattints egy képre a nagy nézethez (eredeti/feldolgozott, nyilakkal lapozható). Letöltés és kedvenc a nagy nézetben.
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {results.map((it, i) => (
                      <button key={it.enhanced} type="button" onClick={() => openLightbox(results, i)}
                        className="relative overflow-hidden rounded-lg transition hover:opacity-90" style={{ border: "1px solid var(--twx-coral)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.enhanced} alt="Eredmény" className="h-28 w-full object-cover" />
                        {isFav(it) && (
                          <span className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "rgba(20,12,8,0.5)" }}>
                            <StarIcon filled />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Átjátszás: a másik művelet az elkészült képen */}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button onClick={runChain} disabled={loading || !producedMode}
                      className="flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ background: "var(--twx-coral)" }}>
                      {loading
                        ? "Feldolgozás…"
                        : producedMode
                          ? `${modeLabel(otherMode(producedMode))} ezen a képen (1 kredit)`
                          : ""}
                    </button>
                    <button onClick={resetToUpload} disabled={loading}
                      className="rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                      style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink)" }}>
                      Új képek
                    </button>
                  </div>
                  <p className="text-center text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    A kép hű marad a valósághoz — publikálás előtt érdemes átnézni.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox — nagy nézet, eredeti/feldolgozott, nyilakkal lapozás */}
      {cur && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[70] flex flex-col" style={{ background: "rgba(12,11,10,0.9)" }}>
          <div className="flex items-center justify-between gap-3 p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex overflow-hidden rounded-full" style={{ border: "1px solid rgba(255,255,255,0.35)" }}>
              {(["original", "enhanced"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 text-sm font-medium"
                  style={view === v ? { background: "var(--twx-coral)", color: "#1c1005" } : { color: "#fff" }}>
                  {v === "original" ? "Eredeti" : "Feldolgozott"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>{lightbox!.index + 1} / {lightbox!.items.length}</span>
              <button onClick={() => toggleFav(cur)} aria-label="Kedvenc" className="flex h-9 w-9 items-center justify-center rounded-full" style={{ border: "1px solid rgba(255,255,255,0.35)" }}>
                <StarIcon filled={isFav(cur)} light />
              </button>
              <a href={dl(cur.enhanced)} download="twinx-kep.jpg" onClick={(e) => e.stopPropagation()}
                className="rounded-full px-4 py-2 text-sm font-medium" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>Letöltés</a>
              <button onClick={() => setLightbox(null)} aria-label="Bezár" className="flex h-9 w-9 items-center justify-center rounded-full text-lg" style={{ border: "1px solid rgba(255,255,255,0.35)", color: "#fff" }}>×</button>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 py-4" onClick={() => setLightbox(null)}>
            {lightbox!.items.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Előző"
                className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full text-2xl" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>‹</button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={view === "enhanced" ? cur.enhanced : cur.original} alt="Nagy nézet" onClick={(e) => e.stopPropagation()}
              className="rounded-lg object-contain" style={{ maxHeight: "calc(100vh - 96px)", maxWidth: "100%" }} />
            {lightbox!.items.length > 1 && (
              <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Következő"
                className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full text-2xl" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>›</button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function StarIcon({ filled, light }: { filled?: boolean; light?: boolean }) {
  const color = light ? "#fff" : "var(--twx-coral)";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="1.6" strokeLinejoin="round"
      fill={filled ? color : "none"} stroke={color} aria-hidden>
      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.3 6.2 21.4l1.1-6.5L2.6 10l6.5-.9L12 3Z" />
    </svg>
  );
}
