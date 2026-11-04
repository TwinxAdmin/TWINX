// „Küldd el az ötleted" gomb + kis felugró üzenetablak: új modul ötlete (POST /api/contact, „Ötlet egy új modulra" témával —
// az Admin „Kérések és üzenetek" listájába és e-mailben érkezik). Fix méretű ablak: elküldés után ugyanott a köszönő állapot.
"use client";

import { useEffect, useRef, useState } from "react";
import { CONTACT_ERROR_EN, MODULE_IDEA_TOPIC, validateContact, type ContactInput } from "@/lib/contact";
import type { Lang } from "@/lib/lang";

type Errors = Partial<Record<keyof ContactInput, string>>;

const TEXT = {
  hu: {
    aria: "Ötlet küldése egy új modulra", title: "Van egy ötleted egy új modulra?", close: "Bezárás", thanks: "Köszönöm, megkaptam!", replyA: "Átnézem az ötleted, és a(z) ", replyB: " címen jelentkezem.",
    lead: "Írd le pár mondatban, milyen feladatot oldana meg, és kinek segítene. A részleteket utána átbeszéljük.", name: "Név *", email: "E-mail *", field: "Szakterületed", fieldPh: "pl. könyvelés, jog, építőipar",
    fieldNote: "Szakterület", idea: "Az ötleted *", ideaPh: "Milyen feladatot oldana meg a modul? Kinek segítene?", sending: "Küldés…", send: "Ötlet elküldése", privacy: "Az adataidat csak a válaszhoz használom.", failed: "Nem sikerült elküldeni.",
  },
  en: {
    aria: "Send an idea for a new module", title: "Got an idea for a new module?", close: "Close", thanks: "Thank you, I got it!", replyA: "I'll review your idea and get back to you at ", replyB: ".",
    lead: "Tell me in a few sentences what task it would solve and who it would help. We can discuss the details afterwards.", name: "Name *", email: "Email *", field: "Your field", fieldPh: "e.g. accounting, law, construction",
    fieldNote: "Szakterület", idea: "Your idea *", ideaPh: "What task would the module solve? Who would it help?", sending: "Sending…", send: "Send idea", privacy: "I only use your details to reply.", failed: "Sending failed. Please try again.",
  },
};

export default function ModuleIdeaButton({ className, style, children, lang = "hu" }: { className?: string; style?: React.CSSProperties; children: React.ReactNode; lang?: Lang }) {
  const tx = TEXT[lang];
  const localized = (e: Errors): Errors => lang === "en" ? Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v ? CONTACT_ERROR_EN[k] : v])) as Errors : e;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [field, setField] = useState("");
  const [idea, setIdea] = useState("");
  const [website, setWebsite] = useState(""); // csali mező (robotoknak)
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [open]);

  function show() {
    setOpen(true);
    setErrors({});
    setFail(null);
    if (sent) { setSent(false); setField(""); setIdea(""); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFail(null);
    const fieldNote = field.trim();
    const check = validateContact({ name, email, phone: "", topic: MODULE_IDEA_TOPIC, message: idea });
    if (!check.valid) { setErrors(localized(check.errors)); return; }
    const message = fieldNote ? `${tx.fieldNote}: ${fieldNote}\n\n${check.value.message}` : check.value.message;
    setBusy(true);
    try {
      const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...check.value, message, website, lang }) });
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

  const label = "block text-xs font-semibold";
  const err = (k: keyof ContactInput) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>;

  return (
    <>
      <button type="button" onClick={show} className={className} style={style}>{children}</button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(20,12,8,.6)" }} onClick={() => setOpen(false)}
          role="dialog" aria-modal="true" aria-label={tx.aria}>
          <div className="max-h-[92vh] min-h-[500px] w-full max-w-[480px] overflow-y-auto rounded-3xl p-6 sm:p-7" style={{ background: "var(--twx-cream-card)", color: "var(--twx-ink)", boxShadow: "0 30px 80px rgba(0,0,0,.45)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl font-bold leading-tight">{tx.title}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={tx.close} className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-lg" style={{ boxShadow: "inset 0 0 0 1px var(--twx-line)" }}>×</button>
            </div>
            {sent ? (
              <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ background: "#E6F2EA", color: "#1F6B3E" }}>✓</span>
                <p className="font-display text-xl font-bold">{tx.thanks}</p>
                <p className="max-w-xs text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
                  {tx.replyA}<b style={{ color: "var(--twx-ink)" }}>{email}</b>{tx.replyB}
                </p>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="mt-2 space-y-3.5">
                <p className="text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>{tx.lead}</p>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="idea-name" className={label} style={{ color: "var(--twx-ink-muted)" }}>{tx.name}</label>
                    <input ref={firstField} id="idea-name" value={name} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })); }} autoComplete="name" className="twx-input mt-1" />
                    {err("name")}
                  </div>
                  <div>
                    <label htmlFor="idea-email" className={label} style={{ color: "var(--twx-ink-muted)" }}>{tx.email}</label>
                    <input id="idea-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((x) => ({ ...x, email: undefined })); }} autoComplete="email" className="twx-input mt-1" />
                    {err("email")}
                  </div>
                </div>
                <div>
                  <label htmlFor="idea-field" className={label} style={{ color: "var(--twx-ink-muted)" }}>{tx.field}</label>
                  <input id="idea-field" value={field} maxLength={120} onChange={(e) => setField(e.target.value)} placeholder={tx.fieldPh} className="twx-input mt-1" />
                </div>
                <div>
                  <label htmlFor="idea-text" className={label} style={{ color: "var(--twx-ink-muted)" }}>{tx.idea}</label>
                  <textarea id="idea-text" value={idea} onChange={(e) => { setIdea(e.target.value.slice(0, 2800)); setErrors((x) => ({ ...x, message: undefined })); }} rows={5}
                    placeholder={tx.ideaPh} className="twx-input mt-1 resize-none" />
                  {err("message")}
                </div>
                {/* csali mező — ember nem látja */}
                <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} aria-hidden className="hidden" name="website" />
                {fail && <p className="rounded-xl p-3 text-sm" style={{ background: "#F7E1DC", color: "#8E2F1C" }}>{fail}</p>}
                <button type="submit" disabled={busy} className="h-12 w-full rounded-full text-[15px] font-bold text-white disabled:opacity-60" style={{ background: "#c4553a" }}>
                  {busy ? tx.sending : tx.send}
                </button>
                <p className="text-center text-xs" style={{ color: "var(--twx-ink-muted)" }}>{tx.privacy}</p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
