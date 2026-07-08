/**
 * McCurdy Coatings — Yearly Incentive Auto-Refresh Engine
 *
 * Automatically researches and updates roofing / energy incentives for every
 * California county McCurdy Coatings serves, on January 1st each year, plus
 * quarterly safety checks (Apr 1, Jul 1, Oct 1).
 *
 * How it works:
 *   1. On Jan 1 at 12:01 AM (or manual trigger) it walks each county.
 *   2. Calls Perplexity Sonar API to research: federal tax credits, CA state,
 *      Title 24, county programs, utility rebates, PACE / GoGreen financing.
 *   3. Parses AI response into structured programs matching our schema.
 *   4. Compares to prior year, logs diff, auto-publishes new data.
 *   5. Emails owner a full "What Changed for 2027" summary.
 */

import Database from "better-sqlite3";
import { randomUUID } from "crypto";

// The 10 counties McCurdy Coatings serves
export const SERVED_COUNTIES = [
  { key: "san-francisco", name: "San Francisco County", climateZoneHint: "Climate Zone 3" },
  { key: "san-mateo", name: "San Mateo County", climateZoneHint: "Climate Zone 3" },
  { key: "contra-costa", name: "Contra Costa County", climateZoneHint: "Climate Zone 3 / 12" },
  { key: "alameda", name: "Alameda County", climateZoneHint: "Climate Zone 3 / 12" },
  { key: "stanislaus", name: "Stanislaus County", climateZoneHint: "Climate Zone 12" },
  { key: "san-joaquin", name: "San Joaquin County", climateZoneHint: "Climate Zone 12" },
  { key: "solano", name: "Solano County", climateZoneHint: "Climate Zone 12" },
  { key: "marin", name: "Marin County", climateZoneHint: "Climate Zone 3" },
  { key: "merced", name: "Merced County", climateZoneHint: "Climate Zone 13" },
  { key: "santa-clara", name: "Santa Clara County", climateZoneHint: "Climate Zone 4" },
];

export interface CountyIncentiveProgram {
  name: string;
  type: "tax_deduction" | "rebate" | "utility" | "financing" | "compliance";
  description: string;
  link: string;
  amount?: string;
  notes?: string;
}

export interface CountyIncentiveData {
  county: string;
  climateZone: string;
  utility: string;
  programs: CountyIncentiveProgram[];
}

// Trusted domains we tell the AI to prioritize
const TRUSTED_SOURCES = [
  "irs.gov",
  "energystar.gov",
  "energy.ca.gov",
  "cec.ca.gov",
  "dsireusa.org",           // Database of State Incentives for Renewables & Efficiency
  "coolroofs.org",          // Cool Roof Rating Council
  "pge.com",
  "cleanpowersf.org",
  "peninsulacleanenergy.com",
  "ebce.org",
  "mcecleanenergy.org",
  "svcleanenergy.org",
  "bayren.org",
  "gogreenfinancing.com",
  "dfpi.ca.gov",
  "valleyair.org",
  "energyupgradeca.org",
  "hero.ygrene.com",
];

/**
 * Build the research prompt for a single county for a given tax year.
 * This is what gets sent to Perplexity Sonar API.
 */
export function buildResearchPrompt(countyName: string, taxYear: number, climateZoneHint: string): string {
  return `You are a research analyst compiling a definitive list of ${taxYear} tax credits, rebates, and incentive programs available to commercial and residential property owners in ${countyName}, California who are installing silicone roof coating systems.

REQUIRED CATEGORIES (find at least one program per category if available):
1. FEDERAL tax credits/deductions (25C, Section 179, Section 179D, Section 45L, Inflation Reduction Act updates for ${taxYear})
2. CALIFORNIA STATE programs (Title 24 Part 6 requirements for ${taxYear}, Cool Roof requirements, SGIP, TECH Clean California)
3. COUNTY-LEVEL programs specific to ${countyName}
4. UTILITY rebates (PG&E, and county-specific like ${climateZoneHint} utilities: PCE, CleanPowerSF, EBCE, MCE, SVCE, TID, MID, AMP)
5. REGIONAL programs (BayREN Home+, BayREN EASE, San Joaquin Valley APCD)
6. FINANCING (PACE, GoGreen, HERO, YGrene)
7. Title 24 COMPLIANCE requirements for the specific climate zone of ${countyName}

For EACH program return:
- name (concise official name)
- type (must be exactly one of: "tax_deduction", "rebate", "utility", "financing", "compliance")
- description (2-3 sentences, current for ${taxYear})
- link (official government or utility source URL)
- amount (dollar figure or percentage if applicable, else omit)
- notes (eligibility caveats, if applicable)

Also return:
- climate zone(s) covering ${countyName}
- primary electric utility for ${countyName}

Return ONLY valid JSON in this exact structure (no markdown, no commentary):

{
  "county": "${countyName}",
  "climateZone": "Climate Zone X (details)",
  "utility": "Primary utility name(s)",
  "programs": [
    { "name": "...", "type": "...", "description": "...", "link": "https://...", "amount": "...", "notes": "..." }
  ]
}

Requirements:
- Only include programs that are CURRENTLY ACTIVE for ${taxYear}. Do NOT include expired programs.
- Prefer official sources: irs.gov, energy.ca.gov, pge.com, dsireusa.org, bayren.org, and the county's own utility.
- If a federal or state program has updated dollar amounts or eligibility for ${taxYear}, use the ${taxYear} numbers, not older figures.
- Include the specific Title 24 requirements applicable to ${countyName}'s climate zone.
- Aim for 8-12 programs per county.`;
}

/**
 * Call Perplexity Sonar API to research a county's incentives.
 * Returns parsed CountyIncentiveData or throws on failure.
 */
export async function researchCountyIncentives(
  countyName: string,
  taxYear: number,
  climateZoneHint: string
): Promise<{ data: CountyIncentiveData; sources: string[] }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY not set - cannot auto-refresh incentives");
  }

  const prompt = buildResearchPrompt(countyName, taxYear, climateZoneHint);

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: "You are a meticulous tax and incentive research analyst. Return only valid JSON with no surrounding markdown code fences." },
        { role: "user", content: prompt },
      ],
      search_domain_filter: TRUSTED_SOURCES,
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Perplexity API error (${response.status}): ${errText}`);
  }

  const payload = await response.json() as any;
  const content: string = payload?.choices?.[0]?.message?.content ?? "";
  const citations: string[] = payload?.citations ?? [];

  // Strip any ```json fences AI may add despite instructions
  const clean = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  let parsed: CountyIncentiveData;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    throw new Error(`Failed to parse AI JSON response for ${countyName}: ${(e as Error).message}\nRaw: ${clean.slice(0, 500)}`);
  }

  // Validate shape
  if (!parsed.county || !parsed.programs || !Array.isArray(parsed.programs)) {
    throw new Error(`Invalid response shape for ${countyName}`);
  }

  // Filter programs to valid types & require required fields
  const validTypes = new Set(["tax_deduction", "rebate", "utility", "financing", "compliance"]);
  parsed.programs = parsed.programs.filter(p =>
    p && typeof p.name === "string" && typeof p.description === "string" &&
    typeof p.link === "string" && validTypes.has(p.type)
  );

  if (parsed.programs.length < 3) {
    throw new Error(`Only ${parsed.programs.length} valid programs returned for ${countyName} — likely research failure`);
  }

  return { data: parsed, sources: citations };
}

/**
 * Diff two versions of county data. Returns a human-readable summary of changes.
 */
export interface IncentiveDiff {
  added: string[];
  removed: string[];
  updated: string[];
  amountChanges: string[];
}

export function diffIncentives(
  oldData: CountyIncentiveData | null,
  newData: CountyIncentiveData
): IncentiveDiff {
  const diff: IncentiveDiff = { added: [], removed: [], updated: [], amountChanges: [] };
  if (!oldData) {
    diff.added = newData.programs.map(p => p.name);
    return diff;
  }
  const oldMap = new Map(oldData.programs.map(p => [p.name.toLowerCase(), p]));
  const newMap = new Map(newData.programs.map(p => [p.name.toLowerCase(), p]));

  newMap.forEach((prog, name) => {
    if (!oldMap.has(name)) diff.added.push(prog.name);
    else {
      const old = oldMap.get(name)!;
      if (old.amount !== prog.amount && (old.amount || prog.amount)) {
        diff.amountChanges.push(`${prog.name}: "${old.amount ?? "—"}" → "${prog.amount ?? "—"}"`);
      } else if (old.description !== prog.description || old.link !== prog.link) {
        diff.updated.push(prog.name);
      }
    }
  });
  oldMap.forEach((prog, name) => {
    if (!newMap.has(name)) diff.removed.push(prog.name);
  });
  return diff;
}

/**
 * Run the full refresh for all counties. Auto-publish mode:
 *   - Successful counties are written to DB immediately (customers see new data next request)
 *   - Failed counties keep prior year data, are logged, and included in email
 * Returns an email-ready summary.
 */
export async function refreshAllCounties(
  db: Database.Database,
  taxYear: number,
  runType: "yearly" | "quarterly" | "manual" = "yearly"
): Promise<string> {
  const runId = randomUUID();
  const runAt = new Date().toISOString();
  const summary: string[] = [];
  summary.push(`# McCurdy Coatings — Incentive Auto-Refresh Report`);
  summary.push(`Run: ${runType.toUpperCase()} · Tax Year: ${taxYear} · ${runAt}\n`);

  let successCount = 0;
  let errorCount = 0;
  let totalChanges = 0;

  for (const county of SERVED_COUNTIES) {
    try {
      const { data: newData, sources } = await researchCountyIncentives(county.name, taxYear, county.climateZoneHint);

      // Load prior data (if any) from DB
      const prior = db.prepare(
        "SELECT programs, tax_year FROM county_incentives WHERE county_key = ?"
      ).get(county.key) as { programs: string; tax_year: number } | undefined;

      let oldData: CountyIncentiveData | null = null;
      if (prior) {
        try {
          const oldProgs = JSON.parse(prior.programs);
          oldData = { county: county.name, climateZone: "", utility: "", programs: oldProgs };
        } catch {}
      }
      const diff = diffIncentives(oldData, newData);
      const changed = diff.added.length + diff.removed.length + diff.updated.length + diff.amountChanges.length;
      totalChanges += changed;

      // AUTO-PUBLISH: upsert to database
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO county_incentives (county_key, county_name, climate_zone, utility, programs, tax_year, last_updated, last_audit_passed, sources_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(county_key) DO UPDATE SET
          county_name = excluded.county_name,
          climate_zone = excluded.climate_zone,
          utility = excluded.utility,
          programs = excluded.programs,
          tax_year = excluded.tax_year,
          last_updated = excluded.last_updated,
          last_audit_passed = excluded.last_audit_passed,
          sources_json = excluded.sources_json
      `).run(
        county.key,
        newData.county,
        newData.climateZone,
        newData.utility,
        JSON.stringify(newData.programs),
        taxYear,
        now,
        now,
        JSON.stringify(sources)
      );

      db.prepare(`
        INSERT INTO incentive_refresh_log (run_id, run_at, run_type, county_key, status, changes_json, tax_year)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(runId, runAt, runType, county.key, changed > 0 ? "updated" : "unchanged", JSON.stringify(diff), taxYear);

      successCount++;
      summary.push(`## ✅ ${newData.county}`);
      summary.push(`- Programs: ${newData.programs.length} (${changed} changes)`);
      if (diff.added.length) summary.push(`- ➕ NEW: ${diff.added.join(", ")}`);
      if (diff.removed.length) summary.push(`- ➖ REMOVED (expired): ${diff.removed.join(", ")}`);
      if (diff.amountChanges.length) summary.push(`- 💵 AMOUNTS CHANGED:\n  - ${diff.amountChanges.join("\n  - ")}`);
      if (diff.updated.length) summary.push(`- 🔄 UPDATED DETAILS: ${diff.updated.join(", ")}`);
      summary.push("");
    } catch (err) {
      errorCount++;
      const msg = (err as Error).message;
      db.prepare(`
        INSERT INTO incentive_refresh_log (run_id, run_at, run_type, county_key, status, error_message, tax_year)
        VALUES (?, ?, ?, ?, 'error', ?, ?)
      `).run(runId, runAt, runType, county.key, msg, taxYear);
      summary.push(`## ❌ ${county.name}`);
      summary.push(`- Refresh failed: ${msg}`);
      summary.push(`- Prior year data retained. Will retry on next quarterly check.\n`);
    }
  }

  summary.unshift(
    `**Summary:** ${successCount}/${SERVED_COUNTIES.length} counties refreshed successfully · ${totalChanges} total changes · ${errorCount} errors\n`
  );
  return summary.join("\n");
}

/**
 * Initialize DB tables if they don't exist. Safe to call on every server start.
 */
export function initIncentiveTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS county_incentives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      county_key TEXT NOT NULL UNIQUE,
      county_name TEXT NOT NULL,
      climate_zone TEXT NOT NULL,
      utility TEXT NOT NULL,
      programs TEXT NOT NULL,
      tax_year INTEGER NOT NULL,
      last_updated TEXT NOT NULL,
      last_audit_passed TEXT,
      sources_json TEXT
    );
    CREATE TABLE IF NOT EXISTS incentive_refresh_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      run_at TEXT NOT NULL,
      run_type TEXT NOT NULL,
      county_key TEXT NOT NULL,
      status TEXT NOT NULL,
      changes_json TEXT,
      error_message TEXT,
      tax_year INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_log_run ON incentive_refresh_log(run_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_log_county ON incentive_refresh_log(county_key);
  `);
}

/**
 * Read a county's current data from DB (fallback to hard-coded seed if DB empty).
 */
export function getCountyFromDb(db: Database.Database, countyKey: string): CountyIncentiveData | null {
  const row = db.prepare(
    "SELECT county_name, climate_zone, utility, programs FROM county_incentives WHERE county_key = ?"
  ).get(countyKey) as any;
  if (!row) return null;
  try {
    return {
      county: row.county_name,
      climateZone: row.climate_zone,
      utility: row.utility,
      programs: JSON.parse(row.programs),
    };
  } catch {
    return null;
  }
}

export function getAllCountiesFromDb(db: Database.Database): CountyIncentiveData[] {
  const rows = db.prepare(
    "SELECT county_name, climate_zone, utility, programs FROM county_incentives ORDER BY county_name"
  ).all() as any[];
  return rows.map(r => {
    try {
      return {
        county: r.county_name,
        climateZone: r.climate_zone,
        utility: r.utility,
        programs: JSON.parse(r.programs),
      };
    } catch {
      return null;
    }
  }).filter((x): x is CountyIncentiveData => x !== null);
}
