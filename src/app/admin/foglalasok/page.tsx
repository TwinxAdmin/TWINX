// /admin/foglalasok — Admin → Foglalások (terv 15 / 5. szakasz; CSAK admin).
//   Beérkezett: a foglalások listája (állapot, jegyzet, lemondás, újraküldés).
//   Időpontok:  heti sablon, „Sablon alkalmazása", a következő 4 hét időpontjai.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import Link from "next/link";
import BookingAvailabilityAdmin from "@/components/admin/BookingAvailabilityAdmin";
import BookingInboxAdmin from "@/components/admin/BookingInboxAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BookingsAdminPage({ searchParams }: { searchParams: Promise<{ ful?: string }> }) {
  const tab = (await searchParams).ful === "idopontok" ? "idopontok" : "beerkezett";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  return (
    <AdminShell title="Foglalások" subtitle="Ingyenes felmérés: a szabad időpontok és a beérkezett foglalások.">
      {/* Fülek — fix méret */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--twx-line)" }}>
        {[{ id: "beerkezett", label: "Beérkezett", href: "/admin/foglalasok" }, { id: "idopontok", label: "Időpontok", href: "/admin/foglalasok?ful=idopontok" }].map((t) => (
          <Link key={t.id} href={t.href} className="flex h-10 items-center border-b-2 px-4 text-sm"
            style={tab === t.id ? { borderColor: "var(--twx-coral)", fontWeight: 600 } : { borderColor: "transparent", color: "var(--twx-ink-muted)" }}>
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "idopontok" ? <BookingAvailabilityAdmin /> : <BookingInboxAdmin />}
    </AdminShell>
  );
}
