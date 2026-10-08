// dashboard/iroda/fiokok — „Irodai fiókjaim": melyik irodai fiókba lépjek be (ha több irodának tagja vagyok).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ModuleIntro from "@/components/ModuleIntro";
import OfficeChooser from "@/components/office/OfficeChooser";
import { getWorkContext, listMyOffices } from "@/lib/office-server";

export default async function OfficeListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const offices = await listMyOffices(user.id).catch(() => []);
  const ctx = await getWorkContext(user.id).catch(() => ({ officeId: null, useOffice: false }));
  const selectedId = offices.find((o) => o.id === ctx.officeId)?.id ?? offices[0]?.id ?? null;

  return (
    <main className="space-y-6">
      <ModuleIntro
        eyebrow="Irodai TWINX fiók"
        title="Irodai fiókjaim"
        subtitle="Válaszd ki, melyik irodai fiókba lépsz be. Az irodai munka és a kreditkeret mindig a kiválasztott irodához tartozik."
        icon="office"
      />
      <OfficeChooser offices={offices} selectedId={selectedId} />
    </main>
  );
}
