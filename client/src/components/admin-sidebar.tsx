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
  Settings,
  Users,
  Gift,
} from "lucide-react";

const adminNav = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Proposals", url: "/admin/proposals", icon: FileText },
  { title: "Messages", url: "/admin/messages", icon: MessageSquare },
  { title: "Activity Log", url: "/admin/activity", icon: Activity },
  { title: "Crew", url: "/admin/crew", icon: Users },
  { title: "Referrals", url: "/admin/referrals", icon: Gift },
  { title: "Financing", url: "/admin/financing", icon: Settings },
  { title: "Scheduling", url: "/admin/scheduling", icon: Settings },
];

export function AdminSidebar() {
  const [location] = useLocation();

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
          © McCurdy Roofing Inc. · License #477152 · Family-Owned Since 1992
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
