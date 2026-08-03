// POST /api/real-estate/valuation/save — a partner által szerkesztett értékbecslés mentése.
// A böngészőben készült PDF-et tölti fel és cseréli a korábbira, a szöveget pedig
// eltárolja, hogy a becslés később újranyitható és tovább szerkeszthető legyen.
//
// BIZTONSÁG: a felhasználónak NINCS UPDATE joga a usage_history-ra (az RLS sorokat
// szűr, nem oszlopokat). Ezért a mentést a szerver végzi, és minden hívásnál
// ellenőrzi, hogy a sor a hívóé és tényleg értékbecslés-e. Kreditet nem érint.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const BUCKET = "reports";
const FEATURE = "valuation";
// A Vercel API-kérés törzse 4,5 MB — a base64 ~1,37× nagyobb a nyers bájtoknál,
// ezért a nyers PDF-re 3 MB a valós felső határ.
const MAX_PDF_BYTES = 3 * 1024 * 1024;
const MAX_TEXT_CHARS = 120_000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { id?: string; text?: string; pdfBase64?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  const text = String(body.text ?? "");
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });
  if (text.length > MAX_TEXT_CHARS)
    return NextResponse.json({ error: "A riport túl hosszú." }, { status: 413 });

  const admin = createAdminClient();

  // Tulajdonos- és típusellenőrzés — csak a saját értékbecslése menthető.
  const { data: row, error: rowError } = await admin
    .from("usage_history")
    .select("id, user_id, feature_used, output_file_url")
    .eq("id", id)
    .maybeSingle();
  if (rowError) return NextResponse.json({ error: "Adatbázis hiba." }, { status: 500 });
  if (!row || row.user_id !== user.id)
    return NextResponse.json({ error: "Nem található ez az értékbecslés." }, { status: 404 });
  if (row.feature_used !== FEATURE)
    return NextResponse.json({ error: "Ez a bejegyzés nem értékbecslés." }, { status: 400 });

  let publicUrl: string | null = row.output_file_url ?? null;

  if (body.pdfBase64 !== undefined) {
    // A Buffer.from() base64-nél SOHA nem dob (a hibás karaktereket eldobja),
    // ezért típusra, méretre és PDF-fejlécre külön ellenőrzünk.
    if (typeof body.pdfBase64 !== "string")
      return NextResponse.json({ error: "A PDF formátuma érvénytelen." }, { status: 400 });
    if (body.pdfBase64.length > MAX_PDF_BYTES * 1.4)
      return NextResponse.json({ error: "A PDF túl nagy." }, { status: 413 });

    const bytes = Buffer.from(body.pdfBase64, "base64");
    if (!bytes.length) return NextResponse.json({ error: "Üres PDF." }, { status: 400 });
    if (bytes.length > MAX_PDF_BYTES)
      return NextResponse.json({ error: "A PDF túl nagy." }, { status: 413 });
    if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-")
      return NextResponse.json({ error: "A feltöltött fájl nem PDF." }, { status: 400 });

    const filePath = `${FEATURE}/${user.id}/${randomUUID()}.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(filePath, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr)
      return NextResponse.json({ error: `Feltöltési hiba: ${upErr.message}` }, { status: 500 });

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(filePath);
    const previous = publicUrl;
    publicUrl = pub.publicUrl;

    // A korábbi PDF törlése — csak ha biztosan a saját mappájából való.
    if (previous) {
      const marker = `/${BUCKET}/`;
      const idx = previous.indexOf(marker);
      const path = idx >= 0 ? previous.slice(idx + marker.length) : "";
      if (path.startsWith(`${FEATURE}/${user.id}/`)) {
        await admin.storage.from(BUCKET).remove([path]);
      }
    }
  }

  const { error: updErr } = await admin
    .from("usage_history")
    .update({
      output_text: text,
      output_file_url: publicUrl,
      edited_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id); // dupla biztosíték

  if (updErr) return NextResponse.json({ error: `Mentési hiba: ${updErr.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, url: publicUrl });
}
