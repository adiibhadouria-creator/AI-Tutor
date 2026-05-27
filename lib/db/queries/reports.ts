import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";

export interface ReportRow {
  id: string;
  chatId: string;
  userId: string;
  kind: string;
  version: number;
  title: string;
  contentMd: string;
  pdfR2Key: string | null;
  createdAt: number;
  deletedAt: number | null;
}

export async function createReport(
  db: DB,
  args: {
    chatId: string;
    userId: string;
    kind: "assessment" | "progress" | "completion";
    title: string;
    contentMd: string;
    version?: number;
  },
): Promise<ReportRow> {
  const id = ulid();
  const now = Math.floor(Date.now() / 1000);
  const version = args.version ?? 1;
  await db.insert(schema.reports).values({
    id,
    chatId: args.chatId,
    userId: args.userId,
    kind: args.kind,
    version,
    title: args.title,
    contentMd: args.contentMd,
    createdAt: now,
  } as typeof schema.reports.$inferInsert);
  return {
    id,
    chatId: args.chatId,
    userId: args.userId,
    kind: args.kind,
    version,
    title: args.title,
    contentMd: args.contentMd,
    pdfR2Key: null,
    createdAt: now,
    deletedAt: null,
  };
}

export async function listReportsForUser(
  db: DB,
  userId: string,
  cursor: string | undefined,
  limit: number,
) {
  const where = cursor
    ? and(
        eq(schema.reports.userId, userId),
        isNull(schema.reports.deletedAt),
        lt(schema.reports.createdAt, Number(cursor)),
      )
    : and(eq(schema.reports.userId, userId), isNull(schema.reports.deletedAt));
  const rows = await db
    .select()
    .from(schema.reports)
    .where(where)
    .orderBy(desc(schema.reports.createdAt))
    .limit(limit + 1);
  const items = rows.slice(0, limit) as ReportRow[];
  return {
    items,
    nextCursor: rows.length > limit ? String(rows[limit - 1]!.createdAt) : null,
  };
}

export async function getReport(db: DB, userId: string, id: string): Promise<ReportRow | null> {
  const r = await db.query.reports.findFirst({
    where: and(
      eq(schema.reports.id, id),
      eq(schema.reports.userId, userId),
      isNull(schema.reports.deletedAt),
    ),
  });
  return (r ?? null) as ReportRow | null;
}

export async function listReportsForChat(db: DB, chatId: string): Promise<ReportRow[]> {
  return (await db
    .select()
    .from(schema.reports)
    .where(and(eq(schema.reports.chatId, chatId), isNull(schema.reports.deletedAt)))
    .orderBy(desc(schema.reports.createdAt))) as ReportRow[];
}

export async function setReportPdfKey(db: DB, id: string, key: string): Promise<void> {
  await db.update(schema.reports).set({ pdfR2Key: key }).where(eq(schema.reports.id, id));
}
