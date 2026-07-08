import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Copy, ExternalLink, Settings2, Plus, Mail, CheckCircle2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Proposal } from "@shared/schema";

export default function AdminProposals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [activeProposal, setActiveProposal] = useState<Proposal | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sending, setSending] = useState(false);

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

  const openSendDialog = (p: Proposal) => {
    setActiveProposal(p);
    setSendEmail((p as any).customerEmail || (p as any).lastSentTo || "");
    setSendMessage("");
    setSendDialogOpen(true);
  };

  const handleSend = async () => {
    if (!activeProposal) return;
    if (!/^\S+@\S+\.\S+$/.test(sendEmail.trim())) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/admin/proposals/${activeProposal.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sendEmail.trim(), message: sendMessage.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      toast({
        title: "Proposal sent",
        description: `Emailed to ${data.sentTo}. Customer has 24/7 access via their private link.`,
      });
      setSendDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proposals"] });
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    }
    setSending(false);
  };

  const seedDemo = async () => {
    await apiRequest("POST", "/api/admin/seed-demo");
    window.location.reload();
  };

  const statusVariant = (s: string): "default" | "secondary" | "outline" => {
    if (s === "approved") return "default";
    if (s === "sent" || s === "viewed") return "secondary";
    return "outline";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="page-admin-proposals">
      <div className="flex items-center justify-between">
        <PageHeader title="Proposals" subtitle="Manage all customer proposals" icon={<FileText className="w-5 h-5" />} />
        <div className="flex gap-2">
          <Button variant="outline" className="text-xs" onClick={seedDemo} data-testid="button-seed">Seed Demo Data</Button>
          <a
            href="/#/admin/proposals/new"
            className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            data-testid="button-new-proposal"
          >
            <Plus className="w-4 h-4" /> New Proposal
          </a>
        </div>
      </div>

      {proposals.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No proposals yet. Click &ldquo;Seed Demo Data&rdquo; to create a sample proposal.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => {
            const anyP = p as any;
            const sent = anyP.sendCount > 0;
            return (
              <Card key={p.id} data-testid={`card-proposal-${p.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{p.proposalNumber}</span>
                        <Badge variant={statusVariant(p.status)} className="text-[10px] capitalize">{p.status.replace("_", " ")}</Badge>
                        {sent && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Sent {anyP.sendCount}x
                          </Badge>
                        )}
                        {anyP.signedAt && (
                          <Badge className="text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-600">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Signed
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold">{p.customerName}</h3>
                      {p.companyName && <p className="text-xs text-muted-foreground">{p.companyName}</p>}
                      <p className="text-xs text-muted-foreground">{p.propertyAddress}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.proposalDate} &middot; {p.estimator}
                        {anyP.lastSentAt && <> &middot; Last sent: {new Date(anyP.lastSentAt).toLocaleDateString()}</>}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                      <Button
                        size="sm"
                        className="text-xs h-7 gap-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => openSendDialog(p)}
                        data-testid={`button-send-${p.id}`}
                      >
                        <Send className="w-3 h-3" /> {sent ? "Resend" : "Send to Customer"}
                      </Button>
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
            );
          })}
        </div>
      )}

      {/* Send Email Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" /> Send Proposal to Customer
            </DialogTitle>
            <DialogDescription>
              Your customer receives a beautifully formatted email with their private portal link.
              They can view the proposal, download attachments, and e-sign — all from any device.
            </DialogDescription>
          </DialogHeader>

          {activeProposal && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-muted/40 p-3 text-xs">
                <div className="font-semibold text-foreground">{activeProposal.customerName}
                  {activeProposal.companyName && <span className="text-muted-foreground"> &middot; {activeProposal.companyName}</span>}
                </div>
                <div className="text-muted-foreground mt-0.5">{activeProposal.propertyAddress}</div>
                <div className="text-muted-foreground mt-0.5 font-mono">{activeProposal.proposalNumber}</div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="send-email" className="text-xs">Customer Email</Label>
                <Input
                  id="send-email"
                  type="email"
                  placeholder="customer@company.com"
                  value={sendEmail}
                  onChange={e => setSendEmail(e.target.value)}
                  data-testid="input-send-email"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="send-message" className="text-xs">Personal Message (optional)</Label>
                <Textarea
                  id="send-message"
                  placeholder="Hi Sarah, here's the proposal we discussed. Let me know if you have any questions!"
                  className="min-h-[80px] text-sm"
                  value={sendMessage}
                  onChange={e => setSendMessage(e.target.value)}
                  data-testid="input-send-message"
                />
                <p className="text-[11px] text-muted-foreground">Shown in the email above the proposal link.</p>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 text-xs text-amber-900 dark:text-amber-200">
                <strong>You get a copy.</strong> A BCC of every send goes to mschirmer1922@gmail.com for your records.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)} disabled={sending}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Send className="w-4 h-4" />
              {sending ? "Sending..." : "Send Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
