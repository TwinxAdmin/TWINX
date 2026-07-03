// Kredit levonás szerveroldali helper.
// Üzleti szabály (CLAUDE.md): az 'admin' és 'sales' szerepkör prezentációs célból
// kreditlevonás NÉLKÜL használhatja az AI API-kat. Minden más szerepkörnél normál levonás.
import { createAdminClient } from "@/lib/supabase/admin";

export type ChargeResult =
  | { ok: true; bypassed: boolean }
  | { ok: false; reason: "insufficient" };

export async function chargeCredit(params: {
  userId: string;
  serviceId: string;
  amount?: number;
}): Promise<ChargeResult> {
  const { userId, serviceId, amount = 1 } = params;
  const admin = createAdminClient();

  // 1) Szerepkör ellenőrzés — admin / sales megkerüli a levonást.
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin" || profile?.role === "sales") {
    return { ok: true, bypassed: true };
  }

  // 2) Atomikus levonás (csak ha van elég kredit).
  const { data: deducted, error } = await admin.rpc("deduct_credit", {
    p_user_id: userId,
    p_service_id: serviceId,
    p_amount: amount,
  });

  if (error) throw new Error(error.message);
  if (!deducted) return { ok: false, reason: "insufficient" };

  return { ok: true, bypassed: false };
}
