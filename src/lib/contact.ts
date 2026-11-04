// Kapcsolat oldal (twinx.hu/kapcsolat) — közös adatok és az űrlap ellenőrzése (kliens + szerver ugyanezt használja).
// Az elérhetőségek EGY helyen: az oldal, a lebegő „Kapcsolat" gomb és a fiók-menü is innen olvas.
import { LEGAL_OPERATOR } from "@/lib/legal";

export const CONTACT_PHONES = [
  { name: "Kovács Márk", display: "+36 20 563 0561", tel: "+36205630561" },
  { name: "Radics Tibor", display: "+36 70 207 7983", tel: "+36702077983" },
] as const;

export const CONTACT_EMAIL = LEGAL_OPERATOR.email;

/** A bemutatkozó oldal „Küldd el az ötleted" ablakának témája (a kapcsolati űrlapon is választható). */
export const MODULE_IDEA_TOPIC = "Ötlet egy új modulra";

export const CONTACT_TOPICS = [
  "Általános kérdés",
  "Kredit, fizetés, számla",
  "Technikai segítség egy modulhoz",
  "Irodai fiók",
  "Egyedi fejlesztés, céges ajánlat",
  "Közös modulfejlesztés szakmai partnerként",
  MODULE_IDEA_TOPIC,
  "Egyéb",
] as const;

/** A témák és a mezőhibák angol szövege (az angol bemutatkozó oldal űrlapjai; a beküldött téma-érték magyar marad). */
export const CONTACT_TOPIC_EN: Record<string, string> = {
  "Általános kérdés": "General question",
  "Kredit, fizetés, számla": "Credits, payment, invoice",
  "Technikai segítség egy modulhoz": "Technical help with a module",
  "Irodai fiók": "Office account",
  "Egyedi fejlesztés, céges ajánlat": "Custom development, business quote",
  "Közös modulfejlesztés szakmai partnerként": "Building a module together as a professional partner",
  [MODULE_IDEA_TOPIC]: "An idea for a new module",
  "Egyéb": "Other",
};
export const CONTACT_ERROR_EN: Record<string, string> = {
  name: "Please enter your name.",
  email: "Please enter a valid email address.",
  phone: "Please enter a valid phone number (e.g. +36 30 123 4567) or leave it empty.",
  topic: "Please choose a topic.",
  message: "Please write a short message (10–3000 characters).",
};

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
