// POST /api/admin/ideas — ötlet moderáció (CSAK admin).
// action: 'approve' | 'reject' | 'delete'.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Csak admin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { id, action } = (body ?? {}) as { id?: string; action?: string };
  if (!id || !["approve", "reject", "delete"].includes(action ?? "")) {
    return NextResponse.json({ error: "Hiányzó vagy hibás adat." }, { status: 422 });
  }

  const admin = createAdminClient();

  if (action === "delete") {
    const { error } = await admin.from("ideas").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const status = action === "approve" ? "approved" : "rejected";
    const { error } = await admin
      .from("ideas")
      .update({
        status,
        approved_at: action === "approve" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
