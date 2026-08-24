import { useProposal } from "@/lib/proposal-context";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Check,
  Star,
  ArrowRight,
  Shield,
  Layers,
  Zap,
  CreditCard,
  Info,
} from "lucide-react";
import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GuaranteeRibbon } from "@/components/customer-trust";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface PricingOption {
  name: string;
  price: string;
  description: string;
  features: string[];
  recommended: boolean;
}

// Extract mil thickness from features or description
function getMils(opt: PricingOption): string {
  for (const f of opt.features) {
    const match = f.match(/(\d+)\s*dry\s*mil/i);
    if (match) return match[1];
  }
  const descMatch = opt.description.match(/(\d+)\s*dry\s*mil/i);
  return descMatch ? descMatch[1] : "";
}

// Extract warranty years from name
function getYears(name: string): string {
  const match = name.match(/(\d+)-?[Yy]ear/);
  return match ? match[1] : "";
}

export default function PricingOptions() {
  const { proposal, trackEvent, token } = useProposal();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const financingTerms = [60, 84, 120, 180];
  const [termIndex, setTermIndex] = useState(0);
  const term = financingTerms[termIndex];
  const [apr, setApr] = useState(8.99);
  const [application, setApplication] = useState({
    applicantName: "",
    email: "",
    phone: "",
    employmentStatus: "",
    annualIncome: "$50k-$100k",
    preferredProvider: "Contact Me",
  });
  const [applied, setApplied] = useState(false);
  const [chosenTier, setChosenTier] = useState(0);
  const { data: addons = [], refetch: refetchAddons } = useQuery<
    Array<{
      id: string;
      name: string;
      description: string;
      priceAdd: string;
      selected: number;
    }>
  >({
    queryKey: ["public-addons", token],
    queryFn: () =>
      fetch(`/api/proposals/${token}/addons`).then((r) => r.json()),
  });
  useEffect(() => {
    trackEvent("viewed", { page: "pricing" });
  }, []);
  if (!proposal) return null;

  const options: PricingOption[] = proposal.pricingOptions
    ? JSON.parse(proposal.pricingOptions)
    : [];

  // Find recommended index
  const recommendedIdx = options.findIndex((o) => o.recommended);
  const roofSqft = proposal.verifiedSqft || (
    proposal.roofAreas ? JSON.parse(proposal.roofAreas) : []
  ).reduce(
    (sum: number, x: string) =>
      sum +
      Number((x.match(/[\d,]+(?=\s*sq\s*ft)/i)?.[0] || "0").replace(/,/g, "")),
    0,
  );
  const tierValue =
    Number((options[chosenTier]?.price || "0").match(/[\d.]+/)?.[0] || 0) *
    (roofSqft || 1);
  const addonValue = addons
    .filter((a) => a.selected)
    .reduce((sum, a) => {
      const n = Number(a.priceAdd.match(/[\d.]+/)?.[0] || 0);
      return (
        sum +
        (a.priceAdd.toLowerCase().includes("sqft") ? n * (roofSqft || 1) : n)
      );
    }, 0);
  const total = tierValue + addonValue;
  const monthly =
    apr === 0
      ? total / term
      : (total * ((apr / 100 / 12) * Math.pow(1 + apr / 100 / 12, term))) /
        (Math.pow(1 + apr / 100 / 12, term) - 1);

  return (
    <div
      className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6"
      data-testid="page-pricing"
    >
      <GuaranteeRibbon />
      <PageHeader
        title="Pricing & Options"
        subtitle="Compare McCurdy Silicone Roof Renewal System warranty tiers — select the right level for your property"
        icon={<DollarSign className="w-5 h-5" />}
      />

      {/* ── How It Works Banner ── */}
      <div className="relative overflow-hidden rounded-xl premium-gradient p-5">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
        <div className="relative flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <Info className="w-4 h-4 text-white/80" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white/90">
              How Warranty Tiers Work
            </p>
            <p className="text-xs text-white/60 mt-1 leading-relaxed max-w-2xl">
              Each tier is defined by the total dry mils of silicone applied to
              your roof. Higher mil builds provide longer waterproof protection
              and qualify for extended manufacturer warranties. All tiers
              include full surface prep, primer, penetration reinforcement, and
              silicone coating.
            </p>
          </div>
        </div>
      </div>

      {/* ── Tier Cards ── */}
      {options.length === 0 ? (
        <Card className="glass-card border-0">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Pricing options have not been added yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 stagger-children">
          {options.map((opt, i) => {
            const mils = getMils(opt);
            const years = getYears(opt.name);
            const isRecommended = opt.recommended;
            const isExpanded = expandedIdx === i;

            return (
              <div
                key={i}
                className={`relative rounded-xl transition-all duration-300 ${
                  isRecommended
                    ? "bg-gradient-to-r from-accent/[0.06] via-accent/[0.03] to-transparent border-2 border-accent/40 shadow-lg shadow-accent/10"
                    : "glass-card hover:shadow-md hover:border-primary/20"
                }`}
                data-testid={`card-pricing-option-${i}`}
              >
                {/* Recommended badge */}
                {isRecommended && (
                  <div className="absolute -top-3 left-5 z-10">
                    <Badge className="bg-accent hover:bg-accent text-white border-0 text-xs gap-1 shadow-md px-3 py-0.5">
                      <Star className="w-3 h-3" fill="currentColor" /> Most
                      Recommended
                    </Badge>
                  </div>
                )}

                <div className={`p-5 ${isRecommended ? "pt-7" : ""}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Left: Mil circle + Tier info */}
                    <div className="flex items-center gap-4 sm:w-72 flex-shrink-0">
                      {/* Mil thickness indicator */}
                      <div
                        className={`relative w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          isRecommended
                            ? "copper-gradient shadow-md"
                            : "bg-primary/8 border border-primary/10"
                        }`}
                      >
                        <div className="text-center">
                          <span
                            className={`text-lg font-bold leading-none ${isRecommended ? "text-white" : "text-primary"}`}
                          >
                            {mils || "—"}
                          </span>
                          <p
                            className={`text-xs uppercase tracking-wider ${isRecommended ? "text-white/70" : "text-primary/60"}`}
                          >
                            mils
                          </p>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          {opt.name}
                        </h3>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span
                            className={`text-xl font-bold ${isRecommended ? "text-accent" : "text-primary"}`}
                          >
                            {opt.price}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Center: Description + Quick features */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {opt.description}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {opt.features.slice(0, 4).map((f, j) => (
                          <span
                            key={j}
                            className="flex items-center gap-1 text-xs text-foreground/75"
                          >
                            <Check
                              className={`w-3 h-3 flex-shrink-0 ${isRecommended ? "text-accent" : "text-primary/60"}`}
                            />
                            {f}
                          </span>
                        ))}
                        {opt.features.length > 4 && (
                          <button
                            onClick={() =>
                              setExpandedIdx(isExpanded ? null : i)
                            }
                            className="text-xs text-primary hover:underline"
                          >
                            +{opt.features.length - 4} more
                          </button>
                        )}
                      </div>

                      {/* Expanded features */}
                      {isExpanded && opt.features.length > 4 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 animate-fade-in">
                          {opt.features.slice(4).map((f, j) => (
                            <span
                              key={j}
                              className="flex items-center gap-1 text-xs text-foreground/75"
                            >
                              <Check
                                className={`w-3 h-3 flex-shrink-0 ${isRecommended ? "text-accent" : "text-primary/60"}`}
                              />
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: CTA */}
                    <div className="flex-shrink-0 sm:w-32">
                      <Link href={`/view/${token}/approve`}>
                        <Button
                          variant={isRecommended ? "default" : "outline"}
                          className={`w-full text-xs gap-1.5 h-10 font-semibold transition-all ${
                            isRecommended
                              ? "bg-accent hover:bg-accent/90 shadow-md animate-pulse-glow"
                              : ""
                          }`}
                          data-testid={`button-select-option-${i}`}
                          onClick={() => setChosenTier(i)}
                        >
                          Select <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Visual warranty bar */}
                <div className="px-5 pb-3">
                  <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isRecommended ? "copper-gradient" : "bg-primary/30"
                      }`}
                      style={{
                        width: `${Math.min(((parseInt(years) || 5) / 30) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      5 yr
                    </span>
                    <span className="text-xs text-muted-foreground">
                      30 yr
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <h2 className="font-semibold">Structured Upgrade Menu</h2>
              <p className="text-sm text-muted-foreground">
                Choose only the additions that fit your property.
              </p>
            </div>
            <b data-testid="text-live-total">
              Estimated total: $
              {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </b>
          </div>
          <div className="space-y-2">
            {addons.map((addon) => (
              <label
                key={addon.id}
                className="flex items-start gap-3 rounded border p-3 cursor-pointer"
              >
                <Checkbox
                  data-testid={`checkbox-addon-${addon.id}`}
                  checked={!!addon.selected}
                  onCheckedChange={async () => {
                    await fetch(
                      `/api/proposals/${token}/addons/${addon.id}/toggle`,
                      { method: "POST" },
                    );
                    refetchAddons();
                  }}
                />
                <span className="min-w-0">
                  <b className="text-sm block">
                    {addon.name}{" "}
                    <span className="text-primary">{addon.priceAdd}</span>
                  </b>
                  <span className="text-xs text-muted-foreground break-words">
                    {addon.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Financing Calculator</h2>
            <p className="text-sm text-muted-foreground">
              Informational estimate for your selected tier and upgrades.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Loan term: {term} months</Label>
              <Slider
                data-testid="slider-loan-term"
                min={0}
                max={3}
                step={1}
                value={[termIndex]}
                onValueChange={(v) => setTermIndex(v[0])}
              />
              <Label>APR: {apr.toFixed(2)}%</Label>
              <Slider
                data-testid="slider-apr"
                min={6.99}
                max={12.99}
                step={0.01}
                value={[apr]}
                onValueChange={(v) => setApr(v[0])}
              />
            </div>
            <div className="rounded bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                Estimated monthly payment
              </p>
              <p
                data-testid="text-monthly-payment"
                className="text-3xl font-bold"
              >
                $
                {Number.isFinite(monthly)
                  ? monthly.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })
                  : "0.00"}
              </p>
              {proposal.verifiedSqft ? <Badge className="mt-2 text-xs">Verified by measurement</Badge> : proposal.aiAnalysisApprovedAt ? <Badge className="mt-2 text-xs">Verified by McCurdy</Badge> : null}
              <p className="text-xs text-muted-foreground">
                Based on $
                {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
                financed.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[
              [
                "GoGreen Financing",
                "Energy efficiency financing options",
                "https://gogreenfinancing.com/",
              ],
              [
                "PACE",
                "Property tax assessment financing",
                "https://dfpi.ca.gov/consumers/housing/pace/",
              ],
              [
                "HERO Program",
                "Property-assessed energy financing",
                "https://www.renovateamerica.com/",
              ],
            ].map(([name, desc, url]) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="border rounded p-3"
              >
                <b className="text-sm">{name}</b>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 space-y-3">
          <h2 className="font-semibold">Financing Application Intake</h2>
          <p className="text-sm text-muted-foreground">
            Submitting does not affect your credit. Mike will contact you about
            next steps.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(
              [
                ["applicantName", "Name"],
                ["email", "Email"],
                ["phone", "Phone"],
                ["employmentStatus", "Employment status"],
                ["annualIncome", "Annual income bracket"],
              ] as const
            ).map(([key, label]) => (
              <input
                key={key}
                data-testid={`input-financing-${key}`}
                className="h-10 rounded border bg-background px-3 text-sm"
                placeholder={label}
                value={application[key]}
                onChange={(e) =>
                  setApplication({ ...application, [key]: e.target.value })
                }
              />
            ))}
          </div>
          <select data-testid="select-financing-provider" className="h-10 rounded border bg-background px-3 text-sm" value={application.preferredProvider} onChange={e => setApplication({ ...application, preferredProvider: e.target.value })}><option value="Contact Me">Contact Me</option><option value="GoGreen">GoGreen</option><option value="PACE">PACE</option><option value="HERO">HERO</option></select>
          <Button
            data-testid="button-submit-financing"
            disabled={applied}
            onClick={async () => {
              const r = await fetch(`/api/proposals/${token}/financing/apply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...application, preferredTerm: term }),
              });
              if (r.ok) setApplied(true);
            }}
          >
            {applied ? "Application received" : "Submit application"}
          </Button>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {[
          ["Standard", "50% at start, 50% at completion"],
          ["Milestone", "25/25/25/25"],
          [
            "Financing",
            `$${Number.isFinite(monthly) ? monthly.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0.00"}/mo`,
          ],
        ].map(([name, detail]) => (
          <Card key={name}>
            <CardContent className="p-4">
              <b className="text-sm">{name}</b>
              <p className="text-sm text-muted-foreground">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Payment Schedule ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">
              Payment Schedule
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-600 text-xs font-bold">
                $0
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  No Deposit Required
                </p>
                <p className="text-xs text-muted-foreground">
                  Work begins without upfront cost
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                50%
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Upon Cleaning & Sealing Complete
                </p>
                <p className="text-xs text-muted-foreground">
                  Materials loaded, surfaces prepped
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-xs font-bold">
                50%
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Upon Job Completion
                </p>
                <p className="text-xs text-muted-foreground">
                  Unless otherwise noted in revision
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">
              Why Choose McCurdy Silicone?
            </h3>
          </div>
          <div className="space-y-2">
            {[
              "No-dollar-limit (NDL) warranty coverage",
              "Up to 30 years manufacturer-backed",
              "No tear-off — preserves existing roof",
              "Energy savings from cool-roof reflectivity",
              "Section 179 tax deduction eligible",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="w-3 h-3 text-accent flex-shrink-0" />
                <span className="text-xs text-foreground/80">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
