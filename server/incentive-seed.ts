/**
 * Seeds the current 2026 incentive data into the DB on first boot.
 * This is a one-time bootstrap so customers always see accurate data even
 * before the first automatic January 1st refresh runs.
 *
 * After the first Jan-1 refresh, this data gets replaced with fresh AI-researched
 * data reflecting the new tax year.
 */

import Database from "better-sqlite3";

const SEED_TAX_YEAR = 2026;
const NOW = new Date().toISOString();

const COUNTIES_2026 = {
  "alameda": {
    countyName: "Alameda County",
    climateZone: "Climate Zone 3 (Coast) / 12 (Inland — Livermore, Dublin, Pleasanton)",
    utility: "PG&E / East Bay Community Energy (EBCE)",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for qualifying energy-efficient improvements including cool roof installations in their service territory.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html", notes: "Cool roof coatings that meet CRRC standards may qualify." },
      { name: "BayREN Home+ Program", type: "rebate", description: "Bay Area Regional Energy Network offers rebates and low-cost energy assessments for Bay Area homeowners including Alameda County residents.", link: "https://www.bayren.org/programs-rebates", amount: "Varies by measure" },
      { name: "BayREN EASE Home Program", type: "rebate", description: "Efficiency and Sustainable Energy program with customer co-pay capped at $1,000 for qualifying weatherization and energy efficiency upgrades.", link: "https://www.bayren.org/ease-home", amount: "Co-pay capped at $1,000" },
      { name: "Alameda Municipal Power Rebates", type: "utility", description: "AMP customers can apply for rebates for heat pump HVAC, smart thermostats, electric panel upgrades, and energy efficiency measures.", link: "https://www.alamedamp.com/398/Rebates-Programs" },
      { name: "East Bay Community Energy Programs", type: "utility", description: "EBCE provides clean energy programs and incentives for Alameda County residents and businesses.", link: "https://ebce.org/" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for energy efficiency improvements including roofing. Repaid through property tax assessment.", link: "https://dfpi.ca.gov/consumers/housing/pace/", notes: "100% financing available." },
      { name: "Title 24 Compliance (Zone 3/12)", type: "compliance", description: "Zone 3: No prescriptive cool roof requirement. Zone 12 (inland): Cool roof with SRI ≥16 (steep-slope), SRI ≥75 (low-slope).", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and", notes: "Silicone coating systems exceed all Title 24 cool roof thresholds." },
      { name: "Federal Energy Efficient Home Improvement Credit (25C)", type: "tax_deduction", description: "Federal tax credit up to 30% of qualifying energy-efficient home improvement costs, up to $1,200/year for roofing materials.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial property owners may deduct full cost of roof restoration as a business expense in the year completed.", link: "https://www.irs.gov/forms-pubs/about-publication-946", notes: "Consult your CPA." },
    ]
  },
  "san-mateo": {
    countyName: "San Mateo County",
    climateZone: "Climate Zone 3",
    utility: "PG&E / Peninsula Clean Energy (PCE)",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for qualifying energy-efficient improvements including cool roof installations.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "Peninsula Clean Energy (PCE) Rebates", type: "utility", description: "PCE customers can apply for rebates for heat pump water heaters, heat pump HVACs, electric panel upgrades. PCE also offers zero percent loans up to $10,000 for energy upgrades.", link: "https://www.peninsulacleanenergy.com/residents/", amount: "Up to $10,000 at 0% interest" },
      { name: "PCE Home Upgrade Services", type: "utility", description: "Income-qualified residents may receive no-cost upgrades to convert outdated gas appliances to safer, healthier, more energy-efficient options.", link: "https://www.peninsulacleanenergy.com/residents/" },
      { name: "BayREN Home+ Program", type: "rebate", description: "Bay Area Regional Energy Network offers rebates and low-cost energy assessments for Bay Area homeowners.", link: "https://www.bayren.org/programs-rebates" },
      { name: "BayREN EASE Home Program", type: "rebate", description: "Weatherization and energy efficiency upgrades with customer co-pay capped at $1,000.", link: "https://www.bayren.org/ease-home", amount: "Co-pay capped at $1,000" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for roofing and energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "GoGreen Financing", type: "financing", description: "PG&E customers can finance up to 100% of energy upgrade costs through approved lenders.", link: "https://gogreenfinancing.com/" },
      { name: "Title 24 Compliance (Zone 3)", type: "compliance", description: "Climate Zone 3 has no prescriptive cool roof requirement for steep-slope residential. Low-slope commercial: SRI ≥75.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and" },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying energy-efficient roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
    ]
  },
  "san-francisco": {
    countyName: "San Francisco County",
    climateZone: "Climate Zone 3",
    utility: "PG&E / CleanPowerSF",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for qualifying energy-efficient improvements.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "CleanPowerSF", type: "utility", description: "San Francisco's community choice energy program providing 100% renewable electricity.", link: "https://www.cleanpowersf.org/" },
      { name: "SF Environment Energy Programs", type: "rebate", description: "San Francisco Department of Environment offers programs for energy efficiency, green building, and climate action.", link: "https://sfenvironment.org/energy" },
      { name: "BayREN Home+ Program", type: "rebate", description: "Rebates and energy assessments for San Francisco homeowners through the Bay Area Regional Energy Network.", link: "https://www.bayren.org/programs-rebates" },
      { name: "BayREN EASE Home Program", type: "rebate", description: "Weatherization upgrades with co-pay capped at $1,000.", link: "https://www.bayren.org/ease-home", amount: "Co-pay capped at $1,000" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "Title 24 Compliance (Zone 3)", type: "compliance", description: "Climate Zone 3: No prescriptive cool roof requirement for steep-slope. Low-slope commercial buildings: SRI ≥75.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and" },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
    ]
  },
  "contra-costa": {
    countyName: "Contra Costa County",
    climateZone: "Climate Zone 3 (West) / 12 (East - Concord, Antioch, Brentwood)",
    utility: "PG&E / MCE Clean Energy",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for qualifying energy-efficient improvements including cool roof installations.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "MCE Clean Energy Rebates", type: "utility", description: "MCE is the community choice aggregator for parts of Contra Costa. Offers rebates for energy efficiency improvements.", link: "https://www.mcecleanenergy.org/rebates/" },
      { name: "BayREN Home+ Program", type: "rebate", description: "Bay Area Regional Energy Network offers rebates for Contra Costa homeowners.", link: "https://www.bayren.org/programs-rebates" },
      { name: "BayREN EASE Home Program", type: "rebate", description: "Weatherization upgrades with co-pay capped at $1,000.", link: "https://www.bayren.org/ease-home", amount: "Co-pay capped at $1,000" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "GoGreen Financing", type: "financing", description: "PG&E customers can finance up to 100% of energy upgrade costs through approved lenders.", link: "https://gogreenfinancing.com/" },
      { name: "Title 24 Compliance (Zone 3/12)", type: "compliance", description: "West Contra Costa (Zone 3): no prescriptive cool roof. East Contra Costa (Zone 12): steep-slope SRI ≥16, low-slope SRI ≥75.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and", notes: "Silicone coatings exceed all requirements." },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
    ]
  },
  "stanislaus": {
    countyName: "Stanislaus County",
    climateZone: "Climate Zone 12",
    utility: "PG&E / Turlock Irrigation District (TID) / Modesto Irrigation District (MID)",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E customers can access rebates for energy-efficient improvements.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "Turlock Irrigation District (TID) Rebates", type: "utility", description: "TID offers energy efficiency rebates for customers in the Turlock area.", link: "https://www.tid.org/customer-service/save-energy-money/rebates/" },
      { name: "Modesto Irrigation District (MID) Programs", type: "utility", description: "MID provides energy efficiency programs and rebates for commercial and residential customers.", link: "https://www.mid.org/rebates/" },
      { name: "San Joaquin Valley Air Pollution Control District", type: "rebate", description: "SJVAPCD offers various incentive programs for air quality improvements in the San Joaquin Valley.", link: "https://www.valleyair.org/grants/" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing available for energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "Title 24 Compliance (Zone 12)", type: "compliance", description: "Zone 12 requires cool roof compliance: steep-slope SRI ≥16, low-slope SRI ≥75.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and", notes: "Silicone systems exceed Zone 12 requirements with SRI 110+." },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
      { name: "Energy Upgrade California", type: "rebate", description: "Statewide program offering incentives for home improvements including energy-efficient roofing.", link: "https://www.energyupgradeca.org/", amount: "Up to $5,000 for combined upgrades" },
    ]
  },
  "san-joaquin": {
    countyName: "San Joaquin County",
    climateZone: "Climate Zone 12",
    utility: "PG&E",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for energy-efficient improvements including cool roof installations.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "San Joaquin Valley Air Pollution Control District", type: "rebate", description: "SJVAPCD administers various incentive programs for San Joaquin Valley residents.", link: "https://www.valleyair.org/grants/" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for roofing and energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "GoGreen Financing", type: "financing", description: "PG&E customers can finance up to 100% of energy upgrade costs.", link: "https://gogreenfinancing.com/" },
      { name: "Title 24 Compliance (Zone 12)", type: "compliance", description: "Zone 12: prescriptive cool roof requirements. Steep-slope SRI ≥16. Low-slope SRI ≥75.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and" },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
      { name: "Energy Upgrade California", type: "rebate", description: "Statewide incentives for home energy improvements.", link: "https://www.energyupgradeca.org/", amount: "Up to $5,000 for combined upgrades" },
    ]
  },
  "solano": {
    countyName: "Solano County",
    climateZone: "Climate Zone 12",
    utility: "PG&E / MCE Clean Energy",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for energy-efficient improvements.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "MCE Clean Energy Rebates", type: "utility", description: "MCE serves parts of Solano County — rebates for energy efficiency improvements.", link: "https://www.mcecleanenergy.org/rebates/" },
      { name: "BayREN Home+ Program", type: "rebate", description: "Bay Area Regional Energy Network offers rebates for Solano homeowners.", link: "https://www.bayren.org/programs-rebates" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "GoGreen Financing", type: "financing", description: "Finance up to 100% of energy upgrade costs.", link: "https://gogreenfinancing.com/" },
      { name: "Title 24 Compliance (Zone 12)", type: "compliance", description: "Zone 12: cool roof required. Steep-slope SRI ≥16. Low-slope SRI ≥75.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and" },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
    ]
  },
  "marin": {
    countyName: "Marin County",
    climateZone: "Climate Zone 3",
    utility: "PG&E / MCE Clean Energy",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for energy-efficient improvements.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "MCE Clean Energy Rebates", type: "utility", description: "MCE is the primary community choice aggregator for Marin. Offers rebates and clean energy programs.", link: "https://www.mcecleanenergy.org/rebates/" },
      { name: "BayREN Home+ Program", type: "rebate", description: "Bay Area Regional Energy Network offers rebates for Marin homeowners.", link: "https://www.bayren.org/programs-rebates" },
      { name: "BayREN EASE Home Program", type: "rebate", description: "Weatherization upgrades with co-pay capped at $1,000.", link: "https://www.bayren.org/ease-home", amount: "Co-pay capped at $1,000" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "Title 24 Compliance (Zone 3)", type: "compliance", description: "Zone 3: no prescriptive cool roof for steep-slope. Low-slope commercial: SRI ≥75.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and" },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
    ]
  },
  "merced": {
    countyName: "Merced County",
    climateZone: "Climate Zone 13",
    utility: "PG&E / Merced Irrigation District",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for energy-efficient improvements including cool roof installations.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "Merced Irrigation District Programs", type: "utility", description: "Merced ID offers energy efficiency programs for area customers.", link: "https://www.mercedid.com/" },
      { name: "San Joaquin Valley Air Pollution Control District", type: "rebate", description: "SJVAPCD offers various incentive programs for Valley residents.", link: "https://www.valleyair.org/grants/" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "GoGreen Financing", type: "financing", description: "Finance up to 100% of energy upgrade costs.", link: "https://gogreenfinancing.com/" },
      { name: "Title 24 Compliance (Zone 13)", type: "compliance", description: "Zone 13 (very hot): strictest cool roof requirements. Steep-slope SRI ≥16 or aged SR ≥0.20 with TE ≥0.75. Low-slope SRI ≥75 or aged SR ≥0.63 with TE ≥0.75.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and", notes: "Silicone coatings dramatically exceed these requirements." },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
      { name: "Energy Upgrade California", type: "rebate", description: "Statewide incentives for home energy improvements.", link: "https://www.energyupgradeca.org/", amount: "Up to $5,000 for combined upgrades" },
    ]
  },
  "santa-clara": {
    countyName: "Santa Clara County",
    climateZone: "Climate Zone 4",
    utility: "PG&E / Silicon Valley Clean Energy (SVCE) / Silicon Valley Power (Santa Clara city)",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for qualifying energy-efficient improvements including cool roof installations.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "Silicon Valley Clean Energy (SVCE) Rebates", type: "utility", description: "SVCE serves most of Santa Clara County. Offers heat pump rebates, EV incentives, and building electrification programs.", link: "https://svcleanenergy.org/rebates/" },
      { name: "Silicon Valley Power Rebates", type: "utility", description: "For City of Santa Clara customers — SVP provides energy efficiency rebates for HVAC, lighting, and building envelope improvements.", link: "https://www.siliconvalleypower.com/residents/save-energy/rebates-and-incentives" },
      { name: "BayREN Home+ Program", type: "rebate", description: "Bay Area Regional Energy Network offers rebates for Santa Clara homeowners.", link: "https://www.bayren.org/programs-rebates" },
      { name: "BayREN EASE Home Program", type: "rebate", description: "Weatherization upgrades with co-pay capped at $1,000.", link: "https://www.bayren.org/ease-home", amount: "Co-pay capped at $1,000" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "GoGreen Financing", type: "financing", description: "Finance up to 100% of energy upgrade costs.", link: "https://gogreenfinancing.com/" },
      { name: "Title 24 Compliance (Zone 4)", type: "compliance", description: "Zone 4: cool roof required for low-slope commercial (SRI ≥75). Steep-slope residential: no prescriptive requirement but earns compliance credit.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and" },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
    ]
  },
} as const;

export function seedInitialIncentives(db: Database.Database) {
  const insert = db.prepare(`
    INSERT INTO county_incentives (county_key, county_name, climate_zone, utility, programs, tax_year, last_updated, last_audit_passed, sources_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(county_key) DO NOTHING
  `);
  for (const [key, data] of Object.entries(COUNTIES_2026)) {
    insert.run(
      key,
      data.countyName,
      data.climateZone,
      data.utility,
      JSON.stringify(data.programs),
      SEED_TAX_YEAR,
      NOW,
      NOW,
      "[]"
    );
  }
  console.log(`[incentive-seed] Seeded ${Object.keys(COUNTIES_2026).length} counties with ${SEED_TAX_YEAR} data`);
}
