// Verziózott AI-promptok kezelése.
// - A VÁLTOZÓ-blokk (adat-behelyettesítés) zárolt, kódból jön (lásd az adott modul lib-je).
// - Az admin csak a "finomítható" szegmenseket (pl. intro/task) szerkesztheti; ezek
//   verziózva mentődnek az ai_prompts táblába. Ha nincs aktív verzió, a kód-alapértelmezett
//   szövegekkel dolgozik a rendszer — így korábbi prompt sosem veszik el.
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LAND_DEFAULT_SEGMENTS,
  LAND_DATA_BLOCK_PREVIEW,
  composeLandPrompt,
  type LandInput,
} from "@/lib/land";
import {
  VALUATION_DEFAULT_SEGMENTS,
  VALUATION_DATA_BLOCK_PREVIEW,
  composeValuationPrompt,
  type ValuationInput,
} from "@/lib/valuation";
import {
  VISUALIZATION_DEFAULT_SEGMENTS,
  VISUALIZATION_DATA_BLOCK_PREVIEW,
  composeRoomPrompt,
  type RoomConfig,
} from "@/lib/visualization";
import {
  FLYER_DEFAULT_SEGMENTS,
  FLYER_DATA_BLOCK_PREVIEW,
  composeFlyerCopyPrompt,
  type FlyerFacts,
} from "@/lib/flyer";
import { VIDEO_DEFAULT_PROMPT } from "@/lib/luma";

export type PromptSegments = Record<string, string>;

export type SegmentDef = {
  id: string;
  label: string;
  hint?: string;
  default: string;
};

export type PromptModuleDef = {
  key: string; // pl. "land"
  label: string; // felhasználóbarát név
  segments: SegmentDef[]; // finomítható szegmensek, megjelenítési sorrendben
  dataBlockPreview: string; // zárolt adat-blokk előnézete (csak olvasható)
  dataBlockAfter: string; // melyik szegmens UTÁN jelenik meg a zárolt blokk
};

// --- Modul-registry (admin UI + validáció) ---------------------------------
export const PROMPT_MODULES: PromptModuleDef[] = [
  {
    key: "land",
    label: "Telek ellenőrzés",
    dataBlockPreview: LAND_DATA_BLOCK_PREVIEW,
    dataBlockAfter: "intro",
    segments: [
      {
        id: "intro",
        label: "Bevezető / szerep",
        hint: "A modell szerepe és a feladat rövid kerete. Változó nem használható.",
        default: LAND_DEFAULT_SEGMENTS.intro,
      },
      {
        id: "task",
        label: "Feladat / kimenet",
        hint: "A vizsgálandó pontok és a kimenet formája. Változó nem használható.",
        default: LAND_DEFAULT_SEGMENTS.task,
      },
    ],
  },
  {
    key: "valuation",
    label: "Ingatlan értékbecslés",
    dataBlockPreview: VALUATION_DATA_BLOCK_PREVIEW,
    dataBlockAfter: "intro",
    segments: [
      {
        id: "intro",
        label: "Bevezető / szerep + keresési szabályok",
        hint: "A szakértői szerep és a háttér-kutatási instrukciók. Változó nem használható.",
        default: VALUATION_DEFAULT_SEGMENTS.intro,
      },
      {
        id: "task",
        label: "Kimeneti struktúra",
        hint: "A jelentés pontjai és formátuma. Változó nem használható.",
        default: VALUATION_DEFAULT_SEGMENTS.task,
      },
    ],
  },
  {
    key: "visualization",
    label: "Látványtervező (kép)",
    dataBlockPreview: VISUALIZATION_DATA_BLOCK_PREVIEW,
    dataBlockAfter: "intro",
    segments: [
      {
        id: "intro",
        label: "Szerep + architektúra-megkötések (angol)",
        hint: "A képgeneráló szerepe és a „ne változtass a szerkezeten” szabályok. Változó nem használható.",
        default: VISUALIZATION_DEFAULT_SEGMENTS.intro,
      },
      {
        id: "negative",
        label: "Tiltott elemek (negatív prompt, angol)",
        hint: "Amit a modellnek kerülnie kell. Változó nem használható.",
        default: VISUALIZATION_DEFAULT_SEGMENTS.negative,
      },
    ],
  },
  {
    key: "flyer",
    label: "Hirdetéskészítő (AI szöveg)",
    dataBlockPreview: FLYER_DATA_BLOCK_PREVIEW,
    dataBlockAfter: "intro",
    segments: [
      {
        id: "intro",
        label: "Bevezető / szerep",
        hint: "A szövegíró szerepe és az alapszabályok. Változó nem használható.",
        default: FLYER_DEFAULT_SEGMENTS.intro,
      },
      {
        id: "task",
        label: "Kimeneti forma (JSON)",
        hint: "A kért JSON-kulcsok. A JSON kapcsos zárójelei megengedettek, de {szó} alakú változó nem.",
        default: FLYER_DEFAULT_SEGMENTS.task,
      },
    ],
  },
  {
    key: "video",
    label: "Videó (mozgás-prompt)",
    dataBlockPreview: "",
    dataBlockAfter: "",
    segments: [
      {
        id: "prompt",
        label: "Videó mozgás-prompt (angol)",
        hint: "A kameramozgás / hangulat leírása a Luma modellnek. Nincs zárolt változó.",
        default: VIDEO_DEFAULT_PROMPT,
      },
    ],
  },
];

export function getModuleDef(module: string): PromptModuleDef | undefined {
  return PROMPT_MODULES.find((m) => m.key === module);
}

// --- Változó-védelem: a finomítható szövegben NEM lehet behelyettesítő token -
// Tilos: {valami}, {{valami}}, ${valami}. Így a változók helye zárolt marad.
const TOKEN_RE = /\{\{?\s*[\w.]+\s*\}?\}|\$\{[^}]*\}/;

export function findForbiddenTokens(text: string): string[] {
  const found = new Set<string>();
  const re = /\{\{?\s*[\w.]+\s*\}?\}|\$\{[^}]*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) found.add(m[0]);
  return [...found];
}

export type SegmentValidation = { valid: boolean; errors: Record<string, string> };

export function validateSegments(module: string, segments: PromptSegments): SegmentValidation {
  const def = getModuleDef(module);
  const errors: Record<string, string> = {};
  if (!def) return { valid: false, errors: { _: "Ismeretlen modul." } };

  for (const seg of def.segments) {
    const val = (segments[seg.id] ?? "").trim();
    if (!val) {
      errors[seg.id] = "Nem lehet üres.";
      continue;
    }
    if (TOKEN_RE.test(val)) {
      const toks = findForbiddenTokens(val).join(", ");
      errors[seg.id] = `Változó/behelyettesítő nem engedélyezett itt: ${toks}. A változók helye zárolt.`;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

// --- Aktív szegmensek beolvasása (fallback: kód-alapértelmezett) ------------
export async function getActiveSegments(module: string): Promise<PromptSegments> {
  const def = getModuleDef(module);
  const base: PromptSegments = {};
  for (const seg of def?.segments ?? []) base[seg.id] = seg.default;

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("ai_prompts")
      .select("segments")
      .eq("module", module)
      .eq("is_active", true)
      .maybeSingle();
    const active = (data?.segments ?? null) as PromptSegments | null;
    if (active) {
      // Csak a definiált szegmenseket vesszük át; a hiányzót az alap adja.
      for (const seg of def?.segments ?? []) {
        if (typeof active[seg.id] === "string" && active[seg.id].trim()) {
          base[seg.id] = active[seg.id];
        }
      }
    }
  } catch {
    // DB hiba esetén marad a kód-alapértelmezett — a szolgáltatás nem áll le.
  }
  return base;
}

// --- Végső prompt összeállítása modulonként (az aktív verzióval) ------------
export async function buildLandPromptActive(input: LandInput): Promise<string> {
  const segments = await getActiveSegments("land");
  return composeLandPrompt(input, segments);
}

export async function buildValuationPromptActive(input: ValuationInput): Promise<string> {
  const segments = await getActiveSegments("valuation");
  return composeValuationPrompt(input, segments);
}

export async function buildRoomPromptActive(
  config: RoomConfig
): Promise<{ prompt: string; useReference: boolean }> {
  const segments = await getActiveSegments("visualization");
  return composeRoomPrompt(config, segments);
}

export async function buildFlyerCopyPromptActive(
  facts: Partial<FlyerFacts>,
  toneDesc: string
): Promise<string> {
  const segments = await getActiveSegments("flyer");
  return composeFlyerCopyPrompt(facts, toneDesc, segments);
}

export async function getVideoPromptActive(): Promise<string> {
  const segments = await getActiveSegments("video");
  return (segments.prompt ?? VIDEO_DEFAULT_PROMPT).trim();
}

// --- Verziók kezelése (admin) ----------------------------------------------
export type PromptVersion = {
  id: string;
  module: string;
  version: number;
  name: string | null;
  segments: PromptSegments;
  is_active: boolean;
  created_at: string;
};

export async function listPromptVersions(module: string): Promise<PromptVersion[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_prompts")
    .select("id, module, version, name, segments, is_active, created_at")
    .eq("module", module)
    .order("version", { ascending: false });
  return (data ?? []) as PromptVersion[];
}

// Új verzió mentése + aktiválás. A hívó előbb validál (validateSegments).
export async function saveNewVersion(params: {
  module: string;
  segments: PromptSegments;
  name?: string | null;
  createdBy?: string | null;
}): Promise<{ id: string; version: number }> {
  const admin = createAdminClient();

  // Következő verziószám a modulon belül.
  const { data: last } = await admin
    .from("ai_prompts")
    .select("version")
    .eq("module", params.module)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((last?.version as number) ?? 0) + 1;

  // Csak a definiált szegmenseket mentjük.
  const def = getModuleDef(params.module);
  const clean: PromptSegments = {};
  for (const seg of def?.segments ?? []) {
    clean[seg.id] = (params.segments[seg.id] ?? "").trim();
  }

  // Előbb a modul összes aktív sorát inaktiváljuk (egy aktív / modul).
  await admin.from("ai_prompts").update({ is_active: false }).eq("module", params.module);

  const { data, error } = await admin
    .from("ai_prompts")
    .insert({
      module: params.module,
      version: nextVersion,
      name: params.name ?? null,
      segments: clean,
      is_active: true,
      created_by: params.createdBy ?? null,
    })
    .select("id, version")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, version: data.version as number };
}

// Egy korábbi verzió újraaktiválása (a többi inaktiválása).
export async function activateVersion(module: string, id: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("ai_prompts").update({ is_active: false }).eq("module", module);
  const { error } = await admin
    .from("ai_prompts")
    .update({ is_active: true })
    .eq("id", id)
    .eq("module", module);
  if (error) throw new Error(error.message);
}

// Vissza a kód-alapértelmezetthez: minden verzió inaktiválása a modulon.
export async function resetToDefault(module: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("ai_prompts").update({ is_active: false }).eq("module", module);
}
