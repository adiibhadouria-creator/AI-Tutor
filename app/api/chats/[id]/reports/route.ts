import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getChat } from "@/lib/db/queries/chats";
import { listMessages } from "@/lib/db/queries/messages";
import { createReport } from "@/lib/db/queries/reports";
import { generateProgressMarkdown } from "@/lib/reports";
import { ReportRegenerateSchema } from "@shared/validation";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const { kind } = await readJson(req, ReportRegenerateSchema);
    if (kind !== "progress") throw new AppError("VALIDATION", "only progress supported here");
    const chat = await getChat(db, user.userId, ctx.params.id);
    if (!chat) throw new AppError("NOT_FOUND", "chat not found");
    const msgs = await listMessages(db, env.CONTENT_KEY, chat.id);
    const turns = msgs.map((m) => ({ role: m.role, content: m.content }));
    const { title, contentMd } = await generateProgressMarkdown(
      env,
      chat.topic,
      chat.level ?? "Beginner",
      turns,
    );
    const r = await createReport(db, {
      chatId: chat.id,
      userId: user.userId,
      kind: "progress",
      title,
      contentMd,
    });
    return new Response(JSON.stringify(r), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  });
