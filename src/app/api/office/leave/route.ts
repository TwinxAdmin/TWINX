// POST /api/office/leave — KÖZÖS MUNKATÉR: önkéntes kilépés, előtte opcionális munka-átadás (KM8).
// body: { historyIds?: string[], recipients?: string[] }
//   1) ha van kijelölt munka ÉS társ: team_handover_works() — minden kijelölt társ SAJÁT PÉLDÁNYT kap
//      (új bejegyzés a munkái között, ugyanarra a fájlra mutat; a tárhelyről semmi nem törlődik)
//      + ÉRTESÍTÉS: minden címzett egy „Kész munka" üzenetet kap a munkatérben (a kilépőtől, még a kilépés
//        előtt): ki adta át, hány munkát, melyeket — az első átadott példány csatolva (egy kattintással megnyílik)
//   2) team_leave() — a kilépő közös mappákba tett munkái 30 napig még olvashatók, a tagsága megszűnik
// Csak a kiválasztott közös munkatérből lehet kilépni (vezetős irodából a létrehozó távolít el).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership, officeErrorMessage, officeKind } from "@/lib/office-server";
import { activityTitle } from "@/lib/activity";

export const runtime = "nodejs";

const MIGRATION = "A kilépéshez futtasd le a 20261012105023_team-workspace.sql migrációt.";
const isMissingFn = (msg: string) => /function .* does not exist|team_(leave|handover_works)/i.test(msg) && !/TEAM_/.test(msg);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const m = await getMembership(user.id);
  if (!m) return NextResponse.json({ error: "Nem vagy tagja közös munkatérnek." }, { status: 403 });
  if ((await officeKind(m.office_id)) !== "team") {
    return NextResponse.json({ error: "Csak közös munkatérből lehet így kilépni." }, { status: 403 });
  }

  let body: { historyIds?: unknown; recipients?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  // 1) Validáció
  const ids = (Array.isArray(body.historyIds) ? body.historyIds : []).map(String).filter(Boolean);
  const to = (Array.isArray(body.recipients) ? body.recipients : []).map(String).filter(Boolean);
  if (ids.length > 50) return NextResponse.json({ error: "Egyszerre legfeljebb 50 munkát adhatsz át." }, { status: 422 });
  if (to.length > 4) return NextResponse.json({ error: "Legfeljebb 4 társnak adhatsz át." }, { status: 422 });
  if (ids.length > 0 && to.length === 0) return NextResponse.json({ error: "Válaszd ki, kinek adod át a munkákat." }, { status: 422 });
  if (to.length > 0 && ids.length === 0) return NextResponse.json({ error: "Válaszd ki, mely munkákat adod át." }, { status: 422 });
  if (to.includes(user.id)) return NextResponse.json({ error: "Magadnak nem adhatsz át munkát." }, { status: 422 });

  const admin = createAdminClient();

  // 2) Átadás (saját példány minden kijelölt társnak)
  let handed = 0;
  const startedAt = new Date(Date.now() - 5000).toISOString();
  if (ids.length > 0) {
    const { data, error } = await admin.rpc("team_handover_works", {
      p_office: m.office_id, p_from: user.id, p_history_ids: [...new Set(ids)], p_recipients: [...new Set(to)],
    });
    if (error) {
      return NextResponse.json({ error: isMissingFn(error.message) ? MIGRATION : officeErrorMessage(error.message) }, { status: 500 });
    }
    handed = typeof data === "number" ? data : 0;
    if (handed > 0) await notifyRecipients(admin, m.office_id, user.id, startedAt);
  }

  // 3) Kilépés
  const { error: leaveError } = await admin.rpc("team_leave", { p_office: m.office_id, p_user: user.id });
  if (leaveError) {
    return NextResponse.json({
      error: isMissingFn(leaveError.message) ? MIGRATION : officeErrorMessage(leaveError.message),
      handed,
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, handed });
}

/**
 * Értesítés az átadásról: címzettenként EGY „Kész munka" üzenet a munkatérben (a kilépő még tag, így
 * a feladó neve rendesen látszik). Az átadás napló (office_work_handovers) alapján — ha bármi hibázik,
 * a kilépés nem akad el miatta (az átadás már megtörtént).
 */
async function notifyRecipients(admin: ReturnType<typeof createAdminClient>, officeId: string, fromUser: string, since: string) {
  try {
    const { data: rows } = await admin
      .from("office_work_handovers").select("to_user, new_history, created_at")
      .eq("office_id", officeId).eq("from_user", fromUser).gte("created_at", since)
      .order("created_at", { ascending: true }).limit(400);
    if (!rows?.length) return;

    const byRecipient = new Map<string, string[]>();
    for (const r of rows) {
      if (!r.to_user || !r.new_history) continue;
      byRecipient.set(r.to_user as string, [...(byRecipient.get(r.to_user as string) ?? []), r.new_history as string]);
    }

    const allIds = [...new Set([...byRecipient.values()].flat())];
    const [{ data: works }, { data: profile }] = await Promise.all([
      admin.from("usage_history").select("id, feature_used, input_data, created_at").in("id", allIds),
      admin.from("profiles").select("full_name").eq("id", fromUser).maybeSingle(),
    ]);
    const titleOf = new Map((works ?? []).map((w) => [w.id as string,
      activityTitle(w.feature_used as string, w.input_data as Record<string, unknown> | null, w.created_at as string)]));
    let sender = (profile?.full_name as string) || "";
    if (!sender) {
      const { data: u } = await admin.auth.admin.getUserById(fromUser);
      sender = u.user?.email ?? "Egy társad";
    }

    const messages = [...byRecipient.entries()].map(([to, hist]) => {
      const titles = hist.map((id) => titleOf.get(id)).filter(Boolean) as string[];
      const list = titles.slice(0, 5).join(", ") + (titles.length > 5 ? ` és még ${titles.length - 5}` : "");
      const body = `${sender} kilépett a munkatérből, és átadott neked ${hist.length} munkát${list ? `: ${list}` : ""}. `
        + "A Korábbi munkáid között találod őket — mostantól a tieid.";
      return {
        office_id: officeId, sender_id: fromUser, recipient_id: to, kind: "done",
        body: body.slice(0, 2000), history_id: hist[0],
      };
    });
    await admin.from("office_messages").insert(messages);
  } catch {
    // az értesítés nem kötelező lépés — az átadás és a kilépés ettől függetlenül megtörténik
  }
}
