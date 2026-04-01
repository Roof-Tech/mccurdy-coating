import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, ExternalLink, AlertCircle, FileText, Coins, Zap, Scale, MapPin, Building2, Thermometer, DollarSign, Leaf, Shield, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

const typeIcons: Record<string, any> = {
  tax_deduction: FileText,
  rebate: Coins,
  utility: Zap,
  financing: TrendingUp,
  compliance: Scale,
};
const typeLabels: Record<string, string> = {
  tax_deduction: "Tax Credit / Deduction",
  rebate: "Rebate",
  utility: "Utility Program",
  financing: "Financing",
  compliance: "Compliance",
};

const typeAccents: Record<string, { border: string; bg: string; text: string; icon: string; badge: string }> = {
  tax_deduction: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  rebate: {
    border: "border-l-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-400",
    icon: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  utility: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  financing: {
    border: "border-l-purple-500",
    bg: "bg-purple-500/10",
    text: "text-purple-700 dark:text-purple-400",
    icon: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  compliance: {
    border: "border-l-slate-500",
    bg: "bg-slate-500/10",
    text: "text-slate-700 dark:text-slate-400",
    icon: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
    badge: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
  },
};

interface CountyProgram {
  name: string;
  type: string;
  description: string;
  link: string;
  amount?: string;
  notes?: string;
}

interface CountyData {
  county: string;
  climateZone: string;
  utility: string;
  programs: CountyProgram[];
}

const COUNTIES = [
  { value: "alameda", label: "Alameda County" },
  { value: "san-mateo", label: "San Mateo County" },
  { value: "san-francisco", label: "San Francisco County" },
  { value: "stanislaus", label: "Stanislaus County" },
  { value: "san-joaquin", label: "San Joaquin County" },
  { value: "contra-costa", label: "Contra Costa County" },
  { value: "solano", label: "Solano County" },
];

export default function SavingsIncentives() {
  const { incentives, proposal, trackEvent } = useProposal();
  const [selectedCounty, setSelectedCounty] = useState<string>("");
  const [countyData, setCountyData] = useState<CountyData | null>(null);
  const [loadingCounty, setLoadingCounty] = useState(false);

  useEffect(() => { trackEvent("viewed", { page: "savings" }); }, []);

  useEffect(() => {
    if (proposal?.county) {
      const match = COUNTIES.find(c =>
        c.label.toLowerCase().includes(proposal.county!.toLowerCase()) ||
        proposal.county!.toLowerCase().includes(c.value.replace("-", " "))
      );
      if (match && !selectedCounty) {
        setSelectedCounty(match.value);
      }
    }
  }, [proposal?.county]);

  useEffect(() => {
    if (!selectedCounty) {
      setCountyData(null);
      return;
    }
    setLoadingCounty(true);
    apiRequest("GET", `/api/county-incentives/${selectedCounty}`)
      .then(r => r.json())
      .then(data => {
        setCountyData(data);
        setLoadingCounty(false);
        trackEvent("viewed", { page: "savings", county: selectedCounty });
      })
      .catch(() => setLoadingCounty(false));
  }, [selectedCounty]);

  const groupedPrograms = countyData?.programs.reduce((acc, p) => {
    const group = acc[p.type] || [];
    group.push(p);
    acc[p.type] = group;
    return acc;
  }, {} as Record<string, CountyProgram[]>) || {};

  const groupOrder = ["tax_deduction", "rebate", "utility", "financing", "compliance"];

  const totalPrograms = countyData?.programs.length || 0;
  const programTypeCounts = groupOrder.map(type => ({
    type,
    count: groupedPrograms[type]?.length || 0,
    label: typeLabels[type],
    Icon: typeIcons[type] || TrendingUp,
  })).filter(t => t.count > 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-savings">
      <PageHeader
        title="Savings, Incentives & Tax Pathways"
        subtitle="County-specific tax credits, rebates, and incentive programs for your property"
        icon={<TrendingUp className="w-5 h-5" />}
      />

      {/* Premium Hero Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white animate-fade-in-up">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
        </div>
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold mb-1">Maximize Your Investment</h2>
            <p className="text-sm text-white/85 leading-relaxed">
              Discover county-specific tax credits, utility rebates, and financing programs that can significantly reduce your coating project costs. Select your county below to see all available incentives.
            </p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-white/70">
                <Leaf className="w-3.5 h-3.5" />
                <span>Energy Credits</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/70">
                <Shield className="w-3.5 h-3.5" />
                <span>Title 24 Compliance</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/70">
                <Coins className="w-3.5 h-3.5" />
                <span>Utility Rebates</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legal Disclaimer */}
      <div className="glass-card rounded-lg p-4 flex items-start gap-3 border border-amber-500/20 bg-amber-500/5 animate-fade-in">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-xs text-foreground/75 leading-relaxed">
          The items below represent potential pathways and are not guaranteed savings. McCurdy Coatings provides documentation and guidance but does not provide tax, legal, or financial advice. Always consult your CPA or qualified professional before making financial decisions. Program availability and amounts are subject to change.
        </p>
      </div>

      {/* County Selector — Premium Style */}
      <div className="glass-card rounded-xl p-5 space-y-4 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
            <MapPin className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Select Your County</h3>
            <p className="text-xs text-muted-foreground">Choose your property's county to view available programs</p>
          </div>
        </div>

        <Select value={selectedCounty} onValueChange={setSelectedCounty}>
          <SelectTrigger className="w-full h-11 bg-background/60 border-border/50 focus:border-primary/50 transition-colors" data-testid="select-county">
            <SelectValue placeholder="Choose your California county..." />
          </SelectTrigger>
          <SelectContent>
            {COUNTIES.map(c => (
              <SelectItem key={c.value} value={c.value} data-testid={`option-${c.value}`}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {countyData && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="glass-card rounded-lg p-3 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-orange-500/15 flex items-center justify-center">
                <Thermometer className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Climate Zone</p>
                <p className="text-xs font-bold text-foreground">{countyData.climateZone}</p>
              </div>
            </div>
            <div className="glass-card rounded-lg p-3 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-blue-500/15 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Utility Provider</p>
                <p className="text-xs font-bold text-foreground">{countyData.utility}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loadingCounty && (
        <div className="glass-card rounded-xl p-8 text-center space-y-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
            <MapPin className="w-5 h-5 text-primary animate-pulse-glow" />
          </div>
          <p className="text-sm text-muted-foreground">Loading county incentive data...</p>
        </div>
      )}

      {/* County Programs — Premium Layout */}
      {countyData && !loadingCounty && (
        <div className="space-y-5 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          {/* Summary Strip */}
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
                {countyData.county} Programs & Incentives
              </h2>
              <Badge className="bg-primary/15 text-primary border-0 text-[10px] font-bold">
                {totalPrograms} programs available
              </Badge>
            </div>
            {programTypeCounts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {programTypeCounts.map(({ type, count, label, Icon }) => {
                  const accent = typeAccents[type];
                  return (
                    <div key={type} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium ${accent.badge}`}>
                      <Icon className="w-3 h-3" />
                      <span>{count} {label}{count !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Program Groups */}
          <div className="stagger-children space-y-5">
            {groupOrder.map(type => {
              const programs = groupedPrograms[type];
              if (!programs || programs.length === 0) return null;
              const Icon = typeIcons[type] || TrendingUp;
              const accent = typeAccents[type];
              return (
                <div key={type} className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg ${accent.icon} flex items-center justify-center`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className={`text-sm font-bold ${accent.text}`}>{typeLabels[type]}</h3>
                    <div className="flex-1 h-px bg-border/40" />
                    <span className="text-[10px] text-muted-foreground font-medium">{programs.length} program{programs.length !== 1 ? "s" : ""}</span>
                  </div>
                  {programs.map((prog, idx) => (
                    <div
                      key={idx}
                      className={`glass-card rounded-lg border-l-4 ${accent.border} p-4 space-y-2.5 hover:shadow-md transition-shadow duration-300`}
                      data-testid={`card-county-program-${type}-${idx}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-sm font-bold text-foreground leading-snug">{prog.name}</h4>
                        <Badge className={`text-[10px] flex-shrink-0 border-0 font-semibold ${accent.badge}`}>
                          {typeLabels[type]}
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground/70 leading-relaxed">{prog.description}</p>
                      {prog.amount && (
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${accent.bg}`}>
                          <DollarSign className={`w-3 h-3 ${accent.text}`} />
                          <span className={`text-xs font-bold ${accent.text}`}>{prog.amount}</span>
                        </div>
                      )}
                      {prog.notes && (
                        <p className="text-[11px] text-muted-foreground italic border-l-2 border-muted/50 pl-2.5 py-0.5">{prog.notes}</p>
                      )}
                      <a
                        href={prog.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium pt-1 group transition-colors"
                        data-testid={`link-program-${type}-${idx}`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Visit Official Resource</span>
                        <ChevronRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                      </a>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State — Premium */}
      {!selectedCounty && !loadingCounty && (
        <div className="glass-card rounded-xl p-10 text-center space-y-4 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <MapPin className="w-7 h-7 text-primary/60" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground/80 mb-1">Select a County to Get Started</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
              Choose your county above to see available tax credits, rebates, utility programs, financing options, and Title 24 compliance details specific to your property location.
            </p>
          </div>
        </div>
      )}

      {/* Proposal-Specific Incentives */}
      {incentives.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="premium-divider" />
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            Proposal-Specific Incentives
          </h2>
          <div className="stagger-children space-y-3">
            {incentives.map((inc) => {
              const Icon = typeIcons[inc.programType] || TrendingUp;
              const accent = typeAccents[inc.programType] || typeAccents.compliance;
              return (
                <div key={inc.id} className={`glass-card rounded-lg border-l-4 ${accent.border} p-4 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg ${accent.icon} flex items-center justify-center`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-sm font-bold text-foreground">{inc.programName}</h4>
                    </div>
                    <Badge className={`text-[10px] border-0 font-semibold ${accent.badge}`}>
                      {typeLabels[inc.programType] || inc.programType}
                    </Badge>
                  </div>
                  {inc.applicability && <p className="text-xs text-foreground/75 leading-relaxed">{inc.applicability}</p>}
                  {inc.notes && <p className="text-[11px] text-muted-foreground italic border-l-2 border-muted/50 pl-2.5">{inc.notes}</p>}
                  <div className="flex items-center gap-4 pt-1">
                    {inc.officialLink && (
                      <a href={inc.officialLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1.5 font-medium hover:text-primary/80 transition-colors group">
                        <ExternalLink className="w-3 h-3" />
                        <span>Official Resource</span>
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    )}
                    {inc.lastVerifiedDate && (
                      <span className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
                        Verified: {inc.lastVerifiedDate}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
