import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutDashboard, FileText, Eye, CheckCircle, AlertCircle, Clock, MessageSquare, Plus } from "lucide-react";
import { Link } from "wouter";
import type { Proposal, ActivityEvent, CustomerMessage } from "@shared/schema";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  viewed: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  revision_requested: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  expired: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
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
          { label: "Total Proposals", value: statCounts.total, icon: FileText, color: "text-primary" },
          { label: "Sent / Pending", value: statCounts.sent, icon: Clock, color: "text-blue-500" },
          { label: "Viewed", value: statCounts.viewed, icon: Eye, color: "text-yellow-500" },
          { label: "Approved", value: statCounts.approved, icon: CheckCircle, color: "text-green-500" },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <span className="text-2xl font-bold">{stat.value}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Unread Messages */}
      {unreadMessages.length > 0 && (
        <Card className="border-accent/30">
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

      {/* Recent Proposals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Recent Proposals</CardTitle>
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
                    <tr key={p.id} className="border-b border-border/30" data-testid={`row-proposal-${p.id}`}>
                      <td className="py-2 font-mono text-xs">{p.proposalNumber}</td>
                      <td className="py-2">{p.customerName}</td>
                      <td className="py-2 text-xs text-muted-foreground">{p.proposalDate}</td>
                      <td className="py-2">
                        <Badge className={`text-[10px] ${statusColors[p.status] || ""}`}>{p.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="py-2">
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

      {/* Recent Activity */}
      {activities.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {activities.slice(0, 10).map((act) => (
                <li key={act.id} className="flex items-center justify-between text-xs border-b border-border/30 pb-1.5 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{act.eventType}</Badge>
                    <span className="text-muted-foreground">Proposal #{act.proposalId}</span>
                  </div>
                  <span className="text-muted-foreground">{new Date(act.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
