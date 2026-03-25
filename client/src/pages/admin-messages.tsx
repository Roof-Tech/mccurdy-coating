import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Check } from "lucide-react";
import type { CustomerMessage } from "@shared/schema";

export default function AdminMessages() {
  const { data: messages = [] } = useQuery<CustomerMessage[]>({
    queryKey: ["/api/admin/messages"],
    queryFn: () => apiRequest("GET", "/api/admin/messages").then(r => r.json()),
  });

  const markRead = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/messages/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/messages"] }),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-admin-messages">
      <PageHeader title="Customer Messages" subtitle="Questions, approvals, and revision requests" icon={<MessageSquare className="w-5 h-5" />} />

      {messages.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No customer messages yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {messages.map((msg) => (
            <Card key={msg.id} className={msg.isRead ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{msg.messageType}</Badge>
                      {!msg.isRead && <Badge className="text-[10px] bg-accent text-accent-foreground">New</Badge>}
                    </div>
                    <p className="text-sm text-foreground/80">{msg.message}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {msg.senderName && <span>{msg.senderName}</span>}
                      {msg.senderEmail && <span>{msg.senderEmail}</span>}
                      {msg.senderPhone && <span>{msg.senderPhone}</span>}
                      <span>{new Date(msg.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  {!msg.isRead && (
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => markRead.mutate(msg.id)}>
                      <Check className="w-3 h-3" /> Mark Read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
