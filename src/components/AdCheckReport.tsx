// A hirdetés-elemzés megjelenítése — TÖMÖR értékelés:
// Megfelelőség %, Miben jó, Miben rossz, Mit kell javítani.
"use client";

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
  result, pdfUrl, sourceUrl,
}: {
  result: AdCheckResult;
  pdfUrl: string | null;
  sourceUrl?: string | null;
}) {
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
          {pdfUrl && (
            <a href={toDownloadUrl(pdfUrl)} download
              className="flex-none self-start rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--twx-coral)" }}>
              PDF letöltése
            </a>
          )}
        </div>
      </div>

      {/* --- MIBEN JÓ --- */}
      <VerdictList title="Miben jó" items={result.good} dot="#2e7d52" bg="#f2f9f5" border="#bfe0cd" />

      {/* --- MIBEN ROSSZ --- */}
      <VerdictList title="Miben rossz" items={result.bad} dot="#c0392b" bg="#fdf3f2" border="#e6bdb8" />

      {/* --- MIT KELL JAVÍTANI --- */}
      <VerdictList title="Mit kell javítani" items={result.fixes} dot="#7a2e17" bg="var(--twx-coral-soft)" border="var(--twx-coral)" />
    </div>
  );
}
