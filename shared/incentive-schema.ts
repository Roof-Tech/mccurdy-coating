import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ── County Incentives (auto-refreshing) ─────────────────────────────
// Each county has one row containing a JSON blob of all its programs.
// Refreshed automatically every January 1st + quarterly safety checks.
export const countyIncentives = sqliteTable("county_incentives", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  countyKey: text("county_key").notNull().unique(),   // e.g. "alameda"
  countyName: text("county_name").notNull(),          // e.g. "Alameda County"
  climateZone: text("climate_zone").notNull(),
  utility: text("utility").notNull(),
  programs: text("programs").notNull(),                // JSON string of program array
  taxYear: integer("tax_year").notNull(),              // 2027, 2028, etc.
  lastUpdated: text("last_updated").notNull(),         // ISO date
  lastAuditPassed: text("last_audit_passed"),          // ISO date of last successful refresh
  sourcesJson: text("sources_json"),                   // JSON of citations
});

// ── Refresh Audit Log ───────────────────────────────────────────────
// Every refresh cycle logs what changed. You get an email summary.
export const incentiveRefreshLog = sqliteTable("incentive_refresh_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: text("run_id").notNull(),                     // uuid for this refresh run
  runAt: text("run_at").notNull(),                     // ISO timestamp
  runType: text("run_type").notNull(),                 // "yearly" | "quarterly" | "manual"
  countyKey: text("county_key").notNull(),
  status: text("status").notNull(),                    // "updated" | "unchanged" | "error"
  changesJson: text("changes_json"),                   // JSON of what changed
  errorMessage: text("error_message"),
  taxYear: integer("tax_year").notNull(),
});
