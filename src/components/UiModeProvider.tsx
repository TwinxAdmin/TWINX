// Felület-mód a dashboardon (3d): az új, kredit nélküli felület (newUi) és az Ingatlan-hozzáférés (estate).
// A layout (szerver) számolja ki; a kliens-komponensek a useUiMode()-dal olvassák, hogy a „kredit"-es
// szövegeket, egyenleget és vásárlást elrejtsék. Alapérték: régi felület (ha a provider hiányzik).
"use client";

import { createContext, useContext } from "react";

export type UiMode = { newUi: boolean; estate: boolean; admin: boolean };
const Ctx = createContext<UiMode>({ newUi: false, estate: false, admin: false });

export function UiModeProvider({ value, children }: { value: UiMode; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUiMode(): UiMode {
  return useContext(Ctx);
}

/** Szöveg-választó: új felületen a kredit nélküli változat, különben a régi. */
export function useCreditText() {
  const { newUi } = useUiMode();
  return (withCredit: string, withoutCredit: string) => (newUi ? withoutCredit : withCredit);
}

/**
 * A „kredit"-es részek kivétele egy szövegből (új felület): a kreditet említő zárójeles rész, „· N kredit"
 * szakasz és mondat kimarad. Pl. „Videó generálása (2 kredit)" → „Videó generálása";
 * „Kész! 1 kredit levonva." → „Kész!". Ha minden mondat kiesne, üres szöveget ad.
 */
export function stripCredit(text: string): string {
  if (!/kredit/i.test(text)) return text;
  let s = text
    .replace(/\s*\([^()]*kredit[^()]*\)/gi, "")
    .replace(/\s*·\s*[^·()]*kredit[^·()]*/gi, "")
    .replace(/\s*—\s*[^—.!?]*kredit[^—.!?]*/gi, "");
  s = s.split(/(?<=[.!?…])\s+/).filter((part) => !/kredit/i.test(part)).join(" ");
  return s.replace(/\s{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
}

/** Hook: új felületen a stripCredit-et alkalmazza, a régin változatlanul hagyja a szöveget. */
export function useCr() {
  const { newUi } = useUiMode();
  return (text: string) => (newUi ? stripCredit(text) : text);
}
