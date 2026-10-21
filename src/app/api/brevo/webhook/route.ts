// POST /api/brevo/webhook?token=… — a Brevo értesít, ha valaki a hírlevél alján LEIRATKOZOTT (esemény: „unsubscribed").
// Ilyenkor a TWINX-ben is „nem" lesz a hírlevél (forrás: brevo), és lekerül a „Hírlevél" listáról — így a Fiók beállítások
// és a Portálközpont sávja sem mutat téves állapotot. Védelem: BREVO_WEBHOOK_SECRET (a webhook URL-jében, ?token=…).
// Saját Next.js route — a Brevo hívja, nincs külső automatizáció.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setNewsletter } from "@/lib/newsletter";
import { syncUserToBrevo } from "@/lib/brevo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Felhasználó keresése e-mail alapján (az auth-ban; legfeljebb 5000 fiókig). */
async function userIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const want = email.trim().toLowerCase();
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === want);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

export async function POST(req: Request) {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  if (!secret || new URL(req.url).searchParams.get("token") !== secret) {
    return NextResponse.json({ error: "Nincs jogosultság." }, { status: 401 });
  }
  const raw = (await req.json().catch(() => null)) as unknown;
  const events = (Array.isArray(raw) ? raw : [raw]) as { event?: string; email?: string }[];
  let handled = 0;
  for (const ev of events) {
    if (ev?.event !== "unsubscribed" || typeof ev.email !== "string") continue;
    const uid = await userIdByEmail(ev.email);
    if (!uid) continue;
    const r = await setNewsletter(uid, false, "brevo");
    if (!r.error) { await syncUserToBrevo(uid); handled++; }
  }
  // A Brevo csak a 2xx választ tekinti sikeresnek — ismeretlen eseményre is 200.
  return NextResponse.json({ ok: true, handled });
}
