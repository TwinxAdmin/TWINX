// dashboard/custom — Privát B2B modulok.
// Útvonalvédelem: csak admin, VAGY akinek company_access-e van egy privát modulhoz.
// A hozzáférést az RLS (services_select_visible) érvényesíti: a sima felhasználó
// csak azokat a privát modulokat látja, amelyekhez van company_access rekordja.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PrivateService = { id: string; name: string; slug: string };

export default async function CustomModulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A /dashboard-ot a middleware már védi, de biztonságból itt is ellenőrzünk.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";

  // Privát modulok, amelyeket ez a felhasználó láthat (RLS szűri).
  const { data: services } = await supabase
    .from("services")
    .select("id, name, slug")
    .eq("status", "private");

  const list = (services ?? []) as PrivateService[];

  // Nincs jogosultság: se nem admin, se nincs elérhető privát modulja.
  if (!isAdmin && list.length === 0) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Egyedi B2B modulok</h1>
      <p className="text-sm text-gray-500">
        A számodra engedélyezett privát modulok. Hozzáférést az adminisztrátor ad
        (company_access).
      </p>

      {list.length === 0 ? (
        <div className="border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          Jelenleg nincs elérhető privát modul.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between border border-gray-200 p-3 text-sm"
            >
              <span>{s.name}</span>
              <span className="text-xs text-gray-400">{s.slug}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
