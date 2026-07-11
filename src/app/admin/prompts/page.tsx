// /admin/prompts — AI-promptok finomítása és verziózása (CSAK admin).
// A változó-blokk zárolt (kódból jön); az admin csak a szegmenseket szerkeszti.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PROMPT_MODULES,
  getModuleDef,
  getActiveSegments,
  listPromptVersions,
} from "@/lib/prompts";
import PromptEditor from "@/components/PromptEditor";

export const runtime = "nodejs";

export default async function AdminPromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const moduleKey = getModuleDef(sp.module ?? "") ? (sp.module as string) : PROMPT_MODULES[0].key;
  const def = getModuleDef(moduleKey)!;

  const activeSegments = await getActiveSegments(moduleKey);
  const versions = await listPromptVersions(moduleKey);
  const hasActiveVersion = versions.some((v) => v.is_active);

  return (
    <main className="twx-page font-sans">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold">Admin — AI-promptok</h1>
          <nav className="flex gap-3 text-sm" style={{ color: "var(--twx-coral)" }}>
            <a href="/admin/analytics">Költségek</a>
            <a href="/admin/ideas">Ötletek</a>
            <a href="/dashboard">Dashboard</a>
          </nav>
        </div>

        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          A promptok <strong>változó-blokkja zárolt</strong> (a rendszer illeszti be a felhasználói
          adatokat) — az itt szerkeszthető szövegekben változó nem használható. Minden mentés új
          verziót hoz létre; a korábbiak megmaradnak és bármikor visszaállíthatók.
        </p>

        {/* Modulválasztó */}
        {PROMPT_MODULES.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {PROMPT_MODULES.map((m) => {
              const on = m.key === moduleKey;
              return (
                <a
                  key={m.key}
                  href={`?module=${m.key}`}
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  style={
                    on
                      ? { background: "var(--twx-coral)", color: "#1c1005" }
                      : { border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", color: "var(--twx-ink)" }
                  }
                >
                  {m.label}
                </a>
              );
            })}
          </div>
        )}

        <PromptEditor
          moduleKey={def.key}
          moduleLabel={def.label}
          segmentDefs={def.segments.map((s) => ({ id: s.id, label: s.label, hint: s.hint }))}
          dataBlockPreview={def.dataBlockPreview}
          dataBlockAfter={def.dataBlockAfter}
          activeSegments={activeSegments}
          usingDefault={!hasActiveVersion}
          versions={versions.map((v) => ({
            id: v.id,
            version: v.version,
            name: v.name,
            is_active: v.is_active,
            created_at: v.created_at,
            segments: v.segments,
          }))}
        />
      </div>
    </main>
  );
}
