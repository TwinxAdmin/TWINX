// Prompt-modul választó legördülő. Kiválasztáskor a ?module= paraméterre navigál,
// így csak a kiválasztott modul promptját látni és finomítani.
"use client";

import { useRouter } from "next/navigation";

export default function ModuleSelect({
  modules,
  value,
}: {
  modules: { key: string; label: string }[];
  value: string;
}) {
  const router = useRouter();
  return (
    <div>
      <label htmlFor="module-select" className="block text-sm font-medium">
        Modul kiválasztása
      </label>
      <select
        id="module-select"
        value={value}
        onChange={(e) => router.push(`?module=${e.target.value}`)}
        className="twx-input mt-1 max-w-sm"
      >
        {modules.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
