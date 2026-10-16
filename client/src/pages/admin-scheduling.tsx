import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, CloudRain, GripVertical, Ban, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Job = { id: number; customerName: string; propertyAddress: string; city?: string | null; status: string };
type Crew = { id: string; name: string; role: string };
type Slot = { id: string; crewMemberId: string; date: string; status: string; proposalId: number | null };
type Appt = { id: number; customerName: string; propertyAddress: string; appointmentDate?: number; workCompletedDate?: string };
type Schedule = { jobs: Job[]; crewMembers: Crew[]; crew: Slot[]; appointments: Appt[] };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function weekStart(offset: number) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7); return d; }
const RAIN_LIMIT = 40; // % chance — silicone coatings need dry conditions to cure

export default function AdminScheduling() {
  const { toast } = useToast();
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // tap-to-assign on phones
  const { data, isLoading } = useQuery<Schedule>({ queryKey: ["/api/admin/schedule"] });
  const { data: weather } = useQuery<any>({ queryKey: ["bay-weather"], queryFn: () => fetch("https://api.open-meteo.com/v1/forecast?latitude=37.65&longitude=-122.42&daily=precipitation_probability_max&forecast_days=16&timezone=America/Los_Angeles").then((r) => r.json()), staleTime: 60 * 60 * 1000 });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = weekStart(offset); d.setDate(d.getDate() + i); return d; }), [offset]);
  const rain = (date: string): number | null => { const i = weather?.daily?.time?.indexOf(date) ?? -1; return i >= 0 ? weather.daily.precipitation_probability_max[i] : null; };
  const jobs = data?.jobs ?? [], crew = data?.crewMembers ?? [], slots = data?.crew ?? [];
  const jobName = (id: number | null) => jobs.find((j) => j.id === id)?.customerName ?? data?.appointments.find((a) => a.id === id)?.customerName ?? `Job #${id}`;
  const slotFor = (crewId: string, date: string) => slots.find((s) => s.crewMemberId === crewId && s.date === date);
  const weekDates = days.map(iso);
  const crewDaysThisWeek = slots.filter((s) => s.status === "assigned" && weekDates.includes(s.date)).length;
  const capacity = crew.length * 5;

  const save = async (crewMemberId: string, date: string, status: "assigned" | "unavailable" | "available", proposalId?: number) => {
    const r = rain(date);
    if (status === "assigned" && r !== null && r > RAIN_LIMIT && !confirm(`${r}% chance of rain that day — coating may not cure properly. Assign anyway?`)) return;
    try { await apiRequest("POST", "/api/admin/crew-schedule", { crewMemberId, date, status, proposalId: proposalId ?? null }); queryClient.invalidateQueries({ queryKey: ["/api/admin/schedule"] }); setPicked(null); }
    catch (e: any) { toast({ title: "Couldn't update schedule", description: String(e.message).replace(/^\d+: /, ""), variant: "destructive" }); }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6" data-testid="page-admin-scheduling">
      <PageHeader title="Smart Scheduling" subtitle="Assign crews to jobs, check for rain, and see this week's capacity" icon={<CalendarDays className="h-5 w-5" />} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Crew-days booked this week</p><p className="text-xl font-bold tabular-nums" data-testid="text-capacity">{crewDaysThisWeek} / {capacity}</p><div className="mt-2 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${capacity ? Math.min(100, (crewDaysThisWeek / capacity) * 100) : 0}%` }} /></div></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Jobs ready to schedule</p><p className="text-xl font-bold tabular-nums">{jobs.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Rain-risk days this week</p><p className="text-xl font-bold tabular-nums">{weekDates.filter((d) => (rain(d) ?? 0) > RAIN_LIMIT).length}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-semibold">Jobs <span className="font-normal text-muted-foreground">— drag onto a crew/day, or tap a job then tap a day</span></p>
          {isLoading ? <div className="h-10 animate-pulse rounded bg-muted" /> : jobs.length === 0 ? <p className="text-sm text-muted-foreground">No active jobs. Signed or sent proposals appear here.</p> : (
            <div className="flex flex-wrap gap-2">
              {jobs.map((j) => (
                <button key={j.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", String(j.id))} onClick={() => setPicked(picked === j.id ? null : j.id)}
                  className={`flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-left text-sm ${picked === j.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`} data-testid={`chip-job-${j.id}`}>
                  <GripVertical className="h-4 w-4 opacity-60" /><span className="font-medium">{j.customerName}</span>{j.city && <span className="opacity-70">· {j.city}</span>}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b p-3">
            <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Previous week" onClick={() => setOffset(offset - 1)} data-testid="button-prev-week"><ChevronLeft className="h-4 w-4" /></Button>
            <p className="text-sm font-semibold">{days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
            <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Next week" onClick={() => setOffset(offset + 1)} data-testid="button-next-week"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead><tr><th className="w-40 p-2 text-left text-xs font-medium text-muted-foreground">Crew</th>{days.map((d) => { const r = rain(iso(d)); return (
                <th key={iso(d)} className="p-2 text-left align-top"><span className="block text-xs font-semibold">{d.toLocaleDateString(undefined, { weekday: "short", month: "numeric", day: "numeric" })}</span>
                  {r !== null && <span className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${r > RAIN_LIMIT ? "bg-red-100 font-semibold text-red-900 dark:bg-red-950 dark:text-red-200" : "text-muted-foreground"}`}><CloudRain className="h-3 w-3" />{r}%</span>}</th>); })}</tr></thead>
              <tbody>
                {crew.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2 align-top"><p className="font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{c.role}</p></td>
                    {days.map((d) => { const date = iso(d); const s = slotFor(c.id, date); return (
                      <td key={date} className="h-20 p-1 align-top" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const id = Number(e.dataTransfer.getData("text/plain")); if (id) save(c.id, date, "assigned", id); }}>
                        {s?.status === "assigned" ? (
                          <div className="flex h-full min-h-16 items-start justify-between gap-1 rounded-md bg-primary/10 p-2 text-xs" data-testid={`slot-${c.id}-${date}`}><span className="font-semibold text-foreground">{jobName(s.proposalId)}</span><button aria-label="Remove assignment" className="grid h-7 w-7 place-items-center rounded hover:bg-background" onClick={() => save(c.id, date, "available")}><X className="h-3.5 w-3.5" /></button></div>
                        ) : s?.status === "unavailable" ? (
                          <button className="flex h-full min-h-16 w-full items-center justify-center gap-1 rounded-md bg-muted text-xs text-muted-foreground" onClick={() => save(c.id, date, "available")} data-testid={`slot-${c.id}-${date}`}><Ban className="h-3.5 w-3.5" /> Off</button>
                        ) : (
                          <div className="flex h-full min-h-16 flex-col gap-1">
                            <button className={`flex-1 rounded-md border border-dashed text-xs ${picked ? "border-primary text-primary" : "text-muted-foreground"} hover:bg-muted`} onClick={() => picked && save(c.id, date, "assigned", picked)} data-testid={`slot-${c.id}-${date}`}>{picked ? "Assign here" : "Open"}</button>
                            <button className="text-[11px] text-muted-foreground underline-offset-2 hover:underline" onClick={() => save(c.id, date, "unavailable")}>Mark off</button>
                          </div>
                        )}
                      </td>); })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {crew.length === 0 && <p className="p-4 text-sm text-muted-foreground">Add crew members on the Crew page to start scheduling.</p>}
        </CardContent>
      </Card>

      <Card><CardContent className="p-5"><h2 className="mb-2 font-semibold">Upcoming customer appointments</h2>
        {data?.appointments?.length ? data.appointments.map((p) => <div key={p.id} className="border-t py-2 text-sm"><b>{p.customerName}</b> · {p.propertyAddress}<br /><span className="text-muted-foreground">{p.appointmentDate ? new Date(p.appointmentDate * 1000).toLocaleString() : `Target complete: ${p.workCompletedDate}`}</span></div>) : <p className="text-sm text-muted-foreground">No scheduled appointments.</p>}
        <p className="mt-3"><Badge variant="outline">Rain forecast from Open-Meteo, up to 16 days out</Badge></p>
      </CardContent></Card>
    </div>
  );
}
