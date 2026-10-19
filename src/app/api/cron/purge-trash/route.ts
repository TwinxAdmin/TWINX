// GET /api/cron/purge-trash — NAPI ütemezett takarítás (Vercel Cron, vercel.json): a lomtárban WORKS_TRASH_DAYS
// napnál (alap 30) régebben lévő munkák végleges törlése, fájlokkal együtt. Saját Next.js route — nincs külső
// automatizáció. Védelem: a Vercel a CRON_SECRET-et „Authorization: Bearer …" fejlécben küldi; enélkül 401.
import { NextResponse } from "next/server";
import { purgeExpired, TRASH_DAYS } from "@/lib/works-trash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nincs jogosultság." }, { status: 401 });
  }
  try {
    const s = await purgeExpired();
    const failed = s.results.filter((r) => !r.ok);
    if (failed.length) console.error("[purge-trash] sikertelen:", JSON.stringify(failed.slice(0, 20)));
    return NextResponse.json({
      days: TRASH_DAYS, scanned: s.scanned, deleted: s.results.length - failed.length, failed: failed.length,
      filesDeleted: s.filesDeleted, filesKept: s.filesKept, bytesFreed: s.bytesFreed,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
