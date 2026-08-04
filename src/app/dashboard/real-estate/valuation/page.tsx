// dashboard/real-estate/valuation — Ingatlan Értékbecslő (14 mezős, wireframe).
// A partner bevált eszköze alapján. Sorrend: űrlap validáció -> API.
"use client";
import ModuleIntro from "@/components/ModuleIntro";
import ComboField from "@/components/ComboField";
import SelectField from "@/components/SelectField";

import ValuationEditor from "@/components/valuation/ValuationEditor";
import FolderLibrary, {
  type LibraryFolder,
  type LibraryItem,
} from "@/components/library/FolderLibrary";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  parseValuationReport,
  reportTitle,
  type ReportDoc,
  type ValuationFacts,
} from "@/lib/valuation-report";
import {
  VALUATION_FIELDS,
  EMPTY_VALUATION,
  validateValuationInput,
  LOCATION_CATEGORIES,
  LOCATION_PREMIUM_MIN,
  LOCATION_PREMIUM_MAX,
  isPremiumCategory,
  suggestedLocationPremium,
  type ValuationInput,
} from "@/lib/valuation";
import { toDownloadUrl } from "@/lib/files";

// A lokációs prémium mezői külön blokkban jelennek meg, ezért kimaradnak a fő rácsból.
const LOCATION_KEYS: string[] = ["lokacioKategoria", "lokacioSzazalek"];

type HistoryItem = {
  id: string;
  input_data: Record<string, unknown> | null;
  output_text: string | null;
  output_file_url: string | null;
  created_at: string;
  edited_at: string | null;
  valuation_folder_id: string | null;
};

// A FolderLibrary-nek megfelelő elem (a nyers becslés-adattal együtt).
type ValItem = LibraryItem & {
  outputText: string | null;
  url: string | null;
  editedAt: string | null;
};

type EditorState = {
  id: string | null;
  doc: ReportDoc;
  url: string | null;
  dateLabel: string;
};

function historyTitle(h: HistoryItem): string {
  return reportTitle((h.input_data ?? {}) as ValuationFacts);
}

export default function ValuationPage() {
  const [values, setValues] = useState<ValuationInput>({ ...EMPTY_VALUATION });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EditorState | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/real-estate/valuation/history");
      const data = await res.json();
      if (res.ok) {
        setHistory((data.items ?? []) as HistoryItem[]);
        setFolders((data.folders ?? []) as LibraryFolder[]);
      }
    } catch {
      // Az előzmény-lista hiánya ne akadályozza a munkát.
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!editorOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editorOpen]);

  function closeEditor() {
    // A szerkesztő állapota bezáráskor elveszik — nem mentett módosításnál kérdezünk.
    if (
      editorDirty &&
      !window.confirm("Vannak nem mentett módosítások. Biztosan bezárod?")
    )
      return;
    setEditorDirty(false);
    setEditorOpen(false);
  }

  function openHistoryItem(h: HistoryItem) {
    if (!h.output_text) return;
    const facts = (h.input_data ?? {}) as ValuationFacts;
    setResult({
      id: h.id,
      doc: parseValuationReport(h.output_text, facts),
      url: h.output_file_url,
      dateLabel: new Date(h.created_at).toLocaleDateString("hu-HU"),
    });
    setEditorOpen(true);
  }

  // A könyvtár elemei (hónap- és saját mappákba rendezve).
  const libraryItems: ValItem[] = history.map((h) => ({
    id: h.id,
    title: historyTitle(h),
    createdAt: h.created_at,
    folderId: h.valuation_folder_id,
    outputText: h.output_text,
    url: h.output_file_url,
    editedAt: h.edited_at,
  }));

  function openLibItem(v: ValItem) {
    const h = history.find((x) => x.id === v.id);
    if (h) openHistoryItem(h);
  }

  async function manage(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "A művelet nem sikerült.");
    await loadHistory();
    return d as { folder?: LibraryFolder };
  }

  function setField(key: keyof ValuationInput, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);
    setMessage(null);
    setResult(null);

    const check = validateValuationInput(values);
    setErrors(check.errors);
    if (!check.valid) {
      setServerError("Tölts ki minden kötelező mezőt.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/real-estate/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        setServerError(data.error ?? "Hiba történt a feldolgozás során.");
        return;
      }
      if (data.report) {
        setResult({
          id: data.id ?? null,
          doc: parseValuationReport(String(data.report), values as ValuationFacts),
          url: null,
          dateLabel: new Date().toLocaleDateString("hu-HU"),
        });
        setEditorOpen(true);
      }
      setMessage("Kész! Nézd át, szerkeszd, majd készítsd el a PDF-et.");
      loadHistory();
    } catch {
      setServerError("Hálózati hiba. Próbáld újra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <ModuleIntro
        eyebrow="Ingatlan · Elemzés"
        title="Ingatlan értékbecslés"
        subtitle="Adatalapú, védhető piaci ár percek alatt — a legfontosabb paraméterekből profi, ügyfélnek is átadható becslés. A csillagos (*) mezők kötelezők, egy becslés 1 kredit."
        icon="valuation"
        chips={["Adatalapú", "Percek alatt", "PDF-riport"]}
      />

      <form onSubmit={onSubmit} noValidate className="twx-card space-y-4 p-5 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VALUATION_FIELDS.filter((f) => !LOCATION_KEYS.includes(f.key)).map((field) => (
            <div
              key={field.key}
              className={field.fullWidth ? "sm:col-span-2" : ""}
            >
              <label htmlFor={field.key} className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
                {field.label}
                {field.required && <span style={{ color: "var(--twx-coral)" }}> *</span>}
              </label>
              {field.options ? (
                <ComboField
                  id={field.key}
                  className="mt-1 w-full"
                  value={values[field.key]}
                  onChange={(v) => setField(field.key, v)}
                  options={field.options}
                  placeholder={field.placeholder}
                />
              ) : (
                <input
                  id={field.key}
                  type="text"
                  value={values[field.key]}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="twx-input mt-1"
                />
              )}
              {errors[field.key] && (
                <p className="mt-1 text-xs text-red-600">{errors[field.key]}</p>
              )}
            </div>
          ))}
        </div>

        {/* --- Lokációs prémium: külön blokk, mert a partner helyismerete adja. --- */}
        <div className="rounded-xl p-4" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
          <p className="text-sm font-semibold">Lokációs prémium korrekció</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Ha az ingatlan keresett vagy kiemelten prémium környéken van, a piaci átlagárat
            felfelé korrigáljuk. A százalékot te adod meg — te ismered a mikrolokációt.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
                Lokációs kategória
              </span>
              <SelectField
                value={values.lokacioKategoria}
                onChange={(v) => {
                  setField("lokacioKategoria", v);
                  // Prémium kategóriánál a csúszka a sávra jellemző értékről indul.
                  setField("lokacioSzazalek", isPremiumCategory(v) ? String(suggestedLocationPremium(v)) : "");
                }}
                ariaLabel="Lokációs kategória"
                options={LOCATION_CATEGORIES.map((c) => ({ value: c.value, label: `${c.value} · ${c.range}` }))}
              />
              {/* A magyarázat a mező ALATT teljes hosszban — a legördülőben levágódna. */}
              <span className="mt-1 block text-[11px] leading-snug" style={{ color: "var(--twx-ink-muted)" }}>
                {LOCATION_CATEGORIES.find((c) => c.value === values.lokacioKategoria)?.hint}
              </span>
            </label>

            {isPremiumCategory(values.lokacioKategoria) && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
                  Felár mértéke ({LOCATION_PREMIUM_MIN}-{LOCATION_PREMIUM_MAX}%) — ajánlott:{" "}
                  {LOCATION_CATEGORIES.find((c) => c.value === values.lokacioKategoria)?.range}
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={LOCATION_PREMIUM_MIN}
                    max={LOCATION_PREMIUM_MAX}
                    step={1}
                    value={Number(values.lokacioSzazalek) || LOCATION_PREMIUM_MIN}
                    onChange={(e) => setField("lokacioSzazalek", e.target.value)}
                    className="flex-1"
                    style={{ accentColor: "var(--twx-coral)" }}
                  />
                  <span className="w-14 text-right text-sm font-bold" style={{ color: "var(--twx-coral)" }}>
                    {Number(values.lokacioSzazalek) || LOCATION_PREMIUM_MIN}%
                  </span>
                </div>
              </label>
            )}
          </div>

          {isPremiumCategory(values.lokacioKategoria) && (
            <p className="mt-2 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
              A becslés külön sorban mutatja majd a százalékot, a forintos különbséget és a korrigált árat.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="twx-btn w-full"
        >
          {loading ? "Feldolgozás… (akár 30-60 mp)" : "Ingatlan értékbecslés indítása"}
        </button>
        <p className="text-center text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Költség: <strong>1 kredit</strong> / értékbecslés.
        </p>
      </form>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      {/* Kész becslés — kártya, ami megnyitja a szerkeszthető előnézetet */}
      {result && (
        <div className="twx-card flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{result.doc.title}</p>
            <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
              {result.doc.subtitle || "Elkészült értékbecslés"} · szerkeszthető
            </p>
          </div>
          <button type="button" className="twx-btn" onClick={() => setEditorOpen(true)}>
            Megnyitás és szerkesztés
          </button>
          {result.url && (
            <a className="twx-btn-outline" href={toDownloadUrl(result.url)}>
              PDF letöltése
            </a>
          )}
        </div>
      )}

      {/* Korábbi értékbecslések — hónap szerinti és saját mappákban */}
      {history.length > 0 && (
        <section className="twx-card p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Korábbi értékbecslések</h2>
          <p className="mt-0.5 mb-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Hónap szerinti és saját mappákba rendezve. Nyiss meg egy mappát, ott
            megnyithatod, szerkesztheted, letöltheted, áthelyezheted vagy törölheted a becsléseket.
          </p>
          <FolderLibrary<ValItem>
            items={libraryItems}
            folders={folders}
            noun="értékbecslés"
            emptyText="Még nincs elkészült értékbecslésed."
            downloadUrl={(v) => (v.url ? toDownloadUrl(v.url) : null)}
            renderItem={(v) => (
              <div className="space-y-1.5">
                <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  {new Date(v.createdAt).toLocaleString("hu-HU")}
                  {v.editedAt ? " · szerkesztve" : ""}
                  {v.url ? "" : " · nincs még PDF"}
                </p>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  style={{ background: "var(--twx-coral)" }}
                  onClick={() => openLibItem(v)}
                  disabled={!v.outputText}
                >
                  Megnyitás
                </button>
              </div>
            )}
            onCreateFolder={async (name) => {
              const d = await manage("/api/real-estate/valuation/manage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
              });
              return d.folder;
            }}
            onMove={(id, folderId) =>
              manage("/api/real-estate/valuation/manage", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, folderId }),
              })
            }
            onDelete={(v) =>
              manage(`/api/real-estate/valuation/manage?id=${v.id}&kind=item`, { method: "DELETE" })
            }
            onRenameFolder={(id, name) =>
              manage("/api/real-estate/valuation/manage", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, name }),
              })
            }
            onDeleteFolder={(id) =>
              manage(`/api/real-estate/valuation/manage?id=${id}&kind=folder`, { method: "DELETE" })
            }
          />
        </section>
      )}

      {/* Szerkesztő ablak */}
      {editorOpen && result && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
          style={{ background: "rgba(12,11,10,0.88)" }}
        >
          <div
            className="w-full max-w-4xl rounded-2xl p-4"
            style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Értékbecslés szerkesztése</p>
                <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  Amit itt látsz, pontosan az kerül a PDF-be.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                aria-label="Bezárás"
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
                style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}
              >
                ×
              </button>
            </div>

            <ValuationEditor
              key={result.id ?? "new"}
              historyId={result.id}
              initialDoc={result.doc}
              initialUrl={result.url}
              dateLabel={result.dateLabel}
              onDirtyChange={setEditorDirty}
              onSaved={(url) => {
                setResult((prev) => (prev ? { ...prev, url } : prev));
                loadHistory();
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
