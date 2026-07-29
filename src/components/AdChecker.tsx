// Hirdetés-ellenőrző — link (vagy bemásolt szöveg) alapján elemzi a hirdetés
// SZÖVEGÉT. Az elkészült elemzés NEM az oldalon jelenik meg: egy kártya jön elő,
// onnan nyitható meg ablakban, és onnan tölthető le a PDF is.
// A korábbi elemzések mappákba rendezve, ugyanabban az ablakos nézetben.
"use client";

import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/components/Toast";
import SelectField from "@/components/SelectField";
import FolderLibrary, { type LibraryFolder } from "@/components/library/FolderLibrary";
import AdCheckReport, { scoreColor } from "@/components/AdCheckReport";
import { toDownloadUrl } from "@/lib/files";
import { AD_TONES, ADCHECK_CREDITS, toneLabel, type AdCheckResult } from "@/lib/adcheck";

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

function itemTitle(it: SavedItem): string {
  return it.source_url
    ? it.source_url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)
    : "Bemásolt hirdetésszöveg";
}

export default function AdChecker() {
  const [url, setUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [showText, setShowText] = useState(false);
  const [tone, setTone] = useState(AD_TONES[0].slug);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<SavedItem | null>(null);   // a most elkészült elemzés
  const [openItem, setOpenItem] = useState<SavedItem | null>(null); // ami az ablakban van

  const [items, setItems] = useState<LibItem[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/real-estate/ad-check");
      const d = await res.json();
      if (!res.ok) {
        showToast(d.error || "Az előzmények betöltése nem sikerült.", "error");
        return;
      }
      setItems(((d.items ?? []) as SavedItem[]).map((it) => ({
        id: it.id, title: itemTitle(it), createdAt: it.created_at, folderId: it.folder_id, raw: it,
      })));
      setFolders(d.folders ?? []);
    } catch { /* lista nélkül is használható */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Esc zárja az ablakot.
  useEffect(() => {
    if (!openItem) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenItem(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openItem]);

  async function analyze() {
    setError(null);
    if (!url.trim() && !manualText.trim()) {
      setError("Add meg a hirdetés linkjét, vagy másold be a szövegét.");
      return;
    }
    setBusy(true);
    setFresh(null);
    try {
      const res = await fetch("/api/real-estate/ad-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), text: manualText.trim(), tone }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.needsText) setShowText(true);
        throw new Error(d.error || "Az elemzés nem sikerült.");
      }
      setFresh(d.item as SavedItem);
      showToast("Az elemzés elkészült.", "success");
      void load();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  async function send(endpoint: string, init: RequestInit) {
    const res = await fetch(endpoint, init);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "A művelet nem sikerült.");
    await load();
    return d as { folder?: LibraryFolder };
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
            <button type="button" onClick={() => setShowText((v) => !v)}
              className="text-xs font-medium" style={{ color: "var(--twx-coral)" }}>
              {showText ? "− Szöveg elrejtése" : "+ Inkább bemásolom a szöveget"}
            </button>
            {showText && (
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
          <p className="mt-3 rounded-lg p-2 text-xs" style={{ background: "#fdecea", color: "#c0392b" }}>
            {error}
          </p>
        )}

        <button type="button" onClick={analyze} disabled={busy}
          className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--twx-coral)" }}>
          {busy ? "Elemzés folyamatban…" : `Hirdetés ellenőrzése (${ADCHECK_CREDITS} kredit)`}
        </button>
      </section>

      {/* --- AZ ELKÉSZÜLT ELEMZÉS: csak egy kártya, innen nyílik meg --- */}
      {fresh && (
        <section className="twx-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-none items-baseline gap-2">
              <span className="text-4xl font-bold" style={{ color: scoreColor(fresh.score ?? 0) }}>
                {fresh.score ?? 0}
              </span>
              <span className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>/ 100 pont</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Az elemzés elkészült</p>
              <p className="mt-0.5 truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                {itemTitle(fresh)} · {toneLabel(fresh.tone)}
              </p>
            </div>
            <div className="flex flex-none flex-wrap gap-2">
              <button type="button" onClick={() => setOpenItem(fresh)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "var(--twx-coral)" }}>
                Elemzés megnyitása
              </button>
              {fresh.pdf_url && (
                <a href={toDownloadUrl(fresh.pdf_url)} download
                  className="rounded-xl px-4 py-2 text-sm font-medium"
                  style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                  PDF letöltése
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* --- KÖNYVTÁR --- */}
      <section className="twx-card p-5 sm:p-6">
        <h3 className="mb-3 text-sm font-semibold">Korábbi ellenőrzéseim</h3>
        <FolderLibrary<LibItem>
          items={items}
          folders={folders}
          noun="elemzés"
          emptyText="Még nincs korábbi ellenőrzésed."
          downloadUrl={(it) => (it.raw.pdf_url ? toDownloadUrl(it.raw.pdf_url) : null)}
          renderItem={(it) => (
            <button type="button" onClick={() => setOpenItem(it.raw)}
              className="block w-full rounded-lg p-3 text-left transition hover:shadow-sm"
              style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
              <span className="flex items-baseline gap-2">
                <span className="text-2xl font-bold" style={{ color: scoreColor(it.raw.score ?? 0) }}>
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

      {/* --- AZ ELEMZÉS ABLAKBAN --- */}
      {openItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(20,16,14,0.55)" }} onClick={() => setOpenItem(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-3"
              style={{ borderColor: "var(--twx-line)" }}>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Hirdetés-elemzés</p>
                <p className="truncate text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  {new Date(openItem.created_at).toLocaleDateString("hu-HU")} · {toneLabel(openItem.tone)}
                </p>
              </div>
              <button type="button" onClick={() => setOpenItem(null)} aria-label="Bezárás"
                className="flex-none rounded-lg px-3 py-1.5 text-sm"
                style={{ border: "1px solid var(--twx-line)" }}>
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-5">
              <AdCheckReport
                result={openItem.result}
                pdfUrl={openItem.pdf_url}
                tone={openItem.tone}
                sourceUrl={openItem.source_url}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
