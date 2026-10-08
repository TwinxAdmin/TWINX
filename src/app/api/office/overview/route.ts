// GET /api/office/overview?range=month|30d|all — az irodai felület összesítője a KIVÁLASZTOTT irodára.
//   • Létrehozó / vezető (kiosztó jogú): egyenleg, szabad / kiosztott rész, felhasználás, tagonkénti statisztika,
//     csatlakozási kód. (Feltölteni és új kódot kérni csak a létrehozó tud — ezt a canTopup / canRegenerate jelzi.)
//   • Kolléga: csak a SAJÁT kerete, saját kreditje, saját felhasználása — az irodai egyenleget nem kapja meg.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership, getWorkContext } from "@/lib/office-server";
import { managerOverview, memberOverview, parseRange, roleLabelOf } from "@/lib/office-overview";
import { officeMemberPreview } from "@/lib/view-as";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const me = await getMembership(user.id);
  if (!me) return NextResponse.json({ office: null });

  const range = parseRange(new URL(request.url).searchParams.get("range"));
  const admin = createAdminClient();
  const [{ data: office }, { data: profile }, ctx] = await Promise.all([
    admin.from("offices").select("id, name, join_code").eq("id", me.office_id).single(),
    admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    getWorkContext(user.id),
  ]);
  if (!office) return NextResponse.json({ office: null });

  const roleLabel = roleLabelOf(me);
  // Kolléga-nézet előnézete (vezetőnek): a kolléga-összesítőt kapja — csak megjelenítés.
  const preview = roleLabel !== "member" && (await officeMemberPreview());
  const isManager = roleLabel !== "member" && !preview;
  const meInfo = {
    userId: user.id,
    name: (profile?.full_name as string) || "",
    roleLabel,
    allowance: me.allowance ?? 0,
    unlimited: !!me.unlimited,
    workMode: ctx.useOffice && ctx.officeId === me.office_id ? "office" : "private",
  };

  if (isManager) {
    const data = await managerOverview(me.office_id, range);
    return NextResponse.json({
      view: "manager",
      range,
      office: {
        id: office.id, name: office.name, joinCode: office.join_code,
        canRegenerate: roleLabel === "owner", canTopup: roleLabel === "owner",
      },
      me: meInfo,
      ...data,
    });
  }

  const data = await memberOverview(me.office_id, user.id, range);
  return NextResponse.json({
    view: "member",
    preview,   // vezető nézi kolléga-előnézetben → a felület ne írjon (pl. „Miből fizetek?" kapcsoló)
    range,
    office: { id: office.id, name: office.name },
    me: meInfo,
    kpi: { allowance: me.allowance ?? 0, unlimited: !!me.unlimited || me.role === "owner", wallet: data.wallet, spent: data.spent, works: data.works },
  });
}
