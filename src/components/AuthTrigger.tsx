// Gomb, ami a landing page-en megnyitja az auth-modált (belépés/regisztráció).
"use client";

import type { ReactNode } from "react";

export default function AuthTrigger({
  mode = "login",
  source,
  className,
  style,
  children,
}: {
  mode?: "login" | "register";
  /** Regisztráció forrás-jelölése (pl. "ingatlan-landing") — 10 kezdőkredithez. */
  source?: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() =>
        window.dispatchEvent(new CustomEvent("open-auth", { detail: { mode, source } }))
      }
    >
      {children}
    </button>
  );
}
