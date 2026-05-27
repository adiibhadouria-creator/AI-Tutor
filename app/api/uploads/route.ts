import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { putUpload } from "@/lib/r2";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-validate";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const { success } = await env.RATE_LIMITER_UPLOAD.limit({ key: `u:${user.userId}` });
    if (!success) throw new AppError("RATE_LIMITED", "upload rate limit");

    const len = Number(req.headers.get("content-length") ?? 0);
    if (!len || len > MAX_UPLOAD_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "max 10MB");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "file field required");
    if (file.size > MAX_UPLOAD_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "max 10MB");
    const buf = await file.arrayBuffer();
    const result = await putUpload(env, user.userId, buf);
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  });
