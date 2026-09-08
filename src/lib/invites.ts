// Ingatlanos ajándékkredit-kampány — a szabályok EGY helyen.
//
// Folyamat: jelentkezés a landingen → minden admin értesül → admin elfogadja →
// egyszer használatos kód megy ki e-mailben → a jelentkező beváltja
// (regisztrációkor vagy utólag a fiókjában) → a kerete 10 kreditre EGÉSZÜL KI.
//
// A „kiegészít" a lényeg: a regisztrációs próbakredit bennemarad, a kód csak a
// különbözetet adja. Így akkor sem lesz 13, ha a regisztrációs keret változik.
import { WELCOME_CREDITS } from "@/lib/onboarding";

/** Ennyi ajándékkódot adunk ki összesen — kemény limit. */
export const INVITE_LIMIT = 50;

/** Ennyi kredittel indul a kódot beváltó partner (ÖSSZESEN, nem ezen felül). */
export const INVITE_TOTAL_CREDITS = 10;

/** A beváltáskor ténylegesen jóváírt mennyiség (a regisztrációs keret felett). */
export function topUpAmount(totalCredits = INVITE_TOTAL_CREDITS): number {
  return Math.max(0, totalCredits - WELCOME_CREDITS);
}

export type InviteStatus = "uj" | "elfogadva" | "elutasitva";

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  uj: "Új jelentkező",
  elfogadva: "Elfogadva",
  elutasitva: "Elutasítva",
};

export type Invite = {
  id: string;
  name: string;
  email: string;
  phone: string;
  office: string;
  intent: string | null;
  status: InviteStatus;
  code: string | null;
  credits: number;
  decided_by_email: string | null;
  decided_at: string | null;
  admin_note: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string;
};

/**
 * Kódformátum: TWX-XXXX-XXXX. Összetéveszthető karakterek (0/O, 1/I/L) NINCSENEK
 * benne, mert a partner sokszor kézzel gépeli be a levélből.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateInviteCode(): string {
  const pick = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  const block = () => Array.from({ length: 4 }, pick).join("");
  return `TWX-${block()}-${block()}`;
}

/** Gépelési hibák tűrése: kisbetű, szóköz, hiányzó kötőjel is elfogadott. */
export function normalizeInviteCode(raw: string): string {
  const s = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s.startsWith("TWX") || s.length !== 11) return String(raw ?? "").trim().toUpperCase();
  return `TWX-${s.slice(3, 7)}-${s.slice(7, 11)}`;
}

export function isInviteCodeFormat(code: string): boolean {
  return /^TWX-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
}
