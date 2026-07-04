// POST /api/ideas — publikus ötlet beküldés.
// Mindig 'pending' státusszal ment (a service_role beszúrás megkerüli az RLS-t),
// majd email értesítő az adminnak. Csak admin-jóváhagyás után lesz nyilvános.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateIdeaInput, type IdeaInput } from "@/lib/ideas";
import { sendIdeaNotification } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { valid, errors } = validateIdeaInput(body as Record<string, unknown>);
  if (!valid) {
    return NextResponse.json({ errors }, { status: 422 });
  }
  const input = body as IdeaInput;

  const admin = createAdminClient();
  const { error } = await admin.from("ideas").insert({
    author_name: input.authorName?.trim() || null,
    author_email: input.authorEmail?.trim() || null,
    content: input.content.trim(),
    status: "pending",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Email értesítő (best-effort — ha hibázik, az ötlet akkor is mentve van).
  try {
    await sendIdeaNotification(input);
  } catch (err) {
    console.error("Ötlet e-mail hiba:", (err as Error).message);
  }

  return NextResponse.json({ ok: true });
}
