import { Link, useLocation } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { McCurdyLogo } from "./mccurdy-logo";
import {
  LayoutDashboard, FileText, MessageSquare, Activity, Settings,
} from "lucide-react";
import { PerplexityAttribution } from "./PerplexityAttribution";

const adminNav = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Proposals", url: "/admin/proposals", icon: FileText },
  { title: "Messages", url: "/admin/messages", icon: MessageSquare },
  { title: "Activity Log", url: "/admin/activity", icon: Activity },
];

export function AdminSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <McCurdyLogo className="w-9 h-9 text-sidebar-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground leading-tight">McCurdy Admin</span>
            <span className="text-xs text-sidebar-foreground/60 leading-tight">Proposal Manager</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-medium">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item) => {
                const isActive = location === item.url || (item.url !== "/admin" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className={isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}
                    >
                      <Link href={item.url}>
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
          McCurdy Roofing Inc. &middot; Admin Portal
        </div>
        <PerplexityAttribution />
      </SidebarFooter>
    </Sidebar>
  );
}
