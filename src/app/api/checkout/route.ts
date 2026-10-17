// POST /api/checkout — Stripe Checkout Session létrehozása egy kredit csomaghoz.
// A tényleges kredit jóváírás NEM itt történik, hanem a webhookban (3.3),
// sikeres fizetés visszaigazolása után.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getPackage, CHECKOUT_ENABLED } from "@/lib/packages";
import { BILLING_COLUMNS, isBillingComplete, type BillingInfo } from "@/lib/billing";

export async function POST(request: Request) {
  // Amíg a bankkártyás vásárlás nincs élesítve, a végpont is zárva van — nem elég
  // a gombot kikapcsolni a felületen (közvetlen hívással megkerülhető lenne).
  if (!CHECKOUT_ENABLED) {
    return NextResponse.json(
      { error: "A bankkártyás vásárlás még nem elérhető. Addig a Kredit igénylés használható." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const packageId = (body as Record<string, string>)?.packageId;
  const pkg = getPackage(packageId);
  if (!pkg) {
    return NextResponse.json({ error: "Ismeretlen csomag." }, { status: 400 });
  }

  // Elállási jog (ÁSZF 6.): az azonnali jóváíráshoz a fogyasztó kifejezett kérése + tudomásulvétele kell
  // (a felhasznált kreditekre az elállás megszűnik, a fel nem használtakra 14 napig megmarad).
  if ((body as { immediateConsent?: unknown })?.immediateConsent !== true) {
    return NextResponse.json({ error: "A fizetéshez fogadd el az azonnali jóváírást (jelölőnégyzet)." }, { status: 422 });
  }

  // A számlához kötelező a teljes számlázási adat (a számlát a sikeres fizetés után a Számlázz.hu állítja ki).
  const { data: billingRow } = await supabase.from("profiles").select(BILLING_COLUMNS).eq("id", user.id).maybeSingle();
  const billing = (billingRow as BillingInfo | null) ?? null;
  if (!isBillingComplete(billing)) {
    return NextResponse.json({ error: "A fizetés előtt töltsd ki a számlázási adataidat.", needsBilling: true }, { status: 428 });
  }

  // A modul (service) azonosítója a slug alapján.
  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id")
    .eq("slug", pkg.serviceSlug)
    .single();

  if (serviceError || !service) {
    return NextResponse.json({ error: "A modul nem található." }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  // HUF: a Stripe a legkisebb egységet várja, és 100 többszörösének kell lennie.
  // Egy nem egész forintos ár (pl. kedvezmény után) különben a Stripe-nál hasalna el.
  const amount = Math.round(pkg.priceHuf) * 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error("[checkout] Érvénytelen csomagár:", pkg.id, pkg.priceHuf);
    return NextResponse.json({ error: "A csomag ára hibás." }, { status: 500 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: pkg.currency,
            unit_amount: amount,
            product_data: { name: pkg.name },
          },
        },
      ],
      success_url: `${origin}/dashboard?purchase=success&credits=${pkg.credits}`,
      cancel_url: `${origin}/pricing?purchase=cancel`,
      client_reference_id: user.id,
      // A számlázáshoz és a partner azonosításához.
      customer_email: billing?.billing_email || user.email || undefined,
      metadata: {
        user_id: user.id,
        service_id: service.id,
        credits: String(pkg.credits),
        package_id: pkg.id,
        immediate_consent_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Enélkül a partner egy néma 500-at kapna, és nem tudnánk, mi történt.
    console.error("[checkout] Stripe session hiba:", (err as Error).message);
    return NextResponse.json({ error: "A fizetés indítása nem sikerült." }, { status: 502 });
  }
}
