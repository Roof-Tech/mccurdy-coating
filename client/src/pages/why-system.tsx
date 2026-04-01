import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Shield, Zap, DollarSign, Clock, Droplets } from "lucide-react";
import { useEffect } from "react";
import { PageNavigation } from "@/components/page-navigation";

const issueIcons = [AlertTriangle, Droplets, Droplets, Zap, Shield];

export default function WhySystem() {
  const { proposal, trackEvent } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "why-system" }); }, []);

  if (!proposal) return null;

  const reasons = proposal.whyRecommended ? JSON.parse(proposal.whyRecommended) : [];
  const issues = proposal.keyIssues ? JSON.parse(proposal.keyIssues) : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-why-system">
      <PageHeader
        title="Why This System Was Chosen"
        subtitle="The logic behind our recommendation for your property"
        icon={<Shield className="w-5 h-5" />}
      />

      {/* ── Current Condition ── */}
      {proposal.currentCondition && (
        <Card className="glass-card border-0 overflow-hidden">
          <div className="p-5 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground">Current Roof Condition</h3>
          </div>
          <CardContent className="p-5">
            <p className="text-sm leading-relaxed text-foreground/80">{proposal.currentCondition}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Key Issues ── */}
      {issues.length > 0 && (
        <Card className="glass-card border-0 overflow-hidden border-l-4 border-l-amber-500/60">
          <div className="p-5 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Key Issues Identified
            </h3>
          </div>
          <CardContent className="p-5">
            <div className="space-y-3 stagger-children">
              {issues.map((issue: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/10">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-amber-600">{i + 1}</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{issue}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Why We Recommend This System ── */}
      {reasons.length > 0 && (
        <Card className="glass-card border-0 overflow-hidden border-l-4 border-l-green-500/60">
          <div className="p-5 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Why We Recommend This System
            </h3>
          </div>
          <CardContent className="p-5">
            <div className="space-y-3 stagger-children">
              {reasons.map((reason: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-green-500/[0.04] border border-green-500/10">
                  <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <PageNavigation />
    </div>
  );
}
