// Admin authentication helpers. Sessions live in an httpOnly cookie set by the
// server, so the browser never stores a password or shared key.
export const ADMIN_AUTH_EVENT = "mccurdy-admin-auth-required";

export type AdminUser = { id: number; email: string; name: string; role: "owner" | "admin" | "staff" | "viewer"; totpEnabled: boolean; mustChangePassword: boolean };
export type AuthState =
  | { authenticated: true; user: AdminUser }
  | { authenticated: false; needsSetup: boolean; mfaStage?: "verify" | "enroll"; email?: string };

let installed = false;
/** Any admin API call that comes back 401 sends the user back to the sign-in screen instead of showing empty data. */
export function installAdminFetch() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const res = await original(input, { credentials: "same-origin", ...init });
    if (res.status === 401 && url.includes("/api/admin")) window.dispatchEvent(new Event(ADMIN_AUTH_EVENT));
    return res;
  };
}

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
export const authApi = {
  me: async (): Promise<AuthState> => (await fetch("/api/auth/me")).json(),
  setup: (b: { setupKey: string; email: string; name: string; password: string }) => post("/api/auth/setup", b),
  login: (b: { email: string; password: string }) => post("/api/auth/login", b) as Promise<{ mfaStage: "verify" | "enroll" }>,
  enroll: () => post("/api/auth/mfa/enroll") as Promise<{ secret: string; otpauthUrl: string }>,
  verify: (code: string) => post("/api/auth/mfa/verify", { code }) as Promise<{ user: AdminUser }>,
  logout: () => post("/api/auth/logout"),
  changePassword: (b: { currentPassword: string; newPassword: string }) => post("/api/auth/change-password", b),
};
