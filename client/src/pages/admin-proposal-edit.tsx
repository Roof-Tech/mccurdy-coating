import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useRoute, Link } from "wouter";
import {
  FileText, Upload, Trash2, ArrowLeft, File, Image, FileSpreadsheet,
  Eye, X, Sparkles, Plus, Save, Check, Copy, Paperclip, ClipboardPlus, Mail,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import type { Proposal, Material, Document as DocType, WarrantyDocument, ProposalImage, ChangeOrder } from "@shared/schema";
import { AiRoofPanel, UpgradeMenuPanel, JobPhotosPanel, EmailSchedulePanel } from "@/components/admin-mega-feature-panels";

// ── Helpers ────────────────────────────────────────────────────

function tryParseArray(json: string | null | undefined): string[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="w-5 h-5 text-red-500" />;
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return <Image className="w-5 h-5 text-blue-500" />;
  if (["xls", "xlsx", "csv"].includes(ext || "")) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
}

function UploadZone({ onUpload, label }: { onUpload: (file: File) => void; label: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }, [onUpload]);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      data-testid="upload-zone"
    >
      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">Drag & drop or click to browse</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">PDF, images, Word, Excel — up to 50MB</p>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = ""; }}
      />
    </div>
  );
}

// ── Pricing tier editor ────────────────────────────────────────

interface PricingOption {
  name: string;
  price: string;
  description: string;
  features: string[];
  recommended: boolean;
}

function PricingTierCard({
  opt,
  onChange,
  onRemove,
}: {
  opt: PricingOption;
  onChange: (updates: Partial<PricingOption>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={`border rounded-lg p-4 space-y-3 ${opt.recommended ? "border-accent/60 bg-accent/5" : "border-border"}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={opt.recommended}
            onChange={e => onChange({ recommended: e.target.checked })}
            className="w-3.5 h-3.5"
          />
          <span className="font-medium text-foreground">Mark as Recommended</span>
          {opt.recommended && (
            <Badge className="text-[9px] h-4 bg-accent text-white border-0">★ Recommended</Badge>
          )}
        </label>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          onClick={onRemove}
          data-testid="button-remove-tier"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Tier Name</Label>
          <Input
            className="h-8 text-sm"
            placeholder="20-Year ASC Warranty"
            value={opt.name}
            onChange={e => onChange({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Price</Label>
          <Input
            className="h-8 text-sm"
            placeholder="$9.50/sq ft"
            value={opt.price}
            onChange={e => onChange({ price: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Description</Label>
        <Textarea
          className="min-h-[52px] text-sm"
          placeholder="Brief description of this warranty tier..."
          value={opt.description}
          onChange={e => onChange({ description: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Features — one per line</Label>
        <Textarea
          className="min-h-[80px] text-sm font-mono"
          placeholder={"Full power wash and prep\nPrimer coat\n45 dry mils silicone build\nAll penetration reinforcement"}
          value={opt.features.join("\n")}
          onChange={e => onChange({ features: e.target.value.split("\n") })}
        />
      </div>
    </div>
  );
}

function AITransformSection({ images }: { images: ProposalImage[] }) {
  const beforeImages = images.filter(img => img.imageType === "before");
  const aiWhiteImages = images.filter(img => img.imageType === "ai_white");
  const aiGrayImages = images.filter(img => img.imageType === "ai_gray");
  if (beforeImages.length === 0) return null;
  const totalAi = aiWhiteImages.length + aiGrayImages.length;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-600" />
        <h4 className="text-sm font-semibold text-foreground">AI Roof Transformation</h4>
        {totalAi > 0 && (
          <Badge className="text-[9px] h-4 bg-green-100 text-green-800 border-green-300">
            {totalAi} preview{totalAi > 1 ? "s" : ""} ready
          </Badge>
        )}
      </div>
      {totalAi > 0 ? (
        <p className="text-xs text-muted-foreground">
          AI previews are ready. Customers will see an interactive before/after slider on the Visualizer page.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Before photos uploaded. AI transformation previews will be generated by McCurdy's AI service and added automatically.
        </p>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────

export default function AdminProposalEdit() {
  const [, params] = useRoute("/admin/proposals/:id");
  const proposalId = parseInt(params?.id || "0");
  const { toast } = useToast();

  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("proposal");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("content");
  const [changeOrderForm, setChangeOrderForm] = useState({ title: "", description: "", amount: "", type: "addition" });
  const [savingChangeOrder, setSavingChangeOrder] = useState(false);
  const [sendingChangeOrderId, setSendingChangeOrderId] = useState<string | null>(null);

  // Content editing state — flat string map (JSON arrays stored as line-separated text)
  const [ed, setEd] = useState<Record<string, string>>({});
  const [pricingOpts, setPricingOpts] = useState<PricingOption[]>([]);
  const edInitialized = useRef(false);

  const setField = (field: string, value: string) =>
    setEd(prev => ({ ...prev, [field]: value }));

  // ── Data fetching ──
  const { data: proposal } = useQuery<Proposal>({
    queryKey: ["/api/admin/proposals", proposalId],
    queryFn: () => apiRequest("GET", `/api/admin/proposals/${proposalId}`).then(r => r.json()),
    enabled: !!proposalId,
  });

  const { data: documents = [] } = useQuery<DocType[]>({
    queryKey: ["/api/admin/proposals", proposalId, "documents"],
    queryFn: () => apiRequest("GET", `/api/admin/proposals/${proposalId}/documents`).then(r => r.json()),
    enabled: !!proposalId,
  });

  const { data: images = [] } = useQuery<ProposalImage[]>({
    queryKey: ["/api/admin/proposals", proposalId, "images"],
    queryFn: () => apiRequest("GET", `/api/admin/proposals/${proposalId}/images`).then(r => r.json()),
    enabled: !!proposalId,
  });

  const { data: warrantyDocs = [] } = useQuery<WarrantyDocument[]>({
    queryKey: ["/api/admin/proposals", proposalId, "warranty-docs"],
    queryFn: () => apiRequest("GET", `/api/admin/proposals/${proposalId}/warranty-docs`).then(r => r.json()),
    enabled: !!proposalId,
  });

  const { data: changeOrders = [] } = useQuery<ChangeOrder[]>({
    queryKey: ["/api/admin/proposals", proposalId, "change-orders"],
    queryFn: () => apiRequest("GET", `/api/admin/proposals/${proposalId}/change-orders`).then(r => r.json()),
    enabled: !!proposalId,
  });

  useEffect(() => {
    if (window.location.hash.endsWith("#files")) setActiveTab("files");
    if (window.location.hash.endsWith("#change-orders")) setActiveTab("change-orders");
  }, []);

  // ── Initialize edit state from proposal (once) ──
  useEffect(() => {
    if (!proposal || edInitialized.current) return;
    edInitialized.current = true;
    setEd({
      customerName: proposal.customerName || "",
      companyName: proposal.companyName || "",
      propertyAddress: proposal.propertyAddress || "",
      city: proposal.city || "",
      county: proposal.county || "",
      state: proposal.state || "CA",
      utilityTerritory: proposal.utilityTerritory || "",
      proposalDate: proposal.proposalDate || "",
      estimator: proposal.estimator || "",
      projectType: proposal.projectType || "commercial",
      propertyAge: String(proposal.propertyAge || ""),
      hasHvac: String(proposal.hasHvac || 0),
      isFlatRoof: String(proposal.isFlatRoof || 0),
      appointmentDate: proposal.appointmentDate ? new Date(proposal.appointmentDate * 1000).toISOString().slice(0,16) : "",
      privateNotes: proposal.privateNotes || "",
      status: proposal.status || "draft",
      welcomeMessage: proposal.welcomeMessage || "",
      systemType: proposal.systemType || "",
      scopeSummary: proposal.scopeSummary || "",
      exclusions: proposal.exclusions || "",
      timelineEstimate: proposal.timelineEstimate || "",
      currentCondition: proposal.currentCondition || "",
      manufacturerName: proposal.manufacturerName || "",
      recommendedColor: proposal.recommendedColor || "",
      colorNotes: proposal.colorNotes || "",
      totalDryMils: proposal.totalDryMils || "",
      milsExplanation: proposal.milsExplanation || "",
      warrantyTerm: proposal.warrantyTerm || "",
      manufacturerWarranty: proposal.manufacturerWarranty || "",
      workmanshipWarranty: proposal.workmanshipWarranty || "",
      ndlWarranty: proposal.ndlWarranty || "",
      warrantySummary: proposal.warrantySummary || "",
      warrantyMaintenance: proposal.warrantyMaintenance || "",
      paymentSchedule: proposal.paymentSchedule || "",
      financingNotes: proposal.financingNotes || "",
      // JSON arrays as newline-separated text
      roofAreas: tryParseArray(proposal.roofAreas).join("\n"),
      whyRecommended: tryParseArray(proposal.whyRecommended).join("\n"),
      keyIssues: tryParseArray(proposal.keyIssues).join("\n"),
      addOns: tryParseArray(proposal.addOns).join("\n"),
    });
    try {
      const opts = JSON.parse(proposal.pricingOptions || "[]");
      setPricingOpts(Array.isArray(opts) ? opts : []);
    } catch {
      setPricingOpts([]);
    }
  }, [proposal]);

  // ── Save content ──
  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest("PATCH", `/api/admin/proposals/${proposalId}`, {
        ...ed,
        pricingOptions: JSON.stringify(pricingOpts),
        roofAreas: JSON.stringify((ed.roofAreas || "").split("\n").filter(s => s.trim())),
        whyRecommended: JSON.stringify((ed.whyRecommended || "").split("\n").filter(s => s.trim())),
        keyIssues: JSON.stringify((ed.keyIssues || "").split("\n").filter(s => s.trim())),
        addOns: JSON.stringify((ed.addOns || "").split("\n").filter(s => s.trim())),
        propertyAge: ed.propertyAge ? Number(ed.propertyAge) : null,
        hasHvac: Number(ed.hasHvac || 0),
        isFlatRoof: Number(ed.isFlatRoof || 0),
        appointmentDate: ed.appointmentDate ? Math.floor(new Date(ed.appointmentDate).getTime() / 1000) : null,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId] });
      toast({ title: "Saved", description: "All changes saved successfully." });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message || "Please try again.", variant: "destructive" });
    }
    setSaving(false);
  };

  // ── Pricing tier helpers ──
  const addPricingTier = () => {
    setPricingOpts(prev => [
      ...prev,
      {
        name: "",
        price: "",
        description: "",
        features: [
          "Full power wash and prep",
          "Primer coat",
          "All penetration reinforcement",
        ],
        recommended: false,
      },
    ]);
  };

  const updatePricingTier = (i: number, updates: Partial<PricingOption>) => {
    setPricingOpts(prev => {
      const next = [...prev];
      next[i] = { ...next[i], ...updates };
      return next;
    });
  };

  const removePricingTier = (i: number) => {
    setPricingOpts(prev => prev.filter((_, idx) => idx !== i));
  };

  // ── File upload ──
  const handleUpload = async (file: File, category: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

      if (category === "photo_before" || category === "photo_after") {
        await apiRequest("POST", "/api/admin/images", {
          proposalId,
          imageType: category === "photo_before" ? "before" : "after",
          imageUrl: uploadData.url,
          caption: file.name,
          sortOrder: images.length,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "images"] });
      } else if (category === "warranty") {
        await apiRequest("POST", "/api/admin/warranty-docs", {
          proposalId,
          title: file.name.replace(/\.[^.]+$/, ""),
          documentUrl: uploadData.url,
          documentType: "manufacturer",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "warranty-docs"] });
      } else {
        await apiRequest("POST", "/api/admin/documents", {
          proposalId,
          title: file.name.replace(/\.[^.]+$/, ""),
          category,
          documentUrl: uploadData.url,
          description: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
          sortOrder: documents.length,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "documents"] });
      }
      toast({ title: "File uploaded", description: file.name });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const deleteDocument = async (id: number) => {
    await apiRequest("DELETE", `/api/admin/documents/${id}`);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "documents"] });
    toast({ title: "Document removed" });
  };

  const deleteImage = async (id: number) => {
    await apiRequest("DELETE", `/api/admin/images/${id}`);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "images"] });
    toast({ title: "Image removed" });
  };

  const deleteWarrantyDoc = async (id: number) => {
    await apiRequest("DELETE", `/api/admin/warranty-docs/${id}`);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "warranty-docs"] });
    toast({ title: "Warranty document removed" });
  };

  const createChangeOrder = async () => {
    if (!changeOrderForm.title.trim() || !changeOrderForm.description.trim() || !changeOrderForm.amount.trim()) {
      toast({ title: "Missing details", description: "Add a title, description, and amount before saving.", variant: "destructive" });
      return;
    }
    setSavingChangeOrder(true);
    try {
      await apiRequest("POST", `/api/admin/proposals/${proposalId}/change-orders`, changeOrderForm);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "change-orders"] });
      setChangeOrderForm({ title: "", description: "", amount: "", type: "addition" });
      toast({ title: "Change order saved", description: "It is ready to email to the customer for approval." });
    } catch (e: any) {
      toast({ title: "Unable to save", description: e.message || "Please try again.", variant: "destructive" });
    }
    setSavingChangeOrder(false);
  };

  const sendChangeOrder = async (changeOrder: ChangeOrder) => {
    setSendingChangeOrderId(changeOrder.id);
    try {
      const res = await fetch(`/api/admin/change-orders/${changeOrder.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to send change order");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "change-orders"] });
      toast({ title: "Change order emailed", description: `Sent to ${data.sentTo}.` });
    } catch (e: any) {
      toast({ title: "Email not sent", description: e.message || "Please add a customer email and try again.", variant: "destructive" });
    }
    setSendingChangeOrderId(null);
  };

  const deleteChangeOrder = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/admin/change-orders/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "change-orders"] });
      toast({ title: "Change order removed" });
    } catch (e: any) {
      toast({ title: "Unable to remove", description: e.message || "Please try again.", variant: "destructive" });
    }
  };

  const copyLink = () => {
    if (!proposal) return;
    const url = `${window.location.origin}/#/view/${proposal.accessToken}`;
    navigator.clipboard?.writeText(url).then(() =>
      toast({ title: "Link copied", description: "Customer proposal link copied to clipboard." })
    );
  };

  if (!proposal) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p className="text-sm text-muted-foreground">Loading proposal...</p>
      </div>
    );
  }

  const docCategories = [
    { value: "proposal", label: "Proposal / Quote" },
    { value: "contract", label: "Contract" },
    { value: "invoice", label: "Invoice" },
    { value: "data_sheet", label: "Data Sheet / TDS" },
    { value: "warranty", label: "Warranty Document" },
    { value: "compliance", label: "Compliance / Title 24" },
    { value: "checklist", label: "Checklist / Inspection" },
    { value: "form", label: "Form / Permit" },
    { value: "photo_before", label: "Photo: Before" },
    { value: "photo_after", label: "Photo: After" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5" data-testid="page-admin-proposal-edit">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/proposals">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" data-testid="button-back">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
        </Link>
        <div className="order-3 basis-full min-w-0 sm:order-none sm:basis-auto sm:flex-1">
          <PageHeader
            title={`Manage: ${proposal.customerName}`}
            subtitle={`${proposal.proposalNumber} — ${proposal.propertyAddress}`}
            icon={<FileText className="w-5 h-5" />}
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={copyLink}>
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </Button>
          <a href={`/#/view/${proposal.accessToken}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" data-testid="button-preview">
              <Eye className="w-3.5 h-3.5" /> Preview
            </Button>
          </a>
        </div>
      </div>

      {/* ── Status bar ── */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-muted-foreground">Status</span>
              <Select
                value={ed.status || proposal.status}
                onValueChange={v => setField("status", v)}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="revision_requested">Revision Requested</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-muted-foreground">Proposal #</span>
              <div className="font-mono font-medium mt-1">{proposal.proposalNumber}</div>
            </div>
            <div>
              <span className="text-muted-foreground">County</span>
              <div className="font-medium mt-1">{proposal.county || "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">System</span>
              <div className="font-medium mt-1 truncate">{proposal.systemType || "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Date</span>
              <div className="font-medium mt-1">{proposal.proposalDate}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="max-w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="content" className="shrink-0 whitespace-nowrap gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> Content
          </TabsTrigger>
          <TabsTrigger value="files" className="shrink-0 whitespace-nowrap gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Files & Media
          </TabsTrigger>
          <TabsTrigger value="change-orders" className="shrink-0 whitespace-nowrap gap-1.5 text-xs">
            <ClipboardPlus className="w-3.5 h-3.5" /> Change Orders
          </TabsTrigger>
          <TabsTrigger value="upgrade-menu" className="shrink-0 whitespace-nowrap gap-1.5 text-xs"><Plus className="w-3.5 h-3.5"/> Upgrade Menu</TabsTrigger>
          <TabsTrigger value="job-photos" className="shrink-0 whitespace-nowrap gap-1.5 text-xs"><Image className="w-3.5 h-3.5"/> Job Photos</TabsTrigger>
          <TabsTrigger value="ai-roof" className="shrink-0 whitespace-nowrap gap-1.5 text-xs"><Sparkles className="w-3.5 h-3.5"/> AI Roof Analysis</TabsTrigger>
          <TabsTrigger value="email-schedule" className="shrink-0 whitespace-nowrap gap-1.5 text-xs"><Mail className="w-3.5 h-3.5"/> Email Schedule</TabsTrigger>
        </TabsList>

        {/* ══ CONTENT TAB ══ */}
        <TabsContent value="content" className="space-y-4 mt-4">

          <button
            type="button"
            onClick={() => setActiveTab("files")}
            className="w-full text-left rounded-xl border border-primary/25 bg-primary/5 p-4 sm:p-5 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            data-testid="button-attach-files-cta"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="shrink-0 rounded-lg bg-primary text-primary-foreground p-2.5">
                <Paperclip className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">Attach Files &amp; Documents</p>
                <p className="mt-1 text-sm text-muted-foreground break-words">Click here to add proposals, contracts, photos, or supporting documents.</p>
              </div>
            </div>
          </button>

          {/* Customer & Property */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Customer & Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer Name</Label>
                  <Input value={ed.customerName || ""} onChange={e => setField("customerName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Company Name</Label>
                  <Input value={ed.companyName || ""} onChange={e => setField("companyName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer Email</Label>
                  <Input
                    type="email"
                    placeholder="customer@company.com"
                    value={(ed as any).customerEmail || ""}
                    onChange={e => setField("customerEmail" as any, e.target.value)}
                    data-testid="input-customer-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer Phone</Label>
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={(ed as any).customerPhone || ""}
                    onChange={e => setField("customerPhone" as any, e.target.value)}
                    data-testid="input-customer-phone"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Property Address</Label>
                  <Input value={ed.propertyAddress || ""} onChange={e => setField("propertyAddress", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <Input value={ed.city || ""} onChange={e => setField("city", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">County</Label>
                  <Input value={ed.county || ""} onChange={e => setField("county", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Utility Territory</Label>
                  <Input placeholder="PG&E" value={ed.utilityTerritory || ""} onChange={e => setField("utilityTerritory", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Project Type</Label>
                  <Select value={ed.projectType || "commercial"} onValueChange={v => setField("projectType", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="commercial">Commercial</SelectItem>
                      <SelectItem value="residential">Residential</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 rounded-lg border border-primary/15 bg-primary/5 p-4 space-y-3">
                  <p className="text-sm font-semibold">Property Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-xs">Property Age (years)</Label><Input data-testid="input-property-age" type="number" value={ed.propertyAge || ""} onChange={e => setField("propertyAge", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">Appointment Date</Label><Input data-testid="input-appointment-date" type="datetime-local" value={ed.appointmentDate || ""} onChange={e => setField("appointmentDate", e.target.value)} /></div>
                    <div className="space-y-1.5"><Label className="text-xs">HVAC Equipment</Label><Select value={ed.hasHvac || "0"} onValueChange={v => setField("hasHvac", v)}><SelectTrigger data-testid="select-has-hvac"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="0">No / Unknown</SelectItem><SelectItem value="1">Yes</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1.5"><Label className="text-xs">Flat Roof</Label><Select value={ed.isFlatRoof || "0"} onValueChange={v => setField("isFlatRoof", v)}><SelectTrigger data-testid="select-flat-roof"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="0">No / Unknown</SelectItem><SelectItem value="1">Yes</SelectItem></SelectContent></Select></div>
                  </div>
                  {ed.appointmentDate && ed.customerEmail && <Button data-testid="button-send-prep-email" variant="outline" onClick={async()=>{const r=await apiRequest("POST",`/api/admin/proposals/${proposalId}/send-prep-email`); if(!r.ok) throw new Error("Unable to send"); toast({title:"Prep-for-visit email sent"});}}><Mail className="w-4 h-4 mr-2"/>Send Prep-For-Visit Email</Button>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Proposal Date</Label>
                  <Input type="date" value={ed.proposalDate || ""} onChange={e => setField("proposalDate", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estimator</Label>
                  <Input value={ed.estimator || ""} onChange={e => setField("estimator", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Proposal Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Proposal Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Welcome Message</Label>
                <Textarea
                  className="min-h-[80px] text-sm"
                  placeholder="Thank you for allowing McCurdy Roofing..."
                  value={ed.welcomeMessage || ""}
                  onChange={e => setField("welcomeMessage", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">System Type</Label>
                <Input
                  placeholder="Silicone Roof Restoration System"
                  value={ed.systemType || ""}
                  onChange={e => setField("systemType", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Scope of Work</Label>
                <Textarea
                  className="min-h-[80px] text-sm"
                  placeholder="Full silicone roof restoration over existing modified bitumen membrane..."
                  value={ed.scopeSummary || ""}
                  onChange={e => setField("scopeSummary", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Exclusions</Label>
                  <Textarea
                    className="min-h-[60px] text-sm"
                    placeholder="Interior repairs, structural modifications..."
                    value={ed.exclusions || ""}
                    onChange={e => setField("exclusions", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Timeline Estimate</Label>
                  <Input
                    placeholder="3–4 weeks from contract signing, weather permitting"
                    value={ed.timelineEstimate || ""}
                    onChange={e => setField("timelineEstimate", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Roof Areas — one per line</Label>
                <Textarea
                  className="min-h-[70px] text-sm"
                  placeholder={"Main warehouse roof — 18,500 sq ft\nOffice wing — 3,200 sq ft"}
                  value={ed.roofAreas || ""}
                  onChange={e => setField("roofAreas", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Add-Ons / Optional Items — one per line</Label>
                <Textarea
                  className="min-h-[60px] text-sm"
                  placeholder={"Additional drain installation\nParapet wall cap metal replacement"}
                  value={ed.addOns || ""}
                  onChange={e => setField("addOns", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Roof Condition */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Roof Condition & Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Current Roof Condition</Label>
                <Textarea
                  className="min-h-[80px] text-sm"
                  placeholder="The existing modified bitumen roof is approximately 15 years old..."
                  value={ed.currentCondition || ""}
                  onChange={e => setField("currentCondition", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Key Issues Identified — one per line</Label>
                <Textarea
                  className="min-h-[80px] text-sm"
                  placeholder={"UV degradation across 60% of membrane\nSeam separation at wall-to-roof transitions\nPonding water in two low areas"}
                  value={ed.keyIssues || ""}
                  onChange={e => setField("keyIssues", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Why This System — reasons, one per line</Label>
                <Textarea
                  className="min-h-[80px] text-sm"
                  placeholder={"Existing membrane is structurally sound — restoration avoids costly tear-off\nSilicone provides superior ponding water resistance\nUV reflectivity reduces cooling costs"}
                  value={ed.whyRecommended || ""}
                  onChange={e => setField("whyRecommended", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing Tiers */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Pricing Tiers</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {pricingOpts.length} tier{pricingOpts.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pricingOpts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No pricing tiers yet. Click "Add Pricing Tier" to get started.
                </p>
              )}
              {pricingOpts.map((opt, i) => (
                <PricingTierCard
                  key={i}
                  opt={opt}
                  onChange={updates => updatePricingTier(i, updates)}
                  onRemove={() => removePricingTier(i)}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={addPricingTier}
                data-testid="button-add-tier"
              >
                <Plus className="w-3.5 h-3.5" /> Add Pricing Tier
              </Button>
            </CardContent>
          </Card>

          {/* System & Colors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">System & Color Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Manufacturer Name</Label>
                  <Input
                    placeholder="ASC (American Silicone Coatings)"
                    value={ed.manufacturerName || ""}
                    onChange={e => setField("manufacturerName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Recommended Color</Label>
                  <Input
                    placeholder="White (Cool White)"
                    value={ed.recommendedColor || ""}
                    onChange={e => setField("recommendedColor", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Total Dry Mils</Label>
                  <Input
                    placeholder="23–56 dry mils depending on tier"
                    value={ed.totalDryMils || ""}
                    onChange={e => setField("totalDryMils", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Warranty Term</Label>
                  <Input
                    placeholder="5 to 30 years based on selected tier"
                    value={ed.warrantyTerm || ""}
                    onChange={e => setField("warrantyTerm", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mils Explanation</Label>
                <Textarea
                  className="min-h-[60px] text-sm"
                  placeholder="Mil thickness directly determines roof performance and warranty eligibility..."
                  value={ed.milsExplanation || ""}
                  onChange={e => setField("milsExplanation", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Color Notes</Label>
                <Textarea
                  className="min-h-[52px] text-sm"
                  placeholder="White provides maximum solar reflectivity (SRI 110+)..."
                  value={ed.colorNotes || ""}
                  onChange={e => setField("colorNotes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Warranty */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Warranty</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Manufacturer Warranty</Label>
                <Input
                  placeholder="ASC Manufacturer Warranty — tier based on dry mil build"
                  value={ed.manufacturerWarranty || ""}
                  onChange={e => setField("manufacturerWarranty", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Workmanship Warranty</Label>
                <Input
                  placeholder="McCurdy Roofing Workmanship Warranty"
                  value={ed.workmanshipWarranty || ""}
                  onChange={e => setField("workmanshipWarranty", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">NDL Warranty Description</Label>
                <Textarea
                  className="min-h-[60px] text-sm"
                  placeholder="NDL warranty covers 100% of material and labor costs for the full warranty term..."
                  value={ed.ndlWarranty || ""}
                  onChange={e => setField("ndlWarranty", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Warranty Summary</Label>
                <Textarea
                  className="min-h-[60px] text-sm"
                  value={ed.warrantySummary || ""}
                  onChange={e => setField("warrantySummary", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Maintenance Requirements</Label>
                <Textarea
                  className="min-h-[56px] text-sm"
                  placeholder="Annual inspection recommended..."
                  value={ed.warrantyMaintenance || ""}
                  onChange={e => setField("warrantyMaintenance", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Payment & Financing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Schedule</Label>
                <Textarea
                  className="min-h-[60px] text-sm"
                  placeholder="No deposit required. 50% due upon materials loaded on the roof and cleaning & sealing completed. 50% upon completion."
                  value={ed.paymentSchedule || ""}
                  onChange={e => setField("paymentSchedule", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Financing Notes</Label>
                <Textarea
                  className="min-h-[52px] text-sm"
                  placeholder="Financing available through approved lending partners..."
                  value={ed.financingNotes || ""}
                  onChange={e => setField("financingNotes", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          <div className="flex justify-end pb-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 min-w-[140px]"
              data-testid="button-save"
            >
              {saved ? (
                <><Check className="w-4 h-4" /> Saved</>
              ) : saving ? (
                "Saving..."
              ) : (
                <><Save className="w-4 h-4" /> Save Changes</>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* ══ FILES TAB ══ */}
        <TabsContent value="files" className="space-y-4 mt-4">

          {/* Upload zone */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" /> Upload Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {docCategories.map(c => (
                  <Button
                    key={c.value}
                    variant={uploadCategory === c.value ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setUploadCategory(c.value)}
                    data-testid={`button-category-${c.value}`}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
              <UploadZone
                label={`Upload ${docCategories.find(c => c.value === uploadCategory)?.label || uploadCategory}`}
                onUpload={file => handleUpload(file, uploadCategory)}
              />
              {uploading && (
                <p className="text-xs text-center text-muted-foreground animate-pulse">Uploading...</p>
              )}
            </CardContent>
          </Card>

          {/* Documents list */}
          {documents.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Documents ({documents.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group" data-testid={`row-doc-${doc.id}`}>
                    <FileIcon name={doc.title} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px]">{doc.category}</Badge>
                        {doc.description && (
                          <span className="text-[10px] text-muted-foreground truncate">{doc.description}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {doc.documentUrl && (
                        <a href={doc.documentUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive"
                        onClick={() => deleteDocument(doc.id)}
                        data-testid={`button-delete-doc-${doc.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Images */}
          {images.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" /> Before/After Images ({images.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map(img => (
                    <div key={img.id} className="relative group rounded-md overflow-hidden border" data-testid={`card-image-${img.id}`}>
                      <img src={img.imageUrl} alt={img.caption || ""} className="w-full h-32 object-cover" />
                      <div className="absolute right-2 top-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2 text-[11px] shadow-sm opacity-85 hover:opacity-100"
                          onClick={() => deleteImage(img.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Remove
                        </Button>
                      </div>
                      <div className="p-2">
                        <Badge variant="outline" className="text-[9px]">{img.imageType}</Badge>
                        {img.caption && (
                          <span className="text-[10px] text-muted-foreground ml-1">{img.caption}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <AITransformSection images={images} />
              </CardContent>
            </Card>
          )}

          {/* Warranty docs */}
          {warrantyDocs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Warranty Documents ({warrantyDocs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {warrantyDocs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group" data-testid={`row-warranty-${doc.id}`}>
                    <FileText className="w-5 h-5 text-amber-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      {doc.documentType && (
                        <Badge variant="outline" className="text-[9px]">{doc.documentType}</Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {doc.documentUrl && (
                        <a href={doc.documentUrl} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive"
                        onClick={() => deleteWarrantyDoc(doc.id)}
                        data-testid={`button-delete-warranty-${doc.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ CHANGE ORDERS TAB ══ */}
        <TabsContent value="change-orders" className="space-y-4 mt-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardPlus className="w-4 h-4 text-primary" /> Add a Change Order
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground break-words">Use change orders for approved additions or credits without losing the original proposal record.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Title</Label>
                  <Input
                    placeholder="Skylight repair"
                    value={changeOrderForm.title}
                    onChange={e => setChangeOrderForm(prev => ({ ...prev, title: e.target.value }))}
                    data-testid="input-change-order-title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount</Label>
                  <Input
                    placeholder="$850.00"
                    value={changeOrderForm.amount}
                    onChange={e => setChangeOrderForm(prev => ({ ...prev, amount: e.target.value }))}
                    data-testid="input-change-order-amount"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea
                  className="min-h-[96px] text-sm"
                  placeholder="Explain the work added or credited, including any material or schedule impact."
                  value={changeOrderForm.description}
                  onChange={e => setChangeOrderForm(prev => ({ ...prev, description: e.target.value }))}
                  data-testid="textarea-change-order-description"
                />
              </div>
              <div className="space-y-1.5 max-w-xs">
                <Label className="text-xs">Type</Label>
                <Select value={changeOrderForm.type} onValueChange={type => setChangeOrderForm(prev => ({ ...prev, type }))}>
                  <SelectTrigger data-testid="select-change-order-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="addition">Addition</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createChangeOrder} disabled={savingChangeOrder} className="gap-2" data-testid="button-save-change-order">
                <Save className="w-4 h-4" /> {savingChangeOrder ? "Saving..." : "Save Change Order"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Change Order History ({changeOrders.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {changeOrders.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">No change orders have been added yet.</p>
              ) : changeOrders.map(changeOrder => {
                const accepted = changeOrder.status === "accepted";
                const timestamp = accepted ? changeOrder.acceptedAt : changeOrder.createdAt;
                return (
                  <div key={changeOrder.id} className="rounded-lg border border-border p-3 sm:p-4 space-y-3" data-testid={`card-change-order-${changeOrder.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm break-words">{changeOrder.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap break-words">{changeOrder.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`text-sm font-semibold ${changeOrder.type === "credit" ? "text-emerald-700 dark:text-emerald-400" : "text-orange-700 dark:text-orange-400"}`}>
                          {changeOrder.type === "credit" ? "Credit " : "Addition "}{changeOrder.amount}
                        </span>
                        <Badge variant={accepted ? "default" : changeOrder.status === "declined" ? "destructive" : "secondary"} className="capitalize text-[10px]">
                          {changeOrder.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <p className="text-xs text-muted-foreground">
                        {timestamp ? `${accepted ? "Accepted" : "Created"} ${new Date(timestamp * 1000).toLocaleString()}` : "Created just now"}
                        {accepted && changeOrder.signedByName ? ` by ${changeOrder.signedByName}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {changeOrder.status === "pending" && (
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => sendChangeOrder(changeOrder)} disabled={sendingChangeOrderId === changeOrder.id} data-testid={`button-email-change-order-${changeOrder.id}`}>
                            <Mail className="w-3.5 h-3.5" /> {sendingChangeOrderId === changeOrder.id ? "Sending..." : "Email Customer"}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive" onClick={() => deleteChangeOrder(changeOrder.id)} data-testid={`button-delete-change-order-${changeOrder.id}`} aria-label={`Delete ${changeOrder.title}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {accepted && changeOrder.customerSignature && (
                      <div className="border-t border-border/60 pt-3">
                        <p className="text-[11px] font-medium text-muted-foreground">Customer signature</p>
                        <img src={changeOrder.customerSignature} alt={`Signature from ${changeOrder.signedByName || "customer"}`} className="mt-1 h-12 max-w-[180px] object-contain object-left" />
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="upgrade-menu" className="mt-4"><UpgradeMenuPanel proposalId={proposalId} /></TabsContent>
        <TabsContent value="job-photos" className="mt-4"><JobPhotosPanel proposalId={proposalId} /></TabsContent>
        <TabsContent value="ai-roof" className="mt-4"><AiRoofPanel proposalId={proposalId} privateNotes={ed.privateNotes} /></TabsContent>
        <TabsContent value="email-schedule" className="mt-4"><EmailSchedulePanel proposalId={proposalId} /></TabsContent>
      </Tabs>
    </div>
  );
}
