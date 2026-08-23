import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ClipboardCopy, ExternalLink, FilePlus2, Image, Search, Sparkles, UserRound } from "lucide-react";

type Lead = {
  id: string; name: string; email: string; phone?: string | null; address?: string | null; city?: string | null; state?: string | null;
  propertyType?: string | null; buildingType?: string | null; estimatedSqft?: number | null; verifiedSqft?: number | null;
  aiCondition?: string | null; aiMaterialType?: string | null; aiIssues?: string | null; aiUpgrades?: string | null; aiConfidence?: string | null;
  aiRawResponse?: string | null; photoUrls?: string | null; recommendedTier?: number | null; priceRecommended?: number | null; priceLow?: number | null; priceHigh?: number | null;
  status?: string | null; notes?: string | null; createdAt: string | Date; contactedAt?: string | Date | null; convertedProposalId?: string | null;
};
type LeadResponse = { items: Lead[]; total: number; newCount: number };
const statuses = ["new", "contacted", "qualified", "converted", "not_interested"];
const money = (value?: number | null) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
const parse = (text?: string | null) => { try { const item = JSON.parse(text || "[]"); return Array.isArray(item) ? item : []; } catch { return []; } };

export default function AdminEstimateLeads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const { data, isLoading, isError } = useQuery<LeadResponse>({
    queryKey: ["/api/admin/estimate-leads", status, search],
    queryFn: () => apiRequest("GET", `/api/admin/estimate-leads?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}&pageSize=100`).then((res) => res.json()),
  });
  const leads = data?.items || [];
  const selectedPhotos = useMemo(() => parse(selected?.photoUrls), [selected]);
  const updateLead = async (values: Record<string, unknown>) => {
    if (!selected) return;
    try {
      const response = await apiRequest("PATCH", `/api/admin/estimate-leads/${selected.id}`, values);
      const updated = await response.json();
      setSelected(updated);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/estimate-leads"] });
      toast({ title: "Lead updated" });
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  };
  const convert = async () => {
    if (!selected) return;
    try {
      const result = await apiRequest("POST", `/api/admin/estimate-leads/${selected.id}/convert`).then((res) => res.json());
      toast({ title: "Draft proposal created", description: "The lead was converted and the proposal is ready to edit." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/estimate-leads"] });
      window.location.hash = `#/admin/proposals/${result.proposalId}`;
    } catch (error: any) {
      toast({ title: "Conversion failed", description: error.message, variant: "destructive" });
    }
  };
  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" data-testid="page-admin-estimate-leads">
    <div className="flex flex-wrap items-center justify-between gap-3"><PageHeader title="Instant Estimates" subtitle={`${data?.newCount || 0} new AI-assisted roof estimate leads`} icon={<Sparkles className="h-5 w-5" />} /><Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">{data?.newCount || 0} new</Badge></div>
    <Card><CardContent className="p-4"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className="pl-9" data-testid="input-estimate-lead-search" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" data-testid="select-estimate-lead-status"><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select></div></CardContent></Card>
    <Card><CardContent className="p-0">{isLoading ? <div className="p-8 text-center text-sm text-muted-foreground">Loading instant estimate leads…</div> : isError ? <div className="p-8 text-center text-sm text-destructive">Unable to load leads. Verify the current admin session.</div> : leads.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No leads match these filters.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="p-3">Date</th><th className="p-3">Name</th><th className="p-3">Email / Phone</th><th className="p-3">City</th><th className="p-3">Property</th><th className="p-3">Sq ft</th><th className="p-3">Condition</th><th className="p-3">Recommended</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => { setSelected(lead); setNotes(lead.notes || ""); }} data-testid={`row-estimate-lead-${lead.id}`}><td className="p-3 text-xs text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</td><td className="p-3 font-semibold">{lead.name}</td><td className="p-3"><p>{lead.email}</p>{lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}</td><td className="p-3">{lead.city || "—"}</td><td className="p-3 capitalize">{lead.propertyType || "commercial"}</td><td className="p-3">{(lead.verifiedSqft || lead.estimatedSqft || 0).toLocaleString()}</td><td className="p-3"><Badge variant="outline">{lead.aiCondition || "—"}</Badge></td><td className="p-3 font-semibold">{money(lead.priceRecommended)}</td><td className="p-3"><Badge className="capitalize" variant={lead.status === "new" ? "default" : "secondary"}>{(lead.status || "new").replace("_", " ")}</Badge></td><td className="p-3"><Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setSelected(lead); setNotes(lead.notes || ""); }} data-testid={`button-open-estimate-lead-${lead.id}`}>Open</Button></td></tr>)}</tbody></table></div>}</CardContent></Card>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /> {selected?.name}</DialogTitle><DialogDescription>{selected?.email} {selected?.phone ? ` · ${selected.phone}` : ""} · {[selected?.address, selected?.city, selected?.state].filter(Boolean).join(", ")}</DialogDescription></DialogHeader>{selected && <div className="space-y-5 text-sm"><div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-4"><div><p className="text-xs text-muted-foreground">Roof area</p><p className="font-bold">{(selected.verifiedSqft || selected.estimatedSqft || 0).toLocaleString()} sq ft</p></div><div><p className="text-xs text-muted-foreground">Condition</p><p className="font-bold">{selected.aiCondition || "—"}</p></div><div><p className="text-xs text-muted-foreground">Material</p><p className="font-bold">{selected.aiMaterialType || "—"}</p></div><div><p className="text-xs text-muted-foreground">Recommended</p><p className="font-bold">{selected.recommendedTier}-yr · {money(selected.priceRecommended)}</p></div></div>
      {selectedPhotos.length > 0 && <div><h3 className="mb-2 flex items-center gap-2 font-bold"><Image className="h-4 w-4" /> Submitted photos</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{selectedPhotos.map((url: string, index: number) => <button onClick={() => setImage(url)} className="overflow-hidden rounded-lg border focus:outline-none focus:ring-2 focus:ring-ring" key={url} data-testid={`button-lead-photo-${index}`}><img src={url} alt={`Lead roof ${index + 1}`} className="h-24 w-full object-cover" /></button>)}</div></div>}
      <div className="grid gap-4 sm:grid-cols-2"><div><h3 className="font-bold">Issues detected</h3><ul className="mt-2 space-y-1 text-muted-foreground">{parse(selected.aiIssues).map((item: string, index: number) => <li key={index}>• {item}</li>)}</ul></div><div><h3 className="font-bold">Recommended upgrades</h3><ul className="mt-2 space-y-1 text-muted-foreground">{parse(selected.aiUpgrades).map((item: string, index: number) => <li key={index}>• {item}</li>)}</ul></div></div>
      <div><Label htmlFor="lead-status">Status</Label><select id="lead-status" value={selected.status || "new"} onChange={(event) => updateLead({ status: event.target.value, contactedAt: event.target.value === "contacted" ? new Date().toISOString() : undefined })} className="mt-1.5 h-10 w-full rounded-md border bg-background px-3 text-sm" data-testid="select-lead-detail-status">{statuses.map((item) => <option value={item} key={item}>{item.replace("_", " ")}</option>)}</select></div>
      <div><Label htmlFor="lead-notes">Internal notes</Label><Textarea id="lead-notes" value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1.5 min-h-24" data-testid="textarea-lead-notes" /><Button size="sm" variant="outline" className="mt-2" onClick={() => updateLead({ notes })} data-testid="button-save-lead-notes">Save note</Button></div>
      <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">AI analysis JSON</p><pre className="max-h-52 overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100" data-testid="text-lead-ai-json">{JSON.stringify(JSON.parse(selected.aiRawResponse || "{}"), null, 2)}</pre></div>
    </div>}<DialogFooter className="flex-col gap-2 sm:flex-row"><Button variant="outline" onClick={() => selected && updateLead({ status: "contacted", contactedAt: new Date().toISOString() })} data-testid="button-mark-lead-contacted"><CheckCircle2 className="mr-2 h-4 w-4" /> Mark Contacted</Button><Button onClick={convert} disabled={Boolean(selected?.convertedProposalId)} data-testid="button-convert-estimate-lead"><FilePlus2 className="mr-2 h-4 w-4" /> {selected?.convertedProposalId ? "Already Converted" : "Convert to Proposal"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(image)} onOpenChange={(open) => !open && setImage(null)}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Submitted roof photo</DialogTitle></DialogHeader>{image && <img src={image} alt="Expanded submitted roof" className="max-h-[75vh] w-full rounded-lg object-contain" />}<DialogFooter><a href={image || "#"} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-medium" data-testid="link-open-lead-photo"><ExternalLink className="h-4 w-4" /> Open full size</a></DialogFooter></DialogContent></Dialog>
  </div>;
}
