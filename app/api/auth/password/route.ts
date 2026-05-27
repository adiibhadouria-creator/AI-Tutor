import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { PasswordChangeSchema } from "@shared/validation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { findUserById, updatePasswordHash } from "@/lib/db/queries/auth";
import {
  revokeAllSessions,
  issueSession,
  buildSessionCookie,
} from "@/lib/auth/session";
import { recordAudit } from "@/lib/db/queries/audit";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const input = await readJson(req, PasswordChangeSchema);
    const row = await findUserById(db, user.userId);
    if (!row) throw new AppError("UNAUTHORIZED", "user gone");
    const ok = await verifyPassword(input.current_password, row.passwordHash);
    if (!ok) throw new AppError("UNAUTHORIZED", "current password wrong");
    const fresh = await hashPassword(input.new_password);
    await updatePasswordHash(db, user.userId, fresh);
    await revokeAllSessions(db, user.userId);
    const { token } = await issueSession(db, { userId: user.userId });
    await recordAudit(db, { userId: user.userId, event: "password_change" });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", "set-cookie": buildSessionCookie(token) },
    });
  });
