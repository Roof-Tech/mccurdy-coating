/**
 * Retention: opt-in post-storm inspection prompts with click → booking tracking.
 * A daily storm watch checks Open-Meteo for significant Bay Area rain or wind; when
 * a storm is detected, customers who explicitly opted in get one "Book a free
 * inspection" email per storm. Each email link is tracked.
 */
import type { Express } from "express";
import crypto from "crypto";
import { sqliteConnection as sqlite } from "./db";
import { requireAdmin } from "./admin-auth";
import { storage } from "./storage";
import { sendBrandedEmail } from "./proposal-email";

const APP_BASE_URL = process.env.APP_BASE_URL || "https://mccurdy-coatings.onrender.com";
const CALENDLY = "https://calendly.com/mccurdycoatings";
const now = () => Math.floor(Date.now() / 1000);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS storm_optins (
    proposal_id INTEGER PRIMARY KEY REFERENCES proposals(id),
    opted_in INTEGER NOT NULL DEFAULT 1,
    source TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS storm_events (
    id TEXT PRIMARY KEY,
    event_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    trigger TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS storm_followups (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES storm_events(id),
    proposal_id INTEGER NOT NULL REFERENCES proposals(id),
    sent_at INTEGER,
    send_error TEXT,
    clicked_at INTEGER,
    booked_at INTEGER,
    UNIQUE(event_id, proposal_id)
  );
`);

export function isStormOptedIn(proposalId: number): boolean {
  const r = sqlite.prepare("SELECT opted_in FROM storm_optins WHERE proposal_id = ?").get(proposalId) as { opted_in: number } | undefined;
  return !!r?.opted_in;
}
export function setStormOptIn(proposalId: number, optIn: boolean, source: string) {
  sqlite.prepare("INSERT INTO storm_optins (proposal_id, opted_in, source, updated_at) VALUES (?,?,?,?) ON CONFLICT(proposal_id) DO UPDATE SET opted_in = excluded.opted_in, source = excluded.source, updated_at = excluded.updated_at").run(proposalId, optIn ? 1 : 0, source, now());
}

// Bay Area sample points (San Francisco, Oakland, San Jose, South San Francisco).
const POINTS = [[37.77, -122.42], [37.8, -122.27], [37.34, -121.89], [37.656, -122.41]];
const RAIN_MM = 25; // ≈1 inch in a day
const GUST_KMH = 70; // ≈43 mph
export async function detectBayAreaStorm(): Promise<{ date: string; reason: string } | null> {
  const lat = POINTS.map((p) => p[0]).join(","), lon = POINTS.map((p) => p[1]).join(",");
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,wind_gusts_10m_max&past_days=2&forecast_days=1&timezone=America%2FLos_Angeles`;
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Weather service ${r.status}`);
  const j: any = await r.json();
  const sites = Array.isArray(j) ? j : [j];
  let best: { date: string; rain: number; gust: number } | null = null;
  for (const s of sites) {
    const d = s.daily;
    for (let i = 0; i < (d?.time?.length || 0) - 1; i++) { // completed days only
      const rain = d.precipitation_sum[i] ?? 0, gust = d.wind_gusts_10m_max[i] ?? 0;
      if ((rain >= RAIN_MM || gust >= GUST_KMH) && (!best || rain > best.rain || gust > best.gust)) best = { date: d.time[i], rain, gust };
    }
  }
  if (!best) return null;
  const parts = [best.rain >= RAIN_MM ? `${(best.rain / 25.4).toFixed(1)}" of rain` : "", best.gust >= GUST_KMH ? `wind gusts to ${Math.round(best.gust / 1.609)} mph` : ""].filter(Boolean);
  return { date: best.date, reason: parts.join(" and ") };
}

export async function sendStormFollowups(event: { date: string; reason: string }, trigger: string) {
  const id = crypto.randomUUID();
  sqlite.prepare("INSERT INTO storm_events (id, event_date, reason, trigger) VALUES (?,?,?,?)").run(id, event.date, event.reason, trigger);
  const rows = sqlite.prepare(`SELECT p.id, p.customer_name, p.customer_email, p.property_address FROM proposals p JOIN storm_optins o ON o.proposal_id = p.id WHERE o.opted_in = 1 AND p.customer_email IS NOT NULL AND p.customer_email != ''`).all() as any[];
  let sent = 0;
  for (const p of rows) {
    const fid = crypto.randomUUID();
    sqlite.prepare("INSERT OR IGNORE INTO storm_followups (id, event_id, proposal_id) VALUES (?,?,?)").run(fid, id, p.id);
    const proposal = storage.getProposal(p.id);
    const result = await sendBrandedEmail({
      to: p.customer_email,
      customerName: p.customer_name,
      subject: "Free roof check after this week's storm",
      title: "Want us to check your roof?",
      body: `<p>The Bay Area just had ${event.reason} (${event.date}). Storms like this can loosen flashing, clog drains, and cause ponding water at ${p.property_address}.</p><p>As a McCurdy customer, you can book a <b>free post-storm inspection</b>. We'll check seams, penetrations, and drainage and send you photos.</p><p style="font-size:12px;color:#666">You're receiving this because you asked for storm alerts. <a href="${APP_BASE_URL}/api/unsubscribe/${proposal?.accessToken}/storm_alerts">Stop storm alerts</a>.</p>`,
      actionLabel: "Book my free inspection",
      actionUrl: `${APP_BASE_URL}/api/storm/${fid}/book`,
    });
    sqlite.prepare("UPDATE storm_followups SET sent_at = ?, send_error = ? WHERE id = ?").run(result.ok ? now() : null, result.ok ? null : result.error || "send failed", fid);
    if (result.ok) sent++;
  }
  return { eventId: id, recipients: rows.length, sent };
}

/** Daily: detect a storm and notify opted-in customers, at most once per 7 days. */
export async function runStormWatch() {
  const recent = sqlite.prepare("SELECT 1 FROM storm_events WHERE created_at > ?").get(now() - 7 * 86400);
  if (recent) return null;
  const storm = await detectBayAreaStorm();
  return storm ? sendStormFollowups(storm, "auto") : null;
}

export function registerRetentionRoutes(app: Express) {
  app.get("/api/proposals/:token/storm-optin", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json({ optedIn: isStormOptedIn(p.id) });
  });
  app.post("/api/proposals/:token/storm-optin", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    setStormOptIn(p.id, !!req.body?.optIn, "portal");
    res.json({ optedIn: !!req.body?.optIn });
  });
  // Tracked email link → Calendly
  app.get("/api/storm/:id/book", (req, res) => {
    const f = sqlite.prepare("SELECT * FROM storm_followups WHERE id = ?").get(req.params.id) as any;
    if (f && !f.clicked_at) sqlite.prepare("UPDATE storm_followups SET clicked_at = ? WHERE id = ?").run(now(), f.id);
    res.redirect(302, `${CALENDLY}?utm_source=storm_alert&utm_medium=email&utm_campaign=${encodeURIComponent(f?.event_id || "storm")}`);
  });
  app.get("/api/admin/storm-followups", requireAdmin as any, (_req, res) => {
    const events = sqlite.prepare("SELECT * FROM storm_events ORDER BY created_at DESC LIMIT 20").all() as any[];
    const followups = sqlite.prepare(`SELECT f.*, p.customer_name, p.property_address, p.customer_phone FROM storm_followups f JOIN proposals p ON p.id = f.proposal_id ORDER BY f.sent_at DESC LIMIT 300`).all() as any[];
    const optedIn = (sqlite.prepare("SELECT COUNT(*) AS n FROM storm_optins WHERE opted_in = 1").get() as { n: number }).n;
    res.json({ optedIn, events: events.map((e) => { const fs = followups.filter((f) => f.event_id === e.id); return { ...e, sent: fs.filter((f) => f.sent_at).length, clicked: fs.filter((f) => f.clicked_at).length, booked: fs.filter((f) => f.booked_at).length }; }), followups });
  });
  app.post("/api/admin/storm-followups/:id/booked", requireAdmin as any, (req, res) => {
    sqlite.prepare("UPDATE storm_followups SET booked_at = ? WHERE id = ?").run(req.body?.booked === false ? null : now(), req.params.id);
    res.json({ ok: true });
  });
  // Check weather now; or send manually with a description if Mike knows of a storm.
  app.post("/api/admin/storm-check", requireAdmin as any, async (req, res) => {
    try {
      if (req.body?.manualReason) {
        const today = new Date().toISOString().slice(0, 10);
        return res.json({ detected: true, ...(await sendStormFollowups({ date: today, reason: String(req.body.manualReason).slice(0, 120) }, "manual")) });
      }
      const storm = await detectBayAreaStorm();
      if (!storm) return res.json({ detected: false, message: "No significant storm in the last 2 days (1 inch or more of rain, or gusts of 43 mph or more)." });
      if (!req.body?.send) return res.json({ detected: true, storm });
      res.json({ detected: true, storm, ...(await sendStormFollowups(storm, "manual")) });
    } catch (e: any) { res.status(502).json({ error: e.message }); }
  });
}
