// API-önköltség becslés + logolás (admin-only api_cost_logs tábla).
// BŐVÍTHETŐ: új API/funkció = új sor a COST_USD configban + egy logCost hívás.
import { createAdminClient } from "@/lib/supabase/admin";

// Fix HUF<->USD árfolyam a profitmarzshoz (env-ből felülírható).
export const HUF_PER_USD = Number(process.env.HUF_PER_USD || 380);

// Becsült nyers önköltségek USD-ben (configból bármikor állítható).
export const COST_USD = {
  perplexity: {
    sonar: 0.01,
    "sonar-pro": 0.05,
    "sonar-reasoning-pro": 0.05,
    "sonar-deep-research": 0.5,
  } as Record<string, number>,
  googleImagePerImage: 0.04, // Google Studio / Nano Banana, per kép
  lumaPerClip: 0.3, // Luma Image-to-Video, per snitt (6.6)
  shotstackPerRender: 0.2, // Shotstack render (6.6)
};

export function perplexityCostUsd(model: string): number {
  return COST_USD.perplexity[model] ?? COST_USD.perplexity["sonar-pro"];
}

export function googleImageCostUsd(images: number): number {
  return images * COST_USD.googleImagePerImage;
}

export function lumaCostUsd(clips: number): number {
  return clips * COST_USD.lumaPerClip;
}

export function shotstackRenderCostUsd(renders = 1): number {
  return renders * COST_USD.shotstackPerRender;
}

export type CostLogEntry = {
  userId: string | null;
  serviceId: string | null;
  feature: string; // 'valuation' | 'visualization' | 'video' | ...
  serviceName: string; // 'perplexity' | 'google-studio' | 'luma' | 'shotstack' | ...
  units?: number;
  estimatedCostUsd: number;
};

// Best-effort: a költséglogolás SOHA ne bukhasson meg a fő folyamaton.
export async function logCost(entry: CostLogEntry): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("api_cost_logs").insert({
      user_id: entry.userId,
      service_id: entry.serviceId,
      feature: entry.feature,
      service_name: entry.serviceName,
      units: entry.units ?? 1,
      estimated_cost_usd: entry.estimatedCostUsd,
    });
  } catch (err) {
    console.error("Költséglogolás hiba:", (err as Error).message);
  }
}
