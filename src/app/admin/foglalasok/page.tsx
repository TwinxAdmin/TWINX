// /admin/foglalasok — Admin → Foglalások (terv 15 / 5. szakasz; CSAK admin).
//   Beérkezett: a foglalások listája — a 2e lépésben épül, addig „Hamarosan".
//   Időpontok:  heti sablon, „Sablon alkalmazása", a következő 4 hét időpontjai.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import BookingAvailabilityAdmin from "@/components/admin/BookingAvailabilityAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BookingsAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  return (
    <AdminShell title="Foglalások" subtitle="Ingyenes felmérés: a szabad időpontok és a beérkezett foglalások.">
      {/* Fülek — fix méret; a Beérkezett fül a következő lépésben kapcsol be. */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--twx-line)" }}>
        <span className="flex h-10 cursor-default items-center gap-2 px-4 text-sm" style={{ color: "var(--twx-ink-muted)", opacity: 0.6 }}
          aria-disabled title="A foglalások listája a következő lépésben készül el.">
          Beérkezett <span className="twx-badge-muted rounded-full px-2 py-0.5 text-[10px] font-bold">Hamarosan</span>
        </span>
        <span className="flex h-10 items-center border-b-2 px-4 text-sm font-semibold" style={{ borderColor: "var(--twx-coral)" }}>
          Időpontok
        </span>
      </div>
      <BookingAvailabilityAdmin />
    </AdminShell>
  );
}
