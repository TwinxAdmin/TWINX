// admin/layout.tsx — az admin oldalak közös kerete.
//
// Egyetlen feladata: ha épp BE VAN kapcsolva a partner-előnézet, itt is látszódjon
// a nézet-váltó sáv. Enélkül az admin bejönne az admin felületre, elfelejtené, hogy
// előnézetben hagyta a dashboardot, és később nem értené, miért „hiányzik" a menü.
//
// A jogosultság-ellenőrzés NEM itt van: azt továbbra is minden admin oldal maga
// végzi az adatbázisból olvasott VALÓDI szerepkörrel.
import { createClient } from "@/lib/supabase/server";
import ViewAsBar from "@/components/ViewAsBar";
import { resolveViewContext } from "@/lib/view-as";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const view = await resolveViewContext(me?.role as string | undefined);

  return (
    <>
      {children}
      {view.previewing && <ViewAsBar current={view.role as "user" | "sales"} />}
    </>
  );
}
