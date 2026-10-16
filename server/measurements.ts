/**
 * Structured measurement import (EagleView, Roofr, Hover, GAF QuickMeasure, drone, manual).
 * 1) Admin uploads the report PDF/image → AI reads the key numbers (draft only).
 * 2) Admin confirms or edits → saved with provenance (provider, report #, date, file)
 *    and verifiedSqft feeds pricing everywhere.
 */
import type { Express } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { z } from "zod";
import { sqliteConnection as sqlite } from "./db";
import { requireAdmin } from "./admin-auth";
import { storage } from "./storage";

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS measurement_reports (
    id TEXT PRIMARY KEY,
    proposal_id INTEGER NOT NULL REFERENCES proposals(id),
    provider TEXT NOT NULL,
    report_number TEXT,
    report_date TEXT,
    total_sqft INTEGER NOT NULL,
    predominant_pitch TEXT,
    sections_json TEXT NOT NULL DEFAULT '[]',
    drains INTEGER,
    penetrations INTEGER,
    perimeter_ft INTEGER,
    file_url TEXT,
    extracted_by TEXT NOT NULL DEFAULT 'manual',
    entered_by TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

const PROVIDERS = ["EagleView", "Roofr", "Hover", "GAF QuickMeasure", "Nearmap", "Drone survey", "Tape / field measurement", "Blueprint", "Other"] as const;
const sectionSchema = z.object({ name: z.string().max(80), sqft: z.number().nonnegative(), pitch: z.string().max(20).optional() });
const applySchema = z.object({
  provider: z.enum(PROVIDERS),
  reportNumber: z.string().max(60).optional().nullable(),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  totalSqft: z.number().int().positive().max(5_000_000),
  predominantPitch: z.string().max(20).optional().nullable(),
  sections: z.array(sectionSchema).max(60).default([]),
  drains: z.number().int().nonnegative().optional().nullable(),
  penetrations: z.number().int().nonnegative().optional().nullable(),
  perimeterFt: z.number().int().nonnegative().optional().nullable(),
  fileUrl: z.string().max(300).optional().nullable(),
  extractedBy: z.enum(["ai", "manual"]).default("manual"),
});

export function registerMeasurementRoutes(app: Express, uploadDir: string) {
  app.get("/api/admin/proposals/:id/measurements", requireAdmin as any, (req, res) => {
    res.json(sqlite.prepare("SELECT * FROM measurement_reports WHERE proposal_id = ? ORDER BY created_at DESC").all(Number(req.params.id)));
  });

  // Read a previously uploaded report file and draft the numbers (nothing is saved).
  app.post("/api/admin/measurements/extract", requireAdmin as any, async (req, res) => {
    const fileUrl = String(req.body?.fileUrl || "");
    if (!fileUrl.startsWith("/api/uploads/")) return res.status(400).json({ error: "Upload the report first." });
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "Auto-read needs the AI service. Enter the numbers manually." });
    const filePath = path.join(uploadDir, path.basename(fileUrl));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found." });
    const buf = fs.readFileSync(filePath);
    if (buf.length > 20 * 1024 * 1024) return res.status(413).json({ error: "Report is too large to auto-read (20 MB max)." });
    const isPdf = /\.pdf$/i.test(filePath);
    const mime = isPdf ? "application/pdf" : /\.webp$/i.test(filePath) ? "image/webp" : /\.png$/i.test(filePath) ? "image/png" : "image/jpeg";
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const out = await client.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Extract roof measurements from an aerial/roof measurement report. Return JSON only: {"provider": one of ${JSON.stringify(PROVIDERS)}, "reportNumber": string|null, "reportDate": "YYYY-MM-DD"|null, "totalSqft": integer (total roof area in square feet; convert "squares" ×100), "predominantPitch": string|null (e.g. "1/12" or "flat"), "sections": [{"name": string, "sqft": number, "pitch": string}], "drains": integer|null, "penetrations": integer|null, "perimeterFt": integer|null, "confidence": "high"|"medium"|"low", "notes": string}. Use null when a value is not printed in the report. Never guess.` },
          { role: "user", content: [isPdf ? ({ type: "file", file: { filename: path.basename(filePath), file_data: dataUrl } } as any) : { type: "image_url", image_url: { url: dataUrl } }, { type: "text", text: "Extract the measurements." }] },
        ],
      });
      const j = JSON.parse(out.choices[0].message.content || "{}");
      res.json({ draft: j });
    } catch (e: any) {
      res.status(502).json({ error: `Couldn't read the report: ${e.message}. Enter the numbers manually.` });
    }
  });

  // Confirm → save with provenance and update the proposal (feeds pricing).
  app.post("/api/admin/proposals/:id/measurements", requireAdmin as any, (req, res) => {
    const pid = Number(req.params.id);
    const p = storage.getProposal(pid);
    if (!p) return res.status(404).json({ error: "Not found" });
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Check the measurement fields." });
    const m = parsed.data;
    const id = crypto.randomUUID();
    sqlite.prepare(`INSERT INTO measurement_reports (id, proposal_id, provider, report_number, report_date, total_sqft, predominant_pitch, sections_json, drains, penetrations, perimeter_ft, file_url, extracted_by, entered_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id, pid, m.provider, m.reportNumber || null, m.reportDate || null, m.totalSqft, m.predominantPitch || null, JSON.stringify(m.sections), m.drains ?? null, m.penetrations ?? null, m.perimeterFt ?? null, m.fileUrl || null, m.extractedBy, req.adminActor || null);
    const source = ["EagleView", "Roofr", "Hover", "GAF QuickMeasure", "Nearmap", "Drone survey"].includes(m.provider) ? "aerial_report" : m.provider === "Blueprint" ? "blueprint" : "manual_measurement";
    const provenance = [`${m.provider}${m.reportNumber ? ` report #${m.reportNumber}` : ""}${m.reportDate ? ` dated ${m.reportDate}` : ""}: ${m.totalSqft.toLocaleString()} sq ft`, m.predominantPitch ? `pitch ${m.predominantPitch}` : "", m.drains != null ? `${m.drains} drains` : "", m.penetrations != null ? `${m.penetrations} penetrations` : "", m.perimeterFt != null ? `${m.perimeterFt} ft perimeter` : ""].filter(Boolean).join(" · ");
    const update: any = { verifiedSqft: m.totalSqft, sqftMeasurementSource: source, measurementNotes: `${provenance}${m.extractedBy === "ai" ? " (auto-read, confirmed by McCurdy)" : ""}` };
    if (m.sections.length) update.roofAreas = JSON.stringify(m.sections.map((s) => `${s.name} — ${Math.round(s.sqft).toLocaleString()} sq ft${s.pitch ? ` (${s.pitch})` : ""}`));
    storage.updateProposal(pid, update);
    res.status(201).json({ report: sqlite.prepare("SELECT * FROM measurement_reports WHERE id = ?").get(id), proposal: storage.getProposal(pid) });
  });
}
