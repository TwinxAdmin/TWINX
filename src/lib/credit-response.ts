// Egységes „nincs elég kredit" válasz (HTTP 402) minden kreditet vonó modulnak.
//
// Ha az IRODAI keret fogyott el (irodai módban), a válasz `code: "office_insufficient"` — erre a
// kliens (OfficeFallbackProvider) felugró ablakban megkérdezi: „Folytatod a saját kreditedből?".
// Igen esetén UGYANAZT a kérést újraküldi `x-twx-pay-from: wallet` fejléccel — csak erre az egy
// műveletre. Kérdés nélkül SOHA nem vonunk a saját kreditből.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChargeResult } from "@/lib/credits";
import { CAP_STOP_TEXT } from "@/lib/user-texts";

/** Az Ingatlan csomag keretének hibái (terv 27) — szám és „kredit" nélkül. */
const PACKAGE_TEXT: Record<string, { error: string; status: number }> = {
  cap: { error: CAP_STOP_TEXT, status: 429 },
  no_package: { error: "Ez a funkció most nem indítható, mert a csomagod beállítása még nincs kész. Írj nekünk: office@twinx.hu.", status: 403 },
  no_estimate: { error: "Ez a funkció most nem indítható. Szóltunk a csapatnak; ha sürgős, írj nekünk: office@twinx.hu.", status: 503 },
  error: { error: "A használat ellenőrzése most nem sikerült. Próbáld újra később.", status: 503 },
  // D74: az új ÁSZF és Adatkezelési tájékoztató elfogadása szükséges (a kezdőlap ablakában vagy újrabelépéskor)
  legal: { error: "A modul indításához fogadd el az új Általános Szerződési Feltételeket és az Adatkezelési tájékoztatót (frissítsd az oldalt: megjelenik az elfogadó ablak).", status: 403 },
};

export async function insufficientResponse(userId: string, needed: number, result: ChargeResult | null | undefined) {
  if (result && !result.ok && result.reason !== "insufficient") {
    const t = PACKAGE_TEXT[result.reason] ?? PACKAGE_TEXT.error;
    return NextResponse.json({ error: t.error, code: result.reason === "cap" ? "cap_reached" : result.reason === "legal" ? "legal_required" : "unavailable" }, { status: t.status });
  }
  if (result && !result.ok && result.source === "office") {
    const { data: w } = await createAdminClient().from("wallets").select("balance").eq("user_id", userId).maybeSingle();
    return NextResponse.json({
      error: `Nincs elég irodai kereted (${needed} kredit szükséges).`,
      code: "office_insufficient",
      needed,
      wallet: (w?.balance as number | undefined) ?? 0,
    }, { status: 402 });
  }
  return NextResponse.json({
    error: `Nincs elég kredited (${needed} kredit szükséges).`,
    code: "insufficient",
    needed,
  }, { status: 402 });
}
