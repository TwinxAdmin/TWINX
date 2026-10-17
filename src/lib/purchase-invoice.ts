// Számla a bankkártyás kreditvásárláshoz — CSAK szerveroldal (a Stripe webhook hívja a kredit jóváírása UTÁN).
// Idempotens: a `credit_purchase_claim_invoice` adatbázis-függvény zárolja a sort, így két párhuzamos webhook sem állít ki
// két számlát. Állapotok és teendők: lásd a 20261017115051_card-invoicing.sql fejlécét.
import { createAdminClient } from "@/lib/supabase/admin";
import { issueInvoice } from "@/lib/szamlazz";
import { isBillingComplete, type BillingInfo } from "@/lib/billing";
import { sendInvoiceProblemNotification } from "@/lib/email";

/** Ennyi egyértelmű hiba után már nem kérjük a Stripe-tól az újraküldést (az admin értesítést kapott). */
export const MAX_INVOICE_ATTEMPTS = Number(process.env.INVOICE_MAX_ATTEMPTS ?? 6);

export type PurchaseInvoiceOutcome =
  | { kind: "skipped" }                       // már kiállítva / épp folyamatban / nincs ilyen jóváírt vásárlás
  | { kind: "issued"; invoiceNumber: string }
  | { kind: "failed"; retry: boolean }         // retry = kérjük-e a Stripe-tól az újraküldést (500-zal)
  | { kind: "uncertain" };

type Claimed = { user_id: string; credits: number; amount_huf: number; billing_snapshot: BillingInfo | null; invoice_attempts: number };

export async function issueInvoiceForPurchase(sessionId: string): Promise<PurchaseInvoiceOutcome> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("credit_purchase_claim_invoice", { p_session_id: sessionId });
  if (error) {
    // pl. a migráció még nem futott le — a kredit ettől még jóvá van írva
    console.error("[invoice] zárolás sikertelen (20261017115051_card-invoicing.sql lefutott?):", sessionId, error.message);
    return { kind: "failed", retry: true };
  }
  const row = (Array.isArray(data) ? data[0] : data) as Claimed | undefined;
  if (!row) return { kind: "skipped" };

  const { data: u } = await admin.auth.admin.getUserById(row.user_id);
  const accountEmail = u?.user?.email ?? null;
  const billing = row.billing_snapshot;

  const result = billing && isBillingComplete(billing)
    ? await issueInvoice({ sessionId, credits: row.credits, amountHuf: row.amount_huf, billing, fallbackEmail: accountEmail })
    : ({ status: "failed", error: "Hiányos számlázási adat a vásárláskor." } as const);

  if (result.status === "issued") {
    await admin.from("credit_purchases").update({
      invoice_status: "issued", invoice_number: result.invoiceNumber, invoice_issued_at: new Date().toISOString(), invoice_error: null,
    }).eq("stripe_session_id", sessionId);
    return { kind: "issued", invoiceNumber: result.invoiceNumber };
  }

  await admin.from("credit_purchases").update({ invoice_status: result.status, invoice_error: result.error }).eq("stripe_session_id", sessionId);
  console.error(`[invoice] ${result.status}:`, sessionId, result.error);
  // Értesítés: bizonytalannál mindig; egyértelmű hibánál az elsőnél és amikor feladjuk az automatikus újrapróbálást.
  const giveUp = row.invoice_attempts >= MAX_INVOICE_ATTEMPTS;
  if (result.status === "uncertain" || row.invoice_attempts === 1 || giveUp) {
    await sendInvoiceProblemNotification({
      sessionId, status: result.status, error: result.error, buyerEmail: billing?.billing_email || accountEmail,
      credits: row.credits, amountHuf: row.amount_huf, billing, attempts: row.invoice_attempts,
    }).catch((e) => console.error("[invoice] értesítés sikertelen:", e instanceof Error ? e.message : e));
  }
  return result.status === "uncertain" ? { kind: "uncertain" } : { kind: "failed", retry: !giveUp };
}
