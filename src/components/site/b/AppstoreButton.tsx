"use client";
// Hero harmadik gombja: „TWINX AI" (korábban „AI-Appstore", Márk kérése 2026-11-28) + felugró magyarázó ablak (Márk kérése 2026-11-28).
// - A gomb a megjelenésében pulzál (réz peremfény + belső ragyogás, ~3 mp), a mérete nem változik (globals.css: .b-glow-btn).
// - Az ablak a hero-videó hangulatához illik: elsötétített, elmosott háttér; sötétbarna, áttetsző felület réz peremmel.
//   Beúszás ~480 ms (áttetszőségből, elmosódásból élesedve, alulról pár px), bezárás ugyanez visszafelé ~260 ms.
// - Akadálymentes: role="dialog" + aria-modal, fókusz bent marad (Tab körbejár), Esc / háttér / „Bezárás" zár,
//   bezáráskor a fókusz visszaáll a gombra; nyitva a háttér görgetése zárolva. „Mozgás csökkentése" esetén nincs animáció.
// - Mérés: GA4 „appstore_open" és „appstore_cta_click". Szöveg: src/lib/site-copy.ts → APPSTORE_INFO.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gaEvent } from "@/lib/analytics";
import { APPSTORE_INFO } from "@/lib/site-copy";

const OPEN_MS = 480;
const CLOSE_MS = 260;

export default function AppstoreButton({ className = "" }: { className?: string }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false); // DOM-ban van-e az ablak
  const [shown, setShown] = useState(false);     // látható (animáció célállapota)
  const timer = useRef<number | null>(null);

  const open = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setMounted(true);
    gaEvent("appstore_open");
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  };

  const close = useCallback((after?: () => void) => {
    setShown(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setMounted(false);
      btnRef.current?.focus({ preventScroll: true });
      after?.();
    }, CLOSE_MS);
  }, []);

  const cta = () => {
    gaEvent("appstore_cta_click");
    close(() => document.getElementById("kapcsolat")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // Nyitva: görgetés zárolása, fókusz az ablakba, Esc és Tab-csapda.
  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    const prevBody = document.body.style.overflow;
    const prevHtml = html.style.overflow;
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])"));
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, [mounted, close]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const dur = shown ? OPEN_MS : CLOSE_MS;

  return (
    <>
      <button ref={btnRef} type="button" onClick={open} aria-haspopup="dialog" className={`b-glow-btn ${className}`}>
        {APPSTORE_INFO.button}
      </button>

      {mounted && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6">
          {/* Háttér: elsötétítés + enyhe elmosás; kattintásra zár. */}
          <div
            aria-hidden
            onClick={() => close()}
            className={`absolute inset-0 bg-[rgba(14,10,7,0.58)] backdrop-blur-[6px] transition-opacity ease-out motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
            style={{ transitionDuration: `${dur}ms` }}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="twx-appstore-title"
            tabIndex={-1}
            className={`twx-appstore-panel relative flex max-h-[calc(100dvh-24px)] w-full max-w-[560px] flex-col rounded-[24px] text-b-on-dark outline-none transition-[opacity,transform,filter] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transform-none motion-reduce:transition-none motion-reduce:[filter:none] sm:max-h-[calc(100dvh-48px)] ${shown ? "translate-y-0 opacity-100 [filter:blur(0)]" : "translate-y-2 opacity-0 [filter:blur(6px)]"}`}
            style={{ transitionDuration: `${dur}ms` }}
          >
            <div className="min-h-0 overflow-y-auto px-6 pb-2 pt-6 sm:px-8 sm:pt-8">
              <h2 id="twx-appstore-title" className="font-display text-[26px] font-bold leading-tight tracking-[-0.5px] sm:text-[30px]">
                {APPSTORE_INFO.title}
              </h2>
              <p className="mt-4 font-sans text-[15.5px] leading-[1.75] text-b-on-dark sm:text-[16px]">{APPSTORE_INFO.text}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2.5 px-6 pb-6 pt-4 sm:flex-row sm:justify-end sm:px-8 sm:pb-8">
              <button type="button" onClick={() => close()} className="b-btn-outline border-white/35 text-b-on-dark hover:bg-white/10 sm:order-1">
                {APPSTORE_INFO.close}
              </button>
              <button type="button" onClick={cta} className="b-btn sm:order-2">{APPSTORE_INFO.cta}</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
