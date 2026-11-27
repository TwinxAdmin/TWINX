// Kredit levonás szerveroldali helper — KÖZÖS (globális) pénztárca.
// Az egyenleg bármelyik modulban elkölthető (lásd 20260704161035_wallet.sql).
// Üzleti szabály: az 'admin' korlátlan (prezentációs mód, nincs levonás). A 'sales' viszont
// FOGYASZTJA a keretet — az adminisztrátor adja neki a kreditet (/admin/credits), és ő is
// tölti újra; így az admin korlátozni tudja a sales folyamatait. Minden más: normál levonás.
//
// IRODAI MUNKAMÓD (20261007130712_office-mode.sql): ha a felhasználó irodai tag és „Irodai" módban
// dolgozik, a levonás az IRODA egyenlegéből + a tag keretéből történik (office_deduct),
// különben a saját pénztárcából. Visszatérítés: refundCredit() — oda megy vissza, ahonnan vontunk.
import { legalAccepted } from "@/lib/terms";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembershipIn, getWorkContext, officeFree, officeKind } from "@/lib/office-server";
import { freeByEstateAccess } from "@/lib/new-ui";
import { isEstateService, packageCheck, packageRelease, packageReserve, type CostHint } from "@/lib/package-cap";

export type CreditSource = "wallet" | "office";

/**
 * Honnan fizessen EZ az egy művelet:
 *  • "auto"   — a beállított munkamód szerint (irodai mód → iroda, különben saját pénztárca)
 *  • "wallet" — a felhasználó KIFEJEZETTEN a saját kreditjéből kérte (pl. elfogyott az irodai
 *               kerete, és a felugró ablakban rábólintott). Csak erre az egy kérésre szól.
 */
export type PayFrom = "auto" | "wallet";

/** A kérés fejlécéből: a kliens „Folytatás saját kreditből" után küldi (x-twx-pay-from: wallet). */
export function payFromRequest(request: Request): PayFrom {
  return request.headers.get("x-twx-pay-from") === "wallet" ? "wallet" : "auto";
}

/**
 * `packageEvent`: az Ingatlan csomag keretéből foglalt tétel (terv 27) — ilyenkor kredit NEM fogy (bypassed: true),
 * hibánál a `refundCharge` oldja fel. Hiba-okok: insufficient (kredit) · cap (a havi keret elfogyott) ·
 * no_package (a cégnek nincs Ingatlan-kerete) · no_estimate (nincs költségbecslés) · error (ellenőrzési hiba).
 */
export type ChargeResult =
  | { ok: true; bypassed: boolean; source?: CreditSource; packageEvent?: string }
  | { ok: false; reason: "insufficient" | "cap" | "no_package" | "no_estimate" | "error" | "legal"; source?: CreditSource };

/** Irodai módban dolgozik-e a felhasználó? (a KIVÁLASZTOTT irodában; ha nincs irodai mód: null) */
async function officeMode(userId: string): Promise<{ allowance: number; unlimited: boolean; owner: boolean; officeId: string } | null> {
  const ctx = await getWorkContext(userId);
  if (!ctx.useOffice || !ctx.officeId) return null;
  const m = await getMembershipIn(userId, ctx.officeId);
  if (!m) return null;
  // Közös munkatérben nincs irodai keret — mindig a saját pénztárcából vonunk.
  if ((await officeKind(m.office_id)) === "team") return null;
  return { officeId: m.office_id, allowance: m.allowance ?? 0, unlimited: !!m.unlimited, owner: m.role === "owner" };
}

export async function chargeCredit(params: {
  userId: string;
  amount?: number;
  service?: string;   // melyik modul (az irodai naplóhoz)
  payFrom?: PayFrom;  // "wallet" = most kifejezetten a saját kreditből (soha nem automatikus)
  /** Ingatlan csomag (terv 27): mennyi munka indul — a költségbecsléshez */
  cost?: CostHint;
  /** utólagos elszámolás kész eredményhez (a keretet nem ellenőrzi, de beszámít) */
  force?: boolean;
}): Promise<ChargeResult> {
  const { userId, amount = 1, service, payFrom = "auto" } = params;
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

  // 1a) D74: az aktuális ÁSZF + Adatkezelési tájékoztató elfogadása nélkül modul nem indítható (szerveroldali kapu).
  //     Utólagos elszámolásnál (force) nem tiltunk — az a már elindult munkáé.
  if (!params.force && !(await legalAccepted(userId))) return { ok: false, reason: "legal" };

  // 1b) Új felület + Ingatlan-hozzáférés: nincs kredit-levonás (3d), helyette a cég havi Ingatlan-keretéből
  //     foglalunk a becsült költséggel (terv 27, D62). Más (nem Ingatlan) szolgáltatás a korábbi módon fut.
  if (await freeByEstateAccess(userId)) {
    if (!isEstateService(service)) return { ok: true, bypassed: true };
    const r = await packageReserve({ userId, service: service!, hint: params.cost, force: params.force });
    if (!r.ok) return { ok: false, reason: r.reason };
    return { ok: true, bypassed: true, packageEvent: r.eventId ?? undefined };
  }

  // 2a) Irodai mód → az iroda egyenlegéből + a tag keretéből (atomikus, office_deduct).
  //     Ha a felhasználó erre a kérésre a saját kreditjét választotta, ezt az ágat kihagyjuk.
  if (payFrom !== "wallet" && (await officeMode(userId))) {
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
 * Egységes visszaadás hibánál: Ingatlan-keret foglalás → feloldás; kredit-levonás → visszatérítés;
 * megkerülés (admin) → nincs teendő. A modulok ezt hívják a `refundCredit` helyett.
 */
export async function refundCharge(userId: string, amount: number, charge: ChargeResult | null | undefined): Promise<void> {
  if (!charge || !charge.ok) return;
  if (charge.packageEvent) { await packageRelease(charge.packageEvent); return; }
  if (charge.bypassed) return;
  await refundCredit(userId, amount, charge.source);
}

/**
 * Visszatérítés sikertelen generálás után — oda, ahonnan levontuk (iroda vagy
 * saját pénztárca). Ha a credit_refund SQL-függvény még nincs (20261007130712_office-mode.sql),
 * a régi módon a saját pénztárcába ír vissza.
 */
export async function refundCredit(userId: string, amount: number, source?: CreditSource): Promise<void> {
  if (!amount || amount <= 0) return;
  const admin = createAdminClient();
  // Ha biztosan tudjuk, hogy a SAJÁT pénztárcából vontunk (pl. „Folytatás saját kreditből"),
  // oda írjuk vissza — ne keressen a credit_refund irodai levonást ugyanakkora összeggel.
  if (source === "wallet") {
    await admin.rpc("wallet_add", { p_user_id: userId, p_amount: amount });
    return;
  }
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
  payFrom?: PayFrom;
  /** az Ingatlan csomag keret-ellenőrzéséhez (terv 27) */
  service?: string;
  cost?: CostHint;
}): Promise<ChargeResult> {
  const { userId, amount = 1, payFrom = "auto" } = params;
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") return { ok: true, bypassed: true };
  if (!(await legalAccepted(userId))) return { ok: false, reason: "legal" }; // D74: elfogadás nélkül nem indul
  // Ingatlan-hozzáférés: a cég havi keretében van-e még hely (foglalás nélkül). bypassed: false → a végén a
  // chargeCredit (force) számolja el a keretre — kredit ekkor sem fogy.
  if (await freeByEstateAccess(userId)) {
    if (!isEstateService(params.service)) return { ok: true, bypassed: true };
    const r = await packageCheck({ userId, service: params.service!, hint: params.cost });
    if (!r.ok) return { ok: false, reason: r.reason };
    return { ok: true, bypassed: false };
  }

  // Irodai mód (foglalásos keret, 20261008104953_office-reserve.sql):
  //   • tag: a saját (lefoglalt) kerete számít;
  //   • létrehozó / korlátlan: csak a SZABADON kiosztható rész (a kollégák foglalását nem érinti).
  const om = payFrom === "wallet" ? null : await officeMode(userId);
  if (om) {
    if (om.owner || om.unlimited) {
      const { free } = await officeFree(om.officeId);
      if (free < amount) return { ok: false, reason: "insufficient", source: "office" };
    } else if (om.allowance < amount) {
      return { ok: false, reason: "insufficient", source: "office" };
    }
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
