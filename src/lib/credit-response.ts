// Egységes „nincs elég kredit" válasz (HTTP 402) minden kreditet vonó modulnak.
//
// Ha az IRODAI keret fogyott el (irodai módban), a válasz `code: "office_insufficient"` — erre a
// kliens (OfficeFallbackProvider) felugró ablakban megkérdezi: „Folytatod a saját kreditedből?".
// Igen esetén UGYANAZT a kérést újraküldi `x-twx-pay-from: wallet` fejléccel — csak erre az egy
// műveletre. Kérdés nélkül SOHA nem vonunk a saját kreditből.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChargeResult } from "@/lib/credits";

export async function insufficientResponse(userId: string, needed: number, result: ChargeResult | null | undefined) {
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
