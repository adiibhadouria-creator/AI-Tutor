import { asc, eq } from "drizzle-orm";
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";
import { deriveKey, encryptString, decryptString } from "@/lib/encrypt";

export interface MessageInput {
  chatId: string;
  role: "user" | "model";
  content: string;
  imageR2Key?: string;
  isDiagram?: boolean;
}
export interface MessageRow extends MessageInput {
  id: string;
  createdAt: number;
}

export async function appendMessage(
  db: DB,
  contentKeyB64: string,
  m: MessageInput,
): Promise<MessageRow> {
  const id = ulid();
  const createdAt = Math.floor(Date.now() / 1000);
  const key = await deriveKey(contentKeyB64, m.chatId);
  const { ciphertext, iv } = await encryptString(key, m.content);
  await db.insert(schema.messages).values({
    id,
    chatId: m.chatId,
    role: m.role,
    contentCiphertext: new Uint8Array(ciphertext) as never,
    contentIv: iv as never,
    imageR2Key: m.imageR2Key ?? null,
    isDiagram: m.isDiagram ? 1 : 0,
    createdAt,
  } as typeof schema.messages.$inferInsert);
  return { id, createdAt, ...m, isDiagram: m.isDiagram ?? false };
}

export async function listMessages(
  db: DB,
  contentKeyB64: string,
  chatId: string,
): Promise<MessageRow[]> {
  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.chatId, chatId))
    .orderBy(asc(schema.messages.createdAt));
  const key = await deriveKey(contentKeyB64, chatId);
  const out: MessageRow[] = [];
  for (const r of rows) {
    const text = await decryptString(
      key,
      new Uint8Array(r.contentCiphertext as unknown as ArrayBuffer),
      new Uint8Array(r.contentIv as unknown as ArrayBuffer),
    );
    const row: MessageRow = {
      id: r.id,
      chatId: r.chatId,
      role: r.role as "user" | "model",
      content: text,
      isDiagram: r.isDiagram === 1,
      createdAt: r.createdAt,
    };
    if (r.imageR2Key) row.imageR2Key = r.imageR2Key;
    out.push(row);
  }
  return out;
}
