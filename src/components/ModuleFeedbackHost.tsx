// ModuleFeedbackHost — közös visszajelzés-gazda a dashboard keretében (ME3c). Két kis, bezárható kártya, egyszerre csak egy:
//   • CSILLAGOS ÉRTÉKELÉS: sikeres futtatás után (MODULE_RUN_DONE_EVENT) megkérdezi a szervert (/api/feedback/prompt) —
//     a 3. futtatásnál, bezárás esetén a 6.-nál még egyszer, utána soha. 1–3 csillagnál nem kötelező ok + megjegyzés.
//   • „MI HIÁNYZIK?": egy modul-oldal megnyitása után pár másodperccel — ha ≥ 3 napon megnyitotta, de nem futtatta.
// Hogy kell-e kérdezni, MINDIG a szerver dönti el (szabály + védelem). A kártya a kredit-sáv fölött, jobb lent jelenik meg.
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { moduleForPath, selectableModules } from "@/lib/module-favorites";
import { MODULE_RUN_DONE_EVENT } from "@/lib/module-events";
import { ASK_CHOICES, FEEDBACK_COMMENT_MAX, RATING_REASONS } from "@/lib/module-feedback-shared";

type Card = { kind: "rating" | "ask"; module: string; label: string } | null;

const ASK_DELAY_MS = 5000;     // a „Mi hiányzik?" ne a betöltés pillanatában ugorjon fel
const RATING_DELAY_MS = 1500;  // a kész eredmény előbb látszódjon

function labelOf(href: string): string {
  return selectableModules().find((m) => m.href === href)?.label ?? "modul";
}

export default function ModuleFeedbackHost() {
  const pathname = usePathname();
  const [card, setCard] = useState<Card>(null);
  const cardRef = useRef<Card>(null);
  cardRef.current = card;

  async function check(module: string, want: "rating" | "ask") {
    if (cardRef.current) return; // egyszerre csak egy kártya
    try {
      const d = await fetch(`/api/feedback/prompt?module=${encodeURIComponent(module)}`).then((r) => r.json());
      if (cardRef.current) return;
      if (want === "rating" && d.rating) setCard({ kind: "rating", module: d.module, label: labelOf(d.module) });
      if (want === "ask" && d.ask) setCard({ kind: "ask", module: d.module, label: labelOf(d.module) });
    } catch { /* csendben kihagyjuk */ }
  }

  // csillag: sikeres futtatás után
  useEffect(() => {
    const on = (e: Event) => {
      const href = (e as CustomEvent<{ module: string }>).detail?.module;
      if (href) window.setTimeout(() => void check(href, "rating"), RATING_DELAY_MS);
    };
    window.addEventListener(MODULE_RUN_DONE_EVENT, on);
    return () => window.removeEventListener(MODULE_RUN_DONE_EVENT, on);
  }, []);

  // „Mi hiányzik?": modul-oldal megnyitása után
  useEffect(() => {
    if (!pathname) return;
    const href = moduleForPath(pathname);
    if (!href) return;
    const t = window.setTimeout(() => void check(href, "ask"), ASK_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [pathname]);

  if (!card) return null;
  return (
    <div className="fixed bottom-[76px] right-4 z-[55] w-[calc(100vw-32px)] max-w-[360px] rounded-2xl p-4 shadow-2xl sm:right-6"
      style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 20px 50px rgba(28,24,21,0.22)" }}
      role="dialog" aria-label={card.kind === "rating" ? "Értékelés" : "Mi hiányzik?"}>
      {card.kind === "rating"
        ? <RatingCard card={card} onClose={() => setCard(null)} />
        : <AskCard card={card} onClose={() => setCard(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function RatingCard({ card, onClose }: { card: NonNullable<Card>; onClose: () => void }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const low = stars > 0 && stars <= 3;

  async function send(payload: { stars: number | null; reasons?: string[]; comment?: string }) {
    setBusy(true);
    try {
      await fetch("/api/feedback/rating", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: card.module, ...payload }),
      });
    } catch { /* csendben */ }
    setBusy(false);
    if (payload.stars === null) { onClose(); return; }
    setThanks(true);
    window.setTimeout(onClose, 1800);
  }

  function pick(n: number) {
    setStars(n);
    if (n >= 4) void send({ stars: n }); // 4–5 csillagnál nem kérdezünk többet
  }

  if (thanks) {
    return <p className="py-2 text-center text-sm font-semibold">Köszönjük a visszajelzést! 🙏</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-[15px] font-semibold leading-snug">Hogy tetszik a(z) {card.label}?</p>
        <button type="button" onClick={() => void send({ stars: null })} disabled={busy} aria-label="Bezárás"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-base" style={{ background: "var(--twx-line)" }}>×</button>
      </div>
      <div className="flex justify-center gap-1.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= (hover || stars);
          return (
            <button key={n} type="button" disabled={busy} onMouseEnter={() => setHover(n)} onClick={() => pick(n)}
              aria-label={`${n} csillag`} className="text-[32px] leading-none transition-transform hover:scale-110"
              style={{ color: on ? "#F0A23B" : "#E1D6C9" }}>★</button>
          );
        })}
      </div>
      {low && (
        <div className="flex flex-col gap-2">
          <p className="text-[12.5px]">Mi nem tetszett? <span style={{ color: "var(--twx-ink-muted)" }}>(nem kötelező)</span></p>
          <div className="flex flex-wrap gap-1.5">
            {RATING_REASONS.map((r) => {
              const on = reasons.includes(r.value);
              return (
                <button key={r.value} type="button" onClick={() => setReasons((x) => on ? x.filter((y) => y !== r.value) : [...x, r.value])}
                  className="h-7 rounded-full px-2.5 text-xs font-semibold"
                  style={on ? { background: "#12100e", color: "#fff" } : { border: "1px solid var(--twx-line)", background: "#fff" }}>{r.label}</button>
              );
            })}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={FEEDBACK_COMMENT_MAX} rows={2}
            placeholder="Írd meg röviden (nem kötelező)…" className="resize-none rounded-lg px-2.5 py-2 text-[13px] outline-none"
            style={{ border: "1px solid var(--twx-line)", background: "#fff" }} />
          <div className="flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => void send({ stars })} className="h-8 rounded-full px-3 text-xs font-semibold"
              style={{ color: "var(--twx-ink-muted)" }}>Kihagyom</button>
            <button type="button" disabled={busy} onClick={() => void send({ stars, reasons, comment })}
              className="h-8 rounded-full px-4 text-xs font-bold" style={{ background: "#F08A68", color: "#1C1A17" }}>Küldés</button>
          </div>
        </div>
      )}
      {!low && <p className="text-center text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>Egy kattintás — csak most kérdezzük.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
function AskCard({ card, onClose }: { card: NonNullable<Card>; onClose: () => void }) {
  const [choice, setChoice] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);

  async function send(c: string | null) {
    setBusy(true);
    try {
      await fetch("/api/feedback/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: card.module, choice: c, comment }),
      });
    } catch { /* csendben */ }
    setBusy(false);
    if (c === null) { onClose(); return; }
    setThanks(true);
    window.setTimeout(onClose, 1800);
  }

  if (thanks) return <p className="py-2 text-center text-sm font-semibold">Köszönjük, sokat segítesz! 🙏</p>;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[15px] font-semibold">Segíts nekünk egy kattintással 🙂</p>
          <p className="mt-1 text-[12.5px] leading-snug" style={{ color: "var(--twx-ink-muted)" }}>
            Többször megnézted a(z) {card.label} modult, de még nem futtattad. Mi hiányzik hozzá?
          </p>
        </div>
        <button type="button" onClick={() => void send(null)} disabled={busy} aria-label="Bezárás"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-base" style={{ background: "var(--twx-line)" }}>×</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ASK_CHOICES.map((c) => (
          <button key={c.value} type="button" onClick={() => setChoice(c.value)} aria-pressed={choice === c.value}
            className="h-7 rounded-full px-2.5 text-xs font-semibold"
            style={choice === c.value ? { background: "#12100e", color: "#fff" } : { border: "1px solid var(--twx-line)", background: "#fff" }}>{c.label}</button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={FEEDBACK_COMMENT_MAX} rows={2}
        placeholder="Írd meg röviden (nem kötelező)…" className="resize-none rounded-lg px-2.5 py-2 text-[13px] outline-none"
        style={{ border: "1px solid var(--twx-line)", background: "#fff" }} />
      <button type="button" disabled={busy || !choice} onClick={() => void send(choice)}
        title={choice ? undefined : "Válassz egy lehetőséget"}
        className="h-8 self-end rounded-full px-4 text-xs font-bold disabled:opacity-50" style={{ background: "#F08A68", color: "#1C1A17" }}>Küldés</button>
    </div>
  );
}
