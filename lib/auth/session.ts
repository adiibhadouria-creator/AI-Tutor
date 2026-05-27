import { eq, lt } from "drizzle-orm";
import { schema, type DB } from "@/lib/db/client";

const COOKIE_NAME = "__Host-session";
const SESSION_TTL_SEC = 30 * 24 * 60 * 60;
const RENEW_THRESHOLD_SEC = 7 * 24 * 60 * 60;

export const SESSION_COOKIE = COOKIE_NAME;

export function newSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface IssueOpts {
  userId: string;
  userAgent?: string;
  ipHash?: string;
}

export async function issueSession(
  db: DB,
  opts: IssueOpts,
): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SEC;
  const token = newSessionToken();
  await db.insert(schema.authSessions).values({
    id: token,
    userId: opts.userId,
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
    userAgent: opts.userAgent ?? null,
    ipHash: opts.ipHash ?? null,
  } as typeof schema.authSessions.$inferInsert);
  return { token, expiresAt };
}

export interface SessionLookup {
  userId: string;
  expiresAt: number;
  shouldRenew: boolean;
}

export async function lookupSession(db: DB, token: string): Promise<SessionLookup | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await db.query.authSessions.findFirst({
    where: eq(schema.authSessions.id, token),
  });
  if (!row) return null;
  const now = Math.floor(Date.now() / 1000);
  if (row.expiresAt <= now) return null;
  await db
    .update(schema.authSessions)
    .set({ lastSeenAt: now })
    .where(eq(schema.authSessions.id, token));
  const shouldRenew = row.expiresAt - now < RENEW_THRESHOLD_SEC;
  return { userId: row.userId, expiresAt: row.expiresAt, shouldRenew };
}

export async function renewSession(db: DB, token: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const newExpires = now + SESSION_TTL_SEC;
  await db
    .update(schema.authSessions)
    .set({ expiresAt: newExpires })
    .where(eq(schema.authSessions.id, token));
  return newExpires;
}

export async function revokeSession(db: DB, token: string): Promise<void> {
  await db.delete(schema.authSessions).where(eq(schema.authSessions.id, token));
}

export async function revokeAllSessions(db: DB, userId: string): Promise<void> {
  await db.delete(schema.authSessions).where(eq(schema.authSessions.userId, userId));
}

export async function purgeExpired(db: DB): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.delete(schema.authSessions).where(lt(schema.authSessions.expiresAt, now));
}

export function buildSessionCookie(token: string, maxAgeSec = SESSION_TTL_SEC): string {
  return `${COOKIE_NAME}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSessionCookie(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE_NAME) return rest.join("=");
  }
  return null;
}
