import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Phone, MessageCircle, Send, RefreshCw, Shield, ArrowRight, PenTool, Eraser, CalendarDays } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

// ── Signature Pad Component ──
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasSignature = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasSignature.current = true;
    if (empty) setEmpty(false);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasSignature.current) {
      onChange(canvasRef.current!.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature.current = false;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border-2 border-dashed border-border bg-white dark:bg-slate-900">
        <canvas
          ref={canvasRef}
          className="w-full h-40 touch-none cursor-crosshair rounded-lg"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          data-testid="canvas-signature"
        />
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <PenTool className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Sign here with your finger or mouse</p>
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={clear} className="text-xs h-7 gap-1.5" data-testid="button-clear-signature">
          <Eraser className="w-3 h-3" /> Clear
        </Button>
      </div>
    </div>
  );
}

export default function ApprovalCenter() {
  const { proposal, trackEvent, token } = useProposal();
  const { toast } = useToast();
  useEffect(() => { trackEvent("viewed", { page: "approve" }); }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [requestedStart, setRequestedStart] = useState("");
  const [question, setQuestion] = useState("");
  const [revision, setRevision] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  if (!proposal) return null;

  const options = proposal.pricingOptions ? JSON.parse(proposal.pricingOptions) : [];

  const handleApprove = async () => {
    if (!name) {
      toast({ title: "Name required", description: "Please enter your full legal name.", variant: "destructive" });
      return;
    }
    if (options.length > 0 && !selectedOption) {
      toast({ title: "Option required", description: "Please select a pricing option before signing.", variant: "destructive" });
      return;
    }
    if (!signature) {
      toast({ title: "Signature required", description: "Please sign in the box below to approve.", variant: "destructive" });
      return;
    }
    setSubmitting("approve");
    try {
      // Save signature + approval
      const res = await fetch(`/api/proposals/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          signedByName: name,
          signedByTitle: title || null,
          approvedOption: selectedOption || null,
          requestedStartDate: requestedStart || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save signature");

      // Also log the message for the admin messages panel
      await apiRequest("POST", `/api/proposal/${token}/message`, {
        senderName: name, senderEmail: email, senderPhone: phone,
        messageType: "approval",
        message: `Approved option: ${selectedOption || "Not specified"}${requestedStart ? ` — Requested start: ${requestedStart}` : ""}`,
        selectedOption,
      }).catch(() => {});

      toast({
        title: "Proposal Signed & Approved",
        description: "McCurdy Roofing has been notified. Expect a call within one business day to confirm your start date.",
      });
      trackEvent("approved", { option: selectedOption, signed: true });
      setSigned(true);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Please try again or call 650-952-0233.", variant: "destructive" });
    }
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
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Title (optional)</label>
              <Input placeholder="Owner, Facilities Manager, etc." value={title} onChange={e => setTitle(e.target.value)} data-testid="input-title" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Sign & Approve (full width) ── */}
      <Card className="glass-card border-0 overflow-hidden border-t-4 border-t-green-500">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <PenTool className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Sign &amp; Approve Proposal</h3>
              <p className="text-[11px] text-muted-foreground">Your electronic signature is legally binding under the E-SIGN Act.</p>
            </div>
          </div>

          {signed ? (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-5 text-center">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Signed &amp; Approved</p>
              <p className="text-xs text-muted-foreground mt-1">McCurdy Roofing was notified. Expect a call within one business day.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">
                    Select Option {options.length > 0 && <span className="text-destructive">*</span>}
                  </label>
                  <Select value={selectedOption} onValueChange={setSelectedOption}>
                    <SelectTrigger data-testid="select-option">
                      <SelectValue placeholder="Choose warranty term" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt: any, i: number) => (
                        <SelectItem key={i} value={opt.name}>{opt.name} — {opt.price}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Schedule Your Start Date
                  </label>
                  <a
                    href="https://calendly.com/mccurdycoatings"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setRequestedStart(new Date().toISOString().slice(0, 10))}
                    className="flex items-center justify-center gap-2 h-10 w-full rounded-md border border-green-600 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium transition-colors"
                    data-testid="link-book-start-date"
                  >
                    <CalendarDays className="w-4 h-4" />
                    Book Start Date on Calendar
                  </a>
                  <p className="text-[10px] text-muted-foreground mt-1">Opens our live calendar — pick a time that works for you</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Your Signature <span className="text-destructive">*</span>
                </label>
                <SignaturePad onChange={setSignature} />
              </div>

              <div className="rounded-md bg-muted/40 border border-border/50 p-3 text-[11px] text-muted-foreground leading-relaxed">
                By signing above, I, <strong className="text-foreground">{name || "[your name]"}</strong>, authorize McCurdy Roofing Inc. to perform the work described in this proposal at the pricing selected. I understand this is a legally binding electronic signature. A copy of this signed approval will be emailed to me and stored in my customer portal permanently.
              </div>

              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 font-semibold h-11"
                onClick={handleApprove}
                disabled={submitting === "approve"}
                data-testid="button-approve"
              >
                <CheckCircle className="w-4 h-4" />
                {submitting === "approve" ? "Submitting Signature..." : "Sign & Approve Proposal"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Other Action Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

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
              <a
                href="https://calendly.com/mccurdycoatings"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
                data-testid="link-book-call"
              >
                <CalendarDays className="w-4 h-4 text-green-700" />
                <div>
                  <p className="text-sm font-medium text-green-800">Book a Call</p>
                  <p className="text-[10px] text-green-700/80">Pick a time on our live calendar</p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
