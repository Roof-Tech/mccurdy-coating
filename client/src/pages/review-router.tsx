import { useState } from "react";
import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Star, ExternalLink, MessageSquareText, CheckCircle2 } from "lucide-react";

// Every customer sees the same public review options. Google's policy prohibits
// selectively asking happy customers for reviews (review gating) and suggesting
// review wording, so there is no star filter and no pre-written review text here.
const sites = [
  { name: "Google", url: "https://www.google.com/search?q=Mike+McCurdy+Roofing+Inc+South+San+Francisco+reviews#lrd" },
  { name: "Yelp", url: "https://www.yelp.com/writeareview/biz/mike-mccurdy-roofing-south-san-francisco" },
  { name: "BBB", url: "https://www.bbb.org/us/ca/-south-san-francisco/profile/roofing-contractors/mike-mccurdy-roofing-inc-1116-63654/customer-reviews" },
];

export default function ReviewRouter() {
  const { token, proposal } = useProposal();
  const [feedback, setFeedback] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!proposal) return null;
  const eligible = proposal.status === "completed" || proposal.status === "job_completed" || !!proposal.workCompletedDate;

  const logPublic = (site: string) => {
    fetch(`/api/proposals/${token}/review/public`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site }),
    }).catch(() => undefined);
  };

  const sendPrivate = async () => {
    if (!feedback.trim()) { setError("Please type a note before sending."); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/proposals/${token}/review/private-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      if (r.ok) setSent(true); else setError("We couldn't send that. Please try again.");
    } catch { setError("We couldn't send that. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5" data-testid="page-review">
      <PageHeader title="Share Your Experience" subtitle="Honest feedback — good or bad — helps us and your neighbors" icon={<Star className="w-5 h-5" />} />
      {!eligible ? (
        <Card><CardContent className="p-5 text-sm">This page will be available after your project is complete.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Leave a public review</h2>
                <p className="mt-1 text-sm text-muted-foreground">Tell others about your project in your own words. Every review is welcome, whatever your experience.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {sites.map((s) => (
                  <a key={s.name} href={s.url} target="_blank" rel="noreferrer" onClick={() => logPublic(s.name)} data-testid={`link-${s.name.toLowerCase()}-review`}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-semibold hover:bg-muted">
                    Review on {s.name} <ExternalLink className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="flex items-start gap-3">
                <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h2 className="text-lg font-semibold">Send Mike a private note</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Optional, and separate from public reviews. Use it for questions, concerns, or ideas for us.</p>
                </div>
              </div>
              {sent ? (
                <p className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm" data-testid="text-feedback-sent"><CheckCircle2 className="h-4 w-4 text-primary" /> Thank you — Mike will read your note personally.</p>
              ) : (
                <>
                  <Textarea data-testid="textarea-private-feedback" value={feedback} maxLength={5000} onChange={(e) => setFeedback(e.target.value)} placeholder="Your note to Mike" className="min-h-28 text-base" />
                  {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
                  <Button data-testid="button-submit-private-feedback" className="min-h-12 w-full sm:w-auto" disabled={busy} onClick={sendPrivate}>{busy ? "Sending…" : "Send private note"}</Button>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
