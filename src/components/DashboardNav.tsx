// Felső sáv navigáció — gazdag legördülők (ikon + cím + leírás) és mozgó
// kiemelés (Framer Motion layoutId), ami az egeret követi a menüben.
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { visibleCategories, visibleModules, type Premium3dState } from "@/lib/catalog";
import ModuleIcon from "@/components/ModuleIcon";

type Item = { label: string; href?: string; desc?: string; icon?: string; onClick?: () => void; badge?: string; soon?: boolean };

const CORAL = "var(--twx-coral)";

function ItemRow({
  item,
  dropId,
  premium,
  hovered,
  setHovered,
  onClose,
}: {
  item: Item;
  dropId: string;
  premium?: boolean;
  hovered: string | null;
  setHovered: (v: string | null) => void;
  onClose: () => void;
}) {
  const active = hovered === item.label && !item.soon;
  const inner = (
    <>
      {active && (
        <motion.span
          layoutId={`hl-${dropId}`}
          className="absolute inset-0 rounded-xl"
          style={premium
            ? { background: "linear-gradient(135deg,rgba(212,170,92,0.18),rgba(212,170,92,0.05))", border: "1px solid rgba(212,170,92,0.3)" }
            : { background: "rgba(239,122,90,0.14)", border: "1px solid rgba(239,122,90,0.28)" }}
          transition={{ type: "spring", stiffness: 520, damping: 42 }}
        />
      )}
      <span
        className="relative z-10 flex h-9 w-9 flex-none items-center justify-center rounded-lg"
        style={premium ? { background: "linear-gradient(145deg,#8a6234,#5a3d22)", color: "#FFE7B8" } : { background: "rgba(239,122,90,0.14)", color: CORAL }}
      >
        <ModuleIcon name={item.icon} size={18} />
      </span>
      <span className="relative z-10 min-w-0">
        <span className="flex items-center gap-2 truncate text-sm font-medium" style={{ color: "var(--twx-on-dark)" }}>
          {item.label}
          {item.badge && !item.soon && (
            <span className="flex-none rounded-full px-1.5 py-0.5 text-[10px] font-extrabold"
              style={item.badge === "Hamarosan" ? { background: "linear-gradient(135deg,#F3D9A4,#D4AA5C)", color: "#2a1d0e" } : { background: CORAL, color: "#1c1005" }}>{item.badge}</span>
          )}
          {item.soon && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.1)", color: "#CFC6BB" }}>Hamarosan</span>
          )}
        </span>
        {item.desc && (
          <span className="block truncate text-xs" style={{ color: "var(--twx-on-dark-muted)" }}>
            {item.desc}
          </span>
        )}
      </span>
    </>
  );
  const cls = "relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left";
  // „Hamarosan": nem kattintható, halvány sor (nincs ál-gomb)
  if (item.soon) return <div className={cls} style={{ opacity: 0.45, cursor: "default" }} aria-disabled>{inner}</div>;
  return item.href ? (
    <a href={item.href} onMouseEnter={() => setHovered(item.label)} onClick={onClose} className={cls}>
      {inner}
    </a>
  ) : (
    <button
      type="button"
      onMouseEnter={() => setHovered(item.label)}
      onClick={() => {
        onClose();
        item.onClick?.();
      }}
      className={cls}
    >
      {inner}
    </button>
  );
}

function NavDropdown({
  id,
  label,
  items,
  soon,
  premium,
  align = "left",
  isOpen,
  onToggle,
  onClose,
}: {
  id: string;
  label: string;
  items: Item[];
  soon?: boolean;
  premium?: boolean;
  align?: "left" | "right";
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="relative z-30">
      <button
        type="button"
        disabled={soon}
        onClick={onToggle}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors${premium ? " twx-prem whitespace-nowrap font-bold" : ""}`}
        style={premium ? undefined : {
          color: soon ? "var(--twx-on-dark-muted)" : "var(--twx-on-dark)",
          background: isOpen ? "rgba(239,122,90,0.16)" : "transparent",
          cursor: soon ? "not-allowed" : "pointer",
        }}
      >
        <span>{label}</span>
        {soon ? (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: "rgba(255,255,255,0.08)", color: "var(--twx-on-dark-muted)" }}
          >
            Hamarosan
          </span>
        ) : (
          <span
            className="text-xs transition-transform duration-200"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ▾
          </span>
        )}
      </button>

      {!soon && (
        <div
          onMouseLeave={() => setHovered(null)}
          className={`absolute top-full mt-2 ${premium ? "w-[360px]" : "w-[300px]"} rounded-2xl p-2 transition-all duration-200 ease-out`}
          style={{
            [align]: 0,
            background: premium ? "#1d1915" : "var(--twx-dark-2)",
            border: premium ? "1px solid rgba(212,170,92,0.25)" : "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
            transformOrigin: "top",
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? "translateY(0) scaleY(1)" : "translateY(-8px) scaleY(0.96)",
            pointerEvents: isOpen ? "auto" : "none",
          } as React.CSSProperties}
        >
          {items.map((item) => (
            <ItemRow
              key={item.label}
              item={item}
              dropId={id}
              premium={premium}
              hovered={hovered}
              setHovered={setHovered}
              onClose={onClose}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardNav({ isAdmin = false, premium3d = "hidden" }: { isAdmin?: boolean; premium3d?: Premium3dState }) {
  const [open, setOpen] = useState<string | null>(null);

  // A hirdetéskép készítőnek NINCS külön felső menüpontja: a modul az Ingatlan
  // kategóriában él, az Arculat a jobb felső „Arculatom" linkről érhető el.
  // A helyére a „Korábbi munkák" került, ami MINDEN modul kimenetét gyűjti.
  const customItems: Item[] = [
    { label: "Saját moduljaim", href: "/dashboard/custom", icon: "custom", desc: "A neked fejlesztett eszközök" },
    {
      label: "Egyedi modul igénylése",
      icon: "request",
      desc: "Saját üzleti automatizáció",
      onClick: () => window.dispatchEvent(new CustomEvent("open-b2b")),
    },
    { label: "Mi az egyedi modul?", href: "/dashboard/egyedi-modul", icon: "info", desc: "Részletes ismertető: mire jó, hogyan készül" },
  ];

  return (
    <nav className="relative flex items-center gap-1 text-sm">
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-20 cursor-default"
          style={{ background: "transparent" }}
        />
      )}

      {/* Folyamat szerinti csoportok (Tartalomgyártás, Elemzés & kutatás…).
          Csak azok jelennek meg, amikben van látható modul — így nem áll itt
          üres, „Hamarosan” feliratú menüpont. */}
      {visibleCategories({ isAdmin, premium3d }).map((cat) => (
        <NavDropdown
          key={cat.slug}
          id={cat.slug}
          label={cat.label}
          premium={cat.premium}
          items={visibleModules(cat, true, { isAdmin, premium3d })}
          isOpen={open === cat.slug}
          onToggle={() => setOpen(open === cat.slug ? null : cat.slug)}
          onClose={() => setOpen(null)}
        />
      ))}

      <NavDropdown
        id="egyedi"
        label="Egyedi modulok"
        items={customItems}
        align="right"
        isOpen={open === "egyedi"}
        onToggle={() => setOpen(open === "egyedi" ? null : "egyedi")}
        onClose={() => setOpen(null)}
      />

      {/* Korábbi munkák — egyszerű link, nem legördülő: egy oldal gyűjti
          az összes modul kimenetét. */}
      <a
        href="/dashboard/munkaim"
        className="whitespace-nowrap rounded-full px-3 py-2 transition-colors hover:bg-white/5"
        style={{ color: "var(--twx-on-dark)" }}
      >
        Korábbi munkák
      </a>
    </nav>
  );
}
