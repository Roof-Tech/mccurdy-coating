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
import { Suspense, lazy } from "react";

// Customer pages
import Welcome from "@/pages/welcome";
import ProposalSummary from "@/pages/proposal-summary";
const WhySystem = lazy(() => import("@/pages/why-system"));
const RoofSystem = lazy(() => import("@/pages/roof-system"));
const MaterialsLibrary = lazy(() => import("@/pages/materials-library"));
const MilsBuild = lazy(() => import("@/pages/mils-build"));
const ColorOptions = lazy(() => import("@/pages/color-options"));
import PricingOptions from "@/pages/pricing-options";
const WarrantyCenter = lazy(() => import("@/pages/warranty-center"));
const BeforeAfter = lazy(() => import("@/pages/before-after"));
const SavingsIncentives = lazy(() => import("@/pages/savings-incentives"));
const CompliancePage = lazy(() => import("@/pages/compliance"));
const SiliconeBenefits = lazy(() => import("@/pages/silicone-benefits"));
const FormsPrint = lazy(() => import("@/pages/forms-print"));
const DocumentsProvided = lazy(() => import("@/pages/documents-provided"));
const CPAQuestions = lazy(() => import("@/pages/cpa-questions"));
import ApprovalCenter from "@/pages/approval-center";
const MeetYourCrew = lazy(() => import("@/pages/meet-your-crew"));
const ProjectTimeline = lazy(() => import("@/pages/project-timeline"));
const ReferralRewards = lazy(() => import("@/pages/referral-rewards"));
const WarrantyRegistration = lazy(
  () => import("@/pages/warranty-registration"),
);
const ReviewRouter = lazy(() => import("@/pages/review-router"));
const ReferralLanding = lazy(() => import("@/pages/referral-landing"));

// Admin pages
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AdminProposals = lazy(() => import("@/pages/admin-proposals"));
const AdminProposalCreate = lazy(() => import("@/pages/admin-proposal-create"));
const AdminProposalEdit = lazy(() => import("@/pages/admin-proposal-edit"));
const AdminMessages = lazy(() => import("@/pages/admin-messages"));
const AdminActivity = lazy(() => import("@/pages/admin-activity"));
const AdminCrew = lazy(() => import("@/pages/admin-crew"));
const AdminReferrals = lazy(() => import("@/pages/admin-referrals"));
const AdminEstimateLeads = lazy(() => import("@/pages/admin-estimate-leads"));
const Estimate = lazy(() => import("@/pages/estimate"));

const Messages = lazy(() => import("@/pages/messages"));
const Invoices = lazy(() => import("@/pages/invoices"));
const Preferences = lazy(() => import("@/pages/preferences"));
const AdminFinancing = lazy(() => import("@/pages/admin-financing"));
const AdminScheduling = lazy(() => import("@/pages/admin-scheduling"));
const FieldCapture = lazy(() => import("@/pages/admin-field-capture"));
import NotFound from "@/pages/not-found";

function LoadingSpinner() {
  return (
    <div
      className="p-6 text-sm text-muted-foreground"
      role="status"
      data-testid="loading-page"
    >
      Loading…
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
            <header
              className="flex items-center justify-between p-2 border-b"
              data-testid="header-customer"
            >
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <span className="text-xs text-muted-foreground pr-2">
                McCurdy Roofing
              </span>
            </header>
            <main id="main-content" className="flex-1 overflow-y-auto">
              <Switch>
                <Route path="/view/:token" component={Welcome} />
                <Route
                  path="/view/:token/summary"
                  component={ProposalSummary}
                />
                <Route path="/view/:token/why" component={WhySystem} />
                <Route path="/view/:token/system" component={RoofSystem} />
                <Route
                  path="/view/:token/materials"
                  component={MaterialsLibrary}
                />
                <Route path="/view/:token/mils" component={MilsBuild} />
                <Route path="/view/:token/colors" component={ColorOptions} />
                <Route path="/view/:token/pricing" component={PricingOptions} />
                <Route
                  path="/view/:token/warranty"
                  component={WarrantyRegistration}
                />
                <Route path="/view/:token/crew" component={MeetYourCrew} />
                <Route
                  path="/view/:token/timeline"
                  component={ProjectTimeline}
                />
                <Route path="/view/:token/refer" component={ReferralRewards} />
                <Route path="/view/:token/review" component={ReviewRouter} />
                <Route path="/view/:token/messages" component={Messages} />
                <Route path="/view/:token/invoices" component={Invoices} />
                <Route
                  path="/view/:token/preferences"
                  component={Preferences}
                />
                <Route path="/view/:token/visualizer" component={BeforeAfter} />
                <Route
                  path="/view/:token/savings"
                  component={SavingsIncentives}
                />
                <Route
                  path="/view/:token/compliance"
                  component={CompliancePage}
                />
                <Route
                  path="/view/:token/silicone"
                  component={SiliconeBenefits}
                />
                <Route path="/view/:token/forms" component={FormsPrint} />
                <Route
                  path="/view/:token/documents"
                  component={DocumentsProvided}
                />
                <Route
                  path="/view/:token/cpa-questions"
                  component={CPAQuestions}
                />
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
          <header
            className="flex items-center justify-between p-2 border-b"
            data-testid="header-admin"
          >
            <SidebarTrigger data-testid="button-admin-sidebar-toggle" />
            <span className="text-xs text-muted-foreground pr-2">
              Admin Portal
            </span>
          </header>
          <main id="main-content" className="flex-1 overflow-y-auto">
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/proposals" component={AdminProposals} />
              <Route
                path="/admin/proposals/new"
                component={AdminProposalCreate}
              />
              <Route
                path="/admin/proposals/:id/field-capture"
                component={FieldCapture}
              />
              <Route
                path="/admin/proposals/:id"
                component={AdminProposalEdit}
              />
              <Route path="/admin/messages" component={AdminMessages} />
              <Route path="/admin/activity" component={AdminActivity} />
              <Route path="/admin/crew" component={AdminCrew} />
              <Route path="/admin/referrals" component={AdminReferrals} />
              <Route path="/admin/instant-estimates" component={AdminEstimateLeads} />
              <Route path="/admin/financing" component={AdminFinancing} />
              <Route path="/admin/scheduling" component={AdminScheduling} />
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
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="w-16 h-16 mx-auto mb-2 text-primary">
          <svg
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 4L2 20h6v14h24V20h6L20 4z"
              fill="currentColor"
              opacity="0.15"
            />
            <path
              d="M20 6L4 20h5v13h22V20h5L20 6z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="M14 22v8M20 18v12M26 22v8"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M14 22l3-4 3 4 3-4 3 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold" data-testid="text-landing-title">
          McCurdy Coatings
        </h1>
        <p className="text-sm text-muted-foreground">
          Welcome to the McCurdy Proposal Platform. If you have a proposal link,
          please use it to access your personalized proposal.
        </p>
        <div className="space-y-2">
          <a href="/#/estimate" className="block">
            <button
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium"
              data-testid="button-instant-estimate"
            >
              Get Instant Roof Estimate
            </button>
          </a>
          <a href="/#/view/demo-proposal-2026" className="block">
            <button
              className="w-full px-4 py-2.5 border border-border rounded-md text-sm text-foreground"
              data-testid="button-demo"
            >
              View Demo Proposal
            </button>
          </a>
          <a href="/#/admin" className="block">
            <button
              className="w-full px-4 py-2.5 border border-border rounded-md text-sm text-foreground"
              data-testid="button-admin"
            >
              Admin Portal
            </button>
          </a>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          McCurdy Roofing Inc. &middot; License #477152 &middot; 650-952-0233
        </p>
      </div>
    </div>
  );
}

function AppRouter() {
  const [location] = useHashLocation();
  const referralMatch = window.location.pathname.match(/^\/refer\/([^/]+)/);
  if (referralMatch) return <ReferralLanding code={referralMatch[1]} />;

  // Extract token from view routes
  const viewMatch = location.match(/^\/view\/([^/]+)/);

  if (viewMatch) {
    return <CustomerProposalApp token={viewMatch[1]} />;
  }

  if (location.startsWith("/estimate")) {
    return <Estimate />;
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
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-background focus:p-3"
          >
            Skip to main content
          </a>
          <Suspense fallback={<LoadingSpinner />}>
            <AppRouter />
          </Suspense>
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
