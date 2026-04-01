import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Info, Target } from "lucide-react";
import { useEffect } from "react";
import { PageNavigation } from "@/components/page-navigation";

export default function MilsBuild() {
  const { proposal, trackEvent } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "mils-build" }); }, []);
  if (!proposal) return null;

  const layers = [
    { name: "Primer", mils: proposal.primerMils || "2-3 dry mils", color: "copper-gradient", desc: "Adhesion promoter applied to prepared substrate" },
    { name: "Base Coat", mils: proposal.baseCoatMils || "Varies by warranty tier", color: "bg-primary", desc: "Primary waterproofing layer" },
    { name: "Top Coat", mils: proposal.topCoatMils || "Varies by warranty tier", color: "bg-primary/80", desc: "UV protection and reflective finish coat" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-mils">
      <PageHeader
        title="Mil Thickness & System Build"
        subtitle="Understanding coating thickness and what it means for your roof"
        icon={<Layers className="w-5 h-5" />}
      />

      {/* Layer Breakdown */}
      <ScrollReveal delay={100}>
      <Card className="glass-card border-0">
        <div className="p-5 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground">Layer Breakdown</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          {layers.map((layer, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-foreground">{layer.name}</span>
                <span className="text-xs font-bold text-accent">{layer.mils}</span>
              </div>
              <div className="h-3 rounded-full bg-muted/40 overflow-hidden">
                <div className={`h-full rounded-full ${layer.color} transition-all duration-700`}
                  style={{ width: i === 0 ? '25%' : '100%' }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{layer.desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      </ScrollReveal>

      {/* Total Dry Mil Target */}
      <ScrollReveal delay={200}>
      {proposal.totalDryMils && (
        <div className="relative overflow-hidden rounded-xl premium-gradient premium-card p-6">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/[0.03]" />
          </div>
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-white/80" />
            </div>
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wider flex items-center gap-1">
                Total Dry Mil Target <Info className="w-3 h-3" />
              </p>
              <p className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300 mt-0.5">
                {proposal.totalDryMils}
              </p>
            </div>
          </div>
        </div>
      )}
      </ScrollReveal>

      {/* Layer count */}
      <div className="glass-card rounded-xl p-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Number of Coats/Layers</span>
        <Badge variant="secondary" className="text-sm font-bold">{proposal.layerCount || 3}</Badge>
      </div>

      {/* Explanation */}
      {proposal.milsExplanation && (
        <Card className="glass-card border-0">
          <div className="p-5 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground">What Thickness Means for Performance</h3>
          </div>
          <CardContent className="p-5">
            <p className="text-sm text-foreground/80 leading-relaxed">{proposal.milsExplanation}</p>
          </CardContent>
        </Card>
      )}
      <PageNavigation />
    </div>
  );
}
