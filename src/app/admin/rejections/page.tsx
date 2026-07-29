// /admin/rejections — "Nem elfogadott" képek: amikor a partner ingyenes újragenerálást
// kért. Itt látszik az eredeti, a visszautasított és az újragenerált kép + az indok.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enhanceModeLabel } from "@/lib/image-enhance";
import AdminShell from "@/components/admin/AdminShell";

export const runtime = "nodejs";

export default async function AdminRejectionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("enhance_rejections")
    .select("id, user_id, mode, original_url, rejected_url, replacement_url, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  // Felhasználó-nevek a listához
  const ids = [...new Set((rows ?? []).map((r) => r.user_id as string))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
  const nameOf = (id: string) => {
    const p = (profiles ?? []).find((x) => x.id === id);
    return p?.full_name || p?.email || id.slice(0, 8);
  };

  return (
    <AdminShell
      title="Admin — Nem elfogadott képek"
      subtitle="A partnerek által nem elfogadott képek — minőségi visszajelzés."
    >
      {(rows ?? []).length === 0 ? (
          <div className="twx-card p-6 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Még nincs elutasított generálás.
          </div>
        ) : (
          <div className="space-y-4">
            {(rows ?? []).map((r) => (
              <div key={r.id} className="twx-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">
                    {enhanceModeLabel(r.mode as string)} · {nameOf(r.user_id as string)}
                  </div>
                  <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {new Date(r.created_at as string).toLocaleString("hu-HU")}
                  </div>
                </div>

                {r.reason && (
                  <p className="mb-3 rounded-lg p-2 text-sm" style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                    <strong>Indok:</strong> {r.reason as string}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {([
                    ["Eredeti", r.original_url],
                    ["Nem elfogadott", r.rejected_url],
                    ["Újragenerált", r.replacement_url],
                  ] as const).map(([label, url]) => (
                    <figure key={label} className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url as string} alt={label} className="aspect-[4/3] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center text-xs" style={{ color: "var(--twx-ink-muted)" }}>—</div>
                      )}
                      <figcaption className="px-2 py-1.5 text-[11px] font-medium" style={{ color: "var(--twx-ink-muted)" }}>{label}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
    </AdminShell>
  );
}
