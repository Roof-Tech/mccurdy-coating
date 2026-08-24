import OpenAI from "openai";

export type AnalysisResult = {
  materialType: "BUR" | "TPO" | "EPDM" | "Modified Bitumen" | "PVC" | "Metal" | "Shingle" | "Unknown";
  estimatedSqft: number;
  conditionRating: "Poor" | "Fair" | "Good" | "Excellent";
  visibleIssues: string[];
  recommendedUpgrades: Array<{ title: string; reason: string }>;
  overallSummary: string;
  confidence: Record<"materialType" | "sqft" | "condition" | "issues" | "upgrades", "high" | "medium" | "low">;
  model: string;
  analyzedAt: number;
};

const prompt = "You are a 30-year veteran commercial roofing inspector for McCurdy Silicone, a Bay Area silicone roof coating specialist. Analyze the roof photos provided. Return a JSON object with fields: materialType (BUR/TPO/EPDM/Modified Bitumen/PVC/Metal/Shingle/Unknown), estimatedSqft (number, best guess from photo perspective), conditionRating (Poor/Fair/Good/Excellent), visibleIssues (array of short strings), recommendedUpgrades (array of {title, reason}), overallSummary (2-3 sentences), and confidence ({materialType, sqft, condition, issues, upgrades}, each high/medium/low). For each field return a confidence: high/medium/low based on photo clarity and visibility.";

export async function analyzeRoofPhotos(imageUrls: string[]): Promise<AnalysisResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("AI_NOT_CONFIGURED");
  if (!imageUrls.length) throw new Error("At least one roof photo is required.");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: prompt }, { role: "user", content: imageUrls.map(url => ({ type: "image_url", image_url: { url } })) as any }],
  });
  const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
  return {
    materialType: parsed.materialType || "Unknown", estimatedSqft: Number(parsed.estimatedSqft) || 0,
    conditionRating: parsed.conditionRating || "Fair", visibleIssues: Array.isArray(parsed.visibleIssues) ? parsed.visibleIssues : [],
    recommendedUpgrades: Array.isArray(parsed.recommendedUpgrades) ? parsed.recommendedUpgrades : [],
    overallSummary: parsed.overallSummary || "No summary returned.",
    confidence: { materialType: parsed.confidence?.materialType || "medium", sqft: parsed.confidence?.sqft || "medium", condition: parsed.confidence?.condition || "medium", issues: parsed.confidence?.issues || "medium", upgrades: parsed.confidence?.upgrades || "medium" },
    model: "gpt-4o",
    analyzedAt: Math.floor(Date.now() / 1000),
  };
}

export type PublicEstimateAnalysis = {
  condition: "Good" | "Fair" | "Poor" | "Critical";
  materialType:
    | "TPO"
    | "EPDM"
    | "Modified Bitumen"
    | "Built-up Roof"
    | "Metal"
    | "Concrete"
    | "Composition Shingle"
    | "Other";
  sqftEstimate: number | null;
  issues: string[];
  upgrades: string[];
  confidence: "high" | "medium" | "low";
  notes: string;
};

const publicEstimatePrompt = `You are a commercial roofing analyst for McCurdy Silicone. Analyze the provided photos and satellite imagery of a commercial roof. Return valid JSON only.

Analyze this roof and return JSON with:
{
  "condition": "Good" | "Fair" | "Poor" | "Critical",
  "materialType": "TPO" | "EPDM" | "Modified Bitumen" | "Built-up Roof" | "Metal" | "Concrete" | "Composition Shingle" | "Other",
  "sqftEstimate": integer or null,
  "issues": string[] (max 5 short items),
  "upgrades": string[] (max 5 short items, framed as benefits of silicone recoat),
  "confidence": "high" | "medium" | "low",
  "notes": string (2-3 sentences, professional tone, do NOT diagnose structural issues — coating-focused only)
}

Rules:
- Never give a definitive dollar amount — that's not your job.
- If photos are unclear, set confidence to "low" and note "in-person inspection recommended for accurate assessment".
- Focus on coating suitability: is this a good candidate for silicone recoat?
- Never mention brands other than McCurdy.`;

export async function analyzeRoofForPublic(
  imageUrls: string[],
): Promise<PublicEstimateAnalysis> {
  if (!process.env.OPENAI_API_KEY) throw new Error("AI_NOT_CONFIGURED");
  if (!imageUrls.length) throw new Error("At least one roof photo is required.");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: publicEstimatePrompt },
      {
        role: "user",
        content: imageUrls.map((url) => ({
          type: "image_url",
          image_url: { url },
        })) as any,
      },
    ],
  });
  const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
  const validConditions = ["Good", "Fair", "Poor", "Critical"];
  const validMaterials = [
    "TPO", "EPDM", "Modified Bitumen", "Built-up Roof", "Metal",
    "Concrete", "Composition Shingle", "Other",
  ];
  const condition = validConditions.includes(parsed.condition)
    ? parsed.condition
    : "Fair";
  const materialType = validMaterials.includes(parsed.materialType)
    ? parsed.materialType
    : "Other";
  return {
    condition,
    materialType,
    sqftEstimate:
      Number.isFinite(Number(parsed.sqftEstimate)) && Number(parsed.sqftEstimate) > 0
        ? Math.round(Number(parsed.sqftEstimate))
        : null,
    issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 5).map(String) : [],
    upgrades: Array.isArray(parsed.upgrades) ? parsed.upgrades.slice(0, 5).map(String) : [],
    confidence: ["high", "medium", "low"].includes(parsed.confidence)
      ? parsed.confidence
      : "medium",
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
  };
}
