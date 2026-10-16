import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudLightning, CalendarCheck, MousePointerClick, Send, Loader2, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Data = { optedIn: number; events: any[]; followups: any[] };
const KEY = ["/api/admin/storm-followups"];
const d = (t?: number) => (t ? new Date(t * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");

export default function AdminRetention() {
  const { toast } = useToast();
  const { data } = useQuery<Data>({ queryKey: KEY });
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const check = async (body: any) => {
    setBusy(true);
    try {
      const r = await (await apiRequest("POST", "/api/admin/storm-check", body)).json();
      if (!r.detected) toast({ title: "No storm detected", description: r.message });
      else if (r.sent !== undefined) toast({ title: `Sent ${r.sent} of ${r.recipients} storm alerts` });
      else toast({ title: `Storm found: ${r.storm.reason} (${r.storm.date})`, description: "Tap 'Send alerts' to email opted-in customers." });
      queryClient.invalidateQueries({ queryKey: KEY });
      return r;
    } catch (e: any) { toast({ title: "Weather check failed", description: String(e.message).replace(/^\d+: /, ""), variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const booked = async (id: string, v: boolean) => { await apiRequest("POST", `/api/admin/storm-followups/${id}/booked`, { booked: v }); queryClient.invalidateQueries({ queryKey: KEY }); };
  const totals = (data?.events || []).reduce((a, e) => ({ sent: a.sent + e.sent, clicked: a.clicked + e.clicked, booked: a.booked + e.booked }), { sent: 0, clicked: 0, booked: 0 });

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6" data-testid="page-admin-retention">
      <div className="flex items-start gap-3"><CloudLightning className="mt-0.5 h-6 w-6 shrink-0 text-primary" /><div><h1 className="text-xl font-bold">Storm Follow-ups</h1><p className="text-sm text-muted-foreground">After 1 inch or more of rain, or gusts of 43 mph or more, in the Bay Area, customers who opted in automatically get a "free post-storm inspection" email (at most once a week). Each click and booking is tracked here.</p></div></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Opted in", data?.optedIn ?? 0, Users], ["Alerts sent", totals.sent, Send], ["Clicked", totals.clicked, MousePointerClick], ["Booked", totals.booked, CalendarCheck]].map(([l, v, I]: any) => (
          <Card key={l}><CardContent className="p-4"><I className="mb-1 h-4 w-4 text-primary" /><p className="text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="min-h-11 gap-2" disabled={busy} onClick={async () => { const r = await check({}); if (r?.detected && r.storm && confirm(`Storm found: ${r.storm.reason}. Email ${data?.optedIn ?? 0} opted-in customers now?`)) check({ send: true }); }} data-testid="button-storm-check">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudLightning className="h-4 w-4" />} Check weather now</Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input className="min-h-11" placeholder='Or describe a storm you know about, e.g. "heavy rain and hail"' value={reason} onChange={(e) => setReason(e.target.value)} data-testid="input-storm-reason" />
          <Button variant="outline" className="min-h-11 shrink-0" disabled={busy || !reason.trim()} onClick={() => { if (confirm(`Email ${data?.optedIn ?? 0} opted-in customers about "${reason}"?`)) check({ manualReason: reason }).then(() => setReason("")); }} data-testid="button-storm-send-manual">Send alerts</Button>
        </div>
        {!data?.optedIn && <p className="text-xs text-muted-foreground">No customers have opted in yet. Customers can opt in on their project timeline or on their email preferences page.</p>}
      </CardContent></Card>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Recent alerts</h2>
        {(data?.followups || []).length === 0 && <p className="text-sm text-muted-foreground">No storm alerts sent yet.</p>}
        {(data?.followups || []).map((f) => (
          <Card key={f.id}><CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{f.customer_name}</p><p className="truncate text-xs text-muted-foreground">{f.property_address}{f.customer_phone ? ` · ${f.customer_phone}` : ""}</p></div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {f.sent_at ? <Badge variant="outline">Sent {d(f.sent_at)}</Badge> : <Badge variant="destructive">Not delivered</Badge>}
              {f.clicked_at ? <Badge variant="secondary">Clicked {d(f.clicked_at)}</Badge> : null}
              <Button size="sm" variant={f.booked_at ? "default" : "outline"} onClick={() => booked(f.id, !f.booked_at)} data-testid={`button-booked-${f.id}`}>{f.booked_at ? `Booked ${d(f.booked_at)}` : "Mark booked"}</Button>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
