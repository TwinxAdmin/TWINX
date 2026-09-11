// Bizalmi sáv a hero alján — négy rövid tény, halvány bronz szövegben.
// A szám (átlagos elkészülési idő) felpörög betöltéskor; a többi csak szöveg.
"use client";

import AnimatedNumber from "@/components/motion/AnimatedNumber";

export type TrustItem = { label: string; number?: number; suffix?: string };

export default function TrustBar({ items }: { items: TrustItem[] }) {
  return (
    <ul
      className="grid grid-cols-2 gap-x-6 gap-y-3 text-[12px] font-medium uppercase tracking-[0.14em] sm:flex sm:flex-wrap sm:items-center sm:gap-x-0"
      style={{ color: "rgba(214,178,140,0.78)" }}
      aria-label="Miért TWINX"
    >
      {items.map((it, i) => (
        <li key={it.label} className="flex items-center">
          {/* Vékony elválasztó — csak asztali nézetben, az elsőnél nem */}
          {i > 0 && <span aria-hidden className="mx-5 hidden h-3 w-px sm:block" style={{ background: "rgba(214,178,140,0.32)" }} />}
          {typeof it.number === "number" ? (
            <span>
              Átlag{" "}
              <span className="font-semibold" style={{ color: "var(--twx-on-dark)" }}>
                <AnimatedNumber value={it.number} duration={1100} animateOnMount className="tabular-nums" />
                {it.suffix}
              </span>{" "}
              {it.label}
            </span>
          ) : (
            <span>{it.label}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
