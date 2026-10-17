// POST /api/checkout — Stripe Checkout Session létrehozása egy kredit csomaghoz.
// A tényleges kredit jóváírás NEM itt történik, hanem a webhookban (3.3),
// sikeres fizetés visszaigazolása után.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getPackage, CHECKOUT_ENABLED } from "@/lib/packages";
import { BILLING_COLUMNS, isBillingComplete, type BillingInfo } from "@/lib/billing";
import { getMembership, officeKind } from "@/lib/office-server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Irodai egyenleg feltöltése kártyával: ugyanaz a szabály, mint a számlás irodai megrendelésnél —
  // CSAK az irodai fiók létrehozója, és csak valódi irodánál (a közös munkatérnek nincs közös egyenlege).
  let officeId: string | null = null;
  if ((body as { target?: unknown })?.target === "office") {
    const m = await getMembership(user.id);
    if (!m || m.role !== "owner") {
      return NextResponse.json({ error: "Irodai egyenleget csak az irodai fiók létrehozója tölthet fel." }, { status: 403 });
    }
    if ((await officeKind(m.office_id)) === "team") {
      return NextResponse.json({ error: "Közös munkatérnek nincs közös egyenlege — mindenki a saját kreditjét tölti fel." }, { status: 403 });
    }
    // A jóváíráshoz kell a 20261017160355_office-card-topup.sql (office_id oszlop) — nélküle NEM indítunk fizetést,
    // különben a kredit rossz helyre (a saját egyenlegre) kerülne.
    const { error: colErr } = await createAdminClient().from("credit_purchases").select("office_id").limit(1);
    if (colErr) {
      console.error("[checkout] Hiányzik a 20261017160355_office-card-topup.sql:", colErr.message);
      return NextResponse.json({ error: "Az irodai kártyás feltöltés még nem elérhető (adatbázis-frissítés szükséges: 20261017160355_office-card-topup.sql)." }, { status: 503 });
    }
    officeId = m.office_id as string;
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
      success_url: officeId
        ? `${origin}/dashboard/iroda?purchase=success&credits=${pkg.credits}&target=office`
        : `${origin}/dashboard?purchase=success&credits=${pkg.credits}`,
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
        ...(officeId ? { office_id: officeId } : {}),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Enélkül a partner egy néma 500-at kapna, és nem tudnánk, mi történt.
    console.error("[checkout] Stripe session hiba:", (err as Error).message);
    return NextResponse.json({ error: "A fizetés indítása nem sikerült." }, { status: 502 });
  }
}
