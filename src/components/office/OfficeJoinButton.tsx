// „Csatlakozás kóddal" gomb — a layoutban lévő felugró ablakot nyitja (open-office-join).
"use client";

import type { CSSProperties, ReactNode } from "react";

export default function OfficeJoinButton({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-office-join"))} className={className} style={style}>
      {children}
    </button>
  );
}
