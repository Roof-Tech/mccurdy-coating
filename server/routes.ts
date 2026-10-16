import type { Express, NextFunction, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import {
  insertProposalSchema,
  insertMaterialSchema,
  insertProposalImageSchema,
  insertIncentiveSchema,
  insertWarrantyDocumentSchema,
  insertDocumentSchema,
  insertActivityEventSchema,
  insertCustomerMessageSchema,
  insertChangeOrderSchema,
  emailSchedule,
  upgradeAddons,
  crewMembers,
  projectTimeline,
  referrals,
  reviews,
  messages,
  financingApplications,
  invoices,
  customerPreferences,
  crewChecklists,
  crewSchedule,
  incentives,
  proposals,
  estimateLeads,
} from "@shared/schema";
import { sqliteConnection, db } from "./db";
import { getCountyFromDb, getAllCountiesFromDb } from "./incentive-refresh";
import { manualRefresh } from "./incentive-scheduler";
import {
  sendProposalEmail,
  sendSignedNotificationToOwner,
  sendChangeOrderEmail,
  sendChangeOrderAcceptedNotificationToOwner,
  sendPrepareForVisitEmail,
  sendOwnerNotification,
  sendWarrantyConfirmation,
  sendCustomerMessageToOwner,
  sendAdminMessageToCustomer,
  sendFinancingApplicationToOwner,
  sendBrandedEmail,
  escapeHtml,
  sendInstantEstimateEmails,
} from "./proposal-email";
import { analyzeRoofForPublic, analyzeRoofPhotos } from "./ai-roof-analysis";
import { getUpgradeSuggestions } from "./upgrade-engine";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { rateLimit } from "express-rate-limit";
import { requireAdmin, registerAuthRoutes } from "./admin-auth";
import { registerPaymentRoutes } from "./payments";
import { applyIncentiveRules } from "./incentive-rules";
import { registerFieldOpsRoutes, optimizeUpload } from "./field-ops";
import { registerMeasurementRoutes } from "./measurements";
import { registerCustomerPortalRoutes, afterProposalSigned, isVerifiedFor } from "./customer-portal";
import { registerRetentionRoutes, isStormOptedIn, setStormOptIn, sendStormFollowups } from "./retention";
import {
  toAdminProposal,
  toPublicActivity,
  toPublicAddon,
  toPublicChangeOrder,
  toPublicProposal,
  toPublicReferral,
  toPublicTimelineItem,
} from "./dto";
// spawn import removed — AI generation is handled externally

// Admin auth (accounts, MFA, sessions, roles) lives in ./admin-auth

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
      const base = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "_");
      cb(null, `${base}_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB raw (phone photos); docs capped at 20MB in the route; images are re-encoded to ~0.3-1MB WebP
  fileFilter: (_req, file, cb) => {
    const allowed = [
      ".pdf",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".csv",
      ".txt",
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// Public instant-estimate uploads are isolated from authenticated proposal files.
const estimateDataDir = process.env.DATA_DIR || "/var/data";
const estimateUploadDir = path.join(estimateDataDir, "estimate-uploads");
try {
  fs.mkdirSync(estimateUploadDir, { recursive: true });
} catch (error) {
  // Local development environments may not provide /var/data.
  console.warn("[estimate-uploads] Falling back to project storage:", error);
  fs.mkdirSync(path.join(process.cwd(), "estimate-uploads"), { recursive: true });
}
const activeEstimateUploadDir = fs.existsSync(estimateUploadDir)
  ? estimateUploadDir
  : path.join(process.cwd(), "estimate-uploads");

const estimateUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, callback) => {
      const leadId = (req as Request & { estimateLeadId?: string }).estimateLeadId;
      const destination = path.join(activeEstimateUploadDir, leadId || "unassigned");
      fs.mkdirSync(destination, { recursive: true });
      callback(null, destination);
    },
    filename: (_req, file, callback) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      callback(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    callback(null, /^image\/(jpeg|png|webp|gif|heic|heif)$/i.test(file.mimetype));
  },
});

const instantEstimateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Please try again in an hour." },
});

const publicEstimateInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(250).optional(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(30).default("CA"),
  propertyType: z.enum(["commercial", "industrial", "multifamily", "residential"]).default("commercial"),
  buildingType: z.enum(["warehouse", "retail", "office", "apartment", "other"]).optional(),
  sqft: z.coerce.number().int().min(100).max(10000000).optional(),
  satelliteUrl: z.union([z.string().trim().url().max(2048), z.literal("")]).optional(),
});

const ESTIMATE_TIER_PRICES: Record<number, number> = {
  5: 4.5, 10: 5.5, 15: 6.5, 20: 8.5, 25: 9.5, 30: 10.5,
};

function parseEstimateList(value: string | null): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toPublicEstimate(lead: typeof estimateLeads.$inferSelect) {
  return {
    id: lead.id,
    condition: lead.aiCondition || "Fair",
    materialType: lead.aiMaterialType || "Other",
    estimatedSqft: lead.estimatedSqft || 5000,
    recommendedTier: lead.recommendedTier || 20,
    priceLow: lead.priceLow || 0,
    priceHigh: lead.priceHigh || 0,
    priceRecommended: lead.priceRecommended || 0,
    issues: parseEstimateList(lead.aiIssues),
    upgrades: parseEstimateList(lead.aiUpgrades),
    confidence: lead.aiConfidence || "medium",
    notes: (() => {
      try {
        return JSON.parse(lead.aiRawResponse || "{}").notes || "";
      } catch {
        return "";
      }
    })(),
    photoUrls: parseEstimateList(lead.photoUrls),
  };
}

function createProposalFromEstimateLead(lead: typeof estimateLeads.$inferSelect) {
  if (lead.convertedProposalId) {
    const existing = storage.getProposal(Number(lead.convertedProposalId));
    if (existing) return existing;
  }
  const warrantyTier = lead.recommendedTier || 20;
  const sqft = lead.verifiedSqft || lead.estimatedSqft || 5000;
  const proposal = storage.createProposal({
    proposalNumber: `MCC-${Date.now().toString(36).toUpperCase()}`,
    customerName: lead.name,
    customerEmail: lead.email,
    customerPhone: lead.phone,
    propertyAddress: lead.address || `${lead.city || "Bay Area"}, ${lead.state || "CA"}`,
    city: lead.city,
    state: lead.state || "CA",
    propertyType: lead.propertyType || "commercial",
    projectType: lead.propertyType || "commercial",
    proposalDate: new Date().toISOString().slice(0, 10),
    estimator: "Mike McCurdy",
    status: "draft",
    accessToken: randomBytes(32).toString("hex"),
    verifiedSqft: sqft,
    sqftMeasurementSource: lead.verifiedSqft ? "manual_measurement" : "ai_estimate",
    roofAreas: JSON.stringify([`Estimated roof area — ${sqft.toLocaleString()} sq ft`]),
    warrantyTerm: `${warrantyTier}-Year Silicone System`,
    systemType: "Silicone Roof Restoration System",
    currentCondition: lead.aiCondition || "Fair",
    roofSystemType: lead.aiMaterialType || "Existing roof system",
    keyIssues: lead.aiIssues || "[]",
    whyRecommended: lead.aiUpgrades || "[]",
    aiRoofAnalysis: lead.aiRawResponse,
    privateNotes: `Converted from Instant Estimate lead ${lead.id}.`,
    pricingOptions: JSON.stringify(
      Object.entries(ESTIMATE_TIER_PRICES).map(([years, price]) => ({
        name: `${years}-Year Silicone System`,
        price: `$${price.toFixed(2)}/sq ft`,
        total: Math.round(sqft * price),
        recommended: Number(years) === warrantyTier,
      })),
    ),
  });
  db.update(estimateLeads)
    .set({
      status: "converted",
      convertedProposalId: String(proposal.id),
      contactedAt: lead.contactedAt || new Date(),
    })
    .where(eq(estimateLeads.id, lead.id))
    .run();
  return proposal;
}

export function registerRoutes(server: Server, app: Express): void {
  registerAuthRoutes(app);
  registerPaymentRoutes(app);
  registerFieldOpsRoutes(app);
  registerRetentionRoutes(app);
  registerCustomerPortalRoutes(app);
  registerMeasurementRoutes(app, uploadDir);
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

  // ── Public Instant Roof Estimate ────────────────────────────
  app.use("/api/estimate-uploads", (req, res, next) => {
    const requested = path
      .normalize(req.path)
      .replace(/^(\.\.(\/|\\|$))+/, "")
      .replace(/^[/\\]+/, "");
    const filePath = path.join(activeEstimateUploadDir, requested);
    if (!filePath.startsWith(activeEstimateUploadDir)) return res.status(400).end();
    if (!fs.existsSync(filePath)) return res.status(404).end();
    return res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) next(error);
    });
  });

  app.post(
    "/api/estimate",
    instantEstimateLimiter,
    (req, _res, next) => {
      (req as Request & { estimateLeadId?: string }).estimateLeadId = randomUUID();
      next();
    },
    estimateUpload.fields([
      { name: "photos", maxCount: 4 },
      { name: "satelliteImage", maxCount: 1 },
    ]),
    async (req, res) => {
      const leadId = (req as Request & { estimateLeadId?: string }).estimateLeadId || randomUUID();
      try {
        const input = publicEstimateInput.parse(req.body);
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        const roofPhotos = files?.photos || [];
        const satellitePhotos = files?.satelliteImage || [];
        if (roofPhotos.length < 1) {
          return res.status(400).json({ error: "Please upload at least one roof photo." });
        }
        if (roofPhotos.length > 4) {
          return res.status(400).json({ error: "A maximum of four roof photos is allowed." });
        }

        const origin = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
        const localUrls = [...roofPhotos, ...satellitePhotos].map(
          (file) => `/api/estimate-uploads/${leadId}/${file.filename}`,
        );
        const aiUrls = localUrls.map((url) => `${origin}${url}`);
        if (input.satelliteUrl) aiUrls.push(input.satelliteUrl);

        const analysis = await analyzeRoofForPublic(aiUrls);
        const verifiedSqft = input.sqft ? Math.round(input.sqft) : null;
        const estimatedSqft = verifiedSqft || analysis.sqftEstimate || 5000;
        const recommendedTier =
          analysis.condition === "Good"
            ? 20
            : analysis.condition === "Fair"
              ? 15
              : 10;
        const priceLow = Math.round(estimatedSqft * ESTIMATE_TIER_PRICES[5]);
        const priceHigh = Math.round(estimatedSqft * ESTIMATE_TIER_PRICES[30]);
        const priceRecommended = Math.round(
          estimatedSqft * ESTIMATE_TIER_PRICES[recommendedTier],
        );
        const aiRawResponse = JSON.stringify({
          ...analysis,
          notes:
            analysis.condition === "Critical"
              ? `${analysis.notes} A recoat may be needed sooner; an in-person inspection is recommended.`.trim()
              : analysis.notes,
        });
        const lead = db
          .insert(estimateLeads)
          .values({
            id: leadId,
            name: input.name,
            email: input.email,
            phone: input.phone || null,
            address: input.address || null,
            city: input.city,
            state: input.state,
            propertyType: input.propertyType,
            buildingType: input.buildingType || null,
            estimatedSqft,
            verifiedSqft,
            aiCondition: analysis.condition,
            aiMaterialType: analysis.materialType,
            aiIssues: JSON.stringify(analysis.issues),
            aiUpgrades: JSON.stringify(analysis.upgrades),
            aiConfidence: analysis.confidence,
            aiRawResponse,
            photoUrls: JSON.stringify(localUrls),
            recommendedTier,
            priceLow,
            priceHigh,
            priceRecommended,
            status: "new",
            ipAddress: req.ip || null,
            userAgent: req.headers["user-agent"] || null,
          })
          .returning()
          .get();

        // Deliver notifications after persistence; email errors do not affect the lead.
        void sendInstantEstimateEmails({
          lead: {
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            address: lead.address,
            city: lead.city,
            state: lead.state,
            propertyType: lead.propertyType,
            estimatedSqft,
            condition: analysis.condition,
            materialType: analysis.materialType,
            recommendedTier,
            priceLow,
            priceHigh,
            priceRecommended,
            issues: analysis.issues,
            upgrades: analysis.upgrades,
            photoUrls: localUrls.map((url) => `${origin}${url}`),
          },
        });
        return res.status(201).json(toPublicEstimate(lead));
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: "Please check the required contact and property information.",
            fields: error.flatten(),
          });
        }
        console.error("[instant-estimate] Create failed:", error);
        const message =
          error?.message === "AI_NOT_CONFIGURED"
            ? "Instant estimates are temporarily unavailable. Please call (650) 952-0233."
            : "We could not analyze those images. Please try different roof photos or call us.";
        return res.status(500).json({ error: message });
      }
    },
  );

  app.get("/api/estimate/:id", (req, res) => {
    const lead = db
      .select()
      .from(estimateLeads)
      .where(eq(estimateLeads.id, String(req.params.id)))
      .get();
    if (!lead) return res.status(404).json({ error: "Estimate not found." });
    return res.json(toPublicEstimate(lead));
  });

  app.post("/api/estimate/:id/request-proposal", instantEstimateLimiter, async (req, res) => {
    const lead = db
      .select()
      .from(estimateLeads)
      .where(eq(estimateLeads.id, String(req.params.id)))
      .get();
    if (!lead) return res.status(404).json({ error: "Estimate not found." });
    const proposal = createProposalFromEstimateLead(lead);
    db.update(estimateLeads)
      .set({ notes: [lead.notes, "Prospect requested a full proposal."].filter(Boolean).join("\n") })
      .where(eq(estimateLeads.id, lead.id))
      .run();
    // The owner receives the full lead on submission; this creates their draft proposal immediately.
    return res.json({ ok: true, proposalId: proposal.id });
  });

  // ── Instant Estimate Admin APIs ─────────────────────────────
  app.get("/api/admin/estimate-leads", requireAdmin as any, (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
      const status = typeof req.query.status === "string" ? req.query.status : "";
      const search = typeof req.query.search === "string" ? req.query.search.toLowerCase().trim() : "";
      let all = db.select().from(estimateLeads).orderBy(desc(estimateLeads.createdAt)).all();
      const newCount = all.filter((lead) => lead.status === "new").length;
      if (status) all = all.filter((lead) => lead.status === status);
      if (search) {
        all = all.filter((lead) =>
          `${lead.name} ${lead.email}`.toLowerCase().includes(search),
        );
      }
      const total = all.length;
      return res.json({
        items: all.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
        newCount,
      });
    } catch (error) {
      console.error("[instant-estimate] Admin list failed:", error);
      return res.status(500).json({ error: "Unable to load estimate leads." });
    }
  });

  app.patch("/api/admin/estimate-leads/:id", requireAdmin as any, (req, res) => {
    const update = z
      .object({
        status: z.enum(["new", "contacted", "qualified", "converted", "not_interested"]).optional(),
        notes: z.string().max(10000).optional(),
        contactedAt: z.union([z.number(), z.string().datetime()]).optional(),
      })
      .safeParse(req.body);
    if (!update.success) return res.status(400).json({ error: "Invalid lead update." });
    const values: Record<string, unknown> = { ...update.data };
    if (typeof values.contactedAt === "string") values.contactedAt = new Date(values.contactedAt);
    const lead = db
      .update(estimateLeads)
      .set(values as any)
      .where(eq(estimateLeads.id, req.params.id))
      .returning()
      .get();
    if (!lead) return res.status(404).json({ error: "Estimate lead not found." });
    return res.json(lead);
  });

  app.post("/api/admin/estimate-leads/:id/convert", requireAdmin as any, (req, res) => {
    const lead = db
      .select()
      .from(estimateLeads)
      .where(eq(estimateLeads.id, req.params.id))
      .get();
    if (!lead) return res.status(404).json({ error: "Estimate lead not found." });
    const proposal = createProposalFromEstimateLead(lead);
    return res.status(201).json({ proposalId: proposal.id, proposalToken: proposal.accessToken });
  });

  // ── Public Customer Routes (by access token) ──────────────

  // Get proposal by access token (customer-facing)
  app.get("/api/proposal/:token", (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal)
        return res.status(404).json({ error: "Proposal not found" });

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

      res.json(toPublicProposal(proposal));
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
      // Property-aware incentives: commercial proposals never receive residential-only programs.
      const propertyType = (
        proposal.propertyType ||
        proposal.projectType ||
        "commercial"
      ).toLowerCase();
      const all = [
        ...storage.getIncentivesByProposal(proposal.id),
        ...storage.getAllIncentives().filter((i) => !i.proposalId),
      ];
      const constructionStart = (proposal as any).scheduledStartDate || null;
      const toIso = (v: any) => {
        if (v === null || v === undefined || v === "") return undefined;
        const n = Number(v);
        if (Number.isFinite(n) && n > 100000) return new Date(n * 1000).toISOString().slice(0, 10); // unix seconds (number or numeric text)
        return String(v).slice(0, 10);
      };
      const candidates = all
        .filter((i: any) => {
          const applies = String(i.applicableTo || "commercial,residential").split(",").map((x: string) => x.trim());
          return applies.includes(propertyType) || applies.includes("all");
        })
        .map((i: any) => ({
          ...i,
          name: i.programName,
          type: i.programType,
          description: i.applicability || "",
          link: i.officialLink || "",
          notes: i.notes || undefined,
          verified: toIso(i.lastVerifiedDate),
          expiryDate: toIso(i.expiryDate),
          reviewStatus: i.verificationStatus === "needs_review" ? "needs_review" : undefined,
        }));
      const filtered = applyIncentiveRules(candidates, {
        propertyType,
        utilityTerritory: proposal.utilityTerritory || "",
        constructionStart,
      }).map((r: any) => ({
        ...r,
        programName: r.name,
        programType: r.type,
        applicability: r.description,
        officialLink: r.link,
        notes: r.notes ?? null,
        lastVerifiedDate: r.verified ?? null,
        expiryDate: r.expiryDate ?? null,
      }));
      res.json(filtered);
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

  // Get change orders for a customer proposal
  app.get("/api/proposals/:token/change-orders", (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });
      res.json(
        storage
          .getChangeOrdersByProposal(String(proposal.id))
          .map(toPublicChangeOrder),
      );
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Customer accepts a pending change order with an e-signature
  app.post(
    "/api/proposals/:token/change-orders/:coId/accept",
    async (req, res) => {
      try {
        const proposal = storage.getProposalByToken(req.params.token);
        if (!proposal) return res.status(404).json({ error: "Not found" });
        const changeOrder = storage.getChangeOrder(req.params.coId);
        if (!changeOrder || changeOrder.proposalId !== String(proposal.id)) {
          return res.status(404).json({ error: "Change order not found" });
        }
        if (changeOrder.status !== "pending") {
          return res
            .status(400)
            .json({
              error: "This change order is no longer awaiting approval",
            });
        }

        const { signedByName, customerSignature } = req.body || {};
        if (!signedByName || !customerSignature) {
          return res
            .status(400)
            .json({ error: "Name and signature are required" });
        }
        const acceptedAt = Math.floor(Date.now() / 1000);
        const updated = storage.updateChangeOrder(changeOrder.id, {
          status: "accepted",
          acceptedAt,
          signedByName,
          customerSignature,
        });
        storage.createActivity({
          proposalId: proposal.id,
          eventType: "change_order_accepted",
          eventData: JSON.stringify({
            changeOrderId: changeOrder.id,
            title: changeOrder.title,
            signedByName,
          }),
          ipAddress: req.ip || null,
          userAgent: req.get("user-agent") || null,
          createdAt: new Date().toISOString(),
        } as any);
        sendChangeOrderAcceptedNotificationToOwner({
          changeOrder: { ...changeOrder, signedByName },
          proposal,
        }).catch((err) =>
          console.error("[change-order] owner notification failed:", err),
        );
        res.json({
          success: true,
          changeOrder: updated ? toPublicChangeOrder(updated) : null,
        });
      } catch (e: any) {
        console.error("[change-order] acceptance error:", e);
        res.status(500).json({ error: e.message || "Server error" });
      }
    },
  );

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
      res.json(toPublicActivity(event));
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
        eventType:
          req.body.messageType === "approval"
            ? "approved"
            : req.body.messageType === "revision"
              ? "revision_requested"
              : "question",
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

  // ── Audit portal additions ─────────────────────────────────
  const messageSchema = z.object({
    body: z.string().trim().min(1, "Message cannot be empty").max(5000),
    senderName: z.string().trim().min(1).max(100).optional(),
  });
  const financingSchema = z.object({
    applicantName: z.string().trim().min(2).max(100),
    email: z.string().email(),
    phone: z.string().trim().min(7).max(30),
    employmentStatus: z.string().trim().min(1).max(100),
    annualIncome: z.string().trim().min(1).max(100),
    preferredTerm: z
      .number()
      .int()
      .refine((v) => [60, 84, 120, 180].includes(v), "Choose a valid term"),
    preferredProvider: z.enum(["GoGreen", "PACE", "HERO", "Contact Me"]),
  });
  // Stars are optional and never used to decide who is asked for a public review.
  const reviewSchema = z.object({
    stars: z.number().int().min(0).max(5).optional().default(0),
    feedback: z.string().max(5000).optional().nullable(),
    site: z.string().max(40).optional(),
  });

  // Real dependency checks (cached 10 min) so "ok" means email, AI and payments actually work.
  type Probe = { ok: boolean; detail: string };
  const probeCache: { at: number; email?: Probe; ai?: Probe } = { at: 0 };
  const probeServices = async () => {
    if (Date.now() - probeCache.at < 10 * 60 * 1000 && probeCache.email) return probeCache;
    const timeout = () => AbortSignal.timeout(5000);
    let email: Probe = { ok: false, detail: "RESEND_API_KEY not set" };
    if (process.env.RESEND_API_KEY) {
      try {
        const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: timeout() });
        if (!r.ok) email = { ok: false, detail: `Resend rejected the API key (${r.status})` };
        else {
          const j: any = await r.json();
          const verified = (j.data || []).filter((d: any) => d.status === "verified").map((d: any) => d.name);
          const from = process.env.RESEND_FROM || "onboarding@resend.dev";
          const fromDomain = (from.match(/@([^>\s]+)/) || [])[1] || "";
          if (fromDomain === "resend.dev") email = { ok: false, detail: verified.length ? `Sender is still the Resend test address; set RESEND_FROM to an address at ${verified[0]}` : "Sandbox mode: no verified sending domain, so emails only reach the account owner. Verify mccurdycoatings.com in Resend." };
          else if (!verified.includes(fromDomain)) email = { ok: false, detail: `Sender domain ${fromDomain} is not verified in Resend` };
          else email = { ok: true, detail: `Sending from ${fromDomain}` };
        }
      } catch (e: any) { email = { ok: false, detail: `Resend unreachable: ${e.message}` }; }
    }
    let ai: Probe = { ok: false, detail: "OPENAI_API_KEY not set" };
    if (process.env.OPENAI_API_KEY) {
      try {
        const r = await fetch("https://api.openai.com/v1/models/gpt-4o-mini", { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, signal: timeout() });
        ai = r.ok ? { ok: true, detail: "OpenAI reachable" } : { ok: false, detail: `OpenAI rejected the key (${r.status})` };
      } catch (e: any) { ai = { ok: false, detail: `OpenAI unreachable: ${e.message}` }; }
    }
    Object.assign(probeCache, { at: Date.now(), email, ai });
    return probeCache;
  };
  app.get("/api/health", async (_req, res) => {
    let dbHealthy = true;
    try {
      sqliteConnection.prepare("SELECT 1").get();
    } catch {
      dbHealthy = false;
    }
    const { email, ai } = await probeServices();
    const payments: Probe = process.env.STRIPE_SECRET_KEY ? { ok: !!process.env.STRIPE_WEBHOOK_SECRET, detail: process.env.STRIPE_WEBHOOK_SECRET ? "Stripe configured" : "Stripe key set but webhook secret missing" } : { ok: false, detail: "Online card payments not set up (manual payment links only)" };
    const critical = dbHealthy;
    const allOk = critical && email!.ok && ai!.ok;
    res.status(critical ? 200 : 503).json({
      status: !critical ? "down" : allOk ? "ok" : "degraded",
      timestamp: Date.now(),
      services: { db: dbHealthy, email: email!.ok, ai: ai!.ok, payments: payments.ok },
      details: { email: email!.detail, ai: ai!.detail, payments: payments.detail },
      version: process.env.RENDER_GIT_COMMIT || "unknown",
    });
  });
  app.get("/api/ready", (_req, res) => {
    let dbHealthy = true;
    try {
      sqliteConnection.prepare("SELECT 1").get();
    } catch {
      dbHealthy = false;
    }
    const body = {
      status: dbHealthy ? "ok" : "degraded",
      timestamp: Date.now(),
      services: {
        db: dbHealthy,
        email: !!process.env.RESEND_API_KEY,
        ai: !!process.env.OPENAI_API_KEY,
      },
      version: process.env.RENDER_GIT_COMMIT || "unknown",
    };
    res.status(dbHealthy ? 200 : 503).json(body);
  });

  app.get("/api/proposals/:token/messages", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    const rows = db
      .select()
      .from(messages)
      .where(eq(messages.proposalId, p.id))
      .orderBy(messages.createdAt)
      .all();
    db.update(messages)
      .set({ readByRecipient: 1 })
      .where(eq(messages.proposalId, p.id))
      .run();
    res.json(rows);
  });
  app.post("/api/proposals/:token/messages", async (req, res) => {
    try {
      const p = storage.getProposalByToken(req.params.token);
      if (!p) return res.status(404).json({ error: "Not found" });
      const data = messageSchema.parse(req.body);
      const row = db
        .insert(messages)
        .values({
          id: randomUUID(),
          proposalId: p.id,
          sender: "customer",
          senderName: data.senderName || p.customerName,
          body: data.body,
          createdAt: Math.floor(Date.now() / 1000),
          readByRecipient: 0,
        })
        .returning()
        .get();
      sendCustomerMessageToOwner({
        proposal: p,
        body: data.body,
        senderName: row.senderName,
      }).catch(console.error);
      res.status(201).json(row);
    } catch (e: any) {
      res
        .status(400)
        .json({
          error: e.issues?.[0]?.message || e.message || "Invalid message",
        });
    }
  });
  app.post("/api/proposals/:token/financing/apply", async (req, res) => {
    try {
      const p = storage.getProposalByToken(req.params.token);
      if (!p) return res.status(404).json({ error: "Not found" });
      const data = financingSchema.parse(req.body);
      const row = db
        .insert(financingApplications)
        .values({
          id: randomUUID(),
          proposalId: p.id,
          ...data,
          submittedAt: Math.floor(Date.now() / 1000),
          status: "received",
        })
        .returning()
        .get();
      sendFinancingApplicationToOwner({ proposal: p, application: data }).catch(
        console.error,
      );
      if (p.customerEmail)
        sendBrandedEmail({
          to: p.customerEmail,
          customerName: data.applicantName,
          subject: "We received your financing request",
          title: "Financing request received",
          body: "<p>Thank you. Mike will review your request and contact you about next steps.</p>",
        }).catch(console.error);
      res.status(201).json(row);
    } catch (e: any) {
      res.status(400).json({ error: e.issues?.[0]?.message || e.message });
    }
  });
  app.get("/api/proposals/:token/preferences", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    const row =
      db
        .select()
        .from(customerPreferences)
        .where(eq(customerPreferences.proposalId, p.id))
        .get() ||
      db
        .insert(customerPreferences)
        .values({ proposalId: p.id })
        .returning()
        .get();
    res.json({ ...row, stormAlerts: isStormOptedIn(p.id) ? 1 : 0 });
  });
  app.patch("/api/proposals/:token/preferences", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    const permitted = Object.fromEntries(
      Object.entries(req.body || {})
        .filter(([k]) =>
          [
            "emailReminders",
            "stormAlerts",
            "seasonalCheckins",
            "reviewPrompts",
          ].includes(k),
        )
        .map(([k, v]) => [k, v ? 1 : 0]),
    );
    const existing = db
      .select()
      .from(customerPreferences)
      .where(eq(customerPreferences.proposalId, p.id))
      .get();
    const row = existing
      ? db
          .update(customerPreferences)
          .set(permitted)
          .where(eq(customerPreferences.proposalId, p.id))
          .returning()
          .get()
      : db
          .insert(customerPreferences)
          .values({ proposalId: p.id, ...permitted })
          .returning()
          .get();
    if ("stormAlerts" in (req.body || {})) setStormOptIn(p.id, !!req.body.stormAlerts, "preferences");
    res.json({ ...row, stormAlerts: isStormOptedIn(p.id) ? 1 : 0 });
  });
  app.get("/api/unsubscribe/:token/:type", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).send("Not found");
    const map: any = {
      email_reminders: "emailReminders",
      storm_alerts: "stormAlerts",
      seasonal_checkins: "seasonalCheckins",
      review_prompts: "reviewPrompts",
    };
    const field = map[req.params.type];
    if (!field) return res.status(400).send("Unknown preference");
    if (field === "stormAlerts") setStormOptIn(p.id, false, "unsubscribe");
    const existing = db
      .select()
      .from(customerPreferences)
      .where(eq(customerPreferences.proposalId, p.id))
      .get();
    if (existing)
      db.update(customerPreferences)
        .set({ [field]: 0 })
        .where(eq(customerPreferences.proposalId, p.id))
        .run();
    else
      db.insert(customerPreferences)
        .values({ proposalId: p.id, [field]: 0 } as any)
        .run();
    res
      .type("html")
      .send("<p>You have been unsubscribed from this type of email.</p>");
  });
  app.get("/api/proposals/:token/appointment.ics", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p || !p.appointmentDate)
      return res.status(404).send("Appointment not found");
    const start = new Date(p.appointmentDate * 1000),
      end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) =>
      d
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z/, "Z");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=mccurdy-appointment.ics",
    );
    res.send(
      `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//McCurdy Coatings//EN\r\nBEGIN:VEVENT\r\nUID:${p.id}-${p.appointmentDate}@mccurdycoatings.com\r\nDTSTAMP:${fmt(new Date())}\r\nDTSTART:${fmt(start)}\r\nDTEND:${fmt(end)}\r\nSUMMARY:McCurdy Coatings Appointment\r\nLOCATION:${String(p.propertyAddress).replace(/[\r\n,;]/g, " ")}\r\nDESCRIPTION:McCurdy Coatings · (650) 952-0233\r\nEND:VEVENT\r\nEND:VCALENDAR`,
    );
  });

  // ── Admin Routes ──────────────────────────────────────────

  // List all proposals
  app.get("/api/admin/proposals", requireAdmin as any, (_req, res) => {
    try {
      res.json(storage.getAllProposals().map(toAdminProposal));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get single proposal by ID
  app.get("/api/admin/proposals/:id", requireAdmin as any, (req, res) => {
    try {
      const proposal = storage.getProposal(parseInt(req.params.id));
      if (!proposal) return res.status(404).json({ error: "Not found" });
      res.json(toAdminProposal(proposal));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Create proposal
  app.post("/api/admin/proposals", requireAdmin as any, (req, res) => {
    try {
      const token = randomBytes(32).toString("hex");
      const proposalNumber = `MCC-${Date.now().toString(36).toUpperCase()}`;
      const today = new Date().toISOString().slice(0, 10);

      const proposal = storage.createProposal({
        // Sensible defaults so a minimal form never crashes
        proposalDate: today,
        estimator: "McCurdy Coatings",
        state: "CA",
        projectType: "commercial",
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
  app.patch("/api/admin/proposals/:id", requireAdmin as any, (req, res) => {
    try {
      const proposal = storage.updateProposal(
        parseInt(req.params.id),
        req.body,
      );
      if (!proposal) return res.status(404).json({ error: "Not found" });
      if (req.body?.workCompletedDate) {
        const existingReview = db
          .select()
          .from(emailSchedule)
          .where(eq(emailSchedule.proposalId, proposal.id))
          .all()
          .some((item) => item.type === "review_request");
        if (!existingReview) {
          const completed =
            Math.floor(new Date(req.body.workCompletedDate).getTime() / 1000) ||
            Math.floor(Date.now() / 1000);
          db.insert(emailSchedule)
            .values({
              id: randomUUID(),
              proposalId: proposal.id,
              type: "review_request",
              scheduledFor: completed + 3 * 86400,
              status: "pending",
            })
            .run();
        }
      }
      res.json(proposal);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Failed to update" });
    }
  });

  // ── Change Orders CRUD ──
  app.get(
    "/api/admin/proposals/:id/change-orders",
    requireAdmin as any,
    (req, res) => {
      try {
        const proposal = storage.getProposal(parseInt(req.params.id));
        if (!proposal)
          return res.status(404).json({ error: "Proposal not found" });
        res.json(storage.getChangeOrdersByProposal(String(proposal.id)));
      } catch (e) {
        res.status(500).json({ error: "Server error" });
      }
    },
  );

  app.post(
    "/api/admin/proposals/:id/change-orders",
    requireAdmin as any,
    (req, res) => {
      try {
        const proposal = storage.getProposal(parseInt(req.params.id));
        if (!proposal)
          return res.status(404).json({ error: "Proposal not found" });
        const parsed = insertChangeOrderSchema.parse({
          ...req.body,
          proposalId: String(proposal.id),
        });
        const changeOrder = storage.createChangeOrder(parsed);
        storage.createActivity({
          proposalId: proposal.id,
          eventType: "change_order_created",
          eventData: JSON.stringify({
            changeOrderId: changeOrder.id,
            title: changeOrder.title,
            amount: changeOrder.amount,
            type: changeOrder.type,
          }),
          ipAddress: req.ip || null,
          userAgent: req.get("user-agent") || null,
          createdAt: new Date().toISOString(),
        } as any);
        res.status(201).json(changeOrder);
      } catch (e: any) {
        res
          .status(400)
          .json({ error: e.message || "Unable to create change order" });
      }
    },
  );

  app.patch(
    "/api/admin/change-orders/:coId",
    requireAdmin as any,
    (req, res) => {
      try {
        const existing = storage.getChangeOrder(req.params.coId);
        if (!existing)
          return res.status(404).json({ error: "Change order not found" });
        const allowed = [
          "title",
          "description",
          "amount",
          "type",
          "status",
        ] as const;
        const updates = Object.fromEntries(
          Object.entries(req.body || {}).filter(([key]) =>
            allowed.includes(key as (typeof allowed)[number]),
          ),
        );
        const changeOrder = storage.updateChangeOrder(
          existing.id,
          updates as any,
        );
        res.json(changeOrder);
      } catch (e: any) {
        res
          .status(400)
          .json({ error: e.message || "Unable to update change order" });
      }
    },
  );

  app.delete(
    "/api/admin/change-orders/:coId",
    requireAdmin as any,
    (req, res) => {
      try {
        const existing = storage.getChangeOrder(req.params.coId);
        if (!existing)
          return res.status(404).json({ error: "Change order not found" });
        storage.deleteChangeOrder(existing.id);
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: "Server error" });
      }
    },
  );

  app.post(
    "/api/admin/change-orders/:coId/send",
    requireAdmin as any,
    async (req, res) => {
      try {
        const changeOrder = storage.getChangeOrder(req.params.coId);
        if (!changeOrder)
          return res.status(404).json({ error: "Change order not found" });
        const proposal = storage.getProposal(parseInt(changeOrder.proposalId));
        if (!proposal)
          return res.status(404).json({ error: "Proposal not found" });
        const to = String(
          req.body?.email ||
            proposal.customerEmail ||
            proposal.lastSentTo ||
            "",
        ).trim();
        if (!/^\S+@\S+\.\S+$/.test(to))
          return res
            .status(400)
            .json({ error: "A valid customer email is required" });
        const result = await sendChangeOrderEmail({
          to,
          changeOrder,
          proposal,
          ownerName: proposal.estimator || "Mike Schirmer",
        });
        if (!result.ok)
          return res
            .status(502)
            .json({ error: result.error || "Unable to send email" });
        const sentAt = Math.floor(Date.now() / 1000);
        const updated = storage.updateChangeOrder(changeOrder.id, { sentAt });
        storage.createActivity({
          proposalId: proposal.id,
          eventType: "change_order_sent",
          eventData: JSON.stringify({
            changeOrderId: changeOrder.id,
            sentTo: to,
          }),
          ipAddress: req.ip || null,
          userAgent: req.get("user-agent") || null,
          createdAt: new Date().toISOString(),
        } as any);
        res.json({
          success: true,
          sentTo: to,
          changeOrder: updated,
          messageId: result.id,
        });
      } catch (e: any) {
        console.error("[change-order] send error:", e);
        res.status(500).json({ error: e.message || "Server error" });
      }
    },
  );

  // Send proposal to customer via email (Resend)
  app.post(
    "/api/admin/proposals/:id/send-email",
    requireAdmin as any,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const proposal = storage.getProposal(id);
        if (!proposal)
          return res.status(404).json({ error: "Proposal not found" });

        // Allow override email in body, else use stored customerEmail
        const toEmail: string = (
          req.body?.email ||
          (proposal as any).customerEmail ||
          ""
        ).trim();
        if (!toEmail)
          return res.status(400).json({ error: "No email address provided" });
        if (!/^\S+@\S+\.\S+$/.test(toEmail))
          return res.status(400).json({ error: "Invalid email address" });

        const customMessage: string | undefined = req.body?.message;

        const result = await sendProposalEmail({
          toEmail,
          customerName: proposal.customerName,
          companyName: proposal.companyName,
          proposalNumber: proposal.proposalNumber,
          accessToken: proposal.accessToken,
          propertyAddress: proposal.propertyAddress,
          estimator: proposal.estimator,
          customMessage,
        });

        if (!result.ok) return res.status(502).json({ error: result.error });

        // Track the send
        const now = new Date().toISOString();
        const currentCount = ((proposal as any).sendCount || 0) as number;
        storage.updateProposal(id, {
          lastSentAt: now,
          lastSentTo: toEmail,
          sendCount: currentCount + 1,
          customerEmail: toEmail, // save for future sends
          status: proposal.status === "draft" ? "sent" : proposal.status,
        } as any);
        // Schedule each follow-up only once per proposal/type.
        const sentAt = Math.floor(Date.now() / 1000);
        for (const [type, days] of [
          ["day1", 1],
          ["day3", 3],
          ["day7", 7],
          ["day14", 14],
        ] as const) {
          const exists = db
            .select()
            .from(emailSchedule)
            .where(eq(emailSchedule.proposalId, id))
            .all()
            .some((row) => row.type === type);
          if (!exists)
            db.insert(emailSchedule)
              .values({
                id: randomUUID(),
                proposalId: id,
                type,
                scheduledFor: sentAt + days * 86400,
                status: "pending",
              })
              .run();
        }

        res.json({ success: true, sentTo: toEmail, messageId: result.id });
      } catch (e: any) {
        console.error("[send-email] Error:", e);
        res.status(500).json({ error: e.message || "Server error" });
      }
    },
  );

  // Customer signs & approves — called from customer portal
  app.post("/api/proposals/:token/sign", async (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });

      const {
        signature,
        signedByName,
        signedByTitle,
        approvedOption,
        requestedStartDate,
      } = req.body || {};
      if (
        typeof signature !== "string" ||
        signature.trim().length < 10 ||
        typeof signedByName !== "string" ||
        signedByName.trim().length < 2 ||
        signedByName.trim().length > 100
      ) {
        return res
          .status(400)
          .json({
            error:
              "Provide a signature of at least 10 characters and a name between 2 and 100 characters.",
          });
      }

      if (process.env.CUSTOMER_VERIFY_REQUIRED === "1" && proposal.customerEmail && !isVerifiedFor(req, proposal))
        return res.status(403).json({ error: "Please verify your email before signing.", code: "VERIFY_REQUIRED" });
      const now = new Date().toISOString();
      const updated = storage.updateProposal(proposal.id, {
        customerSignature: signature,
        signedAt: now,
        signedByName,
        signedByTitle: signedByTitle || null,
        approvedOption: approvedOption || null,
        approvedAt: now,
        approvedBy: signedByName,
        requestedStartDate: requestedStartDate || null,
        status: "approved",
      } as any);

      // Log activity
      try {
        storage.createActivity({
          proposalId: proposal.id,
          eventType: "signed",
          eventData: JSON.stringify({
            signedByName,
            approvedOption,
            requestedStartDate,
          }),
          ipAddress: req.ip || null,
          userAgent: req.get("user-agent") || null,
          createdAt: now,
        } as any);
      } catch {}

      // Notify owner (async, don't block response)
      sendSignedNotificationToOwner({
        customerName: proposal.customerName,
        companyName: proposal.companyName,
        proposalNumber: proposal.proposalNumber,
        signedByName,
        signedByTitle,
        approvedOption,
        requestedStartDate,
        propertyAddress: proposal.propertyAddress,
        accessToken: proposal.accessToken,
      }).catch((err) => console.error("[sign] notify owner failed:", err));
      // Next steps: milestone invoice drafts + walkthrough booking email.
      afterProposalSigned(req, proposal.id).catch((err) => console.error("[sign] after-sign failed:", err));

      res.json({
        success: true,
        nextSteps: { bookingUrl: "https://calendly.com/mccurdycoatings?utm_source=portal&utm_medium=approval&utm_campaign=post_sign" },
        proposal: updated ? toPublicProposal(updated) : null,
      });
    } catch (e: any) {
      console.error("[sign] Error:", e);
      res.status(500).json({ error: e.message || "Server error" });
    }
  });

  // Delete proposal
  app.delete("/api/admin/proposals/:id", requireAdmin as any, (req, res) => {
    try {
      storage.deleteProposal(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Materials CRUD ──
  app.get(
    "/api/admin/proposals/:id/materials",
    requireAdmin as any,
    (req, res) => {
      try {
        res.json(storage.getMaterialsByProposal(parseInt(req.params.id)));
      } catch (e) {
        res.status(500).json({ error: "Server error" });
      }
    },
  );

  app.post("/api/admin/materials", requireAdmin as any, (req, res) => {
    try {
      res.json(storage.createMaterial(req.body));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/admin/materials/:id", requireAdmin as any, (req, res) => {
    try {
      const m = storage.updateMaterial(parseInt(req.params.id), req.body);
      if (!m) return res.status(404).json({ error: "Not found" });
      res.json(m);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/materials/:id", requireAdmin as any, (req, res) => {
    try {
      storage.deleteMaterial(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Images CRUD ──
  app.get(
    "/api/admin/proposals/:id/images",
    requireAdmin as any,
    (req, res) => {
      try {
        res.json(storage.getImagesByProposal(parseInt(req.params.id)));
      } catch (e) {
        res.status(500).json({ error: "Server error" });
      }
    },
  );

  app.post("/api/admin/images", requireAdmin as any, (req, res) => {
    try {
      res.json(storage.createImage(req.body));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/images/:id", requireAdmin as any, (req, res) => {
    try {
      storage.deleteImage(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Incentives CRUD ──
  app.get("/api/admin/incentives", requireAdmin as any, (_req, res) => {
    try {
      res.json(storage.getAllIncentives());
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/admin/incentives", requireAdmin as any, (req, res) => {
    try {
      res.json(storage.createIncentive(req.body));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/incentives/:id", requireAdmin as any, (req, res) => {
    try {
      storage.deleteIncentive(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Warranty Documents CRUD ──
  app.post("/api/admin/warranty-docs", requireAdmin as any, (req, res) => {
    try {
      res.json(storage.createWarrantyDoc(req.body));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete(
    "/api/admin/warranty-docs/:id",
    requireAdmin as any,
    (req, res) => {
      try {
        storage.deleteWarrantyDoc(parseInt(req.params.id));
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: "Server error" });
      }
    },
  );

  // ── Documents CRUD ──
  app.get(
    "/api/admin/proposals/:id/documents",
    requireAdmin as any,
    (req, res) => {
      try {
        res.json(storage.getDocumentsByProposal(parseInt(req.params.id)));
      } catch (e) {
        res.status(500).json({ error: "Server error" });
      }
    },
  );

  app.get(
    "/api/admin/proposals/:id/warranty-docs",
    requireAdmin as any,
    (req, res) => {
      try {
        res.json(storage.getWarrantyDocsByProposal(parseInt(req.params.id)));
      } catch (e) {
        res.status(500).json({ error: "Server error" });
      }
    },
  );

  app.post("/api/admin/documents", requireAdmin as any, (req, res) => {
    try {
      res.json(storage.createDocument(req.body));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/admin/documents/:id", requireAdmin as any, (req, res) => {
    try {
      storage.deleteDocument(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Activity Tracking ──
  app.get("/api/admin/activities", requireAdmin as any, (_req, res) => {
    try {
      res.json(storage.getAllActivities());
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get(
    "/api/admin/proposals/:id/activities",
    requireAdmin as any,
    (req, res) => {
      try {
        res.json(storage.getActivitiesByProposal(parseInt(req.params.id)));
      } catch (e) {
        res.status(500).json({ error: "Server error" });
      }
    },
  );

  // ── Two-way proposal messages ──
  app.get("/api/admin/messages", requireAdmin as any, (_req, res) => {
    try {
      res.json(db.select().from(messages).orderBy(desc(messages.createdAt)).all());
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── File Upload ──
  app.get(
    "/api/admin/proposals/:id/messages",
    requireAdmin as any,
    (req, res) => {
      const p = storage.getProposal(Number(req.params.id));
      if (!p) return res.status(404).json({ error: "Not found" });
      const rows = db
        .select()
        .from(messages)
        .where(eq(messages.proposalId, p.id))
        .orderBy(messages.createdAt)
        .all();
      db.update(messages)
        .set({ readByRecipient: 1 })
        .where(eq(messages.proposalId, p.id))
        .run();
      res.json(rows);
    },
  );
  app.post(
    "/api/admin/proposals/:id/messages",
    requireAdmin as any,
    async (req, res) => {
      try {
        const p = storage.getProposal(Number(req.params.id));
        if (!p) return res.status(404).json({ error: "Not found" });
        const data = messageSchema.parse(req.body);
        const row = db
          .insert(messages)
          .values({
            id: randomUUID(),
            proposalId: p.id,
            sender: "admin",
            senderName: data.senderName || "Mike Schirmer",
            body: data.body,
            createdAt: Math.floor(Date.now() / 1000),
            readByRecipient: 0,
          })
          .returning()
          .get();
        if (p.customerEmail)
          sendAdminMessageToCustomer({
            proposal: p,
            body: data.body,
            senderName: row.senderName,
          }).catch(console.error);
        res.status(201).json(row);
      } catch (e: any) {
        res.status(400).json({ error: e.issues?.[0]?.message || e.message });
      }
    },
  );
  app.get("/api/admin/financing", requireAdmin as any, (_req, res) =>
    res.json(
      db
        .select()
        .from(financingApplications)
        .orderBy(desc(financingApplications.submittedAt))
        .all(),
    ),
  );
  app.patch("/api/admin/financing/:id", requireAdmin as any, (req, res) => {
    const row = db
      .update(financingApplications)
      .set({ status: req.body.status })
      .where(eq(financingApplications.id, req.params.id))
      .returning()
      .get();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });
  app.get("/api/admin/stale-incentives", requireAdmin as any, (_req, res) => {
    const now = Math.floor(Date.now() / 1000),
      stale = now - 90 * 86400;
    res.json(
      db
        .select()
        .from(incentives)
        .all()
        .filter(
          (i: any) =>
            i.expiryDate < now ||
            (i.lastVerifiedDate && (typeof i.lastVerifiedDate === "number" ? i.lastVerifiedDate : Math.floor(new Date(i.lastVerifiedDate).getTime() / 1000)) < stale),
        )
        .map((i: any) => ({
          ...i,
          verificationStatus: i.expiryDate < now ? "expired" : "needs_review",
        })),
    );
  });
  // Legacy button: now opt-in only, tracked like automatic storm alerts.
  app.post("/api/admin/storm-outreach", requireAdmin as any, async (req, res) => {
    const r = await sendStormFollowups({ date: new Date().toISOString().slice(0, 10), reason: String(req.body?.reason || "heavy weather").slice(0, 120) }, "manual");
    res.json({ success: true, sent: r.sent, recipients: r.recipients });
  });
  app.get("/api/admin/schedule", requireAdmin as any, (_req, res) => {
    const all = db.select().from(proposals).all();
    res.json({
      appointments: all.filter((p) => p.appointmentDate || p.workCompletedDate),
      jobs: all
        .filter((p) => !["draft", "declined", "completed", "job_completed"].includes(String(p.status)))
        .map((p) => ({ id: p.id, customerName: p.customerName, propertyAddress: p.propertyAddress, city: p.city, status: p.status })),
      crewMembers: db.select().from(crewMembers).all().filter((c: any) => c.active !== 0),
      crew: db.select().from(crewSchedule).all(),
    });
  });
  const crewSlotSchema = z.object({
    crewMemberId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(["assigned", "unavailable", "available"]),
    proposalId: z.number().int().nullable().optional(),
  });
  // One slot per crew member per day: assigning replaces that day's slot, so crews can't be double-booked.
  app.post("/api/admin/crew-schedule", requireAdmin as any, (req, res) => {
    try {
      const data = crewSlotSchema.parse(req.body);
      if (data.status === "assigned" && !data.proposalId) return res.status(400).json({ error: "Choose a job to assign." });
      const existing = db.select().from(crewSchedule).all().filter((r) => r.crewMemberId === data.crewMemberId && r.date === data.date);
      for (const r of existing) db.delete(crewSchedule).where(eq(crewSchedule.id, r.id)).run();
      if (data.status === "available") return res.json({ cleared: true });
      res.status(201).json(db.insert(crewSchedule).values({ id: randomUUID(), crewMemberId: data.crewMemberId, date: data.date, status: data.status, proposalId: data.status === "assigned" ? data.proposalId! : null }).returning().get());
    } catch (e: any) {
      res.status(400).json({ error: e.issues?.[0]?.message || e.message });
    }
  });
  app.delete("/api/admin/crew-schedule/:id", requireAdmin as any, (req, res) => {
    db.delete(crewSchedule).where(eq(crewSchedule.id, req.params.id)).run();
    res.json({ ok: true });
  });
  app.get(
    "/api/admin/proposals/:id/checklist",
    requireAdmin as any,
    (req, res) => {
      const pid = Number(req.params.id);
      let rows = db
        .select()
        .from(crewChecklists)
        .where(eq(crewChecklists.proposalId, pid))
        .all();
      if (!rows.length) {
        for (const phase of [
          "Site prep",
          "Coating application",
          "Cure verification",
          "Final inspection",
        ])
          db.insert(crewChecklists)
            .values({ id: randomUUID(), proposalId: pid, phase })
            .run();
        rows = db
          .select()
          .from(crewChecklists)
          .where(eq(crewChecklists.proposalId, pid))
          .all();
      }
      res.json(rows);
    },
  );
  app.patch("/api/admin/checklist/:id", requireAdmin as any, (req, res) =>
    res.json(
      db
        .update(crewChecklists)
        .set({
          completed: req.body.completed ? 1 : 0,
          completedAt: req.body.completed
            ? Math.floor(Date.now() / 1000)
            : null,
        })
        .where(eq(crewChecklists.id, req.params.id))
        .returning()
        .get(),
    ),
  );
  app.post(
    "/api/admin/upload",
    requireAdmin as any,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file)
          return res.status(400).json({ error: "No file uploaded" });
        const isImage = /^image\//.test(req.file.mimetype);
        if (!isImage && req.file.size > 20 * 1024 * 1024) {
          fs.unlink(req.file.path, () => undefined);
          return res.status(413).json({ error: "Documents must be 20 MB or smaller." });
        }
        // Photos are resized and converted to WebP (+ responsive variants) so pages load fast on cellular.
        const optimized = isImage ? await optimizeUpload(req.file.path, "/api/uploads").catch(() => null) : null;
        res.json({
          url: optimized?.url || `/api/uploads/${req.file.filename}`,
          filename: req.file.originalname,
          size: optimized?.bytes ?? req.file.size,
          originalSize: req.file.size,
          mimetype: optimized ? "image/webp" : req.file.mimetype,
          width: optimized?.width,
          height: optimized?.height,
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message || "Upload failed" });
      }
    },
  );

  // Serve uploaded files
  app.use("/api/uploads", (req, res, next) => {
    const filePath = path.join(uploadDir, path.basename(req.path));
    if (fs.existsSync(filePath)) {
      // Upload names are unique (timestamped), so they can be cached long-term.
      return res.sendFile(filePath, { maxAge: "365d", immutable: true });
    }
    res.status(404).json({ error: "File not found" });
  });

  // ── County Incentives ──
  // Current-content normalization keeps older county seed records accurate at response time.
  const currentCountyPrograms = (data: any, propertyType = "commercial", utilityTerritory = "", constructionStart?: string | null) => {
    if (!data) return data;
    return { ...data, programs: applyIncentiveRules(data.programs || [], { propertyType, utilityTerritory: utilityTerritory || data.utility, climateZone: data.climateZone, constructionStart }) };
  };
  app.get("/api/county-incentives/:county", (req, res) => {
    try {
      const county = req.params.county.toLowerCase().replace(/\s+/g, "-");
      // Prefer live DB (auto-refreshed yearly). Fall back to hard-coded seed if row missing.
      const propertyType = String(req.query.propertyType || "commercial");
      const utilityTerritory = String(req.query.utilityTerritory || "");
      const startQ = String(req.query.constructionStart || "");
      const constructionStart = /^\d{4}-\d{2}-\d{2}$/.test(startQ) ? startQ : null;
      const dbData = getCountyFromDb(sqliteConnection, county);
      if (dbData) return res.json(currentCountyPrograms(dbData, propertyType, utilityTerritory, constructionStart));
      const data = getCountyIncentives(county);
      if (!data) return res.status(404).json({ error: "County not found" });
      res.json(currentCountyPrograms(data, propertyType, utilityTerritory, constructionStart));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/county-incentives", (req, res) => {
    try {
      const propertyType = String(req.query.propertyType || "commercial");
      const dbData = getAllCountiesFromDb(sqliteConnection);
      const list = dbData.length > 0 ? dbData : getAllCountyIncentives();
      res.json(list.map((c: any) => currentCountyPrograms(c, propertyType, "")));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Upsert a single county's incentive data (used by scheduled task runner)
  app.post("/api/admin/upsert-county", requireAdmin as any, (req, res) => {
    try {
      const body = req.body || {};
      const { county, climateZone, utility, programs } = body;
      const countyKey = (body.countyKey || county || "")
        .toString()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/-county$/, "");
      if (
        !countyKey ||
        !county ||
        !Array.isArray(programs) ||
        programs.length === 0
      ) {
        return res
          .status(400)
          .json({ error: "Missing required fields: county, programs[]" });
      }
      const now = new Date().toISOString();
      const taxYear = body.taxYear || new Date().getFullYear();
      sqliteConnection
        .prepare(
          `
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
      `,
        )
        .run(
          countyKey,
          county,
          climateZone || "",
          utility || "",
          // Scheduled-task data is held for admin review; a signed-in admin may approve on upload.
          JSON.stringify(programs.map((p: any) => (req.adminUser && body.approved === true ? { ...p, reviewStatus: "approved", verified: now.slice(0, 10), source: "admin" } : { ...p, reviewStatus: "needs_review", source: p.source || "automation" }))),
          taxYear,
          now,
          now,
          JSON.stringify(body.sources || []),
        );
      res.json({
        success: true,
        countyKey,
        programsCount: programs.length,
        taxYear,
      });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Admin incentive review queue
  app.get("/api/admin/county-incentives/review", requireAdmin as any, (_req, res) => {
    const rows = sqliteConnection.prepare("SELECT county_key, county_name, climate_zone, utility, programs, tax_year, last_updated FROM county_incentives ORDER BY county_name").all() as any[];
    res.json(rows.map((r) => {
      let programs: any[] = [];
      try { programs = JSON.parse(r.programs); } catch {}
      const customerView = applyIncentiveRules(programs, { propertyType: "commercial", utilityTerritory: r.utility, climateZone: r.climate_zone });
      return { countyKey: r.county_key, county: r.county_name, utility: r.utility, taxYear: r.tax_year, lastUpdated: r.last_updated, programs, pending: customerView.filter((p) => p.verificationStatus === "needs_review").length, shown: customerView.length };
    }));
  });
  // Approve a county's programs after checking them against the official sources.
  app.post("/api/admin/county-incentives/:key/approve", requireAdmin as any, (req, res) => {
    if (!req.adminUser || !["owner", "admin"].includes(req.adminUser.role)) return res.status(403).json({ error: "Only owners and admins can approve incentives." });
    const row = sqliteConnection.prepare("SELECT programs FROM county_incentives WHERE county_key = ?").get(req.params.key) as any;
    if (!row) return res.status(404).json({ error: "County not found" });
    const names: string[] | undefined = Array.isArray(req.body?.programNames) ? req.body.programNames : undefined;
    const today = new Date().toISOString().slice(0, 10);
    const programs = JSON.parse(row.programs).map((p: any) => (!names || names.includes(p.name) ? { ...p, reviewStatus: "approved", verified: today, source: "admin", approvedBy: req.adminUser!.email } : p));
    sqliteConnection.prepare("UPDATE county_incentives SET programs = ?, last_audit_passed = ? WHERE county_key = ?").run(JSON.stringify(programs), new Date().toISOString(), req.params.key);
    res.json({ ok: true, approved: names ? names.length : programs.length });
  });

  app.post(
    "/api/admin/refresh-incentives",
    requireAdmin as any,
    async (req, res) => {
      try {
        const taxYear = req.body?.taxYear
          ? parseInt(req.body.taxYear, 10)
          : undefined;
        const report = await manualRefresh(sqliteConnection, taxYear);
        res.json({ success: true, report });
      } catch (e) {
        res.status(500).json({ error: (e as Error).message });
      }
    },
  );

  app.get("/api/admin/refresh-log", requireAdmin as any, (_req, res) => {
    try {
      const rows = sqliteConnection
        .prepare(
          "SELECT run_id, run_at, run_type, county_key, status, changes_json, error_message, tax_year FROM incentive_refresh_log ORDER BY run_at DESC LIMIT 100",
        )
        .all();
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Mega-build routes ─────────────────────────────────────
  app.post(
    "/api/admin/proposals/:id/analyze-roof",
    requireAdmin as any,
    async (req, res) => {
      const proposal = storage.getProposal(Number(req.params.id));
      if (!proposal)
        return res.status(404).json({ error: "Proposal not found" });
      if (!process.env.OPENAI_API_KEY)
        return res.json({
          ok: false,
          error:
            "AI analysis not configured. Add OPENAI_API_KEY in Render env vars.",
        });
      try {
        const result = await analyzeRoofPhotos(req.body?.imageUrls || []);
        storage.updateProposal(proposal.id, {
          aiRoofAnalysis: JSON.stringify(result),
        } as any);
        res.json({ ok: true, result });
      } catch (error: any) {
        res.json({
          ok: false,
          error: error.message || "Unable to analyze roof photos.",
        });
      }
    },
  );
  app.get(
    "/api/admin/proposals/:id/upgrade-suggestions",
    requireAdmin as any,
    (req, res) => {
      const p = storage.getProposal(Number(req.params.id));
      if (!p) return res.status(404).json({ error: "Not found" });
      res.json(getUpgradeSuggestions(p));
    },
  );
  app.get("/api/proposals/:token/upgrade-suggestions", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(getUpgradeSuggestions(p));
  });
  app.post(
    "/api/admin/proposals/:id/send-prep-email",
    requireAdmin as any,
    async (req, res) => {
      const p = storage.getProposal(Number(req.params.id));
      if (!p) return res.status(404).json({ error: "Not found" });
      if (!p.customerEmail || !p.appointmentDate)
        return res
          .status(400)
          .json({ error: "Customer email and appointment date are required" });
      const result = await sendPrepareForVisitEmail({
        to: p.customerEmail,
        customerName: p.customerName,
        appointmentDate: p.appointmentDate,
        ownerName: p.estimator,
      });
      res.status(result.ok ? 200 : 502).json(result);
    },
  );
  app.get(
    "/api/admin/proposals/:id/email-schedule",
    requireAdmin as any,
    (req, res) => {
      res.json(
        db
          .select()
          .from(emailSchedule)
          .where(eq(emailSchedule.proposalId, Number(req.params.id)))
          .orderBy(desc(emailSchedule.scheduledFor))
          .all(),
      );
    },
  );
  app.delete(
    "/api/admin/email-schedule/:id",
    requireAdmin as any,
    (req, res) => {
      db.update(emailSchedule)
        .set({ status: "cancelled" })
        .where(eq(emailSchedule.id, req.params.id))
        .run();
      res.json({ success: true });
    },
  );

  app.get("/api/admin/proposals/:id/addons", requireAdmin as any, (req, res) =>
    res.json(
      db
        .select()
        .from(upgradeAddons)
        .where(eq(upgradeAddons.proposalId, Number(req.params.id)))
        .all(),
    ),
  );
  app.post(
    "/api/admin/proposals/:id/addons",
    requireAdmin as any,
    (req, res) => {
      const item = db
        .insert(upgradeAddons)
        .values({
          id: randomUUID(),
          proposalId: Number(req.params.id),
          name: req.body.name,
          description: req.body.description || "",
          priceAdd: req.body.priceAdd || "$0",
          selected: req.body.selected ? 1 : 0,
          sortOrder: req.body.sortOrder || 0,
        })
        .returning()
        .get();
      res.status(201).json(item);
    },
  );
  app.patch("/api/admin/addons/:id", requireAdmin as any, (req, res) => {
    const allowed = [
      "name",
      "description",
      "priceAdd",
      "selected",
      "sortOrder",
    ];
    const data = Object.fromEntries(
      Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)),
    );
    const item = db
      .update(upgradeAddons)
      .set(data as any)
      .where(eq(upgradeAddons.id, req.params.id))
      .returning()
      .get();
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });
  app.delete("/api/admin/addons/:id", requireAdmin as any, (req, res) => {
    db.delete(upgradeAddons).where(eq(upgradeAddons.id, req.params.id)).run();
    res.json({ success: true });
  });
  app.get("/api/proposals/:token/addons", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(
      db
        .select()
        .from(upgradeAddons)
        .where(eq(upgradeAddons.proposalId, p.id))
        .all()
        .map(toPublicAddon),
    );
  });
  app.post("/api/proposals/:token/addons/:addonId/toggle", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    const a = db
      .select()
      .from(upgradeAddons)
      .where(eq(upgradeAddons.id, req.params.addonId))
      .get();
    if (!a || a.proposalId !== p.id)
      return res.status(404).json({ error: "Not found" });
    const item = db
      .update(upgradeAddons)
      .set({ selected: a.selected ? 0 : 1 })
      .where(eq(upgradeAddons.id, a.id))
      .returning()
      .get();
    res.json(toPublicAddon(item));
  });

  app.get("/api/admin/crew", requireAdmin as any, (_req, res) =>
    res.json(
      db.select().from(crewMembers).orderBy(crewMembers.sortOrder).all(),
    ),
  );
  app.get("/api/crew", (_req, res) =>
    res.json(
      db
        .select()
        .from(crewMembers)
        .where(eq(crewMembers.active, 1))
        .orderBy(crewMembers.sortOrder)
        .all(),
    ),
  );
  app.post("/api/admin/crew", requireAdmin as any, (req, res) =>
    res.status(201).json(
      db
        .insert(crewMembers)
        .values({
          id: randomUUID(),
          name: req.body.name,
          role: req.body.role,
          bio: req.body.bio,
          photoUrl: req.body.photoUrl || null,
          yearsExperience: Number(req.body.yearsExperience) || 0,
          certifications: req.body.certifications || "",
          sortOrder: Number(req.body.sortOrder) || 0,
          active: req.body.active === false ? 0 : 1,
        })
        .returning()
        .get(),
    ),
  );
  app.patch("/api/admin/crew/:id", requireAdmin as any, (req, res) => {
    const row = db
      .update(crewMembers)
      .set(req.body)
      .where(eq(crewMembers.id, req.params.id))
      .returning()
      .get();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });
  app.delete("/api/admin/crew/:id", requireAdmin as any, (req, res) => {
    db.delete(crewMembers).where(eq(crewMembers.id, req.params.id)).run();
    res.json({ success: true });
  });

  app.get(
    "/api/admin/proposals/:id/timeline",
    requireAdmin as any,
    (req, res) =>
      res.json(
        db
          .select()
          .from(projectTimeline)
          .where(eq(projectTimeline.proposalId, Number(req.params.id)))
          .orderBy(projectTimeline.sortOrder)
          .all(),
      ),
  );
  app.post(
    "/api/admin/proposals/:id/timeline",
    requireAdmin as any,
    (req, res) =>
      res.status(201).json(
        db
          .insert(projectTimeline)
          .values({
            id: randomUUID(),
            proposalId: Number(req.params.id),
            phase: req.body.phase || "before",
            photoUrl: req.body.photoUrl,
            caption: req.body.caption || null,
            photoDate:
              Number(req.body.photoDate) || Math.floor(Date.now() / 1000),
            sortOrder: Number(req.body.sortOrder) || 0,
          })
          .returning()
          .get(),
      ),
  );
  app.patch("/api/admin/timeline/:id", requireAdmin as any, (req, res) => {
    const row = db
      .update(projectTimeline)
      .set(req.body)
      .where(eq(projectTimeline.id, req.params.id))
      .returning()
      .get();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });
  app.delete("/api/admin/timeline/:id", requireAdmin as any, (req, res) => {
    db.delete(projectTimeline)
      .where(eq(projectTimeline.id, req.params.id))
      .run();
    res.json({ success: true });
  });
  app.get("/api/proposals/:token/timeline", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    const publicPhases = new Set(["before", "during", "after", "completed"]);
    res.json(
      db
        .select()
        .from(projectTimeline)
        .where(eq(projectTimeline.proposalId, p.id))
        .orderBy(projectTimeline.sortOrder)
        .all()
        .filter((item) => publicPhases.has(item.phase))
        .map(toPublicTimelineItem),
    );
  });

  function referralCode() {
    return randomBytes(6).toString("base64url").toUpperCase().slice(0, 8);
  }
  app.get("/api/proposals/:token/referrals", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(
      db
        .select()
        .from(referrals)
        .where(eq(referrals.referrerProposalId, p.id))
        .all()
        .map(toPublicReferral),
    );
  });
  app.post("/api/proposals/:token/referrals/init", (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    let row = db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerProposalId, p.id))
      .get();
    if (!row)
      row = db
        .insert(referrals)
        .values({
          id: randomUUID(),
          referrerProposalId: p.id,
          referrerName: p.customerName,
          referrerEmail: p.customerEmail || "",
          refereeName: "Referral link",
          referralCode: referralCode(),
          status: "invited",
        })
        .returning()
        .get();
    res.status(201).json(toPublicReferral(row));
  });
  app.get("/api/admin/referrals", requireAdmin as any, (_req, res) =>
    res.json(
      db.select().from(referrals).orderBy(desc(referrals.createdAt)).all(),
    ),
  );
  app.patch(
    "/api/admin/referrals/:id",
    requireAdmin as any,
    async (req, res) => {
      const old = db
        .select()
        .from(referrals)
        .where(eq(referrals.id, req.params.id))
        .get();
      if (!old) return res.status(404).json({ error: "Not found" });
      const row = db
        .update(referrals)
        .set(req.body)
        .where(eq(referrals.id, old.id))
        .returning()
        .get();
      if (req.body.status === "signed" && old.status !== "signed")
        await sendOwnerNotification(
          "Referral signed",
          `<p>${old.refereeName} has signed a proposal referred by ${old.referrerName}.</p>`,
        );
      res.json(row);
    },
  );
  app.post(
    "/api/admin/referrals/:id/issue-reward",
    requireAdmin as any,
    (req, res) => {
      const row = db
        .update(referrals)
        .set({ rewardIssued: 1 })
        .where(eq(referrals.id, req.params.id))
        .returning()
        .get();
      if (!row) return res.status(404).json({ error: "Not found" });
      res.json(row);
    },
  );
  app.post("/api/referrals/:code", async (req, res) => {
    const seed = db
      .select()
      .from(referrals)
      .where(eq(referrals.referralCode, req.params.code))
      .get();
    if (!seed)
      return res.status(404).json({ error: "Referral link not found" });
    const row = db
      .insert(referrals)
      .values({
        id: randomUUID(),
        referrerProposalId: seed.referrerProposalId,
        referrerName: seed.referrerName,
        referrerEmail: seed.referrerEmail,
        refereeName: req.body.name,
        refereeEmail: req.body.email || null,
        refereePhone: req.body.phone || null,
        refereeAddress: req.body.address || null,
        referralCode: referralCode(),
        status: "invited",
      })
      .returning()
      .get();
    await sendOwnerNotification(
      "New neighbor referral",
      `<p><b>${escapeHtml(req.body.name || "")}</b> was referred by ${escapeHtml(seed.referrerName || "")}.<br>Email: ${escapeHtml(req.body.email || "—")}<br>Phone: ${escapeHtml(req.body.phone || "—")}<br>Address: ${escapeHtml(req.body.address || "—")}</p>`,
    );
    res.status(201).json(row);
  });

  app.post("/api/proposals/:token/warranty/register", async (req, res) => {
    const p = storage.getProposalByToken(req.params.token);
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.warrantyRegisteredAt)
      return res.json({
        success: true,
        alreadyRegistered: true,
        warrantyStartDate: p.warrantyStartDate,
      });
    const start = Math.floor(
      new Date(req.body.installDate || Date.now()).getTime() / 1000,
    );
    storage.updateProposal(p.id, {
      customerName: req.body.name || p.customerName,
      customerEmail: req.body.email || p.customerEmail,
      customerPhone: req.body.phone || p.customerPhone,
      propertyAddress: req.body.propertyAddress || p.propertyAddress,
      warrantyRegisteredAt: Math.floor(Date.now() / 1000),
      warrantyStartDate: start,
    } as any);
    for (const y of [1, 3, 5, 10])
      db.insert(emailSchedule)
        .values({
          id: randomUUID(),
          proposalId: p.id,
          type: `maintenance_y${y}`,
          scheduledFor: start + y * 365 * 86400,
          status: "pending",
        })
        .run();
    if (req.body.email || p.customerEmail)
      await sendWarrantyConfirmation({
        to: req.body.email || p.customerEmail!,
        customerName: req.body.name || p.customerName,
        accessToken: p.accessToken,
      });
    res.json({ success: true, warrantyStartDate: start });
  });
  app.post(
    "/api/proposals/:token/review/private-feedback",
    async (req, res) => {
      try {
        const p = storage.getProposalByToken(req.params.token);
        if (!p) return res.status(404).json({ error: "Not found" });
        const data = reviewSchema.parse({
          ...req.body,
          stars: req.body.stars === undefined ? 0 : Number(req.body.stars),
        });
        const row = db
          .insert(reviews)
          .values({
            id: randomUUID(),
            proposalId: p.id,
            stars: data.stars,
            feedback: data.feedback || null,
            wentPublic: 0,
          })
          .returning()
          .get();
        await sendOwnerNotification(
          "Private project feedback",
          `<p>${escapeHtml(p.customerName)} sent a private note:</p><p>${escapeHtml(row.feedback || "(no message)")}</p>`,
        );
        res.status(201).json(row);
      } catch (e: any) {
        res.status(400).json({ error: e.issues?.[0]?.message || e.message });
      }
    },
  );
  app.post("/api/proposals/:token/review/public", (req, res) => {
    try {
      const p = storage.getProposalByToken(req.params.token);
      if (!p) return res.status(404).json({ error: "Not found" });
      const data = reviewSchema.parse({
        ...req.body,
        stars: req.body.stars === undefined ? 0 : Number(req.body.stars),
      });
      res.status(201).json(
        db
          .insert(reviews)
          .values({
            id: randomUUID(),
            proposalId: p.id,
            stars: data.stars,
            feedback: data.site ? `Opened ${data.site} review link` : data.feedback || null,
            wentPublic: 1,
          })
          .returning()
          .get(),
      );
    } catch (e: any) {
      res.status(400).json({ error: e.issues?.[0]?.message || e.message });
    }
  });

  // ── AI Roof Transformation ──
  // AI image generation requires specialized GPU services not available on this server.
  // Transformations are generated externally and uploaded via the standard image/upload endpoints.
  app.post(
    "/api/admin/generate-transformation",
    requireAdmin as any,
    (_req, res) => {
      res.status(200).json({
        info: true,
        message:
          "AI transformations are processed by McCurdy's AI service. Upload before photos and the AI previews will be generated and added automatically.",
      });
    },
  );

  // Check transformation status (for polling)
  app.get(
    "/api/admin/transformation-status/:proposalId",
    requireAdmin as any,
    (req, res) => {
      try {
        const proposalId = parseInt(req.params.proposalId);
        const images = storage.getImagesByProposal(proposalId);
        const aiImages = images.filter(
          (img: any) =>
            img.imageType === "ai_white" || img.imageType === "ai_gray",
        );
        res.json({ aiImages });
      } catch (e) {
        res.status(500).json({ error: "Server error" });
      }
    },
  );

  // ── Seed demo data ──
  app.post("/api/admin/seed-demo", requireAdmin as any, (_req, res) => {
    try {
      const existing = storage.getProposalByNumber("MCC-2026-0001");
      if (existing)
        return res.json({
          message: "Demo data already exists",
          proposal: existing,
        });
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
    welcomeMessage:
      "Thank you for allowing McCurdy Roofing to evaluate your commercial roofing needs. After a thorough job walk and inspection of your facility, we've prepared this comprehensive roof investment proposal for your review.",
    roofAreas: JSON.stringify([
      "Main warehouse roof — 18,500 sq ft",
      "Office wing — 3,200 sq ft",
      "Loading dock canopy — 1,800 sq ft",
    ]),
    systemType: "Silicone Roof Restoration System",
    scopeSummary:
      "Full silicone roof restoration system over existing modified bitumen membrane. Includes power washing, seam repair, reinforcement of all penetrations and transitions, primer application, and two-coat silicone coating system with 20 dry mil minimum total build.",
    exclusions:
      "Interior repairs, structural modifications, gutter replacement (existing gutters in good condition), HVAC unit replacement or relocation.",
    timelineEstimate: "3-4 weeks from contract signing, weather permitting",
    addOns: JSON.stringify([
      "Additional drain installation (2 units)",
      "Parapet wall cap metal replacement",
      "Skylight re-seal package",
    ]),
    whyRecommended: JSON.stringify([
      "Existing modified bitumen membrane is aged but structurally sound — restoration avoids costly tear-off",
      "Silicone coating provides superior ponding water resistance for your flat roof areas",
      "UV and heat reflectivity will reduce cooling costs during Bay Area summers",
      "20-year NDL warranty available without full roof replacement",
      "Minimal operational disruption — no tear-off noise, no debris, no interior exposure risk",
      "Lifecycle cost savings of 40-60% compared to full replacement",
    ]),
    currentCondition:
      "The existing modified bitumen roof system is approximately 15 years old. While past its expected maintenance cycle, the membrane is intact with no active leaks. Several areas show UV degradation, seam separation beginning at transitions, and moderate ponding in two low areas near the warehouse center. The substrate is solid and suitable for a restoration coating system.",
    keyIssues: JSON.stringify([
      "UV degradation and surface chalking across 60% of membrane",
      "Seam separation beginning at wall-to-roof transitions",
      "Ponding water in two low areas (1-2 inch depth after rain)",
      "Flashing deterioration around 12 rooftop HVAC penetrations",
      "Drain screens clogged — two drains functioning below capacity",
    ]),
    roofSystemType: "McCurdy Silicone Roof Renewal System",
    coatingType: "Premium Silicone Roof Coating",
    primer: "Premium Silicone Primer",
    baseCoat: "Premium Silicone Base Coat",
    topCoat: "Premium Silicone Top Coat",
    reinforcement:
      "Polyester reinforcing fabric at all seams, penetrations, and transitions",
    accessories: JSON.stringify([
      "Silicone sealant/mastic",
      "Polyester fabric rolls",
      "Drain retrofit kits",
      "Flashing membrane",
    ]),
    penetrationsHandling:
      "All 12 HVAC penetrations will receive full fabric reinforcement with 3-course flashing detail. Pipe boots will be replaced where deteriorated.",
    drainageTaper:
      "Two additional drain retrofit kits included in higher-tier options to address ponding areas",
    manufacturerName: "McCurdy-Approved Silicone Manufacturer",
    layerCount: 3,
    primerMils: "2-3 dry mils",
    baseCoatMils: "Varies by warranty tier",
    topCoatMils: "Varies by warranty tier",
    totalDryMils: "20-50 dry mils depending on warranty tier selected",
    milsExplanation:
      "Mil thickness directly determines roof performance and warranty eligibility. The McCurdy Silicone Roof Renewal System is engineered with specific dry mil targets for each warranty tier: 20 mils (5-yr), 26 mils (10-yr), 32 mils (15-yr), 38 mils (20-yr), 44 mils (25-yr), and 50 mils (30-yr). Higher mil builds provide longer protection and greater warranty coverage.",
    recommendedColor: "White (Cool White)",
    alternateColors: JSON.stringify(["Light Gray", "Tan", "Light Blue"]),
    colorNotes:
      "White provides maximum solar reflectivity (SRI 110+) and best energy savings. Meets Title 24 cool roof requirements. Gray and tan are also compliant but with slightly lower reflectivity values.",
    manufacturerWarranty:
      "Manufacturer Warranty — tier based on dry mil build (5 to 30 years)",
    workmanshipWarranty: "McCurdy Roofing Workmanship Warranty",
    ndlWarranty:
      "NDL warranty covers 100% of material and labor costs for the full warranty term with no depreciation or dollar cap. This is the highest level of manufacturer backing available.",
    warrantyTerm: "5 to 30 years based on selected tier",
    warrantySummary:
      "Your roof will be covered by a manufacturer warranty matched to the mil thickness of the system installed, plus a McCurdy Roofing workmanship warranty. Regular maintenance inspections (recommended annually) help preserve full warranty coverage.",
    warrantyMaintenance:
      "Annual inspection recommended. McCurdy offers a maintenance program that includes annual roof inspection, drain clearing, minor touch-up repairs, and warranty compliance documentation.",
    pricingOptions: JSON.stringify([
      {
        name: "5-Year Warranty",
        price: "$4.50/sq ft",
        description:
          "McCurdy Silicone Roof Renewal System with 20 dry mils. Entry-level protection ideal for short-term hold or budget-conscious projects.",
        features: [
          "Full power wash and prep",
          "Primer coat",
          "20 dry mils silicone build",
          "All penetration reinforcement",
          "5-year manufacturer warranty",
        ],
        recommended: false,
      },
      {
        name: "10-Year Warranty",
        price: "$5.50/sq ft",
        description:
          "McCurdy Silicone Roof Renewal System with 26 dry mils. Solid mid-range protection with strong value per year of coverage.",
        features: [
          "Full power wash and prep",
          "Primer coat",
          "26 dry mils silicone build",
          "All penetration reinforcement",
          "10-year manufacturer warranty",
        ],
        recommended: false,
      },
      {
        name: "15-Year Warranty",
        price: "$6.50/sq ft",
        description:
          "McCurdy Silicone Roof Renewal System with 32 dry mils. Best balance of cost and long-term protection.",
        features: [
          "Full power wash and prep",
          "Primer coat",
          "32 dry mils silicone build",
          "All penetration reinforcement",
          "15-year manufacturer warranty",
        ],
        recommended: false,
      },
      {
        name: "20-Year Warranty",
        price: "$8.50/sq ft",
        description:
          "McCurdy Silicone Roof Renewal System with 38 dry mils. Premium protection for owners planning to hold property long-term.",
        features: [
          "Full power wash and prep",
          "Primer coat",
          "38 dry mils silicone build",
          "All penetration reinforcement",
          "Drainage improvements",
          "20-year manufacturer warranty",
        ],
        recommended: true,
      },
      {
        name: "25-Year Warranty",
        price: "$9.50/sq ft",
        description:
          "McCurdy Silicone Roof Renewal System with 44 dry mils. Extended protection with maximum durability for high-value properties.",
        features: [
          "Full power wash and prep",
          "Primer coat",
          "44 dry mils silicone build",
          "All penetration reinforcement",
          "Drainage improvements",
          "Parapet wall treatment",
          "25-year manufacturer warranty",
        ],
        recommended: false,
      },
      {
        name: "30-Year Warranty",
        price: "$10.50/sq ft",
        description:
          "McCurdy Silicone Roof Renewal System with 50 dry mils. The ultimate roof investment — maximum mil build and longest manufacturer warranty available.",
        features: [
          "Full power wash and prep",
          "Primer coat",
          "50 dry mils silicone build",
          "All penetration reinforcement",
          "Drainage improvements",
          "Parapet wall treatment",
          "Skylight re-seal",
          "30-year manufacturer warranty",
          "Priority scheduling",
        ],
        recommended: false,
      },
    ]),
    paymentSchedule:
      "No deposit required. 50% due upon materials loaded on the roof and cleaning & sealing is completed. 50% upon completion of the job. Unless otherwise noted in the proposal revision and agreed upon.",
    financingNotes:
      "Financing available through approved lending partners. Ask about 12-month same-as-cash options for qualified commercial properties.",
  });

  // Seed materials
  const materialData = [
    {
      proposalId: proposal.id,
      manufacturer: "McCurdy-Approved Silicone Manufacturer",
      productName: "Premium Silicone Primer",
      category: "primer",
      usedFor:
        "Surface preparation and adhesion promotion over existing modified bitumen membrane",
      technicalSummary:
        "Single-component moisture-cure primer. VOC compliant. Promotes adhesion of silicone coatings to modified bitumen, metal, and concrete substrates.",
      sortOrder: 1,
    },
    {
      proposalId: proposal.id,
      manufacturer: "McCurdy-Approved Silicone Manufacturer",
      productName: "Premium Silicone Base Coat",
      category: "base_coat",
      usedFor:
        "Primary waterproofing layer applied over primer. Provides base-level protection and fill.",
      technicalSummary:
        "High-solids silicone elastomeric coating. 90%+ solids content. Superior ponding water resistance. Dry mil build varies by warranty tier selected.",
      sortOrder: 2,
    },
    {
      proposalId: proposal.id,
      manufacturer: "McCurdy-Approved Silicone Manufacturer",
      productName: "Premium Silicone Top Coat",
      category: "top_coat",
      usedFor:
        "Final weathering surface. Provides UV protection, reflectivity, and aesthetic finish.",
      technicalSummary:
        "High-solids silicone top coat. Cool-roof rated. SRI 110+ in white. Dry mil build varies by warranty tier selected.",
      sortOrder: 3,
    },
    {
      proposalId: proposal.id,
      manufacturer: "McCurdy-Approved Silicone Manufacturer",
      productName: "Silicone Sealant/Mastic",
      category: "sealant",
      usedFor:
        "Detail work at penetrations, transitions, and repair of existing defects",
      technicalSummary:
        "100% silicone sealant for gap filling and detail work. Compatible with all Premium Silicone system components.",
      sortOrder: 4,
    },
    {
      proposalId: proposal.id,
      manufacturer: "Various",
      productName: "Polyester Reinforcing Fabric",
      category: "reinforcing",
      usedFor:
        "Reinforcement at all seams, penetrations, wall transitions, and stress points",
      technicalSummary:
        "Non-woven polyester fabric embedded between coating layers at detail areas. Provides tensile strength and crack-bridging capability.",
      sortOrder: 5,
    },
    {
      proposalId: proposal.id,
      manufacturer: "Various",
      productName: "Drain Retrofit Kit",
      category: "accessory",
      usedFor:
        "Replacement/upgrade of existing roof drains to improve drainage in ponding areas",
      technicalSummary:
        "Complete drain assembly with new strainer, clamp ring, and membrane connection collar. Sized for existing drain openings.",
      sortOrder: 6,
    },
  ];
  for (const m of materialData) {
    storage.createMaterial(m as any);
  }

  // Seed incentives
  const incentiveData = [
    {
      proposalId: proposal.id,
      programName: "Section 179 Expensing — Commercial Roofs (2026)",
      programType: "tax_deduction",
      applicability:
        "Roofs on nonresidential buildings are qualified real property eligible for Section 179 expensing: up to $2,560,000 for tax years beginning in 2026, phased out above $4,090,000 and limited to business income. Otherwise depreciated over 39 years (MACRS). Section 179D is a separate deduction.",
      officialLink: "https://www.irs.gov/publications/p946",
      notes:
        "Consult your CPA. McCurdy does not provide tax advice. Rules subject to change.",
      lastVerifiedDate: 1768435200,
      sortOrder: 1,
    },
    {
      proposalId: proposal.id,
      programName: "MACRS Depreciation",
      programType: "tax_deduction",
      applicability:
        "If Section 179 does not apply, commercial roof costs may be depreciated under Modified Accelerated Cost Recovery System schedules.",
      officialLink: "https://www.irs.gov/publications/p946",
      notes:
        "Restoration coating systems may qualify for shorter depreciation schedules than full replacement. Ask your tax advisor.",
      lastVerifiedDate: 1768435200,
      sortOrder: 2,
    },
    {
      proposalId: proposal.id,
      programName: "PG&E Business Rebates",
      programType: "rebate",
      applicability:
        "PG&E Business Rebates — programs updated annually. Amount not guaranteed. Check current program list.",
      locationFilter: "PG&E service territory",
      utilityFilter: "PG&E",
      officialLink:
        "https://www.pge.com/en/save-energy-and-money/energy-saving-programs.html",
      notes:
        "Amount varies — check current program page. Verified: 2026-08-19",
      lastVerifiedDate: 1769904000,
      sortOrder: 3,
    },
    {
      proposalId: proposal.id,
      programName: "Title 24 Cool Roof Compliance",
      programType: "compliance",
      applicability:
        "California Title 24 requires minimum solar reflectance and thermal emittance values for roof replacements and alterations on commercial buildings.",
      officialLink:
        "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards",
      notes:
        "The proposed white silicone system exceeds Title 24 cool roof requirements. McCurdy provides compliance documentation.",
      lastVerifiedDate: 1769904000,
      sortOrder: 4,
    },
    {
      proposalId: proposal.id,
      programName: "Commercial Property Financing",
      programType: "financing",
      applicability:
        "Financing options available through approved lending partners for qualified commercial properties.",
      notes:
        "Ask about 12-month same-as-cash options. Roof restoration financing may offer tax-advantaged interest deductions.",
      sortOrder: 5,
    },
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
  alameda: {
    county: "Alameda County",
    climateZone:
      "Climate Zone 3 (Coast) / 12 (Inland — Livermore, Dublin, Pleasanton)",
    utility: "PG&E / East Bay Community Energy (EBCE)",
    programs: [
      {
        name: "PG&E Rebates & Incentives",
        type: "rebate",
        description:
          "PG&E offers rebates for qualifying energy-efficient improvements including cool roof installations in their service territory.",
        link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html",
        notes:
          "Cool roof coatings that meet CRRC standards may qualify. Check current program availability.",
      },
      {
        name: "BayREN Home+ Program",
        type: "rebate",
        description:
          "Bay Area Regional Energy Network offers rebates and low-cost energy assessments for Bay Area homeowners including Alameda County residents.",
        link: "https://www.bayren.org/programs-rebates",
        amount: "Varies by measure",
      },
      {
        name: "BayREN EASE Home Program",
        type: "rebate",
        description:
          "Efficiency and Sustainable Energy program with customer co-pay capped at $1,000 for qualifying weatherization and energy efficiency upgrades.",
        link: "https://www.bayren.org/ease-home",
        amount: "Co-pay capped at $1,000",
      },
      {
        name: "Alameda Municipal Power Rebates",
        type: "utility",
        description:
          "AMP customers can apply for rebates for heat pump HVAC, smart thermostats, electric panel upgrades, and energy efficiency measures.",
        link: "https://www.alamedamp.com/398/Rebates-Programs",
        notes: "Available to City of Alameda residents served by AMP.",
      },
      {
        name: "East Bay Community Energy Programs",
        type: "utility",
        description:
          "EBCE provides clean energy programs and incentives for Alameda County residents and businesses.",
        link: "https://ebce.org/",
        notes: "Check for current commercial building incentives.",
      },
      {
        name: "PACE Financing (CaliforniaFIRST / Ygrene)",
        type: "financing",
        description:
          "Property Assessed Clean Energy financing for energy efficiency improvements including roofing. Repaid through property tax assessment.",
        link: "https://dfpi.ca.gov/consumers/housing/pace/",
        notes: "100% financing available. Attaches to property, not owner.",
      },
      {
        name: "Title 24 Compliance (Zone 3/12)",
        type: "compliance",
        description:
          "Zone 3: No prescriptive cool roof requirement. Zone 12 (inland): Cool roof with SRI ≥16 is one compliance path for steep-slope, SRI ≥75 for low-slope.",
        link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and",
        notes:
          "Requirements depend on roof slope, building type, climate zone, and permit scope. McCurdy provides the coating's CRRC ratings for your permit.",
      },
      {
        name: "California Energy-Smart Homes",
        type: "rebate",
        description:
          "Incentives for whole-building electrification including heat pump systems and energy efficiency upgrades.",
        link: "https://www.smud.org/en/Going-Green/California-Energy-Smart-Homes",
        notes: "Statewide program. May be stackable with utility rebates.",
      },
      {
        name: "Section 179 Deduction (Commercial)",
        type: "tax_deduction",
        description:
          "Commercial property owners may deduct full cost of roof restoration as a business expense in the year completed.",
        link: "https://www.irs.gov/forms-pubs/about-publication-946",
        notes:
          "Roof coating/restoration may qualify as repair expense vs. capital improvement. Consult CPA.",
      },
    ],
  },
  "san-mateo": {
    county: "San Mateo County",
    climateZone: "Climate Zone 3",
    utility: "PG&E / Peninsula Clean Energy (PCE)",
    programs: [
      {
        name: "PG&E Rebates & Incentives",
        type: "rebate",
        description:
          "PG&E offers rebates for qualifying energy-efficient improvements including cool roof installations.",
        link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html",
      },
      {
        name: "Peninsula Clean Energy (PCE) Rebates",
        type: "utility",
        description:
          "PCE customers can apply for rebates for heat pump water heaters, heat pump HVACs, electric panel upgrades. PCE also offers zero percent loans up to $10,000 for energy upgrades.",
        link: "https://www.peninsulacleanenergy.com/residents/",
        amount: "Up to $10,000 at 0% interest",
      },
      {
        name: "PCE Home Upgrade Services",
        type: "utility",
        description:
          "Income-qualified residents may receive no-cost upgrades to convert outdated gas appliances to safer, healthier, more energy-efficient options.",
        link: "https://www.peninsulacleanenergy.com/residents/",
        notes: "Income-qualified program.",
      },
      {
        name: "BayREN Home+ Program",
        type: "rebate",
        description:
          "Bay Area Regional Energy Network offers rebates and low-cost energy assessments for Bay Area homeowners.",
        link: "https://www.bayren.org/programs-rebates",
      },
      {
        name: "BayREN EASE Home Program",
        type: "rebate",
        description:
          "Weatherization and energy efficiency upgrades with customer co-pay capped at $1,000.",
        link: "https://www.bayren.org/ease-home",
        amount: "Co-pay capped at $1,000",
      },
      {
        name: "PACE Financing",
        type: "financing",
        description:
          "Property Assessed Clean Energy financing for roofing and energy improvements. Repaid through property tax.",
        link: "https://dfpi.ca.gov/consumers/housing/pace/",
      },
      {
        name: "GoGreen Financing",
        type: "financing",
        description:
          "PG&E customers can finance up to 100% of energy upgrade costs through approved lenders.",
        link: "https://gogreenfinancing.com/",
        notes:
          "Covers building envelope, energy efficiency, and clean energy improvements.",
      },
      {
        name: "Title 24 Compliance (Zone 3)",
        type: "compliance",
        description:
          "Climate Zone 3 has no prescriptive cool roof requirement for steep-slope residential. Low-slope commercial: SRI ≥75 or aged SR ≥0.63 with TE ≥0.75.",
        link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and",
      },
      {
        name: "Section 179 Deduction (Commercial)",
        type: "tax_deduction",
        description:
          "Commercial owners may deduct full roof restoration cost as business expense.",
        link: "https://www.irs.gov/forms-pubs/about-publication-946",
      },
    ],
  },
  "san-francisco": {
    county: "San Francisco County",
    climateZone: "Climate Zone 3",
    utility: "PG&E / CleanPowerSF",
    programs: [
      {
        name: "PG&E Rebates & Incentives",
        type: "rebate",
        description:
          "PG&E offers rebates for qualifying energy-efficient improvements.",
        link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html",
      },
      {
        name: "CleanPowerSF",
        type: "utility",
        description:
          "San Francisco's community choice energy program providing clean energy. Check for available incentive programs.",
        link: "https://www.cleanpowersf.org/",
        notes:
          "Provides 100% renewable electricity. Check for building upgrade incentives.",
      },
      {
        name: "SF Environment Energy Programs",
        type: "rebate",
        description:
          "San Francisco Department of Environment offers programs for energy efficiency, green building, and climate action.",
        link: "https://sfenvironment.org/energy",
        notes:
          "Includes commercial and residential energy efficiency resources.",
      },
      {
        name: "BayREN Home+ Program",
        type: "rebate",
        description:
          "Rebates and energy assessments for San Francisco homeowners through the Bay Area Regional Energy Network.",
        link: "https://www.bayren.org/programs-rebates",
      },
      {
        name: "BayREN EASE Home Program",
        type: "rebate",
        description: "Weatherization upgrades with co-pay capped at $1,000.",
        link: "https://www.bayren.org/ease-home",
        amount: "Co-pay capped at $1,000",
      },
      {
        name: "PACE Financing",
        type: "financing",
        description:
          "Property Assessed Clean Energy financing for energy improvements.",
        link: "https://dfpi.ca.gov/consumers/housing/pace/",
      },
      {
        name: "Title 24 Compliance (Zone 3)",
        type: "compliance",
        description:
          "Climate Zone 3: No prescriptive cool roof requirement for steep-slope residential. Low-slope commercial buildings: SRI ≥75.",
        link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and",
      },
      {
        name: "Section 179 Deduction (Commercial)",
        type: "tax_deduction",
        description:
          "Commercial owners may deduct full roof restoration cost as business expense.",
        link: "https://www.irs.gov/forms-pubs/about-publication-946",
      },
    ],
  },
  stanislaus: {
    county: "Stanislaus County",
    climateZone: "Climate Zone 12",
    utility:
      "PG&E / Turlock Irrigation District (TID) / Modesto Irrigation District (MID)",
    programs: [
      {
        name: "PG&E Rebates & Incentives",
        type: "rebate",
        description:
          "PG&E customers can access rebates for energy-efficient improvements.",
        link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html",
      },
      {
        name: "Turlock Irrigation District (TID) Rebates",
        type: "utility",
        description:
          "TID offers energy efficiency rebates for customers in the Turlock area including HVAC and insulation programs.",
        link: "https://www.tid.org/customer-service/save-energy-money/rebates/",
        notes: "Check for current cool roof or energy efficiency rebates.",
      },
      {
        name: "Modesto Irrigation District (MID) Programs",
        type: "utility",
        description:
          "MID provides energy efficiency programs and rebates for commercial and residential customers.",
        link: "https://www.mid.org/rebates/",
        notes: "Available to MID service territory customers.",
      },
      {
        name: "San Joaquin Valley Air Pollution Control District",
        type: "rebate",
        description:
          "SJVAPCD offers various incentive programs for air quality improvements in the San Joaquin Valley air basin.",
        link: "https://www.valleyair.org/grants/",
        notes:
          "Programs may include energy efficiency incentives that complement roofing upgrades.",
      },
      {
        name: "PACE Financing",
        type: "financing",
        description:
          "Property Assessed Clean Energy financing available for energy improvements.",
        link: "https://dfpi.ca.gov/consumers/housing/pace/",
      },
      {
        name: "Title 24 Compliance (Zone 12)",
        type: "compliance",
        description:
          "Climate Zone 12 requires cool roof compliance: steep-slope SRI ≥16 or aged SR ≥0.20 with TE ≥0.75. Low-slope: SRI ≥75 or aged SR ≥0.63 with TE ≥0.75. Alternative: additional insulation or radiant barrier.",
        link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and",
        notes:
          "Silicone coating systems exceed Zone 12 requirements with SRI 110+.",
      },
      {
        name: "Section 179 Deduction (Commercial)",
        type: "tax_deduction",
        description:
          "Commercial owners may deduct full roof restoration cost as business expense.",
        link: "https://www.irs.gov/forms-pubs/about-publication-946",
      },
      {
        name: "Energy Upgrade California",
        type: "rebate",
        description:
          "Statewide program offering incentives for home improvements including energy-efficient roofing.",
        link: "https://www.energyupgradeca.org/",
        amount: "Up to $5,000 for combined upgrades",
      },
    ],
  },
  "san-joaquin": {
    county: "San Joaquin County",
    climateZone: "Climate Zone 12",
    utility: "PG&E",
    programs: [
      {
        name: "PG&E Rebates & Incentives",
        type: "rebate",
        description:
          "PG&E offers rebates for energy-efficient improvements including cool roof installations.",
        link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html",
      },
      {
        name: "San Joaquin Valley Air Pollution Control District",
        type: "rebate",
        description:
          "SJVAPCD administers various incentive programs for San Joaquin Valley residents to improve air quality.",
        link: "https://www.valleyair.org/grants/",
        notes:
          "Includes programs for residential energy efficiency improvements.",
      },
      {
        name: "Drive Clean in the San Joaquin",
        type: "rebate",
        description:
          "SJVAPCD vehicle rebate program for Valley residents — up to $3,000 for clean vehicles.",
        link: "https://www.valleyair.org/grants/drive-clean-in-the-san-joaquin/rebate/",
        notes:
          "Vehicle program — complementary savings for property owners investing in energy efficiency.",
      },
      {
        name: "PACE Financing",
        type: "financing",
        description:
          "Property Assessed Clean Energy financing for roofing and energy improvements.",
        link: "https://dfpi.ca.gov/consumers/housing/pace/",
      },
      {
        name: "GoGreen Financing",
        type: "financing",
        description:
          "PG&E customers can finance up to 100% of energy upgrade costs.",
        link: "https://gogreenfinancing.com/",
      },
      {
        name: "Title 24 Compliance (Zone 12)",
        type: "compliance",
        description:
          "Climate Zone 12 has prescriptive cool roof requirements. Steep-slope: SRI ≥16. Low-slope: SRI ≥75. Compliance is confirmed for your specific roof and permit.",
        link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and",
        notes:
          "Zone 12 is a mandatory cool roof zone. McCurdy systems are fully compliant.",
      },
      {
        name: "Section 179 Deduction (Commercial)",
        type: "tax_deduction",
        description:
          "Commercial owners may deduct full roof restoration cost as business expense.",
        link: "https://www.irs.gov/forms-pubs/about-publication-946",
      },
      {
        name: "Energy Upgrade California",
        type: "rebate",
        description:
          "Statewide incentives for home improvements including energy-efficient roofing.",
        link: "https://www.energyupgradeca.org/",
        amount: "Up to $5,000 for combined upgrades",
      },
    ],
  },
  "contra-costa": {
    county: "Contra Costa County",
    climateZone:
      "Climate Zone 3 (Coast — Richmond, Hercules) / 12 (Inland — Concord, Walnut Creek, Antioch)",
    utility: "PG&E / MCE (Marin Clean Energy)",
    programs: [
      {
        name: "PG&E Rebates & Incentives",
        type: "rebate",
        description: "PG&E offers rebates for energy-efficient improvements.",
        link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html",
      },
      {
        name: "MCE (Marin Clean Energy) Programs",
        type: "utility",
        description:
          "MCE customers can get bill credits for solar storage and excess solar energy. Income-qualified customers can receive free home energy assessments and upgrades.",
        link: "https://www.mcecleanenergy.org/",
        notes:
          "Available to MCE service territory customers in Contra Costa County.",
      },
      {
        name: "BayREN Home+ Program",
        type: "rebate",
        description:
          "Bay Area Regional Energy Network rebates and energy assessments for Contra Costa County homeowners.",
        link: "https://www.bayren.org/programs-rebates",
      },
      {
        name: "BayREN EASE Home Program",
        type: "rebate",
        description:
          "Weatherization and efficiency upgrades with co-pay capped at $1,000.",
        link: "https://www.bayren.org/ease-home",
        amount: "Co-pay capped at $1,000",
      },
      {
        name: "Contra Costa Water District Rebates",
        type: "rebate",
        description:
          "CCWD offers rebates for water-saving measures including smart irrigation and landscape conversion.",
        link: "https://www.ccwater.com/358/Rebates",
        notes: "Complementary water savings when upgrading building systems.",
      },
      {
        name: "PACE Financing",
        type: "financing",
        description:
          "Property Assessed Clean Energy financing for energy improvements.",
        link: "https://dfpi.ca.gov/consumers/housing/pace/",
      },
      {
        name: "GoGreen Financing",
        type: "financing",
        description:
          "Finance up to 100% of energy upgrade costs through approved PG&E partner lenders.",
        link: "https://gogreenfinancing.com/",
      },
      {
        name: "Title 24 Compliance (Zone 3/12)",
        type: "compliance",
        description:
          "Coastal Zone 3: No prescriptive cool roof requirement for steep-slope. Inland Zone 12: SRI ≥16 steep-slope, SRI ≥75 low-slope. Compliance is confirmed for your specific roof and permit.",
        link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and",
      },
      {
        name: "Section 179 Deduction (Commercial)",
        type: "tax_deduction",
        description:
          "Commercial owners may deduct full roof restoration cost as business expense.",
        link: "https://www.irs.gov/forms-pubs/about-publication-946",
      },
    ],
  },
  solano: {
    county: "Solano County",
    climateZone: "Climate Zone 12",
    utility: "PG&E / MCE (Marin Clean Energy)",
    programs: [
      {
        name: "PG&E Rebates & Incentives",
        type: "rebate",
        description: "PG&E offers rebates for energy-efficient improvements.",
        link: "https://www.pge.com/en/save-energy-and-money/rebates-and-incentives.html",
      },
      {
        name: "MCE (Marin Clean Energy) Programs",
        type: "utility",
        description:
          "MCE customers in Solano County can get bill credits for solar storage and free home energy assessments for income-qualified customers.",
        link: "https://www.mcecleanenergy.org/",
        notes: "MCE serves portions of Solano County.",
      },
      {
        name: "Solano County Energy Resources",
        type: "rebate",
        description:
          "Solano County provides information on rebates and financial support programs for energy efficiency, generation, and storage.",
        link: "https://www.solanocounty.gov/government/resource-management/planning-services/environmental-management-sustainability/energy-resources",
        notes: "County resource hub with links to available programs.",
      },
      {
        name: "BayREN Programs",
        type: "rebate",
        description:
          "Bay Area Regional Energy Network programs available for Solano County residents.",
        link: "https://www.bayren.org/programs-rebates",
      },
      {
        name: "PACE Financing",
        type: "financing",
        description:
          "Property Assessed Clean Energy financing for energy improvements including roofing.",
        link: "https://dfpi.ca.gov/consumers/housing/pace/",
      },
      {
        name: "GoGreen Financing",
        type: "financing",
        description:
          "PG&E customers can finance up to 100% of energy upgrade costs.",
        link: "https://gogreenfinancing.com/",
      },
      {
        name: "Title 24 Compliance (Zone 12)",
        type: "compliance",
        description:
          "Climate Zone 12 requires cool roof compliance. Steep-slope: SRI ≥16. Low-slope: SRI ≥75. Silicone coating systems meet and exceed these requirements.",
        link: "https://www.energy.ca.gov/programs-and-topics/programs/building-energy-efficiency-standards/climate-zone-tool-maps-and",
        notes: "Zone 12 is a mandatory cool roof zone.",
      },
      {
        name: "Section 179 Deduction (Commercial)",
        type: "tax_deduction",
        description:
          "Commercial owners may deduct full roof restoration cost as business expense.",
        link: "https://www.irs.gov/forms-pubs/about-publication-946",
      },
      {
        name: "Energy Upgrade California",
        type: "rebate",
        description:
          "Statewide incentives for energy-efficient home improvements.",
        link: "https://www.energyupgradeca.org/",
        amount: "Up to $5,000 for combined upgrades",
      },
    ],
  },
};

function getCountyIncentives(county: string): CountyIncentive | null {
  return COUNTY_INCENTIVES[county] || null;
}

function getAllCountyIncentives(): CountyIncentive[] {
  return Object.values(COUNTY_INCENTIVES);
}
