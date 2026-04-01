import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, Building2, UserCheck, Copy, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { PageNavigation } from "@/components/page-navigation";

const questionSections = [
  {
    title: "Questions for Your CPA / Tax Advisor",
    icon: MessageSquare,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-l-amber-500/60",
    questions: [
      "Does this property type qualify for any relevant tax deductions or program pathways related to roof maintenance or restoration?",
      "Can this roof coating project be expensed under Section 179, or does it need to be depreciated?",
      "What documentation should I save for year-end filing related to this project?",
      "Does this project affect our capital planning or depreciation strategy?",
      "Are there energy-efficiency tax credits that may apply to a cool-roof installation in California?",
    ],
  },
  {
    title: "Questions for Building Ownership",
    icon: Building2,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-l-blue-500/60",
    questions: [
      "Should this proposal be compared to full replacement timing and costs in our budget?",
      "Does the 20-year warranty timeline align with our property holding period?",
      "Should we consider the premium option for the NDL warranty coverage?",
      "How does this investment compare to our annual roof maintenance budget allocation?",
    ],
  },
  {
    title: "Questions for Property Managers",
    icon: UserCheck,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-l-purple-500/60",
    questions: [
      "What is the expected timeline and how will it affect building operations?",
      "Are there any tenant notifications required during the installation?",
      "Who is the on-site contact during the project?",
      "What maintenance is required to keep the warranty valid?",
    ],
  },
];

export default function CpaQuestions() {
  const { trackEvent } = useProposal();
  const { toast } = useToast();
  useEffect(() => { trackEvent("viewed", { page: "cpa-questions" }); }, []);

  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopyAll = (title: string, questions: string[]) => {
    const text = `${title}\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(title);
      toast({ title: "Copied", description: `${questions.length} questions copied to clipboard.` });
      setTimeout(() => setCopiedSection(null), 2000);
    }).catch(() => {});
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-cpa">
      <PageHeader
        title="Questions for Your CPA & Team"
        subtitle="Suggested questions to help your decision-making team review this proposal"
        icon={<Users className="w-5 h-5" />}
      />

      <div className="space-y-4 stagger-children">
        {questionSections.map((section) => (
          <Card key={section.title} className={`glass-card border-0 overflow-hidden border-l-4 ${section.borderColor}`}>
            <div className="p-5 border-b border-border/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg ${section.bgColor} flex items-center justify-center`}>
                  <section.icon className={`w-3.5 h-3.5 ${section.color}`} />
                </div>
                {section.title}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => handleCopyAll(section.title, section.questions)}
                data-testid={`button-copy-${section.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {copiedSection === section.title ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedSection === section.title ? "Copied" : "Copy All"}
              </Button>
            </div>
            <CardContent className="p-5">
              <div className="space-y-3">
                {section.questions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-lg ${section.bgColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <span className={`text-[10px] font-bold ${section.color}`}>{i + 1}</span>
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <PageNavigation />
    </div>
  );
}
