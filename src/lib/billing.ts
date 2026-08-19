// Számlázási adatok — típusok, validáció, formázás.
// Egy helyen, hogy a Beállítások űrlap, a kredit-kérés API és az admin
// felület UGYANAZT a szabályt használja (ne csússzon szét a kettő).
//
// Üzleti háttér: amíg a Stripe vásárlás nincs bekötve, a sima felhasználó
// az admintól igényel kreditet, és arról SZÁMLA készül. A sales kolléga
// belső keretet kap, neki nincs számlázás.
//
// KÉT ADATBLOKK (könyvelői előírás):
//   1) A vásárló SAJÁT adatai — mindig kötelező (ő a kapcsolattartó).
//   2) A CÉG adatai — csak ha cég / egyéni vállalkozás nevében vásárol.
//      Ilyenkor a számla a cégre készül, és az ADÓSZÁM kötelező.

export type BillingType = "company" | "individual";

export type BillingInfo = {
  billing_type: BillingType | null;

  // --- a vásárló saját adatai (mindig) ---
  billing_name: string | null;
  billing_country: string | null;
  billing_zip: string | null;
  billing_city: string | null;
  billing_address: string | null;
  billing_email: string | null;

  // --- a cég adatai (csak billing_type === "company" esetén) ---
  billing_company_name: string | null;
  billing_tax_number: string | null;      // adószám
  billing_company_country: string | null;
  billing_company_zip: string | null;
  billing_company_city: string | null;
  billing_company_address: string | null;
};

export const EMPTY_BILLING: BillingInfo = {
  billing_type: "individual",
  billing_name: null,
  billing_country: "Magyarország",
  billing_zip: null,
  billing_city: null,
  billing_address: null,
  billing_email: null,
  billing_company_name: null,
  billing_tax_number: null,
  billing_company_country: "Magyarország",
  billing_company_zip: null,
  billing_company_city: null,
  billing_company_address: null,
};

// A `profiles` tábla számlázási oszlopai EGY helyen — így egy új mező
// felvételekor nem marad ki egyik lekérdezésből sem.
export const BILLING_COLUMNS = [
  "billing_type",
  "billing_name",
  "billing_country",
  "billing_zip",
  "billing_city",
  "billing_address",
  "billing_email",
  "billing_company_name",
  "billing_tax_number",
  "billing_company_country",
  "billing_company_zip",
  "billing_company_city",
  "billing_company_address",
].join(", ");

export const BILLING_TYPE_LABEL: Record<BillingType, string> = {
  company: "Cég / egyéni vállalkozó",
  individual: "Magánszemély",
};

function trim(v: unknown, max = 200): string {
  return String(v ?? "").trim().slice(0, max);
}

/**
 * A számla kiállításához MINIMÁLISAN szükséges mezők ellenőrzése.
 * A saját adatok mindig kellenek; céges vásárlásnál a cég neve, adószáma és
 * címe is — enélkül nem állítható ki érvényes számla.
 */
export function validateBilling(
  b: Partial<BillingInfo>
): { ok: true; value: BillingInfo } | { ok: false; error: string } {
  // --- 1) A vásárló saját adatai ---
  const name = trim(b.billing_name);
  if (name.length < 2) return { ok: false, error: "A neved megadása kötelező." };

  const zip = trim(b.billing_zip, 20);
  const city = trim(b.billing_city, 100);
  const address = trim(b.billing_address, 200);
  if (!zip || !city || !address) {
    return { ok: false, error: "A címed (irányítószám, város, utca/házszám) megadása kötelező." };
  }

  const email = trim(b.billing_email, 200).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "A számlázási e-mail cím formátuma nem megfelelő." };
  }

  // --- 2) Céges vásárlás esetén a cég adatai ---
  const isCompany = b.billing_type === "company";

  const companyName = trim(b.billing_company_name);
  const tax = trim(b.billing_tax_number, 40);
  const cZip = trim(b.billing_company_zip, 20);
  const cCity = trim(b.billing_company_city, 100);
  const cAddress = trim(b.billing_company_address, 200);

  if (isCompany) {
    if (companyName.length < 2) {
      return { ok: false, error: "Céges vásárlásnál a cég nevének megadása kötelező." };
    }
    if (tax.length < 8) {
      return { ok: false, error: "Céges vásárlásnál az adószám megadása kötelező." };
    }
    if (!cZip || !cCity || !cAddress) {
      return { ok: false, error: "Céges vásárlásnál a cég székhelyének megadása kötelező." };
    }
  }

  return {
    ok: true,
    value: {
      billing_type: isCompany ? "company" : "individual",
      billing_name: name,
      billing_country: trim(b.billing_country, 80) || "Magyarország",
      billing_zip: zip,
      billing_city: city,
      billing_address: address,
      billing_email: email || null,
      // Ha nem céges a vásárlás, a céges mezőket NEM mentjük el —
      // különben egy régi cégnév ragadna bent a számlán.
      billing_company_name: isCompany ? companyName : null,
      billing_tax_number: isCompany ? tax : null,
      billing_company_country: isCompany ? (trim(b.billing_company_country, 80) || "Magyarország") : null,
      billing_company_zip: isCompany ? cZip : null,
      billing_company_city: isCompany ? cCity : null,
      billing_company_address: isCompany ? cAddress : null,
    },
  };
}

// Kitöltött-e annyira, hogy számlát tudjunk kiállítani? A kredit-kérés
// kapuja ezt nézi (a felugró ablak innen dönt).
export function isBillingComplete(b: Partial<BillingInfo> | null | undefined): boolean {
  if (!b) return false;
  return validateBilling(b).ok;
}

// Kire szól a számla: cégre vagy a magánszemélyre?
export function billingPayerName(b: Partial<BillingInfo> | null | undefined): string {
  if (!b) return "—";
  return (b.billing_type === "company" ? b.billing_company_name : b.billing_name) || "—";
}

// Egy soros összefoglaló a listákhoz.
export function billingOneLine(b: Partial<BillingInfo> | null | undefined): string {
  if (!b) return "—";
  const company = b.billing_type === "company";
  const who = billingPayerName(b);
  if (who === "—") return "—";
  const addr = company
    ? [b.billing_company_zip, b.billing_company_city, b.billing_company_address].filter(Boolean).join(" ")
    : [b.billing_zip, b.billing_city, b.billing_address].filter(Boolean).join(" ");
  const tax = company && b.billing_tax_number ? ` · ${b.billing_tax_number}` : "";
  return `${who}${tax}${addr ? ` · ${addr}` : ""}`;
}

// Vágólapra másolható blokk az adminnak (a számlázó programba beilleszthető).
// Céges vásárlásnál a VEVŐ a cég, a személy pedig kapcsolattartóként szerepel.
export function billingCopyBlock(b: Partial<BillingInfo> | null | undefined): string {
  if (!b?.billing_name && !b?.billing_company_name) return "";

  const lines: (string | null)[] = [];

  if (b.billing_type === "company") {
    lines.push("VEVŐ (cég)");
    lines.push(b.billing_company_name ?? null);
    lines.push(b.billing_tax_number ? `Adószám: ${b.billing_tax_number}` : null);
    lines.push([b.billing_company_zip, b.billing_company_city].filter(Boolean).join(" ") || null);
    lines.push(b.billing_company_address ?? null);
    lines.push(b.billing_company_country ?? null);
    lines.push("");
    lines.push("KAPCSOLATTARTÓ");
  } else {
    lines.push("VEVŐ (magánszemély)");
  }

  lines.push(b.billing_name ?? null);
  lines.push([b.billing_zip, b.billing_city].filter(Boolean).join(" ") || null);
  lines.push(b.billing_address ?? null);
  lines.push(b.billing_country ?? null);
  lines.push(b.billing_email ? `E-mail: ${b.billing_email}` : null);

  return lines.filter((l) => l !== null).join("\n").trim();
}

export function formatHuf(n: number): string {
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}
