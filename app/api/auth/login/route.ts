import { withRoute, readJson } from "@/lib/api";
import { LoginSchema } from "@shared/validation";
import { verifyPassword } from "@/lib/auth/password";
import { issueSession, buildSessionCookie } from "@/lib/auth/session";
import { findUserByEmail, touchLastLogin } from "@/lib/db/queries/auth";
import { recordAudit } from "@/lib/db/queries/audit";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { ipHash, clientIp } from "@/lib/auth/iphash";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db, log }) => {
    const ip = clientIp(req);
    const ipKey = await ipHash(ip, env.IP_HASH_SALT);

    const { success: ipOk } = await env.RATE_LIMITER_AUTH.limit({ key: ipKey });
    if (!ipOk) throw new AppError("RATE_LIMITED", "too many attempts");

    const input = await readJson(req, LoginSchema);
    const ok = await verifyTurnstile(input.turnstile_token, env.TURNSTILE_SECRET_KEY, ip);
    if (!ok) throw new AppError("FORBIDDEN", "turnstile failed");

    const { success: emailOk } = await env.RATE_LIMITER_AUTH.limit({ key: `email:${input.email}` });
    if (!emailOk) throw new AppError("RATE_LIMITED", "too many attempts");

    const user = await findUserByEmail(db, input.email);
    if (!user || user.deletedAt !== null) {
      await recordAudit(db, {
        userId: null,
        event: "login_failed",
        meta: { reason: "no_user" },
        ipHash: ipKey,
      });
      throw new AppError("UNAUTHORIZED", "invalid credentials");
    }
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      await recordAudit(db, {
        userId: user.id,
        event: "login_failed",
        meta: { reason: "bad_password" },
        ipHash: ipKey,
      });
      throw new AppError("UNAUTHORIZED", "invalid credentials");
    }

    await touchLastLogin(db, user.id);
    const userAgent = req.headers.get("user-agent");
    const { token } = await issueSession(db, {
      userId: user.id,
      ...(userAgent ? { userAgent } : {}),
      ipHash: ipKey,
    });
    await recordAudit(db, { userId: user.id, event: "login", ipHash: ipKey });
    log.info("login_ok", { userId: user.id });

    return new Response(JSON.stringify({ user: { id: user.id, email: user.email } }), {
      headers: { "content-type": "application/json", "set-cookie": buildSessionCookie(token) },
    });
  });
