import OpenAI from "openai";

export type AnalysisResult = {
  materialType: "BUR" | "TPO" | "EPDM" | "Modified Bitumen" | "PVC" | "Metal" | "Shingle" | "Unknown";
  estimatedSqft: number;
  conditionRating: "Poor" | "Fair" | "Good" | "Excellent";
  visibleIssues: string[];
  recommendedUpgrades: Array<{ title: string; reason: string }>;
  overallSummary: string;
};

const prompt = "You are a 30-year veteran commercial roofing inspector for McCurdy Coatings, a Bay Area silicone roof coating specialist. Analyze the roof photos provided. Return a JSON object with fields: materialType (BUR/TPO/EPDM/Modified Bitumen/PVC/Metal/Shingle/Unknown), estimatedSqft (number, best guess from photo perspective), conditionRating (Poor/Fair/Good/Excellent), visibleIssues (array of short strings), recommendedUpgrades (array of {title, reason}), overallSummary (2-3 sentences).";

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
  };
}
