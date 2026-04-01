import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useProposal } from "@/lib/proposal-context";

const pageOrder = [
  { path: "", label: "Welcome" },
  { path: "/summary", label: "Proposal Summary" },
  { path: "/why", label: "Why This System" },
  { path: "/system", label: "Roof System" },
  { path: "/materials", label: "Materials Library" },
  { path: "/mils", label: "Mil Thickness" },
  { path: "/colors", label: "Color Options" },
  { path: "/pricing", label: "Pricing & Options" },
  { path: "/warranty", label: "Warranty Center" },
  { path: "/visualizer", label: "Before & After" },
  { path: "/savings", label: "Savings & Incentives" },
  { path: "/compliance", label: "Compliance" },
  { path: "/silicone", label: "Silicone Benefits" },
  { path: "/forms", label: "Forms & Print" },
  { path: "/documents", label: "Documents" },
  { path: "/cpa-questions", label: "CPA Questions" },
  { path: "/approve", label: "Approve" },
];

export function PageNavigation() {
  const [location] = useLocation();
  const { token } = useProposal();
  const basePath = `/view/${token}`;

  const currentIdx = pageOrder.findIndex(p => {
    const fullPath = `${basePath}${p.path}`;
    return location === fullPath;
  });

  if (currentIdx === -1) return null;

  const prev = currentIdx > 0 ? pageOrder[currentIdx - 1] : null;
  const next = currentIdx < pageOrder.length - 1 ? pageOrder[currentIdx + 1] : null;

  return (
    <div className="flex items-center justify-between pt-8 pb-4 mt-6 border-t border-border/50">
      {prev ? (
        <Link href={`${basePath}${prev.path}`}>
          <Button variant="ghost" className="gap-2 text-xs text-muted-foreground hover:text-foreground group h-9 px-3">
            <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <div className="text-left">
              <span className="block text-[10px] text-muted-foreground/60 uppercase tracking-wider">Previous</span>
              <span className="block text-xs font-medium">{prev.label}</span>
            </div>
          </Button>
        </Link>
      ) : <div aria-hidden="true" />}
      
      <div
        className="flex items-center gap-1"
        role="progressbar"
        aria-label={`Page ${currentIdx + 1} of ${pageOrder.length}`}
        aria-valuenow={currentIdx + 1}
        aria-valuemin={1}
        aria-valuemax={pageOrder.length}
      >
        {pageOrder.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === currentIdx
                ? "w-5 bg-accent"
                : i < currentIdx
                  ? "w-1.5 bg-primary/30"
                  : "w-1.5 bg-muted-foreground/15"
            }`}
          />
        ))}
      </div>

      {next ? (
        <Link href={`${basePath}${next.path}`}>
          <Button variant="ghost" className="gap-2 text-xs text-muted-foreground hover:text-foreground group h-9 px-3">
            <div className="text-right">
              <span className="block text-[10px] text-muted-foreground/60 uppercase tracking-wider">Next</span>
              <span className="block text-xs font-medium">{next.label}</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </Link>
      ) : <div aria-hidden="true" />}
    </div>
  );
}
