// Az Ingatlan csomag havi költségkerete, cégenként (terv 27, D62) — CSAK szerver.
// Migráció: 20261124200000_package-caps.sql. A mechanika a terv 20-é (foglalás sorzárral, idempotens kéréskulcs,
// budapesti hónap, 80/100%-os jelzés), de külön táblákon: package_caps / package_usage_events.
//
// Hook-pont: a közös kredit-pont (lib/credits.ts → chargeCredit). Ott, ahol eddig a „hozzáféréssel nincs levonás"
// ág volt, most a cég Ingatlan-keretéből foglalunk a BECSÜLT költséggel. A becslés kizárólag a meglévő
// költség-konstansokból jön (lib/costs.ts, ugyanazok, amelyekkel a Költségfigyelő naplóz) — ahol nincs becslés,
// a művelet NEM indul (hiba), nem fut csendben ingyen.
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esc, layout, sendMail } from "@/lib/booking-notify";
import {
  HUF_PER_USD, enhanceCostUsd, falVideoCostUsd, googleImageCostUsd, perplexityCostUsd, shotstackRenderCostUsd,
} from "@/lib/costs";
import { PERPLEXITY_MODEL } from "@/lib/perplexity";
import { LAND_LEVELS } from "@/lib/land";
import { MAX_IMAGES as VIS_MAX_IMAGES } from "@/lib/visualization";
import { ENHANCE_MAX_IMAGES } from "@/lib/image-enhance";
import { AI_CLIP_SECONDS, MAX_VIDEO_IMAGES } from "@/lib/video";

export const ESTATE_PACKAGE_KEY = "ingatlan";

/** Az értékbecslés fotó-elemzésének naplózott költsége (lib/valuation-finalize.ts: gemini-vision, hívásonként). */
const VALUATION_VISION_USD = 0.03;

/** Mennyi és milyen munka indul — a pontosabb becsléshez (nem kötelező; hiányában a legrosszabb esettel számolunk). */
export type CostHint = {
  /** képek / fotók száma */
  units?: number;
  /** videónál: "pro" (AI-klipek + Shotstack) · "alap" (Shotstack) · "engine" (saját motor, nincs külső API) */
  variant?: "pro" | "alap" | "engine";
  /** szöveges kutatásnál a Perplexity-modell (pl. telekkutatás szintje) */
  model?: string;
};

/**
 * Az Ingatlan csomag szolgáltatásai (a chargeCredit `service` neve). Csak ezek mennek a csomag keretére;
 * a többi a régi úton marad.
 */
const ESTATE_SERVICES = new Set([
  "ad-check", "fb-ads", "google-ads", "professionals", "valuation", "land",
  "visualization", "image-enhance", "video", "flyer", "floorplan-3d", "floorplan-3d-extend",
]);
export const isEstateService = (service?: string | null): boolean => !!service && ESTATE_SERVICES.has(service);

const ft = (usd: number) => Math.ceil(usd * HUF_PER_USD);

/**
 * A művelet becsült önköltsége Ft-ban, a meglévő költség-konstansokból (lib/costs.ts).
 * null = nincs becslés → a művelet nem indul.
 */
export function estimateEstateCostFt(service: string, hint: CostHint = {}): number | null {
  switch (service) {
    case "ad-check": case "fb-ads": case "google-ads": case "professionals":
      return ft(perplexityCostUsd(PERPLEXITY_MODEL));
    case "valuation":
      // Kutatás + (ha van fotó) egy képelemzés. Fotószám nélkül a fotós esettel számolunk.
      return ft(perplexityCostUsd(PERPLEXITY_MODEL) + (hint.units === 0 ? 0 : VALUATION_VISION_USD));
    case "land": {
      if (hint.model) return ft(perplexityCostUsd(hint.model));
      return ft(Math.max(...Object.values(LAND_LEVELS).map((l) => perplexityCostUsd(l.model))));
    }
    case "visualization":
      return ft(googleImageCostUsd(Math.max(1, hint.units ?? VIS_MAX_IMAGES)));
    case "image-enhance": {
      // Képenként 1 generálás + 1 ellenőrzés; eltérésnél +1 / +1 → a felső becslés 2 + 2 képenként.
      const n = Math.max(1, hint.units ?? ENHANCE_MAX_IMAGES);
      return ft(enhanceCostUsd(2 * n, 2 * n));
    }
    case "video": {
      if (hint.variant === "engine") return 0;   // saját motor: nincs külső, hívásonkénti API-díj
      if (hint.variant === "alap") return ft(shotstackRenderCostUsd(1));
      // PRO (és ismeretlen csomag): minden snitt AI-klip + a végső Shotstack-render (lásd video/[id]).
      const clips = Math.max(1, hint.units ?? MAX_VIDEO_IMAGES);
      return ft(falVideoCostUsd(clips, AI_CLIP_SECONDS) + shotstackRenderCostUsd(1));
    }
    case "flyer":
      return 0;   // helyi (szerveroldali) képkészítés, külső API nélkül
    case "floorplan-3d-extend":
      return 0;   // a megosztás meghosszabbítása, API-hívás nélkül
    default:
      return null;   // pl. floorplan-3d: a lépései különböző hívásokkal futnak, egységes becslés nincs
  }
}

export type PackageReserveResult =
  | { ok: true; eventId: string | null }
  | { ok: false; reason: "cap" | "no_estimate" | "no_package" | "error" };

/**
 * Foglalás a felhasználó cégének Ingatlan-keretéből (egyben elszámolás a becsléssel; hibánál `packageRelease`).
 * `force`: utólagos elszámolás a már kész eredményhez (nem ellenőriz keretet, de beszámít).
 */
export async function packageReserve(p: {
  userId: string; service: string; hint?: CostHint; force?: boolean;
}): Promise<PackageReserveResult> {
  const est = estimateEstateCostFt(p.service, p.hint);
  if (est == null) {
    console.error(`[package-cap] nincs költségbecslés ehhez: ${p.service} — a művelet nem indul`);
    return { ok: false, reason: "no_estimate" };
  }
  if (est === 0) return { ok: true, eventId: null };   // nincs külső költség — nincs mit foglalni
  const { data, error } = await createAdminClient().rpc("package_usage_reserve", {
    p_user: p.userId, p_package: ESTATE_PACKAGE_KEY, p_operation: p.service, p_estimated_ft: est,
    p_request_key: randomUUID(), p_units: Math.max(1, p.hint?.units ?? 1), p_settle: true, p_force: !!p.force,
  });
  if (error) {
    console.error("[package-cap] foglalási hiba — a hívás nem indul el (20261124200000_package-caps.sql lefutott?)", error.message);
    return { ok: false, reason: "error" };
  }
  const r = data as { ok: boolean; error?: string; event_id?: string };
  if (!r.ok) {
    if (r.error === "keret_elfogyott") { after(() => checkPackageThresholds()); return { ok: false, reason: "cap" }; }
    return { ok: false, reason: "no_package" };
  }
  after(() => checkPackageThresholds());
  return { ok: true, eventId: r.event_id ?? null };
}

/** Előellenőrzés foglalás nélkül (utólag elszámoló műveletekhez, pl. értékbecslés). */
export async function packageCheck(p: { userId: string; service: string; hint?: CostHint }): Promise<PackageReserveResult> {
  const est = estimateEstateCostFt(p.service, p.hint);
  if (est == null) return { ok: false, reason: "no_estimate" };
  if (est === 0) return { ok: true, eventId: null };
  const { data, error } = await createAdminClient().rpc("package_cap_room", {
    p_user: p.userId, p_package: ESTATE_PACKAGE_KEY, p_estimated_ft: est,
  });
  if (error) { console.error("[package-cap] keret-ellenőrzés hiba", error.message); return { ok: false, reason: "error" }; }
  const r = data as { ok: boolean; error?: string };
  if (!r.ok) return { ok: false, reason: r.error === "keret_elfogyott" ? "cap" : "no_package" };
  return { ok: true, eventId: null };
}

/** Foglalás feloldása hibánál. Soha nem dob hibát. */
export async function packageRelease(eventId: string): Promise<void> {
  try {
    await createAdminClient().rpc("package_usage_release", { p_event: eventId });
  } catch (e) {
    console.error("[package-cap] feloldás hiba", e);
  }
}

/** Esedékes 80% / 100%-os jelzések az Ingatlan-keretekre (egyszer / hónap / keret). Soha nem dob hibát. */
export async function checkPackageThresholds(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data: due } = await admin.rpc("package_thresholds_due");
    let sent = 0;
    for (const d of (due ?? []) as { package_cap_id: string; company_id: string; period: string; threshold: number; used_ft: number; cap_ft: number }[]) {
      const { data: marked } = await admin.rpc("package_mark_notified", { p_pc: d.package_cap_id, p_period: d.period, p_threshold: d.threshold, p_cap: d.cap_ft });
      if (!marked) continue;   // más folyamat már kiküldte
      const { data: c } = await admin.from("companies").select("name").eq("id", d.company_id).maybeSingle();
      const head = `${d.threshold === 100 ? "Keret elfogyott (100%)" : "Keret 80%"}: ${(c?.name as string) ?? "?"} · Ingatlan csomag`;
      const lines = [head, `Felhasználva: ${d.used_ft.toLocaleString("hu-HU")} Ft / ${d.cap_ft.toLocaleString("hu-HU")} Ft (nettó önköltség), időszak: ${d.period}`,
        d.threshold === 100
          ? "Az Ingatlan modulok költséges műveletei leálltak a hónap végéig vagy a keret emeléséig (Admin → Előfizetések → Ingatlan csomag → ⋯)."
          : "Az Admin → Előfizetések lapon, az Ingatlan csomag sorában emelheted a keretet."];
      // Személyes adat (felhasználó neve, e-mail) nincs az üzenetben (terv 27 / 2.4).
      const to = (process.env.BOOKING_NOTIFY_EMAILS || process.env.LEADS_NOTIFY_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (to.length) await sendMail(to, head, layout(lines.map(esc)), lines.join("\n"));
      const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.CAP_TELEGRAM_CHAT_ID || process.env.BOOKING_TELEGRAM_CHAT_ID;
      if (token && chat) {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat, text: lines.join("\n"), disable_web_page_preview: true }),
        }).catch(() => {});
      }
      await admin.from("access_audit_log").insert({ action: d.threshold === 100 ? "keret_100" : "keret_80", company_id: d.company_id,
        module_key: ESTATE_PACKAGE_KEY, details: { period: d.period, used_ft: d.used_ft, cap_ft: d.cap_ft } });
      sent++;
    }
    return sent;
  } catch (e) {
    console.error("[package-cap] küszöb-ellenőrzés", e);
    return 0;
  }
}

/**
 * Admin-nézet: a csomag-keretek aktuális havi állapota, cégnévvel. A `capId: null` sorok azok a cégek, amelyekben
 * van Ingatlan-hozzáféréssel rendelkező tag, de még nincs keretük (ezeknél a költséges művelet nem indul).
 */
export type PackageCapRow = { capId: string | null; companyId: string; companyName: string; period: string; usedFt: number; capFt: number; pct: number | null };
export async function packageCapOverview(): Promise<{ rows: PackageCapRow[]; migrationMissing: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("package_cap_status");
  if (error) return { rows: [], migrationMissing: true };
  const list = (data ?? []) as { package_cap_id: string; company_id: string; period: string; used_ft: number; cap_ft: number; pct: number | null }[];
  // Keret nélküli cégek, ahol már van Ingatlan-hozzáférés (pl. a keret bevezetése előtt kapott hozzáférés).
  const { data: svc } = await admin.from("services").select("id").eq("slug", "real-estate").maybeSingle();
  const { data: acc } = svc ? await admin.from("company_access").select("user_id").eq("service_id", svc.id) : { data: [] };
  const accUsers = (acc ?? []).map((a) => a.user_id as string);
  const { data: mems } = accUsers.length
    ? await admin.from("company_members").select("company_id").eq("status", "aktiv").in("user_id", accUsers) : { data: [] };
  const withCap = new Set(list.map((r) => r.company_id));
  const missingIds = [...new Set((mems ?? []).map((m) => m.company_id as string))].filter((id) => !withCap.has(id));
  const ids = [...new Set([...list.map((r) => r.company_id), ...missingIds])];
  const { data: cs } = ids.length ? await admin.from("companies").select("id, name").in("id", ids) : { data: [] };
  const names = new Map((cs ?? []).map((c) => [c.id as string, c.name as string]));
  return {
    migrationMissing: false,
    rows: list.map((r) => ({ capId: r.package_cap_id, companyId: r.company_id, companyName: names.get(r.company_id) ?? "?",
      period: r.period, usedFt: r.used_ft, capFt: r.cap_ft, pct: r.pct }) as PackageCapRow)
      .concat(missingIds.map((id) => ({ capId: null, companyId: id, companyName: names.get(id) ?? "?", period: "", usedFt: 0, capFt: 0, pct: null })))
      .sort((a, b) => a.companyName.localeCompare(b.companyName, "hu")),
  };
}
