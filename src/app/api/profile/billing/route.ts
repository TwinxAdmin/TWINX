// POST /api/profile/billing — a bejelentkezett partner SAJÁT számlázási adatai.
// A validáció szerveroldalon is lefut (lib/billing.ts), hogy hiányos adat ne
// kerülhessen be — a kredit-kérés kapuja ugyanezt a szabályt nézi.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateBilling, type BillingInfo } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: Partial<BillingInfo>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const check = validateBilling(body);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 });

  // RLS: a "profiles_update_own" policy engedi a saját sor módosítását.
  const { error } = await supabase.from("profiles").update(check.value).eq("id", user.id);
  if (error) {
    // Tipikus ok: még nem futott le a credit-billing.sql migráció.
    return NextResponse.json(
      { error: `A mentés nem sikerült: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, billing: check.value });
}
