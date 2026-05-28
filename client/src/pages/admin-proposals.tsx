import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Copy, ExternalLink, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Proposal } from "@shared/schema";

export default function AdminProposals() {
  const { toast } = useToast();
  const { data: proposals = [] } = useQuery<Proposal[]>({
    queryKey: ["/api/admin/proposals"],
    queryFn: () => apiRequest("GET", "/api/admin/proposals").then(r => r.json()),
  });

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/#/view/${token}`;
    navigator.clipboard?.writeText(url).then(() => {
      toast({ title: "Link copied", description: "Customer proposal link copied to clipboard." });
    });
  };

  const seedDemo = async () => {
    await apiRequest("POST", "/api/admin/seed-demo");
    window.location.reload();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="page-admin-proposals">
      <div className="flex items-center justify-between">
        <PageHeader title="Proposals" subtitle="Manage all customer proposals" icon={<FileText className="w-5 h-5" />} />
        <Button variant="outline" className="text-xs" onClick={seedDemo} data-testid="button-seed">Seed Demo Data</Button>
      </div>

      {proposals.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No proposals yet. Click &ldquo;Seed Demo Data&rdquo; to create a sample proposal.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <Card key={p.id} data-testid={`card-proposal-${p.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{p.proposalNumber}</span>
                      <Badge variant="outline" className="text-[10px] capitalize">{p.status.replace("_", " ")}</Badge>
                    </div>
                    <h3 className="text-sm font-semibold">{p.customerName}</h3>
                    {p.companyName && <p className="text-xs text-muted-foreground">{p.companyName}</p>}
                    <p className="text-xs text-muted-foreground">{p.propertyAddress}</p>
                    <p className="text-xs text-muted-foreground">{p.proposalDate} &middot; {p.estimator}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <a
                      href={`/#/admin/proposals/${p.id}`}
                      className="inline-flex items-center gap-1 h-7 px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      data-testid={`button-manage-${p.id}`}
                    >
                      <Settings2 className="w-3 h-3" /> Manage
                    </a>
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => copyLink(p.accessToken)}>
                      <Copy className="w-3 h-3" /> Copy Link
                    </Button>
                    <a
                      href={`/#/view/${p.accessToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 h-7 px-3 text-xs font-medium border border-border rounded-md bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Preview
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
