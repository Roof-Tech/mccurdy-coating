import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = { verified: boolean; hasEmail: boolean; emailMasked: string | null; required: boolean };

export function useCustomerVerification(token?: string) {
  return useQuery<Status>({ queryKey: ["verify-status", token], enabled: !!token, queryFn: () => fetch(`/api/proposals/${token}/verify/status`, { credentials: "include" }).then((r) => r.json()) });
}

/** Optional "verify it's you" step: emails a 6-digit code to the address on the proposal. */
export function CustomerVerify({ token, compact = false }: { token: string; compact?: boolean }) {
  const { data, refetch } = useCustomerVerification(token);
  const [stage, setStage] = useState<"idle" | "sent">("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data || !data.hasEmail) return null;
  if (data.verified) return <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100" data-testid="status-verified"><ShieldCheck className="h-4 w-4 shrink-0" /> Verified as {data.emailMasked}</div>;
  const call = async (path: string, body?: any) => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/proposals/${token}/verify/${path}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      return j;
    } catch (e: any) { setError(e.message); return null; } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3" data-testid="card-customer-verify">
      <div className="flex items-start gap-2"><MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><p className="text-sm font-semibold">{data.required ? "Verify your email to sign" : "Verify it's you (recommended)"}</p>{!compact && <p className="text-xs text-muted-foreground">We'll email a 6-digit code to {data.emailMasked}. Once verified, you can see all your McCurdy properties in one place.</p>}</div></div>
      {stage === "idle" ? (
        <Button type="button" variant="outline" className="min-h-11 w-full" disabled={busy} onClick={async () => { if (await call("start")) setStage("sent"); }} data-testid="button-send-code">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Email me a code"}</Button>
      ) : (
        <div className="flex gap-2">
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" className="min-h-11 text-center text-lg tracking-[0.3em]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} data-testid="input-verify-code" />
          <Button type="button" className="min-h-11 shrink-0" disabled={busy || code.length !== 6} onClick={async () => { if (await call("confirm", { code })) refetch(); }} data-testid="button-confirm-code">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}</Button>
        </div>
      )}
      {stage === "sent" && <button type="button" className="min-h-11 text-xs text-primary underline" onClick={() => { setStage("idle"); setCode(""); }}>Didn't get it? Send a new code</button>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
