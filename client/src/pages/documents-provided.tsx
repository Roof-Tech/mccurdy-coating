import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen, FileText, FileSignature, Receipt, CreditCard,
  FileSpreadsheet, Shield, Wrench, Camera, Scale, Calculator, CheckCircle
} from "lucide-react";
import { useEffect } from "react";
import { PageNavigation } from "@/components/page-navigation";

const documentItems = [
  { name: "Proposal", desc: "Complete project proposal with scope and pricing", icon: FileText, status: "included" },
  { name: "Contract", desc: "Project agreement for signature", icon: FileSignature, status: "included" },
  { name: "Invoice", desc: "Detailed project invoice", icon: Receipt, status: "included" },
  { name: "Proof of Payment", desc: "Deposit and payment receipts", icon: CreditCard, status: "upon-payment" },
  { name: "Product Data Sheets", desc: "Manufacturer technical data for all materials", icon: FileSpreadsheet, status: "included" },
  { name: "Warranty Documents", desc: "Manufacturer and workmanship warranty certificates", icon: Shield, status: "upon-completion" },
  { name: "Installation Summary", desc: "System specification and installation details", icon: Wrench, status: "upon-completion" },
  { name: "Project Photos", desc: "Before, during, and after documentation", icon: Camera, status: "upon-completion" },
  { name: "Compliance Documents", desc: "Title 24 and code compliance paperwork (if applicable)", icon: Scale, status: "if-applicable" },
  { name: "Accounting Checklist", desc: "Document checklist for CPA/tax purposes", icon: Calculator, status: "included" },
];

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  "included": { label: "Included", variant: "default" },
  "upon-payment": { label: "Upon Payment", variant: "secondary" },
  "upon-completion": { label: "Upon Completion", variant: "secondary" },
  "if-applicable": { label: "If Applicable", variant: "outline" },
};

export default function DocumentsProvided() {
  const { trackEvent } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "documents" }); }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-documents">
      <PageHeader
        title="Documents McCurdy Will Provide"
        subtitle="Complete documentation delivered with your project"
        icon={<FolderOpen className="w-5 h-5" />}
      />

      <ScrollReveal delay={100}>
      <Card className="glass-card border-0 overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-accent" />
            Document Checklist
          </h3>
        </div>
        <div className="divide-y divide-border/20">
          {documentItems.map((doc, i) => {
            const status = statusLabels[doc.status];
            return (
              <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                  <doc.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{doc.desc}</p>
                </div>
                <Badge variant={status.variant} className="text-[10px] flex-shrink-0">
                  {status.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </Card>
      </ScrollReveal>
      <PageNavigation />
    </div>
  );
}
