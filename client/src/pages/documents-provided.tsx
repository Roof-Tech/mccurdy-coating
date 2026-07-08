import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderOpen, FileText, FileSignature, Receipt, CreditCard,
  FileSpreadsheet, Shield, Wrench, Camera, Scale, Calculator,
  Download, File, Image as ImageIcon, CheckCircle2, Package,
} from "lucide-react";
import { useEffect } from "react";

const categoryLabels: Record<string, { label: string; icon: any }> = {
  proposal: { label: "Proposal / Quote", icon: FileText },
  contract: { label: "Contract", icon: FileSignature },
  invoice: { label: "Invoice", icon: Receipt },
  data_sheet: { label: "Data Sheet / TDS", icon: FileSpreadsheet },
  warranty: { label: "Warranty Document", icon: Shield },
  compliance: { label: "Compliance / Title 24", icon: Scale },
  checklist: { label: "Checklist / Inspection", icon: CheckCircle2 },
  form: { label: "Form / Permit", icon: FileText },
  photo_before: { label: "Before Photo", icon: Camera },
  photo_after: { label: "After Photo", icon: Camera },
};

function iconForCategory(cat: string) {
  return categoryLabels[cat]?.icon || File;
}

function fileExtension(url: string): string {
  const m = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return m ? m[1].toUpperCase() : "FILE";
}

function isImage(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

export default function DocumentsProvided() {
  const { trackEvent, documents, warrantyDocs, proposal, images } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "documents" }); }, []);

  // Combine documents + warranty docs + after photos into unified downloadable list
  const allFiles = [
    ...documents.map(d => ({
      id: `d-${d.id}`,
      title: d.title,
      description: d.description || "",
      url: d.documentUrl || "",
      category: d.category,
      type: "document" as const,
    })),
    ...warrantyDocs.map(w => ({
      id: `w-${w.id}`,
      title: w.title,
      description: (w as any).description || "Warranty document",
      url: w.documentUrl || "",
      category: "warranty",
      type: "warranty" as const,
    })),
  ].filter(f => f.url);

  const afterPhotos = images.filter(i => i.imageType === "after");
  const beforePhotos = images.filter(i => i.imageType === "before");

  const handleDownload = (url: string, title: string) => {
    trackEvent("downloaded", { url, title });
    // trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = title;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="page-documents">
      <PageHeader
        title="Your Project Documents"
        subtitle="Download, save, and forward — everything organized in one place, forever"
        icon={<FolderOpen className="w-5 h-5" />}
      />

      {/* Records vault callout */}
      <Card className="bg-gradient-to-br from-primary/8 to-primary/2 border-primary/20">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/12 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground mb-1">Your Records Vault</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This portal is your permanent record. Bookmark this page for yearly maintenance reminders,
              warranty claims, tax preparation, and if your building's maintenance team ever changes.
              Every document below is downloadable and forwardable.
            </p>
            {proposal && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px] font-mono">{proposal.proposalNumber}</Badge>
                <Badge variant="outline" className="text-[10px]">{allFiles.length + afterPhotos.length + beforePhotos.length} files available</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Files list */}
      {allFiles.length === 0 && afterPhotos.length === 0 && beforePhotos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Documents coming soon</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your project files, warranties, and photos will appear here as your project progresses.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {allFiles.length > 0 && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border/50 bg-muted/20">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Documents ({allFiles.length})
                </h3>
              </div>
              <div className="divide-y divide-border/40">
                {allFiles.map((f) => {
                  const Icon = iconForCategory(f.category);
                  const ext = fileExtension(f.url);
                  const catLabel = categoryLabels[f.category]?.label || f.category;
                  return (
                    <div key={f.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors" data-testid={`file-${f.id}`}>
                      <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{f.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[9px] py-0 h-4">{ext}</Badge>
                          <span className="text-[11px] text-muted-foreground">{catLabel}</span>
                        </div>
                        {f.description && (
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">{f.description}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 gap-1.5 flex-shrink-0"
                        onClick={() => handleDownload(f.url, f.title)}
                        data-testid={`button-download-${f.id}`}
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Photos section */}
          {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border/50 bg-muted/20">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" />
                  Project Photos ({beforePhotos.length + afterPhotos.length})
                </h3>
              </div>
              <div className="p-5 space-y-5">
                {beforePhotos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Before ({beforePhotos.length})</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {beforePhotos.map(img => (
                        <a
                          key={img.id}
                          href={img.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-square rounded-lg overflow-hidden bg-muted/40 hover:ring-2 hover:ring-primary/40 transition-all"
                        >
                          <img src={img.imageUrl} alt={img.caption || "Before"} className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Download className="w-5 h-5 text-white" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {afterPhotos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">After ({afterPhotos.length})</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {afterPhotos.map(img => (
                        <a
                          key={img.id}
                          href={img.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-square rounded-lg overflow-hidden bg-muted/40 hover:ring-2 hover:ring-primary/40 transition-all"
                        >
                          <img src={img.imageUrl} alt={img.caption || "After"} className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <Download className="w-5 h-5 text-white" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Contact reminder */}
      <Card className="bg-muted/20">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Need a document you don't see here? Contact <strong className="text-foreground">Mike Schirmer</strong> at{" "}
            <a href="tel:6509520233" className="text-primary hover:underline">(650) 952-0233</a> or{" "}
            <a href="mailto:mschirmer1922@gmail.com" className="text-primary hover:underline">mschirmer1922@gmail.com</a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
