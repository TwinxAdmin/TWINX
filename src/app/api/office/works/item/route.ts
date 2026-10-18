// GET /api/office/works/item?id=… — egy (megosztott) értékbecslés betöltése szerkesztésre.
// Akkor adja vissza, ha a hívó szerkesztheti (saját munka, vagy egy általa látott közös mappában van).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEditWork } from "@/lib/office-folders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";

  const edit = await canEditWork(id, user.id);
  if (!edit.ok) return NextResponse.json({ error: "Ezt a munkát nem nyithatod meg." }, { status: 403 });

  const BASE_COLS = "id, feature_used, input_data, output_text, output_file_url, created_at, edited_at, valuation_audit";
  const admin = createAdminClient();
  const one = (cols: string) => admin.from("usage_history").select(cols).eq("id", id).maybeSingle();
  // a partneri módosítások + az elfogadás (20261018223526_valuation-accept.sql) — nélküle a régi oszlopok (tartalékág)
  const first = await one(`${BASE_COLS}, valuation_overrides, valuation_accepted_at`);
  const { data, error } = (first.error ? await one(BASE_COLS) : first) as { data: Record<string, unknown> | null; error: unknown };
  if (error || !data) return NextResponse.json({ error: "Nem található." }, { status: 404 });
  if (data.feature_used !== "valuation") return NextResponse.json({ error: "Ez a munka nem szerkeszthető." }, { status: 400 });
  return NextResponse.json({ item: { ...data, valuation_folder_id: null } });
}
