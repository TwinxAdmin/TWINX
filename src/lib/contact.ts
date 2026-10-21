// Kapcsolat oldal (twinx.hu/kapcsolat) — közös adatok és az űrlap ellenőrzése (kliens + szerver ugyanezt használja).
// Az elérhetőségek EGY helyen: az oldal, a lebegő „Kapcsolat" gomb és a fiók-menü is innen olvas.
import { LEGAL_OPERATOR } from "@/lib/legal";

export const CONTACT_PHONES = [
  { name: "Kovács Márk", display: "+36 20 563 0561", tel: "+36205630561" },
  { name: "Radics Tibor", display: "+36 70 207 7983", tel: "+36702077983" },
] as const;

export const CONTACT_EMAIL = LEGAL_OPERATOR.email;

export const CONTACT_TOPICS = [
  "Általános kérdés",
  "Kredit, fizetés, számla",
  "Technikai segítség egy modulhoz",
  "Irodai fiók",
  "Egyedi fejlesztés, céges ajánlat",
  "Egyéb",
] as const;

export type ContactInput = { name: string; email: string; phone: string; topic: string; message: string };

export function validateContact(input: Partial<Record<keyof ContactInput, unknown>>): { valid: boolean; errors: Partial<Record<keyof ContactInput, string>>; value: ContactInput } {
  const value: ContactInput = {
    name: String(input.name ?? "").trim(),
    email: String(input.email ?? "").trim(),
    phone: String(input.phone ?? "").trim(),
    topic: String(input.topic ?? "").trim(),
    message: String(input.message ?? "").trim(),
  };
  const errors: Partial<Record<keyof ContactInput, string>> = {};
  if (value.name.length < 2 || value.name.length > 120) errors.name = "Add meg a neved.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || value.email.length > 200) errors.email = "Érvényes e-mail-cím szükséges.";
  if (value.phone) {
    const digits = value.phone.replace(/\D/g, "");
    if (!/^[+0-9()\/\-\s]+$/.test(value.phone) || digits.length < 8 || digits.length > 15) errors.phone = "Érvényes telefonszám (pl. +36 30 123 4567) — vagy hagyd üresen.";
  }
  if (!(CONTACT_TOPICS as readonly string[]).includes(value.topic)) errors.topic = "Válaszd ki, miben segíthetünk.";
  if (value.message.length < 10) errors.message = "Írj néhány szót (min. 10 karakter).";
  if (value.message.length > 3000) errors.message = "Legfeljebb 3000 karakter.";
  return { valid: Object.keys(errors).length === 0, errors, value };
}
