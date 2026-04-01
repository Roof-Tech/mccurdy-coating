import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutDashboard, FileText, Eye, CheckCircle, AlertCircle, Clock, MessageSquare, Plus } from "lucide-react";
import { Link } from "wouter";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Proposal, ActivityEvent, CustomerMessage } from "@shared/schema";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  viewed: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  revision_requested: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  expired: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const statusDotColors: Record<string, string> = {
  draft: "bg-gray-400",
  sent: "bg-blue-500",
  viewed: "bg-yellow-500",
  approved: "bg-green-500",
  revision_requested: "bg-orange-500",
  expired: "bg-red-500",
};

const PIE_COLORS: Record<string, string> = {
  draft: "hsl(220, 10%, 60%)",
  sent: "hsl(217, 91%, 60%)",
  viewed: "hsl(45, 93%, 47%)",
  approved: "hsl(142, 71%, 45%)",
};

const statCardStyles: Record<string, { bg: string; iconBg: string }> = {
  primary: {
    bg: "bg-gradient-to-br from-primary/5 via-transparent to-primary/[0.02]",
    iconBg: "bg-primary/10 text-primary",
  },
  blue: {
    bg: "bg-gradient-to-br from-blue-500/5 via-transparent to-blue-500/[0.02]",
    iconBg: "bg-blue-500/10 text-blue-500",
  },
  yellow: {
    bg: "bg-gradient-to-br from-yellow-500/5 via-transparent to-yellow-500/[0.02]",
    iconBg: "bg-yellow-500/10 text-yellow-500",
  },
  green: {
    bg: "bg-gradient-to-br from-green-500/5 via-transparent to-green-500/[0.02]",
    iconBg: "bg-green-500/10 text-green-500",
  },
};

export default function AdminDashboard() {
  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: ["/api/admin/proposals"],
    queryFn: () => apiRequest("GET", "/api/admin/proposals").then(r => r.json()),
  });
  const { data: messages = [] } = useQuery<CustomerMessage[]>({
    queryKey: ["/api/admin/messages"],
    queryFn: () => apiRequest("GET", "/api/admin/messages").then(r => r.json()),
  });
  const { data: activities = [] } = useQuery<ActivityEvent[]>({
    queryKey: ["/api/admin/activities"],
    queryFn: () => apiRequest("GET", "/api/admin/activities").then(r => r.json()),
  });

  const unreadMessages = messages.filter(m => !m.isRead);
  const statCounts = {
    total: proposals.length,
    sent: proposals.filter(p => p.status === "sent").length,
    viewed: proposals.filter(p => p.status === "viewed").length,
    approved: proposals.filter(p => p.status === "approved").length,
  };

  const pieData = [
    { name: "Draft", value: proposals.filter(p => p.status === "draft").length, key: "draft" },
    { name: "Sent", value: statCounts.sent, key: "sent" },
    { name: "Viewed", value: statCounts.viewed, key: "viewed" },
    { name: "Approved", value: statCounts.approved, key: "approved" },
  ].filter(d => d.value > 0);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="page-admin-dashboard">
      <div className="flex items-center justify-between">
        <PageHeader title="Dashboard" subtitle="Proposal management overview" icon={<LayoutDashboard className="w-5 h-5" />} />
        <Link href="/admin/proposals">
          <Button className="gap-2" data-testid="button-new-proposal"><Plus className="w-4 h-4" /> New Proposal</Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Proposals", value: statCounts.total, icon: FileText, theme: "primary" },
          { label: "Sent / Pending", value: statCounts.sent, icon: Clock, theme: "blue" },
          { label: "Viewed", value: statCounts.viewed, icon: Eye, theme: "yellow" },
          { label: "Approved", value: statCounts.approved, icon: CheckCircle, theme: "green" },
        ].map((stat, i) => {
          const style = statCardStyles[stat.theme];
          return (
            <Card key={i} className={`glass-card animate-fade-in-up ${style.bg}`} style={{ animationDelay: `${i * 80}ms` }}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${style.iconBg}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    <p className="text-2xl font-bold tracking-tight mt-0.5">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status Pie Chart + Unread Messages row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Breakdown Chart */}
        {proposals.length > 0 && (
          <Card className="glass-card animate-fade-in-up">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold gradient-text-copper">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-[160px] h-[160px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.key} fill={PIE_COLORS[entry.key]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2.5">
                  {pieData.map((entry) => (
                    <div key={entry.key} className="flex items-center gap-2 text-sm">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[entry.key] }}
                      />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="font-semibold ml-auto">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unread Messages */}
        {unreadMessages.length > 0 && (
          <Card className="glass-card animate-fade-in-up border-accent/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent" /> Unread Messages ({unreadMessages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {unreadMessages.slice(0, 5).map((msg) => (
                  <li key={msg.id} className="flex items-start justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                    <div>
                      <Badge variant="outline" className="text-[10px] mr-2">{msg.messageType}</Badge>
                      <span className="text-foreground/80">{msg.message.slice(0, 80)}...</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{msg.senderName}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Proposals */}
      <Card className="glass-card animate-fade-in-up">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold gradient-text-copper">Recent Proposals</CardTitle>
        </CardHeader>
        <CardContent>
          {proposals.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <p>No proposals yet. Seed demo data or create a new proposal.</p>
              <Button variant="outline" className="mt-3 text-xs" onClick={() => {
                apiRequest("POST", "/api/admin/seed-demo").then(() => window.location.reload());
              }} data-testid="button-seed-demo">
                Seed Demo Proposal
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground text-xs">Proposal #</th>
                    <th className="pb-2 font-medium text-muted-foreground text-xs">Customer</th>
                    <th className="pb-2 font-medium text-muted-foreground text-xs">Date</th>
                    <th className="pb-2 font-medium text-muted-foreground text-xs">Status</th>
                    <th className="pb-2 font-medium text-muted-foreground text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.slice(0, 10).map((p) => (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors" data-testid={`row-proposal-${p.id}`}>
                      <td className="py-2.5 font-mono text-xs">{p.proposalNumber}</td>
                      <td className="py-2.5 font-medium">{p.customerName}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{p.proposalDate}</td>
                      <td className="py-2.5">
                        <Badge className={`text-[10px] ${statusColors[p.status] || ""}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${statusDotColors[p.status] || "bg-gray-400"}`} />
                          {p.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="py-2.5">
                        <div className="flex gap-1">
                          <a href={`/#/view/${p.accessToken}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="text-xs h-7">View</Button>
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Timeline */}
      {activities.length > 0 && (
        <Card className="glass-card animate-fade-in-up">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold gradient-text-copper">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-6">
              {/* Vertical timeline line */}
              <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
              <ul className="space-y-4">
                {activities.slice(0, 10).map((act, i) => (
                  <li key={act.id} className="relative flex items-start gap-3 text-sm">
                    {/* Timeline dot */}
                    <span className="absolute -left-6 top-1 flex items-center justify-center">
                      <span className="w-[14px] h-[14px] rounded-full border-2 border-primary/40 bg-background flex items-center justify-center">
                        <span className="w-[6px] h-[6px] rounded-full bg-primary/70" />
                      </span>
                    </span>
                    <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">{act.eventType}</Badge>
                        <span className="text-muted-foreground truncate">Proposal #{act.proposalId}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {new Date(act.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
