import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users (admin accounts) ──────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("admin"), // admin | estimator | viewer
  name: text("name").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ── Proposals ───────────────────────────────────────────────
export const proposals = sqliteTable("proposals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposalNumber: text("proposal_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  companyName: text("company_name"),
  propertyAddress: text("property_address").notNull(),
  city: text("city"),
  county: text("county"),
  state: text("state").default("CA"),
  utilityTerritory: text("utility_territory"),
  proposalDate: text("proposal_date").notNull(),
  estimator: text("estimator"),
  projectType: text("project_type"), // commercial | residential
  status: text("status").notNull().default("draft"), // draft | sent | viewed | approved | revision_requested | expired
  accessToken: text("access_token").notNull().unique(),
  welcomeMessage: text("welcome_message"),
  // Scope data
  roofAreas: text("roof_areas"), // JSON string
  systemType: text("system_type"),
  scopeSummary: text("scope_summary"),
  exclusions: text("exclusions"),
  timelineEstimate: text("timeline_estimate"),
  addOns: text("add_ons"), // JSON string
  whyRecommended: text("why_recommended"), // JSON string - reasons
  currentCondition: text("current_condition"),
  keyIssues: text("key_issues"), // JSON string
  // System details
  roofSystemType: text("roof_system_type"),
  coatingType: text("coating_type"),
  primer: text("primer"),
  baseCoat: text("base_coat"),
  topCoat: text("top_coat"),
  reinforcement: text("reinforcement"),
  accessories: text("accessories"), // JSON string
  penetrationsHandling: text("penetrations_handling"),
  drainageTaper: text("drainage_taper"),
  manufacturerName: text("manufacturer_name"),
  systemDiagramUrl: text("system_diagram_url"),
  // Build / mils
  layerCount: integer("layer_count"),
  primerMils: text("primer_mils"),
  baseCoatMils: text("base_coat_mils"),
  topCoatMils: text("top_coat_mils"),
  totalDryMils: text("total_dry_mils"),
  milsExplanation: text("mils_explanation"),
  // Colors
  recommendedColor: text("recommended_color"),
  alternateColors: text("alternate_colors"), // JSON string
  colorNotes: text("color_notes"),
  // Warranty
  manufacturerWarranty: text("manufacturer_warranty"),
  workmanshipWarranty: text("workmanship_warranty"),
  ndlWarranty: text("ndl_warranty"),
  warrantyTerm: text("warranty_term"),
  warrantySummary: text("warranty_summary"),
  warrantyMaintenance: text("warranty_maintenance"),
  // Pricing
  pricingOptions: text("pricing_options"), // JSON string [{name, price, description, features[], recommended}]
  paymentSchedule: text("payment_schedule"),
  financingNotes: text("financing_notes"),
  // PDF
  proposalPdfUrl: text("proposal_pdf_url"),
  // Approval
  approvedOption: text("approved_option"),
  approvedAt: text("approved_at"),
  approvedBy: text("approved_by"),
});

export const insertProposalSchema = createInsertSchema(proposals).omit({ id: true });
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposals.$inferSelect;

// ── Materials ───────────────────────────────────────────────
export const materials = sqliteTable("materials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposalId: integer("proposal_id").notNull(),
  manufacturer: text("manufacturer"),
  productName: text("product_name").notNull(),
  category: text("category").notNull(), // primer | base_coat | top_coat | sealant | reinforcing | drain | insulation | accessory
  usedFor: text("used_for"),
  technicalSummary: text("technical_summary"),
  dataSheetUrl: text("data_sheet_url"),
  sdsUrl: text("sds_url"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
});

export const insertMaterialSchema = createInsertSchema(materials).omit({ id: true });
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

// ── Before/After Images ─────────────────────────────────────
export const proposalImages = sqliteTable("proposal_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposalId: integer("proposal_id").notNull(),
  imageType: text("image_type").notNull(), // before | after | comparison
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  hotspots: text("hotspots"), // JSON string [{x, y, label, description, material, mils}]
  sortOrder: integer("sort_order").default(0),
});

export const insertProposalImageSchema = createInsertSchema(proposalImages).omit({ id: true });
export type InsertProposalImage = z.infer<typeof insertProposalImageSchema>;
export type ProposalImage = typeof proposalImages.$inferSelect;

// ── Incentives / Savings ────────────────────────────────────
export const incentives = sqliteTable("incentives", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposalId: integer("proposal_id"),
  programName: text("program_name").notNull(),
  programType: text("program_type").notNull(), // tax_deduction | rebate | utility | financing | compliance
  applicability: text("applicability"),
  locationFilter: text("location_filter"),
  utilityFilter: text("utility_filter"),
  yearFilter: text("year_filter"),
  officialLink: text("official_link"),
  notes: text("notes"),
  lastVerifiedDate: text("last_verified_date"),
  sortOrder: integer("sort_order").default(0),
});

export const insertIncentiveSchema = createInsertSchema(incentives).omit({ id: true });
export type InsertIncentive = z.infer<typeof insertIncentiveSchema>;
export type Incentive = typeof incentives.$inferSelect;

// ── Warranty Documents ──────────────────────────────────────
export const warrantyDocuments = sqliteTable("warranty_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposalId: integer("proposal_id").notNull(),
  title: text("title").notNull(),
  documentUrl: text("document_url"),
  documentType: text("document_type"), // manufacturer | workmanship | ndl
  notes: text("notes"),
});

export const insertWarrantyDocumentSchema = createInsertSchema(warrantyDocuments).omit({ id: true });
export type InsertWarrantyDocument = z.infer<typeof insertWarrantyDocumentSchema>;
export type WarrantyDocument = typeof warrantyDocuments.$inferSelect;

// ── Documents (Forms & Print Center) ────────────────────────
export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposalId: integer("proposal_id"),
  title: text("title").notNull(),
  category: text("category").notNull(), // proposal | contract | invoice | data_sheet | warranty | compliance | checklist | form
  documentUrl: text("document_url"),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// ── Activity Tracking ───────────────────────────────────────
export const activityEvents = sqliteTable("activity_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposalId: integer("proposal_id").notNull(),
  eventType: text("event_type").notNull(), // sent | opened | viewed | revisited | shared | downloaded | question | approved | revision_requested
  eventData: text("event_data"), // JSON with extra context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull(),
});

export const insertActivityEventSchema = createInsertSchema(activityEvents).omit({ id: true });
export type InsertActivityEvent = z.infer<typeof insertActivityEventSchema>;
export type ActivityEvent = typeof activityEvents.$inferSelect;

// ── Customer Messages ───────────────────────────────────────
export const customerMessages = sqliteTable("customer_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  proposalId: integer("proposal_id").notNull(),
  messageType: text("message_type").notNull(), // question | revision | approval | general
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  senderPhone: text("sender_phone"),
  message: text("message").notNull(),
  selectedOption: text("selected_option"),
  isRead: integer("is_read").default(0),
  createdAt: text("created_at").notNull(),
});

export const insertCustomerMessageSchema = createInsertSchema(customerMessages).omit({ id: true });
export type InsertCustomerMessage = z.infer<typeof insertCustomerMessageSchema>;
export type CustomerMessage = typeof customerMessages.$inferSelect;
