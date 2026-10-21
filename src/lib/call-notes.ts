// Sales hívásnapló — ügyfelenkénti bejegyzések (ki, mikor, milyen eredménnyel hívta, megjegyzés, visszahívás napja).
// SZERVEROLDALI (service_role); a jogosultságot (admin / sales) és azt, hogy ügyfélről van szó, a hívó API ellenőrzi.
// Migráció: 20261021120000_customer-call-notes.sql — amíg nincs lefuttatva, a napló üres, a felület nem törik el.
import { createAdminClient } from "@/lib/supabase/admin";
import { CALL_NOTES_MIGRATION_NAME, type CallNote, type CallStatus, type LastCall } from "@/lib/call-notes-shared";
export { isCallStatus } from "@/lib/call-notes-shared";
export const CALL_NOTES_MIGRATION = CALL_NOTES_MIGRATION_NAME;

const missing = (msg?: string) => !!msg && /customer_call_notes/.test(msg);

const toNote = (r: Record<string, unknown>): CallNote => ({
  id: String(r.id),
  status: r.status as CallStatus,
  note: (r.note as string | null) ?? null,
  callbackOn: (r.callback_on as string | null) ?? null,
  authorName: (r.author_name as string | null) ?? null,
  createdAt: String(r.created_at),
});

export async function listCallNotes(userId: string): Promise<{ migrated: boolean; notes: CallNote[] }> {
  const { data, error } = await createAdminClient()
    .from("customer_call_notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200);
  if (error) return { migrated: !missing(error.message), notes: [] };
  return { migrated: true, notes: (data ?? []).map(toNote) };
}

export async function addCallNote(input: {
  userId: string; authorId: string; authorName: string | null; status: CallStatus; note: string | null; callbackOn: string | null;
}): Promise<{ ok: true; note: CallNote } | { ok: false; error: string }> {
  const { data, error } = await createAdminClient().from("customer_call_notes").insert({
    user_id: input.userId,
    author_id: input.authorId,
    author_name: input.authorName,
    status: input.status,
    note: input.note,
    callback_on: input.status === "callback" ? input.callbackOn : null,
  }).select("*").single();
  if (error) return { ok: false, error: missing(error.message) ? `A hívásnaplóhoz futtasd le a ${CALL_NOTES_MIGRATION} migrációt.` : error.message };
  return { ok: true, note: toNote(data as Record<string, unknown>) };
}

/** Ügyfelenként a legutolsó bejegyzés (a Sales-listához). Migráció nélkül üres. */
export async function lastCallsByUser(): Promise<Map<string, LastCall>> {
  const out = new Map<string, LastCall>();
  const { data, error } = await createAdminClient()
    .from("customer_call_notes").select("user_id, status, callback_on, created_at").order("created_at", { ascending: false }).limit(5000);
  if (error) return out;
  for (const r of data ?? []) {
    const id = String(r.user_id);
    if (!out.has(id)) out.set(id, { status: r.status as CallStatus, at: String(r.created_at), callbackOn: (r.callback_on as string | null) ?? null });
  }
  return out;
}
