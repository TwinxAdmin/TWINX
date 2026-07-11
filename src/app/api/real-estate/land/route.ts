// POST /api/real-estate/land — Telek értékbecslés indítása.
// Normál (sonar-pro): szinkron, azonnal PDF-fel tér vissza.
// Magas (sonar-deep-research): aszinkron beküldés -> land_jobs -> a kliens pollingoz
// a /api/real-estate/land/status végponton. Kredit: normál 1, magas 2 (visszatérítés hibánál).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import {
  buildLandPrompt,
  validateLandInput,
  isLandLevel,
  LAND_LEVELS,
  type LandInput,
} from "@/lib/land";
import { runSonar, submitSonarAsync } from "@/lib/perplexity";
import { finalizeLandReport } from "@/lib/land-report";

export const runtime = "nodejs";

const SERVICE_SLUG = "real-estate";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const level = body.level;
  if (!isLandLevel(level)) {
    return NextResponse.json({ error: "Érvénytelen kutatási szint." }, { status: 422 });
  }

  const { valid, errors } = validateLandInput(body);
  if (!valid) {
    return NextResponse.json({ errors }, { status: 422 });
  }
  const input: LandInput = {
    telepules: String(body.telepules).trim(),
    utca: String(body.utca).trim(),
    hrsz: String(body.hrsz).trim(),
    ovezet: String(body.ovezet).trim(),
    besorolas: String(body.besorolas).trim(),
  };

  const admin = createAdminClient();
  const { data: service } = await admin
    .from("services")
    .select("id")
    .eq("slug", SERVICE_SLUG)
    .single();
  if (!service) {
    return NextResponse.json({ error: "A modul nem található." }, { status: 400 });
  }

  const cfg = LAND_LEVELS[level];
  const credits = cfg.credits;

  // Kredit levonás (admin/sales megkerüli). Hibánál visszatérítjük.
  const charge = await chargeCredit({ userId: user.id, amount: credits });
  if (!charge.ok) {
    return NextResponse.json(
      { error: `Nincs elég egyenleg (${credits} szükséges).` },
      { status: 402 }
    );
  }

  const prompt = buildLandPrompt(input);

  // ---- NORMÁL: szinkron ----
  if (!cfg.async) {
    try {
      const report = await runSonar(prompt, cfg.model);
      const url = await finalizeLandReport({
        admin,
        userId: user.id,
        serviceId: service.id,
        input,
        level,
        report,
        creditsCharged: charge.bypassed ? 0 : credits,
      });
      return NextResponse.json({ ok: true, url, report, charged: !charge.bypassed });
    } catch (err) {
      if (!charge.bypassed) {
        await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: credits });
      }
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  // ---- MAGAS: aszinkron job ----
  try {
    const requestId = await submitSonarAsync(prompt, cfg.model);
    const { data: job, error: jobError } = await admin
      .from("land_jobs")
      .insert({
        user_id: user.id,
        service_id: service.id,
        status: "processing",
        level,
        input_data: input,
        request_id: requestId,
        credits_charged: charge.bypassed ? 0 : credits,
      })
      .select("id")
      .single();
    if (jobError || !job) throw new Error(jobError?.message ?? "Job létrehozás hiba.");

    return NextResponse.json({ ok: true, jobId: job.id, async: true });
  } catch (err) {
    if (!charge.bypassed) {
      await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: credits });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
