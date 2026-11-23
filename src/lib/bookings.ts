// Ingyenes felmérés — foglalás és időpontok közös segédei (terv 15). Böngészőben és szerveren is fut.
// Az időket mindig budapesti helyi időben mutatjuk és kérjük be; az adatbázis UTC-ben (timestamptz) tárol.

export const BOOKING_TZ = "Europe/Budapest";
export const BOOKING_DEFAULT_MINUTES = 45;
export const BOOKING_MIGRATION = "20261123190000_bookings.sql";

export const WEEKDAYS = ["hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat", "vasárnap"]; // 1..7 → [0..6]

export type BookingHost = { userId: string; name: string; active: boolean };
export type AvailabilityTemplate = {
  id: string; hostId: string; weekday: number; start: string; end: string; slotMinutes: number; active: boolean;
};
export type AdminSlot = {
  id: string; hostId: string; startsAt: string; durationMin: number; status: "szabad" | "foglalt" | "torolve";
  fromTemplate: boolean; bookedBy: string | null;
};

/** Budapesti helyi dátum + idő („2026-11-30", „10:00") → UTC ISO. Óraátállításkor is helyes. */
export function budapestToUtcIso(date: string, time: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m || !t) return null;
  const wanted = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = partsInTz(new Date(guess));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess -= asUtc - wanted;
  }
  return new Date(guess).toISOString();
}

function partsInTz(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: BOOKING_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const get = (type: string) => Number(f.formatToParts(d).find((x) => x.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** „YYYY-MM-DD" budapesti napkulcs egy időponthoz (csoportosításhoz). */
export function budapestDayKey(iso: string): string {
  const p = partsInTz(new Date(iso));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** „10:00" */
export function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("hu-HU", { timeZone: BOOKING_TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** „november 30., hétfő" — napkulcsból (YYYY-MM-DD). */
export function fmtDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("hu-HU", { timeZone: "UTC", month: "long", day: "numeric", weekday: "long" }).format(dt);
}

/** „2026. november 30., hétfő 10:00" — a levelekhez (terv 16). */
export function fmtFullBudapest(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("hu-HU", { timeZone: BOOKING_TZ, year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(d);
  return `${day} ${fmtTime(iso)}`;
}

/** Időpont-választó opciók (15 perces lépés, 07:00–20:45). */
export const TIME_OPTIONS = Array.from({ length: 56 }, (_, i) => {
  const mins = 7 * 60 + i * 15;
  const v = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  return { value: v, label: v };
});

export const DURATION_OPTIONS = [30, 45, 60, 90].map((n) => ({ value: String(n), label: `${n} perc` }));

// ---------------------------------------------------------------------------
// Nyilvános foglalás (a kapcsolatblokk űrlapja) — közös validáció a böngészőnek és a szervernek.
// ---------------------------------------------------------------------------

/** A hozzájárulás szövege (terv 17 / 10. szakasz) és verziója — a verzió a foglalással együtt tárolódik. */
export const BOOKING_CONSENT_VERSION = "foglalas-2026-11-23";
export const BOOKING_CONSENT_TEXT =
  "Elolvastam az Adatkezelési tájékoztatót, és hozzájárulok, hogy a megadott adataimat a TWINX az ingyenes felmérés egyeztetése céljából kezelje.";
export const BOOKING_MESSAGE_MAX = 1000;
export const BOOKING_SOURCES = ["fooldal", "referencia", "kezdolap"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export type PublicSlot = { id: string; startsAt: string; durationMin: number; hostName: string };

export type BookingInput = {
  slotId: string | null; name: string; company: string; email: string; phone: string; message: string; consent: boolean;
};
export type BookingFieldErrors = Partial<Record<"name" | "company" | "email" | "phone" | "message" | "consent", string>>;

/** Telefonszám normalizálása — ugyanaz a szabály, mint az adatbázisban (booking_normalize_phone). */
export function normalizePhone(p: string): string {
  let d = (p ?? "").replace(/[^0-9+]/g, "");
  if (d.startsWith("+")) return "+" + d.slice(1).replace(/\D/g, "");
  d = d.replace(/\D/g, "");
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (d.startsWith("06")) return "+36" + d.slice(2);
  if (d.startsWith("36") && d.length >= 10) return "+" + d;
  return d;
}

export function validateBooking(i: BookingInput): BookingFieldErrors {
  const e: BookingFieldErrors = {};
  const name = i.name.trim(), company = i.company.trim(), email = i.email.trim();
  if (!name) e.name = "Add meg a neved."; else if (name.length > 120) e.name = "Legfeljebb 120 karakter.";
  if (!company) e.company = "Add meg a céged nevét."; else if (company.length > 160) e.company = "Legfeljebb 160 karakter.";
  if (!email) e.email = "Add meg az e-mail címed.";
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = "Ez nem tűnik érvényes e-mail címnek.";
  const phone = normalizePhone(i.phone);
  if (!i.phone.trim()) e.phone = "Add meg a telefonszámod, ezen hívunk.";
  else if (phone.replace(/\D/g, "").length < 8 || phone.length > 16) e.phone = "Ez nem tűnik érvényes telefonszámnak.";
  if (i.message.length > BOOKING_MESSAGE_MAX) e.message = `Legfeljebb ${BOOKING_MESSAGE_MAX} karakter.`;
  if (!i.consent) e.consent = "A foglaláshoz szükséges a hozzájárulás.";
  return e;
}
