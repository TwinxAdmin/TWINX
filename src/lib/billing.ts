// Számlázási adatok — típusok, validáció, formázás.
// Egy helyen, hogy a Beállítások űrlap, a kredit-kérés API és az admin
// felület UGYANAZT a szabályt használja (ne csússzon szét a kettő).
//
// Üzleti háttér: amíg a Stripe vásárlás nincs bekötve, a sima felhasználó
// az admintól igényel kreditet, és arról SZÁMLA készül. A sales kolléga
// belső keretet kap, neki nincs számlázás.

export type BillingType = "company" | "individual";

export type BillingInfo = {
  billing_type: BillingType | null;
  billing_name: string | null;
  billing_tax_number: string | null;
  billing_country: string | null;
  billing_zip: string | null;
  billing_city: string | null;
  billing_address: string | null;
  billing_email: string | null;
};

export const EMPTY_BILLING: BillingInfo = {
  billing_type: null,
  billing_name: null,
  billing_tax_number: null,
  billing_country: "Magyarország",
  billing_zip: null,
  billing_city: null,
  billing_address: null,
  billing_email: null,
};

export const BILLING_TYPE_LABEL: Record<BillingType, string> = {
  company: "Cég / egyéni vállalkozó",
  individual: "Magánszemély",
};

// A számla kiállításához MINIMÁLISAN szükséges mezők. Cégnél az adószám is
// kötelező (enélkül nem állítható ki érvényes számla), magánszemélynél nem.
export function validateBilling(b: Partial<BillingInfo>): { ok: true; value: BillingInfo } | { ok: false; error: string } {
  const type = b.billing_type;
  if (type !== "company" && type !== "individual") {
    return { ok: false, error: "Válaszd ki, hogy céges vagy magánszemélyként számlázunk." };
  }

  const trim = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);

  const name = trim(b.billing_name);
  if (name.length < 2) {
    return { ok: false, error: type === "company" ? "A cégnév megadása kötelező." : "A név megadása kötelező." };
  }

  const tax = trim(b.billing_tax_number, 40);
  if (type === "company" && tax.length < 8) {
    return { ok: false, error: "Céges számlához az adószám megadása kötelező." };
  }

  const zip = trim(b.billing_zip, 20);
  const city = trim(b.billing_city, 100);
  const address = trim(b.billing_address, 200);
  if (!zip || !city || !address) {
    return { ok: false, error: "A számlázási cím (irányítószám, város, utca/házszám) megadása kötelező." };
  }

  const email = trim(b.billing_email, 200).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "A számlázási e-mail cím formátuma nem megfelelő." };
  }

  return {
    ok: true,
    value: {
      billing_type: type,
      billing_name: name,
      billing_tax_number: tax || null,
      billing_country: trim(b.billing_country, 80) || "Magyarország",
      billing_zip: zip,
      billing_city: city,
      billing_address: address,
      billing_email: email || null,
    },
  };
}

// Kitöltött-e annyira, hogy számlát tudjunk kiállítani? A kredit-kérés
// kapuja ezt nézi (a felugró ablak innen dönt).
export function isBillingComplete(b: Partial<BillingInfo> | null | undefined): boolean {
  if (!b) return false;
  return validateBilling(b).ok;
}

// Egy soros összefoglaló a listákhoz.
export function billingOneLine(b: Partial<BillingInfo> | null | undefined): string {
  if (!b?.billing_name) return "—";
  const addr = [b.billing_zip, b.billing_city, b.billing_address].filter(Boolean).join(" ");
  const tax = b.billing_tax_number ? ` · ${b.billing_tax_number}` : "";
  return `${b.billing_name}${tax}${addr ? ` · ${addr}` : ""}`;
}

// Vágólapra másolható blokk az adminnak (a számlázó programba beilleszthető).
export function billingCopyBlock(b: Partial<BillingInfo> | null | undefined): string {
  if (!b?.billing_name) return "";
  const lines = [
    b.billing_name,
    b.billing_tax_number ? `Adószám: ${b.billing_tax_number}` : null,
    [b.billing_zip, b.billing_city].filter(Boolean).join(" ") || null,
    b.billing_address || null,
    b.billing_country || null,
    b.billing_email ? `E-mail: ${b.billing_email}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function formatHuf(n: number): string {
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}
