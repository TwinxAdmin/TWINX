// Ingatlanos landing (/ingatlan) jelentkező-űrlap — közös típusok és validáció.
// A meglévő `leads` táblába megy (nincs séma-változás): a telefonszám és az
// érdeklődés típusa a `message` mezőbe kerül összeállítva, az iroda a `company`-be.

export type IngatlanLeadIntent = "kreditek" | "bemutato";

export type IngatlanLeadInput = {
  name: string;
  email: string;
  phone: string;
  office: string;         // ingatlaniroda neve
  intent?: IngatlanLeadIntent;
};

export function validateIngatlanLead(
  input: Partial<IngatlanLeadInput>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const name = String(input.name ?? "").trim();
  if (name.length < 2) errors.name = "Add meg a neved.";

  const email = String(input.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Érvényes e-mail cím szükséges.";
  }

  // Telefon: elnéző — legalább 6 számjegy, a formázás lehet tetszőleges.
  const phoneDigits = String(input.phone ?? "").replace(/\D/g, "");
  if (phoneDigits.length < 6) errors.phone = "Add meg a telefonszámod.";

  const office = String(input.office ?? "").trim();
  if (office.length < 2) errors.office = "Add meg az irodád nevét.";

  return { valid: Object.keys(errors).length === 0, errors };
}

const INTENT_LABEL: Record<IngatlanLeadIntent, string> = {
  kreditek: "10 ajándék kredit igénylése",
  bemutato: "Ingyenes online bemutató kérése",
};

/** A `leads.message` mezőbe kerülő, ember által olvasható összefoglaló. */
export function composeLeadMessage(input: IngatlanLeadInput): string {
  const intent = input.intent ? INTENT_LABEL[input.intent] : "Érdeklődés";
  return [
    "Forrás: TWINX Ingatlan landing (/ingatlan)",
    `Érdeklődés: ${intent}`,
    `Telefonszám: ${input.phone.trim()}`,
    `Ingatlaniroda: ${input.office.trim()}`,
  ].join("\n");
}
