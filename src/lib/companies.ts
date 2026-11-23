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
};
