import { withRoute } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getChat } from "@/lib/db/queries/chats";
import { listMessages, appendMessage } from "@/lib/db/queries/messages";
import { getAssessment } from "@/lib/db/queries/assessments";
import { streamLessonOpener, type StreamEvent } from "@/lib/ai";
import { makeSseResponse } from "@/lib/ai/stream";
import { AppError } from "@/lib/errors";

/**
 * Streams the first lesson after the assessment is complete. Idempotent —
 * if the chat already has a non-intro model message (i.e. lesson 1 was
 * already generated), this returns a `done` event without re-running the
 * model. The client can call this immediately after `/answer` resolves with
 * `done: true`.
 */
export const POST = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const chat = await getChat(db, user.userId, ctx.params.id);
    if (!chat) throw new AppError("NOT_FOUND", "chat not found");
    if (!chat.level) throw new AppError("VALIDATION", "complete the assessment first");

    const assessment = await getAssessment(db, chat.id);
    if (!assessment?.completedAt) throw new AppError("VALIDATION", "assessment not complete");

    const existingMessages = await listMessages(db, env.CONTENT_KEY, chat.id);
    // Already kicked off? Any message beyond the level summary means lesson 1
    // exists. Return an empty stream so the client just refetches.
    if (existingMessages.length > 1) {
      return makeSseResponse(async () => {
        // no-op
      });
    }

    return makeSseResponse(async (push) => {
      let aggregate = "";
      const events = await streamLessonOpener(env, {
        topic: chat.topic,
        level: chat.level!,
        summary: assessment.summary ?? "",
        recommendedPath: assessment.recommendedPath ?? "",
        signal: req.signal,
      });
      for await (const ev of events) {
        push(ev as StreamEvent);
        if (ev.type === "text") aggregate += ev.text;
      }
      if (aggregate.trim()) {
        await appendMessage(db, env.CONTENT_KEY, {
          chatId: chat.id,
          role: "model",
          content: aggregate,
        });
      }
    });
  });
