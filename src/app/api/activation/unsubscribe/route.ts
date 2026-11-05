// POST /api/activation/unsubscribe — leiratkozás egy kattintással, belépés nélkül. Idempotens.
// Két úton jön: a /leiratkozas oldalról (JSON, { token }) vagy a levelező saját „Leiratkozás” gombjából
// (RFC 8058, List-Unsubscribe-Post: a token ilyenkor a címben van, ?t=…).
import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/activation-token";
import { optOutEmail } from "@/lib/activation";
import { ACTIVATION_MIGRATION } from "@/lib/activation-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const fromQuery = new URL(request.url).searchParams.get("t");
  const body = fromQuery ? null : ((await request.json().catch(() => null)) as { token?: unknown } | null);
  const token = verifyUnsubscribeToken(fromQuery ?? (typeof body?.token === "string" ? body.token : null));
  if (!token) return NextResponse.json({ error: "Ez a link már nem érvényes." }, { status: 400 });

  const result = await optOutEmail(token.m, token.u, "activation");
  if (result.error) {
    console.error(`[activation-unsubscribe] ${result.error} (migráció: ${ACTIVATION_MIGRATION})`);
    return NextResponse.json({ error: "Most nem sikerült. Kérlek, próbáld újra később." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
