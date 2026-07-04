// POST /api/webhooks/stripe — Stripe webhook.
// Sikeres fizetésnél (checkout.session.completed) +N kredit jóváírás.
// FONTOS: az aláírás ellenőrzéséhez a NYERS kérés-törzs kell (request.text()).
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Hiányzó Stripe aláírás." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Aláírás hiba: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const md = session.metadata ?? {};
    const userId = md.user_id;
    const serviceId = md.service_id;
    const credits = Number(md.credits ?? 0);

    if (userId && serviceId && credits > 0) {
      const admin = createAdminClient();

      // Idempotencia: a session id egyedi. Dupla webhook esetén nem írunk jóvá újra.
      const { error: insertError } = await admin.from("credit_purchases").insert({
        stripe_session_id: session.id,
        user_id: userId,
        service_id: serviceId,
        credits,
        // A ténylegesen fizetett összeg (HUF) — a bevétel/profit metrikához.
        amount_huf: Math.round((session.amount_total ?? 0) / 100),
      });

      if (insertError) {
        // 23505 = unique violation -> már feldolgozott esemény.
        if (insertError.code === "23505") {
          return NextResponse.json({ received: true, duplicate: true });
        }
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      // Atomikus jóváírás a közös egyenlegre.
      const { error: creditError } = await admin.rpc("wallet_add", {
        p_user_id: userId,
        p_amount: credits,
      });

      if (creditError) {
        return NextResponse.json({ error: creditError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
