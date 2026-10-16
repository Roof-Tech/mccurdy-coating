import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ruler, Sparkles, Loader2, FileUp, Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const PROVIDERS = ["EagleView", "Roofr", "Hover", "GAF QuickMeasure", "Nearmap", "Drone survey", "Tape / field measurement", "Blueprint", "Other"];
type Section = { name: string; sqft: string; pitch: string };
type Form = { provider: string; reportNumber: string; reportDate: string; totalSqft: string; predominantPitch: string; drains: string; penetrations: string; perimeterFt: string; fileUrl: string; sections: Section[]; extractedBy: "ai" | "manual" };
const empty: Form = { provider: "EagleView", reportNumber: "", reportDate: "", totalSqft: "", predominantPitch: "", drains: "", penetrations: "", perimeterFt: "", fileUrl: "", sections: [], extractedBy: "manual" };
const num = (s: string) => (s.trim() === "" ? null : Math.round(Number(s.replace(/,/g, ""))));

/** Import a measurement report (EagleView/Roofr/etc.): auto-read → confirm → saved with provenance; feeds Verified Sq Ft and pricing. */
export function MeasurementImport({ proposalId, onApplied }: { proposalId: number; onApplied: (p: any) => void }) {
  const { toast } = useToast();
  const [f, setF] = useState<Form>(empty);
  const [busy, setBusy] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);
  const key = [`/api/admin/proposals/${proposalId}/measurements`];
  const { data: history = [] } = useQuery<any[]>({ queryKey: key });
  const set = (k: keyof Form, v: any) => setF((p) => ({ ...p, [k]: v }));

  const uploadAndRead = async (file: File) => {
    setBusy("Uploading report…");
    try {
      const fd = new FormData(); fd.append("file", file);
      const up = await fetch("/api/admin/upload", { method: "POST", body: fd, credentials: "include" });
      const uj = await up.json(); if (!up.ok) throw new Error(uj.error || "Upload failed");
      set("fileUrl", uj.url);
      setBusy("Reading measurements…");
      const r = await (await apiRequest("POST", "/api/admin/measurements/extract", { fileUrl: uj.url })).json();
      const d = r.draft || {};
      setF((p) => ({ ...p, fileUrl: uj.url, extractedBy: "ai", provider: PROVIDERS.includes(d.provider) ? d.provider : p.provider, reportNumber: d.reportNumber || "", reportDate: d.reportDate || "", totalSqft: d.totalSqft ? String(d.totalSqft) : "", predominantPitch: d.predominantPitch || "", drains: d.drains != null ? String(d.drains) : "", penetrations: d.penetrations != null ? String(d.penetrations) : "", perimeterFt: d.perimeterFt != null ? String(d.perimeterFt) : "", sections: Array.isArray(d.sections) ? d.sections.map((s: any) => ({ name: String(s.name || "Section"), sqft: String(Math.round(Number(s.sqft) || 0)), pitch: String(s.pitch || "") })) : [] }));
      setConfidence(d.confidence || null);
      toast({ title: "Report read — please check every number", description: d.notes || undefined });
    } catch (e: any) { toast({ title: "Couldn't auto-read", description: String(e.message).replace(/^\d+: /, ""), variant: "destructive" }); }
    setBusy(null);
  };
  const apply = async () => {
    const total = num(f.totalSqft);
    if (!total || total <= 0) return toast({ title: "Enter the total roof area", variant: "destructive" });
    setBusy("Saving…");
    try {
      const body = { provider: f.provider, reportNumber: f.reportNumber || null, reportDate: f.reportDate || null, totalSqft: total, predominantPitch: f.predominantPitch || null, drains: num(f.drains), penetrations: num(f.penetrations), perimeterFt: num(f.perimeterFt), fileUrl: f.fileUrl || null, extractedBy: f.extractedBy, sections: f.sections.filter((s) => s.name.trim() && num(s.sqft)).map((s) => ({ name: s.name.trim(), sqft: num(s.sqft)!, pitch: s.pitch || undefined })) };
      const r = await (await apiRequest("POST", `/api/admin/proposals/${proposalId}/measurements`, body)).json();
      onApplied(r.proposal);
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/proposals/${proposalId}`] });
      toast({ title: `Measurement saved: ${total.toLocaleString()} sq ft`, description: "Verified Sq Ft and pricing now use this report." });
      setF(empty); setConfidence(null);
    } catch (e: any) { toast({ title: "Not saved", description: String(e.message).replace(/^\d+: /, ""), variant: "destructive" }); }
    setBusy(null);
  };
  const field = (k: keyof Form, label: string, props: any = {}) => (
    <div className="space-y-1.5"><Label className="text-sm">{label}</Label><Input className="min-h-11" value={f[k] as string} onChange={(e) => set(k, e.target.value)} data-testid={`input-measure-${k}`} {...props} /></div>
  );

  return (
    <div className="space-y-3 rounded-lg border border-primary/15 bg-background p-4 sm:col-span-2" data-testid="panel-measurement-import">
      <div className="flex flex-wrap items-center gap-2"><Ruler className="h-4 w-4 text-primary" /><p className="text-sm font-semibold">Import measurement report</p>{confidence && <Badge variant={confidence === "high" ? "default" : "secondary"}>AI confidence: {confidence}</Badge>}</div>
      <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed text-sm font-medium">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{busy}</> : <><FileUp className="h-4 w-4" /> Upload EagleView / Roofr PDF to auto-read <Sparkles className="h-3.5 w-3.5 text-primary" /></>}
        <input type="file" accept=".pdf,image/*" className="sr-only" disabled={!!busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadAndRead(file); e.currentTarget.value = ""; }} data-testid="input-measure-file" />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5"><Label className="text-sm">Source</Label><Select value={f.provider} onValueChange={(v) => set("provider", v)}><SelectTrigger className="min-h-11" data-testid="select-measure-provider"><SelectValue /></SelectTrigger><SelectContent>{PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
        {field("reportNumber", "Report #")}
        {field("reportDate", "Report date", { type: "date" })}
        {field("totalSqft", "Total roof area (sq ft) *", { inputMode: "numeric" })}
        {field("predominantPitch", "Predominant pitch", { placeholder: "1/12 or flat" })}
        {field("perimeterFt", "Perimeter (ft)", { inputMode: "numeric" })}
        {field("drains", "Drains / scuppers", { inputMode: "numeric" })}
        {field("penetrations", "Penetrations", { inputMode: "numeric" })}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><Label className="text-sm">Roof sections</Label><Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => set("sections", [...f.sections, { name: `Section ${f.sections.length + 1}`, sqft: "", pitch: "" }])}><Plus className="h-3.5 w-3.5" /> Add</Button></div>
        {f.sections.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_6.5rem_5rem_auto] gap-2">
            <Input className="min-h-11" value={s.name} onChange={(e) => set("sections", f.sections.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Section name" />
            <Input className="min-h-11" inputMode="numeric" placeholder="sq ft" value={s.sqft} onChange={(e) => set("sections", f.sections.map((x, j) => (j === i ? { ...x, sqft: e.target.value } : x)))} aria-label="Section square feet" />
            <Input className="min-h-11" placeholder="pitch" value={s.pitch} onChange={(e) => set("sections", f.sections.map((x, j) => (j === i ? { ...x, pitch: e.target.value } : x)))} aria-label="Section pitch" />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove section" onClick={() => set("sections", f.sections.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        {f.sections.length > 0 && (() => { const sum = f.sections.reduce((a, s) => a + (num(s.sqft) || 0), 0); const t = num(f.totalSqft) || 0; return t && Math.abs(sum - t) / t > 0.02 ? <p className="text-xs text-amber-700">Sections add up to {sum.toLocaleString()} sq ft, which is {Math.abs(sum - t).toLocaleString()} sq ft {sum > t ? "more" : "less"} than the total.</p> : null; })()}
      </div>
      <Button type="button" className="min-h-11 w-full" disabled={!!busy || !f.totalSqft} onClick={apply} data-testid="button-apply-measurement">Use these measurements for pricing</Button>
      {history.length > 0 && (
        <div className="space-y-1 border-t pt-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Measurement history</p>
          {history.map((h) => <p key={h.id} className="text-xs text-muted-foreground">{new Date(h.created_at * 1000).toLocaleDateString()} · {h.provider}{h.report_number ? ` #${h.report_number}` : ""} · {Number(h.total_sqft).toLocaleString()} sq ft{h.extracted_by === "ai" ? " · auto-read" : ""}{h.entered_by ? ` · ${h.entered_by}` : ""}{h.file_url ? <> · <a className="text-primary underline" href={h.file_url} target="_blank" rel="noreferrer">report</a></> : null}</p>)}
        </div>
      )}
    </div>
  );
}
