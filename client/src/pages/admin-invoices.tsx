import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Plus, Send, CheckCircle2, Trash2, AlertTriangle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Row = { id: string; proposal_id: number; customer_name: string; proposal_number: string; amount: string; description: string; status: string; due_date: number | null; paid_at: number | null; payment_method: string | null; receipt_number: string | null };
type ProposalLite = { id: number; customerName: string; proposalNumber: string };
const METHODS = ["Check", "ACH / bank transfer", "Cash", "Card (in person)", "Financing"];
const d = (t: number | null) => (t ? new Date(t * 1000).toLocaleDateString() : "—");
const clean = (e: any) => String(e?.message || e).replace(/^\d+: /, "").replace(/^\{"error":"(.*)"\}$/, "$1");

export default function AdminInvoices() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<{ invoices: Row[]; onlinePayments: boolean }>({ queryKey: ["/api/admin/invoices"] });
  const { data: proposals = [] } = useQuery<ProposalLite[]>({ queryKey: ["/api/admin/proposals"] });
  const [form, setForm] = useState({ proposalId: "", amount: "", description: "", dueDate: "" });
  const [pay, setPay] = useState<Record<string, { method: string; reference: string }>>({});
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); refresh(); toast({ title: ok }); } catch (e) { toast({ title: "Couldn't complete", description: clean(e), variant: "destructive" }); } };
  const rows = data?.invoices ?? [];
  const outstanding = rows.filter((r) => r.status !== "paid").reduce((s, r) => s + Number(r.amount.replace(/[^0-9.]/g, "")), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6" data-testid="page-admin-invoices">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><Receipt className="h-6 w-6 text-primary" /><div><h1 className="text-xl font-bold">Invoices & Payments</h1><p className="text-sm text-muted-foreground">Outstanding: <b className="tabular-nums text-foreground">{outstanding.toLocaleString("en-US", { style: "currency", currency: "USD" })}</b></p></div></div>
        {data && (data.onlinePayments
          ? <Badge className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Online card payments on</Badge>
          : <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Online payments off — customers see “Request a payment link”</Badge>)}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="h-4 w-4" /> New invoice</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_1.4fr_0.9fr_auto] md:items-end">
          <div className="space-y-1"><Label>Proposal</Label><Select value={form.proposalId} onValueChange={(proposalId) => setForm({ ...form, proposalId })}><SelectTrigger className="min-h-11" data-testid="select-invoice-proposal"><SelectValue placeholder="Choose customer" /></SelectTrigger><SelectContent>{proposals.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.customerName} · {p.proposalNumber}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label htmlFor="inv-amount">Amount</Label><Input id="inv-amount" inputMode="decimal" placeholder="$0.00" className="min-h-11" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="input-invoice-amount" /></div>
          <div className="space-y-1"><Label htmlFor="inv-desc">Description</Label><Input id="inv-desc" placeholder="Deposit — 30% of contract" className="min-h-11" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-invoice-description" /></div>
          <div className="space-y-1"><Label htmlFor="inv-due">Due date</Label><Input id="inv-due" type="date" className="min-h-11" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} data-testid="input-invoice-due" /></div>
          <Button className="min-h-11" data-testid="button-create-invoice" onClick={() => act(async () => { await apiRequest("POST", "/api/admin/invoices", { proposalId: Number(form.proposalId), amount: form.amount, description: form.description, dueDate: form.dueDate ? Math.floor(new Date(form.dueDate + "T12:00:00").getTime() / 1000) : null }); setForm({ proposalId: "", amount: "", description: "", dueDate: "" }); }, "Invoice created as a draft")}>Create</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y p-0">
          {isLoading ? <div className="m-4 h-20 animate-pulse rounded bg-muted" /> : rows.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No invoices yet.</p> : rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center" data-testid={`row-invoice-${r.id}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.customer_name} <span className="font-normal text-muted-foreground">· {r.proposal_number}</span></p>
                <p className="truncate text-sm text-muted-foreground">{r.description} · Due {d(r.due_date)}</p>
                {r.status === "paid" && <p className="text-xs text-muted-foreground">Paid {d(r.paid_at)} · {r.payment_method} · Receipt {r.receipt_number}</p>}
              </div>
              <b className="tabular-nums">{r.amount}</b>
              <Badge variant={r.status === "paid" ? "default" : r.status === "sent" ? "outline" : "secondary"} className="w-fit capitalize">{r.status}</Badge>
              {r.status !== "paid" && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" className="min-h-11 gap-1.5" data-testid={`button-send-invoice-${r.id}`} onClick={() => act(async () => { const j = await apiRequest("POST", `/api/admin/invoices/${r.id}/send`).then((x) => x.json()); if (!j.email?.ok) throw new Error(`Marked sent, but email failed: ${j.email?.error}`); }, "Invoice emailed")}><Send className="h-4 w-4" /> {r.status === "sent" ? "Resend" : "Send"}</Button>
                  <Select value={pay[r.id]?.method || ""} onValueChange={(method) => setPay({ ...pay, [r.id]: { method, reference: pay[r.id]?.reference || "" } })}><SelectTrigger className="min-h-11 w-40" data-testid={`select-pay-method-${r.id}`}><SelectValue placeholder="Record payment" /></SelectTrigger><SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select>
                  {pay[r.id]?.method && <>
                    <Input placeholder="Check # / ref" className="min-h-11 w-32" value={pay[r.id].reference} onChange={(e) => setPay({ ...pay, [r.id]: { ...pay[r.id], reference: e.target.value } })} data-testid={`input-pay-ref-${r.id}`} />
                    <Button size="sm" className="min-h-11" data-testid={`button-record-payment-${r.id}`} onClick={() => act(() => apiRequest("POST", `/api/admin/invoices/${r.id}/record-payment`, pay[r.id]), "Payment recorded — receipt emailed")}>Mark paid</Button>
                  </>}
                  <Button variant="ghost" size="sm" className="min-h-11" aria-label="Delete invoice" data-testid={`button-delete-invoice-${r.id}`} onClick={() => { if (confirm("Delete this unpaid invoice?")) act(() => apiRequest("DELETE", `/api/admin/invoices/${r.id}`), "Invoice deleted"); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
