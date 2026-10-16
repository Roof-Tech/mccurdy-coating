/**
 * Single source of truth for which incentive programs a customer may see and how
 * they are worded. Applied at read time to every source (seed data, the yearly
 * AI refresh, scheduled-task upserts, and per-proposal incentives), so stale or
 * unverified research can never be shown as confirmed.
 *
 * Sources (verified 2026-10-16):
 *  - Section 179 2026 limits: IRS Pub. 946 — https://www.irs.gov/publications/p946
 *  - 25C ends for property placed in service after 12/31/2025 (P.L. 119-21) —
 *    https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb
 *  - 179D ends for property whose construction begins after 6/30/2026 — https://www.irs.gov/instructions/i7205
 *  - 2025 California Energy Code (effective 1/1/2026) — https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards
 *  - BayREN Business eligibility — https://www.bayren.org/business
 */

export type VerificationStatus = "current" | "needs_review" | "expired";
export interface RuleContext {
  propertyType: string; // commercial | residential | multifamily
  utilityTerritory?: string;
  climateZone?: string;
  /** ISO date the project's construction begins/began, if known. */
  constructionStart?: string | null;
  now?: Date;
}
export interface RuledProgram {
  name: string;
  type: string;
  description: string;
  link: string;
  amount?: string;
  notes?: string;
  verified?: string;
  reviewStatus?: string;
  source?: string;
  verificationStatus: VerificationStatus;
  reviewNote?: string;
  [key: string]: unknown;
}

const STALE_DAYS = 90;
const SECTION_25C_LAST_DAY = "2025-12-31";
const SECTION_179D_LAST_START = "2026-06-30";
const RULES_VERIFIED = "2026-10-16";
const CPA = "Consult your CPA. McCurdy does not provide tax advice. Rules subject to change.";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const RESIDENTIAL_ONLY = /25c|home improvement credit|bayren home|ease home|home\+|pce home|home upgrade|income[- ]qualified|\/residents/i;
const OVERCLAIM = /(meets? or exceeds?|exceeds? all)[^.]*(title 24|climate zones?|thresholds?)[^.]*\.?/gi;

function daysSince(dateStr: string | undefined, now: Date): number | null {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  return Number.isFinite(t) ? (now.getTime() - t) / 86400000 : null;
}

export function applyIncentiveRules(programs: any[], ctx: RuleContext): RuledProgram[] {
  const now = ctx.now ?? new Date();
  const today = isoDay(now);
  const property = (ctx.propertyType || "commercial").toLowerCase();
  const pge = /pg\s*&?\s*e|pge/i.test(ctx.utilityTerritory || "");
  const start = ctx.constructionStart || today; // unknown start = a project starting now
  const out: RuledProgram[] = [];

  for (const raw of programs || []) {
    const p: any = { ...raw };
    const name = String(p.name || p.programName || "");
    const text = `${name} ${p.description || ""} ${p.link || ""}`;

    // 13) 25C expired for property placed in service after 12/31/2025.
    if (/25c|energy efficient home improvement credit/i.test(name)) {
      if (start > SECTION_25C_LAST_DAY) continue;
    }
    // 16) Residential programs never appear on commercial proposals.
    if (property === "commercial" && RESIDENTIAL_ONLY.test(text)) continue;
    if (property !== "multifamily" && /bambe/i.test(name)) continue;

    // 15) 179D: suppressed when construction begins after 6/30/2026.
    if (/179d/i.test(name)) {
      if (property === "residential" || start > SECTION_179D_LAST_START) continue;
      Object.assign(p, {
        name: "Section 179D — Energy Efficient Commercial Buildings Deduction",
        type: "tax_deduction",
        description: "A per-square-foot deduction for qualifying energy-efficiency improvements to commercial buildings, based on modeled energy savings versus a reference building. A roof coating alone rarely qualifies; it usually counts only as part of a certified building-envelope project. Not available for property whose construction begins after June 30, 2026.",
        link: "https://www.irs.gov/instructions/i7205",
        notes: `Your project's construction start (${start}) is on or before the June 30, 2026 cutoff. Requires a qualified energy model and certification. ${CPA}`,
        verified: RULES_VERIFIED,
      });
      delete p.amount;
    }
    // 12) Section 179 — corrected 2026 limits and the 179 / 179D / MACRS distinction.
    else if (/section 179\b|sec\.? 179\b/i.test(name)) {
      if (property === "residential") continue;
      Object.assign(p, {
        name: "Section 179 Expensing — Commercial Roofs (2026)",
        type: "tax_deduction",
        description: "Roofs on nonresidential buildings count as \"qualified real property,\" so a business owner may elect to expense the roof cost in the year it's placed in service instead of depreciating it. For tax years beginning in 2026 the maximum is $2,560,000, reduced dollar-for-dollar once total Section 179 property exceeds $4,090,000, and limited to business taxable income. Without the election, a commercial roof is depreciated over 39 years under MACRS. Section 179D is a separate energy-efficiency deduction.",
        amount: "Up to $2,560,000 (2026 limit)",
        link: "https://www.irs.gov/publications/p946",
        notes: `Eligibility depends on your business, entity type, and taxable income. ${CPA}`,
        verified: RULES_VERIFIED,
      });
    }
    // MACRS / repair vs. improvement: no "shorter schedule" claims.
    else if (/macrs|depreciation/i.test(name) && !/179/.test(name)) {
      if (property === "residential") continue;
      Object.assign(p, {
        name: "Depreciation vs. Repair Treatment",
        type: "tax_deduction",
        description: "If Section 179 isn't elected, a roof that counts as an improvement is depreciated over 39 years (MACRS). Depending on the scope, a restoration coating may instead be treated as a deductible repair under the IRS tangible property rules. Your tax advisor decides which treatment applies.",
        link: "https://www.irs.gov/businesses/small-businesses-self-employed/tangible-property-final-regulations",
        notes: CPA,
        verified: RULES_VERIFIED,
      });
      delete p.amount;
    }
    // 14) PG&E: no specific roof-coating rebate is promised.
    else if (/pg\s*&?\s*e|pge\.com/i.test(name) && /rebate|incentive/i.test(text)) {
      Object.assign(p, {
        name: property === "commercial" ? "PG&E Business Energy-Efficiency Rebates" : "PG&E Rebates & Incentives",
        type: "utility",
        description: "PG&E updates its rebate catalog during the year. PG&E's current pages do not list a dedicated roof-coating rebate, so none is assumed in this proposal. McCurdy will check the current catalog for your property before you apply.",
        link: property === "commercial" ? "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives/business-energy-efficiency-rebates.html" : "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html",
        notes: "No dollar amount is claimed. Eligibility is determined by PG&E.",
        reviewStatus: raw.reviewStatus === "approved" ? "approved" : "needs_review",
      });
      delete p.amount;
    }
    // 16) BayREN Business: only with an explicit eligibility check.
    else if (/bayren business/i.test(name)) {
      if (property !== "commercial" || !pge) continue;
      Object.assign(p, {
        description: "BayREN Business may support energy upgrades at qualifying commercial sites. Eligibility depends on building type, size, meter history, and energy use, plus which measures the program currently funds.",
        link: "https://www.bayren.org/business",
        notes: "Eligibility check required: McCurdy will confirm your site type, meter history, and usage with BayREN before you rely on this.",
        reviewStatus: raw.reviewStatus === "approved" ? "approved" : "needs_review",
      });
      delete p.amount;
    }
    // 17) Title 24: project-specific wording only.
    else if (/title 24|energy code/i.test(name)) {
      Object.assign(p, {
        name: "2025 California Energy Code (Title 24, Part 6)",
        type: "compliance",
        description: `The 2025 Energy Code took effect January 1, 2026. Whether a cool roof is required, and what reflectance/emittance or SRI applies, depends on your roof slope, building type, ${ctx.climateZone ? `climate zone (${ctx.climateZone})` : "climate zone"}, and whether the work is a permitted reroof or recoat.`,
        link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards",
        notes: "McCurdy provides the specified coating's CRRC-rated aged solar reflectance, thermal emittance, and SRI with your permit documents. Compliance is confirmed for your specific project.",
        verified: RULES_VERIFIED,
      });
    }

    for (const k of ["description", "notes"]) if (typeof p[k] === "string") p[k] = p[k].replace(OVERCLAIM, "").trim();

    // 6) Verification status — enforced, not just displayed.
    const age = daysSince(p.verified || p.lastVerified || p.lastVerifiedDate, now);
    let status: VerificationStatus = "current";
    let reviewNote: string | undefined;
    if (p.expiryDate && String(p.expiryDate) < today) status = "expired";
    else if (p.reviewStatus === "needs_review" || p.source === "auto_research") { status = "needs_review"; reviewNote = "Not yet confirmed by McCurdy. Check with the provider before relying on it."; }
    else if (age === null || age > STALE_DAYS) { status = "needs_review"; reviewNote = `Last confirmed ${p.verified ? new Date(`${String(p.verified).slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "date unknown"}. Re-check with the provider.`; }
    if (status === "expired") continue;
    delete p.approvedBy;
    if (status === "needs_review" && p.amount) { p.unconfirmedAmount = p.amount; delete p.amount; }
    out.push({ ...p, verificationStatus: status, reviewNote });
  }
  return out;
}
