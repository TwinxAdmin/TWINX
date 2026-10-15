// POST /api/real-estate/floorplan-3d/projects/[id]/target — egy helyiség CÉLKÉPE (3. lépés, F3d; PROTOTÍPUS, csak admin).
// Body: { roomId, image: "data:image/jpeg;base64,...", view: { pos, target, eye, fov } } — a böngésző fotója a berendezetlen
// (de már japandi falú-padlójú) helyiségről. A szerver a Nano Bananával berendezi (stíluslap + referenciakép, geometria változatlan),
// mindkét képet a privát tárhelyre teszi, és a projekt furnishing[roomId].target mezőjébe menti. Aláírt linkekkel válaszol.
// GEOMETRIA-HŰSÉG: minden célképet összevetünk a berendezetlen fotóval (fidelity.ts); ha nem tartotta meg a szerkezetet, újra
// generáljuk (legfeljebb targetMaxAttempts), és a legjobbat tartjuk meg — ha egyik sem jó, „nem használható mércének" jelzéssel.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadStyleSheet } from "@/lib/floorplan3d/stylesheet";
import { FURNISHABLE_KINDS } from "@/lib/floorplan3d/builder";
import { itemList, makeTargetImage } from "@/lib/floorplan3d/target";
import { geometryFidelity, type Fidelity } from "@/lib/floorplan3d/fidelity";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";
import { livingRoomLayout, type FurnitureItem } from "@/lib/floorplan3d/furniture";
import { projectForFurnishing, saveFurnishing, signFurnishingImages, uploadProjectImage } from "@/lib/floorplan3d/projects";
import { googleImageCostUsd, logCost } from "@/lib/costs";

export const runtime = "nodejs";
export const maxDuration = 300; // több próbálkozás (mindegyik ~15 mp)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "A modul jelenleg prototípus — csak admin használhatja." }, { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ error: "Érvénytelen azonosító." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  const m = typeof body?.image === "string" ? body.image.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!m) return NextResponse.json({ error: "Hiányzó vagy hibás kép." }, { status: 422 });
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_IMAGE_BYTES) return NextResponse.json({ error: "A kép túl nagy." }, { status: 422 });
  const view = body?.view && typeof body.view === "object" ? body.view : null;

  const p = await projectForFurnishing(user.id, id);
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: p.status });
  if (p.status === "draft") return NextResponse.json({ error: "Előbb hagyd jóvá a tervet (3D bejárás indítása)." }, { status: 409 });
  const room = p.plan.rooms.find((r) => r.id === roomId);
  if (!room) return NextResponse.json({ error: "A helyiség nem található." }, { status: 404 });
  if (!(FURNISHABLE_KINDS as readonly string[]).includes(room.kind)) return NextResponse.json({ error: "A prototípusban egyelőre csak a nappali." }, { status: 422 });

  const style = await loadStyleSheet("japandi");
  if ("error" in style) return NextResponse.json({ error: style.error }, { status: 500 });

  try {
    const mime = m[1] === "png" ? "image/png" : "image/jpeg";
    const cfg = floorplan3dConfig();
    // a tárgylista: az építő mentett berendezése, ha van; különben a szabályalapú alap-elrendezés
    const saved = (p.furnishing?.[room.id] as { items?: FurnitureItem[] } | undefined)?.items;
    const items = itemList(saved?.length ? saved : livingRoomLayout(p.plan, room).items);
    let best: { img: Awaited<ReturnType<typeof makeTargetImage>>; fid: Fidelity } | null = null;
    const tries: Fidelity[] = [];
    for (let i = 0; i < cfg.targetMaxAttempts; i++) {
      const img = await makeTargetImage(room, style.sheet, style.text, { bytes: new Uint8Array(bytes), mimeType: mime }, items);
      const fid = await geometryFidelity(new Uint8Array(bytes), new Uint8Array(img.bytes), cfg.fidelityMinKept, cfg.fidelityMaxAdded);
      tries.push(fid);
      if (!best || fid.kept - fid.added > best.fid.kept - best.fid.added) best = { img, fid };
      if (fid.ok) break;
    }
    const target = best!.img;
    await logCost({ userId: user.id, serviceId: null, feature: "floorplan-3d-target", serviceName: "google-studio", units: tries.length, estimatedCostUsd: googleImageCostUsd(tries.length) });
    const stamp = Date.now();
    const ext = target.mimeType === "image/jpeg" ? "jpg" : "png";
    const up1 = await uploadProjectImage(user.id, id, `rooms/${room.id}/empty-${stamp}.${m[1] === "png" ? "png" : "jpg"}`, bytes, mime);
    const up2 = await uploadProjectImage(user.id, id, `rooms/${room.id}/target-${stamp}.${ext}`, target.bytes, target.mimeType);
    if ("error" in up1 || "error" in up2) return NextResponse.json({ error: `A képek mentése nem sikerült: ${"error" in up1 ? up1.error : (up2 as { error: string }).error}` }, { status: 500 });
    const record = {
      empty_path: up1.path, target_path: up2.path, view, seconds: target.seconds, used_reference: target.usedReference,
      cost_usd: googleImageCostUsd(tries.length), attempts: tries, fidelity: best!.fid, usable: best!.fid.ok, items,
      plan_revision: p.revision, created_at: new Date().toISOString(),
    };
    const saveError = await saveFurnishing(user.id, id, room.id, { target: record });
    const images = await signFurnishingImages({ [room.id]: { target: record } });
    return NextResponse.json({ roomId: room.id, target: record, images: images[room.id] ?? {}, saveError });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "A célkép nem készült el." }, { status: 500 });
  }
}
