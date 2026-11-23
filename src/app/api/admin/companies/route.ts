// /api/admin/companies — Admin → Cégek (CSAK admin; terv 12 / 1.3, terv 14 / 2.1–2.2).
//   GET → { migrated, companies: AdminCompany[] }   (a tagok névvel, e-maillel, cégvezetői jelöléssel)
//   GET ?log=<companyId> → { log: CompanyLogEntry[] }
//   POST { action, … } → frissített lista:
//     create         { name, note? }
//     update         { id, name, note }
//     add_member     { id, email }           — csak már regisztrált felhasználó
//     remove_member  { id, userId }
//     appoint_head   { id, userId }          — csak aktív tag
//     remove_head    { id, userId }          — az utolsó cégvezető nem vehető le
//   Terv 21: close { id, reason, force } · reopen { id } · delete_company { id, confirmName } · export_data { id, moduleKey, note }
//            request_deletion { id, reason, confirmName, beforeDeadline } · decide { requestId, approve, reason } · withdraw { requestId }
//            execute_deletion { requestId } · approver { userId, active }
// Minden írás DB-függvényen megy (tranzakció + access_audit_log napló).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import { COMPANY_ERR, COMPANIES_MIGRATION, type AdminCompany, type CompanyLogEntry, type DeletionRequest } from "@/lib/companies";
import { moduleName, registryEntry } from "@/lib/module-registry";
import { MODULE_DATA_HANDLERS } from "@/lib/module-data-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getStaffRole(await createClient());
  return staff && staff.role === "admin" ? staff : null;
}
const missing = (m: string) => /companies|company_members|access_audit_log|function .* does not exist/i.test(m);
const fail = (m: string) => NextResponse.json({ error: missing(m) ? `Futtasd le a ${COMPANIES_MIGRATION} migrációt.` : m }, { status: 500 });

async function userDirectory() {
  const admin = createAdminClient();
  const [{ data: list }, { data: profs }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("profiles").select("id, full_name"),
  ]);
  const name = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? ""]));
  return new Map((list?.users ?? []).map((u) => [u.id, { email: u.email ?? "", name: name.get(u.id) ?? "" }]));
}

async function payload() {
  const admin = createAdminClient();
  const [c, m, b] = await Promise.all([
    admin.from("companies").select("id, name, status, booking_id, note, created_at, closed_at, closed_reason, data_retention_until").order("created_at", { ascending: false }).limit(500),
    admin.from("company_members").select("company_id, user_id, is_company_head, status, joined_at"),
    admin.from("bookings").select("id, starts_at, created_at").not("company_id", "is", null),
  ]);
  if (c.error) return { migrated: !missing(c.error.message), error: c.error.message, companies: [] };
  const dir = await userDirectory();
  // Lezárás és ügyféladat (terv 21): fizetési tétel van-e, élő modulok, a modulok adattárolása; a closure / finance
  // migráció előtt ezek üresek (a lista attól még működik).
  const [{ data: pays }, { data: cms }] = await Promise.all([
    admin.from("company_payments").select("company_id"),
    admin.from("company_modules").select("company_id, module_key, state"),
  ]);
  const payCo = new Set((pays ?? []).map((x) => x.company_id as string));
  const bookingAt = new Map((b.data ?? []).map((r) => [r.id as string, (r.starts_at as string | null) ?? (r.created_at as string)]));
  const companies: AdminCompany[] = (c.data ?? []).map((r) => {
    const members = (m.data ?? []).filter((x) => x.company_id === r.id && x.status === "aktiv").map((x) => ({
      userId: x.user_id as string, name: dir.get(x.user_id as string)?.name ?? "", email: dir.get(x.user_id as string)?.email ?? "",
      isHead: !!x.is_company_head, joinedAt: x.joined_at as string,
    })).sort((a, b) => Number(b.isHead) - Number(a.isHead) || a.email.localeCompare(b.email));
    return {
      id: r.id, name: r.name, status: r.status, note: r.note, createdAt: r.created_at,
      bookingAt: r.booking_id ? bookingAt.get(r.booking_id) ?? null : null, fromBooking: !!r.booking_id, members,
      closedAt: (r.closed_at as string | null) ?? null, closedReason: (r.closed_reason as string | null) ?? null,
      retentionUntil: (r.data_retention_until as string | null) ?? null, hasPayments: payCo.has(r.id as string),
      liveModules: (cms ?? []).filter((x) => x.company_id === r.id && x.state !== "lemondva").length,
      modules: (cms ?? []).filter((x) => x.company_id === r.id).map((x) => ({
        key: x.module_key as string, name: moduleName(x.module_key as string), storesData: !!registryEntry(x.module_key as string)?.storesCustomerData,
      })),
    };
  });
  // Ügyféladat-törlési kérések és a jóváhagyók (terv 21 / 5.)
  const [{ data: reqs }, { data: appr }, { data: admins }] = await Promise.all([
    admin.from("customer_data_requests").select("*").order("requested_at", { ascending: false }).limit(100),
    admin.from("deletion_approvers").select("user_id, active"),
    admin.from("profiles").select("id, full_name").eq("role", "admin"),
  ]);
  const nameOf = (id: string | null) => (id ? dir.get(id)?.name || dir.get(id)?.email || "admin" : "—");
  const compName = new Map(companies.map((c) => [c.id, c.name]));
  const requests: DeletionRequest[] = (reqs ?? []).map((q) => ({
    id: q.id as string, companyId: q.company_id as string, companyName: compName.get(q.company_id as string) ?? "—",
    status: q.status as string, reason: q.reason as string, beforeDeadline: !!q.before_deadline,
    requestedBy: nameOf(q.requested_by as string | null), requestedById: (q.requested_by as string | null) ?? null, requestedAt: q.requested_at as string,
    approvedBy: q.approved_by ? nameOf(q.approved_by as string) : null, rejectedReason: (q.rejected_reason as string | null) ?? null,
    summary: q.result_summary ?? null,
  }));
  const activeApprovers = new Set((appr ?? []).filter((a) => a.active).map((a) => a.user_id as string));
  return {
    migrated: true, companies, requests,
    approvers: (admins ?? []).map((a) => ({ id: a.id as string, name: (a.full_name as string) || dir.get(a.id as string)?.email || "admin", active: activeApprovers.has(a.id as string) })),
  };
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  const logFor = new URL(request.url).searchParams.get("log");
  if (logFor) {
    const { data } = await createAdminClient().from("access_audit_log")
      .select("id, at, actor_id, action, target_user_id, details").eq("company_id", logFor).order("at", { ascending: false }).limit(100);
    const dir = await userDirectory();
    const log: CompanyLogEntry[] = (data ?? []).map((e) => ({
      id: e.id as number, at: e.at as string, action: e.action as string,
      actor: e.actor_id ? dir.get(e.actor_id as string)?.name || dir.get(e.actor_id as string)?.email || "admin" : "rendszer",
      target: e.target_user_id ? dir.get(e.target_user_id as string)?.name || dir.get(e.target_user_id as string)?.email || null : null,
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
  const id = String(b.id ?? ""), userId = String(b.userId ?? "");
  const actor = staff.userId;

  // Ügyféladat törlésének végrehajtása (jóváhagyás után): modulonként a regiszter szerinti kezelő (idempotens);
  // ami ügyféladatot tárol, de nincs kezelője → részleges, újraindítható.
  if (String(b.action ?? "") === "execute_deletion") {
    const reqId = String(b.requestId ?? "");
    const { data: rq } = await admin.from("customer_data_requests").select("company_id, status").eq("id", reqId).maybeSingle();
    if (!rq || !["jovahagyva", "reszben_vegrehajtva"].includes(rq.status as string)) return NextResponse.json({ error: COMPANY_ERR.tiltott_allapot }, { status: 422 });
    const { data: mods } = await admin.from("company_modules").select("module_key").eq("company_id", rq.company_id);
    const summary: { module: string; result: string }[] = [];
    let partial = false;
    for (const m of mods ?? []) {
      const key = m.module_key as string;
      const reg = registryEntry(key);
      if (reg && !reg.storesCustomerData) { summary.push({ module: key, result: "nem tárol ügyféladatot" }); continue; }
      const h = MODULE_DATA_HANDLERS[key];
      if (!h) { partial = true; summary.push({ module: key, result: "nincs törlő kezelő — kézi teendő" }); continue; }
      try { const r = await h(rq.company_id as string); summary.push({ module: key, result: `törölve: ${r.deleted.join(", ") || "—"}` }); }
      catch (e) { partial = true; summary.push({ module: key, result: `hiba: ${(e as Error).message.slice(0, 120)}` }); }
    }
    const { data, error } = await admin.rpc("complete_customer_data_deletion", { p_actor: actor, p_request: reqId, p_summary: summary, p_partial: partial });
    if (error) return fail(error.message);
    if (!(data as { ok: boolean }).ok) return NextResponse.json({ error: COMPANY_ERR.tiltott_allapot }, { status: 422 });
    return NextResponse.json({ ...(await payload()), notice: partial ? "Részben végrehajtva — a hiányzó részek után újraindítható." : "Az ügyféladat törlése végrehajtva." });
  }

  const calls: Record<string, () => PromiseLike<{ data: unknown; error: { message: string } | null }>> = {
    create: () => admin.rpc("admin_create_company", { p_actor: actor, p_name: String(b.name ?? ""), p_note: (b.note as string) ?? null }),
    update: () => admin.rpc("admin_update_company", { p_actor: actor, p_company: id, p_name: String(b.name ?? ""), p_note: String(b.note ?? "") }),
    add_member: () => admin.rpc("admin_add_company_member", { p_actor: actor, p_company: id, p_email: String(b.email ?? "") }),
    remove_member: () => admin.rpc("admin_remove_company_member", { p_actor: actor, p_company: id, p_user: userId }),
    appoint_head: () => admin.rpc("appoint_company_head", { p_actor: actor, p_company: id, p_user: userId }),
    remove_head: () => admin.rpc("remove_company_head", { p_actor: actor, p_company: id, p_user: userId }),
    // Terv 21: lezárás, újranyitás, végleges törlés, ügyféladat
    close: () => admin.rpc("close_company", { p_actor: actor, p_company: id, p_reason: String(b.reason ?? ""), p_force: b.force === true }),
    reopen: () => admin.rpc("reopen_company", { p_actor: actor, p_company: id }),
    delete_company: () => admin.rpc("delete_company_permanently", { p_actor: actor, p_company: id, p_confirm_name: String(b.confirmName ?? "") }),
    export_data: () => admin.rpc("record_customer_data_export", { p_actor: actor, p_company: id, p_module_key: String(b.moduleKey ?? ""), p_note: String(b.note ?? "") }),
    request_deletion: () => admin.rpc("request_customer_data_deletion", { p_actor: actor, p_company: id, p_reason: String(b.reason ?? ""),
      p_confirm_name: String(b.confirmName ?? ""), p_before_deadline: b.beforeDeadline === true }),
    decide: () => admin.rpc("decide_customer_data_deletion", { p_actor: actor, p_request: String(b.requestId ?? ""), p_approve: b.approve === true, p_reason: String(b.reason ?? "") }),
    withdraw: () => admin.rpc("withdraw_customer_data_deletion", { p_actor: actor, p_request: String(b.requestId ?? "") }),
    approver: () => admin.rpc("set_deletion_approver", { p_actor: actor, p_user: userId, p_active: b.active === true }),
  };
  const notices: Record<string, string> = {
    create: "Cég létrehozva.", update: "Mentve.", add_member: "Tag hozzáadva.", remove_member: "Tag eltávolítva.",
    appoint_head: "Cégvezetővé kinevezve.", remove_head: "A cégvezetői státusz megszűnt.",
    close: "A cég lezárva (archiválva). A tagok Besorolatlanok lettek, a munkáik megmaradtak.", reopen: "A cég újra aktív. A tagokat és a modulokat újra be kell állítani.",
    delete_company: "A cég véglegesen törölve.", export_data: "A visszaadás naplózva.",
    request_deletion: "Törlési kérés rögzítve — egy másik, kijelölt admin hagyja jóvá.", decide: "Döntés rögzítve.",
    withdraw: "Kérés visszavonva.", approver: "Jóváhagyók listája frissítve.",
  };
  const action = String(b.action ?? "");
  const call = calls[action];
  if (!call) return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });

  const { data, error } = await call();
  if (error) return /utolso_cegvezeto/.test(error.message) ? NextResponse.json({ error: COMPANY_ERR.utolso_cegvezeto }, { status: 422 }) : fail(error.message);
  const r = data as { ok: boolean; error?: string; company_id?: string };
  if (!r.ok) return NextResponse.json({ error: COMPANY_ERR[r.error ?? ""] ?? "Nem sikerült." }, { status: 422 });
  return NextResponse.json({ ...(await payload()), notice: notices[action], createdId: r.company_id ?? null });
}
