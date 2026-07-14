// dashboard/real-estate/visualization — Látványtervező (helységenkénti konfig, wireframe).
// Kép kiválasztása -> helység (kötelező) + opcionális változók. Kész-jelzés a kártyán.
// Generálás csak akkor aktív, ha MINDEN kép kész. Animáció/nagyítás: 7. dizájn-fázis.
"use client";

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

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
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
      <h1 className="font-display text-3xl font-semibold">Ingatlan Látványtervező</h1>
      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Tölts fel max. {MAX_IMAGES} képet. Kattints egy képre, add meg a helységet
        (kötelező) és a kívánt módosításokat (opcionális). Egy ingatlan = 1 kredit.
      </p>

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
            <select
              value={current.config.roomType}
              onChange={(e) => updateConfig({ roomType: e.target.value })}
              className="twx-input"
            >
              <option value="">— Válassz helységet —</option>
              {ROOM_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Stílus (opcionális)">
            <select
              value={current.config.style}
              onChange={(e) => updateConfig({ style: e.target.value })}
              className="twx-input"
            >
              {STYLE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="twx-input"
      >
        <option value="">— Válassz —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
