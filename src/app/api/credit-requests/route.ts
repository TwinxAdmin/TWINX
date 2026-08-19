// GET  /api/credit-requests — a saját kéréseim (adminnak: az összes függő kérés).
// POST /api/credit-requests — új kredit-kérés beadása (sales és sima felhasználó).
//
// A kérés adatait a SZERVER állítja össze (ki kéri, mennyi az egyenlege, mennyibe
// kerül), hogy a böngészőből ne lehessen manipulálni. Egyszerre egy függő kérés lehet.
//
// Két ág:
//   • sales  → billing_kind='free'    — belső keret, nincs számlázás.
//   • user   → billing_kind='invoice' — fix csomag, számlát állítunk ki, és a
//              kredit CSAK a befizetés rögzítése után íródik jóvá.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCreditRequestNotification } from "@/lib/email";
import { getPackage } from "@/lib/packages";
import { validateBilling, type BillingInfo } from "@/lib/billing";

export const runtime = "nodejs";

const MAX_AMOUNT = 1000;

const BILLING_COLS =
  "billing_type, billing_name, billing_tax_number, billing_country, billing_zip, billing_city, billing_address, billing_email";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  // RLS: a sajátját látja; adminnál az összeset engedi a policy.
  const { data, error } = await supabase
    .from("credit_requests")
    .select(
      "id, user_email, amount, reason, status, decided_at, decision_note, granted_amount, created_at, " +
      "package_id, net_huf, billing_kind, invoice_status, invoice_number"
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { amount?: number; reason?: string; packageId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const reason = String(body.reason ?? "").trim().slice(0, 500);
  const admin = createAdminClient();

  // Az admin korlátlan — neki nincs értelme kérnie.
  const { data: me } = await admin
    .from("profiles").select("role, full_name").eq("id", user.id).single();
  const role = (me?.role as string) ?? "user";
  if (role === "admin") {
    return NextResponse.json({ error: "Adminként korlátlanul használhatod, nem kell kérned." }, { status: 400 });
  }

  // Sales = belső keret (ingyen). Minden más = számlázandó megrendelés.
  const isFree = role === "sales";

  // --- A csomag és az ár SZERVEROLDALON dől el (a böngészőből csak az azonosító jön) ---
  let amount: number;
  let packageId: string | null = null;
  let netHuf: number | null = null;

  if (isFree) {
    amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      return NextResponse.json(
        { error: `A kért mennyiség 1 és ${MAX_AMOUNT} közötti egész szám legyen.` }, { status: 422 }
      );
    }
  } else {
    const pkg = getPackage(String(body.packageId ?? ""));
    if (!pkg) return NextResponse.json({ error: "Válassz egy érvényes csomagot." }, { status: 422 });
    amount = pkg.credits;
    packageId = pkg.id;
    netHuf = pkg.priceHuf;
  }

  // --- Számlázási adat: a számlás ágon KÖTELEZŐ, és pillanatképet mentünk róla ---
  let snapshot: BillingInfo | null = null;
  if (!isFree) {
    const { data: billing, error: billErr } = await admin
      .from("profiles").select(BILLING_COLS).eq("id", user.id).maybeSingle();
    if (billErr) {
      return NextResponse.json(
        { error: "A számlázási adatok nem olvashatók. Futtasd le a credit-billing.sql migrációt." },
        { status: 500 }
      );
    }
    const check = validateBilling((billing ?? {}) as Partial<BillingInfo>);
    if (!check.ok) {
      // A böngésző ebből tudja, hogy a számlaadat-kaput kell nyitnia.
      return NextResponse.json({ error: check.error, needsBilling: true }, { status: 428 });
    }
    // Pillanatkép: ha a partner később átírja az adatait, a már kiállított
    // számlához tartozó adat NE változzon meg visszamenőleg.
    snapshot = check.value;
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
      package_id: packageId,
      net_huf: netHuf,
      billing_kind: isFree ? "free" : "invoice",
      invoice_status: isFree ? "none" : "to_issue",
      billing_snapshot: snapshot,
    })
    .select("id, amount, reason, status, created_at, net_huf, billing_kind, invoice_status")
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
      role,
      netHuf: netHuf ?? undefined,
      billing: snapshot ?? undefined,
    });
  } catch (e) {
    emailed = false;
    console.error("[credit-requests] Az értesítő e-mail nem ment ki:", (e as Error).message);
  }

  return NextResponse.json({ ok: true, item: created, emailed });
}
