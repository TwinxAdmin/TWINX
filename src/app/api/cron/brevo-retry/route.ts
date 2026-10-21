// GET /api/cron/brevo-retry — NAPI ütemezett feladat (Vercel Cron, vercel.json): a sikertelen Brevo-szinkronok
// újrapróbálása (brevo_sync_queue). Saját Next.js route — nincs külső automatizáció.
// Védelem: a Vercel a CRON_SECRET-et „Authorization: Bearer …" fejlécben küldi; enélkül 401.
import { NextResponse } from "next/server";
import { brevoConfigured, retryBrevoQueue } from "@/lib/brevo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nincs jogosultság." }, { status: 401 });
  }
  if (!brevoConfigured()) return NextResponse.json({ skipped: "A Brevo nincs beállítva." });
  try {
    return NextResponse.json(await retryBrevoQueue());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
