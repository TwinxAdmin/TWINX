// GET /api/sales/users/:id — egy ÜGYFÉL adatai a Sales számára (Sales → Felhasználók → „Részletek").
// Admin és sales érheti el, csak olvas. MINDIG a szűkített (sales) nézetet adja: számlázás, vásárlások, jóváírások,
// kredit-kérések nélkül. Csak ügyfél (profiles.role = 'user') nyitható meg — admin / sales fiók nem.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import { getUserDetails } from "@/lib/admin-user-details";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffRole(await createClient());
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Érvénytelen azonosító." }, { status: 400 });

  const { data: prof } = await createAdminClient().from("profiles").select("role").eq("id", id).maybeSingle();
  if (!prof || prof.role !== "user") return NextResponse.json({ error: "Nincs ilyen ügyfél." }, { status: 404 });

  const details = await getUserDetails(id, "sales");
  if (!details) return NextResponse.json({ error: "Nincs ilyen ügyfél." }, { status: 404 });
  return NextResponse.json(details);
}
