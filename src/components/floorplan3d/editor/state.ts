// A javító szerkesztő közös állapota: kijelölés, eszköz, visszavonás (2026-10-16).
// A terv (FloorPlan) a stúdióban él (onnan mentődik automatikusan); a szerkesztő a módosításait a `useHistory` hookon át
// adja vissza: commit = egy visszavonható lépés; begin/live/end = húzás (élő frissítés, a végén EGY lépés).
"use client";

import { useCallback, useRef, useState } from "react";
import type { FloorPlan, OpeningPreset } from "@/lib/floorplan3d/plan";

export type Selection =
  | { type: "room"; roomId: string }
  | { type: "edge"; roomId: string; edge: number }
  | { type: "vertex"; roomId: string; index: number }
  | { type: "opening"; id: string }
  | { type: "column"; id: string }
  | null;

export type Tool = "select" | "wall" | "door" | "window" | "column";
export type ViewMode = "2d" | "split" | "3d";

/** Lerakásra váró nyílászáró (a palettán választott méret) — a szellemkép ezzel rajzolódik. */
export type Pending = OpeningPreset | null;

/** A szellemkép (lerakás előtt): hol lenne és szabályos-e. */
export type Ghost = { roomId: string; edge: number; offset: number; valid: boolean; reason?: string } | null;

export type History = {
  commit: (next: FloorPlan) => void;
  begin: () => void;
  live: (next: FloorPlan) => void;
  end: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  count: number;
};

const MAX = 100;

export function useHistory(plan: FloorPlan, setPlan: (p: FloorPlan) => void): History {
  const past = useRef<FloorPlan[]>([]);
  const future = useRef<FloorPlan[]>([]);
  const snapshot = useRef<FloorPlan | null>(null);
  const current = useRef(plan);
  current.current = plan;
  const [, bump] = useState(0);
  const touch = () => bump((v) => v + 1);

  const commit = useCallback((next: FloorPlan) => {
    if (next === current.current) return;
    past.current.push(current.current);
    if (past.current.length > MAX) past.current.shift();
    future.current = [];
    current.current = next; // a következő művelet már ezt lássa (még a megjelenítés előtt is)
    setPlan(next); touch();
  }, [setPlan]);
  const begin = useCallback(() => { if (!snapshot.current) snapshot.current = current.current; }, []);
  const live = useCallback((next: FloorPlan) => { current.current = next; setPlan(next); }, [setPlan]);
  const end = useCallback(() => {
    const s = snapshot.current;
    snapshot.current = null;
    if (!s || s === current.current || JSON.stringify(s) === JSON.stringify(current.current)) return;
    past.current.push(s);
    if (past.current.length > MAX) past.current.shift();
    future.current = []; touch();
  }, []);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(current.current);
    current.current = prev;
    setPlan(prev); touch();
  }, [setPlan]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(current.current);
    current.current = next;
    setPlan(next); touch();
  }, [setPlan]);
  return { commit, begin, live, end, undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, count: past.current.length };
}
