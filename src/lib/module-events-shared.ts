// Modul-események (ME2) — közös típus és lista (kliens ÉS szerver is használja; nincs benne "use client").
export const MODULE_EVENTS = ["form_start", "run_start", "run_success", "run_error", "download", "share"] as const;
export type ModuleEvent = (typeof MODULE_EVENTS)[number];
