// A hirdetés-elemzés megjelenítése — az ablakban ez fut.
// Pontszám-gyűrű, szempont-sávok, javasolt átfogalmazások, kiemelendők
// fotó-ellenőrzőlistával, pótlandó adatok és az újraírt szöveg.
"use client";

import { showToast } from "@/components/Toast";
import { toDownloadUrl } from "@/lib/files";
import { AD_ASPECTS, toneLabel, type AdCheckResult } from "@/lib/adcheck";

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

/** Kör alakú pontszám-kijelző. */
function ScoreRing({ score, size = 104 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, score)) / 100) * c;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`${score} pont a 100-ból`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--twx-line)" strokeWidth="9" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9"
        strokeLinecap="round" strokeDasharray={`${filled} ${c - filled}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" textAnchor="middle" dy="0.02em" fontSize={size * 0.3}
        fontWeight="700" fill={color}>{score}</text>
      <text x="50%" y="50%" textAnchor="middle" dy="1.5em" fontSize={size * 0.11}
        fill="var(--twx-ink-muted)">/ 100</text>
    </svg>
  );
}

/** Szakasz-fejléc egyszínű jelölővel. */
function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="h-3 w-1 rounded-full" style={{ background: "var(--twx-coral)" }} />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      {note && <p className="mb-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{note}</p>}
      {children}
    </section>
  );
}

export default function AdCheckReport({
  result, pdfUrl, tone, sourceUrl,
}: {
  result: AdCheckResult;
  pdfUrl: string | null;
  tone: string;
  sourceUrl?: string | null;
}) {
  const copy = (t: string) =>
    void navigator.clipboard.writeText(t).then(
      () => showToast("Vágólapra másolva.", "success"),
      () => showToast("A másolás nem sikerült.", "error")
    );

  return (
    <div className="space-y-6">
      {/* --- FEJLÉC: pontszám + összegzés --- */}
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
            {result.summary && <p className="mt-1 text-sm">{result.summary}</p>}
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

        {/* Szempont-sávok */}
        {result.aspects.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {result.aspects.map((a) => {
              const label = AD_ASPECTS.find((s) => s.key === a.key)?.label ?? a.key;
              return (
                <div key={a.key}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-medium">{label}</span>
                    <span className="text-[11px] font-bold" style={{ color: scoreColor(a.score) }}>
                      {a.score}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                    style={{ background: "var(--twx-line)" }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.max(2, a.score)}%`, background: scoreColor(a.score) }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- MEGÁLLAPÍTÁSOK --- */}
      {result.aspects.some((a) => a.findings.length > 0) && (
        <Section title="Megállapítások">
          <div className="space-y-3">
            {result.aspects.filter((a) => a.findings.length).map((a) => (
              <div key={a.key} className="rounded-xl p-3" style={{ border: "1px solid var(--twx-line)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">
                    {AD_ASPECTS.find((s) => s.key === a.key)?.label ?? a.key}
                  </p>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: scoreColor(a.score) }}>{a.score}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {a.findings.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span style={{ color: "var(--twx-coral)" }}>•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* --- ÁTFOGALMAZÁSOK --- */}
      {result.rewrites.length > 0 && (
        <Section title="Javasolt átfogalmazások" note="Bal oldalon az eredeti, jobbra a jobb változat.">
          <div className="space-y-2.5">
            {result.rewrites.map((r, i) => (
              <div key={i} className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
                <div className="p-3" style={{ background: "#fdf3f2", borderLeft: "3px solid #e0a9a4" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#a8564d" }}>
                    Eredeti
                  </p>
                  <p className="mt-0.5 text-sm" style={{ color: "var(--twx-ink-muted)" }}>{r.original}</p>
                </div>
                <div className="p-3" style={{ background: "#f2f9f5", borderLeft: "3px solid #7fbf9b" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#2e7d52" }}>
                        Javasolt
                      </p>
                      <p className="mt-0.5 text-sm font-medium">{r.improved}</p>
                    </div>
                    <button type="button" onClick={() => copy(r.improved)}
                      className="flex-none rounded-lg px-2 py-1 text-[10px] font-medium"
                      style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                      Másolás
                    </button>
                  </div>
                  {r.why && (
                    <p className="mt-1.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{r.why}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* --- KIEMELENDŐK + FOTÓ-CHECKLIST --- */}
      {result.highlights.length > 0 && (
        <Section title="Mit érdemes kiemelni"
          note="A fotókat nem látjuk — nézd át, hogy ezekhez van-e kép a hirdetésben.">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {result.highlights.map((h, i) => (
              <div key={i} className="rounded-xl p-3"
                style={{ border: "1px solid var(--twx-coral)", background: "var(--twx-coral-soft)" }}>
                <p className="text-sm font-semibold" style={{ color: "#7a2e17" }}>{h.what}</p>
                {h.why && <p className="mt-1 text-xs">{h.why}</p>}
                {h.hasPhotoQuestion && (
                  <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg p-2 text-xs"
                    style={{ background: "rgba(255,255,255,0.7)" }}>
                    <input type="checkbox" className="mt-0.5 flex-none" />
                    <span>{h.hasPhotoQuestion}</span>
                  </label>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* --- PÓTLANDÓ ADATOK --- */}
      {result.missing.length > 0 && (
        <Section title="Pótlandó adatok" note="Ezeket a vevők keresik, de nincsenek a hirdetésben.">
          <div className="flex flex-wrap gap-1.5">
            {result.missing.map((m, i) => (
              <span key={i} className="rounded-full px-3 py-1 text-xs"
                style={{ background: "#fff8ec", border: "1px solid #e8c97a", color: "#7a5a12" }}>
                {m}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* --- ÚJRAÍRT SZÖVEG --- */}
      {result.rewritten && (
        <Section title={`Újraírt hirdetésszöveg — ${toneLabel(tone)}`}>
          <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
            <div className="flex items-center justify-between px-3 py-2"
              style={{ background: "var(--twx-cream-card)", borderBottom: "1px solid var(--twx-line)" }}>
              <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                Mehet vissza a hirdetési oldalra
              </span>
              <button type="button" onClick={() => copy(result.rewritten)}
                className="rounded-lg px-3 py-1 text-xs font-semibold text-white"
                style={{ background: "var(--twx-coral)" }}>
                Szöveg másolása
              </button>
            </div>
            <p className="whitespace-pre-wrap p-3 text-sm leading-relaxed">{result.rewritten}</p>
          </div>
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
            A [szögletes zárójeles] helyeket töltsd ki a valós adatokkal — ezeket szándékosan nem találjuk ki.
          </p>
        </Section>
      )}
    </div>
  );
}
