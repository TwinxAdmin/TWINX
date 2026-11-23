// /dashboard/m/proba-modul — belső próba modul (module-registry: „proba-modul"). Csak azt mutatja, hogy a
// hozzáférés működik: aki eléri (user_has_module_access, vagy admin), az a „Működik" kártyát látja.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userCanUseModule } from "@/lib/custom-modules";
import { MODULE_UNAVAILABLE_TEXT } from "@/components/ModuleGate";
import RunButton from "./RunButton";

export const dynamic = "force-dynamic";

export default async function ProbaModulPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const ok = await userCanUseModule(user.id, "proba-modul");
  return (
    <main className="twx-card mx-auto mt-6 flex min-h-[260px] max-w-xl flex-col items-center justify-center gap-3 p-8 text-center">
      {ok ? (
        <>
          <p className="font-display text-2xl font-semibold">Próba modul</p>
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Működik: a hozzáférésed érvényes. Ez egy belső teszt modul, nem tárol adatot.</p>
          <RunButton />
        </>
      ) : (
        <>
          <p className="font-display text-xl font-semibold">Ez a modul most nem érhető el</p>
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>{MODULE_UNAVAILABLE_TEXT}</p>
        </>
      )}
    </main>
  );
}
