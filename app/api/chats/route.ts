import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { ChatCreateSchema, PaginationSchema } from "@shared/validation";
import { createChat, listChats } from "@/lib/db/queries/chats";
import { createAssessment } from "@/lib/db/queries/assessments";
import { generateAssessment } from "@/lib/ai";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const input = await readJson(req, ChatCreateSchema);

    let imageBase64: string | undefined;
    if (input.image_key) {
      if (!input.image_key.startsWith(`uploads/${user.userId}/`))
        throw new AppError("FORBIDDEN", "image not yours");
      const obj = await env.R2.get(input.image_key);
      if (!obj) throw new AppError("NOT_FOUND", "image missing");
      const buf = new Uint8Array(await obj.arrayBuffer());
      imageBase64 = btoa(String.fromCharCode(...buf));
    }

    const chat = await createChat(db, user.userId, input.topic);
    const questions = await generateAssessment(env, input.topic, imageBase64);
    await createAssessment(db, chat.id, questions);
    return new Response(JSON.stringify({ chat, questions }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  });

export const GET = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const url = new URL(req.url);
    const { cursor, limit } = PaginationSchema.parse({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const page = await listChats(db, user.userId, cursor, limit);
    return new Response(JSON.stringify(page), { headers: { "content-type": "application/json" } });
  });
