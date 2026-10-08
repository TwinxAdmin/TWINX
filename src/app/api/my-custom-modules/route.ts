// GET /api/my-custom-modules — a bejelentkezett felhasználó SAJÁT (neki fejlesztett) egyedi moduljai.
// Forrás: company_access (kinek van hozzáférése) + services (status = 'private').
// Szándékosan a felhasználó saját hozzáféréseit nézzük — adminnál sem listázzuk az összes privát modult.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const admin = createAdminClient();
  const { data: access } = await admin.from("company_access").select("service_id").eq("user_id", user.id);
  const ids = (access ?? []).map((a) => a.service_id as string);
  if (ids.length === 0) return NextResponse.json({ modules: [] });

  const { data: services } = await admin
    .from("services").select("id, name, slug").in("id", ids).eq("status", "private").order("name");

  return NextResponse.json({
    modules: (services ?? []).map((s) => ({ id: s.id as string, name: s.name as string, href: "/dashboard/custom" })),
  });
}
