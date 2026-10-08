// dashboard/iroda/igenyles — irodai fiók igénylése a TWINX-től (admin hagyja jóvá).
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
        title="Irodai fiók igénylése"
        subtitle="Add meg az iroda nevét és a létszámot. Jóváhagyás után megnyithatod az irodai fiókot, és kóddal hívhatod meg a kollégákat."
        icon="office"
      />
      <OfficeRequestFlow />
    </main>
  );
}
