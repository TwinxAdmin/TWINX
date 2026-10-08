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

// ---------------------------------------------------------------------
// Iroda megnyitása + csatlakozási kód
// ---------------------------------------------------------------------

/** A csatlakozási kód karakterkészlete — összetéveszthető jelek (0/O, 1/I/L) nélkül. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Új csatlakozási kód, pl. „TWX-8K4P9R". Kriptográfiailag véletlen (csak szerveren hívjuk). */
export function generateJoinCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return `TWX-${out}`;
}

/** A felhasználó által beírt kód egységesítése (kisbetű, szóköz, hiányzó kötőjel). */
export function normalizeJoinCode(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("TWX") ? s.slice(3) : s;
  return `TWX-${body}`;
}

export function validateOfficeName(raw: unknown): { name?: string; error?: string } {
  const name = String(raw ?? "").trim();
  if (name.length < OFFICE_NAME_MIN) return { error: "Add meg az iroda nevét." };
  if (name.length > OFFICE_NAME_MAX) return { error: `Legfeljebb ${OFFICE_NAME_MAX} karakter.` };
  return { name };
}

/** A „saját irodám" nézet adatai. Az egyenleget és a kódot csak a létrehozó kapja meg. */
export type MyOffice = {
  id: string;
  name: string;
  role: "owner" | "member";
  allowance: number;
  unlimited: boolean;
  canAllocate: boolean;
  joinCode?: string;
  balance?: number;
  memberCount?: number;
  /** Munkamód: „office" = irodai keretből, „private" = saját kreditből (office-mode.sql). */
  workMode: WorkMode;
};

export type WorkMode = "office" | "private";

/** Érvényes formátumú csatlakozási kód? (TWX- + 6 jel a kódkészletből) */
export function isValidJoinCode(code: string): boolean {
  return new RegExp(`^TWX-[${CODE_ALPHABET}]{6}$`).test(code);
}

/** Egy tag a létrehozó / kiosztó taglistájában. */
export type OfficeMember = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  allowance: number;
  unlimited: boolean;
  canAllocate: boolean;
  joinedAt: string;
};

/** Egyszerre kiosztható / visszavehető keret felső határa (elütés elleni védelem). */
export const ALLOCATE_MAX = 1000;

/** Egy „Kredit kérése a vezetőtől" tétel. */
export type OfficeCreditRequest = {
  id: string;
  userId: string;
  name: string;
  email: string;
  amount: number;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  granted: number | null;
  createdAt: string;
  decidedAt: string | null;
};

/** Modulnevek a kredithasználat-kimutatáshoz (chargeCredit `service` paramétere). */
export const SERVICE_LABELS: Record<string, string> = {
  valuation: "Értékbecslés",
  visualization: "Látványtervező",
  video: "Videó",
  flyer: "Hirdetéskép",
  "image-enhance": "Képjavító",
  "ad-check": "Hirdetés-ellenőrző",
  "fb-ads": "Facebook-hirdetés",
  "google-ads": "Google Ads",
  land: "Telekelemzés",
  professionals: "Szakember-kereső",
  "hospitality-menu": "Menü generátor",
  costing: "Önköltség & profit",
  simulation: "Profit-terv",
  suppliers: "Beszállító-kereső",
};
