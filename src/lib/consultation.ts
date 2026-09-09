// Bővebb tájékoztatás kérése az /ingatlan landingről (kolléga visszahív) — típusok és
// validáció (kliens + szerver ugyanazt használja).
//
// A kérés a közös `leads` táblába megy (b2b.sql), a message mezőben egy ember
// által olvasható összefoglalóval — NEM az ingatlan_invites kampány-táblába,
// hogy az ajándékkód-lista tiszta maradjon.

export type ConsultationInput = {
  name: string;
  email: string;
  phone: string;
  office?: string;      // ingatlaniroda (opcionális)
  preferred?: string;   // mikor ér rá (opcionális, szabad szöveg)
  note?: string;        // mire kíváncsi (opcionális)
};

export function validateConsultation(
  input: Partial<ConsultationInput>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const name = String(input.name ?? "").trim();
  if (name.length < 2) errors.name = "Add meg a neved.";

  const email = String(input.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Érvényes e-mail cím szükséges.";

  const phoneDigits = String(input.phone ?? "").replace(/\D/g, "");
  if (phoneDigits.length < 6) errors.phone = "Add meg a telefonszámod, hogy vissza tudjunk hívni.";

  if (String(input.office ?? "").trim().length > 200) errors.office = "Legfeljebb 200 karakter.";
  if (String(input.preferred ?? "").trim().length > 200) errors.preferred = "Legfeljebb 200 karakter.";
  if (String(input.note ?? "").trim().length > 1000) errors.note = "Legfeljebb 1000 karakter.";

  return { valid: Object.keys(errors).length === 0, errors };
}

/** A `leads.message` mezőbe kerülő összefoglaló. */
export function composeConsultationMessage(input: ConsultationInput): string {
  const lines = [
    "Forrás: TWINX Ingatlan landing (/ingatlan)",
    "Érdeklődés: Bővebb tájékoztatás (kolléga vegye fel a kapcsolatot)",
    `Telefonszám: ${input.phone.trim()}`,
  ];
  if (input.office?.trim()) lines.push(`Ingatlaniroda: ${input.office.trim()}`);
  if (input.preferred?.trim()) lines.push(`Mikor kereshető: ${input.preferred.trim()}`);
  if (input.note?.trim()) lines.push(`Mire kíváncsi: ${input.note.trim()}`);
  return lines.join("\n");
}
