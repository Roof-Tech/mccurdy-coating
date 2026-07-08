import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertProposalSchema, insertMaterialSchema, insertProposalImageSchema, insertIncentiveSchema, insertWarrantyDocumentSchema, insertDocumentSchema, insertActivityEventSchema, insertCustomerMessageSchema } from "@shared/schema";
import { sqliteConnection } from "./db";
import { getCountyFromDb, getAllCountiesFromDb } from "./incentive-refresh";
import { manualRefresh } from "./incentive-scheduler";
import { randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
// spawn import removed — AI generation is handled externally

// File upload configuration — use persistent disk if available (Render)
const dataDir = process.env.DATA_DIR || process.cwd();
const uploadDir = path.join(dataDir, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
console.log(`[uploads] Using upload directory: ${uploadDir}`);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
      cb(null, `${base}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

export function registerRoutes(server: Server, app: Express): void {
  // Auto-seed demo data on first boot
  try {
    const existing = storage.getProposalByNumber("MCC-2026-0001");
    if (!existing) {
      console.log("[startup] No demo data found, seeding...");
      // Will be seeded on first POST to /api/admin/seed-demo or inline below
      seedDemoData();
      console.log("[startup] Demo data seeded successfully");
    }
  } catch (e) {
    console.log("[startup] Could not auto-seed:", e);
  }

  // ── Public Customer Routes (by access token) ──────────────

  // Get proposal by access token (customer-facing)
  app.get("/api/proposal/:token", (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      
      // Track view event
      storage.createActivity({
        proposalId: proposal.id,
        eventType: "viewed",
        eventData: JSON.stringify({ page: "proposal" }),
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
        createdAt: new Date().toISOString(),
      });

      // Update status if draft
      if (proposal.status === "sent" || proposal.status === "draft") {
        storage.updateProposal(proposal.id, { status: "viewed" });
      }

      res.json(proposal);
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get materials for a proposal (by token)
  app.get("/api/proposal/:token/materials", (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });
      res.json(storage.getMaterialsByProposal(proposal.id));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get images for a proposal (by token)
  app.get("/api/proposal/:token/images", (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });
      res.json(storage.getImagesByProposal(proposal.id));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get incentives for a proposal (by token)
  app.get("/api/proposal/:token/incentives", (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });
      // Get proposal-specific + global incentives
      const proposalIncentives = storage.getIncentivesByProposal(proposal.id);
      const globalIncentives = storage.getAllIncentives().filter(i => !i.proposalId);
      res.json([...proposalIncentives, ...globalIncentives]);
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get warranty docs for a proposal (by token)
  app.get("/api/proposal/:token/warranty-docs", (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });
      res.json(storage.getWarrantyDocsByProposal(proposal.id));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get documents for a proposal (by token)
  app.get("/api/proposal/:token/documents", (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });
      const proposalDocs = storage.getDocumentsByProposal(proposal.id);
      const globalDocs = storage.getDocumentsByProposal(null);
      res.json([...proposalDocs, ...globalDocs]);
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Track activity event (customer-facing)
  app.post("/api/proposal/:token/track", (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });

      const event = storage.createActivity({
        proposalId: proposal.id,
        eventType: req.body.eventType || "viewed",
        eventData: JSON.stringify(req.body.eventData || {}),
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
        createdAt: new Date().toISOString(),
      });
      res.json(event);
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Submit customer message (question, revision, approval)
  app.post("/api/proposal/:token/message", (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });

      const msg = storage.createMessage({
        proposalId: proposal.id,
        messageType: req.body.messageType || "general",
        senderName: req.body.senderName || null,
        senderEmail: req.body.senderEmail || null,
        senderPhone: req.body.senderPhone || null,
        message: req.body.message || "",
        selectedOption: req.body.selectedOption || null,
        createdAt: new Date().toISOString(),
      });

      // Track the event
      storage.createActivity({
        proposalId: proposal.id,
        eventType: req.body.messageType === "approval" ? "approved" : req.body.messageType === "revision" ? "revision_requested" : "question",
        eventData: JSON.stringify({ messageId: msg.id }),
        ipAddress: req.ip || null,
        userAgent: req.headers["user-agent"] || null,
        createdAt: new Date().toISOString(),
      });

      // Update proposal status on approval
      if (req.body.messageType === "approval") {
        storage.updateProposal(proposal.id, {
          status: "approved",
          approvedOption: req.body.selectedOption || null,
          approvedAt: new Date().toISOString(),
          approvedBy: req.body.senderName || null,
        });
      } else if (req.body.messageType === "revision") {
        storage.updateProposal(proposal.id, { status: "revision_requested" });
      }

      res.json(msg);
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Admin Routes ──────────────────────────────────────────

  // List all proposals
  app.get("/api/admin/proposals", (_req, res) => {
    try {
      res.json(storage.getAllProposals());
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get single proposal by ID
  app.get("/api/admin/proposals/:id", (req, res) => {
    try {
      const proposal = storage.getProposal(parseInt(req.params.id));
      if (!proposal) return res.status(404).json({ error: "Not found" });
      res.json(proposal);
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Create proposal
  app.post("/api/admin/proposals", (req, res) => {
    try {
      const token = randomBytes(32).toString("hex");
      const proposalNumber = `MCC-${Date.now().toString(36).toUpperCase()}`;
      
      const proposal = storage.createProposal({
        ...req.body,
        proposalNumber: req.body.proposalNumber || proposalNumber,
        accessToken: token,
        status: req.body.status || "draft",
      });
      res.json(proposal);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Failed to create proposal" });
    }
  });

  // Update proposal
  app.patch("/api/admin/proposals/:id", (req, res) => {
    try {
      const proposal = storage.updateProposal(parseInt(req.params.id), req.body);
      if (!proposal) return res.status(404).json({ error: "Not found" });
      res.json(proposal);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Failed to update" });
    }
  });

  // Delete proposal
  app.delete("/api/admin/proposals/:id", (req, res) => {
    try {
      storage.deleteProposal(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Materials CRUD ──
  app.get("/api/admin/proposals/:id/materials", (req, res) => {
    try {
      res.json(storage.getMaterialsByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/admin/materials", (req, res) => {
    try {
      res.json(storage.createMaterial(req.body));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/admin/materials/:id", (req, res) => {
    try {
      const m = storage.updateMaterial(parseInt(req.params.id), req.body);
      if (!m) return res.status(404).json({ error: "Not found" });
      res.json(m);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/materials/:id", (req, res) => {
    try {
      storage.deleteMaterial(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Images CRUD ──
  app.get("/api/admin/proposals/:id/images", (req, res) => {
    try {
      res.json(storage.getImagesByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/admin/images", (req, res) => {
    try {
      res.json(storage.createImage(req.body));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/images/:id", (req, res) => {
    try {
      storage.deleteImage(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Incentives CRUD ──
  app.get("/api/admin/incentives", (_req, res) => {
    try {
      res.json(storage.getAllIncentives());
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/admin/incentives", (req, res) => {
    try {
      res.json(storage.createIncentive(req.body));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/incentives/:id", (req, res) => {
    try {
      storage.deleteIncentive(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Warranty Documents CRUD ──
  app.post("/api/admin/warranty-docs", (req, res) => {
    try {
      res.json(storage.createWarrantyDoc(req.body));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/warranty-docs/:id", (req, res) => {
    try {
      storage.deleteWarrantyDoc(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Documents CRUD ──
  app.get("/api/admin/proposals/:id/documents", (req, res) => {
    try {
      res.json(storage.getDocumentsByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/admin/proposals/:id/warranty-docs", (req, res) => {
    try {
      res.json(storage.getWarrantyDocsByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/admin/documents", (req, res) => {
    try {
      res.json(storage.createDocument(req.body));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/documents/:id", (req, res) => {
    try {
      storage.deleteDocument(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Activity Tracking ──
  app.get("/api/admin/activities", (_req, res) => {
    try {
      res.json(storage.getAllActivities());
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/admin/proposals/:id/activities", (req, res) => {
    try {
      res.json(storage.getActivitiesByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Customer Messages ──
  app.get("/api/admin/messages", (_req, res) => {
    try {
      res.json(storage.getAllMessages());
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/admin/proposals/:id/messages", (req, res) => {
    try {
      res.json(storage.getMessagesByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch("/api/admin/messages/:id/read", (req, res) => {
    try {
      storage.markMessageRead(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── File Upload ──
  app.post("/api/admin/upload", upload.single("file"), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const fileUrl = `/api/uploads/${req.file.filename}`;
      res.json({
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Upload failed" });
    }
  });

  // Serve uploaded files
  app.use("/api/uploads", (req, res, next) => {
    const filePath = path.join(uploadDir, path.basename(req.path));
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    res.status(404).json({ error: "File not found" });
  });

  // ── County Incentives ──
  app.get("/api/county-incentives/:county", (req, res) => {
    try {
      const county = req.params.county.toLowerCase().replace(/\s+/g, "-");
      // Prefer live DB (auto-refreshed yearly). Fall back to hard-coded seed if row missing.
      const dbData = getCountyFromDb(sqliteConnection, county);
      if (dbData) return res.json(dbData);
      const data = getCountyIncentives(county);
      if (!data) return res.status(404).json({ error: "County not found" });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/county-incentives", (_req, res) => {
    try {
      const dbData = getAllCountiesFromDb(sqliteConnection);
      if (dbData.length > 0) return res.json(dbData);
      res.json(getAllCountyIncentives());
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/admin/refresh-incentives", async (req, res) => {
    try {
      const taxYear = req.body?.taxYear ? parseInt(req.body.taxYear, 10) : undefined;
      const report = await manualRefresh(sqliteConnection, taxYear);
      res.json({ success: true, report });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/admin/refresh-log", (_req, res) => {
    try {
      const rows = sqliteConnection.prepare(
        "SELECT run_id, run_at, run_type, county_key, status, changes_json, error_message, tax_year FROM incentive_refresh_log ORDER BY run_at DESC LIMIT 100"
      ).all();
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── AI Roof Transformation ──
  // AI image generation requires specialized GPU services not available on this server.
  // Transformations are generated externally and uploaded via the standard image/upload endpoints.
  app.post("/api/admin/generate-transformation", (_req, res) => {
    res.status(200).json({
      info: true,
      message: "AI transformations are processed by McCurdy's AI service. Upload before photos and the AI previews will be generated and added automatically.",
    });
  });

  // Check transformation status (for polling)
  app.get("/api/admin/transformation-status/:proposalId", (req, res) => {
    try {
      const proposalId = parseInt(req.params.proposalId);
      const images = storage.getImagesByProposal(proposalId);
      const aiImages = images.filter((img: any) => img.imageType === "ai_white" || img.imageType === "ai_gray");
      res.json({ aiImages });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Seed demo data ──
  app.post("/api/admin/seed-demo", (_req, res) => {
    try {
      const existing = storage.getProposalByNumber("MCC-2026-0001");
      if (existing) return res.json({ message: "Demo data already exists", proposal: existing });
      const proposal = seedDemoData();
      res.json({ message: "Demo data seeded successfully", proposal });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to seed" });
    }
  });
}

function seedDemoData() {
      const proposal = storage.createProposal({
        proposalNumber: "MCC-2026-0001",
        customerName: "John Richardson",
        companyName: "Bay Area Industrial Park LLC",
        propertyAddress: "1250 Industrial Blvd, South San Francisco, CA 94080",
        city: "South San Francisco",
        county: "San Mateo",
        state: "CA",
        utilityTerritory: "PG&E",
        proposalDate: "2026-03-24",
        estimator: "Mike McCurdy",
        projectType: "commercial",
        status: "sent",
        accessToken: "demo-proposal-2026",
        welcomeMessage: "Thank you for allowing McCurdy Roofing to evaluate your commercial roofing needs. After a thorough job walk and inspection of your facility, we've prepared this comprehensive roof investment proposal for your review.",
        roofAreas: JSON.stringify(["Main warehouse roof — 18,500 sq ft", "Office wing — 3,200 sq ft", "Loading dock canopy — 1,800 sq ft"]),
        systemType: "Silicone Roof Restoration System",
        scopeSummary: "Full silicone roof restoration system over existing modified bitumen membrane. Includes power washing, seam repair, reinforcement of all penetrations and transitions, primer application, and two-coat silicone coating system with 30 dry mil minimum total build.",
        exclusions: "Interior repairs, structural modifications, gutter replacement (existing gutters in good condition), HVAC unit replacement or relocation.",
        timelineEstimate: "3-4 weeks from contract signing, weather permitting",
        addOns: JSON.stringify(["Additional drain installation (2 units)", "Parapet wall cap metal replacement", "Skylight re-seal package"]),
        whyRecommended: JSON.stringify([
          "Existing modified bitumen membrane is aged but structurally sound — restoration avoids costly tear-off",
          "Silicone coating provides superior ponding water resistance for your flat roof areas",
          "UV and heat reflectivity will reduce cooling costs during Bay Area summers",
          "20-year NDL warranty available without full roof replacement",
          "Minimal operational disruption — no tear-off noise, no debris, no interior exposure risk",
          "Lifecycle cost savings of 40-60% compared to full replacement"
        ]),
        currentCondition: "The existing modified bitumen roof system is approximately 15 years old. While past its expected maintenance cycle, the membrane is intact with no active leaks. Several areas show UV degradation, seam separation beginning at transitions, and moderate ponding in two low areas near the warehouse center. The substrate is solid and suitable for a restoration coating system.",
        keyIssues: JSON.stringify([
          "UV degradation and surface chalking across 60% of membrane",
          "Seam separation beginning at wall-to-roof transitions",
          "Ponding water in two low areas (1-2 inch depth after rain)",
          "Flashing deterioration around 12 rooftop HVAC penetrations",
          "Drain screens clogged — two drains functioning below capacity"
        ]),
        roofSystemType: "ASC Roof Renewal Qualifying Silicone System",
        coatingType: "ASC Qualifying Silicone Roof Coating",
        primer: "ASC Silicone Primer",
        baseCoat: "ASC Silicone Base Coat",
        topCoat: "ASC Silicone Top Coat",
        reinforcement: "Polyester reinforcing fabric at all seams, penetrations, and transitions",
        accessories: JSON.stringify(["Silicone sealant/mastic", "Polyester fabric rolls", "Drain retrofit kits", "Flashing membrane"]),
        penetrationsHandling: "All 12 HVAC penetrations will receive full fabric reinforcement with 3-course flashing detail. Pipe boots will be replaced where deteriorated.",
        drainageTaper: "Two additional drain retrofit kits included in higher-tier options to address ponding areas",
        manufacturerName: "ASC (American Silicone Coatings)",
        layerCount: 3,
        primerMils: "2-3 dry mils",
        baseCoatMils: "Varies by warranty tier",
        topCoatMils: "Varies by warranty tier",
        totalDryMils: "23-56 dry mils depending on warranty tier selected",
        milsExplanation: "Mil thickness directly determines roof performance and warranty eligibility. ASC Roof Renewal systems are engineered with specific dry mil targets for each warranty tier: 23 mils (5-yr), 30 mils (10-yr), 38 mils (15-yr), 45 mils (20-yr), 51 mils (25-yr), and 56 mils (30-yr). Higher mil builds provide longer protection and greater warranty coverage.",
        recommendedColor: "White (Cool White)",
        alternateColors: JSON.stringify(["Light Gray", "Tan", "Light Blue"]),
        colorNotes: "White provides maximum solar reflectivity (SRI 110+) and best energy savings. Meets Title 24 cool roof requirements. Gray and tan are also compliant but with slightly lower reflectivity values.",
        manufacturerWarranty: "ASC Manufacturer Warranty — tier based on dry mil build (5 to 30 years)",
        workmanshipWarranty: "McCurdy Roofing Workmanship Warranty",
        ndlWarranty: "NDL warranty covers 100% of material and labor costs for the full warranty term with no depreciation or dollar cap. This is the highest level of manufacturer backing available.",
        warrantyTerm: "5 to 30 years based on selected tier",
        warrantySummary: "Your roof will be covered by an ASC manufacturer warranty matched to the mil thickness of the system installed, plus a McCurdy Roofing workmanship warranty. Regular maintenance inspections (recommended annually) help preserve full warranty coverage.",
        warrantyMaintenance: "Annual inspection recommended. McCurdy offers a maintenance program that includes annual roof inspection, drain clearing, minor touch-up repairs, and warranty compliance documentation.",
        pricingOptions: JSON.stringify([
          {
            name: "5-Year ASC Warranty",
            price: "$5.50/sq ft",
            description: "ASC Roof Renewal system with 23 dry mils. Entry-level protection ideal for short-term hold or budget-conscious projects.",
            features: ["Full power wash and prep", "Primer coat", "23 dry mils silicone build", "All penetration reinforcement", "5-year ASC manufacturer warranty"],
            recommended: false
          },
          {
            name: "10-Year ASC Warranty",
            price: "$6.50/sq ft",
            description: "ASC Roof Renewal system with 30 dry mils. Solid mid-range protection with strong value per year of coverage.",
            features: ["Full power wash and prep", "Primer coat", "30 dry mils silicone build", "All penetration reinforcement", "10-year ASC manufacturer warranty"],
            recommended: false
          },
          {
            name: "15-Year ASC Warranty",
            price: "$7.50/sq ft",
            description: "ASC Roof Renewal system with 38 dry mils. Best balance of cost and long-term protection.",
            features: ["Full power wash and prep", "Primer coat", "38 dry mils silicone build", "All penetration reinforcement", "15-year ASC manufacturer warranty"],
            recommended: false
          },
          {
            name: "20-Year ASC Warranty",
            price: "$9.50/sq ft",
            description: "ASC Roof Renewal system with 45 dry mils. Premium protection for owners planning to hold property long-term.",
            features: ["Full power wash and prep", "Primer coat", "45 dry mils silicone build", "All penetration reinforcement", "Drainage improvements", "20-year ASC manufacturer warranty"],
            recommended: true
          },
          {
            name: "25-Year ASC Warranty",
            price: "$12.00/sq ft",
            description: "ASC Roof Renewal system with 51 dry mils. Extended protection with maximum durability for high-value properties.",
            features: ["Full power wash and prep", "Primer coat", "51 dry mils silicone build", "All penetration reinforcement", "Drainage improvements", "Parapet wall treatment", "25-year ASC manufacturer warranty"],
            recommended: false
          },
          {
            name: "30-Year ASC Warranty",
            price: "$14.00/sq ft",
            description: "ASC Roof Renewal system with 56 dry mils. The ultimate roof investment — maximum mil build and longest manufacturer warranty available.",
            features: ["Full power wash and prep", "Primer coat", "56 dry mils silicone build", "All penetration reinforcement", "Drainage improvements", "Parapet wall treatment", "Skylight re-seal", "30-year ASC manufacturer warranty", "Priority scheduling"],
            recommended: false
          }
        ]),
        paymentSchedule: "No deposit required. 50% due upon materials loaded on the roof and cleaning & sealing is completed. 50% upon completion of the job. Unless otherwise noted in the proposal revision and agreed upon.",
        financingNotes: "Financing available through approved lending partners. Ask about 12-month same-as-cash options for qualified commercial properties.",
      });

      // Seed materials
      const materialData = [
        { proposalId: proposal.id, manufacturer: "ASC (American Silicone Coatings)", productName: "ASC Silicone Primer", category: "primer", usedFor: "Surface preparation and adhesion promotion over existing modified bitumen membrane", technicalSummary: "Single-component moisture-cure primer. VOC compliant. Promotes adhesion of silicone coatings to modified bitumen, metal, and concrete substrates.", sortOrder: 1 },
        { proposalId: proposal.id, manufacturer: "ASC (American Silicone Coatings)", productName: "ASC Qualifying Silicone Base Coat", category: "base_coat", usedFor: "Primary waterproofing layer applied over primer. Provides base-level protection and fill.", technicalSummary: "High-solids silicone elastomeric coating. 90%+ solids content. Superior ponding water resistance. Dry mil build varies by warranty tier selected.", sortOrder: 2 },
        { proposalId: proposal.id, manufacturer: "ASC (American Silicone Coatings)", productName: "ASC Qualifying Silicone Top Coat", category: "top_coat", usedFor: "Final weathering surface. Provides UV protection, reflectivity, and aesthetic finish.", technicalSummary: "High-solids silicone top coat. Cool-roof rated. SRI 110+ in white. Dry mil build varies by warranty tier selected.", sortOrder: 3 },
        { proposalId: proposal.id, manufacturer: "ASC (American Silicone Coatings)", productName: "Silicone Sealant/Mastic", category: "sealant", usedFor: "Detail work at penetrations, transitions, and repair of existing defects", technicalSummary: "100% silicone sealant for gap filling and detail work. Compatible with all ASC system components.", sortOrder: 4 },
        { proposalId: proposal.id, manufacturer: "Various", productName: "Polyester Reinforcing Fabric", category: "reinforcing", usedFor: "Reinforcement at all seams, penetrations, wall transitions, and stress points", technicalSummary: "Non-woven polyester fabric embedded between coating layers at detail areas. Provides tensile strength and crack-bridging capability.", sortOrder: 5 },
        { proposalId: proposal.id, manufacturer: "Various", productName: "Drain Retrofit Kit", category: "accessory", usedFor: "Replacement/upgrade of existing roof drains to improve drainage in ponding areas", technicalSummary: "Complete drain assembly with new strainer, clamp ring, and membrane connection collar. Sized for existing drain openings.", sortOrder: 6 },
      ];
      for (const m of materialData) {
        storage.createMaterial(m as any);
      }

      // Seed incentives
      const incentiveData = [
        { proposalId: proposal.id, programName: "Section 179 Tax Deduction", programType: "tax_deduction", applicability: "Commercial building owners may be able to deduct the full cost of a roof restoration as a business expense in the year it is completed, rather than depreciating over 39 years.", officialLink: "https://www.irs.gov/forms-pubs/about-publication-946", notes: "Roof restoration (coating) may qualify as a repair expense under IRS guidelines. Consult your CPA to determine eligibility for your specific situation.", lastVerifiedDate: "2026-01-15", sortOrder: 1 },
        { proposalId: proposal.id, programName: "MACRS Depreciation", programType: "tax_deduction", applicability: "If Section 179 does not apply, commercial roof costs may be depreciated under Modified Accelerated Cost Recovery System schedules.", officialLink: "https://www.irs.gov/publications/p946", notes: "Restoration coating systems may qualify for shorter depreciation schedules than full replacement. Ask your tax advisor.", lastVerifiedDate: "2026-01-15", sortOrder: 2 },
        { proposalId: proposal.id, programName: "PG&E Cool Roof Rebate Program", programType: "rebate", applicability: "PG&E offers rebates for qualifying cool roof installations that meet energy efficiency standards in their service territory.", locationFilter: "PG&E service territory", utilityFilter: "PG&E", officialLink: "https://www.pge.com/en/save-energy-and-money/energy-saving-programs.html", notes: "ASC white silicone coating meets cool roof reflectivity requirements. Rebate amounts vary by program year.", lastVerifiedDate: "2026-02-01", sortOrder: 3 },
        { proposalId: proposal.id, programName: "Title 24 Cool Roof Compliance", programType: "compliance", applicability: "California Title 24 requires minimum solar reflectance and thermal emittance values for roof replacements and alterations on commercial buildings.", officialLink: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards", notes: "The proposed ASC white silicone system exceeds Title 24 cool roof requirements. McCurdy provides compliance documentation.", lastVerifiedDate: "2026-02-01", sortOrder: 4 },
        { proposalId: proposal.id, programName: "Commercial Property Financing", programType: "financing", applicability: "Financing options available through approved lending partners for qualified commercial properties.", notes: "Ask about 12-month same-as-cash options. Roof restoration financing may offer tax-advantaged interest deductions.", sortOrder: 5 },
      ];
      for (const i of incentiveData) {
        storage.createIncentive(i as any);
      }

      return proposal;
}

// ── County-Specific Incentive Data ──────────────────────────────
interface CountyIncentive {
  county: string;
  climateZone: string;
  utility: string;
  programs: {
    name: string;
    type: string;
    description: string;
    link: string;
    amount?: string;
    notes?: string;
  }[];
}

const COUNTY_INCENTIVES: Record<string, CountyIncentive> = {
  "alameda": {
    county: "Alameda County",
    climateZone: "Climate Zone 3 (Coast) / 12 (Inland — Livermore, Dublin, Pleasanton)",
    utility: "PG&E / East Bay Community Energy (EBCE)",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for qualifying energy-efficient improvements including cool roof installations in their service territory.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html", notes: "Cool roof coatings that meet CRRC standards may qualify. Check current program availability." },
      { name: "BayREN Home+ Program", type: "rebate", description: "Bay Area Regional Energy Network offers rebates and low-cost energy assessments for Bay Area homeowners including Alameda County residents.", link: "https://www.bayren.org/programs-rebates", amount: "Varies by measure" },
      { name: "BayREN EASE Home Program", type: "rebate", description: "Efficiency and Sustainable Energy program with customer co-pay capped at $1,000 for qualifying weatherization and energy efficiency upgrades.", link: "https://www.bayren.org/ease-home", amount: "Co-pay capped at $1,000" },
      { name: "Alameda Municipal Power Rebates", type: "utility", description: "AMP customers can apply for rebates for heat pump HVAC, smart thermostats, electric panel upgrades, and energy efficiency measures.", link: "https://www.alamedamp.com/398/Rebates-Programs", notes: "Available to City of Alameda residents served by AMP." },
      { name: "East Bay Community Energy Programs", type: "utility", description: "EBCE provides clean energy programs and incentives for Alameda County residents and businesses.", link: "https://ebce.org/", notes: "Check for current commercial building incentives." },
      { name: "PACE Financing (CaliforniaFIRST / Ygrene)", type: "financing", description: "Property Assessed Clean Energy financing for energy efficiency improvements including roofing. Repaid through property tax assessment.", link: "https://dfpi.ca.gov/consumers/housing/pace/", notes: "100% financing available. Attaches to property, not owner." },
      { name: "Title 24 Compliance (Zone 3/12)", type: "compliance", description: "Zone 3: No prescriptive cool roof requirement. Zone 12 (inland): Cool roof with SRI ≥16 is one compliance path for steep-slope, SRI ≥75 for low-slope.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and", notes: "Silicone coating systems exceed all Title 24 cool roof thresholds." },
      { name: "California Energy-Smart Homes", type: "rebate", description: "Incentives for whole-building electrification including heat pump systems and energy efficiency upgrades.", link: "https://www.smud.org/en/Going-Green/California-Energy-Smart-Homes", notes: "Statewide program. May be stackable with utility rebates." },
      { name: "Federal Energy Efficient Home Improvement Credit (25C)", type: "tax_deduction", description: "Federal tax credit up to 30% of qualifying energy-efficient home improvement costs, up to $1,200/year for roofing materials.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year", notes: "Applies to ENERGY STAR certified metal roofs and asphalt shingles with cooling granules." },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial property owners may deduct full cost of roof restoration as a business expense in the year completed.", link: "https://www.irs.gov/forms-pubs/about-publication-946", notes: "Roof coating/restoration may qualify as repair expense vs. capital improvement. Consult CPA." },
    ]
  },
  "san-mateo": {
    county: "San Mateo County",
    climateZone: "Climate Zone 3",
    utility: "PG&E / Peninsula Clean Energy (PCE)",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for qualifying energy-efficient improvements including cool roof installations.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "Peninsula Clean Energy (PCE) Rebates", type: "utility", description: "PCE customers can apply for rebates for heat pump water heaters, heat pump HVACs, electric panel upgrades. PCE also offers zero percent loans up to $10,000 for energy upgrades.", link: "https://www.peninsulacleanenergy.com/residents/", amount: "Up to $10,000 at 0% interest" },
      { name: "PCE Home Upgrade Services", type: "utility", description: "Income-qualified residents may receive no-cost upgrades to convert outdated gas appliances to safer, healthier, more energy-efficient options.", link: "https://www.peninsulacleanenergy.com/residents/", notes: "Income-qualified program." },
      { name: "BayREN Home+ Program", type: "rebate", description: "Bay Area Regional Energy Network offers rebates and low-cost energy assessments for Bay Area homeowners.", link: "https://www.bayren.org/programs-rebates" },
      { name: "BayREN EASE Home Program", type: "rebate", description: "Weatherization and energy efficiency upgrades with customer co-pay capped at $1,000.", link: "https://www.bayren.org/ease-home", amount: "Co-pay capped at $1,000" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for roofing and energy improvements. Repaid through property tax.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "GoGreen Financing", type: "financing", description: "PG&E customers can finance up to 100% of energy upgrade costs through approved lenders.", link: "https://gogreenfinancing.com/", notes: "Covers building envelope, energy efficiency, and clean energy improvements." },
      { name: "Title 24 Compliance (Zone 3)", type: "compliance", description: "Climate Zone 3 has no prescriptive cool roof requirement for steep-slope residential. Low-slope commercial: SRI ≥75 or aged SR ≥0.63 with TE ≥0.75.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and" },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying energy-efficient roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
    ]
  },
  "san-francisco": {
    county: "San Francisco County",
    climateZone: "Climate Zone 3",
    utility: "PG&E / CleanPowerSF",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for qualifying energy-efficient improvements.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "CleanPowerSF", type: "utility", description: "San Francisco's community choice energy program providing clean energy. Check for available incentive programs.", link: "https://www.cleanpowersf.org/", notes: "Provides 100% renewable electricity. Check for building upgrade incentives." },
      { name: "SF Environment Energy Programs", type: "rebate", description: "San Francisco Department of Environment offers programs for energy efficiency, green building, and climate action.", link: "https://sfenvironment.org/energy", notes: "Includes commercial and residential energy efficiency resources." },
      { name: "BayREN Home+ Program", type: "rebate", description: "Rebates and energy assessments for San Francisco homeowners through the Bay Area Regional Energy Network.", link: "https://www.bayren.org/programs-rebates" },
      { name: "BayREN EASE Home Program", type: "rebate", description: "Weatherization upgrades with co-pay capped at $1,000.", link: "https://www.bayren.org/ease-home", amount: "Co-pay capped at $1,000" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "Title 24 Compliance (Zone 3)", type: "compliance", description: "Climate Zone 3: No prescriptive cool roof requirement for steep-slope residential. Low-slope commercial buildings: SRI ≥75.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and" },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
    ]
  },
  "stanislaus": {
    county: "Stanislaus County",
    climateZone: "Climate Zone 12",
    utility: "PG&E / Turlock Irrigation District (TID) / Modesto Irrigation District (MID)",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E customers can access rebates for energy-efficient improvements.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "Turlock Irrigation District (TID) Rebates", type: "utility", description: "TID offers energy efficiency rebates for customers in the Turlock area including HVAC and insulation programs.", link: "https://www.tid.org/customer-service/save-energy-money/rebates/", notes: "Check for current cool roof or energy efficiency rebates." },
      { name: "Modesto Irrigation District (MID) Programs", type: "utility", description: "MID provides energy efficiency programs and rebates for commercial and residential customers.", link: "https://www.mid.org/rebates/", notes: "Available to MID service territory customers." },
      { name: "San Joaquin Valley Air Pollution Control District", type: "rebate", description: "SJVAPCD offers various incentive programs for air quality improvements in the San Joaquin Valley air basin.", link: "https://www.valleyair.org/grants/", notes: "Programs may include energy efficiency incentives that complement roofing upgrades." },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing available for energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "Title 24 Compliance (Zone 12)", type: "compliance", description: "Climate Zone 12 requires cool roof compliance: steep-slope SRI ≥16 or aged SR ≥0.20 with TE ≥0.75. Low-slope: SRI ≥75 or aged SR ≥0.63 with TE ≥0.75. Alternative: additional insulation or radiant barrier.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and", notes: "Silicone coating systems exceed Zone 12 requirements with SRI 110+." },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
      { name: "Energy Upgrade California", type: "rebate", description: "Statewide program offering incentives for home improvements including energy-efficient roofing.", link: "https://www.energyupgradeca.org/", amount: "Up to $5,000 for combined upgrades" },
    ]
  },
  "san-joaquin": {
    county: "San Joaquin County",
    climateZone: "Climate Zone 12",
    utility: "PG&E",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for energy-efficient improvements including cool roof installations.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "San Joaquin Valley Air Pollution Control District", type: "rebate", description: "SJVAPCD administers various incentive programs for San Joaquin Valley residents to improve air quality.", link: "https://www.valleyair.org/grants/", notes: "Includes programs for residential energy efficiency improvements." },
      { name: "Drive Clean in the San Joaquin", type: "rebate", description: "SJVAPCD vehicle rebate program for Valley residents — up to $3,000 for clean vehicles.", link: "https://www.valleyair.org/grants/drive-clean-in-the-san-joaquin/rebate/", notes: "Vehicle program — complementary savings for property owners investing in energy efficiency." },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for roofing and energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "GoGreen Financing", type: "financing", description: "PG&E customers can finance up to 100% of energy upgrade costs.", link: "https://gogreenfinancing.com/" },
      { name: "Title 24 Compliance (Zone 12)", type: "compliance", description: "Climate Zone 12 has prescriptive cool roof requirements. Steep-slope: SRI ≥16. Low-slope: SRI ≥75. Silicone coatings exceed all thresholds.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and", notes: "Zone 12 is a mandatory cool roof zone. McCurdy systems are fully compliant." },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
      { name: "Energy Upgrade California", type: "rebate", description: "Statewide incentives for home improvements including energy-efficient roofing.", link: "https://www.energyupgradeca.org/", amount: "Up to $5,000 for combined upgrades" },
    ]
  },
  "contra-costa": {
    county: "Contra Costa County",
    climateZone: "Climate Zone 3 (Coast — Richmond, Hercules) / 12 (Inland — Concord, Walnut Creek, Antioch)",
    utility: "PG&E / MCE (Marin Clean Energy)",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for energy-efficient improvements.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "MCE (Marin Clean Energy) Programs", type: "utility", description: "MCE customers can get bill credits for solar storage and excess solar energy. Income-qualified customers can receive free home energy assessments and upgrades.", link: "https://www.mcecleanenergy.org/", notes: "Available to MCE service territory customers in Contra Costa County." },
      { name: "BayREN Home+ Program", type: "rebate", description: "Bay Area Regional Energy Network rebates and energy assessments for Contra Costa County homeowners.", link: "https://www.bayren.org/programs-rebates" },
      { name: "BayREN EASE Home Program", type: "rebate", description: "Weatherization and efficiency upgrades with co-pay capped at $1,000.", link: "https://www.bayren.org/ease-home", amount: "Co-pay capped at $1,000" },
      { name: "Contra Costa Water District Rebates", type: "rebate", description: "CCWD offers rebates for water-saving measures including smart irrigation and landscape conversion.", link: "https://www.ccwater.com/358/Rebates", notes: "Complementary water savings when upgrading building systems." },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for energy improvements.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "GoGreen Financing", type: "financing", description: "Finance up to 100% of energy upgrade costs through approved PG&E partner lenders.", link: "https://gogreenfinancing.com/" },
      { name: "Title 24 Compliance (Zone 3/12)", type: "compliance", description: "Coastal Zone 3: No prescriptive cool roof requirement for steep-slope. Inland Zone 12: SRI ≥16 steep-slope, SRI ≥75 low-slope. McCurdy silicone systems exceed all requirements.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and" },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
    ]
  },
  "solano": {
    county: "Solano County",
    climateZone: "Climate Zone 12",
    utility: "PG&E / MCE (Marin Clean Energy)",
    programs: [
      { name: "PG&E Rebates & Incentives", type: "rebate", description: "PG&E offers rebates for energy-efficient improvements.", link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html" },
      { name: "MCE (Marin Clean Energy) Programs", type: "utility", description: "MCE customers in Solano County can get bill credits for solar storage and free home energy assessments for income-qualified customers.", link: "https://www.mcecleanenergy.org/", notes: "MCE serves portions of Solano County." },
      { name: "Solano County Energy Resources", type: "rebate", description: "Solano County provides information on rebates and financial support programs for energy efficiency, generation, and storage.", link: "https://www.solanocounty.gov/government/resource-management/planning-services/environmental-management-sustainability/energy-resources", notes: "County resource hub with links to available programs." },
      { name: "BayREN Programs", type: "rebate", description: "Bay Area Regional Energy Network programs available for Solano County residents.", link: "https://www.bayren.org/programs-rebates" },
      { name: "PACE Financing", type: "financing", description: "Property Assessed Clean Energy financing for energy improvements including roofing.", link: "https://dfpi.ca.gov/consumers/housing/pace/" },
      { name: "GoGreen Financing", type: "financing", description: "PG&E customers can finance up to 100% of energy upgrade costs.", link: "https://gogreenfinancing.com/" },
      { name: "Title 24 Compliance (Zone 12)", type: "compliance", description: "Climate Zone 12 requires cool roof compliance. Steep-slope: SRI ≥16. Low-slope: SRI ≥75. Silicone coating systems meet and exceed these requirements.", link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and", notes: "Zone 12 is a mandatory cool roof zone." },
      { name: "Federal 25C Tax Credit", type: "tax_deduction", description: "Up to 30% of qualifying roofing material costs, max $1,200/year.", link: "https://www.energystar.gov/about/federal-tax-credits", amount: "Up to $1,200/year" },
      { name: "Section 179 Deduction (Commercial)", type: "tax_deduction", description: "Commercial owners may deduct full roof restoration cost as business expense.", link: "https://www.irs.gov/forms-pubs/about-publication-946" },
      { name: "Energy Upgrade California", type: "rebate", description: "Statewide incentives for energy-efficient home improvements.", link: "https://www.energyupgradeca.org/", amount: "Up to $5,000 for combined upgrades" },
    ]
  },
};

function getCountyIncentives(county: string): CountyIncentive | null {
  return COUNTY_INCENTIVES[county] || null;
}

function getAllCountyIncentives(): CountyIncentive[] {
  return Object.values(COUNTY_INCENTIVES);
}
