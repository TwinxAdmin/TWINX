// /admin — Áttekintő kezdőlap: kulcsszámok és gyors belépők (CSAK admin).
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMetrics, getUserMetrics } from "@/lib/metrics";
import AdminShell from "@/components/admin/AdminShell";

export const runtime = "nodejs";

function huf(n: number): string {
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}

export default async function AdminHomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  // Aktuális hónap eleje — a havi számokhoz.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const sinceIso = monthStart.toISOString();

  const admin = createAdminClient();
  const [month, { users }, { count: newIdeas }] = await Promise.all([
    getMetrics(sinceIso),
    getUserMetrics(),
    admin.from("ideas").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  // Új regisztrációk az elmúlt 7 napban.
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const newUsers = users.filter((u) => u.createdAt && new Date(u.createdAt).getTime() >= weekAgo).length;

  const cards = [
    {
      label: "Felhasználók",
      value: String(users.length),
      hint: newUsers ? `+${newUsers} az elmúlt héten` : "nincs új az elmúlt héten",
      accent: newUsers > 0,
    },
    {
      label: "Havi API-költség",
      value: huf(month.costHuf),
      hint: "becsült önköltség",
      accent: false,
    },
    {
      label: "Havi bevétel",
      value: huf(month.revenueHuf),
      hint: `${month.creditsSold} kredit eladva`,
      accent: false,
    },
    {
      label: "Generálások (hó)",
      value: String(month.generations),
      hint: month.marginPct !== null ? `${Math.round(month.marginPct)}% árrés` : "—",
      accent: false,
    },
  ];

  const quick = [
    { href: "/admin/users", title: "Felhasználók", desc: "név, cég, e-mail, használat, kredit" },
    { href: "/admin/analytics", title: "Költségfigyelő", desc: "modulonkénti API-önköltség és árrés" },
    { href: "/admin/credits", title: "Kredit jóváírás", desc: "kézi feltöltés partnernek" },
    {
      href: "/admin/ideas",
      title: "Ötletláda",
      desc: newIdeas ? `${newIdeas} új javaslat olvasatlanul` : "nincs új javaslat",
      badge: newIdeas ?? 0,
    },
    { href: "/admin/prompts", title: "AI promptok", desc: "modulonként szerkeszthető" },
    { href: "/admin/rejections", title: "Nem elfogadott képek", desc: "minőségi visszajelzések" },
  ];

  return (
    <AdminShell title="Admin — Kezdőlap" subtitle="A legfontosabb számok és belépők egy helyen.">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="twx-card p-4">
            <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{c.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{c.value}</p>
            <p className="mt-0.5 text-[11px]" style={{ color: c.accent ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>
              {c.hint}
            </p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Gyors belépők</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quick.map((q) => (
            <Link key={q.href} href={q.href} className="twx-card block p-4 transition hover:shadow-md">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {q.title}
                {!!q.badge && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: "var(--twx-coral)" }}>
                    {q.badge}
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{q.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
