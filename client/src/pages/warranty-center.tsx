import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Clock, Award, FileCheck, Wrench, Calendar } from "lucide-react";
import { useEffect } from "react";
import { PageNavigation } from "@/components/page-navigation";
import { ScrollReveal } from "@/components/scroll-reveal";

export default function WarrantyCenter() {
  const { proposal, trackEvent } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "warranty" }); }, []);
  if (!proposal) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-warranty">
      <PageHeader
        title="Warranty Center"
        subtitle="Your warranty coverage and what it means"
        icon={<Shield className="w-5 h-5" />}
      />

      {/* ── Warranty Duration Hero ── */}
      {proposal.warrantyTerm && (
        <div className="relative overflow-hidden rounded-xl premium-gradient p-6">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/[0.03]" />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-accent/5 -translate-x-1/4 translate-y-1/4" />
          </div>
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Clock className="w-7 h-7 text-white/80" />
            </div>
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wider font-medium">Warranty Duration</p>
              <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300 mt-0.5">
                {proposal.warrantyTerm}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Warranty Cards Grid ── */}
      <ScrollReveal delay={100}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
        {/* Manufacturer Warranty */}
        <Card className="premium-card border-0 overflow-hidden">
          <div className="h-1 copper-gradient" />
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Award className="w-4 h-4 text-accent" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Manufacturer Warranty</h3>
            </div>
            <p className="text-sm text-foreground/75 leading-relaxed">{proposal.manufacturerWarranty}</p>
          </CardContent>
        </Card>

        {/* Workmanship Warranty */}
        <Card className="premium-card border-0 overflow-hidden">
          <div className="h-1 bg-primary" />
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wrench className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Workmanship Warranty</h3>
            </div>
            <p className="text-sm text-foreground/75 leading-relaxed">{proposal.workmanshipWarranty}</p>
          </CardContent>
        </Card>
      </div>
      </ScrollReveal>
      {/* ── NDL Coverage ── */}
      {proposal.ndlWarranty && (
        <ScrollReveal delay={200}>
        <Card className="premium-card border-0 overflow-hidden border-l-4 border-l-accent animate-border-glow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <FileCheck className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">NDL Coverage</h3>
                <p className="text-[10px] text-accent uppercase tracking-wider">No Dollar Limit</p>
              </div>
            </div>
            <p className="text-sm text-foreground/75 leading-relaxed">{proposal.ndlWarranty}</p>
          </CardContent>
        </Card>
        </ScrollReveal>
      )}

      {/* ── Warranty Summary ── */}
      {proposal.warrantySummary && (
        <ScrollReveal delay={300}>
        <Card className="premium-card border-0">
          <div className="p-5 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground">Warranty Summary</h3>
          </div>
          <CardContent className="p-5">
            <p className="text-sm text-foreground/75 leading-relaxed">{proposal.warrantySummary}</p>
          </CardContent>
        </Card>
        </ScrollReveal>
      )}

      {/* ── Maintenance Requirements ── */}
      {proposal.warrantyMaintenance && (
        <ScrollReveal delay={400}>
        <Card className="premium-card border-0">
          <div className="p-5 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Maintenance Requirements
            </h3>
          </div>
          <CardContent className="p-5">
            <p className="text-sm text-foreground/75 leading-relaxed">{proposal.warrantyMaintenance}</p>
          </CardContent>
        </Card>
        </ScrollReveal>
      )}
      <PageNavigation />
    </div>
  );
}
