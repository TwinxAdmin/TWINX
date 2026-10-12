// Modul-események (ME2) — KLIENS-segéd a tölcsér-méréshez. A modulok ezeket hívják; a felhasználó semmit nem lát belőle.
//
// Használat egy modulban:
//   const track = useModuleTracker("/dashboard/real-estate/valuation");
//   <form onInput={track.formStarted}> …                         → form_start (oldal-megnyitásonként egyszer)
//   const run = track.runStarted();                              → run_start (visszaad egy futtatás-azonosítót + órát)
//   … siker esetén: run.succeeded()  /  hiba esetén: run.failed("timeout")   → run_success / run_error + futási idő
//   letöltésnél: track.downloaded()  ·  megosztásnál: track.shared()
// Szerver: POST /api/track/module-event (20261012191016_module-events.sql). Minden hívás „tüzel és felejt" —
// hiba esetén sem zavar.
"use client";

import { useCallback, useMemo, useRef } from "react";
import type { ModuleEvent } from "@/lib/module-events-shared";

export function sendModuleEvent(module: string, event: ModuleEvent, extra: { runId?: string; durationMs?: number; detail?: string } = {}) {
  try {
    void fetch("/api/track/module-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module, event, ...extra }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // a mérés soha nem akaszthatja meg a modult
  }
}

function newRunId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // tartalék (régi böngésző): RFC4122 v4-szerű azonosító
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export type RunHandle = { runId: string; succeeded: () => void; failed: (detail?: string) => void };

export function useModuleTracker(module: string) {
  const formSent = useRef(false);

  const formStarted = useCallback(() => {
    if (formSent.current) return;
    formSent.current = true;
    sendModuleEvent(module, "form_start");
  }, [module]);

  const runStarted = useCallback((): RunHandle => {
    const runId = newRunId();
    const t0 = performance.now();
    let done = false;
    sendModuleEvent(module, "run_start", { runId });
    const finish = (event: "run_success" | "run_error", detail?: string) => {
      if (done) return;
      done = true;
      sendModuleEvent(module, event, { runId, durationMs: Math.round(performance.now() - t0), detail });
    };
    return { runId, succeeded: () => finish("run_success"), failed: (detail?: string) => finish("run_error", detail) };
  }, [module]);

  const downloaded = useCallback(() => sendModuleEvent(module, "download"), [module]);
  const shared = useCallback(() => sendModuleEvent(module, "share"), [module]);

  return useMemo(() => ({ formStarted, runStarted, downloaded, shared }), [formStarted, runStarted, downloaded, shared]);
}
