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

export const VIEW_AS_COOKIE = "twx_view_as";

export type ViewRole = "user" | "sales";

export type ViewContext = {
  realRole: string;    // ami az adatbázisban van
  role: string;        // amit a felület használjon (előnézetben a választott)
  previewing: boolean; // épp előnézetben vagyunk-e
  canPreview: boolean; // van-e joga előnézethez (csak admin)
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
    return { realRole: actual, role: actual, previewing: false, canPreview: false };
  }

  const jar = await cookies();
  const view = parseView(jar.get(VIEW_AS_COOKIE)?.value);

  return {
    realRole: actual,
    role: view ?? actual,
    previewing: view !== null,
    canPreview: true,
  };
}

export const VIEW_ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  sales: "Sales",
  user: "Felhasználó",
};
