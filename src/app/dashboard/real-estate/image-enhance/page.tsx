// dashboard/real-estate/image-enhance — Egyszerű képjavító.
// Max 4 ingatlanfotó feltöltése; a tartalom NEM változik, csak a minőség (mód szerint
// enyhe rendrakással). Nano Banana image-to-image a háttérben.
"use client";

import { useRef, useState } from "react";
import ModuleIntro from "@/components/ModuleIntro";
import { showToast } from "@/components/Toast";
import { compressImage } from "@/lib/image-compress";
import {
  ENHANCE_MODES, MAX_IMAGES, ALLOWED_IMAGE_TYPES,
  type EnhanceMode,
} from "@/lib/image-enhance";

type Pick = { file: File; url: string };

// Supabase publikus URL letöltésre kényszerítve (nem új lapon nyílik).
const dl = (url: string) => `${url}${url.includes("?") ? "&" : "?"}download=twinx-kep.jpg`;

export default function ImageEnhancePage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [mode, setMode] = useState<EnhanceMode>("feljavitas");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => ALLOWED_IMAGE_TYPES.includes(f.type));
    if (!incoming.length) { showToast("Csak JPG, PNG vagy WEBP tölthető fel.", "error"); return; }
    setPicks((prev) => {
      const room = MAX_IMAGES - prev.length;
      if (room <= 0) { showToast(`Legfeljebb ${MAX_IMAGES} kép.`, "info"); return prev; }
      const added = incoming.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }));
      return [...prev, ...added];
    });
  }

  function removePick(i: number) {
    setPicks((prev) => prev.filter((_, j) => j !== i));
  }

  async function run() {
    if (!picks.length) { showToast("Tölts fel legalább egy képet.", "error"); return; }
    setLoading(true);
    setResults([]);
    try {
      const fd = new FormData();
      fd.append("mode", mode);
      for (const p of picks) fd.append("images", await compressImage(p.file, 1600, 0.85));

      const res = await fetch("/api/real-estate/image-enhance", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? data.errors?.images ?? "A feldolgozás nem sikerült.", "error");
        return;
      }
      setResults(data.urls ?? []);
      showToast(data.charged ? "Kész! 1 kredit levonva." : "Kész! (ingyenes hozzáférés)", "success");
    } catch {
      showToast("Hálózati hiba. Próbáld újra.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <ModuleIntro
        eyebrow="Ingatlan · Fotó"
        title="Képjavító"
        subtitle="Töltsd fel az ingatlanfotókat (max 4), és a Twinx feljavítja a képminőséget — fény, szín, élesség —, opcionálisan a látható rendetlenséget is eltakarítja. Az ingatlanon semmit nem változtatunk: a kép hű marad a valósághoz. Egy feldolgozás 1 kredit."
        icon="visualization"
        chips={["Max 4 kép", "Fény & élesség", "Hű a valósághoz"]}
      />

      <section className="twx-card space-y-5 p-5 sm:p-6">
        {/* Mód-választó */}
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Mit csináljunk a képpel?</label>
          <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ENHANCE_MODES.map((m) => {
              const on = mode === m.value;
              return (
                <button key={m.value} type="button" onClick={() => setMode(m.value)}
                  className="rounded-xl p-4 text-left transition"
                  style={on
                    ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)" }
                    : { background: "#fff", border: "1px solid var(--twx-line)" }}>
                  <div className="font-display text-base font-medium" style={{ color: on ? "#7a2e17" : "var(--twx-ink)" }}>{m.label}</div>
                  <div className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{m.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Feltöltő */}
        <div>
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>Fotók ({picks.length}/{MAX_IMAGES})</label>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className="mt-1 cursor-pointer rounded-xl border-2 border-dashed p-5 text-center text-sm transition-colors"
            style={{ borderColor: dragOver ? "var(--twx-coral)" : "var(--twx-line)", background: dragOver ? "rgba(239,122,90,0.06)" : "transparent", color: "var(--twx-ink-muted)" }}
          >
            Húzd ide a képeket, vagy kattints a tallózáshoz — JPG, PNG, WEBP (max {MAX_IMAGES} kép)
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
          </div>

          {picks.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {picks.map((p, i) => (
                <div key={p.url} className="relative overflow-hidden rounded-lg" style={{ border: "1px solid var(--twx-line)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="Feltöltött fotó" className="h-24 w-full object-cover" />
                  <button type="button" onClick={() => removePick(i)} aria-label="Eltávolítás"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-sm"
                    style={{ background: "rgba(20,12,8,0.6)", color: "#fff" }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={run} disabled={loading || !picks.length}
          className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--twx-coral)" }}>
          {loading ? "Feldolgozás… (néhány másodperc képenként)" : `Képek feljavítása (1 kredit)`}
        </button>
        <p className="text-center text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          A feljavított kép hű marad a valósághoz — publikálás előtt érdemes átnézni.
        </p>
      </section>

      {/* Eredmény */}
      {results.length > 0 && (
        <section className="twx-card space-y-4 p-5 sm:p-6">
          <h3 className="font-display text-lg font-medium">Eredmény</h3>
          <div className="grid grid-cols-1 gap-4">
            {results.map((url, i) => (
              <div key={url} className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>Eredeti</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {picks[i] && <img src={picks[i].url} alt="Eredeti" className="w-full rounded-lg object-cover" style={{ border: "1px solid var(--twx-line)" }} />}
                </div>
                <div>
                  <p className="mb-1 text-xs" style={{ color: "var(--twx-coral)" }}>Feljavított</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Feljavított" className="w-full rounded-lg object-cover" style={{ border: "1px solid var(--twx-coral)" }} />
                  <a href={dl(url)} download="twinx-kep.jpg"
                    className="mt-2 inline-block rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{ border: "1px solid var(--twx-coral)", color: "var(--twx-coral)" }}>
                    Letöltés
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
