import type { Express, NextFunction, Request, Response } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertProposalSchema, insertMaterialSchema, insertProposalImageSchema, insertIncentiveSchema, insertWarrantyDocumentSchema, insertDocumentSchema, insertActivityEventSchema, insertCustomerMessageSchema, insertChangeOrderSchema, emailSchedule, upgradeAddons, crewMembers, projectTimeline, referrals, reviews } from "@shared/schema";
import { sqliteConnection, db } from "./db";
import { getCountyFromDb, getAllCountiesFromDb } from "./incentive-refresh";
import { manualRefresh } from "./incentive-scheduler";
import { sendProposalEmail, sendSignedNotificationToOwner, sendChangeOrderEmail, sendChangeOrderAcceptedNotificationToOwner, sendPrepareForVisitEmail, sendOwnerNotification, sendWarrantyConfirmation } from "./proposal-email";
import { analyzeRoofPhotos } from "./ai-roof-analysis";
import { getUpgradeSuggestions } from "./upgrade-engine";
import { eq, desc } from "drizzle-orm";
import { randomBytes, randomUUID } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
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

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const ADMIN_KEY = process.env.ADMIN_KEY;
  if (!ADMIN_KEY) {
    return res.status(500).json({ error: "Server misconfigured: ADMIN_KEY not set" });
  }
  const provided = req.header("X-Admin-Key");
  if (!provided || provided !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

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

  // Get change orders for a customer proposal
  app.get("/api/proposals/:token/change-orders", (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });
      res.json(storage.getChangeOrdersByProposal(String(proposal.id)).map(toPublicChangeOrder));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Customer accepts a pending change order with an e-signature
  app.post("/api/proposals/:token/change-orders/:coId/accept", async (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });
      const changeOrder = storage.getChangeOrder(req.params.coId);
      if (!changeOrder || changeOrder.proposalId !== String(proposal.id)) {
        return res.status(404).json({ error: "Change order not found" });
      }
      if (changeOrder.status !== "pending") {
        return res.status(400).json({ error: "This change order is no longer awaiting approval" });
      }

      const { signedByName, customerSignature } = req.body || {};
      if (!signedByName || !customerSignature) {
        return res.status(400).json({ error: "Name and signature are required" });
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
        eventData: JSON.stringify({ changeOrderId: changeOrder.id, title: changeOrder.title, signedByName }),
        ipAddress: req.ip || null,
        userAgent: req.get("user-agent") || null,
        createdAt: new Date().toISOString(),
      } as any);
      sendChangeOrderAcceptedNotificationToOwner({
        changeOrder: { ...changeOrder, signedByName },
        proposal,
      }).catch(err => console.error("[change-order] owner notification failed:", err));
      res.json({ success: true, changeOrder: updated ? toPublicChangeOrder(updated) : null });
    } catch (e: any) {
      console.error("[change-order] acceptance error:", e);
      res.status(500).json({ error: e.message || "Server error" });
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
      const proposal = storage.updateProposal(parseInt(req.params.id), req.body);
      if (!proposal) return res.status(404).json({ error: "Not found" });
      if (req.body?.workCompletedDate) {
        const existingReview = db.select().from(emailSchedule).where(eq(emailSchedule.proposalId, proposal.id)).all().some(item => item.type === "review_request");
        if (!existingReview) {
          const completed = Math.floor(new Date(req.body.workCompletedDate).getTime() / 1000) || Math.floor(Date.now() / 1000);
          db.insert(emailSchedule).values({ id: randomUUID(), proposalId: proposal.id, type: "review_request", scheduledFor: completed + 3 * 86400, status: "pending" }).run();
        }
      }
      res.json(proposal);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Failed to update" });
    }
  });

  // ── Change Orders CRUD ──
  app.get("/api/admin/proposals/:id/change-orders", requireAdmin as any, (req, res) => {
    try {
      const proposal = storage.getProposal(parseInt(req.params.id));
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      res.json(storage.getChangeOrdersByProposal(String(proposal.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/admin/proposals/:id/change-orders", requireAdmin as any, (req, res) => {
    try {
      const proposal = storage.getProposal(parseInt(req.params.id));
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      const parsed = insertChangeOrderSchema.parse({ ...req.body, proposalId: String(proposal.id) });
      const changeOrder = storage.createChangeOrder(parsed);
      storage.createActivity({
        proposalId: proposal.id,
        eventType: "change_order_created",
        eventData: JSON.stringify({ changeOrderId: changeOrder.id, title: changeOrder.title, amount: changeOrder.amount, type: changeOrder.type }),
        ipAddress: req.ip || null,
        userAgent: req.get("user-agent") || null,
        createdAt: new Date().toISOString(),
      } as any);
      res.status(201).json(changeOrder);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Unable to create change order" });
    }
  });

  app.patch("/api/admin/change-orders/:coId", requireAdmin as any, (req, res) => {
    try {
      const existing = storage.getChangeOrder(req.params.coId);
      if (!existing) return res.status(404).json({ error: "Change order not found" });
      const allowed = ["title", "description", "amount", "type", "status"] as const;
      const updates = Object.fromEntries(
        Object.entries(req.body || {}).filter(([key]) => allowed.includes(key as typeof allowed[number])),
      );
      const changeOrder = storage.updateChangeOrder(existing.id, updates as any);
      res.json(changeOrder);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Unable to update change order" });
    }
  });

  app.delete("/api/admin/change-orders/:coId", requireAdmin as any, (req, res) => {
    try {
      const existing = storage.getChangeOrder(req.params.coId);
      if (!existing) return res.status(404).json({ error: "Change order not found" });
      storage.deleteChangeOrder(existing.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/admin/change-orders/:coId/send", requireAdmin as any, async (req, res) => {
    try {
      const changeOrder = storage.getChangeOrder(req.params.coId);
      if (!changeOrder) return res.status(404).json({ error: "Change order not found" });
      const proposal = storage.getProposal(parseInt(changeOrder.proposalId));
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });
      const to = String(req.body?.email || proposal.customerEmail || proposal.lastSentTo || "").trim();
      if (!/^\S+@\S+\.\S+$/.test(to)) return res.status(400).json({ error: "A valid customer email is required" });
      const result = await sendChangeOrderEmail({ to, changeOrder, proposal, ownerName: proposal.estimator || "Mike Schirmer" });
      if (!result.ok) return res.status(502).json({ error: result.error || "Unable to send email" });
      const sentAt = Math.floor(Date.now() / 1000);
      const updated = storage.updateChangeOrder(changeOrder.id, { sentAt });
      storage.createActivity({
        proposalId: proposal.id,
        eventType: "change_order_sent",
        eventData: JSON.stringify({ changeOrderId: changeOrder.id, sentTo: to }),
        ipAddress: req.ip || null,
        userAgent: req.get("user-agent") || null,
        createdAt: new Date().toISOString(),
      } as any);
      res.json({ success: true, sentTo: to, changeOrder: updated, messageId: result.id });
    } catch (e: any) {
      console.error("[change-order] send error:", e);
      res.status(500).json({ error: e.message || "Server error" });
    }
  });

  // Send proposal to customer via email (Resend)
  app.post("/api/admin/proposals/:id/send-email", requireAdmin as any, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const proposal = storage.getProposal(id);
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });

      // Allow override email in body, else use stored customerEmail
      const toEmail: string = (req.body?.email || (proposal as any).customerEmail || "").trim();
      if (!toEmail) return res.status(400).json({ error: "No email address provided" });
      if (!/^\S+@\S+\.\S+$/.test(toEmail)) return res.status(400).json({ error: "Invalid email address" });

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
      for (const [type, days] of [["day1", 1], ["day3", 3], ["day7", 7], ["day14", 14]] as const) {
        const exists = db.select().from(emailSchedule).where(eq(emailSchedule.proposalId, id)).all().some(row => row.type === type);
        if (!exists) db.insert(emailSchedule).values({ id: randomUUID(), proposalId: id, type, scheduledFor: sentAt + days * 86400, status: "pending" }).run();
      }

      res.json({ success: true, sentTo: toEmail, messageId: result.id });
    } catch (e: any) {
      console.error("[send-email] Error:", e);
      res.status(500).json({ error: e.message || "Server error" });
    }
  });

  // Customer signs & approves — called from customer portal
  app.post("/api/proposals/:token/sign", async (req, res) => {
    try {
      const proposal = storage.getProposalByToken(req.params.token);
      if (!proposal) return res.status(404).json({ error: "Not found" });

      const { signature, signedByName, signedByTitle, approvedOption, requestedStartDate } = req.body || {};
      if (!signature || !signedByName) {
        return res.status(400).json({ error: "Signature and name are required" });
      }

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
          eventData: JSON.stringify({ signedByName, approvedOption, requestedStartDate }),
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
      }).catch(err => console.error("[sign] notify owner failed:", err));

      res.json({ success: true, proposal: updated ? toPublicProposal(updated) : null });
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
  app.get("/api/admin/proposals/:id/materials", requireAdmin as any, (req, res) => {
    try {
      res.json(storage.getMaterialsByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

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
  app.get("/api/admin/proposals/:id/images", requireAdmin as any, (req, res) => {
    try {
      res.json(storage.getImagesByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

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

  app.delete("/api/admin/warranty-docs/:id", requireAdmin as any, (req, res) => {
    try {
      storage.deleteWarrantyDoc(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Documents CRUD ──
  app.get("/api/admin/proposals/:id/documents", requireAdmin as any, (req, res) => {
    try {
      res.json(storage.getDocumentsByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/admin/proposals/:id/warranty-docs", requireAdmin as any, (req, res) => {
    try {
      res.json(storage.getWarrantyDocsByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

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

  app.get("/api/admin/proposals/:id/activities", requireAdmin as any, (req, res) => {
    try {
      res.json(storage.getActivitiesByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── Customer Messages ──
  app.get("/api/admin/messages", requireAdmin as any, (_req, res) => {
    try {
      res.json(storage.getAllMessages());
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/admin/proposals/:id/messages", requireAdmin as any, (req, res) => {
    try {
      res.json(storage.getMessagesByProposal(parseInt(req.params.id)));
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch("/api/admin/messages/:id/read", requireAdmin as any, (req, res) => {
    try {
      storage.markMessageRead(parseInt(req.params.id));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ── File Upload ──
  app.post("/api/admin/upload", requireAdmin as any, upload.single("file"), (req, res) => {
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

  // Upsert a single county's incentive data (used by scheduled task runner)
  app.post("/api/admin/upsert-county", requireAdmin as any, (req, res) => {
    try {
      const body = req.body || {};
      const { county, climateZone, utility, programs } = body;
      const countyKey = (body.countyKey || county || "").toString().toLowerCase().replace(/\s+/g, "-").replace(/-county$/, "");
      if (!countyKey || !county || !Array.isArray(programs) || programs.length === 0) {
        return res.status(400).json({ error: "Missing required fields: county, programs[]" });
      }
      const now = new Date().toISOString();
      const taxYear = body.taxYear || new Date().getFullYear();
      sqliteConnection.prepare(`
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
        countyKey,
        county,
        climateZone || "",
        utility || "",
        JSON.stringify(programs),
        taxYear,
        now,
        now,
        JSON.stringify(body.sources || [])
      );
      res.json({ success: true, countyKey, programsCount: programs.length, taxYear });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.post("/api/admin/refresh-incentives", requireAdmin as any, async (req, res) => {
    try {
      const taxYear = req.body?.taxYear ? parseInt(req.body.taxYear, 10) : undefined;
      const report = await manualRefresh(sqliteConnection, taxYear);
      res.json({ success: true, report });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/api/admin/refresh-log", requireAdmin as any, (_req, res) => {
    try {
      const rows = sqliteConnection.prepare(
        "SELECT run_id, run_at, run_type, county_key, status, changes_json, error_message, tax_year FROM incentive_refresh_log ORDER BY run_at DESC LIMIT 100"
      ).all();
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // ── Mega-build routes ─────────────────────────────────────
  app.post("/api/admin/proposals/:id/analyze-roof", requireAdmin as any, async (req, res) => {
    const proposal = storage.getProposal(Number(req.params.id));
    if (!proposal) return res.status(404).json({ error: "Proposal not found" });
    if (!process.env.OPENAI_API_KEY) return res.json({ ok: false, error: "AI analysis not configured. Add OPENAI_API_KEY in Render env vars." });
    try { const result = await analyzeRoofPhotos(req.body?.imageUrls || []); storage.updateProposal(proposal.id, { aiRoofAnalysis: JSON.stringify(result) } as any); res.json({ ok: true, result }); }
    catch (error: any) { res.json({ ok: false, error: error.message || "Unable to analyze roof photos." }); }
  });
  app.get("/api/admin/proposals/:id/upgrade-suggestions", requireAdmin as any, (req,res) => { const p=storage.getProposal(Number(req.params.id)); if(!p) return res.status(404).json({error:"Not found"}); res.json(getUpgradeSuggestions(p)); });
  app.get("/api/proposals/:token/upgrade-suggestions", (req,res) => { const p=storage.getProposalByToken(req.params.token); if(!p) return res.status(404).json({error:"Not found"}); res.json(getUpgradeSuggestions(p)); });
  app.post("/api/admin/proposals/:id/send-prep-email", requireAdmin as any, async (req,res) => { const p=storage.getProposal(Number(req.params.id)); if(!p) return res.status(404).json({error:"Not found"}); if(!p.customerEmail || !p.appointmentDate) return res.status(400).json({error:"Customer email and appointment date are required"}); const result=await sendPrepareForVisitEmail({to:p.customerEmail,customerName:p.customerName,appointmentDate:p.appointmentDate,ownerName:p.estimator}); res.status(result.ok?200:502).json(result); });
  app.get("/api/admin/proposals/:id/email-schedule", requireAdmin as any, (req,res) => { res.json(db.select().from(emailSchedule).where(eq(emailSchedule.proposalId,Number(req.params.id))).orderBy(desc(emailSchedule.scheduledFor)).all()); });
  app.delete("/api/admin/email-schedule/:id", requireAdmin as any, (req,res) => { db.update(emailSchedule).set({status:"cancelled"}).where(eq(emailSchedule.id,req.params.id)).run(); res.json({success:true}); });

  app.get("/api/admin/proposals/:id/addons", requireAdmin as any, (req,res) => res.json(db.select().from(upgradeAddons).where(eq(upgradeAddons.proposalId,Number(req.params.id))).all()));
  app.post("/api/admin/proposals/:id/addons", requireAdmin as any, (req,res) => { const item=db.insert(upgradeAddons).values({id:randomUUID(),proposalId:Number(req.params.id),name:req.body.name,description:req.body.description || "",priceAdd:req.body.priceAdd || "$0",selected:req.body.selected ? 1:0,sortOrder:req.body.sortOrder || 0}).returning().get();res.status(201).json(item); });
  app.patch("/api/admin/addons/:id", requireAdmin as any, (req,res) => { const allowed=["name","description","priceAdd","selected","sortOrder"];const data=Object.fromEntries(Object.entries(req.body || {}).filter(([k])=>allowed.includes(k)));const item=db.update(upgradeAddons).set(data as any).where(eq(upgradeAddons.id,req.params.id)).returning().get(); if(!item) return res.status(404).json({error:"Not found"});res.json(item); });
  app.delete("/api/admin/addons/:id", requireAdmin as any, (req,res) => { db.delete(upgradeAddons).where(eq(upgradeAddons.id,req.params.id)).run();res.json({success:true}); });
  app.get("/api/proposals/:token/addons", (req,res) => {const p=storage.getProposalByToken(req.params.token);if(!p)return res.status(404).json({error:"Not found"});res.json(db.select().from(upgradeAddons).where(eq(upgradeAddons.proposalId,p.id)).all().map(toPublicAddon));});
  app.post("/api/proposals/:token/addons/:addonId/toggle", (req,res) => { const p=storage.getProposalByToken(req.params.token);if(!p)return res.status(404).json({error:"Not found"});const a=db.select().from(upgradeAddons).where(eq(upgradeAddons.id,req.params.addonId)).get();if(!a || a.proposalId!==p.id)return res.status(404).json({error:"Not found"});const item=db.update(upgradeAddons).set({selected:a.selected?0:1}).where(eq(upgradeAddons.id,a.id)).returning().get();res.json(toPublicAddon(item)); });

  app.get("/api/admin/crew", requireAdmin as any, (_req,res) => res.json(db.select().from(crewMembers).orderBy(crewMembers.sortOrder).all()));
  app.get("/api/crew", (_req,res) => res.json(db.select().from(crewMembers).where(eq(crewMembers.active,1)).orderBy(crewMembers.sortOrder).all()));
  app.post("/api/admin/crew", requireAdmin as any, (req,res) => res.status(201).json(db.insert(crewMembers).values({id:randomUUID(),name:req.body.name,role:req.body.role,bio:req.body.bio,photoUrl:req.body.photoUrl || null,yearsExperience:Number(req.body.yearsExperience)||0,certifications:req.body.certifications||"",sortOrder:Number(req.body.sortOrder)||0,active:req.body.active === false ? 0:1}).returning().get()));
  app.patch("/api/admin/crew/:id", requireAdmin as any, (req,res) => {const row=db.update(crewMembers).set(req.body).where(eq(crewMembers.id,req.params.id)).returning().get();if(!row)return res.status(404).json({error:"Not found"});res.json(row);});
  app.delete("/api/admin/crew/:id", requireAdmin as any, (req,res) => {db.delete(crewMembers).where(eq(crewMembers.id,req.params.id)).run();res.json({success:true});});

  app.get("/api/admin/proposals/:id/timeline", requireAdmin as any, (req,res) => res.json(db.select().from(projectTimeline).where(eq(projectTimeline.proposalId,Number(req.params.id))).orderBy(projectTimeline.sortOrder).all()));
  app.post("/api/admin/proposals/:id/timeline", requireAdmin as any, (req,res) => res.status(201).json(db.insert(projectTimeline).values({id:randomUUID(),proposalId:Number(req.params.id),phase:req.body.phase || "before",photoUrl:req.body.photoUrl,caption:req.body.caption || null,photoDate:Number(req.body.photoDate)||Math.floor(Date.now()/1000),sortOrder:Number(req.body.sortOrder)||0}).returning().get()));
  app.patch("/api/admin/timeline/:id", requireAdmin as any, (req,res) => {const row=db.update(projectTimeline).set(req.body).where(eq(projectTimeline.id,req.params.id)).returning().get();if(!row)return res.status(404).json({error:"Not found"});res.json(row);});
  app.delete("/api/admin/timeline/:id", requireAdmin as any, (req,res) => {db.delete(projectTimeline).where(eq(projectTimeline.id,req.params.id)).run();res.json({success:true});});
  app.get("/api/proposals/:token/timeline", (req,res) => {const p=storage.getProposalByToken(req.params.token);if(!p)return res.status(404).json({error:"Not found"});const publicPhases=new Set(["before","during","after","completed"]);res.json(db.select().from(projectTimeline).where(eq(projectTimeline.proposalId,p.id)).orderBy(projectTimeline.sortOrder).all().filter(item=>publicPhases.has(item.phase)).map(toPublicTimelineItem));});

  function referralCode() { return randomBytes(6).toString("base64url").toUpperCase().slice(0,8); }
  app.get("/api/proposals/:token/referrals", (req,res) => {const p=storage.getProposalByToken(req.params.token);if(!p)return res.status(404).json({error:"Not found"});let rows=db.select().from(referrals).where(eq(referrals.referrerProposalId,p.id)).all();if(!rows.length){const row=db.insert(referrals).values({id:randomUUID(),referrerProposalId:p.id,referrerName:p.customerName,referrerEmail:p.customerEmail || "",refereeName:"Referral link",referralCode:referralCode(),status:"invited"}).returning().get();rows=[row];}res.json(rows.map(toPublicReferral));});
  app.get("/api/admin/referrals", requireAdmin as any, (_req,res) => res.json(db.select().from(referrals).orderBy(desc(referrals.createdAt)).all()));
  app.patch("/api/admin/referrals/:id", requireAdmin as any, async (req,res) => {const old=db.select().from(referrals).where(eq(referrals.id,req.params.id)).get();if(!old)return res.status(404).json({error:"Not found"});const row=db.update(referrals).set(req.body).where(eq(referrals.id,old.id)).returning().get();if(req.body.status === "signed" && old.status !== "signed") await sendOwnerNotification("Referral signed", `<p>${old.refereeName} has signed a proposal referred by ${old.referrerName}.</p>`);res.json(row);});
  app.post("/api/admin/referrals/:id/issue-reward", requireAdmin as any, (req,res) => {const row=db.update(referrals).set({rewardIssued:1}).where(eq(referrals.id,req.params.id)).returning().get();if(!row)return res.status(404).json({error:"Not found"});res.json(row);});
  app.post("/api/referrals/:code", async (req,res) => {const seed=db.select().from(referrals).where(eq(referrals.referralCode,req.params.code)).get();if(!seed)return res.status(404).json({error:"Referral link not found"});const row=db.insert(referrals).values({id:randomUUID(),referrerProposalId:seed.referrerProposalId,referrerName:seed.referrerName,referrerEmail:seed.referrerEmail,refereeName:req.body.name,refereeEmail:req.body.email || null,refereePhone:req.body.phone || null,refereeAddress:req.body.address || null,referralCode:referralCode(),status:"invited"}).returning().get();await sendOwnerNotification("New neighbor referral", `<p><b>${req.body.name}</b> was referred by ${seed.referrerName}.<br>Email: ${req.body.email || "—"}<br>Phone: ${req.body.phone || "—"}<br>Address: ${req.body.address || "—"}</p>`);res.status(201).json(row);});

  app.post("/api/proposals/:token/warranty/register", async (req,res) => {const p=storage.getProposalByToken(req.params.token);if(!p)return res.status(404).json({error:"Not found"});const start=Math.floor(new Date(req.body.installDate || Date.now()).getTime()/1000);storage.updateProposal(p.id,{customerName:req.body.name || p.customerName,customerEmail:req.body.email || p.customerEmail,customerPhone:req.body.phone || p.customerPhone,propertyAddress:req.body.propertyAddress || p.propertyAddress,warrantyRegisteredAt:Math.floor(Date.now()/1000),warrantyStartDate:start} as any);for(const y of [1,3,5,10]) db.insert(emailSchedule).values({id:randomUUID(),proposalId:p.id,type:`maintenance_y${y}`,scheduledFor:start+y*365*86400,status:"pending"}).run();if(req.body.email || p.customerEmail) await sendWarrantyConfirmation({to:req.body.email || p.customerEmail!,customerName:req.body.name || p.customerName,accessToken:p.accessToken});await sendOwnerNotification("Warranty registered", `<p>${req.body.name || p.customerName} registered warranty for ${p.proposalNumber}.</p>`);res.json({success:true,warrantyStartDate:start});});
  app.post("/api/proposals/:token/review/private-feedback", async (req,res) => {const p=storage.getProposalByToken(req.params.token);if(!p)return res.status(404).json({error:"Not found"});const row=db.insert(reviews).values({id:randomUUID(),proposalId:p.id,stars:Number(req.body.stars),feedback:req.body.feedback || null,wentPublic:0}).returning().get();await sendOwnerNotification("Private project feedback", `<p><b>${p.customerName}</b> gave ${row.stars}/5 stars.<br>${req.body.feedback || "No comments provided."}</p>`);res.status(201).json(row);});
  app.post("/api/proposals/:token/review/public", (req,res) => {const p=storage.getProposalByToken(req.params.token);if(!p)return res.status(404).json({error:"Not found"});res.status(201).json(db.insert(reviews).values({id:randomUUID(),proposalId:p.id,stars:Number(req.body.stars),feedback:req.body.feedback || null,wentPublic:1}).returning().get());});

  // ── AI Roof Transformation ──
  // AI image generation requires specialized GPU services not available on this server.
  // Transformations are generated externally and uploaded via the standard image/upload endpoints.
  app.post("/api/admin/generate-transformation", requireAdmin as any, (_req, res) => {
    res.status(200).json({
      info: true,
      message: "AI transformations are processed by McCurdy's AI service. Upload before photos and the AI previews will be generated and added automatically.",
    });
  });

  // Check transformation status (for polling)
  app.get("/api/admin/transformation-status/:proposalId", requireAdmin as any, (req, res) => {
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
  app.post("/api/admin/seed-demo", requireAdmin as any, (_req, res) => {
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
