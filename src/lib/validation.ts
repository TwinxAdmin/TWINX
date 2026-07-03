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
