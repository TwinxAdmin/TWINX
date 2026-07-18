// /api/hospitality/sales — eladás-napló (rögzített eladott adagok). Ingyenes.
// GET: a saját rögzített eladások (minden időszak). POST: egy időszak/nap adatainak
// mentése (a régi sorokat az adott (start,end)-re felülírja: delete + insert).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("dish_sales")
    .select("dish_id, period_start, period_end, qty")
    .order("period_start", { ascending: false })
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sales: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const start = String(body.start ?? "").trim();
  const end = String(body.end ?? "").trim();
  if (!isDate(start) || !isDate(end)) return NextResponse.json({ error: "Hibás dátum." }, { status: 422 });
  if (new Date(end).getTime() < new Date(start).getTime()) {
    return NextResponse.json({ error: "A záró dátum nem lehet korábbi az indulónál." }, { status: 422 });
  }

  const rows = Array.isArray(body.entries)
    ? (body.entries as unknown[])
        .map((e) => {
          const o = (e ?? {}) as Record<string, unknown>;
          return {
            user_id: user.id,
            dish_id: String(o.dish_id ?? "").trim(),
            period_start: start,
            period_end: end,
            qty: Math.max(0, Math.floor(Number(o.qty) || 0)),
          };
        })
        .filter((r) => r.dish_id && r.qty > 0)
        .slice(0, 300)
    : [];

  // Az adott (start,end) korábbi sorai törlődnek, majd az újak beszúródnak (edit + törlés).
  const del = await supabase
    .from("dish_sales")
    .delete()
    .eq("period_start", start)
    .eq("period_end", end);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });

  if (rows.length) {
    const { error } = await supabase.from("dish_sales").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: rows.length });
}
