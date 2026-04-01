import { useProposal } from "@/lib/proposal-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { McCurdyLogo } from "@/components/mccurdy-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  FileText, BarChart3, TrendingUp, MessageSquare, CheckCircle,
  MapPin, Calendar, User, Building2, Shield, Sparkles, ArrowRight,
  Phone, Clock, Award,
} from "lucide-react";

export default function Welcome() {
  const { proposal, isLoading, token } = useProposal();
  const basePath = `/view/${token}`;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md shadow-lg">
          <CardContent className="p-8 text-center">
            <McCurdyLogo className="w-16 h-16 mx-auto text-primary mb-4" />
            <h2 className="text-lg font-semibold mb-2">Proposal Not Found</h2>
            <p className="text-sm text-muted-foreground">This proposal link may have expired or is invalid. Please contact McCurdy Coatings at 650-952-0233.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8" data-testid="page-welcome">
      {/* ── Premium Hero Section ── */}
      <div className="relative overflow-hidden rounded-xl mx-4 mt-4 premium-gradient" style={{ minHeight: '320px' }}>
        {/* Decorative geometric shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/[0.03]" />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-white/[0.02] -translate-x-1/2 translate-y-1/2" />
          <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-accent/10" />
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="relative z-10 p-8 md:p-10 flex flex-col justify-between" style={{ minHeight: '320px' }}>
          {/* Top: Logo + Badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                <McCurdyLogo className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-white/90 text-sm font-semibold tracking-wide">McCurdy Coatings</p>
                <p className="text-white/50 text-xs">License #477152</p>
              </div>
            </div>
            <Badge className="bg-accent/90 hover:bg-accent text-white border-0 text-xs px-3 py-1 shadow-lg">
              <Sparkles className="w-3 h-3 mr-1.5" />
              Investment Proposal
            </Badge>
          </div>

          {/* Center: Main title */}
          <div className="mt-8">
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight tracking-tight animate-fade-in-up" data-testid="text-welcome-title">
              Your Complete Roof
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-300 to-amber-400">
                Investment Proposal
              </span>
            </h1>
            <p className="text-white/60 text-sm mt-3 max-w-lg leading-relaxed">
              A comprehensive analysis of your roofing needs — system, materials, warranty options, pricing, savings opportunities, and next steps.
            </p>
          </div>

          {/* Bottom: Customer info pills */}
          <div className="flex flex-wrap gap-2 mt-6">
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/[0.08]">
              <User className="w-3.5 h-3.5 text-white/60" />
              <span className="text-white/90 text-xs font-medium" data-testid="text-customer-name">{proposal.customerName}</span>
            </div>
            {proposal.companyName && (
              <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/[0.08]">
                <Building2 className="w-3.5 h-3.5 text-white/60" />
                <span className="text-white/90 text-xs font-medium">{proposal.companyName}</span>
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/[0.08]">
              <Calendar className="w-3.5 h-3.5 text-white/60" />
              <span className="text-white/90 text-xs font-medium">{new Date(proposal.proposalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Property & System Summary ── */}
      <div className="px-4 space-y-4">
        <div className="glass-card rounded-xl p-5 animate-fade-in-up" style={{ animationDelay: '0.1s', animationFillMode: 'backwards' }}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Property Location</p>
              <p className="text-sm font-semibold text-foreground">{proposal.propertyAddress}</p>
            </div>
            {proposal.systemType && (
              <Badge variant="outline" className="text-xs border-accent/30 text-accent bg-accent/5 flex-shrink-0">
                <Shield className="w-3 h-3 mr-1" />
                {proposal.systemType}
              </Badge>
            )}
          </div>
        </div>

        {/* ── Estimator Message ── */}
        {proposal.welcomeMessage && (
          <div className="glass-card rounded-xl p-6 animate-fade-in-up" style={{ animationDelay: '0.2s', animationFillMode: 'backwards' }}>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full copper-gradient flex items-center justify-center flex-shrink-0 shadow-md">
                <span className="text-white text-sm font-bold">
                  {proposal.estimator ? proposal.estimator.charAt(0) : 'M'}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-semibold text-foreground">{proposal.estimator || 'McCurdy Coatings'}</p>
                  <span className="text-xs text-muted-foreground">Estimator</span>
                </div>
                <p className="text-sm text-foreground/75 leading-relaxed italic" data-testid="text-welcome-message">
                  &ldquo;{proposal.welcomeMessage}&rdquo;
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Quick Navigation Grid ── */}
        <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Quick Navigation</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { label: "View Full Proposal", desc: "Scope, system & specifications", icon: FileText, href: `${basePath}/summary`, primary: true },
              { label: "Compare Options", desc: "6 warranty tiers with pricing", icon: BarChart3, href: `${basePath}/pricing`, primary: false },
              { label: "Savings & Tax Credits", desc: "County incentives & deductions", icon: TrendingUp, href: `${basePath}/savings`, primary: false },
              { label: "Approve Proposal", desc: "Sign off & schedule your project", icon: CheckCircle, href: `${basePath}/approve`, primary: true },
            ].map((item) => (
              <Link key={item.label} href={item.href}>
                <div
                  className={`group relative rounded-xl p-4 transition-all duration-200 cursor-pointer border ${
                    item.primary
                      ? 'bg-primary text-white border-primary hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5'
                      : 'glass-card hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30'
                  }`}
                  data-testid={`button-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        item.primary ? 'bg-white/15' : 'bg-primary/8'
                      }`}>
                        <item.icon className={`w-4.5 h-4.5 ${item.primary ? 'text-white' : 'text-primary'}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${item.primary ? '' : 'text-foreground'}`}>{item.label}</p>
                        <p className={`text-xs mt-0.5 ${item.primary ? 'text-white/70' : 'text-muted-foreground'}`}>{item.desc}</p>
                      </div>
                    </div>
                    <ArrowRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${
                      item.primary ? 'text-white/60' : 'text-muted-foreground/40'
                    }`} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Trust Signals ── */}
        <div className="grid grid-cols-3 gap-3 animate-fade-in-up" style={{ animationDelay: '0.4s', animationFillMode: 'backwards' }}>
          {[
            { icon: Shield, label: "Licensed & Insured", sublabel: "Lic #477152" },
            { icon: Award, label: "Up to 30-Year", sublabel: "ASC Warranty" },
            { icon: Clock, label: "3-4 Week", sublabel: "Timeline" },
          ].map((trust) => (
            <div key={trust.label} className="text-center p-3 rounded-xl bg-muted/40 border border-transparent">
              <trust.icon className="w-5 h-5 text-accent mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-foreground leading-tight">{trust.label}</p>
              <p className="text-[10px] text-muted-foreground">{trust.sublabel}</p>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between pt-2 pb-2">
          <p className="text-[10px] text-muted-foreground">
            Proposal #{proposal.proposalNumber}
          </p>
          <div className="flex items-center gap-3">
            <a href="tel:6509520233" className="text-[10px] text-muted-foreground hover:text-accent transition-colors flex items-center gap-1">
              <Phone className="w-3 h-3" /> 650-952-0233
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
