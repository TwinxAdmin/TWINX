// /api/hospitality/sales — eladás-napló. Ingyenes.
// GET: a saját rögzített eladások (ételenként, csatornánként) + az eladott napi menük.
// POST: egy időszak/nap adatainak mentése — az adott (start,end) sorait felülírja
// (delete + insert), és a menü-darabszámokat upsert-eli.
//
// Csatornák: 'etlap' (étlapról eladott adag — saját eladási ára van)
//            'menu'  (menübe felhasznált adag — csak költsége van, a bevétel a menü ára)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toAmount } from "@/lib/costing";

export const runtime = "nodejs";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
const CHANNELS = ["etlap", "menu"] as const;

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const [dishRes, menuRes] = await Promise.all([
    supabase.from("dish_sales").select("dish_id, period_start, period_end, qty, channel").order("period_start", { ascending: false }).limit(5000),
    supabase.from("menu_sales").select("period_start, period_end, qty_2, qty_3, price_2, price_3").order("period_start", { ascending: false }).limit(2000),
  ]);
  if (dishRes.error) return NextResponse.json({ error: dishRes.error.message }, { status: 500 });
  if (menuRes.error) return NextResponse.json({ error: menuRes.error.message }, { status: 500 });

  return NextResponse.json({ sales: dishRes.data ?? [], menuSales: menuRes.data ?? [] });
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

  // Ételsorok csatornánként.
  const rows = Array.isArray(body.entries)
    ? (body.entries as unknown[])
        .map((e) => {
          const o = (e ?? {}) as Record<string, unknown>;
          const channel = String(o.channel ?? "etlap");
          return {
            user_id: user.id,
            dish_id: String(o.dish_id ?? "").trim(),
            period_start: start,
            period_end: end,
            qty: Math.max(0, Math.floor(Number(o.qty) || 0)),
            channel: (CHANNELS as readonly string[]).includes(channel) ? channel : "etlap",
          };
        })
        .filter((r) => r.dish_id && r.qty > 0)
        .slice(0, 600)
    : [];

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

  // Eladott napi menük (+ opcionális ár-felülírás az adott időszakra).
  const m = (body.menu ?? {}) as Record<string, unknown>;
  const qty2 = Math.max(0, Math.floor(Number(m.qty_2) || 0));
  const qty3 = Math.max(0, Math.floor(Number(m.qty_3) || 0));
  const price2 = m.price_2 != null && String(m.price_2).trim() ? toAmount(m.price_2) : null;
  const price3 = m.price_3 != null && String(m.price_3).trim() ? toAmount(m.price_3) : null;

  if (qty2 > 0 || qty3 > 0 || price2 != null || price3 != null) {
    const { error } = await supabase.from("menu_sales").upsert(
      { user_id: user.id, period_start: start, period_end: end, qty_2: qty2, qty_3: qty3, price_2: price2, price_3: price3 },
      { onConflict: "user_id,period_start,period_end" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    await supabase.from("menu_sales").delete().eq("period_start", start).eq("period_end", end);
  }

  return NextResponse.json({ ok: true, saved: rows.length });
}
