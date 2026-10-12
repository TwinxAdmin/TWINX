// POST /api/office/leave — KÖZÖS MUNKATÉR: önkéntes kilépés, előtte opcionális munka-átadás (KM8).
// body: { historyIds?: string[], recipients?: string[] }
//   1) ha van kijelölt munka ÉS társ: team_handover_works() — minden kijelölt társ SAJÁT PÉLDÁNYT kap
//      (új bejegyzés a munkái között, ugyanarra a fájlra mutat; a tárhelyről semmi nem törlődik)
//   2) team_leave() — a kilépő közös mappákba tett munkái 30 napig még olvashatók, a tagsága megszűnik
// Csak a kiválasztott közös munkatérből lehet kilépni (vezetős irodából a létrehozó távolít el).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership, officeErrorMessage, officeKind } from "@/lib/office-server";

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
  if (ids.length > 0) {
    const { data, error } = await admin.rpc("team_handover_works", {
      p_office: m.office_id, p_from: user.id, p_history_ids: [...new Set(ids)], p_recipients: [...new Set(to)],
    });
    if (error) {
      return NextResponse.json({ error: isMissingFn(error.message) ? MIGRATION : officeErrorMessage(error.message) }, { status: 500 });
    }
    handed = typeof data === "number" ? data : 0;
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
