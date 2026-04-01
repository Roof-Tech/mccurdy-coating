import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Scale, HelpCircle, FileCheck, Building2 } from "lucide-react";
import { useEffect } from "react";

export default function Compliance() {
  const { trackEvent } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "compliance" }); }, []);

  const sections = [
    {
      value: "what", icon: HelpCircle, title: "What is Title 24?",
      content: "Title 24 is California's Building Energy Efficiency Standards. Part 6 includes requirements for roof reflectivity (solar reflectance) and thermal emittance on commercial and certain residential buildings. When you replace or significantly alter a roof, the new surface often must meet minimum cool-roof values to comply with state energy codes.",
    },
    {
      value: "when", icon: Building2, title: "When Does It Matter?",
      content: "Title 24 cool-roof requirements typically apply when more than 50% of the roof surface is being replaced or recovered on a commercial building. Climate zone, building type, and roof slope all factor into the specific requirements. The proposed ASC white silicone system exceeds all Title 24 cool-roof minimums for California climate zones.",
    },
    {
      value: "docs", icon: FileCheck, title: "What Documents Are Involved?",
      content: "Compliance documentation may include: product data sheets showing solar reflectance index (SRI) values, CRRC (Cool Roof Rating Council) product listings, CF-1R Energy Compliance forms, and project-specific energy calculations. Your local building department may require these as part of the permitting process.",
    },
    {
      value: "help", icon: Scale, title: "What McCurdy Provides",
      content: "McCurdy Coatings provides product data sheets, CRRC listings, SRI documentation, and installation specifications that demonstrate compliance. We coordinate with your permitting process and can supply manufacturer compliance letters when needed. If your project requires energy calculations or CF-1R forms, we can connect you with the appropriate resources.",
    },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-compliance">
      <PageHeader
        title="Title 24 & Compliance"
        subtitle="Understanding California code and cool-roof requirements"
        icon={<Scale className="w-5 h-5" />}
      />

      <Accordion type="multiple" defaultValue={["what", "when", "docs", "help"]} className="space-y-3 stagger-children">
        {sections.map((section) => (
          <AccordionItem key={section.value} value={section.value} className="glass-card border-0 rounded-xl px-5 overflow-hidden">
            <AccordionTrigger className="text-sm font-medium py-4 hover:no-underline">
              <span className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                  <section.icon className="w-3.5 h-3.5 text-accent" />
                </div>
                {section.title}
              </span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-foreground/80 pb-5 leading-relaxed pl-10">
              {section.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
