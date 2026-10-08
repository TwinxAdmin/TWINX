// POST /api/office/join — csatlakozás egy irodához csatlakozási kóddal. body: { code }
// Szabályok (TODO.md 6.7): csak bejelentkezett (regisztrált) felhasználó; azonnali
// csatlakozás; az új tag keretje 0. Több irodának is lehet tagja (váltás a kredit-sávon).
// Visszaélés: a kód ~887 millió változatú, és egy kiszivárgott kóddal sem lehet költeni
// (0 keret) — a létrehozó később új kódot generálhat.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidJoinCode, normalizeJoinCode } from "@/lib/office";
import { loadMyOffice, setWorkContext } from "@/lib/office-server";

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

  // 2) Létező iroda?
  const { data: office } = await admin.from("offices").select("id").eq("join_code", code).maybeSingle();
  if (!office) return NextResponse.json({ errors: { code: "Ilyen kódú iroda nincs. Ellenőrizd a kódot." } }, { status: 404 });

  // 3) Ennek az irodának már tagja?
  const { data: already } = await admin
    .from("office_members").select("office_id").eq("user_id", user.id).eq("office_id", office.id).maybeSingle();
  if (already) return NextResponse.json({ error: "Ennek az irodának már tagja vagy." }, { status: 409 });

  // 4) Tagság mentése — 0 kerettel, jogosultságok nélkül.
  const { error } = await admin.from("office_members").insert({
    office_id: office.id,
    user_id: user.id,
    role: "member",
    allowance: 0,
    joined_via: "code",
  });
  if (error) {
    const dup = /office_members_user_id_key/i.test(error.message);
    return NextResponse.json(
      { error: dup ? "Több irodához csatlakozáshoz futtasd le az office-multi.sql migrációt." : /duplicate key|pkey/i.test(error.message) ? "Ennek az irodának már tagja vagy." : error.message },
      { status: 409 }
    );
  }

  // A most csatlakozott iroda lesz a kiválasztott, irodai módban.
  await setWorkContext(user.id, { officeId: office.id as string, useOffice: true });

  return NextResponse.json({ ok: true, office: await loadMyOffice(user.id) });
}
