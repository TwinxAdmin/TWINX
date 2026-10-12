// dashboard/iroda/igenyles — irodai fiók létrehozása: vezetős iroda (igénylés, admin hagyja jóvá)
// vagy közös munkatér (azonnal létrejön).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ModuleIntro from "@/components/ModuleIntro";
import OfficeRequestFlow from "@/components/office/OfficeRequestFlow";

export default async function OfficeRequestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="space-y-6">
      <ModuleIntro
        eyebrow="Irodai TWINX fiók"
        title="Irodai fiók létrehozása"
        subtitle="Vezetős iroda közös kerettel (jóváhagyás után nyitható) — vagy közös munkatér egyenrangú társaknak, ami azonnal létrejön. A kollégákat mindkettőnél egy kóddal hívod meg."
        icon="office"
      />
      <OfficeRequestFlow />
    </main>
  );
}
