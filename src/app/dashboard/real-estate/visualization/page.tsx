// dashboard/real-estate/visualization — Ingatlan Látványtervező (wireframe).
// Üzleti szabály: 1 ingatlan = 1 kredit, max. 8 képpel (a köteg egyben).
// Sorrend: űrlap (képek + stílus + megjegyzés) validáció -> API.
"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  STYLE_OPTIONS,
  validateImageFiles,
  MAX_IMAGES,
  MAX_NOTE_LENGTH,
} from "@/lib/visualization";

type Picked = { file: File; url: string };

export default function VisualizationPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Picked[]>([]);
  const [style, setStyle] = useState("");
  const [note, setNote] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    // Max. 8 kép összesen.
    setItems((prev) => [...prev, ...incoming].slice(0, MAX_IMAGES));
  }

  function removeAt(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setMessage(null);
    setResultUrls([]);

    const files = items.map((it) => it.file);

    // 1) Kliensoldali validáció
    const nextErrors: Record<string, string> = {};
    const imagesError = validateImageFiles(files);
    if (imagesError) nextErrors.images = imagesError;
    if (note.length > MAX_NOTE_LENGTH) {
      nextErrors.note = `A megjegyzés legfeljebb ${MAX_NOTE_LENGTH} karakter lehet.`;
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // 2) API bekötés (multipart/form-data, több kép)
    setLoading(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("images", f);
      fd.append("style", style);
      fd.append("note", note);

      const res = await fetch("/api/real-estate/visualization", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Hiba történt a feldolgozás során.");
        return;
      }
      if (Array.isArray(data.urls)) setResultUrls(data.urls);
      setMessage(
        data.message ??
          `Kész! ${data.urls?.length ?? 0} látványterv elkészült.`
      );
    } catch {
      setServerError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">Ingatlan Látványtervező</h1>
      <p className="text-sm text-gray-500">
        Tölts fel az ingatlanról max. {MAX_IMAGES} képet, válassz stílust (vagy csak
        felújítást), és adj hozzá opcionális megjegyzést. Egy ingatlan (a teljes köteg)
        1 kredit — admin/sales díjmentes.
      </p>

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {/* Drag-and-drop zóna */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed p-6 text-center text-sm ${
            dragOver ? "border-gray-800 bg-gray-50" : "border-gray-300"
          }`}
        >
          <span className="text-gray-500">
            Húzd ide a képeket, vagy kattints a tallózáshoz (JPG / PNG / WEBP, max. 10 MB /
            kép, max. {MAX_IMAGES} kép)
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

        {items.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {items.map((it, i) => (
              <div key={it.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.url}
                  alt={`Kép ${i + 1}`}
                  className="h-20 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="absolute right-0 top-0 bg-gray-800 px-1 text-xs text-white"
                  aria-label="Törlés"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400">
          {items.length}/{MAX_IMAGES} kép kiválasztva
        </p>
        {errors.images && <p className="text-xs text-red-600">{errors.images}</p>}

        {/* Stílus */}
        <div>
          <label htmlFor="style" className="block text-sm">
            Stílus
          </label>
          <select
            id="style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full border border-gray-300 p-2 text-sm"
          >
            {STYLE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {errors.style && <p className="mt-1 text-xs text-red-600">{errors.style}</p>}
        </div>

        {/* Megjegyzés */}
        <div>
          <label htmlFor="note" className="block text-sm">
            Megjegyzés (opcionális)
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            className="w-full border border-gray-300 p-2 text-sm"
            placeholder="pl. világos tónusok, fa padló, növények"
          />
          <p className="text-xs text-gray-400">
            {note.length}/{MAX_NOTE_LENGTH}
          </p>
          {errors.note && <p className="text-xs text-red-600">{errors.note}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full border border-gray-800 bg-gray-800 p-2 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Feldolgozás…" : "Látványterv generálása"}
        </button>
      </form>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {resultUrls.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-medium">Eredmény</h2>
          <div className="grid grid-cols-2 gap-2">
            {resultUrls.map((url, i) => (
              <div key={url} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Látványterv ${i + 1}`}
                  className="w-full object-cover"
                />
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs underline"
                >
                  Letöltés
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
