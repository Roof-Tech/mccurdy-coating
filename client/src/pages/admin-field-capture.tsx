import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Mic, Square, ClipboardCheck, FileText, Share2, Loader2, ArrowLeft, Lock, Sparkles } from "lucide-react";

type CheckItem = { id: string; phase: string; item: string; reading_label: string | null; reading: string | null; note: string | null; completed: number };
type Note = { id: string; body: string; source: string; author: string | null; created_at: number };
type Report = { id: string; title: string; summary: string; highlights: string; shared: number; created_at: number };
type Tab = "photos" | "checklist" | "notes" | "reports";

const errMsg = (e: any) => String(e?.message || e).replace(/^\d+: /, "").replace(/^\{"error":"(.*)"\}$/, "$1");

/** Hold-to-talk recorder. Uses live dictation when the browser supports it, else records audio and transcribes on the server. */
function VoiceButton({ onText }: { onText: (t: string) => void }) {
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => (window as any).MediaRecorder?.isTypeSupported?.(t)) || "";
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        setState("transcribing");
        try {
          const fd = new FormData();
          fd.append("audio", blob, `note.${/mp4/.test(blob.type) ? "m4a" : "webm"}`);
          const res = await fetch("/api/admin/transcribe", { method: "POST", body: fd, credentials: "include" });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error);
          onText(j.text);
        } catch (e) { toast({ title: "Couldn't transcribe", description: errMsg(e), variant: "destructive" }); }
        setState("idle");
      };
      rec.current = r;
      r.start();
      setState("recording");
    } catch { toast({ title: "Microphone blocked", description: "Allow microphone access in your browser settings, then try again.", variant: "destructive" }); }
  };
  const stop = () => rec.current?.state === "recording" && rec.current.stop();
  if (typeof window !== "undefined" && !(navigator.mediaDevices && (window as any).MediaRecorder)) return null;
  return (
    <Button type="button" variant={state === "recording" ? "destructive" : "outline"} className="min-h-12 w-full gap-2 font-semibold" disabled={state === "transcribing"} onClick={state === "recording" ? stop : start} data-testid="button-voice-note">
      {state === "recording" ? <><Square className="h-4 w-4" /> Stop &amp; transcribe</> : state === "transcribing" ? <><Loader2 className="h-4 w-4 animate-spin" /> Transcribing…</> : <><Mic className="h-4 w-4" /> Record voice note</>}
    </Button>
  );
}

export default function FieldCapture() {
  const [, params] = useRoute("/admin/proposals/:id/field-capture");
  const id = params?.id;
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("photos");
  const { data: proposal } = useQuery<any>({ queryKey: [`/api/admin/proposals/${id}`], enabled: !!id });

  // Photos
  const [files, setFiles] = useState<FileList | null>(null);
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState("Before");
  const [ai, setAi] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const upload = async () => {
    if (!files || !id) return;
    const list = Array.from(files);
    const urls: string[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        setProgress(`Uploading ${i + 1} of ${list.length}…`);
        const form = new FormData();
        form.append("file", f);
        const r = await fetch("/api/admin/upload", { method: "POST", body: form, credentials: "include" });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Upload failed");
        urls.push(j.url);
        const phase = category === "Complete" ? "completed" : category.toLowerCase();
        await apiRequest("POST", `/api/admin/proposals/${id}/timeline`, { phase, caption: caption.trim() || null, photoUrl: j.url });
      }
      if (ai && urls.length) { setProgress("Running AI roof analysis…"); await apiRequest("POST", `/api/admin/proposals/${id}/analyze-roof`, { imageUrls: urls }).catch(() => undefined); }
      toast({ title: `${urls.length} photo${urls.length === 1 ? "" : "s"} added`, description: ["Before", "During", "After", "Complete"].includes(category) ? "Visible on the customer's project timeline." : "Saved internally (not shown to the customer)." });
      setFiles(null); setCaption("");
    } catch (e) { toast({ title: "Upload stopped", description: errMsg(e), variant: "destructive" }); }
    setProgress(null);
  };

  // Checklist
  const ckKey = [`/api/admin/proposals/${id}/jobsite-checklist`];
  const { data: checklist = [] } = useQuery<CheckItem[]>({ queryKey: ckKey, enabled: !!id && tab === "checklist" });
  const patchItem = async (item: CheckItem, body: Partial<{ completed: boolean; reading: string; note: string }>) => {
    queryClient.setQueryData<CheckItem[]>(ckKey, (old = []) => old.map((c) => (c.id === item.id ? { ...c, ...("completed" in body ? { completed: body.completed ? 1 : 0 } : {}), ...("reading" in body ? { reading: body.reading ?? null } : {}) } : c)));
    try { await apiRequest("PATCH", `/api/admin/jobsite-checklist/${item.id}`, body); } catch (e) { toast({ title: "Not saved", description: errMsg(e), variant: "destructive" }); queryClient.invalidateQueries({ queryKey: ckKey }); }
  };
  const phases = Array.from(new Set(checklist.map((c) => c.phase)));
  const doneCount = checklist.filter((c) => c.completed).length;

  // Notes
  const notesKey = [`/api/admin/proposals/${id}/field-notes`];
  const { data: notes = [] } = useQuery<Note[]>({ queryKey: notesKey, enabled: !!id && tab === "notes" });
  const [noteText, setNoteText] = useState("");
  const [noteSource, setNoteSource] = useState<"typed" | "voice">("typed");
  const saveNote = async () => {
    try { await apiRequest("POST", `/api/admin/proposals/${id}/field-notes`, { body: noteText, source: noteSource }); setNoteText(""); setNoteSource("typed"); queryClient.invalidateQueries({ queryKey: notesKey }); toast({ title: "Note saved (internal only)" }); }
    catch (e) { toast({ title: "Not saved", description: errMsg(e), variant: "destructive" }); }
  };

  // Reports
  const repKey = [`/api/admin/proposals/${id}/progress-reports`];
  const { data: reports = [] } = useQuery<Report[]>({ queryKey: repKey, enabled: !!id && tab === "reports" });
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState<{ id: string; title: string; summary: string; highlights: string } | null>(null);
  const generate = async () => {
    setGenerating(true);
    try { const r = await (await apiRequest("POST", `/api/admin/proposals/${id}/progress-reports`, {})).json(); queryClient.invalidateQueries({ queryKey: repKey }); setEditing({ id: r.id, title: r.title, summary: r.summary, highlights: JSON.parse(r.highlights || "[]").join("\n") }); }
    catch (e) { toast({ title: "Couldn't create report", description: errMsg(e), variant: "destructive" }); }
    setGenerating(false);
  };
  const saveReport = async (share: boolean, notify: boolean) => {
    if (!editing) return;
    try {
      const r = await (await apiRequest("PATCH", `/api/admin/progress-reports/${editing.id}`, { title: editing.title, summary: editing.summary, highlights: editing.highlights.split("\n").map((s) => s.trim()).filter(Boolean), shared: share, notify })).json();
      queryClient.invalidateQueries({ queryKey: repKey });
      setEditing(null);
      toast({ title: share ? "Shared with customer" : "Saved as draft", description: r.email ? (r.email.ok ? "Email sent to the customer." : `Email not sent: ${r.email.error}`) : undefined });
    } catch (e) { toast({ title: "Not saved", description: errMsg(e), variant: "destructive" }); }
  };
  useEffect(() => { if (tab !== "reports") setEditing(null); }, [tab]);

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "photos", label: "Photos", icon: Camera },
    { key: "checklist", label: "Checklist", icon: ClipboardCheck },
    { key: "notes", label: "Notes", icon: Mic },
    { key: "reports", label: "Updates", icon: FileText },
  ];

  return (
    <main className="mx-auto min-h-screen max-w-xl space-y-4 bg-background p-4 pb-24" data-testid="page-field-capture">
      <div className="flex items-center gap-2">
        <Link href={`/admin/proposals/${id}`}><Button variant="ghost" size="icon" aria-label="Back to proposal"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="min-w-0"><h1 className="text-xl font-bold leading-tight">Field Capture</h1><p className="truncate text-xs text-muted-foreground">{proposal?.propertyAddress || "Loading…"}</p></div>
      </div>
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold transition-colors ${tab === t.key ? "bg-background text-primary shadow-sm" : "text-muted-foreground"}`} data-testid={`tab-field-${t.key}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === "photos" && (
        <div className="space-y-3">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed p-6 text-center">
            <Camera className="mx-auto h-8 w-8 text-primary" />
            <span className="mt-2 block text-sm font-semibold">{files?.length ? `${files.length} photo${files.length === 1 ? "" : "s"} selected` : "Take or choose photos"}</span>
            <span className="block text-xs text-muted-foreground">Photos are resized automatically for fast loading.</span>
            <Input data-testid="input-field-capture" className="sr-only" type="file" accept="image/*" capture="environment" multiple onChange={(e) => setFiles(e.target.files)} />
          </label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="min-h-12" data-testid="select-field-category"><SelectValue /></SelectTrigger>
            <SelectContent>{["Before", "During", "After", "Complete", "Detail", "Issue"].map((x) => <SelectItem key={x} value={x}>{x}{["Detail", "Issue"].includes(x) ? " (internal)" : ""}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="min-h-12" data-testid="input-field-caption" placeholder="Caption the customer will see (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
          <label className="flex min-h-11 items-center gap-3 text-sm"><Checkbox checked={ai} onCheckedChange={(v) => setAi(!!v)} data-testid="checkbox-analyze-field-photos" /> Analyze with AI (admin review required)</label>
          <Button data-testid="button-upload-field-photos" className="min-h-12 w-full font-semibold" disabled={!files?.length || !!progress} onClick={upload}>{progress ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{progress}</> : "Upload photos"}</Button>
        </div>
      )}

      {tab === "checklist" && (
        <div className="space-y-4">
          <div className="space-y-1.5"><div className="flex justify-between text-sm"><span className="font-semibold">Jobsite progress</span><span>{doneCount} / {checklist.length}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${checklist.length ? (doneCount / checklist.length) * 100 : 0}%` }} /></div></div>
          {phases.map((ph) => (
            <Card key={ph}><CardContent className="space-y-1 p-3">
              <h2 className="px-1 text-sm font-bold">{ph}</h2>
              {checklist.filter((c) => c.phase === ph).map((c) => (
                <div key={c.id} className="rounded-lg px-1 py-1">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                    <Checkbox className="h-5 w-5" checked={!!c.completed} onCheckedChange={(v) => patchItem(c, { completed: !!v })} data-testid={`check-${c.id}`} />
                    <span className={c.completed ? "text-muted-foreground line-through" : ""}>{c.item}</span>
                  </label>
                  {c.reading_label && <Input className="ml-8 mt-1 min-h-11 w-[calc(100%-2rem)]" placeholder={c.reading_label} defaultValue={c.reading || ""} onBlur={(e) => e.target.value !== (c.reading || "") && patchItem(c, { reading: e.target.value })} data-testid={`reading-${c.id}`} />}
                </div>
              ))}
            </CardContent></Card>
          ))}
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Field notes are internal. Customers never see them. AI may summarize the facts into an update that you review before sharing.</div>
          <VoiceButton onText={(t) => { setNoteText((n) => (n ? `${n} ${t}` : t)); setNoteSource("voice"); }} />
          <Textarea className="min-h-28 text-base" data-testid="textarea-voice-note" placeholder="Speak or type a jobsite note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          <Button className="min-h-12 w-full font-semibold" disabled={!noteText.trim()} onClick={saveNote} data-testid="button-save-note">Save note</Button>
          <div className="space-y-2">{notes.map((n) => (
            <Card key={n.id}><CardContent className="space-y-1 p-3"><p className="whitespace-pre-wrap break-words text-sm">{n.body}</p><p className="text-xs text-muted-foreground">{n.source === "voice" ? "Voice" : "Typed"} · {n.author || "Team"} · {new Date(n.created_at * 1000).toLocaleString()}</p></CardContent></Card>
          ))}</div>
        </div>
      )}

      {tab === "reports" && (
        <div className="space-y-3">
          {!editing && <Button className="min-h-12 w-full gap-2 whitespace-normal text-center font-semibold" onClick={generate} disabled={generating} data-testid="button-generate-report">{generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Writing update…</> : <><Sparkles className="h-4 w-4" /> Create progress update</>}</Button>}
          {editing && (
            <Card><CardContent className="space-y-3 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Review before sharing</p>
              <Input className="min-h-11 font-semibold" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} data-testid="input-report-title" />
              <Textarea className="min-h-28" value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} data-testid="textarea-report-summary" />
              <Textarea className="min-h-24 text-sm" value={editing.highlights} onChange={(e) => setEditing({ ...editing, highlights: e.target.value })} placeholder="One highlight per line" data-testid="textarea-report-highlights" />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button className="min-h-12 gap-2" onClick={() => saveReport(true, true)} data-testid="button-share-report"><Share2 className="h-4 w-4" /> Share &amp; email customer</Button>
                <Button variant="outline" className="min-h-12" onClick={() => saveReport(false, false)}>Save draft</Button>
              </div>
            </CardContent></Card>
          )}
          {reports.map((r) => (
            <Card key={r.id}><CardContent className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2"><p className="min-w-0 break-words text-sm font-semibold">{r.title}</p>{r.shared ? <Badge>Shared</Badge> : <Badge variant="secondary">Draft</Badge>}</div>
              <p className="text-sm text-muted-foreground">{r.summary}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing({ id: r.id, title: r.title, summary: r.summary, highlights: JSON.parse(r.highlights || "[]").join("\n") })}>Edit</Button>
                {!!r.shared && <Button size="sm" variant="ghost" onClick={async () => { await apiRequest("PATCH", `/api/admin/progress-reports/${r.id}`, { shared: false }); queryClient.invalidateQueries({ queryKey: repKey }); }}>Unshare</Button>}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </main>
  );
}
