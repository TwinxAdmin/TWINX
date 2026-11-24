// Admin „így látja a partner" előnézet.
//
// Az admin átkapcsolhat felhasználói vagy sales nézetbe, hogy kilépés nélkül
// lássa, mit lát a partner. FONTOS biztonsági szabály: ez CSAK a megjelenítést
// befolyásolja, és CSAK lefelé válthat.
//   • Aki nem admin, annak a cookie-nak semmi hatása nincs (a valódi szerepkör él).
//   • Az előnézet soha nem ad jogot: 'admin' nézetre nem lehet emelni vele.
//   • Az /admin/* oldalak és a szerveroldali kreditlevonás (lib/credits.ts) a
//     VALÓDI szerepkört nézik az adatbázisból — azokat ez nem érinti.
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const VIEW_AS_COOKIE = "twx_view_as";

export type ViewRole = "user" | "sales";

/** Felhasználó szerinti előnézet (3f; terv 12 / 1.): „így látja Y felhasználó" — a cookie a felhasználó azonosítója. */
export const VIEW_AS_USER_COOKIE = "twx_view_as_user";

export type ViewContext = {
  realRole: string;    // ami az adatbázisban van
  role: string;        // amit a felület használjon (előnézetben a választott)
  previewing: boolean; // épp előnézetben vagyunk-e
  canPreview: boolean; // van-e joga előnézethez (csak admin)
  /** Felhasználó szerinti előnézetben a megjelenített felhasználó (csak megjelenítés; a jogot a szerver a valódi
   *  felhasználóra ellenőrzi, és az előnézetben a beküldés tiltott — middleware). */
  asUserId: string | null;
};

function parseView(v: string | undefined): ViewRole | null {
  return v === "user" || v === "sales" ? v : null;
}

/**
 * A megjelenítéshez használandó szerepkör feloldása.
 * @param realRole a profiles.role értéke (adatbázisból)
 */
export async function resolveViewContext(realRole: string | null | undefined): Promise<ViewContext> {
  const actual = realRole ?? "user";
  const canPreview = actual === "admin";

  if (!canPreview) {
    return { realRole: actual, role: actual, previewing: false, canPreview: false, asUserId: null };
  }

  const jar = await cookies();
  const asUser = jar.get(VIEW_AS_USER_COOKIE)?.value || null;
  const asUserId = asUser && /^[0-9a-f-]{36}$/i.test(asUser) ? asUser : null;
  // A felhasználó szerinti előnézet a felhasználói szerepkört mutatja (a megjelenített személy valódi hozzáféréseivel).
  const view = asUserId ? "user" : parseView(jar.get(VIEW_AS_COOKIE)?.value);

  return {
    realRole: actual,
    role: view ?? actual,
    previewing: view !== null,
    canPreview: true,
    asUserId,
  };
}

export const VIEW_ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  sales: "Sales",
  user: "Felhasználó",
};

// ---------------------------------------------------------------------------
// Irodai nézet előnézete: a létrehozó / vezető megnézheti, mit lát egy KOLLÉGA
// az Irodai fiók oldalon. Ugyanaz az elv: CSAK megjelenítés — minden irodai API
// a valódi tagságot és jogot ellenőrzi, és a cookie a nem-vezetőnél hatástalan.
// ---------------------------------------------------------------------------
export const OFFICE_VIEW_COOKIE = "twx_office_view";

/** Kolléga-előnézet be van-e kapcsolva (a cookie alapján; a jogot a hívó ellenőrzi). */
export async function officeMemberPreview(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(OFFICE_VIEW_COOKIE)?.value === "member";
}

/**
 * „Nincs iroda" előnézet: a felület úgy jelenik meg, mintha a felhasználó egyetlen irodának sem lenne tagja
 * (nincs Privát/Irodai váltó, az Irodai fiók oldal a csatlakozás/igénylés képernyőt mutatja, nincsenek közös
 * mappák). CSAK megjelenítés — a cookie-t csak irodai létrehozó/vezető kapcsolhatja be (/api/office/view-as).
 */
export async function officeNonePreview(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(OFFICE_VIEW_COOKIE)?.value === "none";
}

/**
 * Kinek az adatait OLVASSA egy megjelenítő GET-végpont (5/b): felhasználó szerinti előnézetben (csak admin, cookie)
 * a megjelenített felhasználóét, különben a bejelentkezettét. CSAK olvasáshoz — a módosító kérések az előnézetben
 * tiltottak (middleware), és minden jogot a valódi felhasználóra ellenőrzünk.
 */
export async function readSubjectId(realUserId: string): Promise<string> {
  const jar = await cookies();
  const asUser = jar.get(VIEW_AS_USER_COOKIE)?.value || "";
  if (!/^[0-9a-f-]{36}$/i.test(asUser) || asUser === realUserId) return realUserId;
  const { data } = await createAdminClient().from("profiles").select("role").eq("id", realUserId).maybeSingle();
  return data?.role === "admin" ? asUser : realUserId;
}
