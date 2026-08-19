import { useState } from "react";
import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Star, Copy, ExternalLink } from "lucide-react";
const draft =
  "McCurdy Coatings did an outstanding job on our roof. Mike and his crew were professional, on time, and the silicone coating looks incredible. Highly recommend for any Bay Area commercial roofing project.";
const sites = [
  [
    "Google",
    "4.9",
    "https://www.google.com/search?q=Mike+McCurdy+Roofing+Inc+South+San+Francisco+reviews#lrd",
  ],
  [
    "Yelp",
    "4.6",
    "https://www.yelp.com/writeareview/biz/mike-mccurdy-roofing-south-san-francisco",
  ],
  [
    "BBB",
    "Not Rated",
    "https://www.bbb.org/us/ca/-south-san-francisco/profile/roofing-contractors/mike-mccurdy-roofing-inc-1116-63654/customer-reviews",
  ],
];
export default function ReviewRouter() {
  const { token, proposal } = useProposal();
  const [stars, setStars] = useState(0),
    [feedback, setFeedback] = useState(""),
    [submitted, setSubmitted] = useState(false);
  if (!proposal) return null;
  const eligible =
    proposal.status === "completed" ||
    proposal.status === "job_completed" ||
    !!proposal.workCompletedDate;
  const send = async () => {
    const r = await fetch(
      `/api/proposals/${token}/review/${stars >= 4 ? "public" : "private-feedback"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stars, feedback }),
      },
    );
    if (r.ok) setSubmitted(true);
  };
  return (
    <div
      className="p-4 md:p-6 max-w-2xl mx-auto space-y-5"
      data-testid="page-review"
    >
      <PageHeader
        title="Leave a Review"
        subtitle="Your feedback helps us improve"
        icon={<Star className="w-5 h-5" />}
      />
      {!eligible ? (
        <Card>
          <CardContent className="p-5 text-sm">
            This page will be available after your project is complete.
          </CardContent>
        </Card>
      ) : !stars ? (
        <Card>
          <CardContent className="p-6 text-center space-y-4">
            <h2 className="text-lg font-semibold">How did we do?</h2>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  data-testid={`button-star-${n}`}
                  key={n}
                  onClick={() => setStars(n)}
                  aria-label={`${n} stars`}
                >
                  <Star
                    className="w-9 h-9 text-amber-400"
                    fill="currentColor"
                  />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : stars >= 4 ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">
              Thank you for the great feedback!
            </h2>
            <div className="grid gap-2">
              {sites.map(([name, rating, url]) => (
                <a key={name} href={url} target="_blank" rel="noreferrer">
                  <Button
                    data-testid={`button-${name.toLowerCase()}-review`}
                    className="w-full justify-between"
                  >
                    Leave a {name} review{" "}
                    <span className="text-xs opacity-80">
                      {name} {rating}{" "}
                      <ExternalLink className="inline w-3 h-3" />
                    </span>
                  </Button>
                </a>
              ))}
            </div>
            <div className="rounded bg-muted p-3">
              <p className="text-sm">{draft}</p>
              <Button
                data-testid="button-copy-review"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => navigator.clipboard.writeText(draft)}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy suggested review
              </Button>
            </div>
            <Button data-testid="button-submit-review" onClick={send}>
              Finish
            </Button>
          </CardContent>
        </Card>
      ) : submitted ? (
        <Card>
          <CardContent className="p-6 text-center">
            Thank you — Mike will review your feedback.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="text-lg font-semibold">
              We’re sorry we missed the mark.
            </h2>
            <Textarea
              data-testid="textarea-private-feedback"
              value={feedback}
              maxLength={5000}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="How can we make this right?"
            />
            <Button data-testid="button-submit-private-feedback" onClick={send}>
              Send private feedback
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
