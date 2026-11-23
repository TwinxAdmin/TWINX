// A cégvezető „Hozzáférések" ablakának közös típusai és szövegei (terv 13, terv 22 / 6. D). Böngészőben is fut.

export type AccessPerson = { userId: string; name: string; email: string };
export type HeadModule = {
  id: string; key: string; name: string; seats: number; used: number; validUntil: string | null;
  active: AccessPerson[]; invites: { id: string; email: string; expiresAt: string; expired: boolean }[]; meHasAccess: boolean;
};
export type HeadCompany = {
  id: string; name: string; heads: AccessPerson[]; members: (AccessPerson & { isHead: boolean })[]; modules: HeadModule[];
};

export const ACCESS_ERR: Record<string, string> = {
  nem_cegvezeto: "Ehhez cégvezetői jog kell ennél a cégnél.",
  nem_admin: "Ehhez cégvezetői jog kell ennél a cégnél.",
  modul_nem_aktiv: "Ez a modul most nem érhető el. Az újraindításhoz keress minket: office@twinx.hu.",
  nincs_szabad_hely: "Nincs szabad hely. A bővítéshez jelezd nekünk: office@twinx.hu.",
  mar_meghivva: "Erre a címre már van nyitott meghívó ennél a modulnál.",
  mar_hozzafer: "Ő már használja ezt a modult.",
  tul_sok_meghivo: "Túl sok meghívó ment ki az elmúlt órában. Próbáld újra később.",
  ervenytelen_email: "Ez nem tűnik érvényes e-mail címnek.",
  meghivo_ervenytelen: "Ez a meghívó már nem érvényes.",
  nincs_ilyen: "Nem található.",
  nem_tag: "Csak a cég aktív tagja nevezhető ki.",
  utolso_cegvezeto: "Előbb nevezz ki másik cégvezetőt.",
  modul_lemondva: "Ezt a modult lemondtátok: új meghívó és új hely már nem adható.",
};
