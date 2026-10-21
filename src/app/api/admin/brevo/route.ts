// /api/admin/brevo — Brevo-szinkron kezelése (CSAK admin).
//   GET                              → állapot (beállítás, darabszámok, újrapróbálásra váró sor)
//   POST { action: "attributes" }    → a hiányzó Brevo-attribútumok létrehozása
//   POST { action: "sync", offset }  → a meglévő fiókok szinkronjának egy szelete (25 fiók; a felület lépteti)
//   POST { action: "retry" }         → a sikertelen szinkronok újrapróbálása
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStaffRole } from "@/lib/staff";
import { brevoConfigured, brevoStatus, ensureBrevoAttributes, retryBrevoQueue, syncBatch } from "@/lib/brevo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH = 25;

async function isAdmin() {
  const staff = await getStaffRole(await createClient());
  return !!staff && staff.role === "admin";
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  return NextResponse.json(await brevoStatus());
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  if (!brevoConfigured()) return NextResponse.json({ error: "A Brevo nincs beállítva (BREVO_API_KEY és BREVO_LIST_USERS kell)." }, { status: 400 });
  const body = (await req.json().catch(() => null)) as { action?: string; offset?: number } | null;
  try {
    if (body?.action === "attributes") {
      const errors = await ensureBrevoAttributes();
      return errors.length ? NextResponse.json({ error: errors.join(" · ") }, { status: 502 }) : NextResponse.json({ ok: true });
    }
    if (body?.action === "sync") {
      const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
      return NextResponse.json(await syncBatch(offset, BATCH));
    }
    if (body?.action === "retry") return NextResponse.json(await retryBrevoQueue());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });
}
