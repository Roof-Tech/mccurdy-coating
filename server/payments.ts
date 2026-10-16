/**
 * Invoice payments.
 * - When STRIPE_SECRET_KEY is set, customers pay by card/ACH through Stripe Checkout,
 *   and invoices are marked paid only after Stripe confirms payment (webhook or
 *   server-side session lookup). A receipt is emailed and shown in the portal.
 * - Without Stripe, the customer button reads "Request a payment link" and only
 *   notifies the office; nothing claims a payment was collected.
 * - Admins can record offline payments (check, ACH, cash) with a reference number.
 */
import type { Express, Request } from "express";
import crypto from "crypto";
import { sqliteConnection as sqlite } from "./db";
import { requireAdmin } from "./admin-auth";
import { storage } from "./storage";
import { sendBrandedEmail, sendOwnerNotification } from "./proposal-email";

const APP_BASE_URL = process.env.APP_BASE_URL || "https://mccurdy-coatings.onrender.com";
const STRIPE_API = "https://api.stripe.com/v1";
export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;

for (const [col, def] of [["payment_method", "TEXT"], ["payment_reference", "TEXT"], ["receipt_number", "TEXT"], ["checkout_session_id", "TEXT"]]) {
  try { sqlite.exec(`ALTER TABLE invoices ADD COLUMN ${col} ${def};`); } catch { /* already exists */ }
}

type InvoiceRow = { id: string; proposal_id: number; amount: string; description: string; status: string; due_date: number | null; created_at: number; sent_at: number | null; paid_at: number | null; payment_method: string | null; payment_reference: string | null; receipt_number: string | null; checkout_session_id: string | null };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function amountToCents(amount: string): number | null {
  const n = Number(String(amount).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
const money = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const getInvoice = (id: string) => sqlite.prepare("SELECT * FROM invoices WHERE id = ?").get(id) as InvoiceRow | undefined;

export function toPublicInvoice(i: InvoiceRow) {
  return {
    id: i.id, amount: i.amount, description: i.description, status: i.status, dueDate: i.due_date,
    paidAt: i.paid_at, paymentMethod: i.payment_method, receiptNumber: i.receipt_number,
  };
}

async function stripe(path: string, method: "GET" | "POST", form?: Record<string, string>) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Stripe returned ${res.status}`);
  return data;
}

async function markPaid(invoiceId: string, method: string, reference: string | null) {
  const inv = getInvoice(invoiceId);
  if (!inv || inv.status === "paid") return inv;
  const receipt = `MCC-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const paidAt = Math.floor(Date.now() / 1000);
  sqlite.prepare("UPDATE invoices SET status = 'paid', paid_at = ?, payment_method = ?, payment_reference = ?, receipt_number = ? WHERE id = ?")
    .run(paidAt, method, reference, receipt, invoiceId);
  const p = storage.getProposal(inv.proposal_id);
  const cents = amountToCents(inv.amount) ?? 0;
  if (p?.customerEmail) {
    await sendBrandedEmail({
      to: p.customerEmail, customerName: p.customerName,
      subject: `Payment receipt ${receipt} — McCurdy Coatings`, title: "Payment received — thank you",
      body: `<table style="width:100%;border-collapse:collapse;font-size:14px"><tr><td style="padding:6px 0;color:#64748b">Receipt</td><td style="text-align:right"><b>${receipt}</b></td></tr><tr><td style="padding:6px 0;color:#64748b">For</td><td style="text-align:right">${esc(inv.description)}</td></tr><tr><td style="padding:6px 0;color:#64748b">Amount paid</td><td style="text-align:right"><b>${money(cents)}</b></td></tr><tr><td style="padding:6px 0;color:#64748b">Method</td><td style="text-align:right">${esc(method)}</td></tr><tr><td style="padding:6px 0;color:#64748b">Date</td><td style="text-align:right">${new Date(paidAt * 1000).toLocaleDateString("en-US")}</td></tr></table>`,
      actionLabel: "View receipt", actionUrl: `${APP_BASE_URL}/#/view/${p.accessToken}/invoices`,
    });
  }
  await sendOwnerNotification("Invoice paid", `<p>${esc(p?.customerName || "Customer")} paid ${money(cents)} (${esc(method)}). Receipt ${receipt}.</p>`);
  return getInvoice(invoiceId);
}

function verifyStripeSignature(req: Request): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const header = req.header("Stripe-Signature");
  const raw = (req as any).rawBody as Buffer | undefined;
  if (!secret || !header || !raw) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = parts.t; const sigs = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw.toString("utf8")}`).digest("hex");
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

export function registerPaymentRoutes(app: Express) {
  app.get("/api/payments/config", (_req, res) => res.json({ onlinePayments: stripeEnabled() }));

  app.get("/api/proposals/:token/invoices", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    const rows = sqlite.prepare("SELECT * FROM invoices WHERE proposal_id = ? AND status != 'draft' ORDER BY created_at DESC").all(p.id) as InvoiceRow[];
    res.json(rows.map(toPublicInvoice));
  });

  app.post("/api/proposals/:token/invoices/:id/checkout", async (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    const inv = getInvoice(req.params.id);
    if (!p || !inv || inv.proposal_id !== p.id) return res.status(404).json({ error: "Not found" });
    if (inv.status === "paid") return res.status(409).json({ error: "This invoice is already paid." });
    if (!stripeEnabled()) return res.status(503).json({ error: "Online payments aren't turned on yet. Use “Request a payment link.”" });
    const cents = amountToCents(inv.amount);
    if (!cents) return res.status(400).json({ error: "Invoice amount is invalid. Please contact McCurdy." });
    try {
      const back = `${APP_BASE_URL}/#/view/${p.accessToken}/invoices`;
      const session = await stripe("/checkout/sessions", "POST", {
        mode: "payment",
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(cents),
        "line_items[0][price_data][product_data][name]": inv.description.slice(0, 250),
        ...(p.customerEmail ? { customer_email: p.customerEmail } : {}),
        "metadata[invoice_id]": inv.id,
        "metadata[proposal_id]": String(p.id),
        "payment_intent_data[metadata][invoice_id]": inv.id,
        success_url: `${APP_BASE_URL}/?paid=${inv.id}&session_id={CHECKOUT_SESSION_ID}#/view/${p.accessToken}/invoices`,
        cancel_url: back,
      });
      sqlite.prepare("UPDATE invoices SET checkout_session_id = ? WHERE id = ?").run(session.id, inv.id);
      res.json({ url: session.url });
    } catch (e: any) {
      res.status(502).json({ error: `Payment page couldn't open: ${e.message}` });
    }
  });

  // Return-from-checkout confirmation (works even if the webhook is delayed).
  app.post("/api/proposals/:token/invoices/:id/confirm", async (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    const inv = getInvoice(req.params.id);
    if (!p || !inv || inv.proposal_id !== p.id) return res.status(404).json({ error: "Not found" });
    if (inv.status === "paid") return res.json(toPublicInvoice(inv));
    const sessionId = String(req.body?.sessionId || "");
    if (!stripeEnabled() || !sessionId || sessionId !== inv.checkout_session_id) return res.status(400).json({ error: "Payment not confirmed yet." });
    try {
      const s = await stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}`, "GET");
      if (s.payment_status !== "paid" || s.metadata?.invoice_id !== inv.id) return res.status(202).json({ status: "processing" });
      const updated = await markPaid(inv.id, "Card / bank (Stripe)", s.payment_intent || s.id);
      res.json(toPublicInvoice(updated!));
    } catch (e: any) { res.status(502).json({ error: e.message }); }
  });

  app.post("/api/stripe/webhook", async (req, res) => {
    if (!verifyStripeSignature(req)) return res.status(400).json({ error: "Invalid signature" });
    const event = req.body;
    if ((event?.type === "checkout.session.completed" || event?.type === "checkout.session.async_payment_succeeded") && event.data?.object?.payment_status === "paid") {
      const s = event.data.object;
      if (s.metadata?.invoice_id) await markPaid(s.metadata.invoice_id, "Card / bank (Stripe)", s.payment_intent || s.id);
    }
    res.json({ received: true });
  });

  app.post("/api/proposals/:token/invoices/:id/payment-interest", async (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    const inv = getInvoice(req.params.id);
    if (!p || !inv || inv.proposal_id !== p.id) return res.status(404).json({ error: "Not found" });
    await sendOwnerNotification("Payment link requested", `<p>${esc(p.customerName)} asked for a payment link for “${esc(inv.description)}” (${esc(inv.amount)}).</p>`);
    res.json({ success: true });
  });

  // ── Admin ──
  app.get("/api/admin/invoices", requireAdmin as any, (_req, res) => {
    const rows = sqlite.prepare("SELECT i.*, p.customer_name, p.proposal_number FROM invoices i JOIN proposals p ON p.id = i.proposal_id ORDER BY i.created_at DESC").all();
    res.json({ invoices: rows, onlinePayments: stripeEnabled() });
  });
  app.post("/api/admin/invoices", requireAdmin as any, (req, res) => {
    const { proposalId, amount, description, dueDate } = req.body || {};
    if (!storage.getProposal(Number(proposalId))) return res.status(400).json({ error: "Choose a proposal." });
    if (!amountToCents(String(amount))) return res.status(400).json({ error: "Enter an amount greater than $0." });
    if (typeof description !== "string" || !description.trim()) return res.status(400).json({ error: "Enter a description." });
    const id = crypto.randomUUID();
    sqlite.prepare("INSERT INTO invoices (id, proposal_id, amount, description, status, due_date, created_at) VALUES (?,?,?,?, 'draft', ?, unixepoch())")
      .run(id, Number(proposalId), money(amountToCents(String(amount))!), description.trim().slice(0, 300), dueDate ? Number(dueDate) : null);
    res.status(201).json(getInvoice(id));
  });
  app.post("/api/admin/invoices/:id/send", requireAdmin as any, async (req, res) => {
    const inv = getInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: "Not found" });
    const p = storage.getProposal(inv.proposal_id);
    sqlite.prepare("UPDATE invoices SET status = CASE WHEN status = 'paid' THEN 'paid' ELSE 'sent' END, sent_at = unixepoch() WHERE id = ?").run(inv.id);
    let email: { ok: boolean; error?: string } = { ok: false, error: "Customer has no email on file." };
    if (p?.customerEmail) email = await sendBrandedEmail({
      to: p.customerEmail, customerName: p.customerName, subject: `Invoice from McCurdy Coatings — ${inv.amount}`, title: "Your invoice is ready",
      body: `<p>${esc(inv.description)}: <b>${esc(inv.amount)}</b>${inv.due_date ? `, due ${new Date(inv.due_date * 1000).toLocaleDateString("en-US")}` : ""}.</p>`,
      actionLabel: stripeEnabled() ? "View & pay invoice" : "View invoice", actionUrl: `${APP_BASE_URL}/#/view/${p.accessToken}/invoices`,
    });
    res.json({ invoice: getInvoice(inv.id), email });
  });
  app.post("/api/admin/invoices/:id/record-payment", requireAdmin as any, async (req, res) => {
    const { method, reference } = req.body || {};
    if (!["Check", "ACH / bank transfer", "Cash", "Card (in person)", "Financing"].includes(method)) return res.status(400).json({ error: "Choose a payment method." });
    const inv = await markPaid(req.params.id, method, reference ? String(reference).slice(0, 120) : null);
    if (!inv) return res.status(404).json({ error: "Not found" });
    res.json(inv);
  });
  app.delete("/api/admin/invoices/:id", requireAdmin as any, (req, res) => {
    const inv = getInvoice(req.params.id);
    if (!inv) return res.status(404).json({ error: "Not found" });
    if (inv.status === "paid") return res.status(409).json({ error: "Paid invoices can't be deleted." });
    sqlite.prepare("DELETE FROM invoices WHERE id = ?").run(inv.id);
    res.json({ ok: true });
  });
}
