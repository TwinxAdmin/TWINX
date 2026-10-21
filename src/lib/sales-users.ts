// Sales → Felhasználók: az ügyfelek listája a SALES számára. SZERVEROLDALI (service_role).
// FONTOS: a pénzügyi adatok (költség, bevétel, vásárolt kredit) ITT, a szerveren maradnak ki — a böngészőbe el sem jutnak.
// Csak az ügyfelek (profiles.role = 'user'); az admin és a sales fiókok nem kerülnek a hívandók közé.
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMetrics } from "@/lib/metrics";

export type SalesUser = {
  userId: string;
  name: string;
  company: string;
  email: string;
  phone: string | null;
  signupSource: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  balance: number;
  uses: number;
  features: { label: string; count: number }[];
};

export async function getSalesUsers(): Promise<SalesUser[]> {
  const admin = createAdminClient();
  const [{ users }, { data: phones }, { data: list }] = await Promise.all([
    getUserMetrics(),
    admin.from("profiles").select("id, phone").eq("role", "user"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const phoneById = new Map<string, string | null>();
  for (const p of phones ?? []) phoneById.set(String(p.id), (p.phone as string | null) || null);
  const lastById = new Map<string, string | null>();
  for (const u of list?.users ?? []) lastById.set(u.id, u.last_sign_in_at ?? null);

  return users
    .filter((u) => u.role === "user")
    .map((u) => ({
      userId: u.userId,
      name: u.name,
      company: u.company,
      email: u.email,
      phone: phoneById.get(u.userId) ?? null,
      signupSource: u.signupSource,
      createdAt: u.createdAt,
      lastSignInAt: lastById.get(u.userId) ?? null,
      balance: u.balance,
      uses: u.uses,
      features: u.features,
    }));
}
