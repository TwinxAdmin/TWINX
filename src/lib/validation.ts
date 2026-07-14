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
export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

export function validateRegisterInput({
  name,
  email,
  password,
  passwordConfirm,
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

  return { valid: Object.keys(errors).length === 0, errors };
}
