import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { McCurdyLogo } from "./mccurdy-logo";
import {
  Home,
  FileText,
  HelpCircle,
  Layers,
  BookOpen,
  Ruler,
  Palette,
  DollarSign,
  Shield,
  ImageIcon,
  TrendingUp,
  Scale,
  Droplets,
  FolderOpen,
  Users,
  CheckCircle,
  ImagePlus,
  Gift,
  Star,
  MessageSquare,
  Receipt,
  Settings,
  Building2,
  ChevronDown,
} from "lucide-react";
import { useProposal } from "@/lib/proposal-context";
type N = { title: string; path: string; icon: any };
const groups: { title: string; items: N[]; after?: boolean }[] = [
  {
    title: "Your Proposal",
    items: [
      { title: "Welcome", path: "", icon: Home },
      { title: "Summary", path: "/summary", icon: FileText },
      { title: "Pricing", path: "/pricing", icon: DollarSign },
      { title: "Savings & Incentives", path: "/savings", icon: TrendingUp },
      { title: "Sign & Approve", path: "/approve", icon: CheckCircle },
      { title: "Messages", path: "/messages", icon: MessageSquare },
    ],
  },
  {
    title: "Technical Details",
    items: [
      { title: "Roof System", path: "/system", icon: Layers },
      { title: "Silicone Benefits", path: "/silicone", icon: Droplets },
      { title: "Why This System", path: "/why", icon: HelpCircle },
      { title: "Mils Build", path: "/mils", icon: Ruler },
      { title: "Color Options", path: "/colors", icon: Palette },
      { title: "Materials", path: "/materials", icon: BookOpen },
      { title: "Compliance", path: "/compliance", icon: Scale },
      { title: "Warranty Center", path: "/warranty", icon: Shield },
    ],
  },
  {
    title: "Documents & Photos",
    items: [
      { title: "Documents Provided", path: "/documents", icon: FolderOpen },
      { title: "Before/After", path: "/visualizer", icon: ImageIcon },
      { title: "Timeline", path: "/timeline", icon: ImagePlus },
      { title: "Meet the Crew", path: "/crew", icon: Users },
      { title: "Invoices", path: "/invoices", icon: Receipt },
    ],
  },
  {
    title: "After Your Job",
    after: true,
    items: [
      { title: "My Warranty", path: "/warranty", icon: Shield },
      { title: "Refer a Neighbor", path: "/refer", icon: Gift },
      { title: "Leave a Review", path: "/review", icon: Star },
      { title: "My Properties", path: "/properties", icon: Building2 },
      { title: "Email Preferences", path: "/preferences", icon: Settings },
    ],
  },
];
export function ProposalSidebar() {
  const [location] = useLocation();
  const { token, proposal } = useProposal();
  const base = `/view/${token}`;
  const done =
    proposal?.status === "completed" ||
    proposal?.status === "job_completed" ||
    !!proposal?.workCompletedDate;
  const [open, setOpen] = useState<Record<string, boolean>>({
    "Your Proposal": true,
  });
  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <McCurdyLogo className="w-9 h-9 text-sidebar-primary" />
          <div>
            <span className="block text-sm font-semibold text-sidebar-foreground">
              McCurdy Coatings
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Your project portal
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups
          .filter((g) => !g.after || done)
          .map((g) => (
            <SidebarGroup key={g.title}>
              <Collapsible
                open={!!open[g.title]}
                onOpenChange={(v) => setOpen({ ...open, [g.title]: v })}
              >
                <CollapsibleTrigger className="w-full">
                  <SidebarGroupLabel className="flex justify-between text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                    {g.title}
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${open[g.title] ? "rotate-180" : ""}`}
                    />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {g.items.map((item) => {
                        const url = `${base}${item.path}`,
                          active = location === url;
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              asChild
                              data-active={active}
                              className={
                                active
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                  : ""
                              }
                            >
                              <Link
                                href={url}
                                data-testid={`link-customer-${item.path || "welcome"}`}
                              >
                                <item.icon className="w-4 h-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          ))}
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <p className="text-xs text-center text-sidebar-foreground/50">
          © McCurdy Roofing Inc. · License #477152 · Family-Owned Since 1985
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
