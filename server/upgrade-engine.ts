export type UpgradeSuggestion = { title: string; description: string; priceAdd: string; reason: string; priority: "critical" | "recommended" | "optional" };
export function getUpgradeSuggestions(proposal: { pricingOptions?: string | null; warrantyTerm?: string | null; county?: string | null; propertyAge?: number | null; hasHvac?: number | null; isFlatRoof?: number | null; addOns?: string | null }): UpgradeSuggestion[] {
  const output: UpgradeSuggestion[] = [];
  const tierText = `${proposal.warrantyTerm || ""} ${proposal.pricingOptions || ""}`;
  const years: number[] = [];
  const yearPattern = /(\d+)\s*-?\s*(?:year|yr)/gi;
  let match: RegExpExecArray | null;
  while ((match = yearPattern.exec(tierText))) years.push(Number(match[1]));
  if (years.length && Math.max(...years) <= 10) output.push({ title: "Upgrade to a 15-Year Warranty", description: "Only $1/sqft more for 50% longer coverage.", priceAdd: "+$1.00/sqft", reason: "92% of customers pick a 15+ year system for longer-term protection.", priority: "recommended" });
  if (["marin", "san francisco", "san mateo"].some(c => (proposal.county || "").toLowerCase().includes(c))) output.push({ title: "Salt-air resistant primer", description: "Coastal-grade primer for Bay Area marine exposure.", priceAdd: "+$0.35/sqft", reason: "Coastal air can accelerate surface degradation and corrosion.", priority: "recommended" });
  if ((proposal.propertyAge || 0) > 15) output.push({ title: "Reinforcement fabric at seams", description: "Fabric reinforcement at seams and transitions.", priceAdd: "+$0.50/sqft", reason: "Older roofs are more likely to develop movement at seams.", priority: "critical" });
  if (proposal.hasHvac) output.push({ title: "HVAC curb sealing + traffic pads", description: "Seal equipment curbs and add protected service paths.", priceAdd: "$350 flat", reason: "HVAC service traffic and penetrations are common leak points.", priority: "critical" });
  const addons = (proposal.addOns || "").toLowerCase();
  if (addons.includes("skylight")) output.push({ title: "Skylight resealing", description: "Refresh seals around existing skylights.", priceAdd: "+$150/unit", reason: "Skylight transitions benefit from renewed weatherproofing.", priority: "recommended" });
  if (proposal.isFlatRoof) output.push({ title: "Drain enhancement", description: "Optimize drainage at low spots and roof drains.", priceAdd: "$250 flat", reason: "Flat roofs need reliable drainage to limit standing water.", priority: "recommended" });
  return output;
}
