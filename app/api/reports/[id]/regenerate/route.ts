import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getReport, createReport } from "@/lib/db/queries/reports";
import { getChat } from "@/lib/db/queries/chats";
import { listMessages } from "@/lib/db/queries/messages";
import { generateProgressMarkdown } from "@/lib/reports";
import { AppError } from "@/lib/errors";
import { schema } from "@/lib/db/client";
import { eq, desc } from "drizzle-orm";

export const POST = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const existing = await getReport(db, user.userId, ctx.params.id);
    if (!existing) throw new AppError("NOT_FOUND", "report not found");
    const chat = await getChat(db, user.userId, existing.chatId);
    if (!chat) throw new AppError("NOT_FOUND", "chat missing");
    if (existing.kind !== "progress")
      throw new AppError("VALIDATION", "only progress reports can be regenerated");

    const messages = await listMessages(db, env.CONTENT_KEY, chat.id);
    const turns = messages.map((m) => ({ role: m.role, content: m.content }));

    const latest = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.chatId, chat.id))
      .orderBy(desc(schema.reports.version))
      .limit(1);
    const nextVersion = (latest[0]?.version ?? 0) + 1;

    const { title, contentMd } = await generateProgressMarkdown(
      env,
      chat.topic,
      chat.level ?? "Beginner",
      turns,
    );
    const fresh = await createReport(db, {
      chatId: chat.id,
      userId: user.userId,
      kind: "progress",
      title,
      contentMd,
      version: nextVersion,
    });
    return new Response(JSON.stringify(fresh), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  });
