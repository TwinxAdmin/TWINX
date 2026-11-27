// Időpont-kérés (D73, 8. lépés kiegészítés, Márk kérése 2026-11-27): az érdeklődő a naptárban HÁROM hétköznapot választ
// (mindhez délelőtt / délután), megadja az adatait, és egyik kollégánk visszahívja. Nem a mi szabad időpontjainkat
// mutatjuk (Márk vállalta), hanem az érdeklődő mondja meg, mikor jó neki. Kliens és szerver ugyanezt az ellenőrzést használja.

export type DayPart = "de" | "du";
export type CallbackDay = { date: string; part: DayPart };
export type CallbackInput = { name: string; email: string; phone: string; company: string; note: string; days: CallbackDay[]; consent: boolean };

/** Választható időszak: holnaptól ennyi napig. */
export const CALLBACK_WINDOW_DAYS = 60;
/** Ennyi különböző hétköznapot kell kiválasztani (Márk kérése: kettőről háromra). */
export const CALLBACK_DAYS = 3;
export const PART_LABEL: Record<DayPart, string> = { de: "délelőtt", du: "délután" };

/** Budapesti „ma" (ÉÉÉÉ-HH-NN), hogy a szerver és a böngésző ugyanazt a napot tekintse ma-nak. */
export function todayBudapest(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest" }).format(now);
}
const toUTC = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export function addDays(iso: string, n: number): string { const t = toUTC(iso); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
export function isWeekday(iso: string): boolean { const w = toUTC(iso).getUTCDay(); return w >= 1 && w <= 5; }
/** Választható-e a nap: hétköznap, holnaptól legfeljebb CALLBACK_WINDOW_DAYS napig. */
export function isSelectable(iso: string, today = todayBudapest()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && isWeekday(iso) && iso > today && iso <= addDays(today, CALLBACK_WINDOW_DAYS);
}
export function formatDayHu(iso: string): string {
  return new Intl.DateTimeFormat("hu-HU", { timeZone: "UTC", month: "long", day: "numeric", weekday: "long" }).format(toUTC(iso));
}

export function validateCallback(input: Partial<Record<keyof CallbackInput, unknown>>): {
  valid: boolean; errors: Partial<Record<keyof CallbackInput, string>>; value: CallbackInput;
} {
  const rawDays = Array.isArray(input.days) ? input.days : [];
  const days: CallbackDay[] = rawDays.slice(0, CALLBACK_DAYS).map((d) => {
    const o = (d ?? {}) as Record<string, unknown>;
    return { date: String(o.date ?? ""), part: o.part === "du" ? "du" : "de" };
  });
  const value: CallbackInput = {
    name: String(input.name ?? "").trim(),
    email: String(input.email ?? "").trim(),
    phone: String(input.phone ?? "").trim(),
    company: String(input.company ?? "").trim(),
    note: String(input.note ?? "").trim(),
    days,
    consent: input.consent === true,
  };
  const errors: Partial<Record<keyof CallbackInput, string>> = {};
  if (days.length !== CALLBACK_DAYS || new Set(days.map((d) => d.date)).size !== CALLBACK_DAYS || !days.every((d) => isSelectable(d.date)))
    errors.days = "Válassz három különböző hétköznapot.";
  if (value.name.length < 2 || value.name.length > 120) errors.name = "Add meg a neved.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || value.email.length > 200) errors.email = "Érvényes e-mail-cím szükséges.";
  const digits = value.phone.replace(/\D/g, "");
  if (!/^[+0-9()\/\-\s]+$/.test(value.phone) || digits.length < 8 || digits.length > 15) errors.phone = "Add meg a telefonszámod (pl. +36 30 123 4567).";
  if (value.company.length > 160) errors.company = "Legfeljebb 160 karakter.";
  if (value.note.length > 1000) errors.note = "Legfeljebb 1000 karakter.";
  if (!value.consent) errors.consent = "A visszahíváshoz el kell fogadnod.";
  return { valid: Object.keys(errors).length === 0, errors, value };
}

/** Az admin „Kérések és üzenetek" listájába és az értesítő e-mailbe kerülő szöveg. */
export function callbackMessage(v: CallbackInput): string {
  const lines = [
    "[Visszahívás-kérés – bemutató beszélgetés egyeztetése]",
    "",
    "A visszahíváshoz alkalmas napok:",
    ...v.days.map((d, i) => `${i + 1}. ${formatDayHu(d.date)} (${d.date}), ${PART_LABEL[d.part]}`),
    "",
    `Cég: ${v.company || "-"}`,
  ];
  if (v.note) lines.push("", "Megjegyzés:", v.note);
  return lines.join("\n");
}

/** Rövid összefoglaló a `leads.callback_time` oszlopba (az admin listában is ezt mutatjuk). */
export function callbackSummary(v: CallbackInput): string {
  return v.days.map((d) => `${formatDayHu(d.date)} ${PART_LABEL[d.part]}`).join(" · ");
}
