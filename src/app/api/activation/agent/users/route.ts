// GET /api/activation/agent/users — az ügynök napi besorolásához szükséges szűk adat. Csak olvas.
// Védelem: Authorization: Bearer <ACTIVATION_AGENT_SECRET>. Az ügynöknek nincs service_role kulcsa a termék-adatbázishoz.
import { NextResponse } from "next/server";
import { agentAuthorized, agentUsers } from "@/lib/activation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!agentAuthorized(request)) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 401 });
  try {
    return NextResponse.json({ users: await agentUsers() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
