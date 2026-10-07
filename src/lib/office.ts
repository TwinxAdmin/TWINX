// Irodai TWINX fiók — közös típusok és az igénylő űrlap validációja.
// (Kliens és szerver is használja: a szerver MINDIG újra ellenőriz.)

export type OfficeRequestInput = {
  officeName: string;
  teamSize: number | string;
  phone: string;
  note?: string;
};

export type OfficeRequestStatus = "pending" | "approved" | "rejected";

export type OfficeRequestRow = {
  id: string;
  office_name: string;
  team_size: number | null;
  phone: string | null;
  note: string | null;
  leader_view: boolean;
  status: OfficeRequestStatus;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
};

export const OFFICE_NAME_MIN = 2;
export const OFFICE_NAME_MAX = 80;
export const TEAM_SIZE_MAX = 500;
export const NOTE_MAX = 500;

export function validateOfficeRequest(input: Record<string, unknown>): {
  valid: boolean;
  errors: Partial<Record<keyof OfficeRequestInput, string>>;
  value?: { officeName: string; teamSize: number; phone: string; note: string | null };
} {
  const errors: Partial<Record<keyof OfficeRequestInput, string>> = {};

  const officeName = String(input.officeName ?? "").trim();
  if (officeName.length < OFFICE_NAME_MIN) errors.officeName = "Add meg az iroda nevét.";
  else if (officeName.length > OFFICE_NAME_MAX) errors.officeName = `Legfeljebb ${OFFICE_NAME_MAX} karakter.`;

  const teamSize = Number(input.teamSize);
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > TEAM_SIZE_MAX) {
    errors.teamSize = `Adj meg egy létszámot 1 és ${TEAM_SIZE_MAX} között.`;
  }

  const phone = String(input.phone ?? "").trim();
  const digits = phone.replace(/\D/g, "");
  if (!phone) errors.phone = "Add meg a telefonszámod — ezen keresünk.";
  else if (!/^[+0-9()\/\-\s]+$/.test(phone) || digits.length < 8 || digits.length > 15) {
    errors.phone = "Érvényes telefonszám szükséges (pl. +36 30 123 4567).";
  }

  const noteRaw = String(input.note ?? "").trim();
  if (noteRaw.length > NOTE_MAX) errors.note = `Legfeljebb ${NOTE_MAX} karakter.`;

  const valid = Object.keys(errors).length === 0;
  return {
    valid,
    errors,
    value: valid
      ? { officeName, teamSize, phone, note: noteRaw || null }
      : undefined,
  };
}
