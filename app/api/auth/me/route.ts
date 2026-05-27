import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { ProfileUpdateSchema } from "@shared/validation";
import { softDeleteUser } from "@/lib/db/queries/auth";
import { revokeAllSessions, buildClearCookie } from "@/lib/auth/session";
import { recordAudit } from "@/lib/db/queries/audit";

export const GET = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (user.rotatedCookie) headers["set-cookie"] = user.rotatedCookie;
    return new Response(JSON.stringify({ id: user.userId, email: user.email }), { headers });
  });

export const PATCH = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const input = await readJson(req, ProfileUpdateSchema);
    if (input.display_name !== undefined) {
      await db
        .update(schema.users)
        .set({ displayName: input.display_name })
        .where(eq(schema.users.id, user.userId));
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  });

export const DELETE = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    await softDeleteUser(db, user.userId);
    await revokeAllSessions(db, user.userId);
    await recordAudit(db, { userId: user.userId, event: "account_delete" });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", "set-cookie": buildClearCookie() },
    });
  });
