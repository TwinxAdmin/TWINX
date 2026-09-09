// GET /api/real-estate/valuation/status?job=<id> — az értékbecslés állapota.
//
// A tényleges (hosszú) Perplexity-lánc a beküldő végpont `after()` blokkjában fut
// a HÁTTÉRBEN, és maga írja a job sorát. Ez a végpont ezért CSAK olvas — gyors,
// és a kliens ezt pollingozza. Így a partner semmire nem vár HTTP-ben, tehát
// SOHA nincs időkorlát-élmény, és el is navigálhat: a kész riport az előzményekbe kerül.
//
// KREDIT: a levonás a háttérláncban, KIZÁRÓLAG kész riport esetén történik.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Ha egy job ennyi ideje „processing" és nem mozdul, elakadtnak tekintjük
// (pl. a háttérfüggvényt a platform leállította). Kreditet ilyenkor sem vontunk le.
const STUCK_MINUTES = 10;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const jobId = new URL(request.url).searchParams.get("job");
  if (!jobId) return NextResponse.json({ error: "Hiányzó job azonosító." }, { status: 400 });

  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("valuation_jobs")
    .select("id, user_id, status, report, error, created_at, history_id, input_data, audit")
    .eq("id", jobId)
    .single();
  if (error || !job) return NextResponse.json({ error: "A job nem található." }, { status: 404 });
  if (job.user_id !== user.id) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });

  if (job.status === "done") {
    // Az `id` az ELŐZMÉNY-sor azonosítója (ezzel menthető/szerkeszthető a riport),
    // nem a jobé — a szerkesztő mentése különben „Nem található" hibát adna.
    const inp = (job.input_data as { input?: unknown } | null)?.input ?? null;
    return NextResponse.json({ status: "done", report: job.report ?? "", id: job.history_id ?? null, input: inp, audit: job.audit ?? null });
  }
  if (job.status === "failed") {
    return NextResponse.json({
      status: "failed",
      error: job.error ?? "A becslés nem sikerült. Kredit nem került levonásra.",
    });
  }

  // Elakadás-védelem: ne pörögjön a polling a végtelenségig.
  const ageMin = (Date.now() - new Date(job.created_at as string).getTime()) / 60000;
  if (ageMin > STUCK_MINUTES) {
    await admin.from("valuation_jobs")
      .update({ status: "failed", error: "A becslés nem fejeződött be időben. Kredit nem került levonásra — próbáld újra." })
      .eq("id", job.id);
    return NextResponse.json({
      status: "failed",
      error: "A becslés nem fejeződött be időben. Kredit nem került levonásra — próbáld újra.",
    });
  }

  return NextResponse.json({ status: "processing" });
}
