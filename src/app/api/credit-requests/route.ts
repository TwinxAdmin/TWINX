// GET  /api/credit-requests — a saját kéréseim (adminnak: az összes függő kérés).
// POST /api/credit-requests — új kredit-kérés beadása (sales és sima felhasználó).
//
// A kérés adatait a SZERVER állítja össze (ki kéri, mennyi az egyenlege), hogy a
// böngészőből ne lehessen manipulálni. Egyszerre egy függő kérés lehet.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCreditRequestNotification } from "@/lib/email";

export const runtime = "nodejs";

const MAX_AMOUNT = 1000;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  // RLS: a sajátját látja; adminnál az összeset engedi a policy.
  const { data, error } = await supabase
    .from("credit_requests")
    .select("id, user_email, amount, reason, status, decided_at, decision_note, granted_amount, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { amount?: number; reason?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return NextResponse.json(
      { error: `A kért mennyiség 1 és ${MAX_AMOUNT} közötti egész szám legyen.` }, { status: 422 }
    );
  }
  const reason = String(body.reason ?? "").trim().slice(0, 500);

  const admin = createAdminClient();

  // Az admin korlátlan — neki nincs értelme kérnie.
  const { data: me } = await admin
    .from("profiles").select("role, full_name").eq("id", user.id).single();
  if (me?.role === "admin") {
    return NextResponse.json({ error: "Adminként korlátlanul használhatod, nem kell kérned." }, { status: 400 });
  }

  const { data: wallet } = await admin
    .from("wallets").select("balance").eq("user_id", user.id).maybeSingle();

  const { data: created, error } = await admin
    .from("credit_requests")
    .insert({
      user_id: user.id,
      user_email: user.email ?? null,
      amount,
      reason: reason || null,
    })
    .select("id, amount, reason, status, created_at")
    .single();

  if (error) {
    // 23505 = az egyedi index szerint már van függő kérése.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Már van elbírálásra váró kérésed. Várd meg a választ, vagy szólj az adminnak." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Értesítés az adminoknak. Ha az e-mail nem megy ki, a kérés attól még él —
  // ezért nem buktatjuk el a választ, csak jelezzük.
  let emailed = true;
  try {
    await sendCreditRequestNotification({
      requesterName: (me?.full_name as string) ?? undefined,
      requesterEmail: user.email ?? "",
      amount,
      reason: reason || undefined,
      balance: wallet?.balance ?? 0,
    });
  } catch (e) {
    emailed = false;
    console.error("[credit-requests] Az értesítő e-mail nem ment ki:", (e as Error).message);
  }

  return NextResponse.json({ ok: true, item: created, emailed });
}
