// dashboard/iroda — Irodai TWINX fiók: magyarázó + igénylés (vezetőknek) + csatlakozás kóddal.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ModuleIntro from "@/components/ModuleIntro";
import OfficeHub from "@/components/office/OfficeHub";

export default async function OfficePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="space-y-6">
      <ModuleIntro
        eyebrow="Irodai TWINX fiók"
        title="Egy iroda, egy közös kreditkeret"
        subtitle="A vezető egyszer vásárol, a kollégák pedig az irodai keretből dolgoznak — nem kell mindenkinek külön kreditet vennie. A saját kreditjeid közben megmaradnak."
        icon="office"
        chips={["Közös irodai egyenleg", "Keret kollégánként", "Csatlakozás kóddal", "Tudatos megosztás"]}
      />
      <OfficeHub />
    </main>
  );
}
