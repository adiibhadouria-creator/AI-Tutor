import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getChat } from "@/lib/db/queries/chats";
import { listMessages } from "@/lib/db/queries/messages";
import { schema } from "@/lib/db/client";
import { eq, and, gte } from "drizzle-orm";
import { AppError } from "@/lib/errors";

export const POST = (
  req: Request,
  ctx: { env: unknown; params: { id: string; mid: string } },
) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const chat = await getChat(db, user.userId, ctx.params.id);
    if (!chat) throw new AppError("NOT_FOUND", "chat not found");
    const messages = await listMessages(db, env.CONTENT_KEY, chat.id);
    const target = messages.find((m) => m.id === ctx.params.mid);
    if (!target) throw new AppError("NOT_FOUND", "message not found");
    if (target.role !== "model") throw new AppError("VALIDATION", "can only retry a model message");
    await db
      .delete(schema.messages)
      .where(
        and(eq(schema.messages.chatId, chat.id), gte(schema.messages.createdAt, target.createdAt)),
      );
    return new Response(JSON.stringify({ ok: true, retryFrom: target.createdAt }), {
      headers: { "content-type": "application/json" },
    });
  });
