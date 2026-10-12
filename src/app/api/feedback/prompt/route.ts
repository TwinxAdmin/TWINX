// GET /api/feedback/prompt?module=<útvonal> — kell-e most kérdezni (ME3b)?
//   { rating: true }  → csillagos értékelő kártya (3. futtatás után; bezárás esetén a 6.-nál még egyszer)
//   { ask: true }     → „Mi hiányzik?" kártya (≥ 3 napon megnyitotta, de nem futtatta)
// A mérés soha nem zavarhatja a felhasználót: hiba esetén { rating: false, ask: false }.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { moduleForPath } from "@/lib/module-favorites";
import { feedbackPrompt } from "@/lib/module-feedback";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ rating: false, ask: false }, { status: 401 });

  const path = new URL(request.url).searchParams.get("module") ?? "";
  const moduleHref = path.startsWith("/dashboard/") ? moduleForPath(path.slice(0, 300)) : null;
  if (!moduleHref) return NextResponse.json({ rating: false, ask: false });

  try {
    const p = await feedbackPrompt(user.id, moduleHref);
    return NextResponse.json({ rating: p.rating, ask: p.ask, module: moduleHref });
  } catch {
    return NextResponse.json({ rating: false, ask: false });
  }
}
