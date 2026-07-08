import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, Mail, Share2, Copy, FileText, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function FormsPrint() {
  const { trackEvent } = useProposal();
  const { toast } = useToast();
  useEffect(() => { trackEvent("viewed", { page: "forms" }); }, []);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopiedLink(true);
      toast({ title: "Link Copied", description: "Proposal link copied to clipboard." });
      setTimeout(() => setCopiedLink(false), 2000);
    }).catch(() => {});
  };

  const handleShareWithCPA = () => {
    const url = window.location.href;
    const subject = encodeURIComponent("McCurdy Roofing — Proposal for Your Review");
    const body = encodeURIComponent(`Please review this roofing proposal:\n\n${url}\n\nThis proposal includes pricing options, tax incentives, and warranty information that may be relevant for your review.`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleShareWithPartner = () => {
    const url = window.location.href;
    const subject = encodeURIComponent("McCurdy Roofing — Proposal");
    const body = encodeURIComponent(`Here is the roofing proposal for review:\n\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const records = [
    "Signed proposal/contract",
    "Proof of payment/deposit receipts",
    "Product data sheets",
    "Warranty documents",
    "Before/after project photos",
    "Compliance documentation (if applicable)",
    "Final invoice",
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-forms">
      <PageHeader
        title="Forms & Print Center"
        subtitle="Download, print, and share proposal documents"
        icon={<Printer className="w-5 h-5" />}
      />

      {/* Quick Actions */}
      <Card className="glass-card border-0">
        <div className="p-5 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
        </div>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Share with CPA", icon: Mail, action: handleShareWithCPA },
              { label: "Share with Partner", icon: Share2, action: handleShareWithPartner },
              { label: "Copy Link", icon: copiedLink ? Check : Copy, action: handleCopyLink },
              { label: "Print Page", icon: Printer, action: () => window.print() },
            ].map((btn) => (
              <Button
                key={btn.label}
                variant="outline"
                className="h-auto py-3 flex flex-col items-center gap-2 text-xs hover:bg-primary/5 hover:border-primary/30 transition-all"
                onClick={btn.action}
                data-testid={`button-${btn.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <btn.icon className="w-4 h-4 text-primary" />
                {btn.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Records to Save */}
      <Card className="glass-card border-0">
        <div className="p-5 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent" />
            Records to Save
          </h3>
        </div>
        <CardContent className="p-5">
          <div className="space-y-3">
            {records.map((record, i) => (
              <label key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
                <Checkbox id={`record-${i}`} />
                <span className="text-sm text-foreground/80">{record}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
