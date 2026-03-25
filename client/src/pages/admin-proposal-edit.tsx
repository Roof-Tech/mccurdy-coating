import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRoute, Link } from "wouter";
import { FileText, Upload, Trash2, ArrowLeft, File, Image, FileSpreadsheet, Eye, Plus, X, Sparkles } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import type { Proposal, Material, Document as DocType, WarrantyDocument, ProposalImage } from "@shared/schema";

function FileIcon({ mime, name }: { mime?: string; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="w-5 h-5 text-red-500" />;
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return <Image className="w-5 h-5 text-blue-500" />;
  if (["xls", "xlsx", "csv"].includes(ext || "")) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
}

function UploadZone({ onUpload, label, accept }: { onUpload: (file: File) => void; label: string; accept?: string }) {
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
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
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
        accept={accept || ".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt"}
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = ""; }}
      />
    </div>
  );
}

function AITransformSection({ proposalId, images }: { proposalId: number; images: ProposalImage[] }) {
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
            {totalAi} AI preview{totalAi > 1 ? "s" : ""} ready
          </Badge>
        )}
      </div>

      {totalAi > 0 ? (
        <p className="text-xs text-muted-foreground">
          AI previews are generated and ready. Customers will see an interactive before/after slider.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Before photos uploaded. AI transformation previews will be generated and added by McCurdy's AI service.
          The customer will see an interactive before/after slider once previews are ready.
        </p>
      )}

      {beforeImages.map(img => {
        const hasWhite = aiWhiteImages.some(ai => ai.caption?.includes(`source:${img.id}`));
        const hasGray = aiGrayImages.some(ai => ai.caption?.includes(`source:${img.id}`));
        const whiteImg = aiWhiteImages.find(ai => ai.caption?.includes(`source:${img.id}`));
        const grayImg = aiGrayImages.find(ai => ai.caption?.includes(`source:${img.id}`));

        return (
          <div key={img.id} className="flex items-center gap-3 p-2 rounded-md bg-background border">
            <img src={img.imageUrl} alt="" className="w-16 h-12 rounded object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{img.caption || "Before photo"}</p>
              <div className="flex gap-1 mt-1">
                {hasWhite ? (
                  <Badge className="text-[8px] px-1.5 h-4 bg-white text-green-700 border border-green-300">White ✓</Badge>
                ) : (
                  <Badge variant="outline" className="text-[8px] px-1.5 h-4 text-muted-foreground">White — pending</Badge>
                )}
                {hasGray ? (
                  <Badge className="text-[8px] px-1.5 h-4 bg-gray-400 text-white">Gray ✓</Badge>
                ) : (
                  <Badge variant="outline" className="text-[8px] px-1.5 h-4 text-muted-foreground">Gray — pending</Badge>
                )}
              </div>
            </div>
            {/* Show AI image thumbnails if available */}
            <div className="flex gap-1.5 flex-shrink-0">
              {whiteImg && (
                <img src={whiteImg.imageUrl} alt="White AI" className="w-12 h-9 rounded object-cover border border-green-300" />
              )}
              {grayImg && (
                <img src={grayImg.imageUrl} alt="Gray AI" className="w-12 h-9 rounded object-cover border border-gray-400" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminProposalEdit() {
  const [, params] = useRoute("/admin/proposals/:id");
  const proposalId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string>("proposal");

  // Fetch proposal data
  const { data: proposal } = useQuery<Proposal>({
    queryKey: ["/api/admin/proposals", proposalId],
    queryFn: () => apiRequest("GET", `/api/admin/proposals/${proposalId}`).then(r => r.json()),
    enabled: !!proposalId,
  });

  // Fetch related data
  const { data: documents = [] } = useQuery<DocType[]>({
    queryKey: ["/api/admin/proposals", proposalId, "documents"],
    queryFn: () => apiRequest("GET", `/api/admin/proposals/${proposalId}/documents`).then(r => r.json()),
    enabled: !!proposalId,
  });

  const { data: materials = [] } = useQuery<Material[]>({
    queryKey: ["/api/admin/proposals", proposalId, "materials"],
    queryFn: () => apiRequest("GET", `/api/admin/proposals/${proposalId}/materials`).then(r => r.json()),
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

  // Documents CRUD route
  const addDocRoute = "/api/admin/documents";
  const delDocRoute = (id: number) => `/api/admin/documents/${id}`;
  const addImgRoute = "/api/admin/images";
  const delImgRoute = (id: number) => `/api/admin/images/${id}`;
  const addWarrantyRoute = "/api/admin/warranty-docs";
  const delWarrantyRoute = (id: number) => `/api/admin/warranty-docs/${id}`;

  // Upload file handler
  const handleUpload = async (file: File, category: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

      // Create the appropriate record based on category
      if (category === "photo_before" || category === "photo_after") {
        await apiRequest("POST", addImgRoute, {
          proposalId,
          imageType: category === "photo_before" ? "before" : "after",
          imageUrl: uploadData.url,
          caption: file.name,
          sortOrder: images.length,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "images"] });
      } else if (category === "warranty") {
        await apiRequest("POST", addWarrantyRoute, {
          proposalId,
          title: file.name.replace(/\.[^.]+$/, ""),
          documentUrl: uploadData.url,
          documentType: "manufacturer",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "warranty-docs"] });
      } else {
        await apiRequest("POST", addDocRoute, {
          proposalId,
          title: file.name.replace(/\.[^.]+$/, ""),
          category,
          documentUrl: uploadData.url,
          description: `Uploaded ${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
          sortOrder: documents.length,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "documents"] });
      }

      toast({ title: "File uploaded", description: `${file.name} added to ${category.replace(/_/g, " ")}` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  // Delete handlers
  const deleteDocument = async (id: number) => {
    await apiRequest("DELETE", delDocRoute(id));
    queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "documents"] });
    toast({ title: "Document removed" });
  };

  const deleteImage = async (id: number) => {
    await apiRequest("DELETE", delImgRoute(id));
    queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "images"] });
    toast({ title: "Image removed" });
  };

  const deleteWarrantyDoc = async (id: number) => {
    await apiRequest("DELETE", delWarrantyRoute(id));
    queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals", proposalId, "warranty-docs"] });
    toast({ title: "Warranty document removed" });
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
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="page-admin-proposal-edit">
      <div className="flex items-center gap-3">
        <Link href="/admin/proposals">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" data-testid="button-back">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
        </Link>
        <div className="flex-1">
          <PageHeader
            title={`Manage: ${proposal.customerName}`}
            subtitle={`${proposal.proposalNumber} — ${proposal.propertyAddress}`}
            icon={<FileText className="w-5 h-5" />}
          />
        </div>
        <a href={`/#/view/${proposal.accessToken}`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" data-testid="button-preview">
            <Eye className="w-3.5 h-3.5" /> Preview
          </Button>
        </a>
      </div>

      {/* Proposal Info Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Status</span>
              <div><Badge variant="outline" className="text-[10px] capitalize mt-0.5">{proposal.status.replace("_", " ")}</Badge></div>
            </div>
            <div>
              <span className="text-muted-foreground">County</span>
              <div className="font-medium mt-0.5">{proposal.county || "Not set"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">System</span>
              <div className="font-medium mt-0.5">{proposal.systemType || "Not set"}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Date</span>
              <div className="font-medium mt-0.5">{proposal.proposalDate}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Upload Files
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
            label={`Upload ${docCategories.find(c => c.value === uploadCategory)?.label || uploadCategory} files`}
            onUpload={(file) => handleUpload(file, uploadCategory)}
          />
          {uploading && <p className="text-xs text-muted-foreground text-center animate-pulse">Uploading file...</p>}
        </CardContent>
      </Card>

      {/* Documents List */}
      {documents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Documents ({documents.length})
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
                    {doc.description && <span className="text-[10px] text-muted-foreground truncate">{doc.description}</span>}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {doc.documentUrl && (
                    <a href={doc.documentUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="w-3.5 h-3.5" /></Button>
                    </a>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteDocument(doc.id)} data-testid={`button-delete-doc-${doc.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Before/After Images */}
      {images.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Image className="w-4 h-4 text-primary" />
              Before/After Images ({images.length})
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
                      className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteImage(img.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remove
                    </Button>
                  </div>
                  <div className="p-2">
                    <Badge variant="outline" className="text-[9px]">{img.imageType}</Badge>
                    {img.caption && <span className="text-[10px] text-muted-foreground ml-1">{img.caption}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Transformation Generator */}
            <AITransformSection proposalId={proposalId} images={images} />
          </CardContent>
        </Card>
      )}

      {/* Warranty Documents */}
      {warrantyDocs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Warranty Documents ({warrantyDocs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {warrantyDocs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group" data-testid={`row-warranty-${doc.id}`}>
                <FileText className="w-5 h-5 text-amber-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  {doc.documentType && <Badge variant="outline" className="text-[9px]">{doc.documentType}</Badge>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {doc.documentUrl && (
                    <a href={doc.documentUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="w-3.5 h-3.5" /></Button>
                    </a>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteWarrantyDoc(doc.id)} data-testid={`button-delete-warranty-${doc.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
