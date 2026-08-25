// Kredit levonás szerveroldali helper — KÖZÖS (globális) pénztárca.
// Az egyenleg bármelyik modulban elkölthető (lásd wallet.sql).
// Üzleti szabály: az 'admin' korlátlan (prezentációs mód, nincs levonás). A 'sales' viszont
// FOGYASZTJA a keretet — az adminisztrátor adja neki a kreditet (/admin/credits), és ő is
// tölti újra; így az admin korlátozni tudja a sales folyamatait. Minden más: normál levonás.
import { createAdminClient } from "@/lib/supabase/admin";

export type ChargeResult =
  | { ok: true; bypassed: boolean }
  | { ok: false; reason: "insufficient" };

export async function chargeCredit(params: {
  userId: string;
  amount?: number;
}): Promise<ChargeResult> {
  const { userId, amount = 1 } = params;
  const admin = createAdminClient();

  // 1) Szerepkör ellenőrzés — CSAK az admin korlátlan (megkerüli a levonást).
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") {
    return { ok: true, bypassed: true };
  }

  // 2) Atomikus levonás a közös egyenlegből (csak ha van elég).
  const { data: deducted, error } = await admin.rpc("wallet_deduct", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) throw new Error(error.message);
  if (!deducted) return { ok: false, reason: "insufficient" };

  return { ok: true, bypassed: false };
}

/**
 * Egyenleg-ELLENŐRZÉS levonás NÉLKÜL. Akkor kell, ha a levonást a sikeres
 * generálás UTÁNRA halasztjuk (pl. értékbecslés): előbb megnézzük, van-e elég
 * kredit (nehogy ingyen fusson a fizetős API-hívás), de csak a végén vonjuk le —
 * így egy időtúllépés vagy hiba SOHA nem visz el kreditet.
 *
 * Fontos: ez nem foglal, csak pillanatképet néz. A tényleges levonás a végén a
 * `chargeCredit` atomikus `wallet_deduct`-jával történik (ott dől el véglegesen).
 */
export async function checkCreditAvailable(params: {
  userId: string;
  amount?: number;
}): Promise<ChargeResult> {
  const { userId, amount = 1 } = params;
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") return { ok: true, bypassed: true };

  const { data: wallet } = await admin
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  const balance = (wallet?.balance as number | undefined) ?? 0;
  if (balance < amount) return { ok: false, reason: "insufficient" };
  return { ok: true, bypassed: false };
}
