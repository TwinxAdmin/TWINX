// POST /api/real-estate/ad-check/pdf — a hirdetés-elemzés PDF-jét az ELFOGADOTT
// (esetleg átszerkesztett) javított hirdetésszöveggel készíti el, és elmenti.
// Bemenet: { id, rewritten }. A javított szöveget frissíti a rekordban is.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAdCheckPdf } from "@/lib/pdf";
import type { AdCheckResult } from "@/lib/adcheck";

export const runtime = "nodejs";
export const maxDuration = 60;
const BUCKET = "reports";
const MAX_TEXT = 20000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { id?: string; rewritten?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const id = String(body.id ?? "").trim();
  const rewritten = String(body.rewritten ?? "").trim().slice(0, MAX_TEXT);
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 422 });
  if (rewritten.length < 20) return NextResponse.json({ error: "A javított szöveg túl rövid." }, { status: 422 });

  const admin = createAdminClient();

  // A rekord betöltése (csak a sajátját szerkesztheti).
  const { data: row } = await admin
    .from("ad_checks")
    .select("id, user_id, source_url, result")
    .eq("id", id)
    .single();
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "Az elemzés nem található." }, { status: 404 });
  }

  const result = { ...(row.result as AdCheckResult), rewritten } as AdCheckResult;

  // PDF a Storage-ba.
  let pdfUrl: string | null = null;
  try {
    const bytes = await generateAdCheckPdf({ result, sourceUrl: (row.source_url as string) || null });
    const path = `ad-check/${user.id}/${randomUUID()}.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(upErr.message);
    pdfUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (e) {
    return NextResponse.json({ error: "A PDF elkészítése nem sikerült: " + (e as Error).message }, { status: 500 });
  }

  // A javított szöveget és a PDF-et elmentjük a rekordba.
  await admin.from("ad_checks").update({ result, pdf_url: pdfUrl }).eq("id", id);

  return NextResponse.json({ ok: true, pdf_url: pdfUrl });
}
