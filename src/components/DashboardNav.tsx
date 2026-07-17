// Felső sáv navigáció — gazdag legördülők (ikon + cím + leírás) és mozgó
// kiemelés (Framer Motion layoutId), ami az egeret követi a menüben.
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CATEGORIES } from "@/lib/catalog";
import ModuleIcon from "@/components/ModuleIcon";

type Item = { label: string; href?: string; desc?: string; icon?: string; onClick?: () => void };

const CORAL = "var(--twx-coral)";

function ItemRow({
  item,
  dropId,
  hovered,
  setHovered,
  onClose,
}: {
  item: Item;
  dropId: string;
  hovered: string | null;
  setHovered: (v: string | null) => void;
  onClose: () => void;
}) {
  const active = hovered === item.label;
  const inner = (
    <>
      {active && (
        <motion.span
          layoutId={`hl-${dropId}`}
          className="absolute inset-0 rounded-xl"
          style={{ background: "rgba(239,122,90,0.14)", border: "1px solid rgba(239,122,90,0.28)" }}
          transition={{ type: "spring", stiffness: 520, damping: 42 }}
        />
      )}
      <span
        className="relative z-10 flex h-9 w-9 flex-none items-center justify-center rounded-lg"
        style={{ background: "rgba(239,122,90,0.14)", color: CORAL }}
      >
        <ModuleIcon name={item.icon} size={18} />
      </span>
      <span className="relative z-10 min-w-0">
        <span className="block truncate text-sm font-medium" style={{ color: "var(--twx-on-dark)" }}>
          {item.label}
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
  align = "left",
  isOpen,
  onToggle,
  onClose,
}: {
  id: string;
  label: string;
  items: Item[];
  soon?: boolean;
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
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors"
        style={{
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
          className="absolute top-full mt-2 w-[300px] rounded-2xl p-2 transition-all duration-200 ease-out"
          style={{
            [align]: 0,
            background: "var(--twx-dark-2)",
            border: "1px solid rgba(255,255,255,0.08)",
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

export default function DashboardNav() {
  const [open, setOpen] = useState<string | null>(null);

  const flyerItems: Item[] = [
    { label: "Hirdetés készítése", href: "/dashboard/flyer", icon: "flyer", desc: "Új, márkázott ingatlanhirdetés" },
    { label: "Korábbi hirdetések", href: "/dashboard/flyer/history", icon: "history", desc: "Elkészült hirdetéseid nézegetője" },
    { label: "Arculatok", href: "/dashboard/branding", icon: "branding", desc: "Logó, szín, ügynök-adatok" },
  ];

  const customItems: Item[] = [
    { label: "Saját moduljaim", href: "/dashboard/custom", icon: "custom", desc: "A neked fejlesztett eszközök" },
    {
      label: "Egyedi modul igénylése",
      icon: "request",
      desc: "Kérj saját üzleti automatizációt",
      onClick: () => window.dispatchEvent(new CustomEvent("open-b2b")),
    },
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

      {CATEGORIES.map((cat) => (
        <NavDropdown
          key={cat.slug}
          id={cat.slug}
          label={cat.label}
          soon={cat.status === "soon"}
          items={cat.modules}
          isOpen={open === cat.slug}
          onToggle={() => setOpen(open === cat.slug ? null : cat.slug)}
          onClose={() => setOpen(null)}
        />
      ))}

      <NavDropdown
        id="hirdetes"
        label="Hirdetéskészítő"
        items={flyerItems}
        isOpen={open === "hirdetes"}
        onToggle={() => setOpen(open === "hirdetes" ? null : "hirdetes")}
        onClose={() => setOpen(null)}
      />

      <NavDropdown
        id="egyedi"
        label="Egyedi modulok"
        items={customItems}
        align="right"
        isOpen={open === "egyedi"}
        onToggle={() => setOpen(open === "egyedi" ? null : "egyedi")}
        onClose={() => setOpen(null)}
      />
    </nav>
  );
}
