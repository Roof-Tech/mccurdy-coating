import { useState } from "react";
import { useLocation, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus } from "lucide-react";

const DEFAULT_PRICING_OPTIONS = [
  {
    name: "10-Year ASC Warranty",
    price: "$6.50/sq ft",
    description: "ASC Roof Renewal system with 30 dry mils. Solid mid-range protection with strong value per year of coverage.",
    features: [
      "Full power wash and prep",
      "Primer coat",
      "30 dry mils silicone build",
      "All penetration reinforcement",
      "10-year ASC manufacturer warranty",
    ],
    recommended: false,
  },
  {
    name: "20-Year ASC Warranty",
    price: "$9.50/sq ft",
    description: "ASC Roof Renewal system with 45 dry mils. Premium protection for owners planning to hold property long-term.",
    features: [
      "Full power wash and prep",
      "Primer coat",
      "45 dry mils silicone build",
      "All penetration reinforcement",
      "Drainage improvements",
      "20-year ASC manufacturer warranty",
    ],
    recommended: true,
  },
  {
    name: "30-Year ASC Warranty",
    price: "$14.00/sq ft",
    description: "ASC Roof Renewal system with 56 dry mils. The ultimate roof investment — maximum mil build and longest manufacturer warranty.",
    features: [
      "Full power wash and prep",
      "Primer coat",
      "56 dry mils silicone build",
      "All penetration reinforcement",
      "Drainage improvements",
      "Parapet wall treatment",
      "30-year ASC manufacturer warranty",
      "Priority scheduling",
    ],
    recommended: false,
  },
];

const DEFAULT_MATERIALS = (proposalId: number) => [
  { proposalId, manufacturer: "ASC (American Silicone Coatings)", productName: "ASC Silicone Primer", category: "primer", usedFor: "Surface preparation and adhesion promotion over existing membrane", technicalSummary: "Single-component moisture-cure primer. VOC compliant.", sortOrder: 1 },
  { proposalId, manufacturer: "ASC (American Silicone Coatings)", productName: "ASC Qualifying Silicone Base Coat", category: "base_coat", usedFor: "Primary waterproofing layer", technicalSummary: "High-solids silicone elastomeric coating. 90%+ solids content.", sortOrder: 2 },
  { proposalId, manufacturer: "ASC (American Silicone Coatings)", productName: "ASC Qualifying Silicone Top Coat", category: "top_coat", usedFor: "Final weathering surface — UV protection, reflectivity, aesthetic finish.", technicalSummary: "High-solids silicone top coat. Cool-roof rated. SRI 110+ in white.", sortOrder: 3 },
  { proposalId, manufacturer: "ASC (American Silicone Coatings)", productName: "Silicone Sealant/Mastic", category: "sealant", usedFor: "Detail work at penetrations and transitions", technicalSummary: "100% silicone sealant for gap filling and detail work.", sortOrder: 4 },
  { proposalId, manufacturer: "Various", productName: "Polyester Reinforcing Fabric", category: "reinforcing", usedFor: "Reinforcement at all seams, penetrations, and stress points", technicalSummary: "Non-woven polyester fabric embedded between coating layers.", sortOrder: 5 },
];

export default function AdminProposalCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    customerName: "",
    companyName: "",
    propertyAddress: "",
    city: "",
    county: "",
    state: "CA",
    utilityTerritory: "",
    proposalDate: today,
    estimator: "Mike McCurdy",
    projectType: "commercial",
    welcomeMessage:
      "Thank you for allowing McCurdy Roofing to evaluate your roofing needs. After a thorough job walk and inspection, we've prepared this comprehensive roof investment proposal for your review.",
    systemType: "Silicone Roof Restoration System",
    scopeSummary: "",
  });

  const set = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleCreate = async () => {
    if (!form.customerName.trim()) {
      toast({ title: "Customer name required", variant: "destructive" });
      return;
    }
    if (!form.propertyAddress.trim()) {
      toast({ title: "Property address required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const proposal = await apiRequest("POST", "/api/admin/proposals", {
        ...form,
        status: "draft",
        pricingOptions: JSON.stringify(DEFAULT_PRICING_OPTIONS),
        roofAreas: JSON.stringify([]),
        whyRecommended: JSON.stringify([]),
        keyIssues: JSON.stringify([]),
        accessories: JSON.stringify([]),
        addOns: JSON.stringify([]),
        alternateColors: JSON.stringify(["Light Gray", "Tan"]),
        paymentSchedule:
          "No deposit required. 50% due upon materials loaded on the roof and cleaning & sealing is completed. 50% upon completion of the job.",
        manufacturerName: "ASC (American Silicone Coatings)",
        recommendedColor: "White (Cool White)",
        coatingType: "ASC Qualifying Silicone Roof Coating",
        primer: "ASC Silicone Primer",
        baseCoat: "ASC Silicone Base Coat",
        topCoat: "ASC Silicone Top Coat",
        reinforcement: "Polyester reinforcing fabric at all seams, penetrations, and transitions",
        warrantyTerm: "5 to 30 years based on selected tier",
        manufacturerWarranty: "ASC Manufacturer Warranty — tier based on dry mil build (5 to 30 years)",
        workmanshipWarranty: "McCurdy Roofing Workmanship Warranty",
        warrantySummary:
          "Your roof will be covered by an ASC manufacturer warranty matched to the mil thickness of the system installed, plus a McCurdy Roofing workmanship warranty.",
        milsExplanation:
          "Mil thickness directly determines roof performance and warranty eligibility. Higher mil builds provide longer protection and greater warranty coverage.",
        totalDryMils: "23–56 dry mils depending on warranty tier selected",
        timelineEstimate: "3–4 weeks from contract signing, weather permitting",
        ndlWarranty:
          "NDL warranty covers 100% of material and labor costs for the full warranty term with no depreciation or dollar cap.",
        warrantyMaintenance:
          "Annual inspection recommended. McCurdy offers a maintenance program that includes roof inspection, drain clearing, minor touch-up repairs, and warranty compliance documentation.",
      }).then(r => r.json());

      // Seed default materials silently
      await Promise.all(DEFAULT_MATERIALS(proposal.id).map(m =>
        apiRequest("POST", "/api/admin/materials", m).catch(() => {})
      ));

      toast({ title: "Proposal created", description: `${proposal.proposalNumber} is ready to edit.` });
      navigate(`/admin/proposals/${proposal.id}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to create proposal.", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="page-admin-proposal-create">
      <div className="flex items-center gap-3">
        <Link href="/admin/proposals">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
        </Link>
        <PageHeader
          title="New Proposal"
          subtitle="Create a new customer proposal"
          icon={<Plus className="w-5 h-5" />}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Customer & Property</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Customer Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="John Smith"
                value={form.customerName}
                onChange={e => set("customerName", e.target.value)}
                data-testid="input-customer-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Company Name</Label>
              <Input
                placeholder="Smith Industrial LLC"
                value={form.companyName}
                onChange={e => set("companyName", e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-medium">
                Property Address <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="1234 Industrial Blvd, South San Francisco, CA 94080"
                value={form.propertyAddress}
                onChange={e => set("propertyAddress", e.target.value)}
                data-testid="input-property-address"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">City</Label>
              <Input
                placeholder="South San Francisco"
                value={form.city}
                onChange={e => set("city", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">County</Label>
              <Input
                placeholder="San Mateo"
                value={form.county}
                onChange={e => set("county", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Utility Territory</Label>
              <Input
                placeholder="PG&E"
                value={form.utilityTerritory}
                onChange={e => set("utilityTerritory", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Project Type</Label>
              <Select value={form.projectType} onValueChange={v => set("projectType", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Proposal Date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={form.proposalDate}
                onChange={e => set("proposalDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Estimator</Label>
              <Input
                placeholder="Mike McCurdy"
                value={form.estimator}
                onChange={e => set("estimator", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Welcome Message</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Thank you for allowing McCurdy Roofing to evaluate your roofing needs..."
            value={form.welcomeMessage}
            onChange={e => set("welcomeMessage", e.target.value)}
            className="min-h-[90px] text-sm"
          />
          <p className="text-[11px] text-muted-foreground mt-2">
            This appears on the customer's welcome page as a personal message from the estimator.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Scope of Work</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Full silicone roof restoration system over existing modified bitumen membrane. Includes power washing, seam repair, reinforcement of all penetrations and transitions, primer application, and two-coat silicone coating system..."
            value={form.scopeSummary}
            onChange={e => set("scopeSummary", e.target.value)}
            className="min-h-[90px] text-sm"
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        After creating, you'll be taken to the full proposal editor to add pricing tiers, roof conditions, photos, and more.
      </p>

      <div className="flex justify-end gap-3 pb-4">
        <Link href="/admin/proposals">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleCreate} disabled={saving} className="gap-2" data-testid="button-create-proposal">
          <Plus className="w-4 h-4" />
          {saving ? "Creating..." : "Create Proposal"}
        </Button>
      </div>
    </div>
  );
}
