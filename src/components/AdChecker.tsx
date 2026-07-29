// Hirdetés-ellenőrző — link (vagy bemásolt szöveg) alapján elemzi a hirdetés
// SZÖVEGÉT, és javított változatot ad. A korábbi elemzések mappákba rendezve,
// ablakos megtekintővel (közös FolderLibrary).
"use client";

import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/components/Toast";
import SelectField from "@/components/SelectField";
import FolderLibrary, { type LibraryFolder } from "@/components/library/FolderLibrary";
import {
  AD_TONES, AD_ASPECTS, ADCHECK_CREDITS, toneLabel,
  type AdCheckResult,
} from "@/lib/adcheck";

type SavedItem = {
  id: string;
  source_url: string | null;
  tone: string;
  score: number | null;
  result: AdCheckResult;
  pdf_url: string | null;
  folder_id: string | null;
  created_at: string;
};

type LibItem = {
  id: string;
  title: string;
  createdAt: string;
  folderId: string | null;
  coverUrl?: string | null;
  raw: SavedItem;
};

function scoreColor(score: number): string {
  if (score >= 80) return "#2e7d52";
  if (score >= 55) return "#b8860b";
  return "#c0392b";
}

export default function AdChecker() {
  const [url, setUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [needsText, setNeedsText] = useState(false); // ha a link nem volt elérhető
  const [tone, setTone] = useState(AD_TONES[0].slug);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdCheckResult | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const [items, setItems] = useState<LibItem[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [openItem, setOpenItem] = useState<SavedItem | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/real-estate/ad-check");
      const d = await res.json();
      if (!res.ok) {
        // Ha a migráció hiányzik, ez itt derül ki — ne maradjon néma.
        showToast(d.error || "Az előzmények betöltése nem sikerült.", "error");
        return;
      }
      const list = ((d.items ?? []) as SavedItem[]).map((it) => ({
        id: it.id,
        title: it.source_url
          ? it.source_url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)
          : "Bemásolt hirdetésszöveg",
        createdAt: it.created_at,
        folderId: it.folder_id,
        raw: it,
      }));
      setItems(list);
      setFolders(d.folders ?? []);
    } catch { /* lista nélkül is használható */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function analyze() {
    setError(null);
    if (!url.trim() && !manualText.trim()) {
      setError("Add meg a hirdetés linkjét, vagy másold be a szövegét.");
      return;
    }
    setBusy(true);
    setResult(null);
    setPdfUrl(null);
    try {
      const res = await fetch("/api/real-estate/ad-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), text: manualText.trim(), tone }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.needsText) setNeedsText(true);
        throw new Error(d.error || "Az elemzés nem sikerült.");
      }
      setResult(d.result as AdCheckResult);
      setPdfUrl(d.pdfUrl ?? null);
      setNeedsText(false);
      showToast("Az elemzés elkészült.", "success");
      void load();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  async function send(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "A művelet nem sikerült.");
    await load();
    return d as { folder?: LibraryFolder };
  }

  function copyText(t: string) {
    void navigator.clipboard.writeText(t).then(
      () => showToast("Vágólapra másolva.", "success"),
      () => showToast("A másolás nem sikerült.", "error")
    );
  }

  return (
    <div className="space-y-6">
      {/* --- ŰRLAP --- */}
      <section className="twx-card p-5 sm:p-6">
        <h3 className="text-sm font-semibold">A vizsgált hirdetés</h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Illeszd be egy nyilvánosan elérhető hirdetés linkjét. Ha az oldal nem érhető el
          (bejelentkezés vagy védelem miatt), másold be helyette a hirdetés szövegét.
        </p>

        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium">Hirdetés linkje</span>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…" className="twx-input w-full" />
          </label>

          <div>
            <button type="button" onClick={() => setNeedsText((v) => !v)}
              className="text-xs font-medium" style={{ color: "var(--twx-coral)" }}>
              {needsText ? "− Szöveg elrejtése" : "+ Inkább bemásolom a szöveget"}
            </button>
            {needsText && (
              <label className="mt-2 block">
                <span className="mb-1 block text-xs font-medium">A hirdetés szövege</span>
                <textarea value={manualText} onChange={(e) => setManualText(e.target.value)}
                  rows={8} placeholder="Másold ide a hirdetés címét és teljes leírását…"
                  className="twx-input w-full" />
                <span className="mt-1 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  Ha ezt kitöltöd, a linket nem próbáljuk megnyitni — ebből dolgozunk.
                </span>
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium">Az újraírt szöveg hangneme</span>
              <SelectField value={tone} onChange={setTone} ariaLabel="Hangnem"
                options={AD_TONES.map((t) => ({ value: t.slug, label: `${t.label} — ${t.hint}` }))} />
            </label>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg p-2 text-xs"
            style={{ background: "#fdecea", color: "#c0392b" }}>{error}</p>
        )}

        <button type="button" onClick={analyze} disabled={busy}
          className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--twx-coral)" }}>
          {busy ? "Elemzés folyamatban…" : `Hirdetés ellenőrzése (${ADCHECK_CREDITS} kredit)`}
        </button>
      </section>

      {/* --- EREDMÉNY --- */}
      {result && <ResultView result={result} pdfUrl={pdfUrl} tone={tone} onCopy={copyText} />}

      {/* --- KÖNYVTÁR --- */}
      <section className="twx-card p-5 sm:p-6">
        <h3 className="mb-3 text-sm font-semibold">Korábbi ellenőrzéseim</h3>
        <FolderLibrary<LibItem>
          items={items}
          folders={folders}
          noun="elemzés"
          emptyText="Még nincs korábbi ellenőrzésed."
          downloadUrl={(it) => it.raw.pdf_url}
          renderItem={(it) => (
            <button type="button" onClick={() => setOpenItem(it.raw)}
              className="block w-full rounded-lg p-3 text-left"
              style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
              <span className="flex items-center gap-2">
                <span className="text-lg font-bold" style={{ color: scoreColor(it.raw.score ?? 0) }}>
                  {it.raw.score ?? 0}
                </span>
                <span className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>/ 100 pont</span>
              </span>
              <span className="mt-1 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                {toneLabel(it.raw.tone)} · kattints a megnyitáshoz
              </span>
            </button>
          )}
          onCreateFolder={async (name) => {
            const d = await send("/api/real-estate/ad-check/manage", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            return d.folder;
          }}
          onMove={(id, folderId) =>
            send("/api/real-estate/ad-check/manage", {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, folderId }),
            })
          }
          onDelete={(it) => send(`/api/real-estate/ad-check/manage?id=${it.id}&kind=item`, { method: "DELETE" })}
        />
      </section>

      {/* --- KORÁBBI ELEMZÉS ABLAKBAN --- */}
      {openItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(20,16,14,0.55)" }} onClick={() => setOpenItem(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-3"
              style={{ borderColor: "var(--twx-line)" }}>
              <p className="truncate text-sm font-semibold">
                {openItem.source_url ?? "Bemásolt hirdetésszöveg"}
              </p>
              <button type="button" onClick={() => setOpenItem(null)} aria-label="Bezárás"
                className="rounded-lg px-3 py-1.5 text-sm" style={{ border: "1px solid var(--twx-line)" }}>
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <ResultView result={openItem.result} pdfUrl={openItem.pdf_url}
                tone={openItem.tone} onCopy={copyText} bare />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Az elemzés megjelenítése — az űrlap alatt és a korábbi elemzés ablakában is ez fut. */
function ResultView({
  result, pdfUrl, tone, onCopy, bare,
}: {
  result: AdCheckResult;
  pdfUrl: string | null;
  tone: string;
  onCopy: (t: string) => void;
  bare?: boolean;
}) {
  const Wrap = ({ children }: { children: React.ReactNode }) =>
    bare ? <div className="space-y-5">{children}</div>
         : <section className="twx-card space-y-5 p-5 sm:p-6">{children}</section>;

  return (
    <Wrap>
      {/* Pontszámok */}
      <div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <span className="text-4xl font-bold" style={{ color: scoreColor(result.score) }}>
              {result.score}
            </span>
            <span className="ml-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>/ 100 pont</span>
          </div>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
              className="ml-auto rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--twx-coral)" }}>
              PDF letöltése
            </a>
          )}
        </div>
        {result.summary && <p className="mt-2 text-sm">{result.summary}</p>}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {result.aspects.map((a) => {
            const label = AD_ASPECTS.find((s) => s.key === a.key)?.label ?? a.key;
            return (
              <div key={a.key} className="rounded-xl p-3" style={{ border: "1px solid var(--twx-line)" }}>
                <p className="text-lg font-bold" style={{ color: scoreColor(a.score) }}>{a.score}</p>
                <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Megállapítások */}
      {result.aspects.some((a) => a.findings.length > 0) && (
        <div>
          <h4 className="text-sm font-semibold">Megállapítások</h4>
          <div className="mt-2 space-y-3">
            {result.aspects.filter((a) => a.findings.length).map((a) => (
              <div key={a.key}>
                <p className="text-xs font-semibold" style={{ color: "var(--twx-coral)" }}>
                  {AD_ASPECTS.find((s) => s.key === a.key)?.label ?? a.key}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {a.findings.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mondatszintű javítások */}
      {result.rewrites.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Javasolt átfogalmazások</h4>
          <div className="mt-2 space-y-2">
            {result.rewrites.map((r, i) => (
              <div key={i} className="rounded-xl p-3" style={{ border: "1px solid var(--twx-line)" }}>
                <p className="text-xs line-through" style={{ color: "var(--twx-ink-muted)" }}>{r.original}</p>
                <p className="mt-1 text-sm font-medium">{r.improved}</p>
                {r.why && <p className="mt-1 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{r.why}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kiemelendők + fotó-ellenőrzőlista */}
      {result.highlights.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Mit érdemes kiemelni</h4>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
            A fotókat nem látjuk — nézd át, hogy ezekhez van-e kép a hirdetésben.
          </p>
          <div className="mt-2 space-y-2">
            {result.highlights.map((h, i) => (
              <div key={i} className="rounded-xl p-3"
                style={{ border: "1px solid var(--twx-line)", background: "var(--twx-coral-soft)" }}>
                <p className="text-sm font-medium">{h.what}</p>
                {h.why && <p className="mt-0.5 text-xs">{h.why}</p>}
                {h.hasPhotoQuestion && (
                  <p className="mt-1 text-xs font-medium" style={{ color: "#7a2e17" }}>
                    ☐ {h.hasPhotoQuestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hiányzó adatok */}
      {result.missing.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Pótlandó adatok</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {result.missing.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {/* Újraírt szöveg */}
      {result.rewritten && (
        <div>
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Újraírt hirdetésszöveg — {toneLabel(tone)}</h4>
            <button type="button" onClick={() => onCopy(result.rewritten)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ border: "1px solid var(--twx-line)" }}>
              Másolás
            </button>
          </div>
          <pre className="mt-2 whitespace-pre-wrap rounded-xl p-3 text-sm"
            style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", fontFamily: "inherit" }}>
{result.rewritten}
          </pre>
          <p className="mt-1 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
            A [szögletes zárójeles] helyeket töltsd ki a valós adatokkal — ezeket szándékosan nem találjuk ki.
          </p>
        </div>
      )}
    </Wrap>
  );
}
