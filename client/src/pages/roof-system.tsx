import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { ScrollReveal } from "@/components/scroll-reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Layers, Package, Wrench, Factory } from "lucide-react";
import { useEffect } from "react";
import { PageNavigation } from "@/components/page-navigation";

export default function RoofSystem() {
  const { proposal, trackEvent } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "roof-system" }); }, []);

  if (!proposal) return null;

  const components = [
    { label: "System Type", value: proposal.roofSystemType, icon: Layers },
    { label: "Coating Type", value: proposal.coatingType, icon: Package },
    { label: "Primer", value: proposal.primer, icon: Wrench },
    { label: "Base Coat", value: proposal.baseCoat, icon: Layers },
    { label: "Top Coat", value: proposal.topCoat, icon: Layers },
    { label: "Reinforcement", value: proposal.reinforcement, icon: Wrench },
    { label: "Manufacturer", value: proposal.manufacturerName, icon: Factory },
  ].filter(c => c.value);

  // System build stack layers
  const stackLayers = [
    { name: "Top Coat", detail: proposal.topCoatMils || "Varies by warranty tier", color: "bg-primary" },
    { name: "Base Coat", detail: proposal.baseCoatMils || "Varies by warranty tier", color: "bg-primary/80" },
    { name: "Reinforcement", detail: "Polyester fabric", color: "bg-accent/70" },
    { name: "Primer", detail: proposal.primerMils || "2-3 dry mils", color: "bg-accent" },
    { name: "Existing Roof", detail: "Substrate", color: "bg-muted-foreground/30" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-roof-system">
      <PageHeader
        title="Roof System Details"
        subtitle="Complete system overview and component breakdown"
        icon={<Layers className="w-5 h-5" />}
      />

      {/* System Components Table */}
      <Card className="glass-card border-0 overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Package className="w-4 h-4 text-accent" /> System Components
          </h3>
        </div>
        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {components.map((comp, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <comp.icon className="w-4 h-4 text-muted-foreground/50" />
                  <span className="text-sm text-muted-foreground">{comp.label}</span>
                </div>
                <span className="text-sm font-medium text-foreground text-right max-w-[60%]">{comp.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Build Stack */}
      <ScrollReveal delay={100}>
      <Card className="glass-card border-0 overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground">System Build Stack</h3>
        </div>
        <CardContent className="p-5">
          <div className="space-y-2 stagger-children">
            {stackLayers.map((layer, i) => (
              <div key={i} className="relative">
                <div className={`${layer.color} rounded-lg px-4 py-3 flex items-center justify-between`}>
                  <span className="text-xs font-semibold text-white">{layer.name}</span>
                  {layer.detail && (
                    <span className="text-[10px] text-white/80 bg-white/15 rounded-full px-2.5 py-0.5">{layer.detail}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {proposal.totalDryMils && (
            <div className="mt-4 p-4 rounded-xl premium-card bg-primary/5 border border-primary/10">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Dry Mil Target</p>
              <p className="text-sm font-bold text-primary">{proposal.totalDryMils}</p>
            </div>
          )}
        </CardContent>
      </Card>
      </ScrollReveal>
      <PageNavigation />
    </div>
  );
}
