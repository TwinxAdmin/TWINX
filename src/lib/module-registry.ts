// Egyedi modulok regisztere (terv 12 / 6. szakasz, D43, D54) — „A változat": minden egyedi modul a KÓDBAN él,
// egy bejegyzéssel itt. Amíg egy cégnek nincs aktiválva (company_modules.state = 'aktiv'), rejtve marad.
//
// Új egyedi modul felvétele (a Claude Code / CODE végzi, a kóddal együtt):
//   1) a modul felülete a `route` útvonalon (pl. src/app/dashboard/m/<kulcs>/page.tsx), a szerveroldali
//      végpontjai a hozzáférést a user_has_module_access()-szel ellenőrzik;
//   2) egy bejegyzés ebbe a tömbbe — a `dataPolicy` KÖTELEZŐ az Aktiváláshoz (mit tárol a modul ügyféladatból,
//      és hogyan törölhető / exportálható; vagy: „Nem tárol ügyféladatot.").
// Az admin felületen a cégekhez rendelt, de még nem regisztrált kulcs is felvehető (Felmérés–Fejlesztés
// szakaszban a kód még nincs meg); az Aktiválást a regiszter hiánya megakadályozza.

export type ModuleOrigin = "egyedi" | "ujrahasznalt";

export type ModuleRegistryEntry = {
  /** Egyedi kulcs: kisbetű, szám, kötőjel (pl. „szerzodes-ellenorzo"). Ezt tárolja a company_modules.module_key. */
  key: string;
  name: string;
  /** Ikon-kulcs (lásd ModuleIcon). */
  icon?: string;
  /** Hol fut a TWINX-en belül. */
  route: string;
  origin: ModuleOrigin;
  /** Újrahasznosítható-e más cégnél (D54); a katalógus nézet „Hamarosan". */
  reuse?: boolean;
  catalogStatus?: "rejtett" | "katalogus";
  /** Adatkezelés: mit tárol, hogyan törölhető / exportálható. Hiányában a modul nem aktiválható. */
  dataPolicy: string | null;
};

export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  // Belső próba modul (Márk kérése, 2026-11-23): a meghívás, a hozzáférés és az Aktiválás teljes útjának
  // kipróbálására. Ügyféladatot nem tárol; valódi ügyfélnek nem aktiváljuk.
  {
    key: "proba-modul",
    name: "Próba modul",
    icon: "custom",
    route: "/dashboard/m/proba-modul",
    origin: "egyedi",
    reuse: false,
    catalogStatus: "rejtett",
    dataPolicy: "Nem tárol ügyféladatot: belső próba modul, csak a hozzáférés működését mutatja.",
  },
];

export function registryEntry(key: string): ModuleRegistryEntry | undefined {
  return MODULE_REGISTRY.find((m) => m.key === key);
}

/** A modul megjelenítendő neve: a regiszterből, különben maga a kulcs. */
export function moduleName(key: string): string {
  return registryEntry(key)?.name ?? key;
}

export const MODULE_KEY_RE = /^[a-z0-9][a-z0-9-]{1,60}$/;
