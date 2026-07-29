// POST /api/profile — a bejelentkezett partner saját nevének és cégének mentése.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: Record<string, string>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const name = String(body.name ?? "").trim();
  const company = String(body.company ?? "").trim();
  if (name.length > 80 || company.length > 120) {
    return NextResponse.json({ error: "Túl hosszú érték." }, { status: 422 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name || null, company: company || null })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Az auth metadata is frissül, hogy a két forrás ne csússzon el.
  await supabase.auth.updateUser({ data: { full_name: name, company } });

  return NextResponse.json({ ok: true });
}
