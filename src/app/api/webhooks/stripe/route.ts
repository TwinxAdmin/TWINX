// POST /api/webhooks/stripe — Stripe webhook.
// Sikeres fizetésnél (checkout.session.completed / async_payment_succeeded)
// +N kredit jóváírás. Az aláírás ellenőrzéséhez a NYERS kérés-törzs kell.
//
// PÉNZÜGYI BIZTONSÁG:
// - A vásárlás sora `credited_at` NÉLKÜL jön létre; a jóváírást a
//   `credit_purchase_apply` adatbázis-függvény végzi EGYETLEN tranzakcióban.
//   Így nincs olyan pillanat, amikor a sor jóváírtnak látszik, de a kredit nem
//   ment át — és két párhuzamos webhook sem adhat kétszer kreditet.
// - Hibánál 500-at adunk: a Stripe újraküldi az eseményt (3 napig), és a
//   függvény befejezi a félbemaradt jóváírást.
// SZÁMLA (2026-10-17): a kredit jóváírása UTÁN a Számlázz.hu Számla Agent kiállítja a számlát (lib/purchase-invoice.ts).
// A számla hibája NEM veszi el a kreditet; egyértelmű hibánál 500-zal kérjük az újraküldést (a számla újrapróbálásához).
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { BILLING_COLUMNS, type BillingInfo } from "@/lib/billing";
import { issueInvoiceForPurchase } from "@/lib/purchase-invoice";

export const runtime = "nodejs";
export const maxDuration = 60; // a számla kiállítása (Számla Agent) is ebben a kérésben fut

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Hiányzó Stripe aláírás." }, { status: 400 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-webhook] Hiányzó STRIPE_WEBHOOK_SECRET.");
    return NextResponse.json({ error: "Hiányzó webhook titok." }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return NextResponse.json({ error: `Aláírás hiba: ${(err as Error).message}` }, { status: 400 });
  }

  // A halasztott fizetéseknél (pl. utalás) a pénz később érkezik meg — azt az
  // async_payment_succeeded jelzi. Enélkül „fizetett, de nincs kredit" lenne.
  const paidEvents = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  if (!paidEvents.includes(event.type)) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Csak ténylegesen kifizetett rendelést írunk jóvá.
  if (session.payment_status !== "paid") {
    console.warn("[stripe-webhook] Még nem fizetett session:", session.id, session.payment_status);
    return NextResponse.json({ received: true, skipped: "unpaid" });
  }

  const md = session.metadata ?? {};
  const userId = md.user_id;
  const serviceId = md.service_id;
  const credits = Number(md.credits ?? 0);

  if (!userId || !serviceId || !(credits > 0)) {
    // Fizetés történt, de nem tudjuk kihez kötni — ennek LÁTSZANIA kell a Stripe
    // felületén is (sikertelen webhook), hogy kézzel pótolható legyen.
    console.error("[stripe-webhook] FIZETÉS HIÁNYOS ADATTAL:", session.id, JSON.stringify(md));
    return NextResponse.json({ error: "Hiányzó metadata a fizetéshez." }, { status: 500 });
  }

  const admin = createAdminClient();

  // A számlához: a számlázási adat pillanatképe (a fizetés indításakor kötelezően kitöltött profiladat).
  const { data: billingRow } = await admin.from("profiles").select(BILLING_COLUMNS).eq("id", userId).maybeSingle();
  const billingSnapshot = (billingRow as BillingInfo | null) ?? null;

  // 1) Vásárlás rögzítése. A session id egyedi → ez adja az idempotenciát.
  const baseRow = {
    stripe_session_id: session.id,
    user_id: userId,
    service_id: serviceId,
    credits,
    // A ténylegesen fizetett összeg (HUF) — a bevétel/profit metrikához és a számlához.
    amount_huf: Math.round((session.amount_total ?? 0) / 100),
    livemode: event.livemode,
    credited_at: null, // a jóváírás a következő lépésben, egy tranzakcióban
  };
  // Irodai egyenleg feltöltése (a fizetés indításakor ellenőrizve: az iroda létrehozója fizetett).
  const officeId = md.office_id || null;
  let { error: insertError } = await admin.from("credit_purchases").insert({
    ...baseRow,
    billing_snapshot: billingSnapshot,
    immediate_consent_at: md.immediate_consent_at ?? null,
    ...(officeId ? { office_id: officeId } : {}),
  });
  // Irodai vásárlásnál NINCS tartalékág: oszlop nélkül a kredit a saját egyenlegre menne (rossz helyre) —
  // inkább hibát adunk, és a Stripe újraküldi, amint a 20261017160355_office-card-topup.sql lefutott.
  if (officeId && (insertError?.code === "42703" || insertError?.code === "PGRST204")) {
    console.error("[stripe-webhook] IRODAI FIZETÉS — hiányzik a 20261017160355_office-card-topup.sql:", session.id);
    return NextResponse.json({ error: "Hiányzó office_id oszlop." }, { status: 500 });
  }
  // Tartalékág: ha a 20261017115051_card-invoicing.sql még nem futott le (nincs ilyen oszlop), a kredit akkor is menjen át.
  if (insertError?.code === "42703" || insertError?.code === "PGRST204") {
    console.error("[stripe-webhook] Hiányzó számla-oszlopok — futtasd: 20261017115051_card-invoicing.sql");
    ({ error: insertError } = await admin.from("credit_purchases").insert(baseRow));
  }

  // 23505 = unique violation → az eseményt már láttuk. NEM lépünk ki: lehet,
  // hogy a jóváírás korábban félbemaradt, és most kell befejezni.
  if (insertError && insertError.code !== "23505") {
    console.error("[stripe-webhook] Vásárlás mentése sikertelen:", session.id, insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 2) Jóváírás egyetlen tranzakcióban (megjelölés + wallet együtt).
  const { data: credited, error: applyError } = await admin
    .rpc("credit_purchase_apply", { p_session_id: session.id });

  if (applyError) {
    console.error("[stripe-webhook] KREDIT JÓVÁÍRÁS SIKERTELEN (a fizetés megtörtént):",
      session.id, userId, credits, applyError.message);
    return NextResponse.json({ error: applyError.message }, { status: 500 });
  }

  // 3) Számla (Számlázz.hu). A kredit már jóvá van írva — a számla hibája ezt nem érinti.
  const invoice = await issueInvoiceForPurchase(session.id);
  if (invoice.kind === "failed" && invoice.retry) {
    return NextResponse.json({ received: true, credited: credited === true, invoice: "failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true, credited: credited === true, invoice: invoice.kind });
}
