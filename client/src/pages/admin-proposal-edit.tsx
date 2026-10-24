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
import { useRoute } from "wouter";
import {
  FileText, Upload, Trash2, ArrowLeft, File, Image, FileSpreadsheet,
  Eye, X, Sparkles, Plus, Save, Check, Copy, Loader2, Star,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import type { Proposal, Material, Document as DocType, WarrantyDocument, ProposalImage } from "@shared/schema";

// ── Helpers ────────────────────────────────────────────────────

function tryParseArray(json: string | null | undefined): string[] {
  try {
    const arr = JSON.parse(json || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function toLines(json: string | null | undefined): string {
  return tryParseArray(json).join("\n");
}

function fromLines(text: string): string {
  return JSON.stringify((text || "").split("\n").filter(s => s.trim()));
}

// Pass url (actual file URL) so the extension is readable even when title has no extension
function FileIcon({ name, url }: { name: string; url?: string }) {
  const source = url || name;
  const ext = source.split(".").pop()?.toLowerCase().split("?")[0];
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

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Ignore leave events when cursor moves over a child element
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragging(false);
  }, []);

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid="upload-zone"
    >
      <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">Drag & drop or click to browse</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">PDF, images, Word, Excel — up to 50 MB</p>
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
  id: string;
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
  const handleRemove = () => {
    if (!window.confirm("Remove this pricing tier? This cannot be undone.")) return;
    onRemove();
  };

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
            <Badge className="text-[10px] h-4 bg-accent text-white border-0 flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 fill-current" /> Recommended
            </Badge>
          )}
        </label>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          onClick={handleRemove}
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

const IMAGE_TYPE_LABELS: Record<string, string> = {
  before: "Before",
  after: "After",
  comparison: "Comparison",
  ai_white: "AI White",
  ai_gray: "AI Gray",
};

function AITransformSection({ images }: { images: ProposalImage[] }) {
  const beforeImages = images.filter(img => img.imageType === "before");
  const aiImages = images.filter(img => img.imageType === "ai_white" || img.imageType === "ai_gray");
  if (beforeImages.length === 0) return null;
  const totalAi = aiImages.length;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-600" />
        <h4 className="text-sm font-semibold text-foreground">AI Roof Transformation</h4>
        {totalAi > 0 && (
          <Badge className="text-[10px] h-4 bg-green-100 text-green-800 border-green-300">
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
  const proposalId = parseInt(params?.id || "0", 10);
  const { toast } = useToast();

  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("proposal");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Content editing state — flat string map (JSON arrays stored as line-separated text)
  const [ed, setEd] = useState<Record<string, string>>({});
  const [pricingOpts, setPricingOpts] = useState<PricingOption[]>([]);
  const edInitialized = useRef(false);

  const setField = (field: string, value: string) => {
    setIsDirty(true);
    setEd(prev => ({ ...prev, [field]: value }));
  };

  // ── Reset init flag when navigating to a different proposal ──
  useEffect(() => {
    edInitialized.current = false;
    setIsDirty(false);
  }, [proposalId]);

  // ── Warn on unsaved changes ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["/api/admin/proposals", proposalId, "materials"],
    queryFn: () => apiRequest("GET", `/api/admin/proposals/${proposalId}/materials`).then(r => r.json()),
    enabled: !!proposalId,
  });

  // ── Initialize edit state from proposal (once per proposal ID) ──
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
      // Coating system details
      coatingType: proposal.coatingType || "",
      primer: proposal.primer || "",
      baseCoat: proposal.baseCoat || "",
      topCoat: proposal.topCoat || "",
      reinforcement: proposal.reinforcement || "",
      // Warranty
      warrantyTerm: proposal.warrantyTerm || "",
      manufacturerWarranty: proposal.manufacturerWarranty || "",
      workmanshipWarranty: proposal.workmanshipWarranty || "",
      ndlWarranty: proposal.ndlWarranty || "",
      warrantySummary: proposal.warrantySummary || "",
      warrantyMaintenance: proposal.warrantyMaintenance || "",
      // Payment
      paymentSchedule: proposal.paymentSchedule || "",
      financingNotes: proposal.financingNotes || "",
      // JSON arrays as newline-separated text
      roofAreas: toLines(proposal.roofAreas),
      whyRecommended: toLines(proposal.whyRecommended),
      keyIssues: toLines(proposal.keyIssues),
      addOns: toLines(proposal.addOns),
      alternateColors: toLines(proposal.alternateColors),
      accessories: toLines(proposal.accessories),
    });
    try {
      const opts: Omit<PricingOption, "id">[] = JSON.parse(proposal.pricingOptions || "[]");
      setPricingOpts(
        Array.isArray(opts)
          ? opts.map(o => ({ ...o, id: (o as any).id || crypto.randomUUID() }))
          : []
      );
    } catch {
      setPricingOpts([]);
    }
  }, [proposal]);

  // ── Save content ──
  const handleSave = async () => {
    setSaving(true);
    // Destructure line-text fields so they don't overwrite the serialized JSON versions below
    const {
      roofAreas: _ra, whyRecommended: _wr, keyIssues: _ki,
      addOns: _ao, alternateColors: _ac, accessories: _acc,
      ...restEd
    } = ed;
    try {
      await apiRequest("PATCH", `/api/admin/proposals/${proposalId}`, {
        ...restEd,
        pricingOptions: JSON.stringify(pricingOpts),
        roofAreas: fromLines(ed.roofAreas),
        whyRecommended: fromLines(ed.whyRecommended),
        keyIssues: fromLines(ed.keyIssues),
        addOns: fromLines(ed.addOns),
        alternateColors: fromLines(ed.alternateColors),
        accessories: fromLines(ed.accessories),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId] });
      toast({ title: "Saved", description: "All changes saved successfully." });
      setSaved(true);
      setIsDirty(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Pricing tier helpers ──
  const addPricingTier = () => {
    setIsDirty(true);
    setPricingOpts(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
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
    setIsDirty(true);
    setPricingOpts(prev => {
      const next = [...prev];
      next[i] = { ...next[i], ...updates };
      return next;
    });
  };

  const removePricingTier = (i: number) => {
    setIsDirty(true);
    setPricingOpts(prev => prev.filter((_, idx) => idx !== i));
  };

  // ── File upload ──
  const handleUpload = async (file: File, category: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: formData });
      let uploadData: any;
      try {
        uploadData = await uploadRes.json();
      } catch {
        throw new Error(`Upload failed: ${uploadRes.statusText}`);
      }
      if (!uploadRes.ok) throw new Error(uploadData?.error || "Upload failed");

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
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (id: number) => {
    if (!window.confirm("Remove this document? This cannot be undone.")) return;
    try {
      await apiRequest("DELETE", `/api/admin/documents/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "documents"] });
      toast({ title: "Document removed" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const deleteImage = async (id: number) => {
    if (!window.confirm("Remove this image? This cannot be undone.")) return;
    try {
      await apiRequest("DELETE", `/api/admin/images/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "images"] });
      toast({ title: "Image removed" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const deleteWarrantyDoc = async (id: number) => {
    if (!window.confirm("Remove this warranty document? This cannot be undone.")) return;
    try {
      await apiRequest("DELETE", `/api/admin/warranty-docs/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "warranty-docs"] });
      toast({ title: "Warranty document removed" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const deleteMaterial = async (id: number) => {
    if (!window.confirm("Remove this material? This cannot be undone.")) return;
    try {
      await apiRequest("DELETE", `/api/admin/materials/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "materials"] });
      toast({ title: "Material removed" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const copyLink = () => {
    if (!proposal) return;
    const url = `${window.location.origin}/#/view/${proposal.accessToken}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() =>
        toast({ title: "Link copied", description: "Customer proposal link copied to clipboard." })
      ).catch(() => {
        toast({ title: "Copy failed", description: `Link: ${url}`, variant: "destructive" });
      });
    } else {
      // Fallback for non-HTTPS contexts
      try {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast({ title: "Link copied", description: "Customer proposal link copied to clipboard." });
      } catch {
        toast({ title: "Copy link", description: url });
      }
    }
  };

  if (!proposalId) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p className="text-sm text-destructive">Invalid proposal ID.</p>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading proposal...
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

  const docCategoryLabel = (val: string) =>
    docCategories.find(c => c.value === val)?.label ?? val.replace(/_/g, " ");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5" data-testid="page-admin-proposal-edit">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <a
          href="/#/admin/proposals"
          className="inline-flex items-center gap-1.5 h-8 px-2 text-xs font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </a>
        <div className="flex-1">
          <PageHeader
            title={proposal.customerName}
            subtitle={`${proposal.proposalNumber} — ${proposal.propertyAddress}`}
            icon={<FileText className="w-5 h-5" />}
          />
        </div>
        <div className="flex gap-2">
          {isDirty && (
            <span className="text-[10px] text-amber-600 self-center font-medium">Unsaved changes</span>
          )}
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={copyLink}>
            <Copy className="w-3.5 h-3.5" /> Copy Link
          </Button>
          <a
            href={`/#/view/${proposal.accessToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium border border-border rounded-md bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            data-testid="button-preview"
          >
            <Eye className="w-3.5 h-3.5" /> Preview
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
              <div className="font-medium mt-1">{ed.county || proposal.county || "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">System</span>
              <div className="font-medium mt-1 truncate">{ed.systemType || proposal.systemType || "—"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Date</span>
              <div className="font-medium mt-1">{ed.proposalDate || proposal.proposalDate}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content" className="gap-1.5 text-xs">
            <FileText className="w-3.5 h-3.5" /> Content
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Files & Media
          </TabsTrigger>
          <TabsTrigger value="materials" className="gap-1.5 text-xs">
            <Star className="w-3.5 h-3.5" /> Materials
          </TabsTrigger>
        </TabsList>

        {/* ══ CONTENT TAB ══ */}
        <TabsContent value="content" className="space-y-4 mt-4">

          {/* Customer & Property */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Customer & Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Customer Name</Label>
                  <Input
                    placeholder="John Smith"
                    value={ed.customerName || ""}
                    onChange={e => setField("customerName", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Company Name</Label>
                  <Input
                    placeholder="Smith Industrial LLC"
                    value={ed.companyName || ""}
                    onChange={e => setField("companyName", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Property Address</Label>
                  <Input
                    placeholder="1234 Industrial Blvd, South San Francisco, CA 94080"
                    value={ed.propertyAddress || ""}
                    onChange={e => setField("propertyAddress", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <Input
                    placeholder="South San Francisco"
                    value={ed.city || ""}
                    onChange={e => setField("city", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">County</Label>
                  <Input
                    placeholder="San Mateo"
                    value={ed.county || ""}
                    onChange={e => setField("county", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">State</Label>
                  <Input
                    placeholder="CA"
                    value={ed.state || ""}
                    onChange={e => setField("state", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Utility Territory</Label>
                  <Input
                    placeholder="PG&E"
                    value={ed.utilityTerritory || ""}
                    onChange={e => setField("utilityTerritory", e.target.value)}
                  />
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Proposal Date</Label>
                  <Input
                    type="date"
                    value={ed.proposalDate || ""}
                    onChange={e => setField("proposalDate", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estimator</Label>
                  <Input
                    placeholder="Mike McCurdy"
                    value={ed.estimator || ""}
                    onChange={e => setField("estimator", e.target.value)}
                  />
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
                  placeholder="Thank you for allowing McCurdy Roofing to evaluate your roofing needs..."
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
              <div className="space-y-1.5">
                <Label className="text-xs">Accessories — one per line</Label>
                <Textarea
                  className="min-h-[52px] text-sm"
                  placeholder={"Pitch pans\nFlashing tape\nDrain covers"}
                  value={ed.accessories || ""}
                  onChange={e => setField("accessories", e.target.value)}
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
                  key={opt.id}
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Coating Type</Label>
                  <Input
                    placeholder="ASC Qualifying Silicone Roof Coating"
                    value={ed.coatingType || ""}
                    onChange={e => setField("coatingType", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Primer</Label>
                  <Input
                    placeholder="ASC Silicone Primer"
                    value={ed.primer || ""}
                    onChange={e => setField("primer", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Base Coat</Label>
                  <Input
                    placeholder="ASC Silicone Base Coat"
                    value={ed.baseCoat || ""}
                    onChange={e => setField("baseCoat", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Top Coat</Label>
                  <Input
                    placeholder="ASC Silicone Top Coat"
                    value={ed.topCoat || ""}
                    onChange={e => setField("topCoat", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reinforcement</Label>
                <Input
                  placeholder="Polyester reinforcing fabric at all seams, penetrations, and transitions"
                  value={ed.reinforcement || ""}
                  onChange={e => setField("reinforcement", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Alternate Colors — one per line</Label>
                <Textarea
                  className="min-h-[52px] text-sm"
                  placeholder={"Light Gray\nTan"}
                  value={ed.alternateColors || ""}
                  onChange={e => setField("alternateColors", e.target.value)}
                />
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
                  placeholder="NDL warranty covers 100% of material and labor costs for the full warranty term with no depreciation or dollar cap."
                  value={ed.ndlWarranty || ""}
                  onChange={e => setField("ndlWarranty", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Warranty Summary</Label>
                <Textarea
                  className="min-h-[60px] text-sm"
                  placeholder="Your roof will be covered by an ASC manufacturer warranty matched to the mil thickness of the system installed, plus a McCurdy Roofing workmanship warranty."
                  value={ed.warrantySummary || ""}
                  onChange={e => setField("warrantySummary", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Maintenance Requirements</Label>
                <Textarea
                  className="min-h-[56px] text-sm"
                  placeholder="Annual inspection recommended. McCurdy offers a maintenance program that includes roof inspection, drain clearing, minor touch-up repairs, and warranty compliance documentation."
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
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
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
                <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                </p>
              )}
            </CardContent>
          </Card>

          {/* Empty state when no files exist */}
          {documents.length === 0 && images.length === 0 && warrantyDocs.length === 0 && (
            <p className="text-xs text-center text-muted-foreground py-4">
              No files uploaded yet. Use the categories above to add documents, photos, or warranty paperwork.
            </p>
          )}

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
                    <FileIcon name={doc.title} url={doc.documentUrl || undefined} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{docCategoryLabel(doc.category)}</Badge>
                        {doc.description && (
                          <span className="text-[10px] text-muted-foreground truncate">{doc.description}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                        className="h-7 w-7 p-0 text-destructive"
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
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteImage(img.id)}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Remove
                        </Button>
                      </div>
                      <div className="p-2 flex items-center gap-1 overflow-hidden">
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">
                          {IMAGE_TYPE_LABELS[img.imageType] ?? img.imageType}
                        </Badge>
                        {img.caption && (
                          <span className="text-[10px] text-muted-foreground truncate">{img.caption}</span>
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
                        <Badge variant="outline" className="text-[10px] capitalize">{doc.documentType.replace(/_/g, " ")}</Badge>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                        className="h-7 w-7 p-0 text-destructive"
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

        {/* ══ MATERIALS TAB ══ */}
        <TabsContent value="materials" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Star className="w-4 h-4 text-primary" /> Materials Library ({materials.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {materials.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No materials added yet. Materials are seeded automatically when creating a proposal.
                </p>
              ) : (
                materials
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map(mat => (
                    <div
                      key={mat.id}
                      className="flex items-start gap-3 p-3 rounded-md border bg-muted/20 group"
                      data-testid={`row-material-${mat.id}`}
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{mat.productName}</span>
                          {mat.category && (
                            <Badge variant="outline" className="text-[10px] capitalize">{mat.category.replace(/_/g, " ")}</Badge>
                          )}
                        </div>
                        {mat.manufacturer && (
                          <p className="text-xs text-muted-foreground">{mat.manufacturer}</p>
                        )}
                        {mat.usedFor && (
                          <p className="text-xs text-foreground/70">{mat.usedFor}</p>
                        )}
                        {mat.technicalSummary && (
                          <p className="text-[11px] text-muted-foreground italic">{mat.technicalSummary}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => deleteMaterial(mat.id)}
                        data-testid={`button-delete-material-${mat.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
