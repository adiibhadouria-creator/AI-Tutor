import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getChat, patchChat } from "@/lib/db/queries/chats";
import { listMessages, appendMessage } from "@/lib/db/queries/messages";
import { ChatSendSchema } from "@shared/validation";
import {
  streamTutorReply,
  summariseHistory,
  generateTitle,
  trimHistory,
  type StreamEvent,
} from "@/lib/ai";
import { makeSseResponse } from "@/lib/ai/stream";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const { success } = await env.RATE_LIMITER_CHAT.limit({ key: `u:${user.userId}` });
    if (!success) throw new AppError("RATE_LIMITED", "chat rate limit");
    const input = await readJson(req, ChatSendSchema);

    const chat = await getChat(db, user.userId, ctx.params.id);
    if (!chat) throw new AppError("NOT_FOUND", "chat not found");
    if (!chat.level) throw new AppError("VALIDATION", "complete the assessment first");

    let userImageBase64: string | undefined;
    if (input.image_key) {
      if (!input.image_key.startsWith(`uploads/${user.userId}/`))
        throw new AppError("FORBIDDEN", "image not yours");
      const obj = await env.R2.get(input.image_key);
      if (!obj) throw new AppError("NOT_FOUND", "image missing");
      const buf = new Uint8Array(await obj.arrayBuffer());
      userImageBase64 = btoa(String.fromCharCode(...buf));
    }

    const userMsgFields: { chatId: string; role: "user"; content: string; imageR2Key?: string } = {
      chatId: chat.id,
      role: "user",
      content: input.text,
    };
    if (input.image_key) userMsgFields.imageR2Key = input.image_key;
    await appendMessage(db, env.CONTENT_KEY, userMsgFields);

    const history = await listMessages(db, env.CONTENT_KEY, chat.id);
    const turns = history.slice(0, -1).map((m) => ({ role: m.role, content: m.content })) as {
      role: "user" | "model";
      content: string;
    }[];

    const trim = trimHistory(turns);
    let rollingSummary = chat.rollingSummary;
    if (trim.summarised && (!rollingSummary || trim.older.length > 0)) {
      rollingSummary = await summariseHistory(env, trim.older);
      await patchChat(db, user.userId, chat.id, { rollingSummary });
    }

    return makeSseResponse(async (push) => {
      let aggregateText = "";
      const events = await streamTutorReply(env, {
        chatId: chat.id,
        history: turns,
        rollingSummary,
        newUserText: input.text,
        ...(userImageBase64 ? { newImageBase64: userImageBase64 } : {}),
        level: chat.level!,
        topic: chat.topic,
        signal: req.signal,
      });
      for await (const ev of events) {
        push(ev as StreamEvent);
        if (ev.type === "text") aggregateText += ev.text;
        if (ev.type === "diagram") {
          await appendMessage(db, env.CONTENT_KEY, {
            chatId: chat.id,
            role: "model",
            content: "(diagram)",
            imageR2Key: ev.r2Key,
            isDiagram: true,
          });
        }
      }
      if (aggregateText) {
        await appendMessage(db, env.CONTENT_KEY, {
          chatId: chat.id,
          role: "model",
          content: aggregateText,
        });
      }
      await patchChat(db, user.userId, chat.id, {});
      if (!chat.title && history.length === 1) {
        const title = await generateTitle(env, input.text);
        await patchChat(db, user.userId, chat.id, { title });
      }
    });
  });
