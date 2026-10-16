/**
 * Customer portal identity + post-approval flow.
 * - Optional passwordless verification: a 6-digit code emailed to the proposal's
 *   customer email. Once verified, a 90-day httpOnly cookie identifies that email,
 *   so the customer can see every property/proposal they have with McCurdy.
 *   Set CUSTOMER_VERIFY_REQUIRED=1 to require verification before signing.
 * - After signing: milestone invoices are drafted from the approved price using
 *   McCurdy's terms (no deposit; 50% when materials are loaded and cleaning &
 *   sealing is complete; 50% at completion), and the customer is emailed next
 *   steps with the Calendly link.
 * - Unpaid-invoice reminders: 7, 14 and 21 days after an invoice is sent.
 */
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { rateLimit } from "express-rate-limit";
import { sqliteConnection as sqlite } from "./db";
import { storage } from "./storage";
import { sendBrandedEmail, sendOwnerNotification } from "./proposal-email";
import { amountToCents, stripeEnabled } from "./payments";

const APP_BASE_URL = process.env.APP_BASE_URL || "https://mccurdy-coatings.onrender.com";
const CALENDLY = "https://calendly.com/mccurdycoatings";
const COOKIE = "mcc_cust";
const SESSION_DAYS = 90;
const now = () => Math.floor(Date.now() / 1000);
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const norm = (e?: string | null) => String(e || "").trim().toLowerCase();

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS customer_codes (
    proposal_id INTEGER PRIMARY KEY REFERENCES proposals(id),
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS customer_sessions (
    id_hash TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS signature_verifications (
    proposal_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    verified_at INTEGER NOT NULL
  );
`);
for (const [col, def] of [["reminder_count", "INTEGER NOT NULL DEFAULT 0"], ["last_reminder_at", "INTEGER"], ["milestone", "TEXT"]]) {
  try { sqlite.exec(`ALTER TABLE invoices ADD COLUMN ${col} ${def};`); } catch { /* exists */ }
}

function readCookie(req: Request, name: string): string | null {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
export function customerEmailFromSession(req: Request): string | null {
  const t = readCookie(req, COOKIE);
  if (!t) return null;
  const s = sqlite.prepare("SELECT email, expires_at FROM customer_sessions WHERE id_hash = ?").get(sha256(t)) as any;
  return s && s.expires_at > now() ? s.email : null;
}
export function isVerifiedFor(req: Request, proposal: { customerEmail?: string | null }): boolean {
  const email = customerEmailFromSession(req);
  return !!email && !!proposal.customerEmail && email === norm(proposal.customerEmail);
}
const mask = (e: string) => e.replace(/^(.)(.*)(.@.*)$/, (_m, a, b, c) => a + "•".repeat(Math.min(6, b.length)) + c);

// ── Post-sign flow (called from the /sign route) ──
export async function afterProposalSigned(req: Request, proposalId: number) {
  const p: any = storage.getProposal(proposalId);
  if (!p) return;
  if (p.customerEmail && isVerifiedFor(req, p)) sqlite.prepare("INSERT INTO signature_verifications (proposal_id, email, verified_at) VALUES (?,?,?)").run(p.id, norm(p.customerEmail), now());
  // Draft milestone invoices from the approved option price (only once).
  let total: number | null = null;
  try {
    const opts = JSON.parse(p.pricingOptions || "[]");
    const chosen = opts.find((o: any) => o.name === p.approvedOption) || (opts.length === 1 ? opts[0] : null);
    if (chosen) {
      const priceText = String(chosen.price ?? chosen.total ?? "");
      const first = priceText.match(/\d[\d,]*(?:\.\d+)?/)?.[0];
      const unit = first ? amountToCents(first) : null;
      if (unit && /sq\.?\s*ft|\/\s*sf\b|per\s*square/i.test(priceText)) {
        // Per-square-foot pricing (e.g. "$8.50/sq ft") × verified or listed roof area.
        const areas: string[] = (() => { try { return JSON.parse(p.roofAreas || "[]"); } catch { return []; } })();
        const sqft = Number(p.verifiedSqft) || areas.reduce((sum, x) => sum + Number((String(x).match(/[\d,]+(?=\s*sq\s*ft)/i)?.[0] || "0").replace(/,/g, "")), 0);
        total = sqft > 0 ? Math.round((unit * sqft)) : null;
      } else total = unit;
    }
  } catch { /* no options */ }
  const existing = (sqlite.prepare("SELECT COUNT(*) AS n FROM invoices WHERE proposal_id = ? AND milestone IS NOT NULL").get(p.id) as { n: number }).n;
  if (total && !existing) {
    const first = Math.round(total / 2), second = total - first;
    const fmt = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
    const ins = sqlite.prepare("INSERT INTO invoices (id, proposal_id, amount, description, status, created_at, milestone) VALUES (?,?,?,?, 'draft', unixepoch(), ?)");
    ins.run(crypto.randomUUID(), p.id, fmt(first), `Progress payment (50%): materials loaded on the roof and cleaning & sealing completed — ${p.approvedOption || "approved scope"} (auto-drafted from the approved price; review add-ons and change orders before sending)`, "materials");
    ins.run(crypto.randomUUID(), p.id, fmt(second), `Final payment (50%): upon completion of the job — ${p.approvedOption || "approved scope"}`, "completion");
  }
  if (p.customerEmail) {
    await sendBrandedEmail({
      to: p.customerEmail, customerName: p.customerName,
      subject: "You're approved — next step: pick your start date",
      title: "Thank you for choosing McCurdy Coatings",
      body: `<p>We've received your signed approval${p.approvedOption ? ` for <b>${String(p.approvedOption).replace(/[<>]/g, "")}</b>` : ""}.</p><ol><li><b>Book your pre-job walkthrough</b> with the button below. We'll confirm the schedule and weather window.</li><li><b>No deposit is due.</b> 50% is due when materials are loaded on the roof and cleaning &amp; sealing are complete; the final 50% is due at completion.${stripeEnabled() ? " You'll be able to pay online from your portal." : ""}</li><li>Follow progress photos and updates in your project portal.</li></ol>`,
      actionLabel: "Book my walkthrough", actionUrl: `${CALENDLY}?utm_source=portal&utm_medium=email&utm_campaign=post_sign`,
    }).catch(() => undefined);
  }
}

/** Every 15 min: remind about sent, unpaid invoices at 7, 14, and 21 days. */
export async function runInvoiceReminders() {
  const due = sqlite.prepare(`SELECT * FROM invoices WHERE status = 'sent' AND sent_at IS NOT NULL AND reminder_count < 3 AND sent_at < ? AND (last_reminder_at IS NULL OR last_reminder_at < ?)`).all(now() - 7 * 86400, now() - 7 * 86400) as any[];
  for (const inv of due) {
    const p = storage.getProposal(inv.proposal_id);
    sqlite.prepare("UPDATE invoices SET reminder_count = reminder_count + 1, last_reminder_at = ? WHERE id = ?").run(now(), inv.id);
    if (!p?.customerEmail) continue;
    await sendBrandedEmail({
      to: p.customerEmail, customerName: p.customerName,
      subject: `Friendly reminder: invoice ${inv.amount} — McCurdy Coatings`, title: "A quick reminder about your invoice",
      body: `<p>${String(inv.description).replace(/[<>]/g, "")}: <b>${inv.amount}</b> is still open. If you've already paid, thank you, and please ignore this note. Questions? Call 650-952-0233.</p>`,
      actionLabel: stripeEnabled() ? "View & pay invoice" : "View invoice", actionUrl: `${APP_BASE_URL}/#/view/${p.accessToken}/invoices`,
    }).catch(() => undefined);
    if (inv.reminder_count + 1 === 3) await sendOwnerNotification("Invoice still unpaid after 3 reminders", `<p>${p.customerName}: ${inv.amount} (${inv.description}). Consider a call.</p>`).catch(() => undefined);
  }
}

export function registerCustomerPortalRoutes(app: Express) {
  const codeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many codes requested. Wait 15 minutes and try again." } });
  const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many attempts. Wait 15 minutes." } });

  app.get("/api/proposals/:token/verify/status", (req, res) => {
    const p = storage.getProposalByToken(String(req.params.token));
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json({ verified: isVerifiedFor(req, p), hasEmail: !!p.customerEmail, emailMasked: p.customerEmail ? mask(norm(p.customerEmail)) : null, required: process.env.CUSTOMER_VERIFY_REQUIRED === "1" });
  });
  app.post("/api/proposals/:token/verify/start", codeLimiter, async (req, res) => {
    const p = storage.getProposalByToken(String(req.params.token));
    if (!p) return res.status(404).json({ error: "Not found" });
    if (!p.customerEmail) return res.status(400).json({ error: "No email on file. Call 650-952-0233 and we'll add it." });
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    sqlite.prepare("INSERT INTO customer_codes (proposal_id, code_hash, expires_at, attempts) VALUES (?,?,?,0) ON CONFLICT(proposal_id) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0").run(p.id, sha256(`${p.id}:${code}`), now() + 600);
    const r = await sendBrandedEmail({ to: p.customerEmail, customerName: p.customerName, subject: `${code} is your McCurdy verification code`, title: "Your verification code", body: `<p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:12px 0">${code}</p><p>Enter this code in your McCurdy project portal. It expires in 10 minutes. If you didn't request it, you can ignore this email.</p>` });
    if (!r.ok) return res.status(502).json({ error: "We couldn't send the code right now. Please call 650-952-0233." });
    res.json({ sent: true, emailMasked: mask(norm(p.customerEmail)) });
  });
  app.post("/api/proposals/:token/verify/confirm", verifyLimiter, (req: Request, res: Response) => {
    const p = storage.getProposalByToken(String(req.params.token));
    if (!p || !p.customerEmail) return res.status(404).json({ error: "Not found" });
    const row = sqlite.prepare("SELECT * FROM customer_codes WHERE proposal_id = ?").get(p.id) as any;
    if (!row || row.expires_at < now()) return res.status(400).json({ error: "That code expired. Request a new one." });
    if (row.attempts >= 5) return res.status(429).json({ error: "Too many wrong codes. Request a new one." });
    const code = String(req.body?.code || "").replace(/\D/g, "");
    if (sha256(`${p.id}:${code}`) !== row.code_hash) {
      sqlite.prepare("UPDATE customer_codes SET attempts = attempts + 1 WHERE proposal_id = ?").run(p.id);
      return res.status(400).json({ error: "That code isn't right. Check the email and try again." });
    }
    sqlite.prepare("DELETE FROM customer_codes WHERE proposal_id = ?").run(p.id);
    const token = crypto.randomBytes(32).toString("base64url");
    sqlite.prepare("INSERT INTO customer_sessions (id_hash, email, expires_at) VALUES (?,?,?)").run(sha256(token), norm(p.customerEmail), now() + SESSION_DAYS * 86400);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.append("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`);
    res.json({ verified: true });
  });
  app.post("/api/customer/sign-out", (req, res) => {
    const t = readCookie(req, COOKIE);
    if (t) sqlite.prepare("DELETE FROM customer_sessions WHERE id_hash = ?").run(sha256(t));
    res.append("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  });
  // Persistent property identity: all proposals for the verified email.
  app.get("/api/customer/properties", (req, res) => {
    const email = customerEmailFromSession(req);
    if (!email) return res.status(401).json({ error: "Verify your email to see all your properties." });
    const rows = sqlite.prepare(`SELECT access_token, proposal_number, property_address, city, status, proposal_date, approved_option, work_completed_date FROM proposals WHERE lower(trim(customer_email)) = ? AND status != 'draft' ORDER BY id DESC`).all(email) as any[];
    res.json({ email, properties: rows.map((r) => ({ token: r.access_token, proposalNumber: r.proposal_number, address: r.property_address, city: r.city, status: r.status, proposalDate: r.proposal_date, approvedOption: r.approved_option, completed: r.work_completed_date })) });
  });
}
