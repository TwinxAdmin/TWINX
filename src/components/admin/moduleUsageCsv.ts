// Modul-használat CSV-export (MH8) — a képernyőn betöltött összesítőből, ugyanazokkal a szűrőkkel.
// Egy fájl, szakaszokban: Szűrők · Összesítés · Új regisztrálók · Modul-rangsor · Felhasználók · Irodák · Közös munkaterek.
import { buildCsv, type CsvSection } from "@/lib/csv";
import type { UsageOverview } from "@/components/admin/ModuleUsageView";
import type { OfficeUsageRow } from "@/components/admin/OfficeUsageCard";

export type CsvFilterLabels = { range: string; source: string; mode: string; staff: boolean; reg: string };

const STATUS: Record<string, string> = { active: "aktív", sleeping: "alvó", never: "még nem futtatott" };

function date(v: number | string | null): string {
  if (!v) return "";
  return new Date(v).toLocaleString("hu-HU", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function change(v: number | "new" | null): string {
  return v === null ? "" : v === "new" ? "új" : `${v > 0 ? "+" : ""}${v}%`;
}

function officeRows(rows: OfficeUsageRow[]) {
  return rows.map((o) => [
    o.name, o.owner, o.members, o.activeMembers, o.runs, o.conversionPct, o.transfers.count, o.transfers.sum,
    o.mix.map((m) => `${m.label} (${m.runs})`).join(", "),
  ]);
}
const OFFICE_HEADER = ["Név", "Gazda / vezető", "Tagok", "Aktív tagok", "Futtatások", "Megnyitásból futtatás (%)", "Kredit-átadások (db)", "Átadott kredit", "Modulok (futtatás)"];

export function moduleUsageCsv(d: UsageOverview, f: CsvFilterLabels): string {
  const sections: CsvSection[] = [
    {
      title: "TWINX — Modul-használat",
      header: ["Szűrő", "Érték"],
      rows: [
        ["Készült", date(Date.now())],
        ["Időszak", f.range],
        ["Forrás", f.source],
        ["Mód", f.mode],
        ["Admin és sales is", f.staff ? "igen" : "nem"],
        ["Megnyitás-mérés kezdete", d.viewsSince ? date(d.viewsSince) : "2026. október 12."],
      ],
    },
    {
      title: "Összesítés",
      header: ["Mutató", "Érték", "Előző időszak"],
      rows: [
        ["Futtatások", d.kpi.runs, d.kpi.runsPrev],
        ["Aktív felhasználók", d.kpi.activeUsers, d.kpi.activePrev],
        ["Megnyitásból futtatás (%)", d.kpi.conversionPct, null],
        ["Legnépszerűbb modul", d.kpi.topModule ?? "", null],
        ["Alvó felhasználók (30 nap)", d.kpi.sleeping, null],
      ],
    },
    {
      title: `Új regisztrálók — ${f.reg}`,
      header: ["Időszak kezdete", "Közvetlen", "Ingatlan landing", "Összesen"],
      rows: [
        ...d.registrations.selected.series.map((s) => [date(s.from), s.direct, s.landing, s.direct + s.landing]),
        ["Összesen", d.registrations.selected.direct, d.registrations.selected.landing, d.registrations.selected.count],
        ["Ebből már futtatott", null, null, d.registrations.selected.activated],
      ],
    },
    {
      title: "Modul-rangsor",
      header: ["Modul", "Megnyitás", "Megnyitó felhasználók", "Futtatás", "Futtató felhasználók", "Visszatérő (%)", "Megnyitásból futtatás (%)", "Változás", "Kedvencnek jelölte", "Jelzés"],
      rows: d.ranking.map((r) => [
        r.label, r.views, r.viewUsers, r.runs, r.users, r.returningPct, r.conversionPct, change(r.change), r.favorites,
        r.flags.map((x) => (x === "interest" ? "érdeklődés, kevés futtatás" : "emelkedő")).join(", "),
      ]),
    },
    {
      title: "Felhasználók",
      header: ["Név", "E-mail", "Szerepkör", "Forrás", "Iroda / munkatér", "Futtatás", "Megnyitás", "Kipróbált modulok", "TOP 5 modul (futtatás)", "Utoljára aktív", "Állapot"],
      rows: d.users.map((u) => [
        u.name, u.email, u.role, u.source, u.offices.join(", "), u.runs, u.views, u.tried,
        u.top5.map((m) => `${m.label} (${m.runs})`).join(", "), date(u.lastActive), STATUS[u.status] ?? u.status,
      ]),
    },
    { title: "Irodai fiókok", header: OFFICE_HEADER, rows: officeRows(d.offices.office) },
    { title: "Közös munkaterek", header: OFFICE_HEADER, rows: officeRows(d.offices.team) },
  ];
  return buildCsv(sections);
}
