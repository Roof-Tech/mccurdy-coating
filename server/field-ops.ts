/**
 * Field operations: photo optimization, voice-note transcription, structured
 * jobsite checklists, internal field notes, and shareable AI progress reports.
 */
import type { Express } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import sharp from "sharp";
import OpenAI from "openai";
import { sqliteConnection as sqlite } from "./db";
import { requireAdmin } from "./admin-auth";
import { storage } from "./storage";
import { sendBrandedEmail } from "./proposal-email";

const APP_BASE_URL = process.env.APP_BASE_URL || "https://mccurdy-coatings.onrender.com";
const now = () => Math.floor(Date.now() / 1000);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS jobsite_checklist_items (
    id TEXT PRIMARY KEY,
    proposal_id INTEGER NOT NULL REFERENCES proposals(id),
    phase TEXT NOT NULL,
    item TEXT NOT NULL,
    reading_label TEXT,
    reading TEXT,
    note TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    completed_by TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS field_notes (
    id TEXT PRIMARY KEY,
    proposal_id INTEGER NOT NULL REFERENCES proposals(id),
    body TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'typed',
    author TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS progress_reports (
    id TEXT PRIMARY KEY,
    proposal_id INTEGER NOT NULL REFERENCES proposals(id),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    highlights TEXT NOT NULL DEFAULT '[]',
    photo_urls TEXT NOT NULL DEFAULT '[]',
    shared INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// ── Structured jobsite checklist template (silicone restoration) ──
const TEMPLATE: { phase: string; items: [string, string?][] }[] = [
  { phase: "Site prep", items: [["Safety setup: perimeter, fall protection, signage"], ["Core cuts / moisture survey complete", "Wet areas found (sq ft)"], ["Wet insulation removed and replaced"], ["Power wash complete — surface clean and dry"], ["Seams, flashings, and penetrations repaired"], ["Drains and scuppers clear"]] },
  { phase: "Coating application", items: [["Adhesion test passed", "Pull test result"], ["Primer applied (if specified)"], ["Detail work: seams and penetrations reinforced"], ["Base coat applied", "Wet mils measured"], ["Top coat applied", "Wet mils measured"], ["Weather and dew point within spec", "Temp / humidity"]] },
  { phase: "Cure verification", items: [["Cure time met before foot traffic", "Hours cured"], ["Dry-mil spot checks meet warranty build", "Average dry mils"], ["No blisters, pinholes, or thin spots"]] },
  { phase: "Final inspection", items: [["Final walk-through with foreman"], ["After photos taken (all roof sections)"], ["Site cleaned, debris removed"], ["Customer walk-through / sign-off"], ["Warranty paperwork submitted"]] },
];
function ensureChecklist(proposalId: number) {
  const n = (sqlite.prepare("SELECT COUNT(*) AS n FROM jobsite_checklist_items WHERE proposal_id = ?").get(proposalId) as { n: number }).n;
  if (n > 0) return;
  const ins = sqlite.prepare("INSERT INTO jobsite_checklist_items (id, proposal_id, phase, item, reading_label, sort_order) VALUES (?,?,?,?,?,?)");
  let order = 0;
  for (const g of TEMPLATE) for (const [item, label] of g.items) ins.run(crypto.randomUUID(), proposalId, g.phase, item, label ?? null, order++);
}

// ── Photo optimization (item: resize + responsive WebP/AVIF) ──
export const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif|gif)$/i;
export const VARIANT_WIDTHS = [480, 960, 1600];
/** Rewrites an uploaded image as an optimized WebP (max 2400px, EXIF rotated, metadata stripped) plus 480/960/1600 WebP and 960 AVIF variants. Returns the new public URL. */
export async function optimizeUpload(filePath: string, publicPrefix: string): Promise<{ url: string; width?: number; height?: number; bytes: number } | null> {
  if (!IMAGE_EXT.test(filePath) || /\.gif$/i.test(filePath)) return null;
  const dir = path.dirname(filePath);
  const base = path.basename(filePath).replace(/\.[^.]+$/, "");
  const mainName = `${base}.opt.webp`;
  const input = sharp(filePath, { failOn: "none" }).rotate();
  const meta = await input.metadata();
  const main = await input.clone().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(dir, mainName));
  await Promise.all([
    ...VARIANT_WIDTHS.map((w) => input.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(dir, `${base}.opt-${w}.webp`))),
    input.clone().resize({ width: 960, withoutEnlargement: true }).avif({ quality: 55 }).toFile(path.join(dir, `${base}.opt-960.avif`)),
  ]);
  fs.unlink(filePath, () => undefined); // drop the multi-megabyte original
  return { url: `${publicPrefix}/${mainName}`, width: main.width ?? meta.width, height: main.height ?? meta.height, bytes: main.size };
}

const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function aiClient() { return process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null; }

export function registerFieldOpsRoutes(app: Express) {
  // Voice note → text (Whisper). Phones record with MediaRecorder; Web Speech API is used live when available.
  app.post("/api/admin/transcribe", requireAdmin as any, audioUpload.single("audio"), async (req, res) => {
    const client = aiClient();
    if (!client) return res.status(503).json({ error: "Voice transcription needs the AI service. Type the note instead." });
    if (!req.file || req.file.size < 1000) return res.status(400).json({ error: "No audio received. Hold the mic button while speaking." });
    try {
      const ext = /mp4|m4a|aac/.test(req.file.mimetype) ? "m4a" : /ogg/.test(req.file.mimetype) ? "ogg" : /wav/.test(req.file.mimetype) ? "wav" : "webm";
      const file = await OpenAI.toFile(req.file.buffer, `note.${ext}`, { type: req.file.mimetype || "audio/webm" });
      const out = await client.audio.transcriptions.create({ file, model: "whisper-1", prompt: "Commercial roofing jobsite note: silicone coating, mils, primer, base coat, top coat, seams, penetrations, ponding, TPO, modified bitumen." });
      res.json({ text: out.text.trim() });
    } catch (e: any) {
      res.status(502).json({ error: `Transcription failed: ${e.message}` });
    }
  });

  // Jobsite checklist
  app.get("/api/admin/proposals/:id/jobsite-checklist", requireAdmin as any, (req, res) => {
    const pid = Number(req.params.id);
    if (!storage.getProposal(pid)) return res.status(404).json({ error: "Not found" });
    ensureChecklist(pid);
    res.json(sqlite.prepare("SELECT * FROM jobsite_checklist_items WHERE proposal_id = ? ORDER BY sort_order").all(pid));
  });
  app.patch("/api/admin/jobsite-checklist/:id", requireAdmin as any, (req, res) => {
    const row = sqlite.prepare("SELECT * FROM jobsite_checklist_items WHERE id = ?").get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: "Not found" });
    const { completed, reading, note } = req.body || {};
    const done = completed === undefined ? row.completed : completed ? 1 : 0;
    sqlite.prepare("UPDATE jobsite_checklist_items SET completed = ?, completed_at = ?, completed_by = ?, reading = ?, note = ? WHERE id = ?").run(
      done, done ? row.completed_at || now() : null, done ? row.completed_by || req.adminActor || null : null,
      reading === undefined ? row.reading : String(reading).slice(0, 120) || null,
      note === undefined ? row.note : String(note).slice(0, 2000) || null, row.id);
    res.json(sqlite.prepare("SELECT * FROM jobsite_checklist_items WHERE id = ?").get(row.id));
  });

  // Internal field notes (never shown to customers)
  app.get("/api/admin/proposals/:id/field-notes", requireAdmin as any, (req, res) => {
    res.json(sqlite.prepare("SELECT * FROM field_notes WHERE proposal_id = ? ORDER BY created_at DESC").all(Number(req.params.id)));
  });
  app.post("/api/admin/proposals/:id/field-notes", requireAdmin as any, (req, res) => {
    const pid = Number(req.params.id);
    const body = String(req.body?.body || "").trim();
    if (!storage.getProposal(pid)) return res.status(404).json({ error: "Not found" });
    if (!body) return res.status(400).json({ error: "Note is empty." });
    const id = crypto.randomUUID();
    sqlite.prepare("INSERT INTO field_notes (id, proposal_id, body, source, author) VALUES (?,?,?,?,?)").run(id, pid, body.slice(0, 5000), req.body?.source === "voice" ? "voice" : "typed", req.adminActor || null);
    res.status(201).json(sqlite.prepare("SELECT * FROM field_notes WHERE id = ?").get(id));
  });

  // AI progress report (draft → admin reviews → share with customer)
  app.post("/api/admin/proposals/:id/progress-reports", requireAdmin as any, async (req, res) => {
    const pid = Number(req.params.id);
    const p = storage.getProposal(pid);
    if (!p) return res.status(404).json({ error: "Not found" });
    ensureChecklist(pid);
    const checklist = sqlite.prepare("SELECT phase, item, reading_label, reading, completed FROM jobsite_checklist_items WHERE proposal_id = ? ORDER BY sort_order").all(pid) as any[];
    const timeline = sqlite.prepare("SELECT phase, caption, photo_url, photo_date FROM project_timeline WHERE proposal_id = ? ORDER BY photo_date DESC LIMIT 12").all(pid) as any[];
    const notes = sqlite.prepare("SELECT body FROM field_notes WHERE proposal_id = ? ORDER BY created_at DESC LIMIT 10").all(pid) as any[];
    const done = checklist.filter((c) => c.completed);
    const phases = Array.from(new Set(checklist.map((c) => c.phase)));
    const phaseStatus = phases.map((ph) => { const all = checklist.filter((c) => c.phase === ph); const d = all.filter((c) => c.completed).length; return `${ph}: ${d}/${all.length}`; });
    let title = `Project update — ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
    let summary = `Progress at ${p.propertyAddress}: ${done.length} of ${checklist.length} jobsite steps complete (${phaseStatus.join(", ")}).`;
    let highlights: string[] = done.slice(-5).map((c) => `${c.item}${c.reading ? ` — ${c.reading_label}: ${c.reading}` : ""}`);
    const client = aiClient();
    if (client) {
      try {
        const out = await client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You write short, friendly, factual progress updates from a commercial roofing contractor (McCurdy Coatings) to the property owner. Use only the facts given. Do not invent dates, measurements, or problems. Do not mention internal notes about pricing, staff, or disputes. Return JSON: {\"title\": string, \"summary\": string (2-4 sentences), \"highlights\": string[] (3-6 items)}." },
            { role: "user", content: JSON.stringify({ property: p.propertyAddress, phaseStatus, completedSteps: done.map((c) => ({ phase: c.phase, step: c.item, reading: c.reading ? `${c.reading_label}: ${c.reading}` : undefined })), photoCaptions: timeline.map((t) => `${t.phase}: ${t.caption || ""}`), fieldNotes: notes.map((n) => n.body) }) },
          ],
        });
        const j = JSON.parse(out.choices[0].message.content || "{}");
        if (j.summary) { title = String(j.title || title).slice(0, 120); summary = String(j.summary).slice(0, 1500); highlights = Array.isArray(j.highlights) ? j.highlights.map(String).slice(0, 6) : highlights; }
      } catch { /* fall back to the factual summary above */ }
    }
    const id = crypto.randomUUID();
    sqlite.prepare("INSERT INTO progress_reports (id, proposal_id, title, summary, highlights, photo_urls, created_by) VALUES (?,?,?,?,?,?,?)")
      .run(id, pid, title, summary, JSON.stringify(highlights), JSON.stringify(timeline.slice(0, 6).map((t) => t.photo_url)), req.adminActor || null);
    res.status(201).json(sqlite.prepare("SELECT * FROM progress_reports WHERE id = ?").get(id));
  });
  app.get("/api/admin/proposals/:id/progress-reports", requireAdmin as any, (req, res) => {
    res.json(sqlite.prepare("SELECT * FROM progress_reports WHERE proposal_id = ? ORDER BY created_at DESC").all(Number(req.params.id)));
  });
  app.patch("/api/admin/progress-reports/:id", requireAdmin as any, async (req, res) => {
    const r = sqlite.prepare("SELECT * FROM progress_reports WHERE id = ?").get(req.params.id) as any;
    if (!r) return res.status(404).json({ error: "Not found" });
    const { title, summary, highlights, shared, notify } = req.body || {};
    sqlite.prepare("UPDATE progress_reports SET title = ?, summary = ?, highlights = ?, shared = ? WHERE id = ?").run(
      title ? String(title).slice(0, 120) : r.title, summary ? String(summary).slice(0, 1500) : r.summary,
      Array.isArray(highlights) ? JSON.stringify(highlights.map(String).slice(0, 8)) : r.highlights, shared === undefined ? r.shared : shared ? 1 : 0, r.id);
    let email: { ok: boolean; error?: string } | undefined;
    const p = storage.getProposal(r.proposal_id);
    if (shared && notify && p?.customerEmail) email = await sendBrandedEmail({ to: p.customerEmail, customerName: p.customerName, subject: `Project update: ${title || r.title}`, title: title || r.title, body: `<p>${String(summary || r.summary).replace(/[<>]/g, "")}</p>`, actionLabel: "See photos & full update", actionUrl: `${APP_BASE_URL}/#/view/${p.accessToken}/timeline` });
    res.json({ report: sqlite.prepare("SELECT * FROM progress_reports WHERE id = ?").get(r.id), email });
  });
  // Customer view: only reports an admin chose to share
  app.get("/api/proposals/:token/progress-reports", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    const rows = sqlite.prepare("SELECT id, title, summary, highlights, photo_urls, created_at FROM progress_reports WHERE proposal_id = ? AND shared = 1 ORDER BY created_at DESC").all(p.id) as any[];
    res.json(rows.map((r) => ({ ...r, highlights: JSON.parse(r.highlights || "[]"), photoUrls: JSON.parse(r.photo_urls || "[]") })));
  });
}
