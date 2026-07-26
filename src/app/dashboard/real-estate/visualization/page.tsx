// dashboard/real-estate/visualization — Látványtervező (helységenkénti konfig, wireframe).
// Kép kiválasztása -> helység (kötelező) + opcionális változók. Kész-jelzés a kártyán.
// Generálás csak akkor aktív, ha MINDEN kép kész. Animáció/nagyítás: 7. dizájn-fázis.
"use client";
import ModuleIntro from "@/components/ModuleIntro";
import SelectField from "@/components/SelectField";
import AssetTray, { readTwxDragUrl } from "@/components/AssetTray";

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { toDownloadUrl } from "@/lib/files";
import { compressImage } from "@/lib/image-compress";
import {
  ROOM_TYPES,
  STYLE_OPTIONS,
  WALL_COLORS,
  WALL_COVERINGS,
  FLOORINGS,
  FURNISHINGS,
  LIGHT_MOODS,
  MAX_IMAGES,
  MAX_NOTE_LENGTH,
  EMPTY_ROOM_CONFIG,
  validateImageFiles,
  isRoomConfigReady,
  type RoomConfig,
  type Option,
} from "@/lib/visualization";

type Item = { file: File; url: string; config: RoomConfig };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export default function VisualizationPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);

  // Feljavított képek átvétele a Képjavítóból (letöltés/visszatöltés nélkül).
  const [pickerOpen, setPickerOpen] = useState(false);
  const [enhUrls, setEnhUrls] = useState<string[]>([]);
  const [enhLoading, setEnhLoading] = useState(false);
  const [enhSel, setEnhSel] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const closeViewer = useCallback(() => setViewer(null), []);
  const moveViewer = useCallback(
    (dir: number) =>
      setViewer((i) => {
        if (i === null) return i;
        const n = i + dir;
        return n < 0 || n >= resultUrls.length ? i : n;
      }),
    [resultUrls.length]
  );

  useEffect(() => {
    if (viewer === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
      else if (e.key === "ArrowLeft") moveViewer(-1);
      else if (e.key === "ArrowRight") moveViewer(1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [viewer, closeViewer, moveViewer]);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList).map((file) => ({
      file,
      url: URL.createObjectURL(file),
      config: { ...EMPTY_ROOM_CONFIG },
    }));
    setItems((prev) => [...prev, ...incoming].slice(0, MAX_IMAGES));
  }

  function removeAt(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setSelected(null);
  }

  // Feljavított képek betöltése a választóba (a Képjavító előzményéből).
  async function openPicker() {
    setPickerOpen(true);
    setEnhSel([]);
    if (enhUrls.length) return;
    setEnhLoading(true);
    try {
      const res = await fetch("/api/real-estate/image-enhance");
      const data = await res.json();
      if (res.ok) {
        const urls: string[] = [];
        for (const j of (data.jobs ?? [])) {
          for (const it of (j.items ?? [])) if (it?.enhanced) urls.push(it.enhanced as string);
        }
        setEnhUrls([...new Set(urls)]);
      }
    } catch {
      /* előzmény nélkül is működik */
    } finally {
      setEnhLoading(false);
    }
  }
  const toggleEnh = (u: string) =>
    setEnhSel((s) => (s.includes(u) ? s.filter((x) => x !== u) : [...s, u]));

  // URL-ekből letölti a képeket és felveszi a feldolgozandók közé (Képjavító/tálca átvétel).
  async function importUrls(urls: string[]) {
    const room = MAX_IMAGES - items.length;
    if (room <= 0) {
      setServerError(`Legfeljebb ${MAX_IMAGES} kép dolgozható fel egyszerre.`);
      return 0;
    }
    const chosen = urls.filter((u) => !items.some((it) => it.url === u)).slice(0, room);
    if (!chosen.length) return 0;
    setImporting(true);
    try {
      const newItems: Item[] = [];
      for (let i = 0; i < chosen.length; i++) {
        try {
          const r = await fetch(chosen[i]);
          if (!r.ok) continue;
          const blob = await r.blob();
          const file = new File([blob], `atvett-${Date.now()}-${i}.jpg`, { type: blob.type || "image/jpeg" });
          newItems.push({ file, url: chosen[i], config: { ...EMPTY_ROOM_CONFIG } });
        } catch { /* egy kép kihagyása ne állítsa meg a többit */ }
      }
      if (newItems.length) {
        setItems((prev) => [...prev, ...newItems].slice(0, MAX_IMAGES));
        setServerError(null);
      } else {
        setServerError("A kiválasztott képek betöltése nem sikerült.");
      }
      return newItems.length;
    } finally {
      setImporting(false);
    }
  }

  // A választó ablakból kijelölt feljavított képek hozzáadása.
  async function addSelectedEnh() {
    await importUrls(enhSel);
    setEnhSel([]);
    setPickerOpen(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    // Tálcából húzott kép (URL) VAGY a gépről húzott fájlok.
    const url = readTwxDragUrl(e.dataTransfer);
    if (url) { void importUrls([url]); return; }
    addFiles(e.dataTransfer.files);
  }

  function updateConfig(patch: Partial<RoomConfig>) {
    if (selected === null) return;
    setItems((prev) =>
      prev.map((it, i) =>
        i === selected ? { ...it, config: { ...it.config, ...patch } } : it
      )
    );
  }

  const allReady =
    items.length > 0 && items.every((it) => isRoomConfigReady(it.config));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setMessage(null);
    setResultUrls([]);

    const fileError = validateImageFiles(items.map((it) => it.file));
    if (fileError) {
      setServerError(fileError);
      return;
    }
    if (!allReady) {
      setServerError(
        "Minden képhez adj meg helységtípust és legalább egy módosítást."
      );
      return;
    }

    setLoading(true);
    try {
      // Feltöltés előtt kicsinyítjük a képeket (Vercel ~4,5 MB kérés-limit).
      const compressed = await Promise.all(items.map((it) => compressImage(it.file)));
      const fd = new FormData();
      compressed.forEach((f) => fd.append("images", f));
      fd.append("configs", JSON.stringify(items.map((it) => it.config)));

      const res = await fetch("/api/real-estate/visualization", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Hiba történt a generálás során.");
        return;
      }
      if (Array.isArray(data.urls)) setResultUrls(data.urls);
      setMessage(`Kész! ${data.urls?.length ?? 0} látványterv elkészült.`);
    } catch {
      setServerError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  const current = selected !== null ? items[selected] : null;

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <ModuleIntro
        eyebrow="Ingatlan · Vizuál"
        title="Ingatlan Látványtervező"
        subtitle={`Üres vagy elavult szobákból fotórealisztikus, berendezett látványterv — hogy a vevő elképzelje a potenciált. Tölts fel max. ${MAX_IMAGES} képet, add meg a helységet, a többit az AI hozza. Egy ingatlan = 1 kredit.`}
        icon="visualization"
        chips={["Fotórealisztikus", "Bútorozás", "Helységenként"]}
      />

      {/* Feltöltő zóna */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className="cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm"
        style={{
          borderColor: dragOver ? "var(--twx-coral)" : "var(--twx-line)",
          background: dragOver ? "var(--twx-cream-card)" : "transparent",
        }}
      >
        <span style={{ color: "var(--twx-ink-muted)" }}>
          Húzd ide a képeket, vagy kattints a tallózáshoz (JPG / PNG / WEBP, max. 10 MB,
          max. {MAX_IMAGES})
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* Átvétel a Képjavítóból — nincs letöltés/visszatöltés */}
      <button
        type="button"
        onClick={openPicker}
        className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition hover:shadow-sm"
        style={{ borderColor: "var(--twx-line)", color: "var(--twx-coral)", background: "#fff" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="18" height="18" rx="2" /><path d="m3 15 5-5 4 4 3-3 6 6" /><circle cx="8.5" cy="8.5" r="1.5" />
        </svg>
        Válassz a feljavított képeidből
      </button>

      {/* Kép-kártyák */}
      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {items.map((it, i) => {
            const ready = isRoomConfigReady(it.config);
            return (
              <div
                key={it.url}
                onClick={() => setSelected(i)}
                className="relative cursor-pointer rounded-lg border-2"
                style={{ borderColor: selected === i ? "var(--twx-coral)" : "transparent" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={`Kép ${i + 1}`} className="h-20 w-full object-cover" />
                <span
                  className="absolute left-0 top-0 px-1 text-xs text-white"
                  style={{ background: ready ? "#16a34a" : "var(--twx-ink-muted)" }}
                >
                  {ready ? "kész" : "beállít"}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAt(i);
                  }}
                  className="absolute right-0 top-0 px-1 text-xs"
                  style={{ background: "var(--twx-coral)", color: "#1c1005" }}
                  aria-label="Törlés"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Konfig panel a kiválasztott képhez */}
      {current && (
        <div className="twx-card space-y-3 p-4">
          <h2 className="font-display font-medium">
            {(selected ?? 0) + 1}. kép beállításai
          </h2>

          <Field label="Helység típusa (kötelező)">
            <SelectField
              value={current.config.roomType}
              onChange={(v) => updateConfig({ roomType: v })}
              placeholder="— Válassz helységet —"
              options={[{ value: "", label: "— Válassz helységet —" }, ...ROOM_TYPES.map((r) => ({ value: r.value, label: r.label }))]}
            />
          </Field>

          <Field label="Stílus (opcionális)">
            <SelectField
              value={current.config.style}
              onChange={(v) => updateConfig({ style: v })}
              options={STYLE_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
            />
            {current.config.style && SUPABASE_URL && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${SUPABASE_URL}/storage/v1/object/public/references/${current.config.style}/nappali.png`}
                alt="Stílus minta"
                className="mt-2 max-h-28 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </Field>

          <Field label="Falszín (opcionális)">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => updateConfig({ wallColor: "" })}
                className="h-7 rounded border px-2 text-xs"
                style={{ borderColor: current.config.wallColor === "" ? "var(--twx-coral)" : "var(--twx-line)" }}
              >
                nincs
              </button>
              {WALL_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => updateConfig({ wallColor: c.value })}
                  className="h-7 w-7 rounded-full border-2"
                  style={{
                    backgroundColor: c.hex,
                    borderColor:
                      current.config.wallColor === c.value
                        ? "var(--twx-coral)"
                        : "var(--twx-line)",
                  }}
                />
              ))}
            </div>
          </Field>

          <OptionSelect
            label="Falburkolat (opcionális)"
            options={WALL_COVERINGS}
            value={current.config.wallCovering}
            onChange={(v) => updateConfig({ wallCovering: v })}
          />
          <OptionSelect
            label="Padlóburkolat (opcionális)"
            options={FLOORINGS}
            value={current.config.flooring}
            onChange={(v) => updateConfig({ flooring: v })}
          />
          <OptionSelect
            label="Berendezettség (opcionális)"
            options={FURNISHINGS}
            value={current.config.furnishing}
            onChange={(v) => updateConfig({ furnishing: v })}
          />
          <OptionSelect
            label="Fény-hangulat (opcionális)"
            options={LIGHT_MOODS}
            value={current.config.lightMood}
            onChange={(v) => updateConfig({ lightMood: v })}
          />

          <Field label="Megjegyzés (opcionális)">
            <textarea
              value={current.config.note}
              onChange={(e) => updateConfig({ note: e.target.value })}
              rows={2}
              maxLength={MAX_NOTE_LENGTH}
              className="twx-input"
              placeholder="pl. növények, meleg tónusok"
            />
          </Field>
        </div>
      )}

      {/* Generálás */}
      <form onSubmit={onSubmit}>
        <button
          type="submit"
          disabled={loading || !allReady}
          className="twx-btn w-full"
        >
          {loading
            ? "Generálás…"
            : allReady
              ? "Látványtervek generálása"
              : "Állítsd be az összes képet"}
        </button>
      </form>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {resultUrls.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-display font-medium">Eredmény</h2>
          <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Kattints egy képre a nagyításhoz és letöltéshez.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {resultUrls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setViewer(i)}
                className="overflow-hidden rounded-xl transition-opacity hover:opacity-90"
                style={{ border: "1px solid var(--twx-line)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Látványterv ${i + 1}`} className="w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Közös tálca: korábbi munkák mappákban + kedvencek */}
      <AssetTray
        onPick={(u) => void importUrls([u])}
        selectedUrls={items.map((it) => it.url)}
        note="Válassz egy mappát, majd húzd a képet a fenti feltöltőre, vagy kattints rá a hozzáadáshoz."
      />

      {/* Feljavított képek választó ablak */}
      {pickerOpen && (
        <div
          onClick={() => !importing && setPickerOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,12,8,0.5)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
            style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
          >
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--twx-line)" }}>
              <div className="font-display text-lg font-semibold">Feljavított képeim</div>
              <button onClick={() => setPickerOpen(false)} disabled={importing} className="rounded-lg px-2 py-1 text-xl disabled:opacity-40" style={{ color: "var(--twx-ink-muted)" }} aria-label="Bezár">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {enhLoading ? (
                <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
              ) : enhUrls.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                  Még nincs feljavított képed. Előbb használd a Képjavító modult, utána itt egyből ki tudod választani őket.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {enhUrls.map((u) => {
                    const on = enhSel.includes(u);
                    return (
                      <button key={u} type="button" onClick={() => toggleEnh(u)}
                        className="relative overflow-hidden rounded-lg border-2"
                        style={{ borderColor: on ? "var(--twx-coral)" : "var(--twx-line)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Feljavított kép" className="h-24 w-full object-cover" />
                        {on && (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{ background: "var(--twx-coral)", color: "#1c1005" }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t p-4" style={{ borderColor: "var(--twx-line)" }}>
              <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                {enhSel.length} kiválasztva · max {MAX_IMAGES} kép egyszerre
              </span>
              <button
                type="button"
                onClick={addSelectedEnh}
                disabled={importing || enhSel.length === 0}
                className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--twx-coral)" }}
              >
                {importing ? "Hozzáadás…" : "Hozzáadás a látványtervezőhöz"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nézegető ablak */}
      {viewer !== null && resultUrls[viewer] && (
        <div
          onClick={closeViewer}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(12,11,10,0.85)" }}
        >
          {resultUrls.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); moveViewer(-1); }}
              disabled={viewer === 0}
              aria-label="Előző"
              className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-2xl"
              style={{ background: "rgba(255,255,255,0.1)", color: "#fff", opacity: viewer === 0 ? 0.3 : 1 }}
            >
              ‹
            </button>
          )}

          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] max-w-[92vw] flex-col items-center gap-3">
            <div className="relative inline-block overflow-hidden rounded-xl" style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultUrls[viewer]}
                alt="Látványterv"
                className="max-h-[80vh] max-w-[92vw] object-contain"
              />
              {/* Vízjel-réteg (a kép keretein belülre vágva) */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-around"
                style={{ transform: "rotate(-22deg)" }}
              >
                {Array.from({ length: 3 }).map((_, k) => (
                  <span
                    key={k}
                    style={{
                      fontSize: "clamp(22px, 4vw, 46px)",
                      fontWeight: 800,
                      letterSpacing: "8px",
                      color: "rgba(255,255,255,0.22)",
                      textShadow: "0 2px 10px rgba(0,0,0,0.35)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    TWINX
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={toDownloadUrl(resultUrls[viewer])}
                className="rounded-full px-5 py-2 text-sm font-medium"
                style={{ background: "var(--twx-coral)", color: "#1c1005" }}
              >
                Letöltés
              </a>
              <button
                type="button"
                onClick={() => {
                  setSelected(viewer);
                  setViewer(null);
                }}
                className="rounded-full px-5 py-2 text-sm font-medium"
                style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
              >
                Módosítás
              </button>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                {viewer + 1} / {resultUrls.length}
              </span>
            </div>
          </div>

          {resultUrls.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); moveViewer(1); }}
              disabled={viewer === resultUrls.length - 1}
              aria-label="Következő"
              className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-2xl"
              style={{ background: "rgba(255,255,255,0.1)", color: "#fff", opacity: viewer === resultUrls.length - 1 ? 0.3 : 1 }}
            >
              ›
            </button>
          )}

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeViewer(); }}
            aria-label="Bezárás"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-xl"
            style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function OptionSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <SelectField
        value={value}
        onChange={onChange}
        placeholder="— Válassz —"
        options={[{ value: "", label: "— Válassz —" }, ...options.map((o) => ({ value: o.value, label: o.label }))]}
      />
    </Field>
  );
}
