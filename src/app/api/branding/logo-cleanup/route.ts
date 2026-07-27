// POST /api/branding/logo-cleanup — logó háttérének AI-tisztítása (BiRefNet).
// Csak akkor hívjuk, ha az ingyenes kliensoldali kivágás nem volt jó. Nem von kreditet
// (arculatonként jellemzően egyszeri, tized centes költség), de a költséget logoljuk.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeBackgroundFal } from "@/lib/fal";
import { logCost } from "@/lib/costs";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Nincs feltöltött logó." }, { status: 422 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Csak PNG, JPG vagy WEBP tisztítható." }, { status: 422 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${bytes.toString("base64")}`;
    const result = await removeBackgroundFal(dataUri);

    // Költség-logolás (a partnernek ingyenes).
    const admin = createAdminClient();
    const { data: service } = await admin.from("services").select("id").eq("slug", "real-estate").single();
    if (service) {
      await logCost({
        userId: user.id,
        serviceId: service.id,
        feature: "branding_logo_cleanup",
        serviceName: "fal",
        units: 1,
        estimatedCostUsd: 0.01,
      });
    }

    return new NextResponse(new Uint8Array(result.bytes), {
      headers: { "Content-Type": result.mimeType, "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
