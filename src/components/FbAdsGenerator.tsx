// Facebook hirdetésszöveg-generátor — link (vagy bemásolt szöveg) alapján 3 stílusú
// B2C hirdetésszöveg, mindegyik külön szerkeszthető és másolható dobozban.
"use client";

import { useState } from "react";
import { showToast } from "@/components/Toast";
import { FBADS_CREDITS, EMPTY_FBADS, type FbAdsResult } from "@/lib/fbads";

const STYLES: { key: keyof Pick<FbAdsResult, "short" | "story" | "bullets">; label: string; note: string }[] = [
  { key: "short", label: "Rövid és pörgős", note: "Max 3-4 mondat, a legfőbb egyedi előny (USP) a fókuszban." },
  { key: "story", label: "Érzelmi / sztori-alapú", note: "Hosszabb, a lakhatás életérzésére ható szöveg." },
  { key: "bullets", label: "Adatvezérelt (felsorolásos)", note: "Átfutható bullet-lista: technikai adatok + infrastruktúra." },
];

export default function FbAdsGenerator() {
  const [url, setUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<FbAdsResult | null>(null);
  const [drafts, setDrafts] = useState<FbAdsResult>({ ...EMPTY_FBADS });

  const copy = (t: string) =>
    void navigator.clipboard.writeText(t).then(
      () => showToast("Vágólapra másolva — mehet a Facebookra.", "success"),
      () => showToast("A másolás nem sikerült.", "error")
    );

  async function generate() {
    setError(null);
    if (!url.trim() && !manualText.trim()) {
      setError("Adj meg egy landing page linket, vagy másold be a szövegét.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/real-estate/fb-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), text: manualText.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.needsText) setShowText(true);
        throw new Error(d.error || "A generálás nem sikerült.");
      }
      const r = d.result as FbAdsResult;
      setResult(r);
      setDrafts(r);
      showToast("A 3 hirdetésszöveg elkészült.", "success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="twx-card p-5 sm:p-6">
        <p className="text-sm font-semibold">A hirdetett ingatlan</p>
        <p className="mt-0.5 mb-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Illeszd be a landing page (hirdetés) nyilvános linkjét. Ha az oldal nem érhető el,
          másold be helyette a hirdetés szövegét.
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium">Landing page linkje</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
            className="twx-input w-full" />
        </label>

        <button type="button" onClick={() => setShowText((v) => !v)}
          className="mt-2 text-xs font-medium" style={{ color: "var(--twx-coral)" }}>
          {showText ? "– Szöveg elrejtése" : "+ Inkább bemásolom a szöveget"}
        </button>

        {showText && (
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-medium">A hirdetés szövege</span>
            <textarea value={manualText} onChange={(e) => setManualText(e.target.value)}
              rows={7} placeholder="Másold ide a hirdetés címét és teljes leírását…"
              className="twx-input w-full" />
            <span className="mt-1 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
              Ha ezt kitöltöd, a linket nem próbáljuk megnyitni — ebből dolgozunk.
            </span>
          </label>
        )}

        {error && (
          <p className="mt-3 rounded-lg p-2 text-xs" style={{ background: "#fdecea", color: "#c0392b" }}>{error}</p>
        )}

        <button type="button" onClick={generate} disabled={busy}
          className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--twx-coral)" }}>
          {busy ? "Generálás folyamatban…" : `Facebook szövegek generálása (${FBADS_CREDITS} kredit)`}
        </button>
      </section>

      {result && (
        <section className="space-y-4">
          {result.title && (
            <p className="text-sm font-semibold">{result.title}</p>
          )}
          {STYLES.map((s) => (
            <div key={s.key} className="twx-card p-4 sm:p-5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{s.label}</h3>
                <button type="button" onClick={() => copy(drafts[s.key])}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
                  Másolás
                </button>
              </div>
              <p className="mb-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{s.note}</p>
              <textarea
                value={drafts[s.key]}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                rows={s.key === "short" ? 5 : 10}
                className="twx-input w-full text-sm leading-relaxed"
              />
            </div>
          ))}
          <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
            A szövegek szerkeszthetők. A [szögletes zárójeles] helyeket töltsd ki a valós adatokkal, a link-helyőrzőt cseréld a hirdetés linkjére.
          </p>
        </section>
      )}
    </div>
  );
}
