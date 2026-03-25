import { 
  users, proposals, materials, proposalImages, incentives, 
  warrantyDocuments, documents, activityEvents, customerMessages,
  type User, type InsertUser,
  type Proposal, type InsertProposal,
  type Material, type InsertMaterial,
  type ProposalImage, type InsertProposalImage,
  type Incentive, type InsertIncentive,
  type WarrantyDocument, type InsertWarrantyDocument,
  type Document, type InsertDocument,
  type ActivityEvent, type InsertActivityEvent,
  type CustomerMessage, type InsertCustomerMessage,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): User | undefined;
  getUserByUsername(username: string): User | undefined;
  createUser(user: InsertUser): User;
  
  // Proposals
  getProposal(id: number): Proposal | undefined;
  getProposalByToken(token: string): Proposal | undefined;
  getProposalByNumber(num: string): Proposal | undefined;
  getAllProposals(): Proposal[];
  createProposal(proposal: InsertProposal): Proposal;
  updateProposal(id: number, data: Partial<InsertProposal>): Proposal | undefined;
  deleteProposal(id: number): void;
  
  // Materials
  getMaterialsByProposal(proposalId: number): Material[];
  createMaterial(material: InsertMaterial): Material;
  updateMaterial(id: number, data: Partial<InsertMaterial>): Material | undefined;
  deleteMaterial(id: number): void;
  
  // Images
  getImagesByProposal(proposalId: number): ProposalImage[];
  createImage(image: InsertProposalImage): ProposalImage;
  updateImage(id: number, data: Partial<InsertProposalImage>): ProposalImage | undefined;
  deleteImage(id: number): void;
  
  // Incentives
  getIncentivesByProposal(proposalId: number | null): Incentive[];
  getAllIncentives(): Incentive[];
  createIncentive(incentive: InsertIncentive): Incentive;
  updateIncentive(id: number, data: Partial<InsertIncentive>): Incentive | undefined;
  deleteIncentive(id: number): void;
  
  // Warranty Documents
  getWarrantyDocsByProposal(proposalId: number): WarrantyDocument[];
  createWarrantyDoc(doc: InsertWarrantyDocument): WarrantyDocument;
  deleteWarrantyDoc(id: number): void;
  
  // Documents
  getDocumentsByProposal(proposalId: number | null): Document[];
  createDocument(doc: InsertDocument): Document;
  deleteDocument(id: number): void;
  
  // Activity Tracking
  getActivitiesByProposal(proposalId: number): ActivityEvent[];
  getAllActivities(): ActivityEvent[];
  createActivity(event: InsertActivityEvent): ActivityEvent;
  
  // Customer Messages
  getMessagesByProposal(proposalId: number): CustomerMessage[];
  getAllMessages(): CustomerMessage[];
  createMessage(msg: InsertCustomerMessage): CustomerMessage;
  markMessageRead(id: number): void;
}

export class DatabaseStorage implements IStorage {
  // Users
  getUser(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  getUserByUsername(username: string): User | undefined {
    return db.select().from(users).where(eq(users.username, username)).get();
  }
  createUser(user: InsertUser): User {
    return db.insert(users).values(user).returning().get();
  }

  // Proposals
  getProposal(id: number): Proposal | undefined {
    return db.select().from(proposals).where(eq(proposals.id, id)).get();
  }
  getProposalByToken(token: string): Proposal | undefined {
    return db.select().from(proposals).where(eq(proposals.accessToken, token)).get();
  }
  getProposalByNumber(num: string): Proposal | undefined {
    return db.select().from(proposals).where(eq(proposals.proposalNumber, num)).get();
  }
  getAllProposals(): Proposal[] {
    return db.select().from(proposals).orderBy(desc(proposals.id)).all();
  }
  createProposal(proposal: InsertProposal): Proposal {
    return db.insert(proposals).values(proposal).returning().get();
  }
  updateProposal(id: number, data: Partial<InsertProposal>): Proposal | undefined {
    return db.update(proposals).set(data).where(eq(proposals.id, id)).returning().get();
  }
  deleteProposal(id: number): void {
    db.delete(proposals).where(eq(proposals.id, id)).run();
  }

  // Materials
  getMaterialsByProposal(proposalId: number): Material[] {
    return db.select().from(materials).where(eq(materials.proposalId, proposalId)).all();
  }
  createMaterial(material: InsertMaterial): Material {
    return db.insert(materials).values(material).returning().get();
  }
  updateMaterial(id: number, data: Partial<InsertMaterial>): Material | undefined {
    return db.update(materials).set(data).where(eq(materials.id, id)).returning().get();
  }
  deleteMaterial(id: number): void {
    db.delete(materials).where(eq(materials.id, id)).run();
  }

  // Images
  getImagesByProposal(proposalId: number): ProposalImage[] {
    return db.select().from(proposalImages).where(eq(proposalImages.proposalId, proposalId)).all();
  }
  createImage(image: InsertProposalImage): ProposalImage {
    return db.insert(proposalImages).values(image).returning().get();
  }
  updateImage(id: number, data: Partial<InsertProposalImage>): ProposalImage | undefined {
    return db.update(proposalImages).set(data).where(eq(proposalImages.id, id)).returning().get();
  }
  deleteImage(id: number): void {
    db.delete(proposalImages).where(eq(proposalImages.id, id)).run();
  }

  // Incentives
  getIncentivesByProposal(proposalId: number | null): Incentive[] {
    if (proposalId === null) {
      return db.select().from(incentives).all();
    }
    return db.select().from(incentives).where(eq(incentives.proposalId, proposalId)).all();
  }
  getAllIncentives(): Incentive[] {
    return db.select().from(incentives).all();
  }
  createIncentive(incentive: InsertIncentive): Incentive {
    return db.insert(incentives).values(incentive).returning().get();
  }
  updateIncentive(id: number, data: Partial<InsertIncentive>): Incentive | undefined {
    return db.update(incentives).set(data).where(eq(incentives.id, id)).returning().get();
  }
  deleteIncentive(id: number): void {
    db.delete(incentives).where(eq(incentives.id, id)).run();
  }

  // Warranty Documents
  getWarrantyDocsByProposal(proposalId: number): WarrantyDocument[] {
    return db.select().from(warrantyDocuments).where(eq(warrantyDocuments.proposalId, proposalId)).all();
  }
  createWarrantyDoc(doc: InsertWarrantyDocument): WarrantyDocument {
    return db.insert(warrantyDocuments).values(doc).returning().get();
  }
  deleteWarrantyDoc(id: number): void {
    db.delete(warrantyDocuments).where(eq(warrantyDocuments.id, id)).run();
  }

  // Documents
  getDocumentsByProposal(proposalId: number | null): Document[] {
    if (proposalId === null) {
      return db.select().from(documents).all();
    }
    return db.select().from(documents).where(eq(documents.proposalId, proposalId)).all();
  }
  createDocument(doc: InsertDocument): Document {
    return db.insert(documents).values(doc).returning().get();
  }
  deleteDocument(id: number): void {
    db.delete(documents).where(eq(documents.id, id)).run();
  }

  // Activity Tracking
  getActivitiesByProposal(proposalId: number): ActivityEvent[] {
    return db.select().from(activityEvents).where(eq(activityEvents.proposalId, proposalId)).orderBy(desc(activityEvents.id)).all();
  }
  getAllActivities(): ActivityEvent[] {
    return db.select().from(activityEvents).orderBy(desc(activityEvents.id)).all();
  }
  createActivity(event: InsertActivityEvent): ActivityEvent {
    return db.insert(activityEvents).values(event).returning().get();
  }

  // Customer Messages
  getMessagesByProposal(proposalId: number): CustomerMessage[] {
    return db.select().from(customerMessages).where(eq(customerMessages.proposalId, proposalId)).orderBy(desc(customerMessages.id)).all();
  }
  getAllMessages(): CustomerMessage[] {
    return db.select().from(customerMessages).orderBy(desc(customerMessages.id)).all();
  }
  createMessage(msg: InsertCustomerMessage): CustomerMessage {
    return db.insert(customerMessages).values(msg).returning().get();
  }
  markMessageRead(id: number): void {
    db.update(customerMessages).set({ isRead: 1 }).where(eq(customerMessages.id, id)).run();
  }
}

export const storage = new DatabaseStorage();
