import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Package, Layers, Paintbrush, Wrench, Droplets, Filter, Building2, FileText, Shield } from "lucide-react";
import { useEffect } from "react";
import { PageNavigation } from "@/components/page-navigation";

const materialIcons: Record<string, any> = {
  primer: Droplets, base_coat: Layers, top_coat: Paintbrush,
  sealant: Wrench, reinforcing: Filter, drain: Package,
  accessory: Package, insulation: Shield,
};

const categoryLabels: Record<string, string> = {
  primer: "Primer",
  base_coat: "Base Coat",
  top_coat: "Top Coat",
  sealant: "Sealant / Mastic",
  reinforcing: "Reinforcing Fabric",
  drain: "Drain Kit",
  insulation: "Insulation",
  accessory: "Accessory",
};

const categoryColors: Record<string, string> = {
  primer: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-l-blue-500",
  base_coat: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-l-indigo-500",
  top_coat: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-l-cyan-500",
  sealant: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-l-amber-500",
  reinforcing: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-l-purple-500",
  drain: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-l-emerald-500",
  insulation: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-l-orange-500",
  accessory: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-l-slate-500",
};

function getIconForCategory(category: string) {
  return materialIcons[category] || Package;
}

function getCategoryLabel(category: string): string {
  return categoryLabels[category] || category;
}

function getDisplayName(mat: any): string {
  return mat.productName || mat.name || "Unknown Material";
}

export default function MaterialsLibrary() {
  const { materials, trackEvent } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "materials" }); }, []);

  const materialsList = materials.length > 0 ? materials : [
    { id: 1, productName: "ASC Silicone Primer", category: "primer", manufacturer: "ASC (American Silicone Coatings)", usedFor: "Surface preparation and adhesion promotion", technicalSummary: "Single-component moisture-cure primer. VOC compliant." },
    { id: 2, productName: "ASC Qualifying Silicone Base Coat", category: "base_coat", manufacturer: "ASC (American Silicone Coatings)", usedFor: "Primary waterproofing layer", technicalSummary: "High-solids silicone elastomeric coating. 90%+ solids content." },
    { id: 3, productName: "ASC Qualifying Silicone Top Coat", category: "top_coat", manufacturer: "ASC (American Silicone Coatings)", usedFor: "Final weathering surface with UV protection", technicalSummary: "High-solids silicone top coat. Cool-roof rated. SRI 110+ in white." },
    { id: 4, productName: "Silicone Sealant/Mastic", category: "sealant", manufacturer: "ASC (American Silicone Coatings)", usedFor: "Detail work at penetrations and transitions", technicalSummary: "100% silicone sealant for gap filling and detail work." },
    { id: 5, productName: "Polyester Reinforcing Fabric", category: "reinforcing", manufacturer: "Various", usedFor: "Reinforcement at seams, penetrations, and stress points", technicalSummary: "Non-woven polyester fabric embedded between coating layers." },
    { id: 6, productName: "Drain Retrofit Kit", category: "drain", manufacturer: "Various", usedFor: "Drainage improvement in ponding areas", technicalSummary: "Complete drain assembly with strainer, clamp ring, and membrane collar." },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-materials">
      <PageHeader
        title="Materials Library"
        subtitle="Every material included in your roof system"
        icon={<Package className="w-5 h-5" />}
      />

      {/* Summary Strip */}
      <div className="glass-card rounded-xl p-4 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
            System Components
          </h3>
          <Badge className="bg-primary/15 text-primary border-0 text-[10px] font-bold">
            {materialsList.length} materials
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Each material has been specifically selected for compatibility with the ASC Roof Renewal system and your roof's conditions.
        </p>
      </div>

      <Accordion type="multiple" className="space-y-3 stagger-children">
        {materialsList.map((mat: any, i: number) => {
          const displayName = getDisplayName(mat);
          const category = mat.category || "accessory";
          const Icon = getIconForCategory(category);
          const colorClass = categoryColors[category] || categoryColors.accessory;
          const badgeColorParts = colorClass.split(" ").slice(0, 2).join(" ");

          return (
            <AccordionItem key={mat.id || i} value={`mat-${i}`} className={`glass-card border-0 border-l-4 ${colorClass.split(" ").pop()} rounded-xl px-5 overflow-hidden`}>
              <AccordionTrigger className="text-sm font-medium py-4 hover:no-underline">
                <span className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${badgeColorParts}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="flex items-center gap-2 text-left">
                    <span className="font-bold">{displayName}</span>
                    <Badge variant="secondary" className="text-[10px] font-normal">{getCategoryLabel(category)}</Badge>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-5 pl-11 space-y-3">
                {mat.manufacturer && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    <span className="font-medium">Manufacturer:</span> {mat.manufacturer}
                  </div>
                )}
                {(mat.usedFor || mat.description) && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Purpose</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{mat.usedFor || mat.description}</p>
                  </div>
                )}
                {mat.technicalSummary && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Technical Details</p>
                    <p className="text-xs text-foreground/70 leading-relaxed">{mat.technicalSummary}</p>
                  </div>
                )}
                {mat.coverage && (
                  <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-md px-2.5 py-1">
                    <Layers className="w-3 h-3" /> Coverage: {mat.coverage}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  {mat.dataSheetUrl && (
                    <a href={mat.dataSheetUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                      <FileText className="w-3 h-3" /> Data Sheet
                    </a>
                  )}
                  {mat.sdsUrl && (
                    <a href={mat.sdsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                      <Shield className="w-3 h-3" /> SDS
                    </a>
                  )}
                </div>
                {mat.notes && (
                  <p className="text-[11px] text-muted-foreground italic border-l-2 border-muted/50 pl-2.5">{mat.notes}</p>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <PageNavigation />
    </div>
  );
}
