import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight, Building2, Camera, CheckCircle2, ChevronLeft, ClipboardCopy,
  CloudSun, FileText, ImagePlus, Loader2, MapPinned, Phone, ShieldCheck,
  Sparkles, Upload, WandSparkles,
} from "lucide-react";

type Estimate = {
  id: string;
  condition: "Good" | "Fair" | "Poor" | "Critical" | string;
  materialType: string;
  estimatedSqft: number;
  recommendedTier: number;
  priceLow: number;
  priceHigh: number;
  priceRecommended: number;
  issues: string[];
  upgrades: string[];
  confidence: string;
  notes?: string;
  photoUrls: string[];
};

const tiers = [
  [5, 5.5], [10, 6.5], [15, 7.5], [20, 9.5], [25, 12], [30, 14],
] as const;
const money = (amount: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
}).format(amount);
const conditionStyles: Record<string, string> = {
  Good: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Fair: "bg-amber-100 text-amber-800 border-amber-200",
  Poor: "bg-orange-100 text-orange-800 border-orange-200",
  Critical: "bg-red-100 text-red-800 border-red-200",
};

function EstimateResults({ estimate }: { estimate: Estimate }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [requesting, setRequesting] = useState(false);
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/#/estimate/${estimate.id}`);
      toast({ title: "Estimate link copied", description: "You can share this estimate with your team." });
    } catch {
      toast({ title: "Copy unavailable", description: "Copy the URL from your browser to share this estimate.", variant: "destructive" });
    }
  };
  const requestProposal = async () => {
    setRequesting(true);
    try {
      await apiRequest("POST", `/api/estimate/${estimate.id}/request-proposal`);
      toast({ title: "Full proposal requested", description: "We’ll email a formal proposal within 24 hours." });
    } catch {
      toast({ title: "Request not sent", description: "Please call (650) 952-0233 and we’ll help right away.", variant: "destructive" });
    } finally {
      setRequesting(false);
    }
  };
  return (
    <main className="min-h-screen bg-slate-50" data-testid="page-estimate-results">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <button onClick={() => navigate("/estimate")} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-primary" data-testid="button-new-estimate">
            <ChevronLeft className="h-4 w-4" /> New estimate
          </button>
          <button onClick={share} className="inline-flex items-center gap-2 text-sm font-semibold text-primary" data-testid="button-share-estimate">
            <ClipboardCopy className="h-4 w-4" /> Share this estimate
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-6 sm:py-10">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-primary to-slate-800 p-6 text-white shadow-xl sm:p-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/25 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-200">Your McCurdy Coatings Estimate</p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl" data-testid="text-estimate-range">{money(estimate.priceLow)} – {money(estimate.priceHigh)}</h1>
            <p className="mt-2 text-sm text-slate-200 sm:text-base">Planning range based on a {estimate.estimatedSqft.toLocaleString()} sq ft {estimate.condition.toLowerCase()} condition {estimate.materialType} roof.</p>
            <div className="mt-6 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm sm:flex sm:items-center sm:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-wider text-orange-100">Recommended for you</p><p className="mt-1 text-lg font-bold">{estimate.recommendedTier}-Year Silicone System</p></div>
              <p className="mt-2 text-2xl font-bold text-orange-200 sm:mt-0">{money(estimate.priceRecommended)}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">AI Roof Analysis</p><h2 className="mt-1 text-xl font-bold">Coating suitability overview</h2></div><Badge className={`border ${conditionStyles[estimate.condition] || "bg-muted text-foreground"}`} data-testid="badge-estimate-condition">{estimate.condition}</Badge></div>
              <div className="mt-6 grid grid-cols-2 gap-3 border-y py-4 text-sm"><div><p className="text-muted-foreground">Detected material</p><p className="mt-1 font-semibold">{estimate.materialType}</p></div><div><p className="text-muted-foreground">Analysis confidence</p><p className="mt-1 font-semibold capitalize" title="Confidence reflects how clearly the submitted images showed the roof surface.">{estimate.confidence}</p></div></div>
              {estimate.notes && <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{estimate.notes}</p>}
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div><h3 className="flex items-center gap-2 text-sm font-bold"><CloudSun className="h-4 w-4 text-orange-600" /> Detected issues</h3><ul className="mt-3 space-y-2 text-sm text-slate-700">{estimate.issues.length ? estimate.issues.map((item, index) => <li key={index} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />{item}</li>) : <li className="text-muted-foreground">No immediate coating concerns were confidently detected.</li>}</ul></div>
                <div><h3 className="flex items-center gap-2 text-sm font-bold"><Sparkles className="h-4 w-4 text-primary" /> Upgrades we recommend</h3><ul className="mt-3 space-y-2 text-sm text-slate-700">{estimate.upgrades.length ? estimate.upgrades.map((item, index) => <li key={index} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>) : <li className="text-muted-foreground">Your inspection will identify the best reinforcement details.</li>}</ul></div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20 shadow-sm">
            <CardContent className="p-5 sm:p-7">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Warranty investment options</p>
              <h2 className="mt-1 text-xl font-bold">Choose your protection level</h2>
              <div className="mt-5 overflow-hidden rounded-xl border">
                {tiers.map(([years, price]) => {
                  const recommended = years === estimate.recommendedTier;
                  return <div className={`grid grid-cols-[1fr_auto] items-center gap-3 border-b px-3 py-3 last:border-0 sm:px-4 ${recommended ? "bg-primary text-primary-foreground" : "bg-white"}`} key={years} data-testid={`tier-estimate-${years}`}>
                    <div><p className="text-sm font-bold">{years}-Year Silicone System {recommended && <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">RECOMMENDED</span>}</p><p className={`text-xs ${recommended ? "text-slate-200" : "text-muted-foreground"}`}>{money(price)}/sq ft</p></div>
                    <p className="text-sm font-bold">{money(estimate.estimatedSqft * price)}</p>
                  </div>;
                })}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">This AI-assisted range is a starting point, not a final contract price. Mike will confirm roof area, prep needs, and system details during your free on-site inspection.</p>
            </CardContent>
          </Card>
        </div>

        {estimate.photoUrls.length > 0 && <Card><CardContent className="p-5 sm:p-7"><h2 className="text-lg font-bold">Your submitted roof photos</h2><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{estimate.photoUrls.map((url, index) => <a href={url} key={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border bg-muted focus:outline-none focus:ring-2 focus:ring-ring" data-testid={`link-estimate-photo-${index}`}><img src={url} alt={`Submitted roof view ${index + 1}`} className="h-28 w-full object-cover sm:h-36" loading="lazy" /></a>)}</div></CardContent></Card>}

        <section className="rounded-2xl border border-primary/20 bg-white p-5 shadow-sm sm:flex sm:items-center sm:justify-between sm:p-8">
          <div><p className="text-lg font-bold">Ready for a roof professional to verify this?</p><p className="mt-1 text-sm text-muted-foreground">Free on-site inspection · License #477152 · We’ll be in touch within 24 hours</p></div>
          <div className="mt-5 flex flex-col gap-3 sm:mt-0 sm:min-w-[260px]">
            <a href="https://calendly.com/mccurdycoatings" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring" data-testid="link-book-inspection"><Phone className="h-4 w-4" /> Book Free On-Site Inspection</a>
            <Button onClick={requestProposal} disabled={requesting} variant="outline" className="min-h-11 gap-2" data-testid="button-request-full-proposal">{requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Request Full Proposal</Button>
          </div>
        </section>
        <p className="pb-4 text-center text-xs text-muted-foreground">McCurdy Roofing Inc. · 371 Shaw Rd, South San Francisco, CA 94080 · License #477152 · Call 650-952-0233 · Text 650-808-5469</p>
      </div>
    </main>
  );
}

export default function EstimatePage() {
  const [location, navigate] = useLocation();
  const estimateId = location.match(/^\/estimate\/([^/]+)/)?.[1];
  const { toast } = useToast();
  const photosInput = useRef<HTMLInputElement>(null);
  const satelliteInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [satelliteImage, setSatelliteImage] = useState<File | null>(null);
  const [satelliteUrl, setSatelliteUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progressMessage, setProgressMessage] = useState("Analyzing your roof...");
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", city: "", state: "CA", propertyType: "commercial", buildingType: "", sqft: "" });
  const { data: savedEstimate, isLoading } = useQuery<Estimate>({
    queryKey: ["/api/estimate", estimateId || ""],
    queryFn: () => apiRequest("GET", `/api/estimate/${estimateId}`).then((res) => res.json()),
    enabled: Boolean(estimateId),
  });
  const previews = useMemo(() => photos.map((file) => ({ file, url: URL.createObjectURL(file) })), [photos]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);
  useEffect(() => {
    if (!submitting) return;
    const messages = ["Analyzing your roof...", "Detecting material type...", "Assessing coating suitability...", "Calculating your estimate..."];
    let index = 0;
    const timer = window.setInterval(() => { index = (index + 1) % messages.length; setProgressMessage(messages[index]); }, 2800);
    return () => window.clearInterval(timer);
  }, [submitting]);
  const addPhotos = (incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    if (files.some((file) => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
      toast({ title: "Use images up to 10MB", description: "Please select JPG, PNG, WebP, HEIC, or GIF roof photos.", variant: "destructive" });
      return;
    }
    setPhotos((current) => {
      const next = [...current, ...files].slice(0, 4);
      if (current.length + files.length > 4) toast({ title: "Up to four photos", description: "We kept the first four photos for the best analysis." });
      return next;
    });
  };
  const emailValid = /^\S+@\S+\.\S+$/.test(form.email);
  const canSubmit = photos.length > 0 && form.name.trim().length >= 2 && emailValid && form.city.trim().length >= 2;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => { if (value) body.append(key, value); });
    if (satelliteUrl) body.append("satelliteUrl", satelliteUrl);
    photos.forEach((photo) => body.append("photos", photo));
    if (satelliteImage) body.append("satelliteImage", satelliteImage);
    setSubmitting(true);
    try {
      const response = await apiRequest("POST", "/api/estimate", body);
      const estimate = await response.json() as Estimate;
      navigate(`/estimate/${estimate.id}`);
    } catch (error: any) {
      const detail = String(error.message || "");
      toast({ title: "We couldn’t generate an estimate", description: detail.includes("429") ? "Please try again in an hour." : "Please verify your photos and try again, or call (650) 952-0233.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };
  if (estimateId) {
    if (isLoading) return <main className="grid min-h-screen place-items-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>;
    return savedEstimate ? <EstimateResults estimate={savedEstimate} /> : <main className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="text-xl font-bold">Estimate not found</h1><Button onClick={() => navigate("/estimate")} className="mt-4" data-testid="button-return-to-estimate">Start a new estimate</Button></div></main>;
  }
  return (
    <main className="min-h-screen bg-slate-50" data-testid="page-instant-estimate">
      {submitting && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/90 px-6 text-center text-white" role="status" data-testid="overlay-estimate-analysis"><div className="max-w-sm"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10"><WandSparkles className="h-8 w-8 animate-pulse text-orange-300" /></div><h2 className="mt-6 text-xl font-bold">{progressMessage}</h2><p className="mt-2 text-sm text-slate-300">Our GPT-4o vision analyst is reviewing your roof photos. This usually takes 15–30 seconds.</p><div className="mt-6 h-1 overflow-hidden rounded-full bg-white/20"><div className="h-full w-2/3 animate-pulse rounded-full bg-accent" /></div></div></div>}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_hsl(28_85%_56%_/_0.24),_transparent_35%),radial-gradient(circle_at_15%_85%,_hsl(210_70%_55%_/_0.26),_transparent_35%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-7 sm:px-6 sm:pb-20">
          <div className="flex items-center justify-between"><span className="text-sm font-bold tracking-tight">McCurdy <span className="text-orange-300">Coatings</span></span><a href="tel:6509520233" className="text-sm font-semibold text-slate-200 hover:text-white" data-testid="link-estimate-phone">650-952-0233</a></div>
          <div className="mx-auto max-w-3xl pb-2 pt-16 text-center sm:pt-24"><span className="inline-flex items-center gap-2 rounded-full border border-orange-300/40 bg-orange-300/10 px-3 py-1.5 text-xs font-bold tracking-wider text-orange-100"><Sparkles className="h-3.5 w-3.5" /> AI-POWERED · FREE · 30 SECONDS</span><h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">Get an Instant Estimate for Your Commercial Roof Coating</h1><p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">Upload photos. Our AI analyzes your roof and returns a price range in under a minute. No sales calls. No commitment.</p></div>
          <div className="mt-12 grid gap-3 border-t border-white/10 pt-6 text-center text-xs font-semibold text-slate-300 sm:grid-cols-4 sm:text-sm"><span>License #477152</span><span>Family-Owned Since 1992</span><span>4.9★ on Google</span><span>Serving Bay Area since 1985</span></div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14"><div className="text-center"><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">No guessing required</p><h2 className="mt-2 text-2xl font-bold">How it works</h2></div><div className="mt-7 grid gap-4 md:grid-cols-3">{[[Camera,"Upload 1–4 roof photos","Use your phone camera or drag photos from your desktop."],[WandSparkles,"AI examines the roof","We assess visible condition, material, and coating suitability."],[MapPinned,"Receive your instant range","Then book a free, no-pressure on-site inspection."]].map(([Icon,title,copy], index) => { const StepIcon = Icon as typeof Camera; return <Card key={String(title)}><CardContent className="flex gap-4 p-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">{index + 1}</span><div><StepIcon className="h-5 w-5 text-accent" /><h3 className="mt-2 font-bold">{String(title)}</h3><p className="mt-1 text-sm text-muted-foreground">{String(copy)}</p></div></CardContent></Card>; })}</div></section>
      <section className="mx-auto max-w-3xl px-4 pb-12 sm:px-6 sm:pb-16"><Card className="border-primary/15 shadow-lg"><CardContent className="p-5 sm:p-8"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Building2 className="h-5 w-5" /></span><div><h2 className="text-xl font-bold">Tell us about your roof</h2><p className="mt-1 text-sm text-muted-foreground">We only need a few details to make your range useful.</p></div></div>
        <form onSubmit={submit} className="mt-7 space-y-6">
          <div><Label className="text-sm font-bold">Roof photos <span className="text-destructive">*</span></Label><p className="mt-1 text-xs text-muted-foreground">1–4 photos, up to 10MB each. Clear roof-surface and detail shots work best.</p><div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") photosInput.current?.click(); }} onClick={() => photosInput.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); addPhotos(e.dataTransfer.files); }} className={`mt-3 rounded-xl border-2 border-dashed p-7 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-slate-300 bg-slate-50 hover:border-primary/60"}`} data-testid="dropzone-estimate-photos"><Upload className="mx-auto h-7 w-7 text-primary" /><p className="mt-3 text-sm font-bold">Take photos or drop images here</p><p className="mt-1 text-xs text-muted-foreground">Mobile: your camera opens automatically</p><input ref={photosInput} className="hidden" type="file" accept="image/*" capture="environment" multiple onChange={(e) => addPhotos(e.target.files || [])} data-testid="input-estimate-photos" /></div>
          {previews.length > 0 && <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">{previews.map(({ file, url }, index) => <div className="relative overflow-hidden rounded-lg border" key={`${file.name}-${index}`}><img src={url} alt={`Roof preview ${index + 1}`} className="h-24 w-full object-cover" /><button type="button" onClick={() => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 rounded bg-slate-950/80 px-2 py-1 text-xs font-bold text-white" data-testid={`button-remove-estimate-photo-${index}`}>Remove</button></div>)}</div>}</div>
          <div className="rounded-lg border bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold">Add satellite context <span className="font-normal text-muted-foreground">(optional)</span></p><p className="text-xs text-muted-foreground">A Google Maps screenshot can help with roof area context.</p></div><Button type="button" variant="outline" size="sm" onClick={() => satelliteInput.current?.click()} data-testid="button-upload-satellite"><ImagePlus className="mr-1 h-4 w-4" /> {satelliteImage ? "Replace image" : "Upload image"}</Button><input ref={satelliteInput} type="file" accept="image/*" className="hidden" onChange={(e) => setSatelliteImage(e.target.files?.[0] || null)} data-testid="input-estimate-satellite" /></div>{satelliteImage && <p className="mt-2 text-xs font-medium text-primary">Satellite image: {satelliteImage.name}</p>}<Input value={satelliteUrl} onChange={(e) => setSatelliteUrl(e.target.value)} placeholder="Or paste a satellite image URL" className="mt-3 bg-white" data-testid="input-estimate-satellite-url" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="estimate-name">Name <span className="text-destructive">*</span></Label><Input id="estimate-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" className="mt-1.5" data-testid="input-estimate-name" /></div><div><Label htmlFor="estimate-email">Email <span className="text-destructive">*</span></Label><Input id="estimate-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" className="mt-1.5" aria-invalid={Boolean(form.email && !emailValid)} data-testid="input-estimate-email" />{form.email && !emailValid && <p className="mt-1 text-xs text-destructive">Enter a valid email to receive your estimate.</p>}</div><div><Label htmlFor="estimate-phone">Phone <span className="font-normal text-muted-foreground">(recommended)</span></Label><Input id="estimate-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="For text-back updates" autoComplete="tel" className="mt-1.5" data-testid="input-estimate-phone" /></div><div><Label htmlFor="estimate-address">Property address <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="estimate-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} autoComplete="street-address" className="mt-1.5" data-testid="input-estimate-address" /></div><div><Label htmlFor="estimate-city">City <span className="text-destructive">*</span></Label><Input id="estimate-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" className="mt-1.5" data-testid="input-estimate-city" /></div><div><Label htmlFor="estimate-state">State</Label><Input id="estimate-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} autoComplete="address-level1" className="mt-1.5" data-testid="input-estimate-state" /></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="estimate-property-type">Property type</Label><select id="estimate-property-type" value={form.propertyType} onChange={(e) => setForm({ ...form, propertyType: e.target.value, buildingType: e.target.value === "commercial" ? form.buildingType : "" })} className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" data-testid="select-estimate-property-type"><option value="commercial">Commercial</option><option value="industrial">Industrial</option><option value="multifamily">Multifamily</option><option value="residential">Residential</option></select></div>{form.propertyType === "commercial" && <div><Label htmlFor="estimate-building-type">Building type</Label><select id="estimate-building-type" value={form.buildingType} onChange={(e) => setForm({ ...form, buildingType: e.target.value })} className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" data-testid="select-estimate-building-type"><option value="">Select if known</option><option value="warehouse">Warehouse</option><option value="retail">Retail</option><option value="office">Office</option><option value="apartment">Apartment</option><option value="other">Other</option></select></div>}<div><Label htmlFor="estimate-sqft">Estimated roof sq ft <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="estimate-sqft" inputMode="numeric" type="number" min="100" value={form.sqft} onChange={(e) => setForm({ ...form, sqft: e.target.value })} placeholder="If known, this improves accuracy" className="mt-1.5" data-testid="input-estimate-sqft" /></div></div>
          <Button type="submit" disabled={!canSubmit || submitting} className="min-h-12 w-full gap-2 text-base font-bold" data-testid="button-get-instant-estimate"><Sparkles className="h-5 w-5" /> Get My Instant Estimate <ArrowRight className="h-4 w-4" /></Button>
          <p className="text-center text-xs leading-relaxed text-muted-foreground">By submitting you agree to be contacted by McCurdy about your estimate. We never share your information.</p>
        </form>
      </CardContent></Card></section>
      <section className="border-t bg-white"><div className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><div className="text-center"><ShieldCheck className="mx-auto h-7 w-7 text-primary" /><h2 className="mt-3 text-2xl font-bold">A few common questions</h2></div><Accordion type="single" collapsible className="mt-7"><AccordionItem value="accuracy"><AccordionTrigger data-testid="faq-estimate-accuracy">How accurate is the estimate?</AccordionTrigger><AccordionContent>AI provides a starting range. Your final price is confirmed after a free on-site inspection.</AccordionContent></AccordionItem><AccordionItem value="response"><AccordionTrigger data-testid="faq-estimate-response">How long until I hear back?</AccordionTrigger><AccordionContent>You’ll get an instant estimate on-screen, plus we call or text within 24 hours.</AccordionContent></AccordionItem><AccordionItem value="photos"><AccordionTrigger data-testid="faq-estimate-photos">What if I don’t have great photos?</AccordionTrigger><AccordionContent>Do your best — even a Google satellite screenshot helps. We can also come measure.</AccordionContent></AccordionItem><AccordionItem value="license"><AccordionTrigger data-testid="faq-estimate-license">Are you licensed?</AccordionTrigger><AccordionContent>Yes. McCurdy Coatings is License #477152 and family-owned since 1992.</AccordionContent></AccordionItem></Accordion></div></section>
    </main>
  );
}
