/**
 * Send the customer their proposal link via Resend.
 * Beautifully formatted HTML email with private link + call to action.
 */

const RESEND_API = "https://api.resend.com/emails";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "mschirmer1922@gmail.com";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://mccurdy-coatings.onrender.com";
// Resend's sandbox domain works out of the box, no DNS setup needed
const FROM_ADDRESS =
  process.env.RESEND_FROM || "McCurdy Coatings <onboarding@resend.dev>";

interface SendProposalArgs {
  toEmail: string;
  customerName: string;
  companyName?: string | null;
  proposalNumber: string;
  accessToken: string;
  propertyAddress?: string | null;
  estimator?: string | null;
  customMessage?: string | null;
}

export async function sendProposalEmail(args: SendProposalArgs): Promise<{ ok: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[proposal-email] RESEND_API_KEY not set — cannot send");
    return { ok: false, error: "Email service not configured. Set RESEND_API_KEY in Render env vars." };
  }

  const link = `${APP_BASE_URL}/#/view/${args.accessToken}`;
  const displayName = args.companyName ? `${args.customerName} (${args.companyName})` : args.customerName;
  const subject = `Your McCurdy Coatings Proposal — ${args.proposalNumber}`;

  const html = buildEmailHtml({ ...args, link });
  const text = buildEmailText({ ...args, link });

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [args.toEmail],
        bcc: [OWNER_EMAIL], // owner gets a copy
        reply_to: OWNER_EMAIL,
        subject,
        html,
        text,
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[proposal-email] Resend error (${res.status}):`, data);
      return { ok: false, error: data?.message || `Resend returned ${res.status}` };
    }
    console.log(`[proposal-email] Sent to ${args.toEmail} (id: ${data.id})`);
    return { ok: true, id: data.id };
  } catch (err: any) {
    console.error("[proposal-email] Send failed:", err);
    return { ok: false, error: err.message || "Send failed" };
  }
}

function buildEmailHtml(a: SendProposalArgs & { link: string }): string {
  const message = a.customMessage
    ? `<div style="background:#f8fafc;padding:16px 20px;border-left:3px solid #01696F;margin:20px 0;border-radius:4px;font-size:15px;color:#334155;white-space:pre-wrap">${escapeHtml(a.customMessage)}</div>`
    : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;background:#ffffff;padding:0;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#01696F 0%,#0C4E54 100%);padding:32px 28px;text-align:center">
    <div style="color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.02em">McCurdy Coatings</div>
    <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px">Silicone Roof Restoration &middot; License #477152</div>
  </div>

  <!-- Body -->
  <div style="padding:32px 28px;color:#1a1a1a;line-height:1.6;font-size:15px">
    <p style="margin:0 0 12px;font-size:17px;color:#0f172a">Hi ${escapeHtml(a.customerName)},</p>
    <p style="margin:0 0 20px">Your personalized roof restoration proposal is ready. Everything is organized inside your private customer portal — proposal details, warranty options, rebates you qualify for, and all supporting documents.</p>

    ${message}

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0">
      <a href="${a.link}" style="display:inline-block;background:#01696F;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;letter-spacing:0.01em;margin:4px">View Your Proposal</a>
      <br>
      <a href="https://calendly.com/mccurdycoatings" style="display:inline-block;background:#ffffff;color:#01696F;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;border:2px solid #01696F;margin:12px 4px 4px">Book a Call to Discuss</a>
    </div>

    <!-- What's inside -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:24px 0">
      <div style="font-size:13px;font-weight:600;color:#01696F;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">What's Inside</div>
      <div style="font-size:14px;color:#334155;line-height:1.9">
        &#10003; Complete scope of work &amp; system specification<br>
        &#10003; Warranty options (5, 10, 15, 20, 25, 30-year)<br>
        &#10003; Rebates &amp; tax credits you qualify for<br>
        &#10003; Product data sheets &amp; compliance documents<br>
        &#10003; Photos, invoices, and all supporting files<br>
        &#10003; E-signature to approve &amp; request start date
      </div>
    </div>

    <div style="background:#fff8e1;border-left:3px solid #d19900;padding:14px 18px;border-radius:4px;margin:20px 0;font-size:13px;color:#5a4a1a">
      <strong>Save this email.</strong> Your link works forever — bookmark the portal for yearly maintenance reminders and to keep all project records in one place.
    </div>

    <p style="margin:20px 0 8px;font-size:14px;color:#475569">Questions? Just reply to this email or call us:</p>
    <p style="margin:0;font-size:14px;color:#0f172a">
      <strong>${escapeHtml(a.estimator || "Mike Schirmer")}</strong><br>
      Phone: <a href="tel:6509520233" style="color:#01696F;text-decoration:none">(650) 952-0233</a> &middot; Text: <a href="sms:6508085469" style="color:#01696F;text-decoration:none">(650) 808-5469</a>
    </p>
  </div>

  <!-- Footer -->
  <div style="background:#f5f5f0;padding:20px 28px;border-top:1px solid #e5e5e0;font-size:12px;color:#64748b;text-align:center;line-height:1.6">
    McCurdy Roofing Inc &middot; 371 Shaw Rd, South San Francisco, CA 94080<br>
    Proposal ${escapeHtml(a.proposalNumber)}${a.propertyAddress ? ` &middot; ${escapeHtml(a.propertyAddress)}` : ""}<br>
    <span style="color:#94a3b8">This link is private to you. Do not share.</span>
  </div>
</div>
</body></html>`;
}

function buildEmailText(a: SendProposalArgs & { link: string }): string {
  return `Hi ${a.customerName},

Your McCurdy Coatings roof restoration proposal is ready.

View it here: ${a.link}

${a.customMessage ? a.customMessage + "\n\n" : ""}Inside your portal:
- Complete scope of work & system specification
- Warranty options (5, 10, 15, 20, 25, 30-year)
- Rebates & tax credits you qualify for
- Product data sheets & compliance documents
- Photos, invoices, and all supporting files
- E-signature to approve & request start date

Save this email — your link works forever. Bookmark the portal for yearly maintenance reminders and to keep all project records in one place.

Questions? Reply to this email or call ${a.estimator || "Mike Schirmer"}:
Phone: (650) 952-0233
Text:  (650) 808-5469

McCurdy Roofing Inc
371 Shaw Rd, South San Francisco, CA 94080
Proposal ${a.proposalNumber}
`;
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Notify owner when customer signs ──
export async function sendSignedNotificationToOwner(args: {
  customerName: string;
  companyName?: string | null;
  proposalNumber: string;
  signedByName: string;
  signedByTitle?: string | null;
  approvedOption?: string | null;
  requestedStartDate?: string | null;
  propertyAddress?: string | null;
  accessToken: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const link = `${APP_BASE_URL}/#/admin/proposals`;
  const subject = `SIGNED: ${args.customerName} approved proposal ${args.proposalNumber}`;
  const html = `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#01696F;color:white;padding:20px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:20px">Proposal Signed &amp; Approved</h2>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
      <table style="width:100%;font-size:14px;line-height:1.8">
        <tr><td style="color:#64748b;width:40%">Customer:</td><td><strong>${escapeHtml(args.customerName)}</strong>${args.companyName ? " &middot; " + escapeHtml(args.companyName) : ""}</td></tr>
        <tr><td style="color:#64748b">Signed by:</td><td><strong>${escapeHtml(args.signedByName)}</strong>${args.signedByTitle ? " &middot; " + escapeHtml(args.signedByTitle) : ""}</td></tr>
        ${args.approvedOption ? `<tr><td style="color:#64748b">Option chosen:</td><td><strong>${escapeHtml(args.approvedOption)}</strong></td></tr>` : ""}
        ${args.requestedStartDate ? `<tr><td style="color:#64748b">Requested start:</td><td><strong>${escapeHtml(args.requestedStartDate)}</strong></td></tr>` : ""}
        ${args.propertyAddress ? `<tr><td style="color:#64748b">Property:</td><td>${escapeHtml(args.propertyAddress)}</td></tr>` : ""}
        <tr><td style="color:#64748b">Proposal:</td><td>${escapeHtml(args.proposalNumber)}</td></tr>
      </table>
      <div style="margin-top:20px;text-align:center">
        <a href="${link}" style="background:#01696F;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600">Open Admin Dashboard</a>
      </div>
    </div>
  </div>`;

  try {
    await fetch(RESEND_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [OWNER_EMAIL],
        subject,
        html,
      }),
    });
    console.log(`[proposal-email] Signed notification sent to ${OWNER_EMAIL}`);
  } catch (err) {
    console.error("[proposal-email] Owner notify failed:", err);
  }
}

// ── Yearly maintenance reminder ──
export async function sendMaintenanceReminder(args: {
  toEmail: string;
  customerName: string;
  companyName?: string | null;
  proposalNumber: string;
  accessToken: string;
  yearsSinceCompletion: number;
  systemType?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const link = `${APP_BASE_URL}/#/view/${args.accessToken}`;
  const yearLabel = args.yearsSinceCompletion === 1 ? "1-Year" : `${args.yearsSinceCompletion}-Year`;
  const subject = `${yearLabel} Maintenance Check-In — Your McCurdy Roof`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;background:#ffffff;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <div style="background:linear-gradient(135deg,#01696F 0%,#0C4E54 100%);padding:28px;text-align:center">
    <div style="color:#ffffff;font-size:22px;font-weight:700">McCurdy Coatings</div>
    <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:4px">${yearLabel} Maintenance Reminder</div>
  </div>
  <div style="padding:32px 28px;color:#1a1a1a;line-height:1.6;font-size:15px">
    <p style="margin:0 0 12px;font-size:17px">Hi ${escapeHtml(args.customerName)},</p>
    <p>It's been ${args.yearsSinceCompletion} year${args.yearsSinceCompletion === 1 ? "" : "s"} since we completed your ${escapeHtml(args.systemType || "silicone roof restoration")}. Time for your recommended inspection.</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:20px 0">
      <div style="font-size:13px;font-weight:600;color:#01696F;text-transform:uppercase;margin-bottom:12px">Free Inspection Includes</div>
      <div style="font-size:14px;color:#334155;line-height:1.9">
        &#10003; Roof coating condition assessment<br>
        &#10003; Seam &amp; penetration check<br>
        &#10003; Drainage &amp; ponding inspection<br>
        &#10003; Warranty compliance verification<br>
        &#10003; Photo report for your records
      </div>
    </div>
    <div style="text-align:center;margin:28px 0">
      <a href="https://calendly.com/mccurdycoatings" style="display:inline-block;background:#01696F;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px;margin:4px">Book Your Free Inspection</a><br>
      <a href="tel:6509520233" style="display:inline-block;background:#ffffff;color:#01696F;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;border:2px solid #01696F;margin:8px 4px 4px">Or Call (650) 952-0233</a>
      <a href="${link}" style="display:inline-block;background:#ffffff;color:#01696F;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;border:2px solid #01696F;margin:8px 4px 4px">Your Records</a>
    </div>
    <p style="font-size:14px;color:#475569;margin:20px 0 0">All your project records — proposal, contract, warranty, photos — are still in your portal. Bookmark it and forward to whoever handles maintenance for your building.</p>
  </div>
  <div style="background:#f5f5f0;padding:20px 28px;border-top:1px solid #e5e5e0;font-size:12px;color:#64748b;text-align:center">
    McCurdy Roofing Inc &middot; License #477152 &middot; (650) 952-0233<br>
    Proposal ${escapeHtml(args.proposalNumber)}${args.companyName ? " &middot; " + escapeHtml(args.companyName) : ""}
  </div>
</div>
</body></html>`;

  try {
    await fetch(RESEND_API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [args.toEmail],
        bcc: [OWNER_EMAIL],
        reply_to: OWNER_EMAIL,
        subject,
        html,
      }),
    });
    console.log(`[proposal-email] Maintenance reminder sent to ${args.toEmail}`);
  } catch (err) {
    console.error("[proposal-email] Maintenance reminder failed:", err);
  }
}
