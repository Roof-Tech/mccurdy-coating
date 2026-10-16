import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ExternalLink, ScrollText, ChevronDown } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAdminUser } from "@/components/admin-gate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Program = { name: string; type: string; description: string; link: string; amount?: string; reviewStatus?: string; source?: string; verified?: string };
type County = { countyKey: string; county: string; utility: string; taxYear: number; lastUpdated: string; programs: Program[]; pending: number; shown: number };

export default function AdminIncentives() {
  const me = useAdminUser();
  const canApprove = me?.role === "owner" || me?.role === "admin";
  const { toast } = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery<County[]>({ queryKey: ["/api/admin/county-incentives/review"] });
  const approve = async (key: string, programNames?: string[]) => {
    try { await apiRequest("POST", `/api/admin/county-incentives/${key}/approve`, programNames ? { programNames } : {}); queryClient.invalidateQueries({ queryKey: ["/api/admin/county-incentives/review"] }); toast({ title: "Approved — customers now see these as verified" }); }
    catch (e: any) { toast({ title: "Couldn't approve", description: String(e.message).replace(/^\d+: /, ""), variant: "destructive" }); }
  };
  const totalPending = data.reduce((s, c) => s + c.pending, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6" data-testid="page-admin-incentives">
      <div className="flex items-start gap-3"><ScrollText className="mt-0.5 h-6 w-6 shrink-0 text-primary" /><div><h1 className="text-xl font-bold">Incentive Review</h1><p className="text-sm text-muted-foreground">New research from the yearly refresh and scheduled scans is held here. Until you approve a program, customers see it as “Pending verification,” with no dollar amount.</p></div></div>
      <Card><CardContent className="flex flex-wrap items-center gap-3 p-4"><Badge variant={totalPending ? "secondary" : "default"} data-testid="text-pending-total">{totalPending} program{totalPending === 1 ? "" : "s"} pending review</Badge><span className="text-xs text-muted-foreground">Expired credits (like 25C), out-of-window 179D, and residential-only programs on commercial jobs are removed automatically.</span></CardContent></Card>
      {isLoading ? <div className="h-32 animate-pulse rounded-xl bg-muted" /> : data.map((c) => (
        <Card key={c.countyKey} data-testid={`card-county-${c.countyKey}`}>
          <CardContent className="p-0">
            <button className="flex min-h-14 w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(open === c.countyKey ? null : c.countyKey)} aria-expanded={open === c.countyKey}>
              <div className="min-w-0 flex-1"><p className="font-semibold">{c.county}</p><p className="truncate text-xs text-muted-foreground">{c.utility} · Tax year {c.taxYear} · Updated {new Date(c.lastUpdated).toLocaleDateString()}</p></div>
              {c.pending ? <Badge variant="secondary">{c.pending} pending</Badge> : <Badge className="gap-1"><BadgeCheck className="h-3.5 w-3.5" /> Verified</Badge>}
              <ChevronDown className={`h-4 w-4 transition-transform ${open === c.countyKey ? "rotate-180" : ""}`} />
            </button>
            {open === c.countyKey && (
              <div className="space-y-2 border-t p-4">
                {c.programs.map((p) => (
                  <div key={p.name} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{p.name} {p.amount && <span className="font-normal text-muted-foreground">· {p.amount}</span>}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                      {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary">Check official source <ExternalLink className="h-3 w-3" /></a>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.reviewStatus === "approved" ? <Badge variant="outline">Approved {p.verified}</Badge> : <Badge variant="secondary">{p.source === "auto_research" ? "AI research" : "Needs review"}</Badge>}
                      {canApprove && p.reviewStatus !== "approved" && <Button size="sm" variant="outline" className="min-h-10" onClick={() => approve(c.countyKey, [p.name])} data-testid={`button-approve-${c.countyKey}-${p.name}`}>Approve</Button>}
                    </div>
                  </div>
                ))}
                {canApprove && <Button className="min-h-11" onClick={() => { if (confirm(`Approve all ${c.programs.length} programs for ${c.county}? Only do this after checking each official source.`)) approve(c.countyKey); }} data-testid={`button-approve-all-${c.countyKey}`}>Approve all for {c.county}</Button>}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
