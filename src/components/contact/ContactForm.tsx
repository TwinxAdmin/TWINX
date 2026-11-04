// ContactForm — üzenetküldés a /kapcsolat oldalon (POST /api/contact). Bejelentkezve a név és az e-mail előre kitöltve.
// Fix magasságú kártya: elküldés után ugyanott a köszönő állapot jelenik meg (nem ugrik az oldal).
"use client";

import { useState } from "react";
import SelectField from "@/components/SelectField";
import { CONTACT_ERROR_EN, CONTACT_TOPIC_EN, CONTACT_TOPICS, validateContact, type ContactInput } from "@/lib/contact";
import type { Lang } from "@/lib/lang";

type Errors = Partial<Record<keyof ContactInput, string>>;

const TEXT = {
  hu: {
    failed: "Nem sikerült elküldeni.", thanks: "Köszönjük, megkaptuk!", replyA: "Hamarosan válaszolunk a(z) ", replyB: " címre", replyPhone: ", vagy visszahívunk", again: "Új üzenet",
    title: "Írj nekünk", lead: "Az üzenet közvetlenül hozzánk érkezik — e-mailben válaszolunk, vagy ha megadod a számod, visszahívunk.",
    name: "Név *", email: "E-mail *", phone: "Telefon (ha visszahívást kérsz)", topic: "Miben segíthetünk? *", topicPh: "— válassz témát —", topicAria: "Téma",
    message: "Üzenet *", messagePh: "Írd le röviden, miben segíthetünk…", privacy: "Az adataidat csak a válaszhoz használjuk.", sending: "Küldés…", send: "Üzenet küldése",
  },
  en: {
    failed: "Sending failed. Please try again.", thanks: "Thank you, we got it!", replyA: "We will reply to ", replyB: " soon", replyPhone: " or call you back", again: "New message",
    title: "Write to us", lead: "Your message comes straight to us. We reply by email, or call you back if you add your number.",
    name: "Name *", email: "Email *", phone: "Phone (if you'd like a call back)", topic: "What is it about? *", topicPh: "Choose a topic", topicAria: "Topic",
    message: "Message *", messagePh: "Tell us briefly how we can help…", privacy: "We only use your details to reply.", sending: "Sending…", send: "Send message",
  },
};

export default function ContactForm({ initialName = "", initialEmail = "", lang = "hu" }: { initialName?: string; initialEmail?: string; lang?: Lang }) {
  const tx = TEXT[lang];
  /** A hibaüzenetek forrása magyar (közös ellenőrzés); angolul mezőnként a saját szöveg. */
  const localized = (e: Errors): Errors => lang === "en" ? Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v ? CONTACT_ERROR_EN[k] : v])) as Errors : e;
  const [v, setV] = useState<ContactInput>({ name: initialName, email: initialEmail, phone: "", topic: "", message: "" });
  const [website, setWebsite] = useState(""); // csali mező (robotoknak)
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [fail, setFail] = useState<string | null>(null);

  const set = (k: keyof ContactInput) => (val: string) => { setV((s) => ({ ...s, [k]: val })); setErrors((e) => ({ ...e, [k]: undefined })); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFail(null);
    const check = validateContact(v);
    if (!check.valid) { setErrors(localized(check.errors)); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...check.value, website, lang }) });
      const d = await res.json().catch(() => ({}));
      if (res.status === 422) { setErrors(localized(d.errors ?? {})); return; }
      if (!res.ok) throw new Error((lang === "hu" && d.error) || tx.failed);
      setSent(true);
    } catch (err) {
      setFail((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 rounded-[20px] bg-white p-8 text-center" style={{ boxShadow: "0 0 0 1px var(--twx-line)" }}>
        <span className="flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ background: "#E6F2EA", color: "#1F6B3E" }}>✓</span>
        <h2 className="font-display text-2xl font-bold">{tx.thanks}</h2>
        <p className="max-w-sm text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
          {tx.replyA}<b style={{ color: "var(--twx-ink)" }}>{v.email}</b>{tx.replyB}{v.phone ? tx.replyPhone : ""}.
        </p>
        <button type="button" onClick={() => { setSent(false); setV((s) => ({ ...s, topic: "", message: "" })); }}
          className="mt-2 h-10 rounded-full px-5 text-sm font-semibold" style={{ background: "#fff", boxShadow: "inset 0 0 0 1px #d9cfc4" }}>
          {tx.again}
        </button>
      </div>
    );
  }

  const label = "block text-xs font-semibold";
  const err = (k: keyof ContactInput) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>;

  return (
    <form onSubmit={submit} noValidate className="min-h-[520px] space-y-4 rounded-[20px] bg-white p-6 sm:p-7" style={{ boxShadow: "0 0 0 1px var(--twx-line), 0 10px 26px rgba(28,24,21,.05)" }}>
      <div>
        <h2 className="font-display text-xl font-bold">{tx.title}</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--twx-ink-muted)" }}>{tx.lead}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className={label} style={{ color: "var(--twx-ink-muted)" }}>{tx.name}</label>
          <input id="c-name" value={v.name} onChange={(e) => set("name")(e.target.value)} autoComplete="name" className="twx-input mt-1" />
          {err("name")}
        </div>
        <div>
          <label htmlFor="c-email" className={label} style={{ color: "var(--twx-ink-muted)" }}>{tx.email}</label>
          <input id="c-email" type="email" value={v.email} onChange={(e) => set("email")(e.target.value)} autoComplete="email" className="twx-input mt-1" />
          {err("email")}
        </div>
        <div>
          <label htmlFor="c-phone" className={label} style={{ color: "var(--twx-ink-muted)" }}>{tx.phone}</label>
          <input id="c-phone" type="tel" value={v.phone} onChange={(e) => set("phone")(e.target.value)} autoComplete="tel" placeholder="+36 30 123 4567" className="twx-input mt-1" />
          {err("phone")}
        </div>
        <div>
          <span className={label} style={{ color: "var(--twx-ink-muted)" }}>{tx.topic}</span>
          <div className="mt-1">
            <SelectField value={v.topic} onChange={set("topic")} placeholder={tx.topicPh} ariaLabel={tx.topicAria}
              options={CONTACT_TOPICS.map((t) => ({ value: t, label: lang === "en" ? CONTACT_TOPIC_EN[t] ?? t : t }))} />
          </div>
          {err("topic")}
        </div>
      </div>
      <div>
        <label htmlFor="c-msg" className={label} style={{ color: "var(--twx-ink-muted)" }}>{tx.message}</label>
        <textarea id="c-msg" value={v.message} onChange={(e) => set("message")(e.target.value.slice(0, 3000))} rows={6}
          placeholder={tx.messagePh} className="twx-input mt-1 resize-none" />
        {err("message")}
      </div>
      {/* csali mező — ember nem látja */}
      <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden className="hidden" name="website" />
      {fail && <p className="rounded-xl p-3 text-sm" style={{ background: "#F7E1DC", color: "#8E2F1C" }}>{fail}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{tx.privacy}</p>
        <button type="submit" disabled={busy} className="h-11 rounded-full px-6 text-sm font-bold text-white disabled:opacity-60" style={{ background: "#c4553a" }}>
          {busy ? tx.sending : tx.send}
        </button>
      </div>
    </form>
  );
}
