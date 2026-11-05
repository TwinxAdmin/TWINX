// Aktiváló ügynök, szerveroldali közös logika: leiratkozás, az ügynöknek adott szűk adat, a titok ellenőrzése.
// A termék-adatbázist kizárólag ez a réteg olvassa az ügynök helyett: az ügynök nem kap service_role kulcsot.
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { setNewsletter, getNewsletter, type NewsletterSource } from "@/lib/newsletter";
import { blacklistInBrevo, syncUserToBrevo } from "@/lib/brevo";

/** Az ügynök végpontjainak védelme: Authorization: Bearer <ACTIVATION_AGENT_SECRET>. Titok nélkül minden kérés elutasítva. */
export function agentAuthorized(request: Request): boolean {
  const secret = (process.env.ACTIVATION_AGENT_SECRET ?? "").trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const got = Buffer.from(header.slice(7));
  const want = Buffer.from(secret);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Leiratkozás: az aktiváló levelek listájáról és a hírlevélről is. Idempotens.
 * A Brevóból érkező leiratkozásnál (source = "brevo") a Brevót nem kell újra tiltani.
 */
export async function optOutEmail(email: string, userId: string | null, source: NewsletterSource): Promise<{ error?: string }> {
  const address = email.trim().toLowerCase();
  const { error } = await createAdminClient().from("email_optout")
    .upsert({ email: address, user_id: userId, source }, { onConflict: "email", ignoreDuplicates: true });
  if (error) return { error: error.message };

  if (userId) {
    const current = await getNewsletter(userId);
    if (current.newsletter) await setNewsletter(userId, false, source);
    await syncUserToBrevo(userId);
  }
  if (source !== "brevo") await blacklistInBrevo(address);
  return {};
}

/** Keresztnév a teljes névből, magyar névsorrendet feltételezve. Ha nem megbízható, null, és a levél „Szia!”-val indul. */
export function firstNameOf(fullName: string | null | undefined): string | null {
  const parts = (fullName ?? "").trim().split(/\s+/).filter((p) => p && !/^(dr|ifj|id|özv|prof)\.?$/i.test(p));
  const name = parts.at(-1);
  if (!name || name.length < 2 || /[\d@_]/.test(name)) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export type AgentUser = {
  user_id: string;
  first_name: string | null;
  email: string;
  confirmed: boolean;
  created_at: string;
  signup_source: string | null;
  newsletter: boolean;
  opted_out: boolean;
  usage_count: number;
  last_usage_at: string | null;
  last_feature: string | null;
  balance: number;
  has_purchase: boolean;
  last_sign_in_at: string | null;
};

/** Egy tábla összes sora lapozva (a Supabase egy kérésre legfeljebb 1000 sort ad). */
async function allRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

/** A besoroláshoz szükséges mezők, kizárólag a role = 'user' fiókokról. Csak olvas. */
export async function agentUsers(): Promise<AgentUser[]> {
  const admin = createAdminClient();

  const authUsers = new Map<string, { email: string; confirmed: boolean; created_at: string; last_sign_in_at: string | null }>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      if (u.email) authUsers.set(u.id, { email: u.email, confirmed: !!u.email_confirmed_at, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null });
    }
    if (data.users.length < 1000) break;
  }

  // A leiratkozási tábla csak a migráció futtatása előtt hiányozhat: ilyenkor még senki sem iratkozhatott le. Minden más hiba megállítja a listát,
  // hogy egy átmeneti hiba miatt ne kaphasson levelet, aki leiratkozott.
  const { data: optoutRows, error: optoutError } = await admin.from("email_optout").select("email, user_id").limit(100000);
  if (optoutError && !/email_optout|does not exist|schema cache/i.test(optoutError.message)) throw new Error(optoutError.message);
  const optouts = (optoutRows ?? []) as { email: string; user_id: string | null }[];

  const [profiles, usage, wallets, purchases] = await Promise.all([
    allRows<{ id: string; full_name: string | null; signup_source: string | null; newsletter: boolean | null }>((a, b) =>
      admin.from("profiles").select("id, full_name, signup_source, newsletter").eq("role", "user").order("id").range(a, b)),
    allRows<{ user_id: string; feature_used: string; created_at: string }>((a, b) =>
      admin.from("usage_history").select("user_id, feature_used, created_at").order("created_at").order("id").range(a, b)),
    allRows<{ user_id: string; balance: number | string | null }>((a, b) =>
      admin.from("wallets").select("user_id, balance").order("user_id").range(a, b)),
    allRows<{ user_id: string }>((a, b) =>
      admin.from("credit_purchases").select("user_id").order("id").range(a, b)),
  ]);

  const usageBy = new Map<string, { count: number; last: string; feature: string }>();
  for (const row of usage) {
    const prev = usageBy.get(row.user_id);
    usageBy.set(row.user_id, { count: (prev?.count ?? 0) + 1, last: row.created_at, feature: row.feature_used });
  }
  const balanceBy = new Map(wallets.map((w) => [w.user_id, Number(w.balance) || 0]));
  const buyers = new Set(purchases.map((p) => p.user_id));
  const optedEmails = new Set(optouts.map((o) => o.email));
  const optedUsers = new Set(optouts.map((o) => o.user_id).filter(Boolean));

  const result: AgentUser[] = [];
  for (const p of profiles) {
    const auth = authUsers.get(p.id);
    if (!auth) continue;
    const used = usageBy.get(p.id);
    result.push({
      user_id: p.id,
      first_name: firstNameOf(p.full_name),
      email: auth.email,
      confirmed: auth.confirmed,
      created_at: auth.created_at,
      signup_source: p.signup_source,
      newsletter: !!p.newsletter,
      opted_out: optedUsers.has(p.id) || optedEmails.has(auth.email.toLowerCase()),
      usage_count: used?.count ?? 0,
      last_usage_at: used?.last ?? null,
      last_feature: used?.feature ?? null,
      balance: balanceBy.get(p.id) ?? 0,
      has_purchase: buyers.has(p.id),
      last_sign_in_at: auth.last_sign_in_at,
    });
  }
  return result;
}
