/**
 * Send the refresh report to the owner.
 * Uses Resend (transactional email service) — set RESEND_API_KEY env var.
 * If no key is set, logs to console so the report is at least captured.
 */

const RESEND_API = "https://api.resend.com/emails";

export async function sendRefreshReport(
  toEmail: string,
  markdownReport: string,
  runType: string,
  taxYear: number
) {
  const apiKey = process.env.RESEND_API_KEY;
  const subject = `McCurdy Coatings — ${runType.toUpperCase()} Incentive Refresh · Tax Year ${taxYear}`;

  const html = markdownToHtml(markdownReport);

  if (!apiKey) {
    console.log("[incentive-email] RESEND_API_KEY not set. Report follows:\n");
    console.log(markdownReport);
    return;
  }

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "McCurdy Coatings <alerts@mccurdycoatings.com>",
        to: [toEmail],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[incentive-email] Resend error (${res.status}):`, text);
    } else {
      console.log(`[incentive-email] Report sent to ${toEmail}`);
    }
  } catch (err) {
    console.error("[incentive-email] Send failed:", err);
  }
}

function markdownToHtml(md: string): string {
  // Minimal converter — good enough for our reports
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^# (.+)$/gm, '<h1 style="color:#0f172a">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#1e40af;border-bottom:2px solid #dbeafe;padding-bottom:4px">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^  - (.+)$/gm, '<li style="margin-left:20px">$1</li>')
    .replace(/\n\n/g, "<br><br>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>").replace(/<\/ul>\s*<ul>/g, "");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:720px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.6">
    ${html}
    <hr style="margin-top:32px;border:none;border-top:1px solid #e2e8f0">
    <p style="color:#64748b;font-size:12px">This report was generated automatically by the McCurdy Coatings incentive refresh engine.<br>
    Live site: <a href="https://mccurdy-coatings.onrender.com">mccurdy-coatings.onrender.com</a></p>
  </div>`;
}
