/**
 * Admin authentication: named accounts, scrypt passwords, mandatory TOTP MFA,
 * short-lived httpOnly session cookies, roles, and an admin action audit log.
 *
 * The legacy shared ADMIN_KEY is no longer accepted by the browser admin UI.
 * It is only (a) the one-time bootstrap secret for creating the first owner
 * account and (b) a machine credential for the scheduled incentive automation
 * endpoints listed in MACHINE_KEY_ROUTES.
 */
import type { Request, Response, NextFunction, Express } from "express";
import crypto from "crypto";
import { rateLimit } from "express-rate-limit";
import { sqliteConnection as sqlite } from "./db";

export type AdminRole = "owner" | "admin" | "staff" | "viewer";
const ROLES: AdminRole[] = ["owner", "admin", "staff", "viewer"];
const SESSION_COOKIE = "mcc_admin";
const SESSION_TTL_SEC = 12 * 60 * 60; // 12 hours, sliding
const SESSION_IDLE_SEC = 2 * 60 * 60; // 2 hours of inactivity
const PENDING_TTL_SEC = 10 * 60; // password ok, MFA not finished yet
const MACHINE_KEY_ROUTES = [
  /^\/api\/admin\/upsert-county$/,
  /^\/api\/admin\/refresh-incentives/,
  /^\/api\/admin\/refresh-log$/,
];

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    password_hash TEXT NOT NULL,
    totp_secret TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    disabled INTEGER NOT NULL DEFAULT 0,
    must_change_password INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_login_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    id_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    stage TEXT NOT NULL DEFAULT 'full',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,
    ip TEXT,
    user_agent TEXT
  );
  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    actor TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status INTEGER,
    ip TEXT,
    at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: AdminRole;
  totpEnabled: boolean;
  mustChangePassword: boolean;
}
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminUser?: AdminUser;
      adminActor?: string;
    }
  }
}

const now = () => Math.floor(Date.now() / 1000);
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

// ── Passwords (scrypt) ──
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}
function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < 12) return "Password must be at least 12 characters.";
  if (pw.length > 200) return "Password is too long.";
  return null;
}

// ── TOTP (RFC 6238, SHA-1, 6 digits, 30 s) ──
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of Array.from(buf)) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(s: string): Buffer {
  const clean = s.replace(/=+$/, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0; const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function totpAt(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, "0");
}
export function verifyTotp(secret: string, code: unknown): boolean {
  if (typeof code !== "string" || !/^\d{6}$/.test(code.replace(/\s/g, ""))) return false;
  const c = code.replace(/\s/g, "");
  const step = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) {
    const expected = totpAt(secret, step + d);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return true;
  }
  return false;
}
export const _totpForTests = (secret: string) => totpAt(secret, Math.floor(Date.now() / 30000));

// ── Cookies & sessions ──
function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}
function setSessionCookie(res: Response, token: string, maxAgeSec: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`);
}
function clearSessionCookie(res: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}
function createSession(req: Request, res: Response, userId: number, stage: "full" | "mfa") {
  const token = crypto.randomBytes(32).toString("base64url");
  const ttl = stage === "full" ? SESSION_TTL_SEC : PENDING_TTL_SEC;
  sqlite.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").run(now());
  sqlite.prepare("INSERT INTO admin_sessions (id_hash, user_id, stage, expires_at, ip, user_agent) VALUES (?,?,?,?,?,?)")
    .run(sha256(token), userId, stage, now() + ttl, req.ip || null, String(req.headers["user-agent"] || "").slice(0, 300));
  setSessionCookie(res, token, ttl);
}
type Row = { id: number; email: string; name: string; role: AdminRole; password_hash: string; totp_secret: string | null; totp_enabled: number; disabled: number; must_change_password: number };
const toUser = (r: Row): AdminUser => ({ id: r.id, email: r.email, name: r.name, role: r.role, totpEnabled: !!r.totp_enabled, mustChangePassword: !!r.must_change_password });

function loadSession(req: Request): { user: Row; stage: string; idHash: string } | null {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const idHash = sha256(token);
  const s = sqlite.prepare("SELECT * FROM admin_sessions WHERE id_hash = ?").get(idHash) as any;
  if (!s) return null;
  if (s.expires_at < now() || (s.stage === "full" && s.last_seen_at < now() - SESSION_IDLE_SEC)) {
    sqlite.prepare("DELETE FROM admin_sessions WHERE id_hash = ?").run(idHash);
    return null;
  }
  const user = sqlite.prepare("SELECT * FROM admin_users WHERE id = ?").get(s.user_id) as Row | undefined;
  if (!user || user.disabled) return null;
  return { user, stage: s.stage, idHash };
}
function keyMatches(provided: string | undefined): boolean {
  const key = process.env.ADMIN_KEY;
  if (!key || !provided) return false;
  const a = Buffer.from(sha256(provided)), b = Buffer.from(sha256(key));
  return crypto.timingSafeEqual(a, b);
}
function audit(req: Request, actor: string, userId: number | null, status: number) {
  try {
    sqlite.prepare("INSERT INTO admin_audit_log (user_id, actor, method, path, status, ip) VALUES (?,?,?,?,?,?)")
      .run(userId, actor, req.method, req.originalUrl.split("?")[0].slice(0, 300), status, req.ip || null);
  } catch { /* never block a request on audit logging */ }
}

/** Role checks: viewer = read only; staff = read + create/edit (no deletes); admin = everything except user management; owner = everything. */
function roleAllows(role: AdminRole, method: string, path: string): boolean {
  if (path.startsWith("/api/admin/users")) return role === "owner";
  if (role === "owner" || role === "admin") return true;
  if (method === "GET" || method === "HEAD") return true;
  if (role === "viewer") return false;
  return method !== "DELETE"; // staff
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const path = req.originalUrl.split("?")[0];
  const session = loadSession(req);
  if (session && session.stage === "full") {
    const user = toUser(session.user);
    if (!roleAllows(user.role, req.method, path)) {
      audit(req, user.email, user.id, 403);
      return res.status(403).json({ error: "Your role doesn't allow this action." });
    }
    sqlite.prepare("UPDATE admin_sessions SET last_seen_at = ?, expires_at = ? WHERE id_hash = ?")
      .run(now(), now() + SESSION_TTL_SEC, session.idHash);
    req.adminUser = user; req.adminActor = user.email;
    if (req.method !== "GET" && req.method !== "HEAD") res.on("finish", () => audit(req, user.email, user.id, res.statusCode));
    return next();
  }
  // Machine credential: only for the scheduled incentive automation endpoints.
  if (MACHINE_KEY_ROUTES.some((r) => r.test(path)) && keyMatches(req.header("X-Admin-Key"))) {
    req.adminActor = "automation";
    res.on("finish", () => audit(req, "automation", null, res.statusCode));
    return next();
  }
  return res.status(401).json({ error: "Sign in required", code: "AUTH_REQUIRED" });
}

export function registerAuthRoutes(app: Express) {
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Too many sign-in attempts. Wait 15 minutes and try again." } });
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/auth/mfa", loginLimiter);
  app.use("/api/auth/setup", loginLimiter);

  const countUsers = () => (sqlite.prepare("SELECT COUNT(*) AS n FROM admin_users").get() as { n: number }).n;

  app.get("/api/auth/me", (req, res) => {
    const s = loadSession(req);
    const needsSetup = countUsers() === 0;
    if (!s) return res.json({ authenticated: false, needsSetup });
    const user = toUser(s.user);
    if (s.stage !== "full") return res.json({ authenticated: false, needsSetup, mfaStage: user.totpEnabled ? "verify" : "enroll", email: user.email });
    res.json({ authenticated: true, user });
  });

  // First-time setup: the existing ADMIN_KEY proves ownership once, then is never used by the UI again.
  app.post("/api/auth/setup", (req, res) => {
    if (countUsers() > 0) return res.status(409).json({ error: "Setup is already complete. Sign in instead." });
    const { setupKey, email, name, password } = req.body || {};
    if (!keyMatches(setupKey)) return res.status(401).json({ error: "That setup key wasn't accepted." });
    if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Enter your name." });
    const problem = passwordProblem(password); if (problem) return res.status(400).json({ error: problem });
    const info = sqlite.prepare("INSERT INTO admin_users (email, name, role, password_hash) VALUES (?,?,?,?)").run(email.trim(), name.trim(), "owner", hashPassword(password));
    createSession(req, res, Number(info.lastInsertRowid), "mfa");
    res.status(201).json({ ok: true, mfaStage: "enroll" });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body || {};
    const row = typeof email === "string" ? (sqlite.prepare("SELECT * FROM admin_users WHERE email = ?").get(email.trim()) as Row | undefined) : undefined;
    const ok = !!row && !row.disabled && typeof password === "string" && verifyPassword(password, row.password_hash);
    if (!ok) { audit(req, String(email || "unknown").slice(0, 120), row?.id ?? null, 401); return res.status(401).json({ error: "Email or password is incorrect." }); }
    createSession(req, res, row!.id, "mfa");
    res.json({ ok: true, mfaStage: row!.totp_enabled ? "verify" : "enroll" });
  });

  // MFA enrollment: generates a secret (once per pending session) and returns the otpauth URI for a QR code.
  app.post("/api/auth/mfa/enroll", (req, res) => {
    const s = loadSession(req);
    if (!s || s.stage !== "mfa") return res.status(401).json({ error: "Sign in again to continue." });
    if (s.user.totp_enabled) return res.status(409).json({ error: "Authenticator already set up." });
    let secret = s.user.totp_secret;
    if (!secret) {
      secret = base32Encode(crypto.randomBytes(20));
      sqlite.prepare("UPDATE admin_users SET totp_secret = ? WHERE id = ?").run(secret, s.user.id);
    }
    const label = encodeURIComponent(`McCurdy Admin:${s.user.email}`);
    res.json({ secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("McCurdy Admin")}&algorithm=SHA1&digits=6&period=30` });
  });

  app.post("/api/auth/mfa/verify", (req, res) => {
    const s = loadSession(req);
    if (!s || s.stage !== "mfa") return res.status(401).json({ error: "Sign in again to continue." });
    if (!s.user.totp_secret || !verifyTotp(s.user.totp_secret, String(req.body?.code || ""))) {
      audit(req, s.user.email, s.user.id, 401);
      return res.status(401).json({ error: "That code didn't match. Check your authenticator app and try again." });
    }
    sqlite.prepare("DELETE FROM admin_sessions WHERE id_hash = ?").run(s.idHash);
    sqlite.prepare("UPDATE admin_users SET totp_enabled = 1, last_login_at = ? WHERE id = ?").run(now(), s.user.id);
    createSession(req, res, s.user.id, "full");
    audit(req, s.user.email, s.user.id, 200);
    res.json({ ok: true, user: toUser({ ...s.user, totp_enabled: 1 }) });
  });

  app.post("/api/auth/logout", (req, res) => {
    const s = loadSession(req);
    if (s) sqlite.prepare("DELETE FROM admin_sessions WHERE id_hash = ?").run(s.idHash);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.post("/api/auth/change-password", requireAdmin as any, (req, res) => {
    const row = sqlite.prepare("SELECT * FROM admin_users WHERE id = ?").get(req.adminUser!.id) as Row;
    const { currentPassword, newPassword } = req.body || {};
    if (!verifyPassword(String(currentPassword || ""), row.password_hash)) return res.status(401).json({ error: "Current password is incorrect." });
    const problem = passwordProblem(newPassword); if (problem) return res.status(400).json({ error: problem });
    sqlite.prepare("UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(hashPassword(newPassword), row.id);
    res.json({ ok: true });
  });

  // ── Owner-only user management ──
  app.get("/api/admin/users", requireAdmin as any, (_req, res) => {
    const rows = sqlite.prepare("SELECT id, email, name, role, totp_enabled, disabled, created_at, last_login_at FROM admin_users ORDER BY created_at").all();
    res.json(rows);
  });
  app.post("/api/admin/users", requireAdmin as any, (req, res) => {
    const { email, name, role } = req.body || {};
    if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Enter a name." });
    if (!ROLES.includes(role)) return res.status(400).json({ error: "Choose a role." });
    const tempPassword = crypto.randomBytes(9).toString("base64url") + "-Mc1";
    try {
      sqlite.prepare("INSERT INTO admin_users (email, name, role, password_hash, must_change_password) VALUES (?,?,?,?,1)").run(email.trim(), name.trim(), role, hashPassword(tempPassword));
    } catch { return res.status(409).json({ error: "That email already has an account." }); }
    res.status(201).json({ ok: true, tempPassword });
  });
  app.patch("/api/admin/users/:id", requireAdmin as any, (req, res) => {
    const id = Number(req.params.id);
    const target = sqlite.prepare("SELECT * FROM admin_users WHERE id = ?").get(id) as Row | undefined;
    if (!target) return res.status(404).json({ error: "User not found" });
    const { role, disabled, resetMfa } = req.body || {};
    if (id === req.adminUser!.id && (disabled || (role && role !== "owner"))) return res.status(400).json({ error: "You can't disable or demote your own account." });
    if (role !== undefined) { if (!ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" }); sqlite.prepare("UPDATE admin_users SET role = ? WHERE id = ?").run(role, id); }
    if (disabled !== undefined) { sqlite.prepare("UPDATE admin_users SET disabled = ? WHERE id = ?").run(disabled ? 1 : 0, id); if (disabled) sqlite.prepare("DELETE FROM admin_sessions WHERE user_id = ?").run(id); }
    if (resetMfa) { sqlite.prepare("UPDATE admin_users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?").run(id); sqlite.prepare("DELETE FROM admin_sessions WHERE user_id = ?").run(id); }
    res.json({ ok: true });
  });
  app.get("/api/admin/audit-log", requireAdmin as any, (_req, res) => {
    res.json(sqlite.prepare("SELECT id, actor, method, path, status, at FROM admin_audit_log ORDER BY id DESC LIMIT 200").all());
  });
}
