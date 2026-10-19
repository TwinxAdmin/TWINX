// GET /api/real-estate/video/templates — a videó-szerkesztő sablonlistájához: mely sablon-családok rejtettek.
//   { hidden: string[], showHidden: boolean }
//   showHidden = true csak a valódi adminnak (az „így látja a partner" előnézetben NEM) — ő a rejtettet is
//   látja „Rejtett" jelöléssel és tesztelheti. Mindenki más a rejtett sablont nem látja.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveViewContext } from "@/lib/view-as";
import { hiddenTemplateIds } from "@/lib/video-template-availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const view = await resolveViewContext(me?.role as string | undefined);
  const { hidden } = await hiddenTemplateIds();
  return NextResponse.json({ hidden, showHidden: view.role === "admin" }, { headers: { "Cache-Control": "no-store" } });
}
