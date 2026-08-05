// Hirdetésszöveg-generátor — egy landing page link alapján. Két szerep választható:
//  • Facebook: 3 stílusú B2C hirdetésszöveg (szerkeszthető, másolható).
//  • Google Ads (PPC): reszponzív keresési hirdetés címsorai/leírásai + kulcsszólista.
"use client";

import { useCallback, useEffect, useState } from "react";
import { showToast } from "@/components/Toast";
import { FBADS_CREDITS, EMPTY_FBADS, type FbAdsResult } from "@/lib/fbads";
import { type GoogleAdsResult } from "@/lib/googleads";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fb, setFb] = useState<FbAdsResult | null>(null);
  const [fbDrafts, setFbDrafts] = useState<FbAdsResult>({ ...EMPTY_FBADS });
  const [g, setG] = useState<GoogleAdsResult | null>(null);

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
          csv: g.csv,
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
      setG({ csv: it.output_text });
    } else {
      try {
        const r = JSON.parse(it.output_text) as FbAdsResult;
        setPlatform("facebook");
        setG(null);
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

      {/* --- GOOGLE ADS EREDMÉNY: importálható CSV --- */}
      {g && (
        <section className="twx-card p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Google Ads kampány (CSV)</h3>
              <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                Pontosvesszős CSV — közvetlenül a Google Ads Editorba importálható (Search, „Konkrét Ingatlanok”, Paused).
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => downloadCsv(g.csv)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--twx-coral)" }}>
                CSV letöltése
              </button>
              <button type="button" onClick={() => copy(g.csv, "CSV a vágólapon.")}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                Másolás
              </button>
            </div>
          </div>
          <textarea readOnly value={g.csv} rows={14}
            className="twx-input w-full text-[11px] leading-relaxed"
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "pre" }} />
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
            Importálás: Google Ads Editor → Account → Import → From file. A kampány „Paused”, ellenőrzés után indítható.
          </p>

          {/* --- KÖZVETLEN FELTÖLTÉS A GOOGLE ADS-BA --- */}
          <div className="mt-4 rounded-xl p-4" style={{ border: "1px solid var(--twx-line)", background: "var(--twx-coral-soft)" }}>
            <h4 className="text-sm font-semibold">Feltöltés egy kattintással a Google Ads-ba</h4>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
              Kézi importálás helyett a rendszer közvetlenül létrehozza a kampányt a saját Google Ads fiókodban —
              mindig <b>szüneteltetve</b>, hogy ellenőrizd, mielőtt élesítenéd.
            </p>

            {conn && !conn.configured && (
              <p className="mt-2 rounded-lg p-2 text-[11px]" style={{ background: "#fff7ed", color: "#9a3412" }}>
                A közvetlen feltöltés még nincs bekapcsolva (fejlesztői token / OAuth kliens hiányzik). Addig a CSV-import működik.
              </p>
            )}

            {conn?.configured && !conn.connected && (
              <a href="/api/real-estate/google-ads/oauth/start"
                className="mt-3 inline-block rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "var(--twx-coral)" }}>
                Google Ads fiók összekötése
              </a>
            )}

            {conn?.configured && conn.connected && (
              <div className="mt-3 space-y-3">
                <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  Összekötött fiók: <b>{conn.customerId ? conn.customerId : "add meg az ügyfél-ID-t"}</b>
                </p>
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
