import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Phone, MessageCircle, Send, RefreshCw, Shield, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export default function ApprovalCenter() {
  const { proposal, trackEvent, token } = useProposal();
  const { toast } = useToast();
  useEffect(() => { trackEvent("viewed", { page: "approve" }); }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [question, setQuestion] = useState("");
  const [revision, setRevision] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  if (!proposal) return null;

  const options = proposal.pricingOptions ? JSON.parse(proposal.pricingOptions) : [];

  const handleApprove = async () => {
    if (!name) {
      toast({ title: "Name required", description: "Please enter your name to approve.", variant: "destructive" });
      return;
    }
    if (options.length > 0 && !selectedOption) {
      toast({ title: "Option required", description: "Please select a pricing option before approving.", variant: "destructive" });
      return;
    }
    setSubmitting("approve");
    try {
      await apiRequest("POST", `/api/proposal/${token}/message`, {
        senderName: name, senderEmail: email, senderPhone: phone,
        messageType: "approval",
        message: `Approved option: ${selectedOption || "Not specified"}`,
        selectedOption,
      });
      toast({ title: "Proposal Approved", description: "Thank you! McCurdy Roofing will be in touch shortly." });
      trackEvent("approved", { option: selectedOption });
    } catch { toast({ title: "Error", description: "Please try again or call 650-952-0233.", variant: "destructive" }); }
    setSubmitting(null);
  };

  const handleQuestion = async () => {
    if (!question.trim()) return;
    setSubmitting("question");
    try {
      await apiRequest("POST", `/api/proposal/${token}/message`, {
        senderName: name || "Customer", senderEmail: email,
        messageType: "question", message: question,
      });
      toast({ title: "Question Sent", description: "We'll get back to you soon." });
      setQuestion("");
      trackEvent("question_sent", {});
    } catch { toast({ title: "Error", description: "Please try again.", variant: "destructive" }); }
    setSubmitting(null);
  };

  const handleRevision = async () => {
    if (!revision.trim()) return;
    setSubmitting("revision");
    try {
      await apiRequest("POST", `/api/proposal/${token}/message`, {
        senderName: name || "Customer", senderEmail: email,
        messageType: "revision", message: revision,
      });
      toast({ title: "Revision Requested", description: "We'll update your proposal and send a new link." });
      setRevision("");
      trackEvent("revision_requested", {});
    } catch { toast({ title: "Error", description: "Please try again.", variant: "destructive" }); }
    setSubmitting(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-approve">
      <PageHeader
        title="Approve / Next Steps"
        subtitle="Ready to move forward? Choose your next action."
        icon={<CheckCircle className="w-5 h-5" />}
      />

      {/* ── Your Information ── */}
      <Card className="glass-card border-0">
        <div className="p-5 border-b border-border/50">
          <h3 className="text-sm font-semibold text-foreground">Your Information</h3>
        </div>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Name <span className="text-destructive">*</span></label>
              <Input placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} data-testid="input-name" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Email</label>
              <Input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} data-testid="input-email" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Phone</label>
              <Input placeholder="(555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} data-testid="input-phone" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Action Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Approve Proposal */}
        <Card className="glass-card border-0 overflow-hidden border-t-4 border-t-green-500">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-green-500" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Approve Proposal</h3>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Select Option</label>
              <Select value={selectedOption} onValueChange={setSelectedOption}>
                <SelectTrigger data-testid="select-option">
                  <SelectValue placeholder="Choose an option" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt: any, i: number) => (
                    <SelectItem key={i} value={opt.name}>{opt.name} — {opt.price}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 font-semibold"
              onClick={handleApprove}
              disabled={submitting === "approve"}
              data-testid="button-approve"
            >
              <CheckCircle className="w-4 h-4" />
              {submitting === "approve" ? "Submitting..." : "Approve Proposal"}
            </Button>
          </CardContent>
        </Card>

        {/* Ask a Question */}
        <Card className="glass-card border-0 overflow-hidden border-t-4 border-t-primary">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Ask a Question</h3>
            </div>
            <Textarea
              placeholder="Type your question here..."
              value={question}
              onChange={e => setQuestion(e.target.value)}
              className="min-h-[80px] text-sm"
              data-testid="textarea-question"
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleQuestion}
              disabled={submitting === "question" || !question.trim()}
              data-testid="button-send-question"
            >
              <Send className="w-4 h-4" />
              {submitting === "question" ? "Sending..." : "Send Question"}
            </Button>
          </CardContent>
        </Card>

        {/* Request Revision */}
        <Card className="glass-card border-0 overflow-hidden border-t-4 border-t-amber-500">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-amber-500" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Request Revision</h3>
            </div>
            <Textarea
              placeholder="What would you like changed?"
              value={revision}
              onChange={e => setRevision(e.target.value)}
              className="min-h-[80px] text-sm"
              data-testid="textarea-revision"
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleRevision}
              disabled={submitting === "revision" || !revision.trim()}
              data-testid="button-request-revision"
            >
              <RefreshCw className="w-4 h-4" />
              {submitting === "revision" ? "Sending..." : "Request Revision"}
            </Button>
          </CardContent>
        </Card>

        {/* Contact McCurdy */}
        <Card className="glass-card border-0 overflow-hidden border-t-4 border-t-accent">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Phone className="w-4 h-4 text-accent" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Contact McCurdy</h3>
            </div>
            <div className="space-y-2">
              <a href="tel:6509520233" className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <Phone className="w-4 h-4 text-accent" />
                <div>
                  <p className="text-sm font-medium text-foreground">Call 650-952-0233</p>
                  <p className="text-[10px] text-muted-foreground">Talk directly with our team</p>
                </div>
              </a>
              <a href="sms:6508085469" className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <MessageCircle className="w-4 h-4 text-accent" />
                <div>
                  <p className="text-sm font-medium text-foreground">Text 650-808-5469</p>
                  <p className="text-[10px] text-muted-foreground">Quick text for fast response</p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
