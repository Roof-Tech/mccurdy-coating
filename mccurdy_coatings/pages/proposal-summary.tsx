import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, Clock, ListChecks, AlertCircle, User, Layers, Ruler, Building2, ArrowRight } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";

export default function ProposalSummary() {
  const { proposal, trackEvent, token } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "summary" }); }, []);

  if (!proposal) return null;

  const roofAreas = proposal.roofAreas ? JSON.parse(proposal.roofAreas) : [];
  const addOns = proposal.addOns ? JSON.parse(proposal.addOns) : [];
  const basePath = `/view/${token}`;

  // Calculate total sq ft from roof areas
  const totalSqFt = roofAreas.reduce((total: number, area: string) => {
    const match = area.match(/([\d,]+)\s*sq\s*ft/i);
    return total + (match ? parseInt(match[1].replace(',', '')) : 0);
  }, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5" data-testid="page-summary">
      <PageHeader
        title="Proposal Summary"
        subtitle="Overview of your complete roof investment scope"
        icon={<FileText className="w-5 h-5" />}
      />

      {/* ── Key Metrics Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
        {[
          { label: "Project Type", value: proposal.projectType ? proposal.projectType.charAt(0).toUpperCase() + proposal.projectType.slice(1) : "Commercial", icon: Building2 },
          { label: "Total Roof Area", value: totalSqFt > 0 ? `${totalSqFt.toLocaleString()} sq ft` : "—", icon: Ruler },
          { label: "System", value: "ASC Silicone", icon: Layers },
          { label: "Timeline", value: proposal.timelineEstimate?.replace("from contract signing, ", "") || "3-4 weeks", icon: Clock },
        ].map((metric) => (
          <div key={metric.label} className="glass-card rounded-xl p-4 text-center">
            <metric.icon className="w-4 h-4 text-accent mx-auto mb-2" />
            <p className="text-sm font-bold text-foreground leading-tight">{metric.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{metric.label}</p>
          </div>
        ))}
      </div>

      {/* ── Project Overview Card ── */}
      <Card className="glass-card border-0 overflow-hidden">
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Project Overview</h3>
            <Badge variant="outline" className="text-[10px] border-accent/30 text-accent">
              {proposal.proposalNumber}
            </Badge>
          </div>
        </div>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">System</p>
              <p className="font-medium text-foreground">{proposal.systemType}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estimator</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full copper-gradient flex items-center justify-center">
                  <User className="w-3 h-3 text-white" />
                </div>
                <p className="font-medium text-foreground">{proposal.estimator}</p>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Estimated Timeline</p>
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {proposal.timelineEstimate}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Payment</p>
              <p className="font-medium text-foreground text-xs leading-relaxed">No deposit required. 50%/50% split.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Roof Areas ── */}
      {roofAreas.length > 0 && (
        <Card className="glass-card border-0 overflow-hidden">
          <div className="p-5 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-accent" /> Roof Areas
            </h3>
          </div>
          <CardContent className="p-5">
            <div className="space-y-3">
              {roofAreas.map((area: string, i: number) => {
                const match = area.match(/^(.+?)[\s—–-]+([\d,]+\s*sq\s*ft)$/i);
                return (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-sm font-medium text-foreground">
                        {match ? match[1].trim() : area}
                      </span>
                    </div>
                    {match && (
                      <Badge variant="secondary" className="text-xs font-mono tabular-nums">
                        {match[2]}
                      </Badge>
                    )}
                  </div>
                );
              })}
              {totalSqFt > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Coverage</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">{totalSqFt.toLocaleString()} sq ft</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Scope Summary ── */}
      <Card className="glass-card border-0">
        <div className="p-5 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground">Scope of Work</h3>
        </div>
        <CardContent className="p-5">
          <p className="text-sm leading-relaxed text-foreground/80">{proposal.scopeSummary}</p>
        </CardContent>
      </Card>

      {/* ── Expandable Details ── */}
      <Accordion type="multiple" className="space-y-2">
        {proposal.exclusions && (
          <AccordionItem value="exclusions" className="glass-card border-0 rounded-xl px-5 overflow-hidden">
            <AccordionTrigger className="text-sm font-medium py-4 hover:no-underline">
              <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-muted-foreground" /> Exclusions & Notes</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 pb-5 leading-relaxed">{proposal.exclusions}</AccordionContent>
          </AccordionItem>
        )}
        {addOns.length > 0 && (
          <AccordionItem value="addons" className="glass-card border-0 rounded-xl px-5 overflow-hidden">
            <AccordionTrigger className="text-sm font-medium py-4 hover:no-underline">Optional Add-Ons</AccordionTrigger>
            <AccordionContent className="pb-5">
              <div className="space-y-2">
                {addOns.map((a: string, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                    <Badge className="bg-accent/10 text-accent border-0 text-[10px]">Add-on</Badge>
                    <span className="text-sm">{a}</span>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* ── CTA to Pricing ── */}
      <Link href={`${basePath}/pricing`}>
        <div className="group glass-card rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">View Pricing & Options</p>
              <p className="text-xs text-muted-foreground">Compare 6 ASC warranty tiers</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </Link>
    </div>
  );
}
