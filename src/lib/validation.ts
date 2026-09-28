// Közös auth validáció (kliens + szerver oldalon is használjuk).
export type AuthInput = { email: string; password: string };

export function validateAuthInput({
  email,
  password,
}: Partial<AuthInput>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Érvényes e-mail cím szükséges.";
  }
  if (!password || password.length < 8) {
    errors.password = "A jelszó legalább 8 karakter legyen.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Kézi (nem Google) regisztráció: név + email + jelszó + jelszó-megerősítés.
// A telefonszám OPCIONÁLIS.
export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  phone: string;
};

export function validateRegisterInput({
  name,
  email,
  password,
  passwordConfirm,
  phone,
}: Partial<RegisterInput>): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!name || name.trim().length < 2) {
    errors.name = "Add meg a teljes neved.";
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Érvényes e-mail cím szükséges.";
  }
  if (!password || password.length < 8) {
    errors.password = "A jelszó legalább 8 karakter legyen.";
  }
  if (!passwordConfirm) {
    errors.passwordConfirm = "Erősítsd meg a jelszót.";
  } else if (password !== passwordConfirm) {
    errors.passwordConfirm = "A két jelszó nem egyezik.";
  }
  // Telefon: nem kötelező; ha megadták, enyhén ellenőrizzük (számjegy + a
  // szokásos elválasztók), legalább 6 számjegy.
  const p = (phone ?? "").trim();
  if (p) {
    if (!/^[+\d][\d\s()/-]{5,}$/.test(p) || (p.replace(/\D/g, "").length < 6)) {
      errors.phone = "Adj meg érvényes telefonszámot, vagy hagyd üresen.";
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
