import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { McCurdyLogo } from "./mccurdy-logo";
import { Lock, Eye, EyeOff } from "lucide-react";

const STORAGE_KEY = "mccurdy_admin_auth";
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "mccurdy2024";

function isAuthed(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(isAuthed);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {}
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setPassword("");
    }
  };

  if (authed) return <>{children}</>;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-4 text-center space-y-3">
          <div className="flex justify-center">
            <McCurdyLogo className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-lg font-semibold">Admin Portal</CardTitle>
          <p className="text-sm text-muted-foreground">McCurdy Roofing — Proposal Manager</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Password
              </Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="Enter admin password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(false); }}
                  autoFocus
                  className={error ? "border-destructive focus-visible:ring-destructive" : ""}
                  data-testid="input-admin-password"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {error && (
                <p className="text-xs text-destructive">Incorrect password. Please try again.</p>
              )}
            </div>
            <Button type="submit" className="w-full" data-testid="button-admin-login">
              Sign In
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground text-center mt-4">
            McCurdy Roofing Inc. &middot; License #477152
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
