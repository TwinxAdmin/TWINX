// SavedRow — mentett elem (pl. korábbi keresés) egységes sora: az egész sor megnyitja,
// a többi művelet (PDF letöltés, törlés…) a jobb oldali „⋯" menüben van (jobb klikkre is).
"use client";

import type { ReactNode } from "react";
import { ActionMenu, MenuDots, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";

export default function SavedRow({ title, sub, onOpen, items }: {
  title: ReactNode; sub?: ReactNode; onOpen: () => void; items: MenuItem[];
}) {
  const menu = useActionMenu();
  return (
    <div className="flex items-center gap-1 rounded-xl border pr-1.5 transition-colors hover:bg-[#FBF6F0]"
      style={{ borderColor: "var(--twx-line)", background: "#fff" }}
      onContextMenu={items.length ? menu.openAtEvent : undefined}>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 px-3 py-2.5 text-left">
        <span className="block truncate text-sm font-semibold">{title}</span>
        {sub && <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--twx-ink-muted)" }}>{sub}</span>}
      </button>
      {items.length > 0 && <MenuDots onClick={menu.openAtButton} />}
      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}
    </div>
  );
}
