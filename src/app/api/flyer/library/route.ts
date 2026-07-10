// GET /api/flyer/library — a felhasználó korábbi munkái a hirdetéshez felhasználható
// formában (képek + alapadatok). A usage_history-ból dolgozik (RLS: saját sorok).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { activityTitle, featureLabel } from "@/lib/activity";
import type { LibraryItem } from "@/lib/flyer";

export const runtime = "nodejs";

type HistoryRow = {
  id: string;
  feature_used: string;
  input_data: Record<string, unknown> | null;
  output_file_url: string | null;
  created_at: string;
};

function isImage(url: string | null): boolean {
  if (!url) return false;
  return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("usage_history")
    .select("id, feature_used, input_data, output_file_url, created_at")
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as HistoryRow[];

  const items: LibraryItem[] = rows.map((r) => {
    const d = (r.input_data ?? {}) as Record<string, unknown>;

    // Képek kigyűjtése (látványterv: rooms[].output; egyébként az output ha kép).
    const images: string[] = [];
    if (Array.isArray(d.rooms)) {
      for (const room of d.rooms as Record<string, unknown>[]) {
        const out = room?.output;
        if (typeof out === "string" && isImage(out)) images.push(out);
      }
    }
    if (isImage(r.output_file_url) && !images.includes(r.output_file_url as string)) {
      images.unshift(r.output_file_url as string);
    }

    const pdfUrl =
      r.output_file_url && /\.pdf(\?|$)/i.test(r.output_file_url) ? r.output_file_url : null;

    const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const data =
      s(d.telepules) || s(d.utca) || s(d.tipus) || s(d.meret) || s(d.szobak)
        ? {
            telepules: s(d.telepules),
            utca: s(d.utca),
            tipus: s(d.tipus),
            meret: s(d.meret),
            szobak: s(d.szobak),
          }
        : null;

    return {
      id: r.id,
      type: r.feature_used,
      typeLabel: featureLabel(r.feature_used),
      title: activityTitle(r.feature_used, r.input_data),
      createdAt: r.created_at,
      images,
      pdfUrl,
      data,
    };
  });

  return NextResponse.json({ items });
}
