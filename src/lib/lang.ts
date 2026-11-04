// A kétnyelvű bemutatkozó oldal nyelve (/bemutatkozas és /bemutatkozas/en). A közös komponensek alapból magyarok.
export type Lang = "hu" | "en";
export const ENGLISH_PATH = "/bemutatkozas/en";
export const isEnglishPath = (path: string | null | undefined) => !!path && (path === ENGLISH_PATH || path.startsWith(`${ENGLISH_PATH}/`));
/** Tizedes és ezres tagolás nyelv szerint. */
export const numberLocale = (lang: Lang) => (lang === "en" ? "en-GB" : "hu-HU");
