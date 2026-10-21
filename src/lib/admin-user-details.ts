// Admin → Felhasználók → „Részletek": egy felhasználó MINDEN adata egy helyen. SZERVEROLDALI (service_role), CSAK OLVAS.
// Sales-nézet (scope: "sales"): a számlázási adatok, a vásárlások, a kézi jóváírások és a kredit-kérések
// LE SEM KÉRDEZŐDNEK — a Sales böngészőjébe el sem jutnak (csak elérhetőség + tevékenység + kredit-egyenleg).
// Minden blokk külön lekérdezés; ha egy tábla / oszlop hiányzik (pl. még nem futott migráció), az a blokk üres marad,
// a többi ettől még megjelenik.
import { createAdminClient } from "@/lib/supabase/admin";
import { featureLabel } from "@/lib/activity";
import { SIGNUP_SOURCE_LABEL } from "@/lib/onboarding";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : v === null || v === undefined || v === "" ? null : Number(v));

export type DetailScope = "admin" | "sales";

export type UserDetails = {
  scope: DetailScope;
  account: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    role: string | null;
    createdAt: string | null;
    signupSource: string | null;
    inviteCode: string | null;
    providers: string[];
    emailConfirmedAt: string | null;
    lastSignInAt: string | null;
    termsVersion: string | null;
    termsAcceptedAt: string | null;
  };
  billing: { label: string; value: string }[];
  credits: {
    balance: number | null;
    purchases: { at: string | null; credits: number | null; amountHuf: number | null; invoice: string | null }[];
    grants: { at: string | null; amount: number | null; note: string | null; by: string | null }[];
    requests: { at: string | null; amount: number | null; status: string | null; granted: number | null; reason: string | null }[];
  };
  offices: { name: string; role: string | null; joinedAt: string | null; unlimited: boolean; allowance: number | null }[];
  brandings: { label: string | null; name: string | null; title: string | null; phone: string | null; email: string | null; company: string | null; website: string | null }[];
  usage: { total: number; lastAt: string | null; features: { label: string; count: number }[] };
};

/** Számlázási mezők olvasható címkével (csak a kitöltöttek kerülnek a listába). */
const BILLING_FIELDS: [string, string][] = [
  ["billing_type", "Típus"],
  ["billing_name", "Név"],
  ["billing_company_name", "Cégnév"],
  ["billing_tax_number", "Adószám"],
  ["billing_country", "Ország"],
  ["billing_zip", "Irányítószám"],
  ["billing_city", "Város"],
  ["billing_address", "Cím"],
  ["billing_company_country", "Cég országa"],
  ["billing_company_zip", "Cég irányítószáma"],
  ["billing_company_city", "Cég városa"],
  ["billing_company_address", "Cég címe"],
  ["billing_email", "Számlázási e-mail"],
];
const BILLING_TYPE: Record<string, string> = { company: "Cég", individual: "Magánszemély" };

export async function getUserDetails(userId: string, scope: DetailScope = "admin"): Promise<UserDetails | null> {
  const admin = createAdminClient();
  const full = scope === "admin";
  // A Sales-nézetben a pénzügyi blokkok helyén üres eredmény — a táblákat meg sem kérdezzük.
  const none = Promise.resolve({ data: [] as Row[] });

  const [authRes, profRes, walletRes, purchRes, grantRes, reqRes, memRes, brandRes, usageRes] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    admin.from("wallets").select("balance").eq("user_id", userId).maybeSingle(),
    full ? admin.from("credit_purchases").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50) : none,
    full ? admin.from("credit_grants").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50) : none,
    full ? admin.from("credit_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50) : none,
    admin.from("office_members").select("office_id, role, joined_at, allowance, unlimited").eq("user_id", userId),
    admin.from("branding_profiles").select("label, display_name, title, phone, email, company, website").eq("user_id", userId).order("created_at", { ascending: true }),
    admin.from("usage_history").select("feature_used, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5000),
  ]);

  const au = authRes.data?.user ?? null;
  const p = (profRes.data ?? null) as Row | null;
  if (!au && !p) return null;

  // Irodák neve
  const members = (memRes.data ?? []) as Row[];
  const officeIds = members.map((m) => String(m.office_id));
  const names = new Map<string, string>();
  if (officeIds.length) {
    const { data } = await admin.from("offices").select("id, name").in("id", officeIds);
    for (const o of (data ?? []) as Row[]) names.set(String(o.id), String(o.name ?? ""));
  }

  // Használat modulonként
  const usage = (usageRes.data ?? []) as Row[];
  const counts = new Map<string, number>();
  for (const u of usage) {
    const k = String(u.feature_used ?? "egyéb");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const providers = Array.isArray(au?.app_metadata?.providers)
    ? (au!.app_metadata.providers as string[])
    : au?.app_metadata?.provider ? [String(au.app_metadata.provider)] : [];

  const billing: { label: string; value: string }[] = [];
  for (const [k, label] of full ? BILLING_FIELDS : []) {
    const v = str(p?.[k]);
    if (v) billing.push({ label, value: k === "billing_type" ? (BILLING_TYPE[v] ?? v) : v });
  }

  const src = str(p?.signup_source);
  return {
    scope,
    account: {
      id: userId,
      name: str(p?.full_name) ?? str(au?.user_metadata?.full_name),
      email: au?.email ?? null,
      phone: str(p?.phone),
      company: str(p?.company),
      role: str(p?.role),
      createdAt: au?.created_at ?? str(p?.created_at),
      signupSource: src ? (SIGNUP_SOURCE_LABEL[src] ?? src) : null,
      inviteCode: str(p?.invite_code),
      providers,
      emailConfirmedAt: au?.email_confirmed_at ?? null,
      lastSignInAt: au?.last_sign_in_at ?? null,
      termsVersion: str(p?.terms_version),
      termsAcceptedAt: str(p?.terms_accepted_at),
    },
    billing,
    credits: {
      balance: num((walletRes.data as Row | null)?.balance),
      purchases: ((purchRes.data ?? []) as Row[]).map((r) => ({
        at: str(r.created_at), credits: num(r.credits), amountHuf: num(r.amount_huf), invoice: str(r.invoice_number),
      })),
      grants: ((grantRes.data ?? []) as Row[]).map((r) => ({
        at: str(r.created_at), amount: num(r.amount), note: str(r.note), by: str(r.admin_email),
      })),
      requests: ((reqRes.data ?? []) as Row[]).map((r) => ({
        at: str(r.created_at), amount: num(r.amount), status: str(r.status), granted: num(r.granted_amount), reason: str(r.reason),
      })),
    },
    offices: members.map((m) => ({
      name: names.get(String(m.office_id)) || "(ismeretlen iroda)",
      role: str(m.role),
      joinedAt: str(m.joined_at),
      unlimited: m.unlimited === true,
      allowance: num(m.allowance),
    })),
    brandings: ((brandRes.data ?? []) as Row[]).map((b) => ({
      label: str(b.label), name: str(b.display_name), title: str(b.title), phone: str(b.phone),
      email: str(b.email), company: str(b.company), website: str(b.website),
    })),
    usage: {
      total: usage.length,
      lastAt: str(usage[0]?.created_at),
      features: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, c]) => ({ label: featureLabel(k), count: c })),
    },
  };
}
