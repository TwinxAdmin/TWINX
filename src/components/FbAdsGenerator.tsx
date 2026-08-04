// Hirdetésszöveg-generátor — egy landing page link alapján. Két szerep választható:
//  • Facebook: 3 stílusú B2C hirdetésszöveg (szerkeszthető, másolható).
//  • Google Ads (PPC): reszponzív keresési hirdetés címsorai/leírásai + kulcsszólista.
"use client";

import { useState } from "react";
import { showToast } from "@/components/Toast";
import { FBADS_CREDITS, EMPTY_FBADS, type FbAdsResult } from "@/lib/fbads";
import {
  EMPTY_GOOGLE_ADS, GADS_HEADLINE_MAX, GADS_DESC_MAX, type GoogleAdsResult,
} from "@/lib/googleads";

type Platform = "facebook" | "google";

const FB_STYLES: { key: keyof Pick<FbAdsResult, "short" | "story" | "bullets">; label: string; note: string }[] = [
  { key: "short", label: "Rövid és pörgős", note: "Max 3-4 mondat, a legfőbb egyedi előny (USP) a fókuszban." },
  { key: "story", label: "Érzelmi / sztori-alapú", note: "Hosszabb, a lakhatás életérzésére ható szöveg." },
  { key: "bullets", label: "Adatvezérelt (felsorolásos)", note: "Átfutható bullet-lista: technikai adatok + infrastruktúra." },
];

export default function FbAdsGenerator() {
  const [platform, setPlatform] = useState<Platform>("facebook");
  const [url, setUrl] = useState("");
  const [manualText, setManualText] = useState("");
  const [showText, setShowText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fb, setFb] = useState<FbAdsResult | null>(null);
  const [fbDrafts, setFbDrafts] = useState<FbAdsResult>({ ...EMPTY_FBADS });
  const [g, setG] = useState<GoogleAdsResult | null>(null);

  const copy = (t: string, msg = "Vágólapra másolva.") =>
    void navigator.clipboard.writeText(t).then(
      () => showToast(msg, "success"),
      () => showToast("A másolás nem sikerült.", "error")
    );

  async function generate() {
    setError(null);
    if (!url.trim() && !manualText.trim()) {
      setError("Adj meg egy landing page linket, vagy másold be a szövegét.");
      return;
    }
    setBusy(true);
    setFb(null); setG(null);
    const endpoint = platform === "google" ? "/api/real-estate/google-ads" : "/api/real-estate/fb-ads";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), text: manualText.trim() }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.needsText) setShowText(true);
        throw new Error(d.error || "A generálás nem sikerült.");
      }
      if (platform === "google") {
        setG(d.result as GoogleAdsResult);
      } else {
        setFb(d.result as FbAdsResult);
        setFbDrafts(d.result as FbAdsResult);
      }
      showToast("A hirdetésszövegek elkészültek.", "success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const PlatformBtn = ({ value, label }: { value: Platform; label: string }) => {
    const on = platform === value;
    return (
      <button type="button" onClick={() => setPlatform(value)}
        className="flex-1 rounded-xl px-4 py-2 text-sm font-medium"
        style={on
          ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" }
          : { background: "#fff", border: "1px solid var(--twx-line)" }}>
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <section className="twx-card p-5 sm:p-6">
        <p className="text-sm font-semibold">Platform</p>
        <div className="mt-2 flex gap-2">
          <PlatformBtn value="facebook" label="Facebook hirdetés" />
          <PlatformBtn value="google" label="Google Ads (keresési)" />
        </div>

        <p className="mt-4 text-sm font-semibold">A hirdetett ingatlan</p>
        <p className="mt-0.5 mb-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Illeszd be a landing page (hirdetés) nyilvános linkjét. Ha az oldal nem érhető el,
          másold be helyette a hirdetés szövegét.
        </p>

        <label className="block">
          <span className="mb-1 block text-xs font-medium">Landing page linkje</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="twx-input w-full" />
        </label>

        <button type="button" onClick={() => setShowText((v) => !v)}
          className="mt-2 text-xs font-medium" style={{ color: "var(--twx-coral)" }}>
          {showText ? "– Szöveg elrejtése" : "+ Inkább bemásolom a szöveget"}
        </button>

        {showText && (
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-medium">A hirdetés szövege</span>
            <textarea value={manualText} onChange={(e) => setManualText(e.target.value)}
              rows={7} placeholder="Másold ide a hirdetés címét és teljes leírását…" className="twx-input w-full" />
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
          {busy ? "Generálás folyamatban…" : `${platform === "google" ? "Google Ads szövegek" : "Facebook szövegek"} generálása (${FBADS_CREDITS} kredit)`}
        </button>
      </section>

      {/* --- FACEBOOK EREDMÉNY --- */}
      {fb && (
        <section className="space-y-4">
          {fb.title && <p className="text-sm font-semibold">{fb.title}</p>}
          {FB_STYLES.map((s) => (
            <div key={s.key} className="twx-card p-4 sm:p-5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{s.label}</h3>
                <button type="button" onClick={() => copy(fbDrafts[s.key])}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
                  Másolás
                </button>
              </div>
              <p className="mb-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{s.note}</p>
              <textarea value={fbDrafts[s.key]}
                onChange={(e) => setFbDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                rows={s.key === "short" ? 5 : 10} className="twx-input w-full text-sm leading-relaxed" />
            </div>
          ))}
          <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
            A szövegek szerkeszthetők. A [szögletes zárójeles] helyeket töltsd ki, a link-helyőrzőt cseréld a hirdetés linkjére.
          </p>
        </section>
      )}

      {/* --- GOOGLE ADS EREDMÉNY --- */}
      {g && (
        <section className="space-y-4">
          {g.title && <p className="text-sm font-semibold">{g.title}</p>}

          {g.headlines.length > 0 && (
            <div className="twx-card p-4 sm:p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Címsorok <span style={{ color: "var(--twx-ink-muted)" }}>(≤{GADS_HEADLINE_MAX} karakter)</span></h3>
                <button type="button" onClick={() => copy(g.headlines.join("\n"), "Címsorok másolva.")}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>Mind másolása</button>
              </div>
              <ul className="space-y-1.5">
                {g.headlines.map((h, i) => {
                  const over = h.length > GADS_HEADLINE_MAX;
                  return (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm" style={{ border: "1px solid var(--twx-line)" }}>
                      <span className="min-w-0 flex-1 truncate">{h}</span>
                      <span className="shrink-0 text-[11px]" style={{ color: over ? "#c0392b" : "var(--twx-ink-muted)" }}>{h.length}/{GADS_HEADLINE_MAX}</span>
                      <button type="button" onClick={() => copy(h)} className="shrink-0 text-[11px] font-medium" style={{ color: "var(--twx-coral)" }}>másolás</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {g.descriptions.length > 0 && (
            <div className="twx-card p-4 sm:p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Leírások <span style={{ color: "var(--twx-ink-muted)" }}>(≤{GADS_DESC_MAX} karakter)</span></h3>
                <button type="button" onClick={() => copy(g.descriptions.join("\n"), "Leírások másolva.")}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>Mind másolása</button>
              </div>
              <ul className="space-y-1.5">
                {g.descriptions.map((d, i) => {
                  const over = d.length > GADS_DESC_MAX;
                  return (
                    <li key={i} className="flex items-start justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm" style={{ border: "1px solid var(--twx-line)" }}>
                      <span className="min-w-0 flex-1">{d}</span>
                      <span className="shrink-0 text-[11px]" style={{ color: over ? "#c0392b" : "var(--twx-ink-muted)" }}>{d.length}/{GADS_DESC_MAX}</span>
                      <button type="button" onClick={() => copy(d)} className="shrink-0 text-[11px] font-medium" style={{ color: "var(--twx-coral)" }}>másolás</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {g.keywords.length > 0 && (
            <div className="twx-card p-4 sm:p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Célzott kulcsszavak</h3>
                <button type="button" onClick={() => copy(g.keywords.join("\n"), "Kulcsszavak másolva.")}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>Mind másolása</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.keywords.map((k, i) => (
                  <span key={i} className="rounded-full px-3 py-1 text-xs" style={{ background: "#f2f9f5", border: "1px solid #bfe0cd" }}>{k}</span>
                ))}
              </div>
            </div>
          )}

          {g.negatives.length > 0 && (
            <div className="twx-card p-4 sm:p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Kizáró kulcsszavak</h3>
                <button type="button" onClick={() => copy(g.negatives.join("\n"), "Kizáró kulcsszavak másolva.")}
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>Mind másolása</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.negatives.map((k, i) => (
                  <span key={i} className="rounded-full px-3 py-1 text-xs" style={{ background: "#fdf3f2", border: "1px solid #e6bdb8" }}>{k}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
