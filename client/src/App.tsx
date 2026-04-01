import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ProposalSidebar } from "@/components/proposal-sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { ProposalProvider } from "@/lib/proposal-context";
import { useState, useEffect, useMemo } from "react";
import { McCurdyLogo } from "@/components/mccurdy-logo";
import { ArrowRight, Shield, Sparkles, Star, ChevronRight } from "lucide-react";

// Customer pages
import Welcome from "@/pages/welcome";
import ProposalSummary from "@/pages/proposal-summary";
import WhySystem from "@/pages/why-system";
import RoofSystem from "@/pages/roof-system";
import MaterialsLibrary from "@/pages/materials-library";
import MilsBuild from "@/pages/mils-build";
import ColorOptions from "@/pages/color-options";
import PricingOptions from "@/pages/pricing-options";
import WarrantyCenter from "@/pages/warranty-center";
import BeforeAfter from "@/pages/before-after";
import SavingsIncentives from "@/pages/savings-incentives";
import CompliancePage from "@/pages/compliance";
import SiliconeBenefits from "@/pages/silicone-benefits";
import FormsPrint from "@/pages/forms-print";
import DocumentsProvided from "@/pages/documents-provided";
import CPAQuestions from "@/pages/cpa-questions";
import ApprovalCenter from "@/pages/approval-center";

// Admin pages
import AdminDashboard from "@/pages/admin-dashboard";
import AdminProposals from "@/pages/admin-proposals";
import AdminProposalEdit from "@/pages/admin-proposal-edit";
import AdminMessages from "@/pages/admin-messages";
import AdminActivity from "@/pages/admin-activity";

import NotFound from "@/pages/not-found";

const CUSTOMER_PAGES = [
  "", "/summary", "/why", "/system", "/materials", "/mils", "/colors",
  "/pricing", "/warranty", "/visualizer", "/savings", "/compliance",
  "/silicone", "/forms", "/documents", "/cpa-questions", "/approve",
];

function ProposalProgressBar({ token }: { token: string }) {
  const [location] = useHashLocation();
  const basePath = `/view/${token}`;

  const currentIdx = CUSTOMER_PAGES.findIndex(p => {
    const fullPath = `${basePath}${p}`;
    return location === fullPath;
  });

  const progress = currentIdx >= 0 ? ((currentIdx + 1) / CUSTOMER_PAGES.length) * 100 : 0;

  if (currentIdx < 0) return null;

  return (
    <div className="h-0.5 bg-muted/50 w-full">
      <div
        className="h-full copper-gradient transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

function CustomerProposalApp({ token }: { token: string }) {
  const sidebarStyle = {
    "--sidebar-width": "17rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <ProposalProvider token={token}>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <ProposalSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <header className="flex items-center justify-between px-3 py-2 border-b bg-card/50 backdrop-blur-sm" data-testid="header-customer">
              <div className="flex items-center gap-2">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </div>
              <div className="flex items-center gap-2">
                <McCurdyLogo className="w-4 h-4 text-muted-foreground/50" />
                <span className="text-xs font-medium text-muted-foreground">McCurdy Roofing</span>
              </div>
            </header>
            <ProposalProgressBar token={token} />
            <main className="flex-1 overflow-y-auto scroll-smooth">
              <Switch>
                <Route path="/view/:token" component={Welcome} />
                <Route path="/view/:token/summary" component={ProposalSummary} />
                <Route path="/view/:token/why" component={WhySystem} />
                <Route path="/view/:token/system" component={RoofSystem} />
                <Route path="/view/:token/materials" component={MaterialsLibrary} />
                <Route path="/view/:token/mils" component={MilsBuild} />
                <Route path="/view/:token/colors" component={ColorOptions} />
                <Route path="/view/:token/pricing" component={PricingOptions} />
                <Route path="/view/:token/warranty" component={WarrantyCenter} />
                <Route path="/view/:token/visualizer" component={BeforeAfter} />
                <Route path="/view/:token/savings" component={SavingsIncentives} />
                <Route path="/view/:token/compliance" component={CompliancePage} />
                <Route path="/view/:token/silicone" component={SiliconeBenefits} />
                <Route path="/view/:token/forms" component={FormsPrint} />
                <Route path="/view/:token/documents" component={DocumentsProvided} />
                <Route path="/view/:token/cpa-questions" component={CPAQuestions} />
                <Route path="/view/:token/approve" component={ApprovalCenter} />
                <Route component={Welcome} />
              </Switch>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProposalProvider>
  );
}

function AdminApp() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AdminSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-3 py-2 border-b bg-card/50 backdrop-blur-sm" data-testid="header-admin">
            <SidebarTrigger data-testid="button-admin-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-muted-foreground/50" />
              <span className="text-xs font-medium text-muted-foreground">Admin Portal</span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/proposals" component={AdminProposals} />
              <Route path="/admin/proposals/:id" component={AdminProposalEdit} />
              <Route path="/admin/messages" component={AdminMessages} />
              <Route path="/admin/activity" component={AdminActivity} />
              <Route component={AdminDashboard} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function LandingPage() {
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-background overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 dot-pattern" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-accent/[0.03] blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/[0.04] blur-3xl translate-y-1/3 -translate-x-1/4" />

      <div className="relative text-center space-y-6 p-8 max-w-lg animate-fade-in-up">
        {/* Logo */}
        <div className="w-20 h-20 mx-auto mb-4 relative">
          <div className="absolute inset-0 rounded-2xl copper-gradient opacity-10 animate-pulse-glow" />
          <div className="relative w-full h-full rounded-2xl bg-card border border-border/50 flex items-center justify-center shadow-lg">
            <McCurdyLogo className="w-10 h-10 text-primary" />
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-landing-title">
            McCurdy Roof
            <span className="gradient-text-copper"> Investment Proposal</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-sm mx-auto leading-relaxed">
            Welcome to the McCurdy Proposal Platform. Access your personalized investment proposal or manage proposals through the admin portal.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3 pt-2">
          <a href="/#/view/demo-proposal-2026" className="block">
            <button className="w-full px-5 py-3 copper-gradient text-white rounded-xl text-sm font-semibold shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 group" data-testid="button-demo">
              <Sparkles className="w-4 h-4" />
              View Demo Proposal
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </a>
          <a href="/#/admin" className="block">
            <button className="w-full px-5 py-3 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 hover:border-primary/20 transition-all duration-200 flex items-center justify-center gap-2" data-testid="button-admin">
              <Shield className="w-4 h-4 text-muted-foreground" />
              Admin Portal
            </button>
          </a>
        </div>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-4 pt-4">
          {[
            { icon: Shield, label: "Lic #477152" },
            { icon: Star, label: "30-Yr Warranty" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-muted-foreground">
              <item.icon className="w-3 h-3" />
              <span className="text-[11px]">{item.label}</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground/60 pt-2">McCurdy Roofing Inc. &middot; 650-952-0233</p>
      </div>
    </div>
  );
}

function AppRouter() {
  const [location] = useHashLocation();

  // Extract token from view routes
  const viewMatch = location.match(/^\/view\/([^/]+)/);
  
  if (viewMatch) {
    return <CustomerProposalApp token={viewMatch[1]} />;
  }

  if (location.startsWith("/admin")) {
    return <AdminApp />;
  }

  return <LandingPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
