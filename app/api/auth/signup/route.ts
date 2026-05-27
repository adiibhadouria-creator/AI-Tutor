import { withRoute, readJson } from "@/lib/api";
import { SignupSchema } from "@shared/validation";
import { hashPassword } from "@/lib/auth/password";
import { issueSession, buildSessionCookie } from "@/lib/auth/session";
import { findUserByEmail, createUser } from "@/lib/db/queries/auth";
import { recordAudit } from "@/lib/db/queries/audit";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { ipHash, clientIp } from "@/lib/auth/iphash";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db, log }) => {
    const ip = clientIp(req);
    const { success } = await env.RATE_LIMITER_SIGNUP.limit({ key: ip });
    if (!success) throw new AppError("RATE_LIMITED", "too many signups, try again later");

    const input = await readJson(req, SignupSchema);
    const ok = await verifyTurnstile(input.turnstile_token, env.TURNSTILE_SECRET_KEY, ip);
    if (!ok) throw new AppError("FORBIDDEN", "turnstile failed");

    const existing = await findUserByEmail(db, input.email);
    if (existing) throw new AppError("CONFLICT", "email already registered");

    const hash = await hashPassword(input.password);
    const userId = await createUser(db, input.email, hash);
    const ih = await ipHash(ip, env.IP_HASH_SALT);
    const userAgent = req.headers.get("user-agent");
    const { token } = await issueSession(db, {
      userId,
      ...(userAgent ? { userAgent } : {}),
      ipHash: ih,
    });
    await recordAudit(db, { userId, event: "signup", ipHash: ih });
    log.info("signup_ok", { userId });

    return new Response(JSON.stringify({ user: { id: userId, email: input.email } }), {
      status: 201,
      headers: { "content-type": "application/json", "set-cookie": buildSessionCookie(token) },
    });
  });
