// dashboard/real-estate/image-enhance — Képjavító.
// Két művelet: Feljavítás (fal.ai) és Rendrakás (Nano Banana). Mindkettőre kattintva
// egy ablak nyílik, ahol a tallózás, a feldolgozás és az eredmény is látszik. Az
// elkészült képen egy gombbal rögtön futtatható a MÁSIK művelet (átjátszás).
// Max 4 kép. Dátum-mappák + Kedvencek a korábbi munkákhoz. Nagy nézet: lightbox.
"use client";

import { useEffect, useRef, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import AssetTray, { readTwxDragUrl } from "@/components/AssetTray";
import { WorkIcon, WorkChips, WORK_META, type WorkKind } from "@/components/WorkBadge";
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
// Képenként ennyi ingyenes utójavítás jár.
const MAX_FREE_FIX = 1;

export default function ImageEnhancePage() {
  // Aktív ablak (melyik művelettel indítottunk); null = nincs nyitva.
  const [session, setSession] = useState<EnhanceMode | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Item[]>([]);
  const [producedMode, setProducedMode] = useState<EnhanceMode | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Melyik mód-kártya fölött húzunk épp egy képet a tálcából.
  const [dropMode, setDropMode] = useState<EnhanceMode | null>(null);
  // A tálcából behúzott, épp feldolgozás alatt lévő képek előnézete.
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  // Módonként előkészített (ráhúzott) képek — a partner indítja a folyamatot.
  const [staged, setStaged] = useState<Record<EnhanceMode, string[]>>({ feljavitas: [], rendrakas: [] });

  const [history, setHistory] = useState<Job[]>([]);
  const [favs, setFavs] = useState<Fav[]>([]);
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ items: Item[]; index: number } | null>(null);
  // A nagy nézetben megjelenő munkatípus-jelölések (url -> milyen munkák mentek végbe).
  const [lightboxBadges, setLightboxBadges] = useState<Record<string, WorkKind[]>>({});
  const [view, setView] = useState<"enhanced" | "original">("enhanced");
  const [assetsReload, setAssetsReload] = useState(0);

  // Jóváhagyás (rendrakás): az eredmény csak elfogadás után kerül az elkészült munkák közé.
  const [pending, setPending] = useState<Item[] | null>(null);
  const [accepted, setAccepted] = useState<Item[]>([]); // már elfogadott képek ebből a körből
  const [reviewIdx, setReviewIdx] = useState(0);
  const [reviewView, setReviewView] = useState<"enhanced" | "original">("enhanced");
  const [regenFor, setRegenFor] = useState<string | null>(null); // original url
  const [regenReason, setRegenReason] = useState("");
  const [regenUsed, setRegenUsed] = useState<string[]>([]);      // ahol már volt ingyenes újragenerálás
  const [busy, setBusy] = useState(false);
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
    setSourcePreview(null);
  }
  function closeSession() {
    setSession(null);
    setPicks([]);
    setResults([]);
    setProducedMode(null);
    setSourcePreview(null);
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
      // Rendrakásnál előbb a partner hagyja jóvá — csak utána mentjük az előzményekbe.
      const needsReview = m === "rendrakas";
      const fd = new FormData();
      fd.append("mode", m);
      if (needsReview) fd.append("defer", "1");
      for (const f of files) fd.append("images", await compressImage(f, 1600, 0.85));
      const res = await fetch(API, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? data.errors?.images ?? "A feldolgozás nem sikerült.", "error"); return false; }
      setProducedMode(m);
      if (needsReview) {
        setPending(data.items ?? []);
        setAccepted([]);
        setReviewIdx(0);
        setReviewView("enhanced");
        setRegenUsed([]);
      } else {
        setResults(data.items ?? []);
        if (data.job) setHistory((h) => [data.job as Job, ...h]);
        setAssetsReload((n) => n + 1);
      }
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

  // Ráhúzott kép előkészítése (nem indul azonnal) — több mappából is gyűjthető.
  function stageUrl(m: EnhanceMode, url: string) {
    setStaged((prev) => {
      const list = prev[m];
      if (list.includes(url)) return prev;
      if (list.length >= MAX_IMAGES) { showToast(`Legfeljebb ${MAX_IMAGES} kép.`, "info"); return prev; }
      return { ...prev, [m]: [...list, url] };
    });
  }
  const unstageUrl = (m: EnhanceMode, url: string) =>
    setStaged((prev) => ({ ...prev, [m]: prev[m].filter((u) => u !== url) }));

  // Az előkészített képekkel indítja a folyamatot.
  async function startStaged(m: EnhanceMode) {
    const urls = staged[m];
    if (!urls.length) { openSession(m); return; }
    openSession(m);
    setSourcePreview(urls[0]);
    setLoading(true);
    try {
      const files = await Promise.all(urls.map(async (u, i) => {
        const r = await fetch(u);
        if (!r.ok) throw new Error();
        const blob = await r.blob();
        return new File([blob], `twinx-korabbi-${i}.jpg`, { type: blob.type || "image/jpeg" });
      }));
      setStaged((prev) => ({ ...prev, [m]: [] }));
      await process(m, files);
    } catch {
      setLoading(false);
      showToast("Nem sikerült betölteni a képeket.", "error");
    }
  }

  // Mentés az elkészült munkák közé (egy vagy több kép).
  async function saveAccepted(items: Item[]) {
    const res = await fetch(`${API}/accept`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: producedMode, items }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.job) setHistory((h) => [data.job as Job, ...h]);
    setAssetsReload((n) => n + 1);
  }

  // Egy kép elfogadása — kikerül a sorból, léphetsz a következőre.
  async function acceptOne(idx: number) {
    if (!pending || !producedMode) return;
    const item = pending[idx];
    setBusy(true);
    try {
      await saveAccepted([item]);
      const rest = pending.filter((_, i) => i !== idx);
      setAccepted((a) => [...a, item]);
      if (rest.length === 0) {
        setResults([...accepted, item]);
        setPending(null);
        showToast("Kész! Minden kép elfogadva.", "success");
      } else {
        setPending(rest);
        setReviewIdx(Math.min(idx, rest.length - 1));
        setReviewView("enhanced");
        showToast("Elfogadva — jöhet a következő.", "success");
      }
    } catch {
      showToast("Nem sikerült elfogadni. Próbáld újra.", "error");
    } finally { setBusy(false); }
  }

  // Az összes hátralévő kép elfogadása egyben.
  async function acceptPending() {
    if (!pending || !producedMode) return;
    setBusy(true);
    try {
      await saveAccepted(pending);
      setResults([...accepted, ...pending]);
      setPending(null);
      showToast("Elfogadva — bekerült az elkészült munkák közé.", "success");
    } catch {
      showToast("Nem sikerült elfogadni. Próbáld újra.", "error");
    } finally { setBusy(false); }
  }

  // Ingyenes újragenerálás (indoklással) — kreditet nem von.
  async function regenerate() {
    if (!pending || !producedMode || regenFor === null) return;
    const idx = pending.findIndex((p) => p.original === regenFor);
    if (idx < 0) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/regenerate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: producedMode, original: pending[idx].original, rejected: pending[idx].enhanced, reason: regenReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPending((prev) => prev ? prev.map((p, i) => (i === idx ? data.item : p)) : prev);
      setRegenUsed((u) => [...u, pending[idx].original]);
      setRegenFor(null); setRegenReason("");
      showToast("Új változat elkészült (ingyenes).", "success");
    } catch {
      showToast("Az újragenerálás nem sikerült.", "error");
    } finally { setBusy(false); }
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

  // Feldolgozott kép -> a hozzá tartozó EREDETI (feltöltött) kép. A tálca csak a kész
  // képek URL-jeit ismeri, az összetartozást az előzményekből és a kedvencekből tudjuk.
  const originalOf = (() => {
    const map = new Map<string, string>();
    for (const j of history) for (const it of (j.items ?? [])) if (it?.enhanced && it?.original) map.set(it.enhanced, it.original);
    for (const f of favs) if (f.enhanced && f.original) map.set(f.enhanced, f.original);
    return (url: string) => map.get(url) ?? url;
  })();

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
          {ENHANCE_MODES.map((m) => {
            const over = dropMode === m.value;
            const list = staged[m.value];
            return (
              <div key={m.value}
                // A korábbi munkákból ráhúzott képek itt gyűlnek — te indítod a folyamatot.
                onDragOver={(e) => { e.preventDefault(); setDropMode(m.value); }}
                onDragLeave={() => setDropMode((cur) => (cur === m.value ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropMode(null);
                  const url = readTwxDragUrl(e.dataTransfer);
                  if (url) stageUrl(m.value, url);
                }}
                className="relative rounded-xl p-5 text-left transition hover:shadow-md"
                style={over
                  ? { background: "var(--twx-coral-soft)", border: "2px dashed var(--twx-coral)", boxShadow: "0 6px 20px rgba(239,122,90,0.20)" }
                  : { background: "#fff", border: "1px solid var(--twx-line)" }}>
                <button type="button" onClick={() => startStaged(m.value)} className="block w-full text-left">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: WORK_META[m.value as WorkKind].soft, color: WORK_META[m.value as WorkKind].color }}>
                      <WorkIcon kind={m.value as WorkKind} size={18} />
                    </span>
                    <div className="font-display text-lg font-semibold" style={{ color: over ? "#7a2e17" : "var(--twx-ink)" }}>{m.label}</div>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{m.desc}</div>
                </button>

                {/* Előkészített képek — apró bélyegképek, egyenként törölhetők */}
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={() => startStaged(m.value)}
                    className="text-sm font-medium" style={{ color: "var(--twx-coral)" }}>
                    {over ? "Engedd el ide" : list.length ? `Indítás (${list.length} kép) →` : "Indítás →"}
                  </button>
                  {list.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      {list.map((u) => (
                        <span key={u} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="" className="h-8 w-10 rounded object-cover" style={{ border: "1px solid var(--twx-line)" }} />
                          <button type="button" aria-label="Eltávolítás" onClick={() => unstageUrl(m.value, u)}
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none shadow"
                            style={{ background: "rgba(20,12,8,0.75)", color: "#fff" }}>×</button>
                        </span>
                      ))}
                    </span>
                  )}
                  {list.length > 0 && (
                    <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{list.length}/{MAX_IMAGES}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Közös tálca: korábbi munkák mappákban + kedvencek (kattintásra nagy nézet) */}
      <AssetTray
        onPick={(u, folderUrls, index, trayBadges) => {
          setLightboxBadges(trayBadges ?? {});
          openLightbox(
            (folderUrls?.length ? folderUrls : [u]).map((x) => ({ original: originalOf(x), enhanced: x })),
            index ?? 0
          );
        }}
        reloadKey={assetsReload}
        note={`Válassz egy mappát, majd kattints egy képre a nagy nézethez — vagy húzz rá képeket (akár több mappából, max ${MAX_IMAGES}) a Feljavítás / Rendrakás kártyára, és te indítod a folyamatot.`}
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
              {results.length === 0 && loading && sourcePreview ? (
                /* A tálcából behúzott kép feldolgozása — látszik, melyik képpel dolgozunk */
                <div className="space-y-3 text-center">
                  <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sourcePreview} alt="Feldolgozás alatt" className="w-full object-cover" style={{ maxHeight: "40vh", opacity: 0.92 }} />
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(20,12,8,0.35)" }}>
                      <span className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                        style={{ background: "rgba(255,255,255,0.95)", color: "var(--twx-ink)" }}>
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        {session ? modeLabel(session) : "Feldolgozás"} folyamatban…
                      </span>
                    </div>
                  </div>
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Néhány másodperc, és kész az eredmény.</p>
                </div>
              ) : results.length === 0 ? (
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

      {/* Jóváhagyó ablak (rendrakás) — lapozható, eredeti/elkészült váltással */}
      {pending && pending.length > 0 && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,0.55)" }}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
              <div>
                <div className="font-display text-lg font-semibold">Nézd át az eredményt</div>
                <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {reviewIdx + 1} / {pending.length} eldöntendő
                  {accepted.length > 0 && ` · ${accepted.length} már elfogadva`}
                  {" "}· elfogadás után kerül az elkészült munkák közé
                </div>
              </div>
              <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Esc: később</span>
            </div>

            <div className="relative flex-1 overflow-y-auto p-4">
              <div className="relative mx-auto w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={reviewView === "enhanced" ? pending[reviewIdx].enhanced : pending[reviewIdx].original}
                  alt="Eredmény"
                  className="mx-auto max-h-[52vh] w-auto rounded-xl object-contain"
                  style={{ border: "1px solid var(--twx-line)" }}
                />
                {/* Jobb felső sarok: milyen munka történt ezen a képen */}
                {producedMode && reviewView === "enhanced" && (
                  <div className="absolute right-2 top-2">
                    <WorkChips kinds={[producedMode as WorkKind]} light />
                  </div>
                )}
                {/* Bal felső sarok: eredeti / elkészült váltás */}
                <div className="absolute left-2 top-2 flex overflow-hidden rounded-full text-xs shadow"
                  style={{ background: "rgba(255,255,255,0.95)", border: "1px solid var(--twx-line)" }}>
                  {(["original", "enhanced"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setReviewView(v)} className="px-3 py-1.5 font-medium"
                      style={reviewView === v ? { background: "var(--twx-coral)", color: "#1c1005" } : { color: "var(--twx-ink)" }}>
                      {v === "original" ? "Eredeti" : "Elkészült"}
                    </button>
                  ))}
                </div>
                {/* Lapozás */}
                {pending.length > 1 && (
                  <>
                    <button type="button" onClick={() => setReviewIdx((i) => (i - 1 + pending.length) % pending.length)} aria-label="Előző"
                      className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-xl shadow"
                      style={{ background: "rgba(255,255,255,0.95)", color: "var(--twx-ink)" }}>‹</button>
                    <button type="button" onClick={() => setReviewIdx((i) => (i + 1) % pending.length)} aria-label="Következő"
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-xl shadow"
                      style={{ background: "rgba(255,255,255,0.95)", color: "var(--twx-ink)" }}>›</button>
                  </>
                )}
              </div>

              {/* Bélyegképek */}
              {pending.length > 1 && (
                <div className="mt-3 flex justify-center gap-2">
                  {pending.map((p, i) => (
                    <button key={p.enhanced + i} type="button" onClick={() => { setReviewIdx(i); setReviewView("enhanced"); }}
                      className="overflow-hidden rounded-lg border-2" style={{ borderColor: i === reviewIdx ? "var(--twx-coral)" : "var(--twx-line)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.enhanced} alt="" className="h-12 w-16 object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Újragenerálás indoklása */}
              {regenFor !== null && (
                <div className="mt-4 rounded-xl p-3" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
                  <label className="block text-xs font-semibold">Mit vegyünk ki még? Sorold fel, mi maradt bent</label>
                  <p className="mt-0.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                    A javítás a most látható képen történik — csak a felsorolt tárgyakat tünteti el, minden más marad.
                  </p>
                  <textarea value={regenReason} onChange={(e) => setRegenReason(e.target.value)} rows={2}
                    className="twx-input mt-1 w-full text-sm" placeholder="pl. cipők a jobb alsó sarokban, virág az asztalon, macskaszállító a székek mellett" />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={regenerate} disabled={busy}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
                      {busy ? "Újragenerálás…" : "Újragenerálás indítása (ingyenes)"}
                    </button>
                    <button type="button" onClick={() => { setRegenFor(null); setRegenReason(""); }} disabled={busy}
                      className="rounded-xl px-4 py-2 text-sm font-medium" style={{ border: "1px solid var(--twx-line)" }}>Mégse</button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
              {/* Erre az egy képre vonatkozó döntés */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => acceptOne(reviewIdx)} disabled={busy}
                  className="flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--twx-coral)" }}>
                  {busy ? "Mentés…" : "Ezt elfogadom"}
                </button>
                {(() => {
                  const used = regenUsed.filter((u) => u === pending[reviewIdx].original).length;
                  const left = MAX_FREE_FIX - used;
                  return (
                    <button type="button" disabled={busy || left <= 0}
                      onClick={() => { setRegenFor(pending[reviewIdx].original); setRegenReason(""); }}
                      className="flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                      style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>
                      {left > 0 ? "Javítást kérek (ingyenes)" : "Az ingyenes javítás felhasználva"}
                    </button>
                  );
                })()}
              </div>
              {/* Az összes hátralévő egyben */}
              {pending.length > 1 && (
                <button type="button" onClick={acceptPending} disabled={busy}
                  className="w-full rounded-xl px-5 py-2 text-xs font-medium disabled:opacity-60"
                  style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink)" }}>
                  Mind a {pending.length} hátralévő kép elfogadása
                </button>
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
            <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={view === "enhanced" ? cur.enhanced : cur.original} alt="Nagy nézet"
                className="rounded-lg object-contain" style={{ maxHeight: "calc(100vh - 96px)", maxWidth: "100%" }} />
              {/* Elvégzett munkák jelölése — elegánsan a kép alsó szélén */}
              {(lightboxBadges[cur.enhanced] ?? []).length > 0 && view === "enhanced" && (
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 rounded-b-lg p-2"
                  style={{ background: "linear-gradient(to top, rgba(12,11,10,0.6), transparent)" }}>
                  <WorkChips kinds={lightboxBadges[cur.enhanced] ?? []} light />
                </div>
              )}
            </div>
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
