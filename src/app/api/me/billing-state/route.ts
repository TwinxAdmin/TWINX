// GET /api/me/billing-state — amit a kredit-igénylő ablaknak tudnia kell:
// bejelentkezett-e, milyen szerepkörű, van-e kitöltött számlázási adata, és
// van-e már elbírálásra váró kérése.
//
// Azért külön végpont, mert a csomag-modál a landingen is nyílik (ott nincs
// szerver-oldali betöltött adat), és nem akarunk minden oldalra átadni ilyet.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isBillingComplete, type BillingInfo } from "@/lib/billing";
import { resolveViewContext } from "@/lib/view-as";

export const runtime = "nodejs";

const BILLING_COLS =
  "billing_type, billing_name, billing_tax_number, billing_country, billing_zip, billing_city, billing_address, billing_email";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ signedIn: false });
  }

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  // Az admin „így látja a partner" előnézetét itt is követnünk kell, különben a
  // csomag-ablak a valódi (admin) szerepkör szerint viselkedne, és pl. sales
  // nézetben árakat mutatna. Jogot ez nem ad: a beküldést a `preview` blokkolja,
  // és a szerveroldali ellenőrzések továbbra is a valódi szerepkört nézik.
  const view = await resolveViewContext(me?.role as string | undefined);
  const role = view.role;

  // Külön lekérdezés: ha a credit-billing.sql még nem futott le, ez hibázik,
  // de a válasz többi része attól még használható.
  const { data: billingRow } = await supabase
    .from("profiles").select(BILLING_COLS).eq("id", user.id).maybeSingle();
  const billing = (billingRow as BillingInfo | null) ?? null;

  // Egyszerre egy függő kérés lehet — ha van, azt mutatjuk új űrlap helyett.
  const { data: pending } = await supabase
    .from("credit_requests")
    .select("id, amount, net_huf, invoice_status, billing_kind, created_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  return NextResponse.json({
    signedIn: true,
    role,
    preview: view.previewing,
    // sales = belső keret, neki nincs számlázás
    needsBilling: role === "user",
    billing,
    billingComplete: role !== "user" || isBillingComplete(billing),
    pending: pending ?? null,
  });
}
