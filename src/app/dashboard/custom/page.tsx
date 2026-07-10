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

  // Privát modulok, amelyeket ez a felhasználó láthat (RLS szűri).
  const { data: services } = await supabase
    .from("services")
    .select("id, name, slug")
    .eq("status", "private");

  const list = (services ?? []) as PrivateService[];

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-3xl font-semibold">Egyedi B2B modulok</h1>
      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        A számodra engedélyezett privát modulok. Hozzáférést az adminisztrátor ad
        (company_access).
      </p>

      {list.length === 0 ? (
        <div className="rounded-xl p-4 text-sm" style={{ border: "1px dashed var(--twx-line)", color: "var(--twx-ink-muted)" }}>
          Még nincs számodra fejlesztett egyedi modul. Ha szeretnél egyet, a felső sávban az
          „Egyedi modulok → Egyedi modul igénylése" ponton keresztül tudsz árajánlatot kérni.
        </div>
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li
              key={s.id}
              className="twx-card flex items-center justify-between p-3 text-sm"
            >
              <span>{s.name}</span>
              <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{s.slug}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
