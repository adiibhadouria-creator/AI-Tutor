import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { listReportsForUser } from "@/lib/db/queries/reports";
import { PaginationSchema } from "@shared/validation";

export const GET = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const url = new URL(req.url);
    const { cursor, limit } = PaginationSchema.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const page = await listReportsForUser(db, user.userId, cursor, limit);
    return new Response(JSON.stringify(page), { headers: { "content-type": "application/json" } });
  });
