// dashboard/real-estate/image-enhance — Egyszerű képjavító.
// Max 4 ingatlanfotó; a tartalom NEM változik, csak a minőség (mód szerint enyhe
// rendrakással). Eredmény: kis képek → lightbox (bal/jobb nyíl, eredeti/feljavított,
// letöltés, kedvenc). Dátum-mappák + Kedvencek a korábbi munkákhoz.
"use client";

import { useEffect, useRef, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import { showToast } from "@/components/Toast";
import { compressImage } from "@/lib/image-compress";
import {
  ENHANCE_MODES, ENHANCE_OPTIONS, MAX_IMAGES, ALLOWED_IMAGE_TYPES,
  type EnhanceMode, type EnhanceOption,
} from "@/lib/image-enhance";

type Pick = { file: File; url: string };
type Item = { original: string; enhanced: string };
type Job = { id: string; mode: string; items: Item[]; created_at: string };
type Fav = { id?: string; original: string | null; enhanced: string; mode?: string | null };

const FAV_KEY = "__fav__";
const dl = (url: string) => `${url}${url.includes("?") ? "&" : "?"}download=twinx-kep.jpg`;
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" });

export default function ImageEnhancePage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [mode, setMode] = useState<EnhanceMode>("feljavitas");
  const [options, setOptions] = useState<EnhanceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<Item[]>([]);
  const [history, setHistory] = useState<Job[]>([]);
  const [favs, setFavs] = useState<Fav[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ items: Item[]; index: number } | null>(null);
  const [view, setView] = useState<"enhanced" | "original">("enhanced");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [jRes, fRes] = await Promise.all([
          fetch("/api/real-estate/image-enhance"),
          fetch("/api/real-estate/image-enhance/favorites"),
        ]);
        const j = await jRes.json();
        const f = await fRes.json();
        if (jRes.ok) setHistory(j.jobs ?? []);
        if (fRes.ok) setFavs(f.favorites ?? []);
      } catch { /* előzmény nélkül is működik */ }
    })();
  }, []);

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
  const toggleOption = (v: EnhanceOption) =>
    setOptions((prev) => (prev.includes(v) ? prev.filter((o) => o !== v) : [...prev, v]));

  async function run() {
    if (!picks.length) { showToast("Tölts fel legalább egy képet.", "error"); return; }
    setLoading(true);
    setCurrent([]);
    try {
      const fd = new FormData();
      fd.append("mode", mode);
      fd.append("options", JSON.stringify(mode === "feljavitas" ? options : []));
      for (const p of picks) fd.append("images", await compressImage(p.file, 1600, 0.85));
      const res = await fetch("/api/real-estate/image-enhance", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? data.errors?.images ?? "A feldolgozás nem sikerült.", "error"); return; }
      setCurrent(data.items ?? []);
      if (data.job) setHistory((h) => [data.job as Job, ...h]);
      setPicks([]);
      showToast(data.charged ? "Kész! 1 kredit levonva." : "Kész! (ingyenes hozzáférés)", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setLoading(false);
    }
  }

  // --- Kedvenc kép (egyenként) ---
  const favSet = new Set(favs.map((f) => f.enhanced));
  const isFav = (it: Item) => favSet.has(it.enhanced);
  const toggleFav = async (it: Item) => {
    if (isFav(it)) {
      setFavs((l) => l.filter((f) => f.enhanced !== it.enhanced));
      try {
        const res = await fetch(`/api/real-estate/image-enhance/favorites?enhanced=${encodeURIComponent(it.enhanced)}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        showToast("Eltávolítva a kedvencekből.", "info");
      } catch { setFavs((l) => [{ ...it }, ...l]); showToast("Nem sikerült menteni.", "error"); }
    } else {
      setFavs((l) => [{ ...it }, ...l]);
      try {
        const res = await fetch("/api/real-estate/image-enhance/favorites", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enhanced: it.enhanced, original: it.original, mode }),
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
        subtitle="Töltsd fel az ingatlanfotókat, és a Twinx feljavítja a képminőséget — fény, szín, élesség —, opcionálisan a látható rendetlenséget is eltakarítja. Az ingatlanon semmit nem változtatunk: a kép hű marad a valósághoz. Egy feldolgozás 1 kredit."
        icon="visualization"
        chips={["Több kép", "Fény & élesség", "Hű a valósághoz"]}
      />

      <section className="twx-card space-y-5 p-5 sm:p-6">
        {/* Mód-választó */}
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Mit csináljunk a képpel?</label>
          <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ENHANCE_MODES.map((m) => {
              const on = mode === m.value;
              return (
                <button key={m.value} type="button" onClick={() => setMode(m.value)}
                  className="rounded-xl p-4 text-left transition"
                  style={on ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)" } : { background: "#fff", border: "1px solid var(--twx-line)" }}>
                  <div className="font-display text-base font-medium" style={{ color: on ? "#7a2e17" : "var(--twx-ink)" }}>{m.label}</div>
                  <div className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{m.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Feljavítás-opciók — külön bekapcsolható rétegek (csak Feljavítás módban) */}
        {mode === "feljavitas" && (
          <div>
            <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
              Extra opciók <span style={{ color: "var(--twx-ink-muted)" }}>(a képminőség alap-javítása mindig fut)</span>
            </label>
            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ENHANCE_OPTIONS.map((o) => {
                const on = options.includes(o.value);
                return (
                  <button key={o.value} type="button" onClick={() => toggleOption(o.value)}
                    className="flex items-start gap-3 rounded-xl p-3 text-left transition"
                    style={on ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)" } : { background: "#fff", border: "1px solid var(--twx-line)" }}>
                    <span className="mt-0.5 flex h-5 w-9 flex-none items-center rounded-full transition" style={{ background: on ? "var(--twx-coral)" : "var(--twx-line)", padding: 2 }}>
                      <span className="h-4 w-4 rounded-full bg-white transition" style={{ transform: on ? "translateX(16px)" : "translateX(0)" }} />
                    </span>
                    <span>
                      <span className="block text-sm font-medium" style={{ color: on ? "#7a2e17" : "var(--twx-ink)" }}>{o.label}</span>
                      <span className="mt-0.5 block text-xs" style={{ color: "var(--twx-ink-muted)" }}>{o.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Feltöltő */}
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Fotók ({picks.length}/{MAX_IMAGES})</label>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className="mt-1 cursor-pointer rounded-xl border-2 border-dashed p-5 text-center text-sm transition-colors"
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

        <button onClick={run} disabled={loading || !picks.length}
          className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--twx-coral)" }}>
          {loading ? "Feldolgozás… (néhány másodperc képenként)" : "Képek feljavítása (1 kredit)"}
        </button>
        <p className="text-center text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          A feljavított kép hű marad a valósághoz — publikálás előtt érdemes átnézni.
        </p>
      </section>

      {/* Friss eredmény — kis képek, kattintásra lightbox */}
      {current.length > 0 && (
        <section className="twx-card space-y-3 p-5 sm:p-6">
          <h3 className="font-display text-lg font-medium">Eredmény</h3>
          <p className="-mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Kattints egy képre a nagy nézethez (eredeti/feljavított, nyilakkal lapozható).</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {current.map((it, i) => (
              <button key={it.enhanced} type="button" onClick={() => openLightbox(current, i)}
                className="relative overflow-hidden rounded-lg transition hover:opacity-90" style={{ border: "1px solid var(--twx-coral)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.enhanced} alt="Feljavított" className="h-28 w-full object-cover" />
                {isFav(it) && (
                  <span className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "rgba(20,12,8,0.5)" }}>
                    <StarIcon filled />
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Korábbi munkáim — dátum-mappák + Kedvencek */}
      {(folders.length > 0 || favs.length > 0) && (
        <section className="twx-card space-y-2 p-5 sm:p-6">
          <h3 className="mb-1 text-sm font-semibold">Korábbi munkáim</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {favs.length > 0 && (
              <button onClick={() => setOpenFolder(FAV_KEY)}
                className="flex flex-col gap-1 rounded-xl border p-4 text-left transition hover:shadow-md"
                style={{ borderColor: "var(--twx-coral)", background: "var(--twx-coral-soft)" }}>
                <span className="flex items-center gap-2"><StarIcon filled /><span className="font-display text-sm font-semibold" style={{ color: "#7a2e17" }}>Kedvencek</span></span>
                <span className="text-xs" style={{ color: "#7a2e17" }}>{favs.length} kép</span>
              </button>
            )}
            {folders.map((f) => (
              <button key={f.key} onClick={() => setOpenFolder(f.key)}
                className="flex flex-col gap-1 rounded-xl border p-4 text-left transition hover:shadow-md"
                style={{ borderColor: "var(--twx-line)", background: "#fff" }}>
                <span className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" style={{ color: "var(--twx-coral)" }} aria-hidden>
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
                  </svg>
                  <span className="font-display text-sm font-semibold">{f.label}</span>
                </span>
                <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{f.items.length} kép</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Mappa felugró: az adott nap (vagy Kedvencek) képei */}
      {openFolder && (
        <div onClick={() => setOpenFolder(null)} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.45)" }}>
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
              <div className="font-display text-lg font-semibold">{folderTitle}</div>
              <button onClick={() => setOpenFolder(null)} className="rounded-lg px-2 py-1 text-xl" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {folderItems.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs kép ebben a mappában.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {folderItems.map((it, i) => (
                    <button key={it.enhanced + i} type="button" onClick={() => openLightbox(folderItems, i)}
                      className="relative overflow-hidden rounded-lg" style={{ border: "1px solid var(--twx-line)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={it.enhanced} alt="Kép" className="h-24 w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox — nagy nézet, eredeti/feljavított, nyilakkal lapozás */}
      {cur && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[70] flex flex-col" style={{ background: "rgba(12,11,10,0.9)" }}>
          <div className="flex items-center justify-between gap-3 p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex overflow-hidden rounded-full" style={{ border: "1px solid rgba(255,255,255,0.35)" }}>
              {(["original", "enhanced"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className="px-3 py-1.5 text-sm font-medium"
                  style={view === v ? { background: "var(--twx-coral)", color: "#1c1005" } : { color: "#fff" }}>
                  {v === "original" ? "Eredeti" : "Feljavított"}
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
