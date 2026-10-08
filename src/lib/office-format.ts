// Irodai felület — megjelenítési segédek (kliens- és szerveroldalon is használható).

const MONTHS_SHORT = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."];
const MONTHS_LONG = ["Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"];

/** „ma 10:12" / „tegnap 16:20" / „okt. 5." (más évben: „2025. okt. 5.") */
export function fmtWhen(iso: string, withTime = true): string {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (t >= startToday && t < startToday + 86400000) return withTime ? `ma ${hm}` : "ma";
  if (t >= startToday - 86400000) return withTime ? `tegnap ${hm}` : "tegnap";
  const base = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}.`;
  return d.getFullYear() === now.getFullYear() ? base : `${d.getFullYear()}. ${base}`;
}

const DAYS_LONG = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];

/** Teljes időpont a levél-fejlécbe: „2026. okt. 8., csütörtök 10:40" */
export function fmtFull(iso: string): string {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getFullYear()}. ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}., ${DAYS_LONG[d.getDay()]} ${hm}`;
}

const DAYS_SHORT = ["vas.", "hétf.", "kedd", "szer.", "csüt.", "pént.", "szomb."];

/**
 * Határidő („YYYY-MM-DD", helyi naptári nap): „ma" / „holnap" / „okt. 14. (szer.)" / „lejárt: okt. 2.".
 * `overdue` jelzi, ha már elmúlt.
 */
export function fmtDue(ymd: string): { text: string; overdue: boolean; soon: boolean } {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return { text: ymd, overdue: false, soon: false };
  const due = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  const base = `${due.getFullYear() !== now.getFullYear() ? `${due.getFullYear()}. ` : ""}${MONTHS_SHORT[due.getMonth()]} ${due.getDate()}.`;
  if (diff < 0) return { text: `lejárt: ${base}`, overdue: true, soon: false };
  if (diff === 0) return { text: "ma", overdue: false, soon: true };
  if (diff === 1) return { text: "holnap", overdue: false, soon: true };
  return { text: `${base} (${DAYS_SHORT[due.getDay()]})`, overdue: false, soon: false };
}

/** Az aktuális hónap neve („Október") — az időszak-választóhoz. */
export function currentMonthName(): string {
  return MONTHS_LONG[new Date().getMonth()];
}

const MONTHS_IN = ["januárban", "februárban", "márciusban", "áprilisban", "májusban", "júniusban", "júliusban", "augusztusban", "szeptemberben", "októberben", "novemberben", "decemberben"];

/** „októberben" — a „Felhasználva …" felirathoz. */
export function currentMonthInessive(): string {
  return MONTHS_IN[new Date().getMonth()];
}

/** Monogram (2 betű) névből vagy e-mailből. */
export function initials(name: string, email = ""): string {
  const src = (name || email.split("@")[0] || "?").trim();
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const two = parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return two.toUpperCase();
}

const AVATAR = [
  { bg: "#FBE1D6", fg: "#A8411F" },
  { bg: "#DCE8F5", fg: "#24476B" },
  { bg: "#F3E0EC", fg: "#6E2A55" },
  { bg: "#E2EFDF", fg: "#2E5A28" },
  { bg: "#FDE6C8", fg: "#7A4A06" },
  { bg: "#E6E1F5", fg: "#433173" },
];

/** Stabil avatar-szín a felhasználó azonosítójából. */
export function avatarColor(id: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR[h % AVATAR.length];
}

export const ROLE_TEXT: Record<"owner" | "manager" | "member", string> = {
  owner: "Létrehozó",
  manager: "Vezető",
  member: "Tag",
};
