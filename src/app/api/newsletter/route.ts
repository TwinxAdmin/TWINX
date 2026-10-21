// POST /api/newsletter — a bejelentkezett felhasználó hírlevél-beállítása.
//   { action: "set", value: boolean, source?: "settings" | "portal" } → profiles.newsletter + időpont, majd Brevo-szinkron
//   { action: "dismiss" }                                            → a Portálközpont hírlevél-sávjának bezárása
// A Brevo-szinkron a válasz UTÁN fut (after), a felhasználónak nem kell rá várnia; hibánál a napi feladat újrapróbálja.
import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dismissNewsletterBanner, setNewsletter } from "@/lib/newsletter";
import { syncUserToBrevo } from "@/lib/brevo";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Jelentkezz be újra." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { action?: unknown; value?: unknown; source?: unknown } | null;
  if (body?.action === "dismiss") {
    const r = await dismissNewsletterBanner(user.id);
    return r.error ? NextResponse.json({ error: r.error }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (body?.action !== "set" || typeof body.value !== "boolean") {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }
  const source = body.source === "portal" ? "portal" : "settings";
  const r = await setNewsletter(user.id, body.value, source);
  if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
  const uid = user.id;
  after(() => syncUserToBrevo(uid));
  return NextResponse.json({ ok: true, newsletter: body.value });
}
