/**
 * Send the customer their proposal link via Resend.
 * Beautifully formatted HTML email with private link + call to action.
 */

const RESEND_API = "https://api.resend.com/emails";
const OWNER_EMAIL = process.env.OWNER_EMAIL || "mschirmer1922@gmail.com";
const APP_BASE_URL =
  process.env.APP_BASE_URL || "https://mccurdy-coatings.onrender.com";
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

export async function sendProposalEmail(
  args: SendProposalArgs,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[proposal-email] RESEND_API_KEY not set — cannot send");
    return {
      ok: false,
      error:
        "Email service not configured. Set RESEND_API_KEY in Render env vars.",
    };
  }

  const link = `${APP_BASE_URL}/#/view/${args.accessToken}`;
  const displayName = args.companyName
    ? `${args.customerName} (${args.companyName})`
    : args.customerName;
  const subject = `Your McCurdy Coatings Proposal — ${args.proposalNumber}`;

  const html = buildEmailHtml({ ...args, link });
  const text = buildEmailText({ ...args, link });

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      return {
        ok: false,
        error: data?.message || `Resend returned ${res.status}`,
      };
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

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Change order emails ─────────────────────────────────────
export async function sendChangeOrderEmail(args: {
  to: string;
  changeOrder: {
    title: string;
    description: string;
    amount: string;
    type: string;
  };
  proposal: {
    customerName: string;
    proposalNumber: string;
    propertyAddress?: string | null;
    accessToken: string;
  };
  ownerName?: string | null;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[proposal-email] RESEND_API_KEY not set — cannot send change order",
    );
    return {
      ok: false,
      error:
        "Email service not configured. Set RESEND_API_KEY in Render env vars.",
    };
  }

  const typeLabel = args.changeOrder.type === "credit" ? "Credit" : "Addition";
  const approvalLink = `${APP_BASE_URL}/#/view/${args.proposal.accessToken}/approve#change-orders`;
  const subject = `Change Order Requires Approval — ${args.proposal.proposalNumber}`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.06)">
  <div style="background:linear-gradient(135deg,#01696F,#0C4E54);padding:30px 28px;text-align:center">
    <div style="color:#fff;font-size:24px;font-weight:700">McCurdy Coatings</div>
    <div style="color:rgba(255,255,255,.86);font-size:13px;margin-top:4px">Change Order for Your Roof Project</div>
  </div>
  <div style="padding:32px 28px;color:#1a1a1a;line-height:1.6;font-size:15px">
    <p style="margin:0 0 12px;font-size:17px;color:#0f172a">Hi ${escapeHtml(args.proposal.customerName)},</p>
    <p style="margin:0 0 20px">We have prepared a change order for your project. Please review the details and sign to approve it.</p>
    <div style="border:1px solid #dbe4e7;border-radius:10px;overflow:hidden;margin:22px 0">
      <div style="background:${args.changeOrder.type === "credit" ? "#eaf7ef" : "#fff5e8"};padding:14px 18px;color:${args.changeOrder.type === "credit" ? "#176b3a" : "#9a4d00"};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">${typeLabel} Change Order</div>
      <div style="padding:20px">
        <div style="font-size:18px;font-weight:700;color:#0f172a">${escapeHtml(args.changeOrder.title)}</div>
        <p style="margin:10px 0 16px;color:#475569;white-space:pre-wrap">${escapeHtml(args.changeOrder.description)}</p>
        <div style="font-size:21px;font-weight:700;color:${args.changeOrder.type === "credit" ? "#15803d" : "#c2410c"}">${escapeHtml(args.changeOrder.type === "credit" ? "Credit: " : "Addition: ")}${escapeHtml(args.changeOrder.amount)}</div>
      </div>
    </div>
    <div style="text-align:center;margin:30px 0">
      <a href="${approvalLink}" style="display:inline-block;background:#01696F;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:16px;margin:4px">View &amp; Sign Change Order</a><br>
      <a href="https://calendly.com/mccurdycoatings" style="display:inline-block;background:#fff;color:#01696F;text-decoration:none;padding:11px 22px;border:2px solid #01696F;border-radius:8px;font-weight:600;font-size:14px;margin:12px 4px 4px">Book a Call</a>
    </div>
    <p style="margin:20px 0 0;font-size:14px;color:#475569">Questions? Reply to this email or book a time with ${escapeHtml(args.ownerName || "Mike Schirmer")}.</p>
  </div>
  <div style="background:#f5f5f0;padding:18px 28px;border-top:1px solid #e5e5e0;font-size:12px;color:#64748b;text-align:center;line-height:1.6">
    McCurdy Roofing Inc &middot; Proposal ${escapeHtml(args.proposal.proposalNumber)}${args.proposal.propertyAddress ? ` &middot; ${escapeHtml(args.proposal.propertyAddress)}` : ""}
  </div>
</div></body></html>`;

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [args.to],
        bcc: [OWNER_EMAIL],
        reply_to: OWNER_EMAIL,
        subject,
        html,
        text: `Hi ${args.proposal.customerName},\n\nA ${typeLabel.toLowerCase()} change order requires your approval.\n\n${args.changeOrder.title}\n${args.changeOrder.description}\n${typeLabel}: ${args.changeOrder.amount}\n\nView and sign: ${approvalLink}\n\nBook a call: https://calendly.com/mccurdycoatings`,
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok)
      return {
        ok: false,
        error: data?.message || `Resend returned ${res.status}`,
      };
    console.log(
      `[proposal-email] Change order sent to ${args.to} (id: ${data.id})`,
    );
    return { ok: true, id: data.id };
  } catch (err: any) {
    console.error("[proposal-email] Change order send failed:", err);
    return { ok: false, error: err.message || "Send failed" };
  }
}

export async function sendChangeOrderAcceptedNotificationToOwner(args: {
  changeOrder: {
    title: string;
    description: string;
    amount: string;
    type: string;
    signedByName?: string | null;
  };
  proposal: {
    customerName: string;
    companyName?: string | null;
    proposalNumber: string;
    accessToken: string;
  };
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#176b3a;color:#fff;padding:20px;border-radius:8px 8px 0 0"><h2 style="margin:0;font-size:20px">Change Order Accepted</h2></div>
    <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;line-height:1.65">
      <p style="margin-top:0"><strong>${escapeHtml(args.proposal.customerName)}</strong>${args.proposal.companyName ? ` (${escapeHtml(args.proposal.companyName)})` : ""} accepted a change order for proposal <strong>${escapeHtml(args.proposal.proposalNumber)}</strong>.</p>
      <p><strong>${escapeHtml(args.changeOrder.title)}</strong><br>${escapeHtml(args.changeOrder.description)}<br><strong>${escapeHtml(args.changeOrder.type === "credit" ? "Credit" : "Addition")}: ${escapeHtml(args.changeOrder.amount)}</strong></p>
      <p>Signed by: <strong>${escapeHtml(args.changeOrder.signedByName || "Customer")}</strong></p>
      <div style="margin-top:20px;text-align:center"><a href="${APP_BASE_URL}/#/admin/proposals" style="background:#01696F;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:600">Open Admin Dashboard</a></div>
    </div>
  </div>`;
  try {
    await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [OWNER_EMAIL],
        subject: `ACCEPTED: Change order for ${args.proposal.proposalNumber}`,
        html,
      }),
    });
    console.log(
      `[proposal-email] Change order acceptance notification sent to ${OWNER_EMAIL}`,
    );
  } catch (err) {
    console.error(
      "[proposal-email] Change order acceptance notification failed:",
      err,
    );
  }
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
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
  const yearLabel =
    args.yearsSinceCompletion === 1
      ? "1-Year"
      : `${args.yearsSinceCompletion}-Year`;
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
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [args.toEmail],
        bcc: [OWNER_EMAIL],
        reply_to: OWNER_EMAIL,
        subject,
        html,
      }),
    });
    console.log(
      `[proposal-email] Maintenance reminder sent to ${args.toEmail}`,
    );
  } catch (err) {
    console.error("[proposal-email] Maintenance reminder failed:", err);
  }
}

export async function sendBrandedEmail(args: {
  to: string;
  subject: string;
  title: string;
  customerName: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey)
    return {
      ok: false,
      error:
        "Email service not configured. Set RESEND_API_KEY in Render env vars.",
    };
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f0;font-family:Arial,sans-serif"><div style="max-width:640px;margin:auto;background:#fff"><div style="padding:28px;background:linear-gradient(135deg,#01696F,#0C4E54);color:#fff;text-align:center"><b style="font-size:24px">McCurdy Coatings</b><div style="font-size:13px;opacity:.8;margin-top:4px">License #477152</div></div><main style="padding:30px;color:#1f2937;line-height:1.6"><h1 style="font-size:21px;margin-top:0">${escapeHtml(args.title)}</h1><p>Hi ${escapeHtml(args.customerName)},</p>${args.body}${args.actionUrl ? `<p style="text-align:center;margin:28px 0"><a href="${args.actionUrl}" style="display:inline-block;background:#01696F;color:#fff;padding:13px 22px;text-decoration:none;border-radius:7px;font-weight:bold">${escapeHtml(args.actionLabel || "Open your portal")}</a></p>` : ""}</main><footer style="padding:18px;text-align:center;color:#64748b;font-size:12px;background:#f8fafc">McCurdy Roofing Inc. · 371 Shaw Rd, South San Francisco, CA 94080 · (650) 952-0233</footer></div></body></html>`;
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [args.to],
        bcc: [OWNER_EMAIL],
        reply_to: OWNER_EMAIL,
        subject: args.subject,
        html,
        text: `${args.title}\n\nHi ${args.customerName},\n\n${args.body.replace(/<[^>]*>/g, " ")}`,
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    return res.ok
      ? { ok: true, id: data.id }
      : { ok: false, error: data.message || `Resend returned ${res.status}` };
  } catch (error: any) {
    return { ok: false, error: error.message || "Send failed" };
  }
}

export function sendPrepareForVisitEmail(args: {
  to: string;
  customerName: string;
  appointmentDate: number;
  ownerName?: string | null;
}) {
  const date = new Date(args.appointmentDate * 1000).toLocaleString();
  return sendBrandedEmail({
    to: args.to,
    customerName: args.customerName,
    subject: "Prepare for your McCurdy Coatings visit",
    title: "Here’s what to expect when Mike arrives",
    body: `<p>Your visit is scheduled for <b>${escapeHtml(date)}</b>.</p><h3>What to expect</h3><p>${escapeHtml(args.ownerName || "Mike")} will inspect the roof, document details, and answer questions about restoration options.</p><h3>How long it takes</h3><p>Most site visits take 45–90 minutes, depending on roof access and size.</p><h3>Three questions to ask</h3><ol><li>What is the condition of the existing roof?</li><li>Which warranty level fits our plans?</li><li>What can reduce future maintenance?</li></ol><p>You can also <a href="https://calendly.com/mccurdycoatings">book a call</a> anytime.</p>`,
  });
}

export function sendFollowUpEmail(args: {
  to: string;
  customerName: string;
  accessToken: string;
  day: 1 | 3 | 7 | 14;
}) {
  const content: Record<number, { title: string; body: string }> = {
    1: {
      title: "Thanks for having us out",
      body: "<p>Thank you for the opportunity to inspect your property. Your proposal is ready whenever you are.</p>",
    },
    3: {
      title: "Common questions about your proposal",
      body: "<p><b>Does coating require tear-off?</b> Usually no. <b>How long does it take?</b> We will provide a project-specific schedule. <b>Can we discuss options?</b> Absolutely—Mike is happy to walk through them.</p>",
    },
    7: {
      title: "Ready to schedule your project?",
      body: "<p>If you are ready, choose your preferred option and start date in your private portal. We can also talk through the details on a call.</p>",
    },
    14: {
      title: "Your proposal is still available",
      body: "<p>Your proposal remains available for 30 days. Material availability and scheduling can change, so please reach out when you are ready.</p>",
    },
  };
  const item = content[args.day];
  return sendBrandedEmail({
    to: args.to,
    customerName: args.customerName,
    subject: item.title,
    title: item.title,
    body: item.body,
    actionLabel: args.day === 7 ? "Book a call" : "View your proposal",
    actionUrl:
      args.day === 7
        ? "https://calendly.com/mccurdycoatings"
        : `${APP_BASE_URL}/#/view/${args.accessToken}`,
  });
}

export async function sendOwnerNotification(
  subject: string,
  body: string,
): Promise<void> {
  await sendBrandedEmail({
    to: OWNER_EMAIL,
    customerName: "Mike",
    subject,
    title: subject,
    body,
  });
}
export function sendWarrantyConfirmation(args: {
  to: string;
  customerName: string;
  accessToken: string;
}) {
  return sendBrandedEmail({
    to: args.to,
    customerName: args.customerName,
    subject: "Your McCurdy warranty is registered",
    title: "Warranty registration confirmed",
    body: "<p>Your warranty registration is complete. Keep your customer portal bookmarked for records, maintenance dates, and project photos.</p>",
    actionUrl: `${APP_BASE_URL}/#/view/${args.accessToken}/warranty`,
    actionLabel: "View warranty",
  });
}
export function sendReviewRequest(args: {
  to: string;
  customerName: string;
  accessToken: string;
}) {
  return sendBrandedEmail({
    to: args.to,
    customerName: args.customerName,
    subject: "How did we do?",
    title: "Your feedback matters",
    body: "<p>Thank you for trusting McCurdy Coatings. Please take a moment to share how the project went.</p>",
    actionUrl: `${APP_BASE_URL}/#/view/${args.accessToken}/review`,
    actionLabel: "Leave feedback",
  });
}

export async function sendCustomerMessageToOwner(args: {
  proposal: {
    customerName: string;
    proposalNumber: string;
    accessToken: string;
  };
  body: string;
  senderName: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const html = `<p><strong>${escapeHtml(args.senderName)}</strong> sent a new portal message for proposal <strong>${escapeHtml(args.proposal.proposalNumber)}</strong>.</p><blockquote style="white-space:pre-wrap">${escapeHtml(args.body)}</blockquote><p><a href="${APP_BASE_URL}/#/admin/proposals">Open McCurdy Coatings admin</a></p>`;
  await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [OWNER_EMAIL],
      subject: `New portal message — ${args.proposal.proposalNumber}`,
      html,
      text: `${args.senderName}: ${args.body}`,
    }),
  }).catch((error) =>
    console.error("[proposal-email] customer message notify failed", error),
  );
}

export async function sendAdminMessageToCustomer(args: {
  proposal: {
    customerEmail?: string | null;
    customerName: string;
    accessToken: string;
  };
  body: string;
  senderName: string;
}): Promise<void> {
  if (!args.proposal.customerEmail) return;
  const portal = `${APP_BASE_URL}/#/view/${args.proposal.accessToken}/messages`;
  await sendBrandedEmail({
    to: args.proposal.customerEmail,
    customerName: args.proposal.customerName,
    subject: "New message from McCurdy Coatings",
    title: "You have a new message",
    body: `<p><strong>${escapeHtml(args.senderName)}</strong> wrote:</p><blockquote style="white-space:pre-wrap">${escapeHtml(args.body)}</blockquote>`,
    actionLabel: "Open messages",
    actionUrl: portal,
  });
}

export async function sendFinancingApplicationToOwner(args: {
  proposal: { proposalNumber: string; customerName: string };
  application: {
    applicantName: string;
    email: string;
    phone: string;
    employmentStatus: string;
    annualIncome: string;
    preferredTerm: number;
    preferredProvider: string;
  };
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const a = args.application;
  const html = `<h2>Financing application received</h2><p>Proposal: ${escapeHtml(args.proposal.proposalNumber)}</p><ul><li>Name: ${escapeHtml(a.applicantName)}</li><li>Email: ${escapeHtml(a.email)}</li><li>Phone: ${escapeHtml(a.phone)}</li><li>Employment: ${escapeHtml(a.employmentStatus)}</li><li>Income bracket: ${escapeHtml(a.annualIncome)}</li><li>Term: ${a.preferredTerm} months</li><li>Provider: ${escapeHtml(a.preferredProvider)}</li></ul>`;
  await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [OWNER_EMAIL],
      subject: `Financing application — ${args.proposal.proposalNumber}`,
      html,
    }),
  }).catch((error) =>
    console.error("[proposal-email] financing notify failed", error),
  );
}
