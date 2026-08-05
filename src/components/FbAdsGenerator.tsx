// Hirdetésszöveg-generátor — egy landing page link alapján. Két szerep választható:
//  • Facebook: 3 stílusú B2C hirdetésszöveg (szerkeszthető, másolható).
//  • Google Ads (PPC): reszponzív keresési hirdetés címsorai/leírásai + kulcsszólista.
"use client";

import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/components/Toast";
import { useFieldMemory, FieldSuggestions } from "@/components/field-memory";
import { FBADS_CREDITS, EMPTY_FBADS, type FbAdsResult } from "@/lib/fbads";
import {
  type GoogleAdsResult, type GoogleAdsAd, EMPTY_GOOGLE_ADS_AD,
  parseGoogleAdsCsvClient, serializeGoogleAdsCsv,
} from "@/lib/googleads";

// A „egy kattintással feltöltés a Google Ads-ba" funkció parkolópályán — később
// kapcsoljuk élesre. A backend (OAuth + upload route) készen áll.
const GADS_DIRECT_UPLOAD_ENABLED = false;

type Platform = "facebook" | "google";

type HistoryItem = {
  id: string;
  feature_used: "fb-ads" | "google-ads";
  input_data: { url?: string | null; title?: string | null } | null;
  output_text: string | null;
  created_at: string;
};

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

  // Mező-memória: a korábban beírt link / szöveg felajánlása.
  const urlMem = useFieldMemory("adtext:url", { min: 6 });
  const textMem = useFieldMemory("adtext:manualText", { min: 12 });
  const [urlFocus, setUrlFocus] = useState(false);
  const [textFocus, setTextFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fb, setFb] = useState<FbAdsResult | null>(null);
  const [fbDrafts, setFbDrafts] = useState<FbAdsResult>({ ...EMPTY_FBADS });
  const [g, setG] = useState<GoogleAdsResult | null>(null);
  const [gAd, setGAd] = useState<GoogleAdsAd | null>(null);
  const [showRawCsv, setShowRawCsv] = useState(false);

  // A generált/előzményből betöltött CSV-ből szerkeszthető nézetet állítunk elő.
  function applyGoogle(csv: string) {
    setG({ csv });
    setGAd(parseGoogleAdsCsvClient(csv) ?? { ...EMPTY_GOOGLE_ADS_AD });
  }
  // A letöltéshez/másoláshoz a szerkesztett mezőkből újraépítjük a CSV-t.
  const currentCsv = () => (gAd ? serializeGoogleAdsCsv(gAd) : g?.csv ?? "");

  // --- Google Ads közvetlen feltöltés ---
  type Conn = { configured: boolean; connected: boolean; customerId: string | null };
  const [conn, setConn] = useState<Conn | null>(null);
  const [upBudget, setUpBudget] = useState("2000");
  const [upEnd, setUpEnd] = useState("");
  const [upLoc, setUpLoc] = useState("");
  const [upCustomer, setUpCustomer] = useState("");
  const [uploading, setUploading] = useState(false);

  const loadConnection = useCallback(async () => {
    try {
      const res = await fetch("/api/real-estate/google-ads/connection");
      const d = await res.json();
      if (res.ok) setConn(d as Conn);
    } catch { /* összekötés nélkül is látszik a CSV */ }
  }, []);
  useEffect(() => { void loadConnection(); }, [loadConnection]);

  // OAuth visszatérés jelzése
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = new URLSearchParams(window.location.search).get("gads");
    if (!s) return;
    if (s === "connected") showToast("A Google Ads fiók összekötve.", "success");
    else if (s === "norefresh") showToast("Nem kaptunk frissítő tokent — próbáld újra, és add meg a hozzáférést.", "error");
    else if (s === "error") showToast("A Google Ads összekötés nem sikerült.", "error");
    window.history.replaceState({}, "", window.location.pathname);
    void loadConnection();
  }, [loadConnection]);

  async function uploadToGoogle() {
    if (!g) return;
    if (!upBudget.trim() || Number(upBudget) <= 0) { showToast("Adj meg egy napi keretet (HUF).", "error"); return; }
    if (!upEnd.trim()) { showToast("Adj meg egy lejárati dátumot.", "error"); return; }
    setUploading(true);
    try {
      const res = await fetch("/api/real-estate/google-ads/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: currentCsv(),
          dailyBudgetHuf: Number(upBudget),
          endDate: upEnd,
          location: upLoc.trim(),
          customerId: upCustomer.replace(/\D/g, "") || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.needsConnect) showToast("Előbb kösd össze a Google Ads fiókot.", "error");
        throw new Error(d.error || "A feltöltés nem sikerült.");
      }
      showToast("Kampány létrehozva a Google Ads-ban (szüneteltetve). Ellenőrizd, majd indítsd.", "success");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setUploading(false);
    }
  }

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/real-estate/fb-ads");
      const d = await res.json();
      if (res.ok) setHistory((d.items ?? []) as HistoryItem[]);
    } catch { /* lista nélkül is használható */ }
  }, []);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  function openHistory(it: HistoryItem) {
    if (!it.output_text) return;
    if (it.feature_used === "google-ads") {
      setPlatform("google");
      setFb(null);
      applyGoogle(it.output_text);
    } else {
      try {
        const r = JSON.parse(it.output_text) as FbAdsResult;
        setPlatform("facebook");
        setG(null); setGAd(null);
        setFb(r);
        setFbDrafts(r);
      } catch {
        showToast("Ezt az elemet nem sikerült megnyitni.", "error");
        return;
      }
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function histTitle(it: HistoryItem): string {
    return (
      it.input_data?.title?.trim() ||
      (it.input_data?.url ? it.input_data.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60) : "Bemásolt szöveg")
    );
  }

  const copy = (t: string, msg = "Vágólapra másolva.") =>
    void navigator.clipboard.writeText(t).then(
      () => showToast(msg, "success"),
      () => showToast("A másolás nem sikerült.", "error")
    );

  function downloadCsv(csv: string) {
    // UTF-8 BOM az ékezetek miatt (Excel/Google Ads Editor barát).
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "google-ads-kampany.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  async function generate() {
    setError(null);
    if (!url.trim() && !manualText.trim()) {
      setError("Adj meg egy landing page linket, vagy másold be a szövegét.");
      return;
    }
    setBusy(true);
    setFb(null); setG(null); setGAd(null); setShowRawCsv(false);
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
        applyGoogle((d.result as GoogleAdsResult).csv);
      } else {
        setFb(d.result as FbAdsResult);
        setFbDrafts(d.result as FbAdsResult);
      }
      if (url.trim()) urlMem.remember(url.trim());
      if (manualText.trim()) textMem.remember(manualText.trim());
      showToast("A hirdetésszövegek elkészültek.", "success");
      void loadHistory();
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
          <div className="relative">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="twx-input w-full"
              onFocus={() => setUrlFocus(true)} onBlur={() => setUrlFocus(false)} />
            <FieldSuggestions open={urlFocus} value={url} items={urlMem.items}
              onPick={(v) => setUrl(v)} onRemove={urlMem.remove} />
          </div>
        </label>

        <button type="button" onClick={() => setShowText((v) => !v)}
          className="mt-2 block text-left text-xs font-medium" style={{ color: "var(--twx-coral)" }}>
          {showText ? "– Szöveg elrejtése" : "+ Inkább bemásolom a szöveget"}
        </button>

        {showText && (
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-medium">A hirdetés szövege</span>
            <div className="relative">
              <textarea value={manualText} onChange={(e) => setManualText(e.target.value)}
                onFocus={() => setTextFocus(true)} onBlur={() => setTextFocus(false)}
                rows={7} placeholder="Másold ide a hirdetés címét és teljes leírását…" className="twx-input w-full" />
              <FieldSuggestions open={textFocus} value={manualText} items={textMem.items}
                onPick={(v) => setManualText(v)} onRemove={textMem.remove} />
            </div>
            <span className="mt-1 block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
              Ha ezt kitöltöd, a linket nem próbáljuk megnyitni — ebből dolgozunk.
            </span>
          </label>
        )}

        {error && (
          <p className="mt-3 rounded-lg p-2 text-xs" style={{ background: "#fdecea", color: "#c0392b" }}>{error}</p>
        )}

        <button type="button" onClick={generate} disabled={busy}
          className="mt-4 block rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
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

      {/* --- GOOGLE ADS EREDMÉNY: szerkeszthető szöveg + letölthető CSV --- */}
      {gAd && (
        <section className="space-y-4">
          <div className="twx-card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Google Ads keresési hirdetés</h3>
                <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  Szerkeszthető szövegek — a címsorok max 30, a leírások max 90 karakter. A letöltött CSV a szerkesztett szöveget tartalmazza.
                </p>
              </div>
              <button type="button" onClick={() => downloadCsv(currentCsv())}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
                CSV letöltése (Google Ads Editor)
              </button>
            </div>

            {/* Címsorok */}
            <p className="mb-1 text-xs font-semibold">Címsorok (Headlines)</p>
            <div className="space-y-2">
              {gAd.headlines.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={h} maxLength={30}
                    onChange={(e) => setGAd((p) => p ? { ...p, headlines: p.headlines.map((x, idx) => idx === i ? e.target.value.slice(0, 30) : x) } : p)}
                    className="twx-input w-full text-sm" />
                  <span className="w-10 shrink-0 text-right text-[11px]" style={{ color: h.length > 30 ? "#c0392b" : "var(--twx-ink-muted)" }}>{h.length}/30</span>
                  <button type="button" aria-label="Törlés"
                    onClick={() => setGAd((p) => p ? { ...p, headlines: p.headlines.filter((_, idx) => idx !== i) } : p)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>✕</button>
                </div>
              ))}
            </div>
            {gAd.headlines.length < 15 && (
              <button type="button" onClick={() => setGAd((p) => p ? { ...p, headlines: [...p.headlines, ""] } : p)}
                className="mt-2 text-xs font-medium" style={{ color: "var(--twx-coral)" }}>+ Címsor</button>
            )}

            {/* Leírások */}
            <p className="mb-1 mt-4 text-xs font-semibold">Leírások (Descriptions)</p>
            <div className="space-y-2">
              {gAd.descriptions.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <textarea value={d} maxLength={90} rows={2}
                    onChange={(e) => setGAd((p) => p ? { ...p, descriptions: p.descriptions.map((x, idx) => idx === i ? e.target.value.slice(0, 90) : x) } : p)}
                    className="twx-input w-full text-sm" />
                  <span className="w-10 shrink-0 pt-2 text-right text-[11px]" style={{ color: d.length > 90 ? "#c0392b" : "var(--twx-ink-muted)" }}>{d.length}/90</span>
                  <button type="button" aria-label="Törlés"
                    onClick={() => setGAd((p) => p ? { ...p, descriptions: p.descriptions.filter((_, idx) => idx !== i) } : p)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>✕</button>
                </div>
              ))}
            </div>
            {gAd.descriptions.length < 4 && (
              <button type="button" onClick={() => setGAd((p) => p ? { ...p, descriptions: [...p.descriptions, ""] } : p)}
                className="mt-2 text-xs font-medium" style={{ color: "var(--twx-coral)" }}>+ Leírás</button>
            )}

            {/* Végső URL */}
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-semibold">Végső URL (Final URL)</span>
              <input value={gAd.finalUrl} placeholder="https://…"
                onChange={(e) => setGAd((p) => p ? { ...p, finalUrl: e.target.value } : p)}
                className="twx-input w-full text-sm" />
            </label>
          </div>

          {/* Kulcsszavak */}
          <div className="twx-card p-4 sm:p-5">
            <p className="mb-1 text-xs font-semibold">Kulcsszavak</p>
            <p className="mb-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
              Egyezési típus: Phrase (kifejezés), Exact (pontos) vagy Broad (általános).
            </p>
            <div className="space-y-2">
              {gAd.keywords.map((k, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={k.text}
                    onChange={(e) => setGAd((p) => p ? { ...p, keywords: p.keywords.map((x, idx) => idx === i ? { ...x, text: e.target.value } : x) } : p)}
                    className="twx-input w-full text-sm" />
                  <select value={/exact/i.test(k.criterionType) ? "Exact" : /broad/i.test(k.criterionType) ? "Broad" : "Phrase"}
                    onChange={(e) => setGAd((p) => p ? { ...p, keywords: p.keywords.map((x, idx) => idx === i ? { ...x, criterionType: e.target.value } : x) } : p)}
                    className="twx-input shrink-0 text-xs" style={{ width: 92 }}>
                    <option>Phrase</option><option>Exact</option><option>Broad</option>
                  </select>
                  <button type="button" aria-label="Törlés"
                    onClick={() => setGAd((p) => p ? { ...p, keywords: p.keywords.filter((_, idx) => idx !== i) } : p)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>✕</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setGAd((p) => p ? { ...p, keywords: [...p.keywords, { text: "", criterionType: "Phrase" }] } : p)}
              className="mt-2 text-xs font-medium" style={{ color: "var(--twx-coral)" }}>+ Kulcsszó</button>
          </div>

          {/* Nyers CSV + import útmutató */}
          <div className="twx-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setShowRawCsv((v) => !v)}
                className="text-xs font-semibold" style={{ color: "var(--twx-coral)" }}>
                {showRawCsv ? "– Nyers CSV elrejtése" : "+ Nyers CSV megtekintése"}
              </button>
              <button type="button" onClick={() => copy(currentCsv(), "CSV a vágólapon.")}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                CSV másolása
              </button>
            </div>
            {showRawCsv && (
              <textarea readOnly value={currentCsv()} rows={12}
                className="twx-input mt-3 w-full text-[11px] leading-relaxed"
                style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "pre" }} />
            )}
            <p className="mt-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
              Importálás: Google Ads Editor → Account → Import → From file → a letöltött <b>.csv</b>. A kampány „Paused”, ellenőrzés után indítható.
            </p>
          </div>

          {/* --- KÖZVETLEN FELTÖLTÉS (parkolópályán, később kapcsoljuk élesre) --- */}
          {GADS_DIRECT_UPLOAD_ENABLED && g && (
            <div className="twx-card p-4 sm:p-5" style={{ background: "var(--twx-coral-soft)" }}>
              <h4 className="text-sm font-semibold">Feltöltés egy kattintással a Google Ads-ba</h4>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                A rendszer közvetlenül létrehozza a kampányt a saját Google Ads fiókodban — mindig <b>szüneteltetve</b>.
              </p>
              {conn?.configured && !conn.connected && (
                <a href="/api/real-estate/google-ads/oauth/start"
                  className="mt-3 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: "var(--twx-coral)" }}>
                  Google Ads fiók összekötése
                </a>
              )}
              {conn?.configured && conn.connected && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium">Napi keret (HUF)</span>
                      <input value={upBudget} onChange={(e) => setUpBudget(e.target.value)} inputMode="numeric" className="twx-input w-full" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium">Lejárati dátum</span>
                      <input type="date" value={upEnd} onChange={(e) => setUpEnd(e.target.value)} className="twx-input w-full" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium">Célzott település (opcionális)</span>
                      <input value={upLoc} onChange={(e) => setUpLoc(e.target.value)} placeholder="pl. Budapest" className="twx-input w-full" />
                    </label>
                    {!conn.customerId && (
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium">Google Ads ügyfél-ID</span>
                        <input value={upCustomer} onChange={(e) => setUpCustomer(e.target.value)} placeholder="123-456-7890" className="twx-input w-full" />
                      </label>
                    )}
                  </div>
                  <button type="button" onClick={uploadToGoogle} disabled={uploading}
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "var(--twx-coral)" }}>
                    {uploading ? "Feltöltés folyamatban…" : "Feltöltés a Google Ads-ba (szüneteltetve)"}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* --- KORÁBBI GENERÁLÁSOK --- */}
      {history.length > 0 && (
        <section className="twx-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold">Korábbi generálások</h3>
          <p className="mt-0.5 mb-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Nyiss meg egy korábbi eredményt — a szövegek/CSV újra megjelennek fent.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {history.map((it) => {
              const isG = it.feature_used === "google-ads";
              return (
                <button key={it.id} type="button" onClick={() => openHistory(it)}
                  className="flex items-center justify-between gap-2 rounded-xl p-3 text-left transition hover:shadow-sm"
                  style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                  <span className="min-w-0">
                    <span className="mb-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={isG
                        ? { background: "#e8f0fe", color: "#1a56c4" }
                        : { background: "#eef3ff", color: "#3b5998" }}>
                      {isG ? "Google Ads" : "Facebook"}
                    </span>
                    <span className="block truncate text-xs font-medium">{histTitle(it)}</span>
                    <span className="block text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                      {new Date(it.created_at).toLocaleString("hu-HU")}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold" style={{ color: "var(--twx-coral)" }}>Megnyitás</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
