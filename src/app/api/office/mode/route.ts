// PATCH /api/office/mode — munkamód / kiválasztott iroda váltása.
// body: { mode?: "office" | "private", officeId?: string }
//   • mode: „office" = a kiválasztott iroda keretéből dolgozik, „private" = a saját kreditjéből
//   • officeId: másik irodára váltás (csak ha tagja) — egyben irodai módba is kapcsol
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembershipIn, getWorkContext, setWorkContext } from "@/lib/office-server";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { mode?: string; officeId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const mode = body.mode === "office" || body.mode === "private" ? body.mode : undefined;
  const officeId = body.officeId ? String(body.officeId) : undefined;
  if (!mode && !officeId) return NextResponse.json({ error: "Ismeretlen munkamód." }, { status: 422 });

  if (officeId && !(await getMembershipIn(user.id, officeId))) {
    return NextResponse.json({ error: "Ennek az irodának nem vagy tagja." }, { status: 403 });
  }

  const error = await setWorkContext(user.id, {
    ...(officeId ? { officeId, useOffice: true } : {}),
    ...(mode ? { useOffice: mode === "office" } : {}),
  });
  if (error) {
    // Régi séma (office-multi.sql még nincs): a work_mode oszlopot állítjuk.
    if (mode) {
      const { error: e2 } = await createAdminClient().from("office_members").update({ work_mode: mode }).eq("user_id", user.id);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Több iroda közti váltáshoz futtasd le az office-multi.sql migrációt." }, { status: 500 });
    }
  }
  const ctx = await getWorkContext(user.id);
  return NextResponse.json({ ok: true, mode: ctx.useOffice ? "office" : "private", officeId: ctx.officeId });
}
