// POST /api/real-estate/valuation — Ingatlan Értékbecslő teljes lánc.
// Sorrend: validáció -> kredit levonás (admin/sales megkerül) -> Perplexity (Sonar)
// -> PDF -> Supabase Storage -> usage_history. Hiba esetén kredit-visszatérítés.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateValuationInput, type ValuationInput } from "@/lib/valuation";
import { chargeCredit } from "@/lib/credits";
import { runValuation, PERPLEXITY_MODEL } from "@/lib/perplexity";
import { generateReportPdf } from "@/lib/report-pdf";
import { logCost, perplexityCostUsd } from "@/lib/costs";

export const runtime = "nodejs";

const SERVICE_SLUG = "real-estate";
const FEATURE = "valuation";
const BUCKET = "reports";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { valid, errors } = validateValuationInput(body as Record<string, unknown>);
  if (!valid) {
    return NextResponse.json({ errors }, { status: 422 });
  }
  const input = body as ValuationInput;

  const admin = createAdminClient();

  const { data: service } = await admin
    .from("services")
    .select("id")
    .eq("slug", SERVICE_SLUG)
    .single();
  if (!service) {
    return NextResponse.json({ error: "A modul nem található." }, { status: 400 });
  }

  // 1) Kredit levonás (admin/sales megkerüli). Sikertelen generálásnál visszatérítjük.
  const charge = await chargeCredit({
    userId: user.id,
    amount: 1,
  });
  if (!charge.ok) {
    return NextResponse.json(
      { error: "Nincs elég kredit ehhez a modulhoz." },
      { status: 402 }
    );
  }

  try {
    // 2) Perplexity (Sonar) hívás a validált adatokból.
    const report = await runValuation(input);

    // 3) PDF generálás.
    const pdfBytes = await generateReportPdf({
      title: "Ingatlan értékbecslés",
      meta: [
        `Elhelyezkedés: ${input.telepules}${input.utca ? " · " + input.utca : ""}`,
        `Típus: ${input.tipus} · ${input.meret} · ${input.szobak}`,
        `Állapot: ${input.allapot} · Építés: ${input.epitesEve}`,
        `Készült: ${new Date().toLocaleString("hu-HU")}`,
      ],
      body: report,
    });

    // 4) Feltöltés a Supabase Storage-ba.
    const filePath = `valuation/${user.id}/${randomUUID()}.pdf`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(filePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (uploadError) throw new Error(`Storage feltöltés hiba: ${uploadError.message}`);

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(filePath);

    // 5) Mentés a usage_history táblába.
    const { error: histError } = await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: service.id,
      feature_used: FEATURE,
      input_data: input,
      output_file_url: pub.publicUrl,
    });
    if (histError) throw new Error(`Előzmény mentés hiba: ${histError.message}`);

    // Nyers API-önköltség logolása (admin-only, best-effort).
    await logCost({
      userId: user.id,
      serviceId: service.id,
      feature: FEATURE,
      serviceName: "perplexity",
      units: 1,
      estimatedCostUsd: perplexityCostUsd(PERPLEXITY_MODEL),
    });

    return NextResponse.json({
      ok: true,
      url: pub.publicUrl,
      report,
      charged: !charge.bypassed,
    });
  } catch (err) {
    if (!charge.bypassed) {
      await admin.rpc("wallet_add", {
        p_user_id: user.id,
        p_amount: 1,
      });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
