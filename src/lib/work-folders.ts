// Saját munka-mappák — közös típusok és validáció (kliens és szerver is használja).

export const WORK_FOLDER_NAME_MAX = 60;
/** Ennyi saját mappa lehet egy felhasználónak (elütés / visszaélés elleni védelem). */
export const WORK_FOLDERS_MAX = 100;

export type WorkFolder = {
  id: string;
  name: string;
  itemCount: number;
  lastAddedAt: string | null;
  createdAt: string;
};

/** Melyik munka melyik saját mappában van. */
export type WorkFolderLink = { folderId: string; historyId: string };

export function validateWorkFolderName(raw: unknown): { name?: string; error?: string } {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "Adj nevet a mappának." };
  if (name.length > WORK_FOLDER_NAME_MAX) return { error: `Legfeljebb ${WORK_FOLDER_NAME_MAX} karakter lehet.` };
  return { name };
}
