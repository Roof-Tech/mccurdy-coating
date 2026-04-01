import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";
import type { ActivityEvent } from "@shared/schema";

export default function AdminActivity() {
  const { data: activities = [] } = useQuery<ActivityEvent[]>({
    queryKey: ["/api/admin/activities"],
    queryFn: () => apiRequest("GET", "/api/admin/activities").then(r => r.json()),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-admin-activity">
      <PageHeader title="Activity Log" subtitle="Track all proposal interactions" icon={<Activity className="w-5 h-5" />} />

      {activities.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No activity recorded yet.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/50">
              {activities.map((act) => (
                <li key={act.id} className="flex items-center justify-between p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px] capitalize">{act.eventType.replace("_", " ")}</Badge>
                    <span className="text-muted-foreground">Proposal #{act.proposalId}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(act.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
