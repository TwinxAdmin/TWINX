// Számlázz.hu Számla Agent — automatikus számla a bankkártyás kreditvásárlás után. CSAK szerveroldal.
// Dokumentáció: https://docs.szamlazz.hu/agent/ (XML + XSD: xmlszamla.xsd — a mezők SORRENDJE kötött).
// A számla az EV Számlázz.hu fiókjában készül (az eladó adatai a fiókból jönnek), kifizetettként, e-számlaként;
// a vevőnek a Számlázz.hu küldi el e-mailben. A beállítások (ÁFA-kód, megnevezés, fizetési mód, levélszöveg) környezeti
// változókból jönnek — üzleti érték nincs a kódban.
import type { BillingInfo } from "@/lib/billing";

const ENDPOINT = "https://www.szamlazz.hu/szamla/";
const TIMEOUT_MS = 25_000;

/** A számlázás beállításai (Vercel környezeti változók; az alapértékek a mostani EV-nek szólnak). */
export function invoicingConfig() {
  return {
    agentKey: process.env.SZAMLAZZ_AGENT_KEY ?? "",
    /** ÁFA-kulcs a Számlázz.hu jelölésével: „AAM" (alanyi adómentes) vagy szám (pl. „27"). */
    vatCode: process.env.INVOICE_VAT_CODE ?? "AAM",
    itemName: process.env.INVOICE_ITEM_NAME ?? "TWINX kreditcsomag",
    paymentMethod: process.env.INVOICE_PAYMENT_METHOD ?? "Bankkártya",
    /** Számlaszám-előtag (ha a Számlázz.hu fiókban külön előtagot használsz a webes eladásokhoz). */
    prefix: process.env.INVOICE_NUMBER_PREFIX ?? "",
    emailSubject: process.env.INVOICE_EMAIL_SUBJECT ?? "TWINX — számla a kreditvásárlásodról",
    emailText:
      process.env.INVOICE_EMAIL_TEXT ??
      "Köszönjük a vásárlást! Mellékelten küldjük a számlát. A krediteket már jóváírtuk a TWINX-fiókodban.",
    comment: process.env.INVOICE_COMMENT ?? "Bankkártyával kifizetve (Stripe).",
  };
}

export type InvoiceInput = {
  /** A Stripe Checkout session azonosítója — rendelésszám és külső azonosító a számlán. */
  sessionId: string;
  credits: number;
  /** A ténylegesen fizetett (bruttó) összeg forintban. */
  amountHuf: number;
  billing: BillingInfo;
  /** Ha a számlázási e-mail üres, ide küldjük (a fiók e-mail címe). */
  fallbackEmail: string | null;
};

export type InvoiceResult =
  | { status: "issued"; invoiceNumber: string }
  /** A Számlázz.hu egyértelműen elutasította → javítás után újrapróbálható. */
  | { status: "failed"; error: string }
  /** Nem tudjuk, elkészült-e (hálózati hiba, időtúllépés, értelmezhetetlen válasz) → kézi ellenőrzés, NEM próbáljuk újra. */
  | { status: "uncertain"; error: string };

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Budapesti dátum (ÉÉÉÉ-HH-NN) — a számla kelte és teljesítése. */
function todayBudapest(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest" }).format(new Date());
}

/** Nettó / ÁFA / bruttó az ÁFA-kódból: AAM-nél nincs ÁFA; számkulcsnál a bruttóból visszaszámolva. */
export function splitAmount(grossHuf: number, vatCode: string): { net: number; vat: number; gross: number } {
  const gross = Math.round(grossHuf);
  const rate = Number(vatCode);
  if (!Number.isFinite(rate) || rate <= 0) return { net: gross, vat: 0, gross };
  const net = Math.round(gross / (1 + rate / 100));
  return { net, vat: gross - net, gross };
}

/** A számla XML-je (a mezők sorrendje az XSD szerint kötött). */
export function buildInvoiceXml(input: InvoiceInput, cfg = invoicingConfig()): string {
  const b = input.billing;
  const company = b.billing_type === "company";
  const date = todayBudapest();
  const { net, vat, gross } = splitAmount(input.amountHuf, cfg.vatCode);
  const country = (company ? b.billing_company_country : b.billing_country) || "Magyarország";
  const email = (b.billing_email || input.fallbackEmail || "").trim();

  const buyer = company
    ? { nev: b.billing_company_name, irsz: b.billing_company_zip, telepules: b.billing_company_city, cim: b.billing_company_address }
    : { nev: b.billing_name, irsz: b.billing_zip, telepules: b.billing_city, cim: b.billing_address };

  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${esc(cfg.agentKey)}</szamlaagentkulcs>
    <eszamla>true</eszamla>
    <szamlaLetoltes>false</szamlaLetoltes>
    <valaszVerzio>1</valaszVerzio>
    <szamlaKulsoAzon>${esc(input.sessionId)}</szamlaKulsoAzon>
  </beallitasok>
  <fejlec>
    <keltDatum>${date}</keltDatum>
    <teljesitesDatum>${date}</teljesitesDatum>
    <fizetesiHataridoDatum>${date}</fizetesiHataridoDatum>
    <fizmod>${esc(cfg.paymentMethod)}</fizmod>
    <penznem>HUF</penznem>
    <szamlaNyelve>hu</szamlaNyelve>
    <megjegyzes>${esc(cfg.comment)}</megjegyzes>
    <rendelesSzam>${esc(input.sessionId.slice(-24))}</rendelesSzam>${cfg.prefix ? `
    <szamlaszamElotag>${esc(cfg.prefix)}</szamlaszamElotag>` : ""}
    <fizetve>true</fizetve>
  </fejlec>
  <elado>
    <emailTargy>${esc(cfg.emailSubject)}</emailTargy>
    <emailSzoveg>${esc(cfg.emailText)}</emailSzoveg>
  </elado>
  <vevo>
    <nev>${esc(buyer.nev)}</nev>${country !== "Magyarország" ? `
    <orszag>${esc(country)}</orszag>` : ""}
    <irsz>${esc(buyer.irsz)}</irsz>
    <telepules>${esc(buyer.telepules)}</telepules>
    <cim>${esc(buyer.cim)}</cim>${email ? `
    <email>${esc(email)}</email>
    <sendEmail>true</sendEmail>` : `
    <sendEmail>false</sendEmail>`}
    <adoalany>${company ? 1 : -1}</adoalany>${company && b.billing_tax_number ? `
    <adoszam>${esc(b.billing_tax_number)}</adoszam>` : ""}${company && b.billing_name ? `
    <megjegyzes>${esc(`Kapcsolattartó: ${b.billing_name}`)}</megjegyzes>` : ""}
  </vevo>
  <tetelek>
    <tetel>
      <megnevezes>${esc(`${cfg.itemName} — ${input.credits} kredit`)}</megnevezes>
      <mennyiseg>1</mennyiseg>
      <mennyisegiEgyseg>csomag</mennyisegiEgyseg>
      <nettoEgysegar>${net}</nettoEgysegar>
      <afakulcs>${esc(cfg.vatCode)}</afakulcs>
      <nettoErtek>${net}</nettoErtek>
      <afaErtek>${vat}</afaErtek>
      <bruttoErtek>${gross}</bruttoErtek>
      <megjegyzes>${esc(`A kreditek nem járnak le. Azonnali teljesítés (a krediteket a fizetéskor jóváírtuk).`)}</megjegyzes>
    </tetel>
  </tetelek>
</xmlszamla>`;
}

/** Számla kiállítása a Számla Agenttel. Soha nem dob kivételt: az eredmény állapota mondja meg, mi a teendő. */
export async function issueInvoice(input: InvoiceInput): Promise<InvoiceResult> {
  const cfg = invoicingConfig();
  if (!cfg.agentKey) return { status: "failed", error: "Hiányzó SZAMLAZZ_AGENT_KEY (a Vercel környezeti változói közt)." };

  const form = new FormData();
  form.append("action-xmlagentxmlfile", new Blob([buildInvoiceXml(input, cfg)], { type: "application/xml" }), "szamla.xml");

  let res: Response;
  try {
    res = await fetch(ENDPOINT, { method: "POST", body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    return { status: "uncertain", error: `Nem érkezett válasz a Számlázz.hu-tól: ${e instanceof Error ? e.message : String(e)}` };
  }

  const decode = (v: string | null) => {
    if (!v) return "";
    try { return decodeURIComponent(v.replace(/\+/g, " ")); } catch { return v; }
  };
  const number = decode(res.headers.get("szlahu_szamlaszam"));
  const errCode = res.headers.get("szlahu_error_code");
  const body = await res.text().catch(() => "");

  if (number) return { status: "issued", invoiceNumber: number };
  const done = body.match(/xmlagentresponse=DONE;(.+)/);
  if (done) return { status: "issued", invoiceNumber: done[1].trim() };
  if (errCode || body.startsWith("[ERR]")) {
    const msg = decode(res.headers.get("szlahu_error")) || body.slice(0, 300);
    return { status: "failed", error: `Számlázz.hu hiba${errCode ? ` (${errCode})` : ""}: ${msg}` };
  }
  return { status: "uncertain", error: `Értelmezhetetlen válasz (HTTP ${res.status}): ${body.slice(0, 200)}` };
}
