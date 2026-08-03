// GET /api/real-estate/valuation/history — a partner korábbi értékbecslései.
// A riport szövegét is visszaadjuk, hogy egy kattintással újranyitható és
// tovább szerkeszthető legyen. RLS: a saját sorait látja (max. 50 elem).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("usage_history")
    .select("id, input_data, output_text, output_file_url, created_at, edited_at")
    .eq("feature_used", "valuation")
    // FONTOS: az RLS az adminnak MINDEN sort átenged, ezért itt is szűrünk a
    // saját felhasználóra — különben az admin más partnerek riportjait látná.
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: "Az előzmények nem tölthetők be." }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}
