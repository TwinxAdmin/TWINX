// Meghívó e-mail (terv 16 / 1. pont, D49) — CSAK szerver. A szöveg minden címnek ugyanaz (nem árulja el,
// hogy a cím regisztrált-e). Ha a küldés nem sikerül (pl. a Resend-domain még nincs hitelesítve), a hívó
// a meghívó linkjét egyszer visszaadja a cégvezetőnek másolásra (Márk döntése, 2026-11-23).
import { esc, layout, sendMail, siteUrl } from "@/lib/booking-notify";

export function invitationUrl(token: string, origin?: string): string {
  return `${siteUrl(origin)}/meghivo?t=${encodeURIComponent(token)}`;
}

export async function sendInvitationMail(p: {
  to: string; token: string; moduleName: string; companyName: string; inviterName: string | null; origin?: string;
}): Promise<boolean> {
  const url = invitationUrl(p.token, p.origin);
  const who = p.inviterName?.trim() || "Egy kollégád";
  const subject = `Meghívást kaptál a(z) ${p.moduleName} használatára — ${p.companyName}`;
  const text = `Szia!\n\n${who} a(z) ${p.companyName} nevében meghívott, hogy használd a(z) ${p.moduleName} modult a TWINX-en.\n\nBelépés: ${url}\n\nHa még nincs TWINX fiókod, ugyanezzel az e-mail címmel regisztrálj. Ha már van, egyből beléphetsz.\nA meghívó 7 napig érvényes. Ha nem számítottál rá, nyugodtan hagyd figyelmen kívül.\n\nA TWINX csapata`;
  const html = layout([
    "Szia!",
    `${esc(who)} a(z) <strong>${esc(p.companyName)}</strong> nevében meghívott, hogy használd a(z) <strong>${esc(p.moduleName)}</strong> modult a TWINX-en.`,
  ], { label: "Belépés", href: url }, [
    "Ha még nincs TWINX fiókod, ugyanezzel az e-mail címmel regisztrálj. Ha már van, egyből beléphetsz.",
    "A meghívó 7 napig érvényes. Ha nem számítottál rá, nyugodtan hagyd figyelmen kívül.",
  ]);
  return sendMail(p.to, subject, html, text, "office@twinx.hu");
}
