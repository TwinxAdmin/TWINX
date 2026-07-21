// /api/professionals/status?id=... — a PRO (mélykutatás) keresés állapotának lekérdezése.
// A kliens ezt pollozza, míg a Deep Research el nem készül. Amikor kész: feldolgozás
// (parse), TWINX PDF, mentés a professional_searches sorba (status='completed'). Hibánál
// a kredit visszajár. Ingyenes lekérdezés.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSonarAsync } from "@/lib/perplexity";
import { generateProfessionalsPdf } from "@/lib/pdf";
import { parseProfessionalResponse, type ProfessionalQuery } from "@/lib/professionals";

export const runtime = "nodejs";
export const maxDuration = 60;
const FEATURE = "professional_search";
const BUCKET = "reports";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("professional_searches")
    .select("id, user_id, industry, query, results, extras, pdf_url, credits_charged, status, pplx_request_id, created_at")
    .eq("id", id)
    .single();
  if (error || !row) return NextResponse.json({ error: "Nincs ilyen keresés." }, { status: 404 });
  if (row.user_id !== user.id) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });

  const publicRow = {
    id: row.id, industry: row.industry, query: row.query, results: row.results,
    extras: row.extras, pdf_url: row.pdf_url, credits_charged: row.credits_charged, created_at: row.created_at,
  };

  if (row.status === "completed") {
    return NextResponse.json({
      status: "completed", search: publicRow,
      result: { professionals: row.results ?? [], extras: row.extras ?? {} }, pdf_url: row.pdf_url,
    });
  }
  if (row.status === "failed") {
    return NextResponse.json({ status: "failed", error: "A keresés nem sikerült — a kredit visszajárt." });
  }

  // status === 'processing' → Perplexity állapot lekérdezése.
  const refund = async () => {
    const amt = Number(row.credits_charged) || 0;
    if (amt > 0) await admin.rpc("wallet_add", { p_user_id: row.user_id, p_amount: amt });
  };

  let r;
  try {
    r = await getSonarAsync(String(row.pplx_request_id ?? ""));
  } catch {
    return NextResponse.json({ status: "processing" }); // átmeneti hiba — próbáljuk később
  }

  if (r.status === "processing") return NextResponse.json({ status: "processing" });

  if (r.status === "failed") {
    await refund();
    await admin.from("professional_searches").update({ status: "failed" }).eq("id", row.id);
    return NextResponse.json({ status: "failed", error: "A kutatás sikertelen — a kredit visszajárt." });
  }

  // completed
  const query = (row.query ?? {}) as ProfessionalQuery;
  const count = Math.max(3, Number(query.count) || 3);
  const result = parseProfessionalResponse(r.content, count);

  if (!result.professionals.length) {
    await refund();
    await admin.from("professional_searches").update({ status: "failed" }).eq("id", row.id);
    return NextResponse.json({ status: "failed", error: "Nem találtunk igazolható szakembert — a kredit visszajárt." });
  }

  let pdfUrl: string | null = null;
  try {
    const bytes = await generateProfessionalsPdf({ query, result });
    const path = `professionals/${row.user_id}/${randomUUID()}.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (!upErr) pdfUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    pdfUrl = null;
  }

  const { data: saved } = await admin
    .from("professional_searches")
    .update({
      results: result.professionals,
      extras: result.extras,
      raw: r.content,
      pdf_url: pdfUrl,
      status: "completed",
    })
    .eq("id", row.id)
    .select("id, industry, query, results, extras, pdf_url, credits_charged, created_at")
    .single();

  await admin.from("usage_history").insert({
    user_id: row.user_id,
    service_id: null,
    feature_used: FEATURE,
    input_data: { industry: row.industry, profession: query.profession, county: query.county, count, deep: true },
    output_file_url: pdfUrl,
    credits_charged: Number(row.credits_charged) || 0,
  });

  return NextResponse.json({ status: "completed", search: saved, result, pdf_url: pdfUrl });
}
