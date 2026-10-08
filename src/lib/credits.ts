// Kredit levonás szerveroldali helper — KÖZÖS (globális) pénztárca.
// Az egyenleg bármelyik modulban elkölthető (lásd wallet.sql).
// Üzleti szabály: az 'admin' korlátlan (prezentációs mód, nincs levonás). A 'sales' viszont
// FOGYASZTJA a keretet — az adminisztrátor adja neki a kreditet (/admin/credits), és ő is
// tölti újra; így az admin korlátozni tudja a sales folyamatait. Minden más: normál levonás.
//
// IRODAI MUNKAMÓD (office-mode.sql): ha a felhasználó irodai tag és „Irodai" módban
// dolgozik, a levonás az IRODA egyenlegéből + a tag keretéből történik (office_deduct),
// különben a saját pénztárcából. Visszatérítés: refundCredit() — oda megy vissza, ahonnan vontunk.
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembershipIn, getWorkContext } from "@/lib/office-server";

export type CreditSource = "wallet" | "office";

export type ChargeResult =
  | { ok: true; bypassed: boolean; source?: CreditSource }
  | { ok: false; reason: "insufficient"; source?: CreditSource };

/** Irodai módban dolgozik-e a felhasználó? (a KIVÁLASZTOTT irodában; ha nincs irodai mód: null) */
async function officeMode(userId: string): Promise<{ allowance: number; unlimited: boolean; owner: boolean; officeId: string } | null> {
  const ctx = await getWorkContext(userId);
  if (!ctx.useOffice || !ctx.officeId) return null;
  const m = await getMembershipIn(userId, ctx.officeId);
  if (!m) return null;
  return { officeId: m.office_id, allowance: m.allowance ?? 0, unlimited: !!m.unlimited, owner: m.role === "owner" };
}

export async function chargeCredit(params: {
  userId: string;
  amount?: number;
  service?: string;   // melyik modul (az irodai naplóhoz)
}): Promise<ChargeResult> {
  const { userId, amount = 1, service } = params;
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

  // 2a) Irodai mód → az iroda egyenlegéből + a tag keretéből (atomikus, office_deduct).
  if (await officeMode(userId)) {
    const { data: ok, error: offErr } = await admin.rpc("office_deduct", {
      p_user: userId, p_amount: amount, p_service: service ?? null,
    });
    if (offErr) throw new Error(offErr.message);
    return ok ? { ok: true, bypassed: false, source: "office" } : { ok: false, reason: "insufficient", source: "office" };
  }

  // 2b) Saját pénztárca: atomikus levonás a közös egyenlegből (csak ha van elég).
  const { data: deducted, error } = await admin.rpc("wallet_deduct", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) throw new Error(error.message);
  if (!deducted) return { ok: false, reason: "insufficient", source: "wallet" };

  return { ok: true, bypassed: false, source: "wallet" };
}

/**
 * Visszatérítés sikertelen generálás után — oda, ahonnan levontuk (iroda vagy
 * saját pénztárca). Ha a credit_refund SQL-függvény még nincs (office-mode.sql),
 * a régi módon a saját pénztárcába ír vissza.
 */
export async function refundCredit(userId: string, amount: number): Promise<void> {
  if (!amount || amount <= 0) return;
  const admin = createAdminClient();
  const { error } = await admin.rpc("credit_refund", { p_user: userId, p_amount: amount });
  if (error) {
    await admin.rpc("wallet_add", { p_user_id: userId, p_amount: amount });
  }
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

  // Irodai mód: a tag keretét (ha nem korlátlan) ÉS az iroda egyenlegét is nézzük.
  const om = await officeMode(userId);
  if (om) {
    if (!(om.owner || om.unlimited) && om.allowance < amount) return { ok: false, reason: "insufficient", source: "office" };
    const { data: office } = await admin.from("offices").select("balance").eq("id", om.officeId).maybeSingle();
    if (((office?.balance as number | undefined) ?? 0) < amount) return { ok: false, reason: "insufficient", source: "office" };
    return { ok: true, bypassed: false, source: "office" };
  }

  const { data: wallet } = await admin
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  const balance = (wallet?.balance as number | undefined) ?? 0;
  if (balance < amount) return { ok: false, reason: "insufficient" };
  return { ok: true, bypassed: false };
}
