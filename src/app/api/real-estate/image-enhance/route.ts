// POST /api/real-estate/image-enhance — Egyszerű képjavító.
// Max 2 kép, 1 kredit / feldolgozás (all-or-nothing). A kép TARTALMÁN nem változtatunk,
// csak a minőségén (mód szerint enyhe rendrakással). Nano Banana image-to-image.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { generateImage } from "@/lib/nanobanana";
import { logCost, googleImageCostUsd, FAL_USD_PER_IMAGE } from "@/lib/costs";
import { buildEnhancePromptActive, buildEnhanceFalActive } from "@/lib/prompts";
import { enhanceImageFal } from "@/lib/fal";
import { gradePhoto, shouldUpscale } from "@/lib/photo-grade";
import {
  isEnhanceMode, validateImageFiles, enhanceModeLabel, EXTREME_DECLUTTER_SUFFIX, ENHANCE_MAX_IMAGES,
} from "@/lib/image-enhance";

export const runtime = "nodejs";
export const maxDuration = 60; // több kép egymás után

const SERVICE_SLUG = "real-estate";
const FEATURE = "image_enhance";
const BUCKET = "reports";

// Korábbi képjavító feldolgozások (dátum-mappákhoz).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("image_enhance_jobs")
    .select("id, mode, items, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const mode = String(form.get("mode") ?? "");
  if (!isEnhanceMode(mode)) {
    return NextResponse.json({ error: "Válassz feldolgozási módot." }, { status: 422 });
  }

  // defer=1 → az eredmény NEM kerül azonnal az előzményekbe; a partner előbb jóváhagyja.
  const defer = String(form.get("defer") ?? "") === "1";

  const files = form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0);
  const imagesError = validateImageFiles(files, ENHANCE_MAX_IMAGES);
  if (imagesError) {
    return NextResponse.json({ errors: { images: imagesError } }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: service } = await admin.from("services").select("id").eq("slug", SERVICE_SLUG).single();
  if (!service) return NextResponse.json({ error: "A modul nem található." }, { status: 400 });

  // 1 kredit az egész feldolgozásra (all-or-nothing), a közös egyenlegből.
  const charge = await chargeCredit({ userId: user.id, amount: 1 });
  if (!charge.ok) {
    return NextResponse.json({ error: "Nincs elég kredit ehhez a modulhoz." }, { status: 402 });
  }

  try {
    // Motor a mód szerint:
    //  - feljavitas: fal.ai (felbontás/minőség)
    //  - rendrakas:  Nano Banana (rendrakás)
    // Az "átjátszás" (a másik művelet az elkészült képen) kliensoldalról jön: az eredmény
    // képet új feltöltésként küldi vissza a másik móddal — így itt nincs külön lánc-logika.
    const useFal = mode === "feljavitas";
    const useNano = mode === "rendrakas";
    const falCfg = useFal ? await buildEnhanceFalActive() : null;
    // Extrém rendetlenség (a böngészőoldali zsúfoltság-heurisztika jelzi):
    // ilyenkor a rendrakás promptot megerősítjük az agresszívabb toldalékkal.
    const extreme = String(form.get("extreme") ?? "") === "1";
    const nanoPrompt = useNano
      ? (await buildEnhancePromptActive("rendrakas")) + (extreme ? EXTREME_DECLUTTER_SUFFIX : "")
      : "";

    // Feljavítás = felbontásnövelés: nagyobb upscale_factor, a szerkezet hű marad.
    const upscaleFactor = Number(process.env.FAL_ENHANCE_UPSCALE_HIGH || 4);
    // Hány képnél futott le ténylegesen a fal.ai hívás (a költségnaplóhoz):
    // egy eleve éles, nagy felbontású fotónál kihagyjuk, mert nem tesz hozzá.
    let falCalls = 0;

    // Párhuzamos feldolgozás — a képek ne fussanak a 60 mp-es limitbe egymás után.
    const items = await Promise.all(files.map(async (file) => {
      const inputBytes = new Uint8Array(await file.arrayBuffer());
      const mime = file.type || "image/jpeg";

      // Eredeti kép mentése (before/after + előzmény).
      const origPath = `image-enhance/${user.id}/orig-${randomUUID()}.jpg`;
      const { error: origErr } = await admin.storage
        .from(BUCKET).upload(origPath, inputBytes, { contentType: mime, upsert: false });
      if (origErr) throw new Error(`Storage feltöltés hiba: ${origErr.message}`);
      const original = admin.storage.from(BUCKET).getPublicUrl(origPath).data.publicUrl;

      // Munkakép — lépésről lépésre halad végig a láncon.
      let workBytes: Uint8Array = inputBytes;
      let workMime = mime;
      let gradeNotes: string[] = [];

      // 1) FOTÓ-KORREKCIÓ (saját, determinisztikus — nincs AI-költsége).
      //    Ez adja a látható változást: fehéregyensúly, árnyéknyitás, csúcsfény-
      //    lágyítás, helyi kontraszt. A helyiséget nem érinti, csak a fényt/színt.
      let needsFal = true;
      if (useFal) {
        try {
          const g = await gradePhoto(Buffer.from(workBytes));
          workBytes = new Uint8Array(g.buffer);
          workMime = "image/jpeg";
          gradeNotes = g.plan.notes;
          // A drága felskálázást CSAK akkor hívjuk, ha van mit javítania: kis
          // felbontás vagy lágy rajzolat. Egy éles, nagy telefonfotón alig tesz
          // hozzá — ott a korrekció önmagában is látványos, és marad a keret.
          needsFal = await shouldUpscale(Buffer.from(g.buffer));
        } catch {
          // A korrekció hibája ne buktassa el a feldolgozást — megy a régi úton.
          needsFal = true;
        }
      }

      // 2) Élesítés / felbontás (fal.ai) — csak ha a fenti vizsgálat indokolja.
      if (falCfg && needsFal) {
        falCalls++;
        const dataUri = `data:${workMime};base64,${Buffer.from(workBytes).toString("base64")}`;
        const r = await enhanceImageFal({ dataUri, prompt: falCfg.prompt, negativePrompt: falCfg.negative, upscaleFactor });
        workBytes = new Uint8Array(r.bytes);
        workMime = r.mimeType;
      }

      // 2) Rendrakás (Nano Banana) — a már feljavított képen takarítja el a rendetlenséget.
      let result: { bytes: Buffer; mimeType: string };
      if (useNano) {
        result = await generateImage({ source: { bytes: workBytes, mimeType: workMime }, prompt: nanoPrompt });
      } else {
        result = { bytes: Buffer.from(workBytes), mimeType: workMime };
      }

      const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
      const filePath = `image-enhance/${user.id}/${randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage
        .from(BUCKET).upload(filePath, result.bytes, { contentType: result.mimeType, upsert: false });
      if (upErr) throw new Error(`Storage feltöltés hiba: ${upErr.message}`);
      const enhanced = admin.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;

      // A korrekció lépései elmentve: az eredménynél megmutatható, MIT javítottunk
      // („Sárgás fény semlegesítve", „Sötét felvétel — árnyékok megnyitva" …).
      return { original, enhanced, notes: gradeNotes };
    }));

    // Job mentése (dátum-mappák + before/after) — halasztott módban csak jóváhagyás után.
    let job = null;
    if (!defer) {
      const { data } = await supabase
        .from("image_enhance_jobs")
        .insert({ user_id: user.id, mode, items })
        .select("id, mode, items, created_at")
        .single();
      job = data;
    }

    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: service.id,
      feature_used: FEATURE,
      input_data: { mode, mode_label: enhanceModeLabel(mode), image_count: files.length, outputs: items.map((i) => i.enhanced), pending_review: defer },
      output_file_url: items[0]?.enhanced ?? null,
      credits_charged: charge.bypassed ? 0 : 1,
    });

    await logCost({
      userId: user.id,
      serviceId: service.id,
      feature: FEATURE,
      serviceName: mode === "feljavitas" ? "fal" : "google-studio",
      units: files.length,
      // A fotó-korrekció a saját szerverünkön fut (nincs API-díja); a fal.ai-t
      // csak a ténylegesen meghívott képekre számoljuk el.
      estimatedCostUsd: mode === "feljavitas" ? FAL_USD_PER_IMAGE * falCalls : googleImageCostUsd(files.length),
    });

    return NextResponse.json({ ok: true, job, items, charged: !charge.bypassed });
  } catch (err) {
    // Nem sikerült MIND -> teljes visszatérítés.
    if (!charge.bypassed) {
      await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: 1 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
