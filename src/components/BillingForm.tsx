// Számlázási adatok űrlap. Két helyen használjuk UGYANEZT a komponenst:
//   1) a Beállítások oldalon önálló kártyaként,
//   2) a kredit-igénylés felugró ablakában (embedded), ha még hiányzik az adat.
// Így nem csúszhat szét a két űrlap.
//
// Szerkezet (könyvelői előírás): a partner MINDIG megadja a saját adatait, és
// ha cég / egyéni vállalkozás nevében vásárol, egy pipa után előjön a cég
// neve, adószáma és székhelye. A számla ilyenkor a cégre készül.
"use client";

import { useState, type FormEvent } from "react";
import { showToast } from "@/components/Toast";
import type { BillingInfo } from "@/lib/billing";

type Draft = {
  billing_type: string;
  billing_name: string;
  billing_country: string;
  billing_zip: string;
  billing_city: string;
  billing_address: string;
  billing_email: string;
  billing_company_name: string;
  billing_tax_number: string;
  billing_company_country: string;
  billing_company_zip: string;
  billing_company_city: string;
  billing_company_address: string;
};

function toDraft(b: Partial<BillingInfo> | null): Draft {
  return {
    billing_type: (b?.billing_type as string) ?? "individual",
    billing_name: b?.billing_name ?? "",
    billing_country: b?.billing_country ?? "Magyarország",
    billing_zip: b?.billing_zip ?? "",
    billing_city: b?.billing_city ?? "",
    billing_address: b?.billing_address ?? "",
    billing_email: b?.billing_email ?? "",
    billing_company_name: b?.billing_company_name ?? "",
    billing_tax_number: b?.billing_tax_number ?? "",
    billing_company_country: b?.billing_company_country ?? "Magyarország",
    billing_company_zip: b?.billing_company_zip ?? "",
    billing_company_city: b?.billing_company_city ?? "",
    billing_company_address: b?.billing_company_address ?? "",
  };
}

export default function BillingForm({
  initial,
  embedded = false,
  preview = false,
  onSaved,
}: {
  initial: Partial<BillingInfo> | null;
  embedded?: boolean;         // felugró ablakban: nincs saját kártya-keret
  preview?: boolean;          // admin előnézet: mentés nélkül, csak megjelenés
  onSaved?: (b: BillingInfo) => void;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(initial));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Draft, v: string) => setD((p) => ({ ...p, [k]: v }));

  const isCompany = d.billing_type === "company";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Admin előnézetben nem írunk az adatbázisba — ez csak a megjelenés próbája.
    if (preview) {
      showToast("Ez csak előnézet — a mentés ilyenkor nem fut le.", "info");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nem sikerült a mentés.");
      showToast("Számlázási adatok mentve.", "success");
      onSaved?.(data.billing as BillingInfo);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  const field = (
    id: keyof Draft,
    label: string,
    placeholder: string,
    opts: { wide?: boolean; type?: string } = {}
  ) => (
    <div className={opts.wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={`b-${id}`} className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
        {label}
      </label>
      <input
        id={`b-${id}`}
        type={opts.type ?? "text"}
        value={d[id]}
        onChange={(e) => set(id, e.target.value)}
        placeholder={placeholder}
        className="twx-input mt-1 w-full text-sm"
      />
    </div>
  );

  const body = (
    <>
      {!embedded && (
        <div>
          <h2 className="text-sm font-semibold">Számlázási adatok</h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Ezekkel az adatokkal állítjuk ki a számlát a megvásárolt kreditről.
          </p>
        </div>
      )}

      {/* ------------------------- A VÁSÁRLÓ SAJÁT ADATAI ------------------------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {field("billing_name", "Teljes neved", "pl. Nagy Anna", { wide: true })}
        {field("billing_zip", "Irányítószám", "1051")}
        {field("billing_city", "Város", "Budapest")}
        {field("billing_address", "Utca, házszám", "Példa utca 12.", { wide: true })}
        {field("billing_country", "Ország", "Magyarország")}
        {field("billing_email", "Számlázási e-mail (nem kötelező)", "szamla@pelda.hu", { type: "email" })}
      </div>

      {/* ------------------------- CÉGES VÁSÁRLÁS KAPCSOLÓ ------------------------- */}
      <label
        className="flex cursor-pointer items-start gap-3 rounded-xl p-3"
        style={{
          background: isCompany ? "var(--twx-coral-soft)" : "var(--twx-cream)",
          border: `1px solid ${isCompany ? "var(--twx-coral)" : "var(--twx-line)"}`,
        }}
      >
        <input
          type="checkbox"
          checked={isCompany}
          onChange={(e) => set("billing_type", e.target.checked ? "company" : "individual")}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--twx-coral)]"
        />
        <span>
          <span className="block text-sm font-medium">
            Cég vagy egyéni vállalkozás nevében vásárolok
          </span>
          <span className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Ilyenkor a számla a cégre készül, te pedig kapcsolattartóként szerepelsz.
          </span>
        </span>
      </label>

      {/* ------------------------------ A CÉG ADATAI ------------------------------ */}
      {isCompany && (
        <div className="rounded-xl p-4" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--twx-ink-muted)" }}>
            A cég adatai (a számla vevője)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {field("billing_company_name", "Cég neve", "pl. Prémium Ingatlanok Kft.", { wide: true })}
            {field("billing_tax_number", "Adószám", "12345678-2-42", { wide: true })}
            {field("billing_company_zip", "Irányítószám", "1051")}
            {field("billing_company_city", "Város", "Budapest")}
            {field("billing_company_address", "Utca, házszám (székhely)", "Példa utca 12.", { wide: true })}
            {field("billing_company_country", "Ország", "Magyarország")}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "var(--twx-coral)" }}
      >
        {saving ? "Mentés…" : "Számlázási adatok mentése"}
      </button>
    </>
  );

  return embedded ? (
    <form onSubmit={onSubmit} className="space-y-4">{body}</form>
  ) : (
    <form onSubmit={onSubmit} className="twx-card space-y-4 p-5">{body}</form>
  );
}
