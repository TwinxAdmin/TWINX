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

  const {
    userId,
    email,
    amount,
  } = (body ?? {}) as {
    userId?: string;
    email?: string;
    amount?: number;
  };

  if (!Number.isInteger(amount) || (amount ?? 0) <= 0) {
    return NextResponse.json(
      { error: "A kredit mennyiség pozitív egész szám legyen." },
      { status: 422 }
    );
  }
  if (!userId && !email) {
    return NextResponse.json(
      { error: "Add meg a felhasználó e-mail címét vagy azonosítóját." },
      { status: 422 }
    );
  }

  const admin = createAdminClient();

  // Felhasználó feloldása e-mail alapján (ha nem userId-t adtak meg).
  let resolvedUserId = userId;
  if (!resolvedUserId && email) {
    const { data: list } = await admin.auth.admin.listUsers();
    const found = list?.users?.find(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );
    if (!found) {
      return NextResponse.json(
        { error: "Nincs ilyen e-mailű felhasználó." },
        { status: 404 }
      );
    }
    resolvedUserId = found.id;
  }

  // Közös egyenlegre írunk jóvá (bármelyik modulban elkölthető).
  const { error } = await admin.rpc("wallet_add", {
    p_user_id: resolvedUserId,
    p_amount: amount,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
