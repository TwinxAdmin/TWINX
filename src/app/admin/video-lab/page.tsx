// /admin/video-lab — VIDEÓLABOR: a saját TWINX videómotor próbapadja (CSAK admin).
// Élesben (production) a labor zárva, hacsak a VIDEO_LAB_ENABLED=1 be nem kapcsolja.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import VideoLab from "@/components/admin/VideoLab";
import { MUSIC_STYLES } from "@/lib/video";
import { AURORA_VARIANTS } from "@/lib/video-engine/templates/aurora";

export const runtime = "nodejs";

export default async function VideoLabPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const enabled = process.env.NODE_ENV !== "production" || process.env.VIDEO_LAB_ENABLED === "1";
  const { data: profiles } = await supabase
    .from("branding_profiles")
    .select("id, label, display_name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <AdminShell title="Videólabor" subtitle="A saját TWINX videómotor próbapadja — kredit és partner-előzmény nélkül.">
      {enabled ? (
        <VideoLab
          variants={[{ id: "aurora", name: "TWINX Aurora" }, ...AURORA_VARIANTS.map((v) => ({ id: v.id, name: v.name }))]}
          musicStyles={MUSIC_STYLES}
          profiles={(profiles ?? []).map((p) => ({ id: p.id as string, label: (p.label || p.display_name || "Arculat") as string }))}
        />
      ) : (
        <div className="rounded-2xl p-5 text-sm" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
          A Videólabor csak fejlesztői környezetben (localhoston) érhető el.
        </div>
      )}
    </AdminShell>
  );
}
