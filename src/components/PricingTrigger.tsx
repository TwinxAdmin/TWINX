// Gomb, ami a landing page-en megnyitja a csomagok modált.
"use client";

import type { ReactNode } from "react";

export default function PricingTrigger({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => window.dispatchEvent(new CustomEvent("open-pricing"))}
    >
      {children}
    </button>
  );
}
