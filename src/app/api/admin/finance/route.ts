// /api/admin/finance — ajánlatok, fizetési tételek, Pénzügy lista és CSV (CSAK admin; terv 19).
//   GET ?company=<id>  → { quotes, payments, modules, billing }    (a cég Pénzügy ablaka)
//   GET                 → { payments, expiring, companies }          (Admin → Pénzügy)
//   GET ?csv=<tab>      → CSV (BOM-mal, pontosvesszővel — az Excel ékezetesen nyitja)
//   POST { action, … }  → frissített adat (ugyanaz, mint a GET, a company paraméter szerint):
//     quote_create { companyId, cmId?, title, amountNet, vat, validUntil?, note? } · quote_status { quoteId, status }
//     quote_accept { quoteId, items: [{kind, milestone?, description?, amount_net, due_date?, period_from?, period_to?}] }
//     payment_add { companyId, cmId?, kind, description, amountNet, vat, due?, periodFrom?, periodTo? }
//     invoiced { paymentId, invoice, issued? } · paid { paymentId, paid?, method } · close { paymentId, status, reason }
//     billing { companyId, name, taxNumber, address, email }
// A cégvezető és a felhasználó semmilyen pénzügyi adatot nem lát (API 403 + RLS).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import { moduleName } from "@/lib/module-registry";
import {
  FINANCE_ERR, FINANCE_MIGRATION, METHOD, MILESTONE, PAYMENT_KIND, PAYMENT_STATUS,
  type ExpiringModule, type Payment, type PaymentKind, type PaymentStatus, type Quote, type QuoteStatus,
} from "@/lib/finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getStaffRole(await createClient());
  return staff && staff.role === "admin" ? staff : null;
}
const missing = (m: string) => /company_quotes|company_payments|expiry_|function .* does not exist/i.test(m);
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(new Date());

async function loadPayments(companyId?: string): Promise<Payment[]> {
  const admin = createAdminClient();
  let q = admin.from("company_payments").select("*").order("created_at", { ascending: false }).limit(1000);
  if (companyId) q = q.eq("company_id", companyId);
  const [{ data, error }, { data: comps }, { data: mods }] = await Promise.all([
    q, admin.from("companies").select("id, name"), admin.from("company_modules").select("id, module_key"),
  ]);
  if (error) throw new Error(error.message);
  const cn = new Map((comps ?? []).map((c) => [c.id as string, c.name as string]));
  const mn = new Map((mods ?? []).map((m) => [m.id as string, moduleName(m.module_key as string)]));
  const today = todayKey();
  return (data ?? []).map((r) => ({
    id: r.id, companyId: r.company_id, companyName: cn.get(r.company_id) ?? "—", companyModuleId: r.company_module_id,
    moduleName: r.company_module_id ? mn.get(r.company_module_id) ?? null : null, quoteId: r.quote_id, kind: r.kind as PaymentKind,
    milestone: r.milestone, description: r.description, amountNet: r.amount_net, vatRate: Number(r.vat_rate), amountGross: r.amount_gross,
    status: r.status as PaymentStatus, dueDate: r.due_date, invoiceNumber: r.invoice_number, invoiceIssuedAt: r.invoice_issued_at,
    paidAt: r.paid_at, method: r.payment_method, periodFrom: r.period_from, periodTo: r.period_to, reason: r.status_reason,
    createdAt: r.created_at, overdue: ["esedekes", "kiszamlazva"].includes(r.status) && !!r.due_date && r.due_date < today,
  }));
}

async function companyPayload(companyId: string) {
  const admin = createAdminClient();
  const [{ data: qs, error }, payments, { data: mods }, { data: c }] = await Promise.all([
    admin.from("company_quotes").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
    loadPayments(companyId),
    admin.from("company_modules").select("id, module_key").eq("company_id", companyId),
    admin.from("companies").select("name, billing_name, billing_tax_number, billing_address, billing_email").eq("id", companyId).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  const quotes: Quote[] = (qs ?? []).map((r) => ({
    id: r.id, companyId: r.company_id, companyModuleId: r.company_module_id, title: r.title, amountNet: r.amount_net,
    vatRate: Number(r.vat_rate), validUntil: r.valid_until, status: r.status as QuoteStatus, note: r.note, createdAt: r.created_at,
  }));
  return {
    migrated: true, quotes, payments,
    modules: (mods ?? []).map((m) => ({ id: m.id as string, name: moduleName(m.module_key as string) })),
    billing: { name: c?.billing_name ?? "", taxNumber: c?.billing_tax_number ?? "", address: c?.billing_address ?? "", email: c?.billing_email ?? "" },
  };
}

async function overviewPayload() {
  const admin = createAdminClient();
  const payments = await loadPayments();
  const today = todayKey();
  const { data: mods } = await admin.from("company_modules").select("id, company_id, module_key, valid_until").eq("state", "aktiv").not("valid_until", "is", null);
  const { data: comps } = await admin.from("companies").select("id, name").order("name");
  const cn = new Map((comps ?? []).map((c) => [c.id as string, c.name as string]));
  const expiring: ExpiringModule[] = (mods ?? []).map((m) => {
    const days = Math.round((new Date((m.valid_until as string) + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 86400000);
    const last = payments.find((p) => p.companyModuleId === m.id && p.kind === "havi_dij");
    return { id: m.id as string, companyName: cn.get(m.company_id as string) ?? "—", moduleName: moduleName(m.module_key as string),
      validUntil: m.valid_until as string, daysLeft: days, lastPayment: last ? PAYMENT_STATUS[last.status].label : null };
  }).filter((x) => x.daysLeft <= 14).sort((a, b) => a.daysLeft - b.daysLeft);
  return { migrated: true, payments, expiring, companies: (comps ?? []).map((c) => ({ id: c.id as string, name: c.name as string })) };
}

function csv(payments: Payment[]): string {
  const head = ["Cég", "Modul", "Típus", "Mérföldkő", "Leírás", "Nettó (Ft)", "ÁFA %", "Bruttó (Ft)", "Állapot", "Esedékes", "Számlaszám", "Számla kelte", "Fizetve", "Fizetési mód", "Időszak"];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = payments.map((p) => [
    p.companyName, p.moduleName ?? "", PAYMENT_KIND[p.kind], p.milestone ? MILESTONE[p.milestone] : "", p.description, p.amountNet, p.vatRate,
    p.amountGross, PAYMENT_STATUS[p.status].label, p.dueDate ?? "", p.invoiceNumber ?? "", p.invoiceIssuedAt ?? "", p.paidAt ?? "",
    p.method ? METHOD[p.method] : "", p.periodFrom ? `${p.periodFrom} – ${p.periodTo}` : "",
  ].map(cell).join(";"));
  return "﻿" + [head.map(cell).join(";"), ...rows].join("\r\n");
}

export async function GET(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  const sp = new URL(request.url).searchParams;
  try {
    const tab = sp.get("csv");
    if (tab) {
      const all = await loadPayments(sp.get("company") || undefined);
      const list = tab === "all" ? all : all.filter((p) => p.status === tab);
      return new NextResponse(csv(list), { headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="twinx-penzugy-${tab}-${todayKey()}.csv"`,
      } });
    }
    const company = sp.get("company");
    return NextResponse.json(company ? await companyPayload(company) : await overviewPayload());
  } catch (e) {
    const m = (e as Error).message;
    return NextResponse.json({ migrated: !missing(m), error: missing(m) ? `Futtasd le a ${FINANCE_MIGRATION} migrációt.` : m }, { status: missing(m) ? 200 : 500 });
  }
}

export async function POST(request: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const admin = createAdminClient();
  const actor = staff.userId;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const int = (v: unknown) => (v === null || v === "" || v === undefined ? null : Number.isFinite(Number(v)) ? Math.round(Number(v)) : NaN);
  let companyId = str(b.companyId);
  let res: { data: unknown; error: { message: string } | null };
  let notice = "Mentve.";

  const companyOf = async (table: "company_quotes" | "company_payments", id: string) =>
    ((await admin.from(table).select("company_id").eq("id", id).maybeSingle()).data?.company_id as string | undefined) ?? "";

  switch (String(b.action ?? "")) {
    case "quote_create": {
      const amt = int(b.amountNet);
      if (amt === null || Number.isNaN(amt) || amt < 0) return NextResponse.json({ error: "A nettó összeg nem negatív egész Ft." }, { status: 422 });
      res = await admin.rpc("quote_create", { p_actor: actor, p_company: companyId, p_cm: str(b.cmId) || null, p_title: str(b.title),
        p_amount_net: amt, p_vat: Number(b.vat ?? 27), p_valid_until: date(b.validUntil), p_note: str(b.note) });
      notice = "Ajánlat rögzítve (Vázlat).";
      break;
    }
    case "quote_status":
      companyId = await companyOf("company_quotes", str(b.quoteId));
      res = await admin.rpc("quote_update_status", { p_actor: actor, p_quote: str(b.quoteId), p_status: str(b.status) });
      notice = "Ajánlat állapota módosítva.";
      break;
    case "quote_accept":
      companyId = await companyOf("company_quotes", str(b.quoteId));
      res = await admin.rpc("quote_accept", { p_actor: actor, p_quote: str(b.quoteId), p_items: Array.isArray(b.items) ? b.items : [] });
      notice = "Ajánlat elfogadva, a fizetési tételek létrejöttek.";
      break;
    case "payment_add": {
      const amt = int(b.amountNet);
      if (amt === null || Number.isNaN(amt) || amt < 0) return NextResponse.json({ error: "A nettó összeg nem negatív egész Ft." }, { status: 422 });
      res = await admin.rpc("payment_add", { p_actor: actor, p_company: companyId, p_cm: str(b.cmId) || null, p_kind: str(b.kind),
        p_description: str(b.description), p_amount_net: amt, p_vat: Number(b.vat ?? 27), p_due: date(b.due),
        p_period_from: date(b.periodFrom), p_period_to: date(b.periodTo) });
      notice = "Fizetési tétel rögzítve (Esedékes).";
      break;
    }
    case "invoiced":
      companyId = await companyOf("company_payments", str(b.paymentId));
      res = await admin.rpc("payment_set_invoiced", { p_actor: actor, p_payment: str(b.paymentId), p_invoice: str(b.invoice), p_issued: date(b.issued) });
      notice = "Számlaszám rögzítve (Kiszámlázva).";
      break;
    case "paid":
      companyId = await companyOf("company_payments", str(b.paymentId));
      res = await admin.rpc("payment_mark_paid", { p_actor: actor, p_payment: str(b.paymentId), p_paid: date(b.paid), p_method: str(b.method) });
      notice = "Fizetve.";
      break;
    case "close":
      companyId = await companyOf("company_payments", str(b.paymentId));
      res = await admin.rpc("payment_close", { p_actor: actor, p_payment: str(b.paymentId), p_status: str(b.status), p_reason: str(b.reason) });
      notice = "Tétel lezárva.";
      break;
    case "billing": {
      const { error } = await admin.from("companies").update({
        billing_name: str(b.name) || null, billing_tax_number: str(b.taxNumber) || null,
        billing_address: str(b.address) || null, billing_email: str(b.email) || null, updated_at: new Date().toISOString(),
      }).eq("id", companyId);
      res = { data: { ok: !error }, error };
      if (!error) await admin.from("access_audit_log").insert({ actor_id: actor, action: "szamlazasi_adatok", company_id: companyId });
      notice = "Számlázási adatok mentve.";
      break;
    }
    default:
      return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });
  }
  if (res.error) return NextResponse.json({ error: missing(res.error.message) ? `Futtasd le a ${FINANCE_MIGRATION} migrációt.` : res.error.message }, { status: 500 });
  const r = res.data as { ok: boolean; error?: string; sum?: number; quote?: number; valid_until?: string | null };
  if (!r.ok) {
    const msg = FINANCE_ERR[r.error ?? ""] ?? "Nem sikerült.";
    return NextResponse.json({ error: r.error === "osszeg_elter" ? `${msg} (tételek: ${r.sum?.toLocaleString("hu-HU")} Ft, ajánlat: ${r.quote?.toLocaleString("hu-HU")} Ft)` : msg }, { status: 422 });
  }
  if (r.valid_until) notice = `Fizetve — a modul érvényessége: ${r.valid_until}.`;
  const body = b.scope === "overview" ? await overviewPayload() : await companyPayload(companyId);
  return NextResponse.json({ ...body, notice });
}
