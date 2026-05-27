import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getDashboard } from "@/lib/db/queries/dashboard";

export const GET = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const stats = await getDashboard(db, user.userId);
    return new Response(JSON.stringify(stats), {
      headers: { "content-type": "application/json" },
    });
  });
