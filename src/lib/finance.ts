// Ajánlat és fizetés (terv 19) — közös típusok és szövegek. Böngészőben és szerveren is fut. CSAK admin használja.

export const FINANCE_MIGRATION = "20261124150000_finance.sql";

export type QuoteStatus = "vazlat" | "elkuldve" | "elfogadva" | "elutasitva" | "lejart";
export type PaymentStatus = "esedekes" | "kiszamlazva" | "fizetve" | "visszateritve" | "torolve";
export type PaymentKind = "fejlesztesi_dij" | "havi_dij" | "egyeb";

export const QUOTE_STATUS: Record<QuoteStatus, { label: string; bg: string; fg: string }> = {
  vazlat: { label: "Vázlat", bg: "#ece8e2", fg: "#6e655c" },
  elkuldve: { label: "Elküldve", bg: "#e3ecfb", fg: "#24467a" },
  elfogadva: { label: "Elfogadva", bg: "#e6f2ea", fg: "#1f6b43" },
  elutasitva: { label: "Elutasítva", bg: "#ece8e2", fg: "#6e655c" },
  lejart: { label: "Lejárt", bg: "#ece8e2", fg: "#6e655c" },
};
export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; bg: string; fg: string }> = {
  esedekes: { label: "Esedékes", bg: "#fdf0d8", fg: "#8a5a12" },
  kiszamlazva: { label: "Kiszámlázva", bg: "#e3ecfb", fg: "#24467a" },
  fizetve: { label: "Fizetve", bg: "#e6f2ea", fg: "#1f6b43" },
  visszateritve: { label: "Visszatérítve", bg: "#ece8e2", fg: "#6e655c" },
  torolve: { label: "Törölve", bg: "#ece8e2", fg: "#6e655c" },
};
export const PAYMENT_KIND: Record<PaymentKind, string> = { fejlesztesi_dij: "Fejlesztési díj", havi_dij: "Havi díj", egyeb: "Egyéb" };
export const MILESTONE: Record<string, string> = { eloleg: "Előleg", maradek: "Maradék", atadaskor: "Átadáskor" };
export const METHOD: Record<string, string> = { atutalas: "Átutalás", keszpenz: "Készpénz", kartya: "Kártya", stripe: "Stripe" };

export type Quote = {
  id: string; companyId: string; companyModuleId: string | null; title: string; amountNet: number; vatRate: number;
  validUntil: string | null; status: QuoteStatus; note: string | null; createdAt: string;
};
export type Payment = {
  id: string; companyId: string; companyName: string; companyModuleId: string | null; moduleName: string | null; quoteId: string | null;
  kind: PaymentKind; milestone: string | null; description: string; amountNet: number; vatRate: number; amountGross: number;
  status: PaymentStatus; dueDate: string | null; invoiceNumber: string | null; invoiceIssuedAt: string | null; paidAt: string | null;
  method: string | null; periodFrom: string | null; periodTo: string | null; reason: string | null; createdAt: string; overdue: boolean;
  /** Lezárt cég nyitott tétele (terv 21 / 4.) */
  closedCompany: boolean;
};
export type ExpiringModule = { id: string; companyName: string; moduleName: string; validUntil: string; daysLeft: number; lastPayment: string | null };

export const FINANCE_ERR: Record<string, string> = {
  nem_admin: "Ehhez nincs jogosultságod.",
  nincs_ilyen: "Nem található.",
  hianyzo_mezo: "Töltsd ki a kötelező mezőket.",
  tiltott_allapot: "Ebből az állapotból ez nem lehetséges.",
  osszeg_elter: "A tételek nettó összege nem egyezik az ajánlat összegével.",
  ures_tetelek: "Adj meg legalább egy fizetési tételt.",
  szamlaszam_foglalt: "Ez a számlaszám már szerepel egy másik tételnél.",
};

export const huf = (n: number) => `${Math.round(n).toLocaleString("hu-HU")} Ft`;
