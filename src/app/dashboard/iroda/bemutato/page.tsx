// /dashboard/iroda/bemutato — „Mi az irodai fiók?" részletes ismertető (a felső TWINX menüsor megmarad).
// Az ismertető a kredites irodai modellt mutatja be, ezért az ÚJ felületen (3d-3) az Irodai fiók oldalra visz,
// ahol a közös tér rövid bemutatása áll.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import OfficeShowcase from "@/components/office/OfficeShowcase";
import { createClient } from "@/lib/supabase/server";
import { resolveViewContext } from "@/lib/view-as";
import { newUiFor } from "@/lib/new-ui";

export const metadata: Metadata = { title: "Mi az irodai fiók? — TWINX" };

export default async function OfficeInfoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role").eq("id", user.id).single() : { data: null };
  const view = await resolveViewContext(me?.role as string | undefined);
  if (await newUiFor(view.role)) redirect("/dashboard/iroda");
  return <OfficeShowcase />;
}
