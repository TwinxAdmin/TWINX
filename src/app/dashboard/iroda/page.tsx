// dashboard/iroda — Irodai TWINX fiók felülete (a kiválasztott irodára).
//   • létrehozó / vezető: vezetői nézet (OfficeManagerView)
//   • kolléga: kolléga-nézet; ha még nem tag: üres állapot (csatlakozás / igénylés)
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OfficeHub from "@/components/office/OfficeHub";

export default async function OfficePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="space-y-6">
      <OfficeHub />
    </main>
  );
}
