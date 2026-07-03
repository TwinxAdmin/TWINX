// Ingatlan Értékbecslő — közös típusok és validáció (kliens + szerver).
export const CONDITION_OPTIONS = [
  "új építésű",
  "újszerű",
  "felújított",
  "jó állapotú",
  "közepes állapotú",
  "felújítandó",
] as const;

export type Condition = (typeof CONDITION_OPTIONS)[number];

export type ValuationInput = {
  city: string; // Város / Kerület
  squareMeters: number; // Négyzetméter
  rooms: number; // Szobák száma
  condition: string; // Állapot
};

export function validateValuationInput(input: Partial<ValuationInput>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  const city = String(input.city ?? "").trim();
  if (city.length < 2) {
    errors.city = "Add meg a várost / kerületet (min. 2 karakter).";
  }

  const sqm = Number(input.squareMeters);
  if (!Number.isFinite(sqm) || sqm < 5 || sqm > 10000) {
    errors.squareMeters = "A négyzetméter 5 és 10000 között legyen.";
  }

  const rooms = Number(input.rooms);
  if (!Number.isFinite(rooms) || rooms < 1 || rooms > 50) {
    errors.rooms = "A szobák száma 1 és 50 között legyen.";
  }

  const condition = String(input.condition ?? "").trim();
  if (!CONDITION_OPTIONS.includes(condition as Condition)) {
    errors.condition = "Válassz állapotot a listából.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
