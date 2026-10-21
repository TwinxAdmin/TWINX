// A kredit-sáv (CreditDock) és a Portálközpont kreditblokkja közös irodai állapota:
// irodák listája, kiválasztott iroda, mód (privát / irodai) és a tag kerete.
import { getMembershipIn, getWorkContext, listMyOffices, officeKind } from "@/lib/office-server";

/** A kredit-sáv irodai állapota: irodák listája, kiválasztott iroda, mód és a keret felirata. */
export async function loadDockState(userId: string) {
  try {
    const offices = await listMyOffices(userId);
    if (offices.length === 0) return null;
    const ctx = await getWorkContext(userId);
    const selected = offices.find((o) => o.id === ctx.officeId) ?? offices[0];
    const m = await getMembershipIn(userId, selected.id);
    // Közös munkatér (kind = team): nincs irodai keret és nincs vezetői előnézet — mindig saját kredit.
    const kinds = await Promise.all(offices.map((o) => officeKind(o.id)));
    const team = kinds[offices.indexOf(selected)] === "team";
    const label = !m ? "0 kredit" : m.role === "owner" || m.unlimited ? "Korlátlan" : `${m.allowance ?? 0} kredit`;
    return {
      mode: (!team && ctx.useOffice && ctx.officeId === selected.id ? "office" : "private") as "office" | "private",
      label,
      // a tag kerete számként (null = korlátlan: létrehozó vagy korlátlan tag)
      allowance: !m ? 0 : m.role === "owner" || m.unlimited ? null : (m.allowance ?? 0),
      officeId: selected.id,
      team,
      offices: offices.map((o, i) => ({ id: o.id, name: o.name, team: kinds[i] === "team" })),
      // Létrehozó / vezető a kiválasztott irodában → használhatja a „Kolléga-nézet" előnézetet.
      isManager: !team && !!m && (m.role === "owner" || !!m.can_allocate),
    };
  } catch {
    return null;
  }
}
