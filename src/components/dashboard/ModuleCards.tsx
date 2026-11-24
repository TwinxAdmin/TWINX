// Moduljaim kártyák a kezdőlapon (B arculat, terv 29 / 5.): fix méretű kártyák, a műveletek a „⋯" menüben
// (jobb klikkre is). Csak azok a modulok, amelyekhez a felhasználónak hozzáférése van (szerveroldalon szűrve).
"use client";

import ModuleIcon from "@/components/ModuleIcon";
import { ActionMenu, MenuDots, useActionMenu } from "@/components/ui/ActionMenu";
import type { SiteModule } from "@/lib/site";

function ModuleCard({ m }: { m: SiteModule }) {
  const menu = useActionMenu();
  return (
    <div className="flex h-[96px] items-center gap-4 rounded-[22px] border border-b-line bg-b-card pl-5 pr-3 transition-shadow hover:shadow-b"
      onContextMenu={menu.openAtEvent}>
      <a href={m.href} className="flex min-w-0 flex-1 items-center gap-4">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-b-accent-tint text-b-accent-ink">
          <ModuleIcon name={m.icon} size={22} />
        </span>
        <span className="min-w-0 truncate text-[17px] font-semibold text-b-ink">{m.label}</span>
      </a>
      <MenuDots onClick={menu.openAtButton} label={`Műveletek: ${m.label}`} />
      {menu.open && (
        <ActionMenu at={menu.at} onClose={menu.close}
          items={[{ kind: "link", label: "Megnyitás", href: m.href }]} />
      )}
    </div>
  );
}

export default function ModuleCards({ modules }: { modules: SiteModule[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {modules.map((m) => <ModuleCard key={m.href} m={m} />)}
    </div>
  );
}
