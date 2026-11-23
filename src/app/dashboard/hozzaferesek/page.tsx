// /dashboard/hozzaferesek — a cégvezető „Hozzáférések" ablaka (terv 13). Csak a cégvezető látja a saját cégét;
// a jogot minden műveletnél a szerver (DB-függvény) ellenőrzi.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccessWindow from "@/components/company/AccessWindow";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <main className="space-y-5">
      <header>
        <p className="font-display text-xs font-semibold uppercase" style={{ color: "#b4553a", letterSpacing: "0.2em" }}>Cégvezető</p>
        <h1 className="font-display mt-2 text-3xl font-semibold">Hozzáférések</h1>
      </header>
      <AccessWindow meId={user.id} />
    </main>
  );
}
