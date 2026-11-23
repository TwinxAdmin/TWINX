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
// Minden írás DB-függvényen megy (tranzakció + access_audit_log napló).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import { COMPANY_ERR, COMPANIES_MIGRATION, type AdminCompany, type CompanyLogEntry } from "@/lib/companies";

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
    admin.from("companies").select("id, name, status, booking_id, note, created_at").order("created_at", { ascending: false }).limit(500),
    admin.from("company_members").select("company_id, user_id, is_company_head, status, joined_at"),
    admin.from("bookings").select("id, starts_at, created_at").not("company_id", "is", null),
  ]);
  if (c.error) return { migrated: !missing(c.error.message), error: c.error.message, companies: [] };
  const dir = await userDirectory();
  const bookingAt = new Map((b.data ?? []).map((r) => [r.id as string, (r.starts_at as string | null) ?? (r.created_at as string)]));
  const companies: AdminCompany[] = (c.data ?? []).map((r) => {
    const members = (m.data ?? []).filter((x) => x.company_id === r.id && x.status === "aktiv").map((x) => ({
      userId: x.user_id as string, name: dir.get(x.user_id as string)?.name ?? "", email: dir.get(x.user_id as string)?.email ?? "",
      isHead: !!x.is_company_head, joinedAt: x.joined_at as string,
    })).sort((a, b) => Number(b.isHead) - Number(a.isHead) || a.email.localeCompare(b.email));
    return {
      id: r.id, name: r.name, status: r.status, note: r.note, createdAt: r.created_at,
      bookingAt: r.booking_id ? bookingAt.get(r.booking_id) ?? null : null, fromBooking: !!r.booking_id, members,
    };
  });
  return { migrated: true, companies };
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

  const calls: Record<string, () => PromiseLike<{ data: unknown; error: { message: string } | null }>> = {
    create: () => admin.rpc("admin_create_company", { p_actor: actor, p_name: String(b.name ?? ""), p_note: (b.note as string) ?? null }),
    update: () => admin.rpc("admin_update_company", { p_actor: actor, p_company: id, p_name: String(b.name ?? ""), p_note: String(b.note ?? "") }),
    add_member: () => admin.rpc("admin_add_company_member", { p_actor: actor, p_company: id, p_email: String(b.email ?? "") }),
    remove_member: () => admin.rpc("admin_remove_company_member", { p_actor: actor, p_company: id, p_user: userId }),
    appoint_head: () => admin.rpc("appoint_company_head", { p_actor: actor, p_company: id, p_user: userId }),
    remove_head: () => admin.rpc("remove_company_head", { p_actor: actor, p_company: id, p_user: userId }),
  };
  const notices: Record<string, string> = {
    create: "Cég létrehozva.", update: "Mentve.", add_member: "Tag hozzáadva.", remove_member: "Tag eltávolítva.",
    appoint_head: "Cégvezetővé kinevezve.", remove_head: "A cégvezetői státusz megszűnt.",
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
