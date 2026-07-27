// GET /api/flyer/history — a felhasználó elkészült (elfogadott) hirdetései.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("usage_history")
    .select("input_data, output_file_url, created_at")
    .eq("feature_used", "flyer")
    .order("created_at", { ascending: false })
    .limit(24);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? [])
    .filter((r) => r.output_file_url)
    .map((r) => ({
      url: r.output_file_url as string,
      title: String((r.input_data as { title?: string } | null)?.title ?? ""),
      created_at: r.created_at as string,
    }));
  return NextResponse.json({ items });
}
