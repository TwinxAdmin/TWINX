// POST /api/office/join — csatlakozás egy irodához csatlakozási kóddal. body: { code }
// Szabályok (TODO.md 6.7): csak bejelentkezett (regisztrált) felhasználó; azonnali
// csatlakozás; az új tag keretje 0; egy felhasználó = egy iroda.
// Visszaélés: a kód ~887 millió változatú, és egy kiszivárgott kóddal sem lehet költeni
// (0 keret) — a létrehozó később új kódot generálhat.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidJoinCode, normalizeJoinCode } from "@/lib/office";
import { loadMyOffice } from "@/lib/office-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "A csatlakozáshoz be kell jelentkezned." }, { status: 401 });

  let body: { code?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  // 1) Validáció
  const code = normalizeJoinCode(String(body.code ?? ""));
  if (!isValidJoinCode(code)) {
    return NextResponse.json({ errors: { code: "A kód formátuma: TWX- és 6 karakter (pl. TWX-8K4P9R)." } }, { status: 422 });
  }

  const admin = createAdminClient();

  // 2) Már tag valahol?
  const { data: member } = await admin
    .from("office_members").select("office_id").eq("user_id", user.id).maybeSingle();
  if (member) return NextResponse.json({ error: "Már tagja vagy egy irodai fióknak." }, { status: 409 });

  // 3) Létező iroda?
  const { data: office } = await admin.from("offices").select("id").eq("join_code", code).maybeSingle();
  if (!office) return NextResponse.json({ errors: { code: "Ilyen kódú iroda nincs. Ellenőrizd a kódot." } }, { status: 404 });

  // 4) Tagság mentése — 0 kerettel, jogosultságok nélkül.
  const { error } = await admin.from("office_members").insert({
    office_id: office.id,
    user_id: user.id,
    role: "member",
    allowance: 0,
    joined_via: "code",
  });
  if (error) {
    const dup = /duplicate key|office_members_user_id_key|office_members_pkey/i.test(error.message);
    return NextResponse.json(
      { error: dup ? "Már tagja vagy egy irodai fióknak." : error.message },
      { status: dup ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true, office: await loadMyOffice(user.id) });
}
