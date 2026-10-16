import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, ChevronRight, LogOut } from "lucide-react";
import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerVerify, useCustomerVerification } from "@/components/customer-verify";

type Prop = { token: string; proposalNumber: string; address: string; city: string | null; status: string; proposalDate: string; approvedOption: string | null; completed: string | null };
const label = (p: Prop) => (p.completed ? "Completed" : p.status === "approved" ? "Approved" : p.status === "sent" || p.status === "viewed" ? "Proposal" : p.status.replace(/_/g, " "));

export default function MyProperties() {
  const { token } = useProposal();
  const { data: v, refetch } = useCustomerVerification(token);
  const { data } = useQuery<{ email: string; properties: Prop[] }>({ queryKey: ["my-properties", v?.verified], enabled: !!v?.verified, queryFn: () => fetch("/api/customer/properties", { credentials: "include" }).then((r) => r.json()) });
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6" data-testid="page-my-properties">
      <PageHeader title="My Properties" subtitle="Every McCurdy proposal, project, and warranty for your email" icon={<Building2 className="h-5 w-5" />} />
      {v && !v.hasEmail ? (
        <Card><CardContent className="p-5 text-sm text-muted-foreground" data-testid="text-no-email">We don't have an email on file for this proposal yet. Call <a className="font-semibold text-primary" href="tel:6509520233">650-952-0233</a> and we'll add it so you can see all your properties in one place.</CardContent></Card>
      ) : !v?.verified ? <CustomerVerify token={token} /> : (
        <>
          <div className="space-y-2">{(data?.properties || []).map((p) => (
            <Link key={p.token} href={`/view/${p.token}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md"><CardContent className="flex min-h-16 items-center gap-3 p-4">
                <Building2 className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.address}</p><p className="truncate text-xs text-muted-foreground">{p.city ? `${p.city} · ` : ""}#{p.proposalNumber} · {p.proposalDate}{p.approvedOption ? ` · ${p.approvedOption}` : ""}</p></div>
                <Badge variant={p.completed ? "default" : "secondary"} className="capitalize">{label(p)}</Badge>
                {p.token === token && <Badge variant="outline">Viewing</Badge>}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent></Card>
            </Link>
          ))}</div>
          <Button variant="ghost" className="min-h-11 gap-2" onClick={async () => { await fetch("/api/customer/sign-out", { method: "POST", credentials: "include" }); refetch(); }} data-testid="button-customer-signout"><LogOut className="h-4 w-4" /> Sign out on this device</Button>
        </>
      )}
    </div>
  );
}
