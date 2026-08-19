// Számlázási adatok űrlap. Két helyen használjuk UGYANEZT a komponenst:
//   1) a Beállítások oldalon önálló kártyaként,
//   2) a kredit-igénylés felugró ablakában (embedded), ha még hiányzik az adat.
// Így nem csúszhat szét a két űrlap.
"use client";

import { useState, type FormEvent } from "react";
import { showToast } from "@/components/Toast";
import SelectField from "@/components/SelectField";
import { BILLING_TYPE_LABEL, type BillingInfo, type BillingType } from "@/lib/billing";

type Draft = {
  billing_type: string;
  billing_name: string;
  billing_tax_number: string;
  billing_country: string;
  billing_zip: string;
  billing_city: string;
  billing_address: string;
  billing_email: string;
};

function toDraft(b: Partial<BillingInfo> | null): Draft {
  return {
    billing_type: (b?.billing_type as string) ?? "",
    billing_name: b?.billing_name ?? "",
    billing_tax_number: b?.billing_tax_number ?? "",
    billing_country: b?.billing_country ?? "Magyarország",
    billing_zip: b?.billing_zip ?? "",
    billing_city: b?.billing_city ?? "",
    billing_address: b?.billing_address ?? "",
    billing_email: b?.billing_email ?? "",
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>
            Kinek állítsuk ki a számlát?
          </label>
          <div className="mt-1">
            <SelectField
              value={d.billing_type}
              onChange={(v) => set("billing_type", v)}
              ariaLabel="Számlázás típusa"
              options={(Object.keys(BILLING_TYPE_LABEL) as BillingType[]).map((k) => ({
                value: k,
                label: BILLING_TYPE_LABEL[k],
              }))}
            />
          </div>
        </div>

        {field("billing_name", isCompany ? "Cégnév" : "Név", isCompany ? "pl. Prémium Ingatlanok Kft." : "pl. Nagy Anna", { wide: true })}

        {isCompany && field("billing_tax_number", "Adószám", "pl. 12345678-2-42", { wide: true })}

        {field("billing_zip", "Irányítószám", "1051")}
        {field("billing_city", "Város", "Budapest")}
        {field("billing_address", "Utca, házszám", "Példa utca 12.", { wide: true })}
        {field("billing_country", "Ország", "Magyarország")}
        {field("billing_email", "Számlázási e-mail (nem kötelező)", "szamla@pelda.hu", { type: "email" })}
      </div>

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
