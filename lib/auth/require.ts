import { eq } from "drizzle-orm";
import { schema, type DB } from "@/lib/db/client";
import {
  lookupSession,
  readSessionCookie,
  renewSession,
  buildSessionCookie,
} from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import type { AppEnv } from "@/lib/env";

export interface AuthCtx {
  userId: string;
  email: string;
  rotatedCookie?: string;
}

export async function requireUser(req: Request, _env: AppEnv, db: DB): Promise<AuthCtx> {
  const token = readSessionCookie(req);
  if (!token) throw new AppError("UNAUTHORIZED", "not signed in");
  const session = await lookupSession(db, token);
  if (!session) throw new AppError("UNAUTHORIZED", "session expired");
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) });
  if (!user || user.deletedAt !== null) throw new AppError("UNAUTHORIZED", "account unavailable");
  let rotatedCookie: string | undefined;
  if (session.shouldRenew) {
    await renewSession(db, token);
    rotatedCookie = buildSessionCookie(token);
  }
  const ctx: AuthCtx = { userId: user.id, email: user.email };
  if (rotatedCookie !== undefined) ctx.rotatedCookie = rotatedCookie;
  return ctx;
}

export async function requireOwner(ownerId: string, ctx: AuthCtx): Promise<void> {
  if (ownerId !== ctx.userId) throw new AppError("NOT_FOUND", "not found");
}
