import { withRoute } from "@/lib/api";
import { readSessionCookie, revokeSession, buildClearCookie } from "@/lib/auth/session";
import { recordAudit } from "@/lib/db/queries/audit";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, db }) => {
    const token = readSessionCookie(req);
    if (token) {
      await revokeSession(db, token);
      await recordAudit(db, { userId: null, event: "logout" });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", "set-cookie": buildClearCookie() },
    });
  });
