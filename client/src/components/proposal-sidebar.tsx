import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { McCurdyLogo } from "./mccurdy-logo";
import {
  Home, FileText, HelpCircle, Layers, BookOpen, Ruler,
  Palette, DollarSign, Shield, ImageIcon, TrendingUp,
  Scale, Droplets, Printer, FolderOpen, Users, CheckCircle,
} from "lucide-react";
import { PerplexityAttribution } from "./PerplexityAttribution";
import { useProposal } from "@/lib/proposal-context";

const customerNav = [
  { title: "Welcome", path: "", icon: Home },
  { title: "Proposal Summary", path: "/summary", icon: FileText },
  { title: "Why This System", path: "/why", icon: HelpCircle },
  { title: "Roof System Details", path: "/system", icon: Layers },
  { title: "Materials Library", path: "/materials", icon: BookOpen },
  { title: "Mil Thickness & Build", path: "/mils", icon: Ruler },
  { title: "Color Options", path: "/colors", icon: Palette },
  { title: "Pricing & Options", path: "/pricing", icon: DollarSign },
  { title: "Warranty Center", path: "/warranty", icon: Shield },
  { title: "Before & After", path: "/visualizer", icon: ImageIcon },
  { title: "Savings & Incentives", path: "/savings", icon: TrendingUp },
  { title: "Title 24 / Compliance", path: "/compliance", icon: Scale },
  { title: "Silicone Benefits", path: "/silicone", icon: Droplets },
  { title: "Forms & Print Center", path: "/forms", icon: Printer },
  { title: "Documents", path: "/documents", icon: FolderOpen },
  { title: "CPA / Team Questions", path: "/cpa-questions", icon: Users },
  { title: "Approve / Next Steps", path: "/approve", icon: CheckCircle },
];

export function ProposalSidebar() {
  const [location] = useLocation();
  const { token } = useProposal();
  const basePath = `/view/${token}`;

  // Calculate progress
  const currentIdx = customerNav.findIndex(item => {
    const fullPath = `${basePath}${item.path}`;
    return location === fullPath;
  });
  const progress = currentIdx >= 0 ? Math.round(((currentIdx + 1) / customerNav.length) * 100) : 0;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary/10 flex items-center justify-center">
            <McCurdyLogo className="w-6 h-6 text-sidebar-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-sidebar-foreground leading-tight tracking-tight">McCurdy Roofing</span>
            <span className="text-[11px] text-sidebar-foreground/50 leading-tight">Investment Proposal</span>
          </div>
        </div>
        {/* Progress indicator */}
        {progress > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-sidebar-foreground/40 uppercase tracking-wider font-medium">Progress</span>
              <span className="text-[10px] text-sidebar-primary font-semibold">{progress}%</span>
            </div>
            <div className="h-1 rounded-full bg-sidebar-accent/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, hsl(28 85% 48%), hsl(32 90% 58%))',
                }}
              />
            </div>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/35 font-semibold">
            Your Proposal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {customerNav.map((item, idx) => {
                const fullPath = `${basePath}${item.path}`;
                const isActive = location === fullPath;
                const isVisited = currentIdx >= 0 && idx < currentIdx;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={`relative transition-all duration-200 ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : isVisited
                            ? "text-sidebar-foreground/70"
                            : ""
                      }`}
                    >
                      <Link href={fullPath}>
                        {isActive && (
                          <div
                            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full"
                            style={{ background: 'linear-gradient(180deg, hsl(28 85% 56%), hsl(28 85% 48%))' }}
                          />
                        )}
                        <item.icon className={`w-4 h-4 ${isActive ? 'text-sidebar-primary' : isVisited ? 'text-sidebar-foreground/50' : ''}`} />
                        <span>{item.title}</span>
                        {isVisited && !isActive && (
                          <CheckCircle className="w-3 h-3 ml-auto text-sidebar-foreground/25" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="text-[10px] text-sidebar-foreground/35 text-center font-medium">
          McCurdy Roofing Inc. &middot; Lic #477152
        </div>
        <PerplexityAttribution />
      </SidebarFooter>
    </Sidebar>
  );
}
