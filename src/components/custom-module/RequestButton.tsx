// „Egyedi modul igénylése” gomb — az oldalon lévő igénylő ablakot (B2BModal) nyitja.
"use client";

import type { CSSProperties, ReactNode } from "react";

export default function RequestButton({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-b2b"))} className={className} style={style}>
      {children}
    </button>
  );
}
