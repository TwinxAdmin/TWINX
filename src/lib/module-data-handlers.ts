// Az egyedi modulok ügyféladat-törlő kezelői (terv 21 / 5.) — CSAK szerver. Minden olyan modulhoz, amelynek a
// regiszterében storesCustomerData: true, itt kell egy kezelő: a cég (companyId) összes ügyféladatát és kimenetét
// törli a modul tábláiból és tárhely-mappáiból. IDEMPOTENS legyen (újrafuttatva se hibázzon). A kódhoz, a
// regiszterhez és a számviteli adathoz nem nyúl.
export type DataDeleteResult = { deleted: string[] };
export const MODULE_DATA_HANDLERS: Record<string, (companyId: string) => Promise<DataDeleteResult>> = {
  // pl. "szerzodes-ellenorzo": async (companyId) => { …; return { deleted: ["szerzodesek tábla", "storage: szerzodes/<companyId>/"] }; },
};
