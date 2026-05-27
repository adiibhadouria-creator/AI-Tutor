import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";

export interface ChatRow {
  id: string;
  userId: string;
  topic: string;
  level: string | null;
  status: string;
  title: string | null;
  rollingSummary: string | null;
  startedAt: number;
  lastActiveAt: number;
  deletedAt: number | null;
}

export async function createChat(db: DB, userId: string, topic: string): Promise<ChatRow> {
  const id = ulid();
  const now = Math.floor(Date.now() / 1000);
  await db.insert(schema.chats).values({
    id,
    userId,
    topic,
    status: "active",
    startedAt: now,
    lastActiveAt: now,
  } as typeof schema.chats.$inferInsert);
  return {
    id,
    userId,
    topic,
    level: null,
    status: "active",
    title: null,
    rollingSummary: null,
    startedAt: now,
    lastActiveAt: now,
    deletedAt: null,
  };
}

export interface ListPage {
  items: ChatRow[];
  nextCursor: string | null;
}

export async function listChats(
  db: DB,
  userId: string,
  cursor: string | undefined,
  limit: number,
): Promise<ListPage> {
  const where = cursor
    ? and(
        eq(schema.chats.userId, userId),
        isNull(schema.chats.deletedAt),
        lt(schema.chats.lastActiveAt, Number(cursor)),
      )
    : and(eq(schema.chats.userId, userId), isNull(schema.chats.deletedAt));
  const rows = await db
    .select()
    .from(schema.chats)
    .where(where)
    .orderBy(desc(schema.chats.lastActiveAt))
    .limit(limit + 1);
  const items = rows.slice(0, limit) as ChatRow[];
  const nextCursor = rows.length > limit ? String(rows[limit - 1]!.lastActiveAt) : null;
  return { items, nextCursor };
}

export async function getChat(db: DB, userId: string, id: string): Promise<ChatRow | null> {
  const r = await db.query.chats.findFirst({
    where: and(
      eq(schema.chats.id, id),
      eq(schema.chats.userId, userId),
      isNull(schema.chats.deletedAt),
    ),
  });
  return (r ?? null) as ChatRow | null;
}

export async function patchChat(
  db: DB,
  userId: string,
  id: string,
  patch: Partial<Pick<ChatRow, "title" | "status" | "level" | "rollingSummary">>,
): Promise<void> {
  await db
    .update(schema.chats)
    .set({ ...patch, lastActiveAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, userId)));
}

export async function softDeleteChat(db: DB, userId: string, id: string): Promise<void> {
  await db
    .update(schema.chats)
    .set({ deletedAt: Math.floor(Date.now() / 1000) })
    .where(and(eq(schema.chats.id, id), eq(schema.chats.userId, userId)));
}

export async function touchChat(db: DB, id: string): Promise<void> {
  await db
    .update(schema.chats)
    .set({ lastActiveAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.chats.id, id));
}
