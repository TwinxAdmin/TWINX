// Munkatípus-jelölések: melyik képen milyen munka ment végbe.
// Ugyanaz az ikon jelenik meg a mód-kártyákon, a mappák bélyegképein és a nagy nézetben.
"use client";

export type WorkKind = "feljavitas" | "rendrakas" | "visualization";

export const WORK_META: Record<WorkKind, { label: string; color: string; soft: string }> = {
  feljavitas: { label: "Feljavítás", color: "#0e7490", soft: "rgba(14,116,144,0.12)" },
  rendrakas: { label: "Rendrakás", color: "#7a2e17", soft: "rgba(239,122,90,0.16)" },
  visualization: { label: "Látványterv", color: "#15803d", soft: "rgba(22,163,74,0.12)" },
};

export function isWorkKind(v: unknown): v is WorkKind {
  return v === "feljavitas" || v === "rendrakas" || v === "visualization";
}

/** Csak az ikon (öröklött színnel). */
export function WorkIcon({ kind, size = 14 }: { kind: WorkKind; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (kind === "feljavitas") {
    // Csillogás — minőség, élesség
    return (
      <svg {...p}><path d="M12 3.5 13.6 8l4.5 1.6-4.5 1.6L12 15.7l-1.6-4.5L5.9 9.6 10.4 8 12 3.5Z" /><path d="M18.5 15.2l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" /></svg>
    );
  }
  if (kind === "rendrakas") {
    // Seprű — rendrakás
    return (
      <svg {...p}><path d="M14.5 3.5 20 9" /><path d="M12.8 5.2 18 10.4l-2.1 2.1-5.2-5.2 2.1-2.1Z" /><path d="M13.2 13.6 10.4 10.8 4.6 16.6a4 4 0 0 0-1.1 2.2l-.3 1.9 1.9-.3a4 4 0 0 0 2.2-1.1l5.9-5.7Z" /></svg>
    );
  }
  // Látványterv — kanapé/berendezés
  return (
    <svg {...p}><path d="M4 11V8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5V11" /><path d="M3 11.5A1.5 1.5 0 0 1 4.5 10 1.5 1.5 0 0 1 6 11.5V15h12v-3.5a1.5 1.5 0 1 1 3 0V18H3v-6.5Z" /></svg>
  );
}

/** Kerek, tömör jelölés a képek sarkába. */
export function WorkDot({ kind, size = 22 }: { kind: WorkKind; size?: number }) {
  const m = WORK_META[kind];
  return (
    <span
      title={m.label}
      className="flex items-center justify-center rounded-full shadow-sm"
      style={{ width: size, height: size, background: "rgba(255,255,255,0.95)", color: m.color, border: `1px solid ${m.color}33` }}
    >
      <WorkIcon kind={kind} size={Math.round(size * 0.62)} />
    </span>
  );
}

/** Ikon + felirat — nagy nézethez, kártyákhoz. */
export function WorkChip({ kind, light = false }: { kind: WorkKind; light?: boolean }) {
  const m = WORK_META[kind];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={light
        ? { background: "rgba(255,255,255,0.92)", color: m.color }
        : { background: m.soft, color: m.color }}
    >
      <WorkIcon kind={kind} size={13} />
      {m.label}
    </span>
  );
}

/** Több jelölés egymás mellett (pl. feljavítás + rendrakás ugyanazon a képen). */
export function WorkChips({ kinds, light = false }: { kinds: WorkKind[]; light?: boolean }) {
  if (!kinds.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {kinds.map((k) => <WorkChip key={k} kind={k} light={light} />)}
    </span>
  );
}
