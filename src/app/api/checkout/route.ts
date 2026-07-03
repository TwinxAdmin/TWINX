// POST /api/checkout — Stripe Checkout Session létrehozása egy kredit csomaghoz.
// A tényleges kredit jóváírás NEM itt történik, hanem a webhookban (3.3),
// sikeres fizetés visszaigazolása után.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { getPackage } from "@/lib/packages";

export async function POST(request: Request) {
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: pkg.currency,
          // HUF: a legkisebb egységben, 100 többszöröse (4990 Ft -> 499000).
          unit_amount: pkg.priceHuf * 100,
          product_data: { name: pkg.name },
        },
      },
    ],
    success_url: `${origin}/dashboard?purchase=success`,
    cancel_url: `${origin}/pricing?purchase=cancel`,
    client_reference_id: user.id,
    metadata: {
      user_id: user.id,
      service_id: service.id,
      credits: String(pkg.credits),
      package_id: pkg.id,
    },
  });

  return NextResponse.json({ url: session.url });
}
