import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getUpload } from "@/lib/r2";

export const GET = (req: Request, ctx: { env: unknown; params: { key: string[] } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const key = ctx.params.key.join("/");
    const obj = await getUpload(env, user.userId, key);
    const headers = new Headers();
    if (obj.httpMetadata?.contentType) headers.set("content-type", obj.httpMetadata.contentType);
    headers.set("cache-control", "private, max-age=31536000, immutable");
    return new Response(obj.body, { headers });
  });
