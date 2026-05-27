import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getChat, patchChat, softDeleteChat } from "@/lib/db/queries/chats";
import { listMessages } from "@/lib/db/queries/messages";
import { getAssessment } from "@/lib/db/queries/assessments";
import { listReportsForChat } from "@/lib/db/queries/reports";
import { ChatPatchSchema } from "@shared/validation";
import { AppError } from "@/lib/errors";

export const GET = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const chat = await getChat(db, user.userId, ctx.params.id);
    if (!chat) throw new AppError("NOT_FOUND", "chat not found");
    const [messages, assessment, reports] = await Promise.all([
      listMessages(db, env.CONTENT_KEY, chat.id),
      getAssessment(db, chat.id),
      listReportsForChat(db, chat.id),
    ]);
    return new Response(JSON.stringify({ chat, messages, assessment, reports }), {
      headers: { "content-type": "application/json" },
    });
  });

export const PATCH = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const input = await readJson(req, ChatPatchSchema);
    const patch: Partial<{ title: string; status: "active" | "completed" | "abandoned" }> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.status !== undefined) patch.status = input.status;
    await patchChat(db, user.userId, ctx.params.id, patch);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  });

export const DELETE = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    await softDeleteChat(db, user.userId, ctx.params.id);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  });
