// /admin/video-lab — VIDEÓLABOR (CSAK admin): a videómotor kapcsolója (saját TWINX motor /
// Shotstack-tartalék) + próbavideók kredit és partner-előzmény nélkül. Élesben is elérhető.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import VideoLab from "@/components/admin/VideoLab";
import type { BrandingProfile } from "@/lib/branding";

export const runtime = "nodejs";

export default async function VideoLabPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data: profiles } = await supabase
    .from("branding_profiles")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <AdminShell title="Videólabor" subtitle="Melyik motor készítse a videókat + próbavideók kredit és partner-előzmény nélkül.">
      <VideoLab profiles={(profiles ?? []) as BrandingProfile[]} />
    </AdminShell>
  );
}
