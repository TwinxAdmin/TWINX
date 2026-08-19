// Fix áras kredit csomagok. Az ár itt, kódban módosítható.
// Megjegyzés: a kreditek havonta NEM járnak le (lásd CLAUDE.md).

// ---------------------------------------------------------------------------
// EGYETLEN KAPCSOLÓ a bankkártyás vásárlás élesítéséhez.
//
// Amíg `false`: a „Vásárlás" gomb kikapcsolva, „Hamarosan" felirattal látszik,
// és a hangsúly a működő KREDIT IGÉNYLÉS folyamaton van (számla → befizetés →
// jóváírás). Ha majd élesedik a Stripe, elég ezt átbillenteni — a felülethez
// nem kell hozzányúlni.
//
// Élesítés: NEXT_PUBLIC_CHECKOUT_ENABLED=true a Vercel környezeti változói közt
// (NEXT_PUBLIC_, mert a böngészőben futó modálnak is látnia kell).
// ---------------------------------------------------------------------------
export const CHECKOUT_ENABLED =
  process.env.NEXT_PUBLIC_CHECKOUT_ENABLED === "true";
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
    priceHuf: 2490, // 249 Ft/kredit (alapár)
    currency: "huf",
  },
  {
    id: "real-estate-50",
    serviceSlug: "real-estate",
    name: "Közepes – 50 kredit (−10%)",
    credits: 50,
    priceHuf: 11205, // 224,1 Ft/kredit (−10%)
    currency: "huf",
  },
  {
    id: "real-estate-100",
    serviceSlug: "real-estate",
    name: "Nagy – 100 kredit (−20%)",
    credits: 100,
    priceHuf: 19920, // 199,2 Ft/kredit (−20%)
    currency: "huf",
  },
];

export function getPackage(id: string): CreditPackage | null {
  return CREDIT_PACKAGES.find((p) => p.id === id) ?? null;
}
