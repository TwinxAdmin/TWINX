// Irodai üzenetek — CSAK szerveroldal (service_role). A jogosultságot itt is, és az RLS is ellenőrzi.
import { createAdminClient } from "@/lib/supabase/admin";
import { activityTitle, featureLabel } from "@/lib/activity";
import { folderAccess, namesFor } from "@/lib/office-folders";
import { isSelectableModule, selectableModules } from "@/lib/module-favorites";
import { MESSAGE_LIST_MAX, type MessageKind, type OfficeMessage, type SendInput } from "@/lib/office-messages-shared";

type Row = {
  id: string; office_id: string; sender_id: string | null; recipient_id: string | null; kind: MessageKind;
  body: string; due_date: string | null; module_href: string | null; folder_id: string | null;
  history_id: string | null; parent_id: string | null; task_status: "open" | "accepted" | "done" | null;
  assignee_id: string | null; created_at: string;
};

const COLS = "id, office_id, sender_id, recipient_id, kind, body, due_date, module_href, folder_id, history_id, parent_id, task_status, assignee_id, created_at";

export type Box = "inbox" | "sent" | "tasks";

/**
 * Üzenetek egy tagnak.
 *  • inbox: nekem szóló (vagy „Mindenki") üzenetek, amiket nem én küldtem
 *  • sent:  amiket én küldtem
 *  • tasks: a nekem szóló / általam elvállalt feladatok (Feladataim)
 */
export async function listMessages(officeId: string, userId: string, box: Box): Promise<OfficeMessage[]> {
  const admin = createAdminClient();
  let q = admin.from("office_messages").select(COLS).eq("office_id", officeId)
    .order("created_at", { ascending: false }).limit(MESSAGE_LIST_MAX);

  if (box === "sent") q = q.eq("sender_id", userId);
  else if (box === "tasks") q = q.eq("kind", "task").or(`assignee_id.eq.${userId},and(assignee_id.is.null,or(recipient_id.eq.${userId},recipient_id.is.null))`).neq("sender_id", userId);
  else q = q.or(`recipient_id.eq.${userId},recipient_id.is.null`).neq("sender_id", userId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];
  return decorate(rows, userId);
}

/** Olvasatlan, nekem szóló üzenetek száma (fejléc-jelzés). */
export async function unreadCount(officeId: string, userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.from("office_messages").select("id")
    .eq("office_id", officeId).or(`recipient_id.eq.${userId},recipient_id.is.null`).neq("sender_id", userId)
    .order("created_at", { ascending: false }).limit(MESSAGE_LIST_MAX);
  const ids = (data ?? []).map((r) => r.id as string);
  if (ids.length === 0) return 0;
  const { data: reads } = await admin.from("office_message_reads").select("message_id").eq("user_id", userId).in("message_id", ids);
  return ids.length - (reads ?? []).length;
}

async function decorate(rows: Row[], userId: string): Promise<OfficeMessage[]> {
  const admin = createAdminClient();
  const ids = rows.map((r) => r.id);
  const people = rows.flatMap((r) => [r.sender_id, r.recipient_id, r.assignee_id]).filter(Boolean) as string[];
  const folderIds = [...new Set(rows.map((r) => r.folder_id).filter(Boolean) as string[])];
  const workIds = [...new Set(rows.map((r) => r.history_id).filter(Boolean) as string[])];

  const [names, { data: reads }, { data: folders }, { data: works }] = await Promise.all([
    namesFor(people),
    admin.from("office_message_reads").select("message_id").eq("user_id", userId).in("message_id", ids),
    folderIds.length ? admin.from("office_folders").select("id, name").in("id", folderIds) : Promise.resolve({ data: [] }),
    workIds.length ? admin.from("usage_history").select("id, feature_used, input_data").in("id", workIds) : Promise.resolve({ data: [] }),
  ]);
  const readSet = new Set((reads ?? []).map((r) => r.message_id as string));
  const folderName = new Map((folders ?? []).map((f) => [f.id as string, f.name as string]));
  const workMap = new Map((works ?? []).map((w) => [w.id as string, {
    title: activityTitle(w.feature_used as string, w.input_data as Record<string, unknown> | null),
    moduleLabel: featureLabel(w.feature_used as string),
  }]));
  const modLabel = new Map(selectableModules().map((m) => [m.href, m.label]));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body,
    createdAt: r.created_at,
    sender: { id: r.sender_id, name: r.sender_id ? names.get(r.sender_id) ?? "Ismeretlen" : "Ismeretlen" },
    recipient: { id: r.recipient_id, name: r.recipient_id ? names.get(r.recipient_id) ?? "Ismeretlen" : "Mindenki" },
    dueDate: r.due_date,
    moduleHref: r.module_href,
    moduleLabel: r.module_href ? modLabel.get(r.module_href) ?? null : null,
    folder: r.folder_id && folderName.has(r.folder_id) ? { id: r.folder_id, name: folderName.get(r.folder_id)! } : null,
    work: r.history_id && workMap.has(r.history_id) ? { id: r.history_id, ...workMap.get(r.history_id)! } : null,
    parentId: r.parent_id,
    task: r.kind === "task" && r.task_status
      ? { status: r.task_status, assignee: r.assignee_id ? { id: r.assignee_id, name: names.get(r.assignee_id) ?? "Ismeretlen" } : null }
      : null,
    read: r.sender_id === userId || readSet.has(r.id),
    mine: r.sender_id === userId,
  }));
}

/**
 * Küldés — minden szabályt itt ellenőrzünk:
 *  • a címzett az iroda tagja, és nem önmaga;
 *  • csatolt mappát a címzett (Mindenkinél: mindenki) MEG IS TUDJA nyitni;
 *  • csatolt munka a küldőé VAGY egy általa látható közös mappában van, és benne van egy,
 *    a címzett számára is látható közös mappában (különben ne lehessen „kiszivárogtatni").
 */
export async function sendMessage(officeId: string, senderId: string, v: SendInput): Promise<{ id: string } | { error: string; status: number }> {
  const admin = createAdminClient();

  // címzett
  let recipients: string[];
  if (v.recipientId) {
    if (v.recipientId === senderId) return { error: "Magadnak nem küldhetsz üzenetet.", status: 422 };
    const { data: m } = await admin.from("office_members").select("user_id").eq("office_id", officeId).eq("user_id", v.recipientId).maybeSingle();
    if (!m) return { error: "A címzett nem tagja az irodának.", status: 422 };
    recipients = [v.recipientId];
  } else {
    const { data: all } = await admin.from("office_members").select("user_id").eq("office_id", officeId);
    recipients = (all ?? []).map((x) => x.user_id as string).filter((id) => id !== senderId);
    if (recipients.length === 0) return { error: "Még nincs más tag az irodában.", status: 422 };
  }

  if (v.moduleHref && !isSelectableModule(v.moduleHref)) return { error: "Ismeretlen modul.", status: 422 };

  // mappa
  if (v.folderId) {
    const own = await folderAccess(v.folderId, senderId);
    if (!own || own.folder.office_id !== officeId || !own.canView) return { error: "Ezt a mappát nem csatolhatod.", status: 403 };
    if (!v.recipientId && !own.folder.everyone) {
      return { error: "„Mindenki” címzettnél csak az egész irodának látható mappa csatolható.", status: 422 };
    }
    if (v.recipientId) {
      const acc = await folderAccess(v.folderId, v.recipientId);
      if (!acc?.canView) return { error: "A címzett nem látja ezt a mappát — oszd meg vele előbb a mappát.", status: 422 };
    }
  }

  // munka: csak olyan, ami a címzett(ek) számára látható közös mappában van
  if (v.historyId) {
    const { data: links } = await admin.from("office_folder_items").select("folder_id").eq("history_id", v.historyId);
    const folderIds = (links ?? []).map((l) => l.folder_id as string);
    let ok = false;
    for (const fid of folderIds) {
      const mine = await folderAccess(fid, senderId);
      if (!mine?.canView || mine.folder.office_id !== officeId) continue;
      if (!v.recipientId ? mine.folder.everyone : (await folderAccess(fid, v.recipientId))?.canView) { ok = true; break; }
    }
    if (!ok) return { error: "Munkát csak akkor csatolhatsz, ha egy olyan közös mappában van, amit a címzett is lát.", status: 422 };
  }

  // válasz / kapcsolódó feladat: ugyanabból az irodából, és a küldő láthatja
  if (v.parentId) {
    const { data: p } = await admin.from("office_messages").select("office_id, sender_id, recipient_id").eq("id", v.parentId).maybeSingle();
    if (!p || p.office_id !== officeId || !(p.recipient_id === null || p.recipient_id === senderId || p.sender_id === senderId)) {
      return { error: "Ismeretlen kapcsolódó üzenet.", status: 422 };
    }
  }

  const { data, error } = await admin.from("office_messages").insert({
    office_id: officeId,
    sender_id: senderId,
    recipient_id: v.recipientId,
    kind: v.kind,
    body: v.body,
    due_date: v.kind === "task" ? v.dueDate : null,
    module_href: v.kind === "task" ? v.moduleHref : null,
    folder_id: v.folderId,
    history_id: v.historyId,
    parent_id: v.parentId,
    task_status: v.kind === "task" ? "open" : null,
  }).select("id").single();
  if (error) {
    return { error: /office_messages/.test(error.message) ? "Futtasd le az office-messages.sql migrációt." : error.message, status: 500 };
  }
  return { id: data.id as string };
}

/** Egy üzenet, ha a felhasználó láthatja (címzett / Mindenki / küldő). */
export async function getVisibleMessage(id: string, officeId: string, userId: string): Promise<Row | null> {
  const { data } = await createAdminClient().from("office_messages").select(COLS).eq("id", id).maybeSingle();
  const r = data as Row | null;
  if (!r || r.office_id !== officeId) return null;
  if (!(r.recipient_id === null || r.recipient_id === userId || r.sender_id === userId)) return null;
  return r;
}
