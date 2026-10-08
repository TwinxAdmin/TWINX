// Irodai üzenetek — közös típusok és validáció (kliens és szerver is használja).

export type MessageKind = "task" | "done" | "message";
export type TaskStatus = "open" | "accepted" | "done";

export const MESSAGE_KIND_LABEL: Record<MessageKind | "credit", string> = {
  task: "Feladat",
  done: "Kész munka",
  message: "Üzenet",
  credit: "Kreditkérés",
};

export const MESSAGE_BODY_MAX = 2000;
/** A listákban legfeljebb ennyi tétel (CLAUDE.md: max. 50 elem). */
export const MESSAGE_LIST_MAX = 50;

export type OfficeMessage = {
  id: string;
  kind: MessageKind;
  body: string;
  createdAt: string;
  sender: { id: string | null; name: string };
  recipient: { id: string | null; name: string };   // id null = Mindenki
  dueDate: string | null;
  moduleHref: string | null;
  moduleLabel: string | null;
  folder: { id: string; name: string } | null;
  work: { id: string; title: string; moduleLabel: string } | null;
  parentId: string | null;
  task: { status: TaskStatus; assignee: { id: string; name: string } | null } | null;
  read: boolean;
  mine: boolean;   // én küldtem
};

export type SendInput = {
  kind: MessageKind;
  recipientId: string | null;
  body: string;
  dueDate: string | null;
  moduleHref: string | null;
  folderId: string | null;
  historyId: string | null;
  parentId: string | null;
};

/** Űrlap-validáció — ugyanezt futtatja a szerver is. */
export function validateSend(input: Record<string, unknown>): { ok: true; value: SendInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const kind = input.kind === "task" || input.kind === "done" || input.kind === "message" ? input.kind : null;
  if (!kind) errors.kind = "Válaszd ki az üzenet típusát.";

  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body) errors.body = "Írd meg az üzenetet.";
  else if (body.length > MESSAGE_BODY_MAX) errors.body = `Legfeljebb ${MESSAGE_BODY_MAX} karakter lehet.`;

  const recipientId = typeof input.recipientId === "string" && input.recipientId ? input.recipientId : null;

  let dueDate: string | null = null;
  if (kind === "task" && typeof input.dueDate === "string" && input.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) errors.dueDate = "Érvénytelen dátum.";
    else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (new Date(`${input.dueDate}T00:00:00`) < today) errors.dueDate = "A határidő nem lehet a múltban.";
      else dueDate = input.dueDate;
    }
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const value: SendInput = {
    kind: (kind ?? "message") as MessageKind,
    recipientId,
    body,
    dueDate,
    moduleHref: kind === "task" ? str(input.moduleHref) : null,
    folderId: str(input.folderId),
    historyId: str(input.historyId),
    parentId: str(input.parentId),
  };
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
