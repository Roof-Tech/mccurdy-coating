import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, UserPlus, KeyRound, History } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authApi } from "@/lib/admin-auth";
import { useAdminUser } from "@/components/admin-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type TeamRow = { id: number; email: string; name: string; role: string; totp_enabled: number; disabled: number; created_at: number; last_login_at: number | null };
type AuditRow = { id: number; actor: string; method: string; path: string; status: number; at: number };
const ROLE_HELP: Record<string, string> = { owner: "Everything, including team accounts", admin: "Everything except team accounts", staff: "View, create, and edit — no deleting", viewer: "View only" };
const fmt = (t: number | null) => (t ? new Date(t * 1000).toLocaleString() : "Never");

export default function AdminTeam() {
  const me = useAdminUser();
  const { toast } = useToast();
  const isOwner = me?.role === "owner";
  const { data: team = [], isLoading } = useQuery<TeamRow[]>({ queryKey: ["/api/admin/users"], enabled: isOwner });
  const { data: log = [] } = useQuery<AuditRow[]>({ queryKey: ["/api/admin/audit-log"], enabled: isOwner || me?.role === "admin" });
  const [invite, setInvite] = useState({ name: "", email: "", role: "staff" });
  const [temp, setTemp] = useState<{ email: string; pw: string } | null>(null);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });

  const update = async (id: number, body: Record<string, unknown>) => {
    try { await apiRequest("PATCH", `/api/admin/users/${id}`, body); queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); toast({ title: "Saved" }); }
    catch (e: any) { toast({ title: "Couldn't save", description: String(e.message).replace(/^\d+: /, ""), variant: "destructive" }); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6" data-testid="page-admin-team">
      <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-primary" /><div><h1 className="text-xl font-bold">Team & Security</h1><p className="text-sm text-muted-foreground">Named accounts, required authenticator codes, roles, and a record of every change.</p></div></div>

      {isOwner && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4" /> Add a team member</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto] md:items-end">
              <div className="space-y-1"><Label htmlFor="invite-name">Name</Label><Input id="invite-name" className="min-h-11" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} data-testid="input-invite-name" /></div>
              <div className="space-y-1"><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" className="min-h-11" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} data-testid="input-invite-email" /></div>
              <div className="space-y-1"><Label>Role</Label><Select value={invite.role} onValueChange={(role) => setInvite({ ...invite, role })}><SelectTrigger className="min-h-11" data-testid="select-invite-role"><SelectValue /></SelectTrigger><SelectContent>{Object.keys(ROLE_HELP).map((r) => <SelectItem key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</SelectItem>)}</SelectContent></Select></div>
              <Button className="min-h-11" data-testid="button-invite" onClick={async () => {
                try { const r = await apiRequest("POST", "/api/admin/users", invite).then((x) => x.json()); setTemp({ email: invite.email, pw: r.tempPassword }); setInvite({ name: "", email: "", role: "staff" }); queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] }); }
                catch (e: any) { toast({ title: "Couldn't add", description: String(e.message).replace(/^\d+: /, ""), variant: "destructive" }); }
              }}>Add</Button>
            </div>
            <p className="text-xs text-muted-foreground">{ROLE_HELP[invite.role]}</p>
            {temp && <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm" data-testid="text-temp-password">Give <b>{temp.email}</b> this one-time password: <span className="font-mono font-semibold">{temp.pw}</span>. They'll set up their authenticator on first sign-in. It won't be shown again.</div>}
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardHeader><CardTitle className="text-base">Team accounts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? <div className="h-16 animate-pulse rounded bg-muted" /> : team.map((u) => (
              <div key={u.id} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center" data-testid={`row-team-${u.id}`}>
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{u.name} {u.id === me?.id && <span className="text-xs font-normal text-muted-foreground">(you)</span>}</p><p className="truncate text-sm text-muted-foreground">{u.email} · Last sign-in {fmt(u.last_login_at)}</p></div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={u.totp_enabled ? "default" : "secondary"}>{u.totp_enabled ? "Authenticator on" : "Setup pending"}</Badge>
                  {u.disabled ? <Badge variant="destructive">Disabled</Badge> : null}
                  <Select value={u.role} onValueChange={(role) => update(u.id, { role })} disabled={u.id === me?.id}><SelectTrigger className="min-h-11 w-32" data-testid={`select-role-${u.id}`}><SelectValue /></SelectTrigger><SelectContent>{Object.keys(ROLE_HELP).map((r) => <SelectItem key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</SelectItem>)}</SelectContent></Select>
                  {u.id !== me?.id && <Button variant="outline" size="sm" className="min-h-11" onClick={() => update(u.id, { resetMfa: true })} data-testid={`button-reset-mfa-${u.id}`}>Reset authenticator</Button>}
                  {u.id !== me?.id && <Button variant={u.disabled ? "outline" : "destructive"} size="sm" className="min-h-11" onClick={() => update(u.id, { disabled: !u.disabled })} data-testid={`button-toggle-user-${u.id}`}>{u.disabled ? "Enable" : "Disable"}</Button>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Change my password</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={async (e) => { e.preventDefault(); try { await authApi.changePassword(pw); setPw({ currentPassword: "", newPassword: "" }); toast({ title: "Password updated" }); } catch (err: any) { toast({ title: "Couldn't update", description: err.message, variant: "destructive" }); } }}>
            <div className="space-y-1"><Label htmlFor="pw-current">Current password</Label><Input id="pw-current" type="password" autoComplete="current-password" className="min-h-11" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} data-testid="input-current-password" /></div>
            <div className="space-y-1"><Label htmlFor="pw-new">New password (12+ characters)</Label><Input id="pw-new" type="password" autoComplete="new-password" minLength={12} className="min-h-11" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} data-testid="input-new-password" /></div>
            <Button type="submit" className="min-h-11" data-testid="button-change-password">Update</Button>
          </form>
        </CardContent>
      </Card>

      {(isOwner || me?.role === "admin") && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" /> Recent admin actions</CardTitle></CardHeader>
          <CardContent>
            {log.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded yet.</p> : (
              <div className="max-h-96 divide-y overflow-y-auto text-sm">
                {log.map((l) => (
                  <div key={l.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3" data-testid={`row-audit-${l.id}`}>
                    <span className="w-40 shrink-0 text-muted-foreground">{fmt(l.at)}</span>
                    <span className="w-48 shrink-0 truncate font-medium">{l.actor}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{l.method} {l.path}</span>
                    <span className={l.status >= 400 ? "text-red-600" : "text-muted-foreground"}>{l.status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
