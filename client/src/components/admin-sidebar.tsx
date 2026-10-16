import { Link, useLocation } from "wouter";
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
import { McCurdyLogo } from "./mccurdy-logo";
import {
  LayoutDashboard,
  FileText,
  MessageSquare,
  Activity,

  Users,
  Gift,
  Sparkles,
  ShieldCheck,
  Receipt,
  ScrollText,
  CloudLightning,
  CalendarDays,
  Landmark,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const adminNav = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Proposals", url: "/admin/proposals", icon: FileText },
  { title: "Messages", url: "/admin/messages", icon: MessageSquare },
  { title: "Activity Log", url: "/admin/activity", icon: Activity },
  { title: "Crew", url: "/admin/crew", icon: Users },
  { title: "Referrals", url: "/admin/referrals", icon: Gift },
  { title: "Instant Estimates", url: "/admin/instant-estimates", icon: Sparkles },
  { title: "Invoices", url: "/admin/invoices", icon: Receipt },
  { title: "Incentive Review", url: "/admin/incentives", icon: ScrollText },
  { title: "Storm Follow-ups", url: "/admin/storm-followups", icon: CloudLightning },
  { title: "Financing", url: "/admin/financing", icon: Landmark },
  { title: "Scheduling", url: "/admin/scheduling", icon: CalendarDays },
  { title: "Team & Security", url: "/admin/team", icon: ShieldCheck },
];

export function AdminSidebar() {
  const [location] = useLocation();
  const { data: estimateData } = useQuery<{ newCount: number }>({
    queryKey: ["/api/admin/estimate-leads", "sidebar"],
    queryFn: () => apiRequest("GET", "/api/admin/estimate-leads?status=new&pageSize=1").then((res) => res.json()),
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <McCurdyLogo className="w-9 h-9 text-sidebar-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground leading-tight">
              McCurdy Coatings — Admin
            </span>
            <span className="text-xs text-sidebar-foreground/60 leading-tight">
              Proposal Manager
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-sidebar-foreground/40 font-medium">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item) => {
                const isActive =
                  location === item.url ||
                  (item.url !== "/admin" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : ""
                      }
                    >
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                        {item.url === "/admin/instant-estimates" && (estimateData?.newCount || 0) > 0 && (
                          <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 py-0.5 text-xs font-bold text-sidebar-primary-foreground" data-testid="badge-new-instant-estimates">{estimateData?.newCount}</span>
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
        <div className="text-xs text-sidebar-foreground/40 text-center">
          © McCurdy Roofing Inc. · License #477152 · Family-Owned Since 1985
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
