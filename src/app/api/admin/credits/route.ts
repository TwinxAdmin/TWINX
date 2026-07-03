// POST /api/admin/credits — admin kézi kredit adása egy fióknak.
// Prezentációs / értékesítői célra: az admin manuálisan tölthet fel kreditet.
// Csak 'admin' szerepkör hívhatja.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  }

  // A hívó admin-e? (a profiles select policy engedi a saját sort olvasni)
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Csak admin végezheti." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { userId, serviceSlug, amount } = (body ?? {}) as {
    userId?: string;
    serviceSlug?: string;
    amount?: number;
  };

  if (!userId || !serviceSlug || !Number.isInteger(amount) || (amount ?? 0) <= 0) {
    return NextResponse.json(
      { error: "Hiányzó vagy hibás adat (userId, serviceSlug, amount>0)." },
      { status: 422 }
    );
  }

  const admin = createAdminClient();

  const { data: service } = await admin
    .from("services")
    .select("id")
    .eq("slug", serviceSlug)
    .single();

  if (!service) {
    return NextResponse.json({ error: "A modul nem található." }, { status: 400 });
  }

  const { error } = await admin.rpc("add_credits", {
    p_user_id: userId,
    p_service_id: service.id,
    p_amount: amount,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
