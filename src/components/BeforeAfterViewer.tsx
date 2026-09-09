// BeforeAfterViewer — előtte/utána képnézegető húzható elválasztóval.
//
// MIÉRT: a partnerek visszajelzése szerint „nem látszik a különbség". Részben
// érzékelési probléma volt: két külön képet egymás után nézve az agy nem tudja
// összevetni őket. Egy csúszka viszont UGYANAZON a helyen mutatja a két
// változatot — így a fény- és színkorrekció azonnal látszik.
//
// Kezelés: húzás egérrel/ujjal, balra-jobbra nyíl a csúszka mozgatásához,
// gombok és a fel/le nyíl a képek közti lapozáshoz.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type BeforeAfterItem = { original: string; enhanced: string };

/**
 * Letöltő link az ELKÉSZÜLT képhez. A Supabase Storage publikus URL-je a
 * `?download=<név>` paraméterre Content-Disposition: attachment fejlécet ad,
 * így a böngésző menti a fájlt, nem megnyitja — a sima `download` attribútum
 * más domainről jövő képnél önmagában nem elég.
 */
function downloadHref(url: string, name: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}`;
}

export default function BeforeAfterViewer({
  items,
  index,
  onIndexChange,
  maxHeight = "52vh",
  badge,
  keyboard = true,
  downloadName = "twinx-kep.jpg",
}: {
  items: BeforeAfterItem[];
  index: number;
  onIndexChange: (i: number) => void;
  /** A kép legnagyobb magassága (CSS érték). */
  maxHeight?: string;
  /** Opcionális jelvény a jobb felső sarokba (pl. mit csináltunk a képpel). */
  badge?: React.ReactNode;
  /** Billentyűkezelés. Kapcsold ki, ha fölötte másik ablak (pl. lightbox) van nyitva,
   *  különben mindkettő reagálna ugyanarra a nyílra. */
  keyboard?: boolean;
  /** A letöltött fájl neve; több képnél sorszámot kap (twinx-kep-2.jpg). */
  downloadName?: string;
}) {
  // A csúszka helye 0–100%: 0 = csak az eredeti, 100 = csak az elkészült.
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const item = items[index];
  const multi = items.length > 1;

  const go = useCallback(
    (delta: number) => {
      if (!multi) return;
      onIndexChange((index + delta + items.length) % items.length);
      setPos(50); // új képnél középről induljon
    },
    [index, items.length, multi, onIndexChange]
  );

  /** A vízszintes egér-/ujjpozícióból számolt csúszka-érték. */
  const setFromClientX = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return;
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  }, []);

  // A húzás az ABLAK szintjén fut, nem a képen: így ha az egér kicsúszik a
  // képből, a csúszka akkor is követi, és felengedésre mindenképp leáll.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: MouseEvent) => setFromClientX(e.clientX);
    const touch = (e: TouchEvent) => {
      if (e.touches[0]) setFromClientX(e.touches[0].clientX);
    };
    const stop = () => setDragging(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchmove", touch, { passive: true });
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchmove", touch);
      window.removeEventListener("touchend", stop);
    };
  }, [dragging, setFromClientX]);

  // Billentyűk: balra/jobbra a csúszka, fel/le a képek között.
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") { setPos((p) => Math.max(0, p - 4)); e.preventDefault(); }
      else if (e.key === "ArrowRight") { setPos((p) => Math.min(100, p + 4)); e.preventDefault(); }
      else if (e.key === "ArrowUp") { go(-1); e.preventDefault(); }
      else if (e.key === "ArrowDown") { go(1); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, keyboard]);

  if (!item) return null;

  // A kiterjesztés a TÉNYLEGES fájlé (a Nano Banana általában PNG-t ad, nem JPG-t),
  // különben a letöltött fájl neve és tartalma nem egyezne.
  const ext = (item.enhanced.split("?")[0].match(/\.(png|jpe?g|webp)$/i)?.[1] ?? "jpg").toLowerCase();
  const base = downloadName.replace(/\.[a-z0-9]+$/i, "");
  const fileName = `${base}${multi ? `-${index + 1}` : ""}.${ext}`;

  return (
    <div className="mx-auto w-full">
      <div
        ref={wrapRef}
        className="relative mx-auto select-none overflow-hidden rounded-xl"
        style={{ border: "1px solid var(--twx-line)", background: "#efe9e0", cursor: dragging ? "ew-resize" : "default" }}
        onMouseDown={(e) => { setDragging(true); setFromClientX(e.clientX); }}
        onTouchStart={(e) => { if (e.touches[0]) { setDragging(true); setFromClientX(e.touches[0].clientX); } }}
      >
        {/* ALSÓ RÉTEG: az elkészült kép — ez adja a doboz méretét is. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.enhanced}
          alt="Elkészült"
          draggable={false}
          className="block w-full object-contain"
          style={{ maxHeight }}
        />

        {/* FELSŐ RÉTEG: az eredeti, balról a csúszkáig kitakarva. A kép ugyanolyan
            méretben fekszik rá, hogy a két változat PONTOSAN fedje egymást. */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.original}
            alt="Eredeti"
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>

        {/* Feliratok a két oldalon */}
        <span
          className="pointer-events-none absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: "rgba(28,24,21,0.72)", color: "#fff", opacity: pos > 12 ? 1 : 0, transition: "opacity .15s" }}
        >
          Eredeti
        </span>
        <span
          className="pointer-events-none absolute bottom-2 right-2 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: "rgba(28,24,21,0.72)", color: "#fff", opacity: pos < 88 ? 1 : 0, transition: "opacity .15s" }}
        >
          Feljavítva
        </span>

        {/* A húzható elválasztó */}
        <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
          <div className="absolute inset-y-0 -ml-px w-0.5" style={{ background: "rgba(255,255,255,0.95)", boxShadow: "0 0 6px rgba(0,0,0,0.45)" }} />
          <div
            className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
            style={{ background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.35)", cursor: "ew-resize" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--twx-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 7-5 5 5 5M15 7l5 5-5 5" />
            </svg>
          </div>
        </div>

        {badge && <div className="absolute right-2 top-2">{badge}</div>}

        {/* Lapozás a képek között */}
        {multi && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Előző kép"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-xl shadow"
              style={{ background: "rgba(255,255,255,0.95)", color: "var(--twx-ink)" }}
            >‹</button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(1); }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Következő kép"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-xl shadow"
              style={{ background: "rgba(255,255,255,0.95)", color: "var(--twx-ink)" }}
            >›</button>
          </>
        )}
      </div>

      {/* Csúszka + rövid használati súgó */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Előtte / utána csúszka"
          className="h-1.5 flex-1 cursor-ew-resize appearance-none rounded-full"
          style={{ background: `linear-gradient(90deg, var(--twx-line) ${pos}%, var(--twx-coral) ${pos}%)` }}
        />
        <button
          type="button"
          onClick={() => setPos(pos > 50 ? 0 : 100)}
          className="rounded-lg px-2.5 py-1 text-[11px] font-semibold"
          style={{ border: "1px solid var(--twx-line)", background: "#fff" }}
        >
          {pos > 50 ? "Eredeti" : "Feljavítva"}
        </button>
        {/* Az ELKÉSZÜLT kép letöltése egy kattintással — mindig az aktuális képé. */}
        <a
          href={downloadHref(item.enhanced, fileName)}
          download={fileName}
          onMouseDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-semibold"
          style={{ background: "var(--twx-coral)", color: "#1c1005" }}
          aria-label="Az elkészült kép letöltése"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Letöltés
        </a>
        {multi && (
          <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
            {index + 1} / {items.length}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
        Húzd a kört az összevetéshez{multi ? " · ↑ ↓ vagy a nyilak a képek között" : ""} · ← → a csúszka
      </p>
    </div>
  );
}
