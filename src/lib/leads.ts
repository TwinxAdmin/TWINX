// B2B lead — közös típusok és validáció (kliens + szerver).
export type LeadInput = {
  name: string;
  email: string;
  company?: string;
  /** Telefonszám — KÖTELEZŐ (egyedi modul igénylésénél visszahívunk). */
  phone: string;
  /** Opcionális: mikor kereshetjük (pl. „Hétköznap délután 14–17”). */
  callbackTime?: string;
  message: string;
};

/** Gyors választás a „Mikor kereshetünk?” mezőhöz. */
export const CALLBACK_PRESETS = ["Bármikor", "Hétköznap délelőtt (9–12)", "Hétköznap délután (12–17)", "Hétköznap este (17–19)"] as const;

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

  const phone = String(input.phone ?? "").trim();
  const digits = phone.replace(/\D/g, "");
  if (!phone) errors.phone = "Add meg a telefonszámod — ezen keresünk.";
  else if (!/^[+0-9()\/\-\s]+$/.test(phone) || digits.length < 8 || digits.length > 15) {
    errors.phone = "Érvényes telefonszám szükséges (pl. +36 30 123 4567).";
  }

  const callbackTime = String(input.callbackTime ?? "").trim();
  if (callbackTime.length > 200) errors.callbackTime = "Legfeljebb 200 karakter.";

  const message = String(input.message ?? "").trim();
  if (message.length < 10) errors.message = "Írj néhány szót az igényről (min. 10 karakter).";
  if (message.length > 2000) errors.message = "Az üzenet legfeljebb 2000 karakter.";

  return { valid: Object.keys(errors).length === 0, errors };
}
