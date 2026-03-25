import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Star, Info } from "lucide-react";
import { useEffect } from "react";

const colorSwatches: Record<string, string> = {
  "white": "#F5F5F0",
  "cool white": "#F5F5F0",
  "white (cool white)": "#F5F5F0",
  "light gray": "#C8C8C0",
  "gray": "#A0A098",
  "tan": "#D4C8A8",
  "light blue": "#B0C4D8",
};

function getSwatchColor(name: string): string {
  return colorSwatches[name.toLowerCase()] || "#E0E0D8";
}

export default function ColorOptions() {
  const { proposal, trackEvent } = useProposal();
  useEffect(() => { trackEvent("viewed", { page: "colors" }); }, []);
  if (!proposal) return null;

  const alternates = proposal.alternateColors ? JSON.parse(proposal.alternateColors) : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-colors">
      <PageHeader
        title="Color Options"
        subtitle="Choose from available roof coating colors"
        icon={<Palette className="w-5 h-5" />}
      />

      {/* Recommended Color */}
      {proposal.recommendedColor && (
        <Card className="glass-card border-0 overflow-hidden border-2 border-accent/30">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-accent" fill="currentColor" />
              <h3 className="text-sm font-semibold text-foreground">Recommended Color</h3>
            </div>
            <div className="flex items-center gap-5">
              <div
                className="w-24 h-24 rounded-xl shadow-lg border-2 border-white"
                style={{ backgroundColor: getSwatchColor(proposal.recommendedColor) }}
              />
              <div>
                <p className="text-base font-bold text-foreground">{proposal.recommendedColor}</p>
                <Badge className="bg-accent/10 text-accent border-0 text-[10px] mt-1">Recommended</Badge>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Available Alternatives */}
      {alternates.length > 0 && (
        <Card className="glass-card border-0">
          <div className="p-5 border-b border-border/50">
            <h3 className="text-sm font-semibold text-foreground">Available Alternatives</h3>
          </div>
          <CardContent className="p-5">
            <div className="grid grid-cols-3 gap-4">
              {alternates.map((color: string, i: number) => (
                <div key={i} className="text-center group cursor-pointer">
                  <div
                    className="w-full aspect-square rounded-xl shadow-md border border-border/40 group-hover:shadow-lg group-hover:scale-105 transition-all duration-200 mb-2"
                    style={{ backgroundColor: getSwatchColor(color) }}
                  />
                  <p className="text-xs font-medium text-foreground">{color}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Color Notes */}
      {proposal.colorNotes && (
        <Card className="glass-card border-0">
          <CardContent className="p-5 flex items-start gap-3">
            <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/80 leading-relaxed">{proposal.colorNotes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
