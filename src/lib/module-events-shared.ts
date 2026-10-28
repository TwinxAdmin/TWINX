// Modul-események (ME2) — közös típus és lista (kliens ÉS szerver is használja; nincs benne "use client").
export const MODULE_EVENTS = ["form_start", "run_start", "run_success", "run_error", "download", "share"] as const;
export type ModuleEvent = (typeof MODULE_EVENTS)[number];

/**
 * Hibaok a run_error eseményhez — az admin „Modul elemzés" ebből mutatja, MI volt a baj:
 *   „<kód> · HTTP <állapot> · <a szerver / böngésző üzenete>" (legfeljebb 200 karakter).
 * A kód elöl marad (start_failed, job_failed, http, network…), így a régi, csak kódos sorokkal is összevethető.
 */
export function failDetail(code: string, info: { status?: number; message?: unknown } = {}): string {
  const msg = typeof info.message === "string" ? info.message.replace(/\s+/g, " ").trim() : "";
  return [code, info.status ? `HTTP ${info.status}` : "", msg].filter(Boolean).join(" · ").slice(0, 200);
}
