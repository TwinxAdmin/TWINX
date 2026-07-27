// dashboard/real-estate/visualization — Látványtervező (helységenkénti konfig, wireframe).
// Kép kiválasztása -> helység (kötelező) + opcionális változók. Kész-jelzés a kártyán.
// Generálás csak akkor aktív, ha MINDEN kép kész. Animáció/nagyítás: 7. dizájn-fázis.
"use client";
import ModuleIntro from "@/components/ModuleIntro";
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

  // Korábbi képek átvétele (az alsó tálcából) — letöltés/visszatöltés nélkül.
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

  // URL-ekből letölti a képeket és felveszi a feldolgozandók közé (tálca átvétel).
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


      {/* Kép-kártyák */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((it, i) => {
            const ready = isRoomConfigReady(it.config);
            const active = selected === i;
            return (
              <figure
                key={it.url}
                onClick={() => setSelected(i)}
                className="group relative cursor-pointer overflow-hidden rounded-xl bg-white transition hover:shadow-md"
                style={{
                  border: `1px solid ${active ? "var(--twx-coral)" : "var(--twx-line)"}`,
                  boxShadow: active ? "0 4px 16px rgba(239,122,90,0.18)" : "0 2px 10px rgba(20,12,8,0.06)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={`Kép ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="text-[11px] font-medium" style={{ color: "var(--twx-ink-muted)" }}>{i + 1}. kép</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={ready
                      ? { background: "rgba(22,163,74,0.12)", color: "#15803d" }
                      : { background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                    {ready ? "kész" : "beállít"}
                  </span>
                </figcaption>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeAt(i); }}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-sm opacity-0 shadow transition group-hover:opacity-100"
                  style={{ background: "rgba(255,255,255,0.95)", color: "var(--twx-ink)" }}
                  aria-label="Törlés"
                >
                  ×
                </button>
              </figure>
            );
          })}
        </div>
      )}

      {/* Konfig panel a kiválasztott képhez */}
      {current && (
        <div className="twx-card space-y-5 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-medium">{(selected ?? 0) + 1}. kép beállításai</h2>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={isRoomConfigReady(current.config)
                ? { background: "rgba(22,163,74,0.12)", color: "#15803d" }
                : { background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
              {isRoomConfigReady(current.config) ? "Kész a generálásra" : "Válassz helységet"}
            </span>
          </div>

          {/* Helység — kötelező, chipes választás */}
          <Section title="Helység típusa" required>
            <ChipRow
              options={ROOM_TYPES.map((r) => ({ value: r.value, label: r.label }))}
              value={current.config.roomType}
              onChange={(v) => updateConfig({ roomType: v })}
            />
          </Section>

          {/* Stílus — képes kártyák */}
          <Section title="Stílus" hint="Válassz hangulatot, vagy hagyd üresen, ha csak a lenti módosításokat kéred.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {STYLE_OPTIONS.map((s) => (
                <StyleCard
                  key={s.value || "none"}
                  label={s.value ? s.label : "Nincs stílus"}
                  styleSlug={s.value}
                  roomSlug={ROOM_TYPES.find((r) => r.value === current.config.roomType)?.slug ?? "nappali"}
                  active={current.config.style === s.value}
                  onClick={() => updateConfig({ style: s.value })}
                />
              ))}
            </div>
          </Section>

          {/* Falszín — színkorongok névvel */}
          <Section title="Falszín">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => updateConfig({ wallColor: "" })}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition"
                style={current.config.wallColor === ""
                  ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" }
                  : { background: "#fff", border: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                Nincs
              </button>
              {WALL_COLORS.map((c) => {
                const on = current.config.wallColor === c.value;
                return (
                  <button key={c.value} type="button" title={c.label} onClick={() => updateConfig({ wallColor: c.value })}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full transition"
                    style={{ backgroundColor: c.hex, border: on ? "2px solid var(--twx-coral)" : "1px solid var(--twx-line)", boxShadow: on ? "0 0 0 3px rgba(239,122,90,0.18)" : "none" }}>
                    {on && <span className="text-sm font-bold" style={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* További opciók — chipek */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Section title="Falburkolat">
              <ChipRow options={WALL_COVERINGS} value={current.config.wallCovering} onChange={(v) => updateConfig({ wallCovering: v })} allowEmpty />
            </Section>
            <Section title="Padlóburkolat">
              <ChipRow options={FLOORINGS} value={current.config.flooring} onChange={(v) => updateConfig({ flooring: v })} allowEmpty />
            </Section>
            <Section title="Berendezettség">
              <ChipRow options={FURNISHINGS} value={current.config.furnishing} onChange={(v) => updateConfig({ furnishing: v })} allowEmpty />
            </Section>
            <Section title="Fény-hangulat">
              <ChipRow options={LIGHT_MOODS} value={current.config.lightMood} onChange={(v) => updateConfig({ lightMood: v })} allowEmpty />
            </Section>
          </div>

          <Section title="Megjegyzés" hint="Bármi egyedi kérés — pl. növények, meleg tónusok.">
            <textarea
              value={current.config.note}
              onChange={(e) => updateConfig({ note: e.target.value })}
              rows={2}
              maxLength={MAX_NOTE_LENGTH}
              className="twx-input w-full"
              placeholder="pl. növények, meleg tónusok"
            />
          </Section>
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

/** Beállítás-szekció címmel és opcionális magyarázattal. */
function Section({ title, hint, required, children }: { title: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold">{title}</span>
        {required && <span className="text-[11px] font-medium" style={{ color: "var(--twx-coral)" }}>kötelező</span>}
      </div>
      {hint && <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Chipes választás — egy kattintás, jól látható kiválasztás. */
function ChipRow({ options, value, onChange, allowEmpty }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  const chip = (v: string, label: string) => {
    const on = value === v;
    return (
      <button key={v || "none"} type="button" onClick={() => onChange(on && allowEmpty ? "" : v)}
        className="rounded-full px-3 py-1.5 text-xs font-medium transition hover:shadow-sm"
        style={on
          ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" }
          : { background: "#fff", border: "1px solid var(--twx-line)", color: "var(--twx-ink)" }}>
        {label}
      </button>
    );
  };
  return (
    <div className="flex flex-wrap gap-2">
      {allowEmpty && chip("", "Nincs")}
      {options.filter((o) => o.value).map((o) => chip(o.value, o.label))}
    </div>
  );
}

/** Képes stílus-kártya — a referencia-képből mintát mutat, ha van. */
function StyleCard({ label, styleSlug, roomSlug, active, onClick }: {
  label: string; styleSlug: string; roomSlug: string; active: boolean; onClick: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const src = styleSlug && SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/references/${styleSlug}/${roomSlug}.png`
    : "";
  return (
    <button type="button" onClick={onClick}
      className="group overflow-hidden rounded-xl text-left transition hover:shadow-md"
      style={{
        border: `1px solid ${active ? "var(--twx-coral)" : "var(--twx-line)"}`,
        boxShadow: active ? "0 4px 16px rgba(239,122,90,0.18)" : "none",
        background: "#fff",
      }}>
      <div className="relative aspect-[4/3] w-full overflow-hidden" style={{ background: "var(--twx-cream)" }}>
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="h-full w-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
            {styleSlug ? "nincs minta" : "eredeti stílus"}
          </div>
        )}
        {active && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: "var(--twx-coral)", color: "#1c1005" }}>✓</span>
        )}
      </div>
      <div className="px-2 py-1.5 text-[11px] font-semibold" style={{ color: active ? "#7a2e17" : "var(--twx-ink)" }}>{label}</div>
    </button>
  );
}
