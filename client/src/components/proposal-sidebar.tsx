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

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <McCurdyLogo className="w-9 h-9 text-sidebar-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground leading-tight">McCurdy Roofing</span>
            <span className="text-xs text-sidebar-foreground/60 leading-tight">Investment Proposal</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-medium">
            Your Proposal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {customerNav.map((item) => {
                const fullPath = `${basePath}${item.path}`;
                const isActive = location === fullPath;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}
                    >
                      <Link href={fullPath}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
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
        <div className="text-[11px] text-sidebar-foreground/40 text-center">
          McCurdy Roofing Inc. &middot; Lic #477152
        </div>
        <PerplexityAttribution />
      </SidebarFooter>
    </Sidebar>
  );
}
