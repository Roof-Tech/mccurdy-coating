import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Droplets, DollarSign, Zap, Building2, Leaf, Shield, ThermometerSun, Paintbrush, Recycle, Volume2 } from "lucide-react";
import { useEffect } from "react";

const benefitSections = [
  {
    title: "Financial Benefits",
    icon: DollarSign,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-l-green-500/60",
    items: [
      { icon: DollarSign, text: "Restoration avoids full tear-off costs — typically 40-60% less than replacement" },
      { icon: Shield, text: "May qualify as a repair expense rather than capital improvement for tax purposes" },
      { icon: Recycle, text: "Future recoat path extends roof life at a fraction of original cost" },
      { icon: ThermometerSun, text: "Reduced energy costs from high solar reflectivity (SRI 110+)" },
      { icon: Leaf, text: "Lower disposal costs — no tear-off waste in most restoration projects" },
    ],
  },
  {
    title: "Performance Benefits",
    icon: Zap,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-l-blue-500/60",
    items: [
      { icon: Droplets, text: "Superior ponding water resistance — silicone does not break down in standing water" },
      { icon: ThermometerSun, text: "Excellent UV resistance — silicone maintains flexibility and reflectivity long-term" },
      { icon: Paintbrush, text: "High-solids formulation (90%+) means minimal shrinkage from wet to dry mils" },
      { icon: Droplets, text: "Self-cleaning surface reduces dirt accumulation and maintains reflectivity" },
      { icon: ThermometerSun, text: "Maintains elasticity through temperature extremes without cracking" },
    ],
  },
  {
    title: "Building Operations Benefits",
    icon: Building2,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-l-purple-500/60",
    items: [
      { icon: Volume2, text: "No tear-off noise — significantly less disruption to building occupants" },
      { icon: Shield, text: "No interior exposure risk — existing roof stays in place during application" },
      { icon: Zap, text: "Faster installation timeline compared to full replacement" },
      { icon: Leaf, text: "Odor-free application in most conditions" },
      { icon: Building2, text: "Building remains fully operational during installation" },
    ],
  },
  {
    title: "Sustainability Benefits",
    icon: Leaf,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-l-emerald-500/60",
    items: [
      { icon: Recycle, text: "Restoration reduces landfill waste by preserving the existing roof membrane" },
      { icon: ThermometerSun, text: "Cool-roof technology reduces urban heat island effect" },
      { icon: Leaf, text: "Lower carbon footprint compared to full roof replacement" },
      { icon: Zap, text: "Reduced energy consumption from improved building efficiency" },
    ],
  },
];

export default function SiliconeBenefits() {
  const { trackEvent } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "silicone-benefits" }); }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-silicone-benefits">
      <PageHeader
        title="Silicone Roof System Benefits"
        subtitle="Why silicone coating systems are a smart investment"
        icon={<Droplets className="w-5 h-5" />}
      />

      <div className="space-y-4 stagger-children">
        {benefitSections.map((section) => (
          <Card key={section.title} className={`glass-card border-0 overflow-hidden border-l-4 ${section.borderColor}`}>
            <div className="p-5 border-b border-border/50">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg ${section.bgColor} flex items-center justify-center`}>
                  <section.icon className={`w-3.5 h-3.5 ${section.color}`} />
                </div>
                {section.title}
              </h3>
            </div>
            <CardContent className="p-5">
              <div className="space-y-2.5">
                {section.items.map((item, j) => (
                  <div key={j} className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full ${section.bgColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <item.icon className={`w-2.5 h-2.5 ${section.color}`} />
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
