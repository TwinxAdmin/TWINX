// POST /api/real-estate/floorplan-3d/projects/[id]/quality — a MINŐSÉGI CIKLUS egy köre (3. lépés, F3e; PROTOTÍPUS, csak admin).
// Body: { roomId, round (1-től), image: a BERENDEZETT helyiség fotója a célkép nézőpontjából (data URL) }.
// 1) kritikus (friss kontextus): a kód méri a geometriát, a modell a stílust (célkép + stíluslap ellenőrzőlista) → pontszám, legnagyobb hiányosság;
// 2) ha nincs kész és van még kör (maxQualityRounds): az építő a kritikus utasításával (+ a célképpel) javít → új bútorlista;
// 3) mentés: furnishing[roomId].quality.rounds (+ a végén: kész-e, mi nem valósult meg). A böngésző újraépít és hívja a következő kört.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadStyleSheet } from "@/lib/floorplan3d/stylesheet";
import { FURNISHABLE_KINDS, furnishRoom } from "@/lib/floorplan3d/builder";
import { runCritic } from "@/lib/floorplan3d/critic";
import { roomViewpoint, type RoomView } from "@/lib/floorplan3d/camera";
import { wallMapText } from "@/lib/floorplan3d/wallmap";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";
import { livingRoomLayout, type FurnitureItem } from "@/lib/floorplan3d/furniture";
import { downloadProjectFile, projectForFurnishing, saveFurnishing, uploadProjectImage } from "@/lib/floorplan3d/projects";
import { logCost } from "@/lib/costs";

export const runtime = "nodejs";
export const maxDuration = 300; // kritikus (~30–60 mp) + építő (~60 mp)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Round = Record<string, unknown>;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "A Prémium 3D hamarosan érkezik — a modul még fejlesztés alatt áll." }, { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ error: "Érvénytelen azonosító." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  const round = Number.isInteger(body?.round) && body.round >= 1 ? (body.round as number) : 1;
  const m = typeof body?.image === "string" ? body.image.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!m) return NextResponse.json({ error: "Hiányzó vagy hibás kép." }, { status: 422 });
  const furnished = { bytes: new Uint8Array(Buffer.from(m[2], "base64")), mimeType: m[1] === "png" ? "image/png" : "image/jpeg" };

  const p = await projectForFurnishing(user.id, id);
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: p.status });
  if (p.status === "draft") return NextResponse.json({ error: "Előbb hagyd jóvá a tervet." }, { status: 409 });
  const room = p.plan.rooms.find((r) => r.id === roomId);
  if (!room || !(FURNISHABLE_KINDS as readonly string[]).includes(room.kind)) return NextResponse.json({ error: "A prototípusban csak a nappali." }, { status: 422 });
  const style = await loadStyleSheet("japandi");
  if ("error" in style) return NextResponse.json({ error: style.error }, { status: 500 });

  const cfg = floorplan3dConfig();
  const saved = (p.furnishing?.[room.id] ?? {}) as { items?: FurnitureItem[]; target?: { target_path?: string; usable?: boolean; view?: RoomView }; quality?: { rounds?: Round[] } };
  const items = saved.items?.length ? saved.items : livingRoomLayout(p.plan, room).items;
  // csak geometriailag hű célkép lehet mérce (F3d) — különben a stíluslap az egyetlen mérce
  const target = saved.target?.target_path && saved.target.usable ? await downloadProjectFile(saved.target.target_path) : null;

  try {
    // a falkiosztás a célkép nézőpontjából (ugyanebből készül a berendezett fotó is) — ez köti össze a kép és az alaprajz irányait
    const wallMap = wallMapText(room, saved.target?.view ?? roomViewpoint(p.plan, room));
    const critic = await runCritic({ plan: p.plan, room, items, styleText: style.text, furnished, target, wallMap });
    let costUsd = critic.costUsd;
    const shot = await uploadProjectImage(user.id, id, `rooms/${room.id}/round-${round}-${Date.now()}.jpg`, furnished.bytes, furnished.mimeType);
    const next = !critic.done && round < cfg.maxQualityRounds;

    let newItems: FurnitureItem[] | null = null;
    let builder: Record<string, unknown> | null = null;
    if (next) {
      const instruction = critic.instruction || critic.biggestIssue;
      const geoFix = critic.geometry.ok ? "" : ` Also fix these validator problems: ${critic.geometry.problems.join("; ")}`;
      const b = await furnishRoom(p.plan, room, style.text, { start: items, critic: instruction + geoFix, target, wallMap });
      costUsd += b.costUsd;
      newItems = b.items;
      builder = { source: b.source, seconds: b.seconds, cost_usd: b.costUsd, rationale: b.rationale };
    }
    await logCost({ userId: user.id, serviceId: null, feature: "floorplan-3d-quality", serviceName: "google-studio", units: 1, estimatedCostUsd: costUsd });

    const record: Round = {
      round, score: critic.score, geometry: critic.geometry, checklist: critic.checklist, biggest_issue: critic.biggestIssue,
      instruction: critic.instruction, image_path: "path" in shot ? shot.path : null, critic_seconds: critic.seconds, cost_usd: costUsd, builder,
      used_target: !!target,
    };
    const rounds = [...(round === 1 ? [] : saved.quality?.rounds ?? []), record];
    const final = next ? null : {
      done: critic.done, rounds: rounds.length,
      unmet: [...(critic.geometry.ok ? [] : critic.geometry.problems), ...critic.checklist.filter((c) => !c.pass).map((c) => `${c.item} — ${c.note}`)],
    };
    const saveError = await saveFurnishing(user.id, id, room.id, {
      ...(newItems ? { items: newItems, source: "quality", rationale: String(builder?.rationale ?? "") } : {}),
      quality: { rounds, final, max_rounds: cfg.maxQualityRounds },
    });
    return NextResponse.json({ round, critic, next, items: newItems, final, saveError });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "A minőségi kör nem sikerült." }, { status: 500 });
  }
}
