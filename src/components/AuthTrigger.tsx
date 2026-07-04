// Gomb, ami a landing page-en megnyitja az auth-modált (belépés/regisztráció).
"use client";

import type { ReactNode } from "react";

export default function AuthTrigger({
  mode = "login",
  className,
  style,
  children,
}: {
  mode?: "login" | "register";
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
        window.dispatchEvent(new CustomEvent("open-auth", { detail: { mode } }))
      }
    >
      {children}
    </button>
  );
}
