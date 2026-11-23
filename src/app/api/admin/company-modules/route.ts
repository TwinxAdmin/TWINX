// /api/admin/company-modules — Admin → Egyedi modulok és Előfizetések (CSAK admin; terv 12 / 1., 6.; terv 23).
//   GET → { migrated, modules: AdminCompanyModule[], companies, admins, registry }
//   GET ?log=<companyModuleId> → { log }  (a modul állapotváltásai, átadásai, hozzáférései)
//   POST { action, id?, … } → frissített lista:
//     create        { companyId, moduleKey, ownerId? }
//     set_state     { id, state }                         — Felmérés…Teszt, Szünetel, Lemondva
//     update        { id, ownerId, note }
//     subscription  { id, seats, validUntil, isApiCostly, monthlyCap }
//     handover      { id, name, role?, via, on, summary, note? }   — Átadás rögzítése / Új átadás
//     revoke_handover { id, reason }
//     activate      { id }   — + regiszter és dataPolicy ellenőrzés (a DB nem látja a kódot)
//     deactivate    { id }
//     cancel        { id, effectiveOn?, reason }   — lemondás rögzítése (terv 21 / 3.)
//     reopen        { id }                         — lemondás visszavonása / lemondott modul újranyitása
//     add_pack      { id, extraCostFt, extraUnits?, priceNet?, reason }   — pluszcsomag erre a hónapra (terv 20)
//     set_cap       { id, capFt|null, reason }                            — keret módosítása indoklással
//   GET ?usage=<companyModuleId> → { events } (a használati napló)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import { MODULE_KEY_RE, MODULE_REGISTRY, moduleName, registryEntry } from "@/lib/module-registry";
import {
  COMPANY_MODULES_MIGRATION, MODULE_ERR,
  type AdminCompanyModule, type CompanyLogEntry, type Handover, type ModuleState,
} from "@/lib/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getStaffRole(await createClient());
  return staff && staff.role === "admin" ? staff : null;
}
const missing = (m: string) => /company_modules|module_|function .* does not exist/i.test(m);
const fail = (m: string, status = 500) =>
  NextResponse.json({ error: missing(m) ? `Futtasd le a ${COMPANY_MODULES_MIGRATION} migrációt.` : m }, { status });

async function payload() {
  const admin = createAdminClient();
  const today = new Date().toISOString();
  const [cm, comps, heads, access, invites, hand, admins] = await Promise.all([
    admin.from("company_modules").select("id, company_id, module_key, state, owner_admin_id, seats, valid_until, is_api_costly, monthly_cap, note, updated_at, cancel_effective_on, cancel_reason, usage_unit_label, included_units, extra_pack_units, extra_pack_cost_cap_ft, extra_pack_price_net")
      .order("updated_at", { ascending: false }),
    admin.from("companies").select("id, name, status").order("name"),
    admin.from("company_members").select("company_id").eq("is_company_head", true).eq("status", "aktiv"),
    admin.from("module_access").select("company_module_id").eq("status", "aktiv"),
    admin.from("module_invitations").select("company_module_id").eq("status", "meghivva").gt("expires_at", today),
    admin.from("module_handovers").select("id, company_module_id, status, accepted_by_name, accepted_by_role, accepted_via, accepted_on, delivered_summary, note, recorded_at, revoked_reason")
      .order("recorded_at", { ascending: false }),
    admin.from("profiles").select("id, full_name").eq("role", "admin"),
  ]);
  if (cm.error) return { migrated: !missing(cm.error.message), error: cm.error.message, modules: [], companies: [], admins: [], registry: [] };
  // Havi keret-állapot (terv 20) — a module-usage migráció előtt üres (a lista attól még működik).
  const { data: capRows } = await admin.rpc("module_cap_status");
  const capMap = new Map(((capRows ?? []) as { company_module_id: string; used_ft: number; cap_ft: number | null; pct: number | null; units: number }[])
    .map((c) => [c.company_module_id, c]));

  const compName = new Map((comps.data ?? []).map((c) => [c.id as string, c.name as string]));
  const headSet = new Set((heads.data ?? []).map((h) => h.company_id as string));
  const used = new Map<string, number>();
  for (const r of [...(access.data ?? []), ...(invites.data ?? [])]) used.set(r.company_module_id as string, (used.get(r.company_module_id as string) ?? 0) + 1);
  const adminName = new Map((admins.data ?? []).map((a) => [a.id as string, (a.full_name as string) || "admin"]));

  const modules: AdminCompanyModule[] = (cm.data ?? []).map((r) => {
    const reg = registryEntry(r.module_key as string);
    const handovers: Handover[] = (hand.data ?? []).filter((h) => h.company_module_id === r.id).map((h) => ({
      id: h.id as string, status: h.status as Handover["status"], name: h.accepted_by_name as string, role: h.accepted_by_role as string | null,
      via: h.accepted_via as string, on: h.accepted_on as string, summary: h.delivered_summary as string, note: h.note as string | null,
      recordedAt: h.recorded_at as string, revokedReason: h.revoked_reason as string | null,
    }));
    return {
      id: r.id as string, companyId: r.company_id as string, companyName: compName.get(r.company_id as string) ?? "—",
      moduleKey: r.module_key as string, moduleName: moduleName(r.module_key as string), registered: !!reg, hasDataPolicy: !!reg?.dataPolicy,
      state: r.state as ModuleState, ownerId: r.owner_admin_id as string | null,
      ownerName: r.owner_admin_id ? adminName.get(r.owner_admin_id as string) ?? null : null,
      seats: r.seats as number, seatsUsed: used.get(r.id as string) ?? 0, validUntil: r.valid_until as string | null,
      isApiCostly: !!r.is_api_costly, monthlyCap: r.monthly_cap as number | null, note: r.note as string | null,
      updatedAt: r.updated_at as string, hasHead: headSet.has(r.company_id as string), handovers,
      cancelEffectiveOn: (r.cancel_effective_on as string | null) ?? null, cancelReason: (r.cancel_reason as string | null) ?? null,
      usage: capMap.has(r.id as string) ? {
        usedFt: capMap.get(r.id as string)!.used_ft, capFt: capMap.get(r.id as string)!.cap_ft,
        pct: capMap.get(r.id as string)!.pct, units: capMap.get(r.id as string)!.units,
      } : null,
      unitLabel: (r.usage_unit_label as string | null) ?? null, includedUnits: (r.included_units as number | null) ?? null,
      packUnits: (r.extra_pack_units as number | null) ?? null, packCostFt: (r.extra_pack_cost_cap_ft as number | null) ?? null,
      packPriceNet: (r.extra_pack_price_net as number | null) ?? null,
    };
  });
  return {
    migrated: true, modules,
    companies: (comps.data ?? []).filter((c) => c.status !== "lezart").map((c) => ({ id: c.id as string, name: c.name as string })),
    admins: [...adminName.entries()].map(([id, name]) => ({ id, name })),
    registry: MODULE_REGISTRY.map((m) => ({ key: m.key, name: m.name })),
  };
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  const usageFor = new URL(request.url).searchParams.get("usage");
  if (usageFor) {
    const { data } = await createAdminClient().from("module_usage_events")
      .select("id, operation_key, units, estimated_cost_ft, actual_cost_ft, status, created_at")
      .eq("company_module_id", usageFor).order("created_at", { ascending: false }).limit(200);
    return NextResponse.json({ events: data ?? [] });
  }
  const logFor = new URL(request.url).searchParams.get("log");
  if (logFor) {
    const admin = createAdminClient();
    const { data: cm } = await admin.from("company_modules").select("company_id, module_key").eq("id", logFor).maybeSingle();
    if (!cm) return NextResponse.json({ log: [] });
    const { data } = await admin.from("access_audit_log").select("id, at, actor_id, action, target_email, details")
      .eq("company_id", cm.company_id).eq("module_key", cm.module_key).order("at", { ascending: false }).limit(100);
    const { data: profs } = await admin.from("profiles").select("id, full_name");
    const nm = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
    const log: CompanyLogEntry[] = (data ?? []).map((e) => ({
      id: e.id as number, at: e.at as string, action: e.action as string,
      actor: e.actor_id ? nm.get(e.actor_id as string) || "felhasználó" : "rendszer",
      target: (e.target_email as string | null) ?? (e.details ? JSON.stringify(e.details) : null),
    }));
    return NextResponse.json({ log });
  }
  return NextResponse.json(await payload());
}

export async function POST(request: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const admin = createAdminClient();
  const actor = staff.userId, id = String(b.id ?? "");
  const action = String(b.action ?? "");
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  let call: PromiseLike<{ data: unknown; error: { message: string } | null }>;
  let notice = "Mentve.";
  switch (action) {
    case "create": {
      const key = str(b.moduleKey).trim().toLowerCase();
      if (!MODULE_KEY_RE.test(key)) return NextResponse.json({ error: "A modul kulcsa kisbetű, szám és kötőjel lehet (2–61 karakter), pl. szerzodes-ellenorzo." }, { status: 422 });
      call = admin.rpc("admin_create_company_module", { p_actor: actor, p_company: str(b.companyId), p_module_key: key, p_owner: str(b.ownerId) || null });
      notice = "Modul felvéve (Felmérés).";
      break;
    }
    case "set_state":
      call = admin.rpc("admin_set_module_state", { p_actor: actor, p_cm: id, p_state: str(b.state) }); notice = "Állapot módosítva."; break;
    case "update":
      call = admin.rpc("admin_update_company_module", { p_actor: actor, p_cm: id, p_owner: str(b.ownerId) || null, p_note: str(b.note) }); break;
    case "subscription": {
      const seats = Number(b.seats);
      const cap = b.monthlyCap === null || b.monthlyCap === "" || b.monthlyCap === undefined ? null : Number(b.monthlyCap);
      const valid = str(b.validUntil) || null;
      if (!Number.isInteger(seats) || seats < 0 || seats > 10000) return NextResponse.json({ error: "A helyek száma 0 és 10000 közötti egész szám." }, { status: 422 });
      if (cap !== null && (!Number.isInteger(cap) || cap < 0)) return NextResponse.json({ error: "A havi plafon nem negatív egész szám (Ft)." }, { status: 422 });
      if (valid && !/^\d{4}-\d{2}-\d{2}$/.test(valid)) return NextResponse.json({ error: "Érvénytelen dátum." }, { status: 422 });
      // Ha már van keret, az csak a „Keret módosítása" művelettel (indoklással, naplózva) változhat — itt megtartjuk.
      const { data: cur } = await admin.from("company_modules").select("monthly_cap").eq("id", id).maybeSingle();
      const capToSet = cur?.monthly_cap != null ? (cur.monthly_cap as number) : cap;
      call = admin.rpc("admin_set_module_subscription", { p_actor: actor, p_cm: id, p_seats: seats, p_valid_until: valid, p_is_api_costly: b.isApiCostly === true, p_monthly_cap: capToSet });
      // Az ajánlatban rögzített mennyiség és pluszcsomag (terv 20 / 3.) — leíró mezők, csak admin.
      const int = (v: unknown) => (v === null || v === "" || v === undefined || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.round(Number(v))));
      await admin.from("company_modules").update({
        usage_unit_label: str(b.unitLabel).trim().slice(0, 40) || null, included_units: int(b.includedUnits),
        extra_pack_units: int(b.packUnits), extra_pack_cost_cap_ft: int(b.packCostFt), extra_pack_price_net: int(b.packPriceNet),
      }).eq("id", id);
      notice = "Előfizetés mentve.";
      break;
    }
    case "handover":
      call = admin.rpc("record_handover", {
        p_actor: actor, p_cm: id, p_name: str(b.name), p_role: str(b.role), p_via: str(b.via), p_on: str(b.on) || null,
        p_summary: str(b.summary), p_note: str(b.note),
      });
      notice = "Átadás rögzítve.";
      break;
    case "revoke_handover":
      call = admin.rpc("revoke_handover", { p_actor: actor, p_cm: id, p_reason: str(b.reason) }); notice = "Átadás visszavonva, a modul Teszt állapotba lépett."; break;
    case "activate": {
      // A regiszter és a dataPolicy ellenőrzése (D43, D54) — a kód nélküli modul nem kapcsolható be.
      const { data: cm } = await admin.from("company_modules").select("module_key").eq("id", id).maybeSingle();
      if (!cm) return NextResponse.json({ error: MODULE_ERR.nincs_ilyen }, { status: 404 });
      const reg = registryEntry(cm.module_key as string);
      if (!reg) return NextResponse.json({ error: MODULE_ERR.nincs_regiszter }, { status: 422 });
      if (!reg.dataPolicy?.trim()) return NextResponse.json({ error: MODULE_ERR.nincs_data_policy }, { status: 422 });
      call = admin.rpc("activate_company_module", { p_actor: actor, p_cm: id });
      notice = "Aktiválva. A cégvezető most már meghívhatja a kollégákat.";
      break;
    }
    case "add_pack": {
      const ft = Number(b.extraCostFt);
      if (!Number.isInteger(ft) || ft <= 0) return NextResponse.json({ error: "A keret-kiegészítés pozitív egész Ft." }, { status: 422 });
      call = admin.rpc("cap_add_pack", { p_actor: actor, p_cm: id, p_extra_cost_ft: ft,
        p_extra_units: b.extraUnits === "" || b.extraUnits == null ? null : Number(b.extraUnits),
        p_price_net: b.priceNet === "" || b.priceNet == null ? null : Number(b.priceNet), p_reason: str(b.reason) });
      notice = "Pluszcsomag hozzáadva erre a hónapra; ha adtál meg árat, a fizetési tétel is létrejött (Pénzügy → Esedékes).";
      break;
    }
    case "set_cap": {
      const cap = b.capFt === "" || b.capFt == null ? null : Number(b.capFt);
      if (cap !== null && (!Number.isInteger(cap) || cap < 0)) return NextResponse.json({ error: "A keret nem negatív egész Ft." }, { status: 422 });
      call = admin.rpc("cap_set", { p_actor: actor, p_cm: id, p_new_cap: cap, p_reason: str(b.reason) });
      notice = "Keret módosítva.";
      break;
    }
    case "cancel":
      call = admin.rpc("cancel_company_module", { p_actor: actor, p_cm: id, p_effective: str(b.effectiveOn) || null, p_reason: str(b.reason) });
      notice = "Lemondás rögzítve: a modul a hatályos napig működik, a nyitott meghívók visszavonva.";
      break;
    case "reopen":
      call = admin.rpc("reopen_company_module", { p_actor: actor, p_cm: id });
      notice = "Újranyitva. Lemondott modulnál Szünetel állapotból az Aktiválással kapcsolható vissza; a kollégákat újra meg kell hívni.";
      break;
    case "deactivate":
      call = admin.rpc("deactivate_company_module", { p_actor: actor, p_cm: id }); notice = "Kikapcsolva (Szünetel)."; break;
    default:
      return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });
  }

  const { data, error } = await call;
  if (error) return fail(error.message);
  const r = data as { ok: boolean; error?: string; used?: number };
  if (!r.ok) {
    const msg = MODULE_ERR[r.error ?? ""] ?? "Nem sikerült.";
    return NextResponse.json({ error: r.error === "kevesebb_mint_foglalt" ? `${msg} (foglalt: ${r.used})` : msg }, { status: 422 });
  }
  return NextResponse.json({ ...(await payload()), notice });
}
