// Fix áras kredit csomagok. Az ár itt, kódban módosítható.
// Megjegyzés: a kreditek havonta NEM járnak le (lásd CLAUDE.md).
export type CreditPackage = {
  id: string; // belső azonosító (Checkout-ban erre hivatkozunk)
  serviceSlug: string; // melyik modulhoz szól
  name: string;
  credits: number;
  priceHuf: number; // ár forintban
  currency: "huf";
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "real-estate-10",
    serviceSlug: "real-estate",
    name: "Induló – 10 kredit",
    credits: 10,
    priceHuf: 4990,
    currency: "huf",
  },
  {
    id: "real-estate-50",
    serviceSlug: "real-estate",
    name: "Közepes – 50 kredit (−20%)",
    credits: 50,
    priceHuf: 19990,
    currency: "huf",
  },
  {
    id: "real-estate-100",
    serviceSlug: "real-estate",
    name: "Nagy – 100 kredit (−30%)",
    credits: 100,
    priceHuf: 34990,
    currency: "huf",
  },
];

export function getPackage(id: string): CreditPackage | null {
  return CREDIT_PACKAGES.find((p) => p.id === id) ?? null;
}
