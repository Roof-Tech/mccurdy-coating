import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { KeyRound, Lock, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";
import { ADMIN_AUTH_EVENT, authApi, type AdminUser } from "@/lib/admin-auth";

const AdminUserContext = createContext<AdminUser | null>(null);
export const useAdminUser = () => useContext(AdminUserContext);

export function AdminSignOut() {
  const user = useAdminUser();
  return (
    <div className="flex items-center gap-2">
      {user && <span className="hidden max-w-[12rem] truncate text-xs text-muted-foreground md:inline" data-testid="text-admin-user">{user.name} · {user.role}</span>}
      <Button variant="ghost" size="sm" className="min-h-11 gap-1.5" data-testid="button-admin-signout"
        onClick={async () => { await authApi.logout().catch(() => undefined); queryClient.clear(); window.dispatchEvent(new Event(ADMIN_AUTH_EVENT)); }}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}

type Stage = "loading" | "setup" | "login" | "enroll" | "verify" | "ready";

function Shell({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-4" data-testid="page-admin-login">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white p-6 text-slate-900 shadow-2xl sm:p-8 dark:bg-slate-900 dark:text-slate-100">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">{icon}</div>
        <h1 className="mt-4 text-center text-xl font-bold">{title}</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">{subtitle}</p>
        {children}
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Secured sign-in · License #477152</p>
      </div>
    </main>
  );
}
function Field({ id, label, ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="min-h-12 text-base" data-testid={`input-${id}`} {...rest} />
    </div>
  );
}
function ErrorText({ error }: { error: string }) {
  return error ? <p role="alert" className="rounded-md bg-red-50 p-2 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-200" data-testid="text-admin-login-error">{error}</p> : null;
}

export function AdminGate({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ setupKey: "", name: "", email: "", password: "", code: "" });
  const [qr, setQr] = useState<{ img: string; secret: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      if (me.authenticated) { setUser(me.user); setStage("ready"); return; }
      setUser(null);
      setStage(me.mfaStage ?? (me.needsSetup ? "setup" : "login"));
    } catch { setStage("login"); setError("Couldn't reach the server. Check your connection."); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const onRequired = () => { queryClient.clear(); refresh(); };
    window.addEventListener(ADMIN_AUTH_EVENT, onRequired);
    return () => window.removeEventListener(ADMIN_AUTH_EVENT, onRequired);
  }, [refresh]);
  useEffect(() => {
    if (stage !== "enroll") return;
    authApi.enroll().then(async ({ otpauthUrl, secret }) => setQr({ img: await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 }), secret }))
      .catch((e) => setError(e.message));
  }, [stage]);

  const run = (fn: () => Promise<void>) => async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await fn(); } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  if (stage === "ready" && user) return <AdminUserContext.Provider value={user}>{children}</AdminUserContext.Provider>;
  if (stage === "loading") return <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-300" data-testid="status-admin-loading">Checking sign-in…</div>;

  if (stage === "setup") return (
    <Shell icon={<KeyRound className="h-6 w-6" />} title="Set up the owner account" subtitle="One-time setup. Use the admin setup key McCurdy was given, then create your own sign-in.">
      <form onSubmit={run(async () => { await authApi.setup(form); setStage("enroll"); })} className="mt-6 space-y-4">
        <Field id="setup-key" label="Setup key" type="password" autoComplete="off" value={form.setupKey} onChange={set("setupKey")} required />
        <Field id="setup-name" label="Your name" autoComplete="name" value={form.name} onChange={set("name")} required />
        <Field id="setup-email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
        <Field id="setup-password" label="Choose a password (12+ characters)" type="password" autoComplete="new-password" minLength={12} value={form.password} onChange={set("password")} required />
        <ErrorText error={error} />
        <Button type="submit" disabled={busy} className="min-h-12 w-full text-base font-bold" data-testid="button-admin-setup">{busy ? "Creating…" : "Create owner account"}</Button>
      </form>
    </Shell>
  );

  if (stage === "login") return (
    <Shell icon={<Lock className="h-6 w-6" />} title="McCurdy Admin Portal" subtitle="Sign in to manage proposals, leads, and customers.">
      <form onSubmit={run(async () => { const r = await authApi.login({ email: form.email, password: form.password }); setForm((f) => ({ ...f, password: "" })); setStage(r.mfaStage); })} className="mt-6 space-y-4">
        <Field id="login-email" label="Email" type="email" autoComplete="username" autoFocus value={form.email} onChange={set("email")} required />
        <Field id="login-password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={set("password")} required />
        <ErrorText error={error} />
        <Button type="submit" disabled={busy} className="min-h-12 w-full text-base font-bold" data-testid="button-admin-login">{busy ? "Checking…" : "Continue"}</Button>
      </form>
    </Shell>
  );

  const verify = run(async () => { const r = await authApi.verify(form.code); setForm((f) => ({ ...f, code: "" })); queryClient.clear(); setUser(r.user); setStage("ready"); });
  const codeField = <Field id="mfa-code" label="6-digit code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} autoFocus value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, "").slice(0, 6) }))} required />;

  if (stage === "enroll") return (
    <Shell icon={<Smartphone className="h-6 w-6" />} title="Protect your account" subtitle="Scan this with Google Authenticator, Microsoft Authenticator, or your phone's password app, then enter the 6-digit code.">
      <div className="mt-5 flex flex-col items-center gap-2">
        {qr ? <img src={qr.img} alt="Authenticator setup QR code" className="h-44 w-44 rounded-lg border bg-white p-1" data-testid="img-mfa-qr" /> : <div className="h-44 w-44 animate-pulse rounded-lg bg-muted" />}
        {qr && <p className="break-all text-center text-xs text-muted-foreground">Can't scan? Enter this key: <span className="font-mono font-semibold text-foreground" data-testid="text-mfa-secret">{qr.secret}</span></p>}
      </div>
      <form onSubmit={verify} className="mt-4 space-y-4">{codeField}<ErrorText error={error} />
        <Button type="submit" disabled={busy || form.code.length !== 6} className="min-h-12 w-full text-base font-bold" data-testid="button-mfa-verify">{busy ? "Checking…" : "Turn on & sign in"}</Button>
      </form>
    </Shell>
  );

  return (
    <Shell icon={<Smartphone className="h-6 w-6" />} title="Enter your code" subtitle="Open your authenticator app and enter the 6-digit code for McCurdy Admin.">
      <form onSubmit={verify} className="mt-6 space-y-4">{codeField}<ErrorText error={error} />
        <Button type="submit" disabled={busy || form.code.length !== 6} className="min-h-12 w-full text-base font-bold" data-testid="button-mfa-verify">{busy ? "Checking…" : "Sign in"}</Button>
        <button type="button" className="min-h-11 w-full text-sm text-muted-foreground underline" onClick={() => { authApi.logout().finally(refresh); }} data-testid="button-mfa-back">Use a different account</button>
      </form>
    </Shell>
  );
}
