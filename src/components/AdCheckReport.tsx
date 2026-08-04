// A hirdetés-elemzés megjelenítése — TÖMÖR értékelés + SZERKESZTHETŐ javított
// hirdetésszöveg. A javított szöveg elfogadásakor (esetleg átírva) készül a PDF.
"use client";

import { useState } from "react";
import { showToast } from "@/components/Toast";
import { toDownloadUrl } from "@/lib/files";
import type { AdCheckResult } from "@/lib/adcheck";

export function scoreColor(score: number): string {
  if (score >= 80) return "#2e7d52";
  if (score >= 55) return "#c98a1e";
  return "#c0392b";
}
function scoreWord(score: number): string {
  if (score >= 85) return "Kiváló";
  if (score >= 70) return "Jó, de csiszolható";
  if (score >= 50) return "Közepes";
  return "Sok múlik a javításon";
}

/** Kör alakú pontszám-kijelző (Megfelelőség %). */
function ScoreRing({ score, size = 104 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * c;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${score}% megfelelőség`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--twx-line)" strokeWidth="9" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9"
        strokeLinecap="round" strokeDasharray={`${filled} ${c - filled}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.02em" fontSize={size * 0.28}
        fontWeight="700" fill={color}>{score}%</text>
      <text x="50%" y="50%" textAnchor="middle" dy="1.7em" fontSize={size * 0.1}
        fill="var(--twx-ink-muted)">megfelelőség</text>
    </svg>
  );
}

/** Egy értékelő szakasz (Miben jó / Miben rossz / Mit kell javítani). */
function VerdictList({
  title, items, dot, bg, border,
}: { title: string; items: string[]; dot: string; bg: string; border: string }) {
  if (!items.length) return null;
  return (
    <section className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <span aria-hidden style={{ color: dot }}>•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdCheckReport({
  result, pdfUrl, sourceUrl, recordId, onSaved,
}: {
  result: AdCheckResult;
  pdfUrl: string | null;
  sourceUrl?: string | null;
  recordId?: string | null;
  onSaved?: (pdfUrl: string) => void;
}) {
  const [draft, setDraft] = useState(result.rewritten ?? "");
  const [pdf, setPdf] = useState<string | null>(pdfUrl);
  const [saving, setSaving] = useState(false);

  const copy = (t: string) =>
    void navigator.clipboard.writeText(t).then(
      () => showToast("Vágólapra másolva.", "success"),
      () => showToast("A másolás nem sikerült.", "error")
    );

  async function acceptAndPdf() {
    if (!recordId || saving || draft.trim().length < 20) return;
    setSaving(true);
    try {
      const res = await fetch("/api/real-estate/ad-check/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: recordId, rewritten: draft.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "A PDF elkészítése nem sikerült.");
      setPdf(d.pdf_url as string);
      onSaved?.(d.pdf_url as string);
      showToast("Elfogadva — a PDF elkészült.", "success");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* --- FEJLÉC: megfelelőség + cím --- */}
      <div className="rounded-2xl p-4 sm:p-5"
        style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-none self-center"><ScoreRing score={result.score} /></div>
          <div className="min-w-0 flex-1">
            {result.title && <p className="text-base font-semibold">{result.title}</p>}
            <p className={`${result.title ? "mt-0.5 " : ""}text-sm font-semibold`}
              style={{ color: scoreColor(result.score) }}>
              {scoreWord(result.score)}
            </p>
            {sourceUrl && (
              <p className="mt-2 truncate text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                {sourceUrl}
              </p>
            )}
          </div>
          {pdf && (
            <a href={toDownloadUrl(pdf)} download
              className="flex-none self-start rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--twx-coral)" }}>
              PDF letöltése
            </a>
          )}
        </div>
      </div>

      {/* --- MIBEN JÓ / MIBEN ROSSZ / MIT KELL JAVÍTANI --- */}
      <VerdictList title="Miben jó" items={result.good} dot="#2e7d52" bg="#f2f9f5" border="#bfe0cd" />
      <VerdictList title="Miben rossz" items={result.bad} dot="#c0392b" bg="#fdf3f2" border="#e6bdb8" />
      <VerdictList title="Mit kell javítani" items={result.fixes} dot="#7a2e17" bg="var(--twx-coral-soft)" border="var(--twx-coral)" />

      {/* --- JAVÍTOTT, SZERKESZTHETŐ HIRDETÉSSZÖVEG --- */}
      <section className="rounded-xl p-4" style={{ border: "1px solid var(--twx-line)" }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Javított hirdetésszöveg</h4>
          <button type="button" onClick={() => copy(draft)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
            Szöveg másolása
          </button>
        </div>
        <p className="mb-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
          Az AI által javított szöveg — szerkeszd tetszés szerint. A [szögletes zárójeles] helyeket töltsd ki a valós adatokkal.
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={12}
          className="twx-input w-full text-sm leading-relaxed"
          placeholder="A javított hirdetésszöveg…"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={acceptAndPdf} disabled={saving || !recordId || draft.trim().length < 20}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--twx-coral)" }}>
            {saving ? "PDF készítése…" : (pdf ? "Újra elfogadom és PDF" : "Szöveg elfogadása és PDF készítése")}
          </button>
          {pdf && (
            <span className="text-[11px]" style={{ color: "#2e7d52" }}>A PDF elkészült — fent letöltheted.</span>
          )}
        </div>
      </section>
    </div>
  );
}
