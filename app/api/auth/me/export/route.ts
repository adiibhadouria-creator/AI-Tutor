import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { schema } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { listMessages } from "@/lib/db/queries/messages";
import { recordAudit } from "@/lib/db/queries/audit";

export const GET = (req: Request, ctx: { env: unknown }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const u = await db.query.users.findFirst({ where: eq(schema.users.id, user.userId) });
    const chats = await db
      .select()
      .from(schema.chats)
      .where(eq(schema.chats.userId, user.userId));
    const reports = await db
      .select()
      .from(schema.reports)
      .where(eq(schema.reports.userId, user.userId));
    const allMessages: { chatId: string; messages: unknown[] }[] = [];
    for (const c of chats) {
      const msgs = await listMessages(db, env.CONTENT_KEY, c.id);
      allMessages.push({ chatId: c.id, messages: msgs });
    }
    const blob = {
      exportedAt: new Date().toISOString(),
      user: u
        ? { id: u.id, email: u.email, displayName: u.displayName, createdAt: u.createdAt }
        : null,
      chats,
      reports,
      messagesByChat: allMessages,
    };
    await recordAudit(db, { userId: user.userId, event: "data_export" });
    return new Response(JSON.stringify(blob, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": "attachment; filename=profai-export.json",
      },
    });
  });
