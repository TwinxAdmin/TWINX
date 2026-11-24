// /api/company/access — a cégvezető „Hozzáférések" ablaka (terv 13; D46). A bejelentkezett felhasználó azokat a
// cégeket látja, ahol AKTÍV CÉGVEZETŐ; más cégét nem. Minden írás a DB-függvényeken megy (cégvezetői jog,
// helyszámítás, napló egy tranzakcióban) — a felhasználó azonosítója mindig a munkamenetből jön.
//   GET → { companies: HeadCompany[] }
//   POST { action, … }:
//     invite  { cmId, email }     → { link? }   (ha a levél nem ment ki: a meghívó linkje EGYSZER, másolásra)
//     resend  { invId }           → { link? }   (új link, a régi érvénytelen)
//     revoke  { invId }
//     remove  { cmId, userId }
//     self    { cmId }            — „Használom én is"
//     appoint { companyId, userId }  — csak a cég aktív tagja
//     resign  { companyId }       — a saját cégvezetői státusz feladása (az utolsó nem)
import { INVITE_VALID_DAYS } from "@/lib/policy";
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moduleName } from "@/lib/module-registry";
import { invitationUrl, sendInvitationMail } from "@/lib/invite-mail";
import { COMPANY_MODULES_MIGRATION } from "@/lib/companies";
import { ACCESS_ERR, type HeadCompany } from "@/lib/company-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function payload(userId: string): Promise<{ companies: HeadCompany[]; error?: string }> {
  const admin = createAdminClient();
  const { data: heads, error } = await admin.from("company_members").select("company_id")
    .eq("user_id", userId).eq("status", "aktiv").eq("is_company_head", true);
  if (error) return { companies: [], error: error.message };
  const ids = (heads ?? []).map((h) => h.company_id as string);
  if (!ids.length) return { companies: [] };

  const now = new Date().toISOString();
  const [comps, members, mods, acc, invs] = await Promise.all([
    admin.from("companies").select("id, name, status").in("id", ids).neq("status", "lezart"),
    admin.from("company_members").select("company_id, user_id, is_company_head").in("company_id", ids).eq("status", "aktiv"),
    // A cégvezető csak az AKTIVÁLT modult látja (D44).
    admin.from("company_modules").select("id, company_id, module_key, seats, valid_until").in("company_id", ids).eq("state", "aktiv"),
    admin.from("module_access").select("company_module_id, user_id").in("company_id", ids).eq("status", "aktiv"),
    admin.from("module_invitations").select("id, company_module_id, email, status, expires_at").in("company_id", ids).in("status", ["meghivva", "lejart"]),
  ]);
  const userIds = [...new Set([...(members.data ?? []).map((m) => m.user_id as string), ...(acc.data ?? []).map((a) => a.user_id as string)])];
  const [{ data: profs }, emails] = await Promise.all([
    userIds.length ? admin.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    Promise.all(userIds.map(async (id) => [id, (await admin.auth.admin.getUserById(id)).data.user?.email ?? ""] as const)),
  ]);
  const name = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const email = new Map(emails);
  const person = (id: string) => ({ userId: id, name: name.get(id) ?? "", email: email.get(id) ?? "" });

  const companies: HeadCompany[] = (comps.data ?? []).map((c) => {
    const cMembers = (members.data ?? []).filter((m) => m.company_id === c.id);
    return {
      id: c.id as string, name: c.name as string,
      heads: cMembers.filter((m) => m.is_company_head).map((m) => person(m.user_id as string)),
      members: cMembers.map((m) => ({ ...person(m.user_id as string), isHead: !!m.is_company_head })),
      modules: (mods.data ?? []).filter((m) => m.company_id === c.id).map((m) => {
        const active = (acc.data ?? []).filter((a) => a.company_module_id === m.id).map((a) => person(a.user_id as string));
        const invites = (invs.data ?? []).filter((i) => i.company_module_id === m.id).map((i) => {
          const expired = i.status === "lejart" || (i.expires_at as string) <= now;
          return { id: i.id as string, email: i.email as string, expiresAt: i.expires_at as string, expired };
        });
        const used = active.length + invites.filter((i) => !i.expired).length;
        return {
          id: m.id as string, key: m.module_key as string, name: moduleName(m.module_key as string),
          seats: m.seats as number, used, validUntil: m.valid_until as string | null,
          active, invites, meHasAccess: active.some((a) => a.userId === userId),
        };
      }),
    };
  });
  return { companies };
}

export async function GET() {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const p = await payload(user.id);
  if (p.error) return NextResponse.json({ error: /company_|module_/.test(p.error) ? `Futtasd le a ${COMPANY_MODULES_MIGRATION} migrációt.` : p.error }, { status: 500 });
  return NextResponse.json(p);
}

export async function POST(request: Request) {
  const user = await me();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const admin = createAdminClient();
  const actor = user.id;
  const origin = new URL(request.url).origin;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  let notice = "Mentve.";
  let link: string | null = null;

  // Meghívó levél (vagy link-tartalék) az új tokennel.
  async function deliver(invId: string, token: string): Promise<void> {
    const { data: inv } = await admin.from("module_invitations").select("email, company_id, module_key").eq("id", invId).maybeSingle();
    if (!inv) return;
    const [{ data: comp }, { data: prof }] = await Promise.all([
      admin.from("companies").select("name").eq("id", inv.company_id).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", actor).maybeSingle(),
    ]);
    const sent = await sendInvitationMail({
      to: inv.email as string, token, moduleName: moduleName(inv.module_key as string), companyName: (comp?.name as string) ?? "",
      inviterName: (prof?.full_name as string | null) ?? null, origin,
    });
    if (sent) notice = `Meghívó elküldve: ${inv.email}`;
    else { link = invitationUrl(token, origin); notice = "A meghívó létrejött, de a levelet most nem tudtuk elküldeni — másold ki a linket, és küldd el te."; }
  }

  let res: { data: unknown; error: { message: string } | null };
  switch (String(b.action ?? "")) {
    case "invite": {
      const token = randomBytes(32).toString("base64url");
      res = await admin.rpc("create_invitation", { p_actor: actor, p_cm: str(b.cmId), p_email: str(b.email), p_token_hash: sha256(token), p_days: INVITE_VALID_DAYS });
      const r = res.data as { ok?: boolean; id?: string } | null;
      if (!res.error && r?.ok && r.id) await deliver(r.id, token);
      break;
    }
    case "resend": {
      const token = randomBytes(32).toString("base64url");
      res = await admin.rpc("resend_invitation", { p_actor: actor, p_inv: str(b.invId), p_token_hash: sha256(token), p_days: INVITE_VALID_DAYS });
      if (!res.error && (res.data as { ok?: boolean } | null)?.ok) await deliver(str(b.invId), token);
      break;
    }
    case "revoke":
      res = await admin.rpc("revoke_invitation", { p_actor: actor, p_inv: str(b.invId) }); notice = "Meghívó visszavonva, a hely felszabadult."; break;
    case "remove":
      res = await admin.rpc("remove_access", { p_actor: actor, p_cm: str(b.cmId), p_user: str(b.userId) }); notice = "Eltávolítva, a hely felszabadult."; break;
    case "self":
      res = await admin.rpc("add_self_access", { p_actor: actor, p_cm: str(b.cmId) }); notice = "Kész: a modul a Moduljaim menüben."; break;
    case "appoint":
      res = await admin.rpc("appoint_company_head", { p_actor: actor, p_company: str(b.companyId), p_user: str(b.userId) }); notice = "Cégvezetővé kinevezve."; break;
    case "resign":
      res = await admin.rpc("remove_company_head", { p_actor: actor, p_company: str(b.companyId), p_user: actor }); notice = "Lemondtál a cégvezetői státuszról."; break;
    default:
      return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });
  }

  if (res.error) return NextResponse.json({ error: /function .* does not exist|module_|company_/.test(res.error.message) ? `Futtasd le a ${COMPANY_MODULES_MIGRATION} migrációt.` : res.error.message }, { status: 500 });
  const r = res.data as { ok: boolean; error?: string };
  if (!r.ok) return NextResponse.json({ error: ACCESS_ERR[r.error ?? ""] ?? "Nem sikerült." }, { status: 422 });
  return NextResponse.json({ ...(await payload(actor)), notice, link });
}
