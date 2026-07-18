// /api/hospitality/sales — heti eladás-napló (követés). Ingyenes.
// GET: a saját heti eladások (ételenként). POST: egy hét darabszámainak mentése (upsert).
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

// "YYYY-MM-DD" ellenőrzés.
function isDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("dish_sales_weekly")
    .select("dish_id, week_start, qty")
    .order("week_start", { ascending: false })
    .limit(1000);
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

  const weekStart = String(body.week_start ?? "").trim();
  if (!isDate(weekStart)) return NextResponse.json({ error: "Hibás hét-dátum." }, { status: 422 });

  const rows = Array.isArray(body.entries)
    ? (body.entries as unknown[])
        .map((e) => {
          const o = (e ?? {}) as Record<string, unknown>;
          return {
            user_id: user.id,
            dish_id: String(o.dish_id ?? "").trim(),
            week_start: weekStart,
            qty: Math.max(0, Math.floor(Number(o.qty) || 0)),
          };
        })
        .filter((r) => r.dish_id)
        .slice(0, 200)
    : [];

  if (!rows.length) return NextResponse.json({ error: "Nincs menthető sor." }, { status: 422 });

  const { error } = await supabase
    .from("dish_sales_weekly")
    .upsert(rows, { onConflict: "user_id,dish_id,week_start" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, saved: rows.length });
}
