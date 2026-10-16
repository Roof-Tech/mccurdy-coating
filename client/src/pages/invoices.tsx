import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, CreditCard, Send, CheckCircle2, Printer, Loader2 } from "lucide-react";

type Invoice = { id: string; amount: string; description: string; status: string; dueDate?: number | null; paidAt?: number | null; paymentMethod?: string | null; receiptNumber?: string | null };
const date = (t?: number | null) => (t ? new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

export default function Invoices() {
  const { token } = useProposal();
  const { data: rows = [], isLoading, refetch } = useQuery<Invoice[]>({ queryKey: ["invoices", token], queryFn: () => fetch(`/api/proposals/${token}/invoices`).then((r) => r.json()) });
  const { data: config } = useQuery<{ onlinePayments: boolean }>({ queryKey: ["/api/payments/config"] });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // Returning from Stripe Checkout: confirm with the server before showing "paid".
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const paid = qs.get("paid"), sessionId = qs.get("session_id");
    if (!paid || !sessionId) return;
    setNotice({ tone: "ok", text: "Confirming your payment…" });
    fetch(`/api/proposals/${token}/invoices/${paid}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.status === "paid") setNotice({ tone: "ok", text: `Payment received. Receipt ${j.receiptNumber} was emailed to you.` });
        else if (r.status === 202) setNotice({ tone: "ok", text: "Your bank payment is processing. We'll email your receipt once it clears." });
        else setNotice({ tone: "err", text: j.error || "We couldn't confirm the payment yet. If you were charged, your receipt will arrive by email shortly." });
        refetch();
        window.history.replaceState(null, "", window.location.pathname + window.location.hash);
      });
  }, [token, refetch]);

  const pay = async (inv: Invoice) => {
    setBusy(inv.id); setNotice(null);
    try {
      const r = await fetch(`/api/proposals/${token}/invoices/${inv.id}/checkout`, { method: "POST" });
      const j = await r.json();
      if (r.ok && j.url) { window.location.href = j.url; return; }
      setNotice({ tone: "err", text: j.error || "The payment page couldn't open. Please try again." });
    } catch { setNotice({ tone: "err", text: "The payment page couldn't open. Please try again." }); }
    setBusy(null);
  };
  const requestLink = async (inv: Invoice) => {
    setBusy(inv.id);
    const r = await fetch(`/api/proposals/${token}/invoices/${inv.id}/payment-interest`, { method: "POST" }).catch(() => null);
    setBusy(null);
    setNotice(r?.ok ? { tone: "ok", text: "Request sent. McCurdy Coatings will text or email you a secure payment link." } : { tone: "err", text: "We couldn't send your request. Please call 650-952-0233." });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6" data-testid="page-invoices">
      <PageHeader title="Invoices" subtitle="Your project billing, payments, and receipts" icon={<Receipt className="h-5 w-5" />} />
      {notice && <div role="status" className={`rounded-lg border p-3 text-sm ${notice.tone === "ok" ? "border-primary/30 bg-primary/5" : "border-red-300 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"}`} data-testid="text-payment-notice">{notice.text}</div>}
      {isLoading ? <div className="h-24 animate-pulse rounded-xl bg-muted" /> : rows.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">No invoices have been issued yet.</CardContent></Card>
      ) : rows.map((x) => (
        <Card key={x.id} data-testid={`card-invoice-${x.id}`}>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold">{x.description}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant={x.status === "paid" ? "default" : "secondary"}>{x.status === "paid" ? "Paid" : "Payment due"}</Badge>
                {x.status === "paid" ? <span>Paid {date(x.paidAt)} · {x.paymentMethod} · Receipt {x.receiptNumber}</span> : x.dueDate ? <span>Due {date(x.dueDate)}</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <b className="text-lg tabular-nums">{x.amount}</b>
              {x.status === "paid" ? (
                <Button variant="outline" className="min-h-11 gap-2" onClick={() => window.print()} data-testid={`button-print-receipt-${x.id}`}><Printer className="h-4 w-4" /> Print receipt</Button>
              ) : config?.onlinePayments ? (
                <Button className="min-h-11 gap-2" disabled={busy === x.id} onClick={() => pay(x)} data-testid={`button-pay-invoice-${x.id}`}>{busy === x.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Pay securely online</Button>
              ) : (
                <Button className="min-h-11 gap-2" disabled={busy === x.id} onClick={() => requestLink(x)} data-testid={`button-request-payment-link-${x.id}`}><Send className="h-4 w-4" /> Request a payment link</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      {config?.onlinePayments && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Payments are processed securely by Stripe. McCurdy never sees your card number.</p>}
    </div>
  );
}
