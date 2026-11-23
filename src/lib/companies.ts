// Cégek (terv 14) — közös típusok és szövegek (böngészőben és szerveren is fut).

export const COMPANIES_MIGRATION = "20261123220000_companies.sql";

export type CompanyStatus = "aktiv" | "szunetel" | "lezart";
export const COMPANY_STATUS_LABEL: Record<CompanyStatus, string> = { aktiv: "Aktív", szunetel: "Szünetel", lezart: "Lezárt" };

export type CompanyMember = { userId: string; name: string; email: string; isHead: boolean; joinedAt: string };
export type AdminCompany = {
  id: string; name: string; status: CompanyStatus; note: string | null; createdAt: string;
  fromBooking: boolean; bookingAt: string | null; members: CompanyMember[];
};
export type CompanyLogEntry = { id: number; at: string; action: string; actor: string; target: string | null };

/** A DB-függvények hibakódjai → érthető magyar üzenet. */
export const COMPANY_ERR: Record<string, string> = {
  nem_admin: "Ehhez nincs jogosultságod.",
  nincs_ilyen: "A cég vagy a foglalás nem található.",
  mar_ceg: "Ebből a foglalásból már lett cég.",
  nincs_felhasznalo: "Ezzel az e-mail címmel még nincs regisztrált felhasználó. Előbb regisztráljon ugyanezzel a címmel.",
  nem_tag: "A felhasználó nem aktív tagja a cégnek.",
  utolso_cegvezeto: "Az utolsó cégvezetőt nem lehet levenni. Előbb nevezz ki egy másikat.",
  ures_nev: "Add meg a cég nevét.",
};

export const COMPANY_LOG_LABEL: Record<string, string> = {
  ceg_letrehozva: "Cég létrehozva",
  ceg_modositva: "Cég adatai módosítva",
  tag_hozzaadva: "Tag hozzáadva",
  tag_eltavolitva: "Tag eltávolítva",
  cegvezeto_kinevezve: "Cégvezetővé kinevezve",
  cegvezeto_elveve: "Cégvezetői státusz elvéve",
  cegvezeto_lemondott: "Lemondott a cégvezetői státuszról",
  modul_allapot_valtozott: "Modul állapota változott",
  helyek_modositva: "Helyek módosítva",
  ervenyesseg_modositva: "Érvényesség módosítva",
  atadas_rogzitve: "Átadás rögzítve",
  atadas_felulirva: "Új átadás rögzítve",
  atadas_visszavonva: "Átadás visszavonva",
  modul_aktivalva: "Modul aktiválva",
  modul_kikapcsolva: "Modul kikapcsolva",
  meghivva: "Meghívva",
  meghivo_ujrakuldve: "Meghívó újraküldve",
  meghivo_visszavonva: "Meghívó visszavonva",
  meghivo_elfogadva: "Meghívó elfogadva",
  hozzaferes_megadva: "Hozzáférés megadva",
  hozzaferes_eltavolitva: "Hozzáférés eltávolítva",
  ingatlan_hozzaferes_megadva: "Ingatlan-hozzáférés megadva",
  ingatlan_hozzaferes_elveve: "Ingatlan-hozzáférés elvéve",
  pluszcsomag_hozzaadva: "Pluszcsomag hozzáadva",
  keret_modositva: "Keret módosítva",
  keret_80: "Keret 80%",
  keret_100: "Keret elfogyott (100%)",
};

// ---------------------------------------------------------------------------
// Egyedi modulok és előfizetés (4b; terv 12 / 6., terv 14 / 2.3, terv 23)
// ---------------------------------------------------------------------------
export const COMPANY_MODULES_MIGRATION = "20261124090000_company-modules.sql";

export type ModuleState = "felmeres" | "ajanlat" | "fejlesztes" | "teszt" | "atadva" | "aktiv" | "szunetel" | "lemondva";
export const MODULE_STATE_META: Record<ModuleState, { label: string; bg: string; fg: string }> = {
  felmeres:   { label: "Felmérés",   bg: "#ece8e2", fg: "#6e655c" },
  ajanlat:    { label: "Ajánlat",    bg: "#fdf0d8", fg: "#8a5a12" },
  fejlesztes: { label: "Fejlesztés", bg: "#e3ecfb", fg: "#24467a" },
  teszt:      { label: "Teszt",      bg: "#efe6f7", fg: "#5a2f7a" },
  atadva:     { label: "Átadva",     bg: "#fde3d8", fg: "#9a3b1f" },
  aktiv:      { label: "Aktív",      bg: "#e6f2ea", fg: "#1f6b43" },
  szunetel:   { label: "Szünetel",   bg: "#ece8e2", fg: "#6e655c" },
  lemondva:   { label: "Lemondva",   bg: "#ece8e2", fg: "#6e655c" },
};
/** Kézzel választható állapotok (az Átadva csak átadással, az Aktív csak Aktiválással érhető el). */
export const MANUAL_STATES: ModuleState[] = ["felmeres", "ajanlat", "fejlesztes", "teszt", "szunetel", "lemondva"];

export type Handover = {
  id: string; status: "ervenyes" | "felulirva" | "visszavonva"; name: string; role: string | null;
  via: string; on: string; summary: string; note: string | null; recordedAt: string; revokedReason: string | null;
};
export type AdminCompanyModule = {
  id: string; companyId: string; companyName: string; moduleKey: string; moduleName: string; registered: boolean;
  hasDataPolicy: boolean; state: ModuleState; ownerId: string | null; ownerName: string | null; seats: number; seatsUsed: number;
  validUntil: string | null; isApiCostly: boolean; monthlyCap: number | null; note: string | null; updatedAt: string;
  hasHead: boolean; handovers: Handover[];
  /** Havi keret-állapot (terv 20): Ft, nettó önköltség; null = a migráció előtt. */
  usage: { usedFt: number; capFt: number | null; pct: number | null; units: number } | null;
  unitLabel: string | null; includedUnits: number | null; packUnits: number | null; packCostFt: number | null; packPriceNet: number | null;
};

export const HANDOVER_VIA: Record<string, string> = {
  email: "E-mailben", telefon: "Telefonon", szemelyesen: "Személyesen", videohivas: "Videóhíváson", egyeb: "Egyéb módon",
};

export const MODULE_ERR: Record<string, string> = {
  nem_admin: "Ehhez nincs jogosultságod.",
  nincs_ilyen: "A modul vagy a cég nem található.",
  mar_van: "Ennél a cégnél már van ilyen kulcsú modul.",
  tiltott_allapot: "Ebbe az állapotba így nem lehet váltani.",
  atadas_bejegyzes_kell: "Az Átadva állapothoz átadási bejegyzés kell („Átadás rögzítése”).",
  aktiv_elobb_kikapcsol: "Aktív modulnál előbb Kikapcsolás kell.",
  kevesebb_mint_foglalt: "A helyek száma nem lehet kevesebb a már foglaltnál.",
  hianyzo_mezo: "Töltsd ki a kötelező mezőket.",
  datum_jovobeli: "Az elfogadás dátuma nem lehet jövőbeli.",
  nem_teszt: "Átadást csak Teszt, Átadva vagy Aktív állapotú modulnál lehet rögzíteni.",
  nem_atadva: "Ehhez a modulnak Átadva (vagy újraaktiváláshoz Szünetel) állapotúnak kell lennie.",
  nincs_ervenyes_atadas: "Nincs érvényes átadási bejegyzés.",
  lejart_elofizetes: "Nincs érvényes előfizetés (az „Érvényes eddig” üres vagy lejárt).",
  plafon_kell: "API-költséges modulnál a havi plafon beállítása kötelező.",
  nincs_cegvezeto: "A cégnek nincs aktív cégvezetője (Cégek lap).",
  nincs_regiszter: "A modul nincs a kód regiszterében (src/lib/module-registry.ts) — előbb a kódnak élesben kell lennie.",
  nincs_data_policy: "A modul regiszter-bejegyzéséből hiányzik az adatkezelési leírás (dataPolicy).",
  nincs_keret: "Előbb állíts be havi keretet (Előfizetés szerkesztése).",
};
