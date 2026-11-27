// /admin/foglalasok — Admin → Foglalások (terv 15 / 5. szakasz; CSAK admin).
//   Beérkezett: a foglalások listája (állapot, jegyzet, lemondás, újraküldés).
//   Időpontok:  heti sablon, „Sablon alkalmazása", a következő 4 hét időpontjai.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import Link from "next/link";
import BookingAvailabilityAdmin from "@/components/admin/BookingAvailabilityAdmin";
import BookingInboxAdmin from "@/components/admin/BookingInboxAdmin";
import { BOOKING_MODE } from "@/lib/booking-mode";
import { createAdminClient } from "@/lib/supabase/admin";
import CallbackRequestsAdmin, { type CallbackLead } from "@/components/admin/CallbackRequestsAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BookingsAdminPage({ searchParams }: { searchParams: Promise<{ ful?: string }> }) {
  const ful = (await searchParams).ful;
  // Alapfül: visszahívás-módban a visszahívás-kérések (D73), különben a beérkezett foglalások.
  const tab = ful === "idopontok" ? "idopontok" : ful === "beerkezett" ? "beerkezett" : ful === "visszahivas" || BOOKING_MODE === "callback" ? "visszahivas" : "beerkezett";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  // Visszahívás-kérések a leads táblából (a naptáras ablakból; az üzenet elején a jelölés).
  const { data: cbRows } = await createAdminClient().from("leads").select("*")
    .or('message.ilike."[Visszahívás-kérés%",message.ilike."[Időpont-kérés%"')
    .order("created_at", { ascending: false }).limit(200);
  const callbacks = (cbRows ?? []) as CallbackLead[];
  const openCallbacks = callbacks.filter((c) => !c.handled_at).length;

  return (
    <AdminShell title="Foglalások" subtitle="Ingyenes felmérés: a visszahívás-kérések (naptáras ablak), a beérkezett foglalások és a szabad időpontok.">
      {BOOKING_MODE === "callback" && (
        // D73: tájékoztató sor — a nyilvános felületen most nincs foglaló űrlap, ezért itt nem érkezik új foglalás.
        <p className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: "var(--twx-cream)", color: "var(--twx-ink-muted)", boxShadow: "inset 0 0 0 1px var(--twx-line)" }}>
          A nyilvános oldalon jelenleg <b>visszahívás-kérés</b> van a foglaló űrlap helyett (e-mail: office@twinx.hu). A
          foglalási rendszer érintetlen; visszakapcsolás: <code>src/lib/booking-mode.ts</code> → <code>&quot;booking&quot;</code>.
        </p>
      )}
      {/* Fülek — fix méret */}
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--twx-line)" }}>
        {[
          { id: "visszahivas", label: `Visszahívás-kérések${openCallbacks ? ` (${openCallbacks})` : ""}`, href: "/admin/foglalasok?ful=visszahivas" },
          { id: "beerkezett", label: "Beérkezett foglalások", href: "/admin/foglalasok?ful=beerkezett" },
          { id: "idopontok", label: "Időpontok", href: "/admin/foglalasok?ful=idopontok" },
        ].map((t) => (
          <Link key={t.id} href={t.href} className="flex h-10 items-center border-b-2 px-4 text-sm"
            style={tab === t.id ? { borderColor: "var(--twx-coral)", fontWeight: 600 } : { borderColor: "transparent", color: "var(--twx-ink-muted)" }}>
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "visszahivas" ? <CallbackRequestsAdmin initial={callbacks} /> : tab === "idopontok" ? <BookingAvailabilityAdmin /> : <BookingInboxAdmin />}
    </AdminShell>
  );
}
