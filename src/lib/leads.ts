// B2B lead — közös típusok és validáció (kliens + szerver).
export type LeadInput = {
  name: string;
  email: string;
  company?: string;
  message: string;
};

export function validateLeadInput(input: Partial<LeadInput>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const name = String(input.name ?? "").trim();
  if (name.length < 2) errors.name = "Add meg a neved (min. 2 karakter).";

  const email = String(input.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Érvényes e-mail cím szükséges.";
  }

  const company = String(input.company ?? "").trim();
  if (company.length > 200) errors.company = "A cégnév legfeljebb 200 karakter.";

  const message = String(input.message ?? "").trim();
  if (message.length < 10) errors.message = "Írj néhány szót az igényről (min. 10 karakter).";
  if (message.length > 2000) errors.message = "Az üzenet legfeljebb 2000 karakter.";

  return { valid: Object.keys(errors).length === 0, errors };
}
