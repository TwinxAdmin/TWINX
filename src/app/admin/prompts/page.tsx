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
import ModuleSelect from "@/components/ModuleSelect";
import AdminShell from "@/components/admin/AdminShell";

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
    <AdminShell
      title="Admin — AI-promptok"
      subtitle="Az AI-modulok promptjai modulonként szerkeszthetők."
    >
      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        A promptok <strong>változó-blokkja zárolt</strong> (a rendszer illeszti be a felhasználói
        adatokat) — az itt szerkeszthető szövegekben változó nem használható. Minden mentés új
        verziót hoz létre; a korábbiak megmaradnak és bármikor visszaállíthatók.
      </p>

      {/* Modulválasztó legördülő — csak a kiválasztott modul látszik */}
      <ModuleSelect
        modules={PROMPT_MODULES.map((m) => ({ key: m.key, label: m.label }))}
        value={moduleKey}
      />

      <PromptEditor
        key={def.key}
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
    </AdminShell>
  );
}
