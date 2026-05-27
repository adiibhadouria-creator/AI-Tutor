import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getReport } from "@/lib/db/queries/reports";
import { AppError } from "@/lib/errors";

export const GET = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const r = await getReport(db, user.userId, ctx.params.id);
    if (!r) throw new AppError("NOT_FOUND", "report not found");
    return new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } });
  });
