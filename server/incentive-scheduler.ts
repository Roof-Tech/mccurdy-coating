/**
 * Auto-refresh scheduler — runs on server startup.
 *
 * Schedule:
 *   • Jan 1 at 12:01 AM PT: full yearly refresh (auto-publish)
 *   • Apr 1, Jul 1, Oct 1 at 12:01 AM PT: quarterly safety refresh
 *   • On boot: seeds 2026 data if DB is empty
 *
 * Uses setTimeout loops (no external cron dep). Precision is checked every hour
 * so scheduled runs never drift more than ~60 minutes.
 */

import Database from "better-sqlite3";
import { refreshAllCounties, initIncentiveTables, SERVED_COUNTIES } from "./incentive-refresh";
import { sendRefreshReport } from "./incentive-email";
import { seedInitialIncentives } from "./incentive-seed";

const OWNER_EMAIL = process.env.OWNER_EMAIL || "mschirmer1922@gmail.com";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour

/** Convert PT date to UTC epoch — respects DST via Intl API. */
function ptDateToUtc(year: number, month: number, day: number, hour = 0, minute = 1): number {
  // Build an ISO string as if UTC then adjust using the actual offset for that PT date.
  // Simpler approach: use Intl.DateTimeFormat to discover the PT offset for that day.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(guess);
  const offsetPart = parts.find(p => p.type === "timeZoneName")?.value ?? "GMT-8";
  const match = offsetPart.match(/GMT([+-]\d+)(?::(\d+))?/);
  const offH = match ? parseInt(match[1], 10) : -8;
  const offM = match && match[2] ? parseInt(match[2], 10) : 0;
  return Date.UTC(year, month - 1, day, hour - offH, minute - offM);
}

/** Given "now", find the next scheduled refresh timestamp and its type. */
function nextScheduledRun(now: Date): { at: number; type: "yearly" | "quarterly"; taxYear: number } {
  const year = now.getUTCFullYear();
  const candidates: { at: number; type: "yearly" | "quarterly"; taxYear: number }[] = [];
  for (const y of [year, year + 1]) {
    candidates.push({ at: ptDateToUtc(y, 1, 1, 0, 1),  type: "yearly",    taxYear: y });
    candidates.push({ at: ptDateToUtc(y, 4, 1, 0, 1),  type: "quarterly", taxYear: y });
    candidates.push({ at: ptDateToUtc(y, 7, 1, 0, 1),  type: "quarterly", taxYear: y });
    candidates.push({ at: ptDateToUtc(y, 10, 1, 0, 1), type: "quarterly", taxYear: y });
  }
  const nowMs = now.getTime();
  const future = candidates.filter(c => c.at > nowMs).sort((a, b) => a.at - b.at);
  return future[0];
}

// Track last successful run so hourly heartbeat doesn't double-fire
let lastRunKey = "";

async function runRefreshCycle(db: Database.Database, type: "yearly" | "quarterly" | "manual", taxYear: number) {
  const key = `${type}-${taxYear}-${new Date().toISOString().slice(0, 10)}`;
  if (lastRunKey === key) return; // already ran today
  lastRunKey = key;

  console.log(`[incentive-refresh] Starting ${type} refresh for tax year ${taxYear}`);
  try {
    const report = await refreshAllCounties(db, taxYear, type);
    console.log(`[incentive-refresh] Refresh complete. Report length: ${report.length} chars`);
    await sendRefreshReport(OWNER_EMAIL, report, type, taxYear);
  } catch (err) {
    console.error(`[incentive-refresh] Refresh cycle failed:`, err);
  }
}

export function startIncentiveScheduler(db: Database.Database) {
  // Ensure tables exist
  initIncentiveTables(db);

  // Seed if empty (first-run and after disk-wipe recoveries)
  const count = db.prepare("SELECT COUNT(*) AS n FROM county_incentives").get() as { n: number };
  if (count.n === 0) {
    console.log("[incentive-refresh] Seeding initial 2026 incentive data...");
    seedInitialIncentives(db);
  }

  const tick = () => {
    const now = new Date();
    const next = nextScheduledRun(now);
    // If we're within 30 minutes of a scheduled run, execute it
    const minutesUntil = (next.at - now.getTime()) / 60000;
    if (minutesUntil <= 30 && minutesUntil >= -60) {
      runRefreshCycle(db, next.type, next.taxYear).catch(e =>
        console.error("[incentive-refresh] Cycle error:", e)
      );
    }
  };

  // Tick immediately, then every hour
  tick();
  setInterval(tick, CHECK_INTERVAL_MS);

  const next = nextScheduledRun(new Date());
  const nextPt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "full", timeStyle: "short",
  }).format(new Date(next.at));
  console.log(`[incentive-refresh] Scheduler active. Next ${next.type} refresh for tax year ${next.taxYear}: ${nextPt}`);
  console.log(`[incentive-refresh] Serving ${SERVED_COUNTIES.length} counties`);
}

/** Exposed for manual admin trigger from /api/admin/refresh-incentives */
export async function manualRefresh(db: Database.Database, taxYear?: number): Promise<string> {
  const year = taxYear ?? new Date().getFullYear();
  const report = await refreshAllCounties(db, year, "manual");
  await sendRefreshReport(OWNER_EMAIL, report, "manual", year);
  return report;
}
