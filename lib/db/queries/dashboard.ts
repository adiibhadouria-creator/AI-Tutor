import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { schema, type DB } from "@/lib/db/client";

export interface DashboardStats {
  totalChats: number;
  activeChats: number;
  completedChats: number;
  totalReports: number;
  recentChats: {
    id: string;
    title: string | null;
    topic: string;
    level: string | null;
    lastActiveAt: number;
  }[];
}

export async function getDashboard(db: DB, userId: string): Promise<DashboardStats> {
  const totals = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`sum(case when ${schema.chats.status} = 'active' then 1 else 0 end)`,
      completed: sql<number>`sum(case when ${schema.chats.status} = 'completed' then 1 else 0 end)`,
    })
    .from(schema.chats)
    .where(and(eq(schema.chats.userId, userId), isNull(schema.chats.deletedAt)));

  const reports = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.reports)
    .where(and(eq(schema.reports.userId, userId), isNull(schema.reports.deletedAt)));

  const recent = await db
    .select({
      id: schema.chats.id,
      title: schema.chats.title,
      topic: schema.chats.topic,
      level: schema.chats.level,
      lastActiveAt: schema.chats.lastActiveAt,
    })
    .from(schema.chats)
    .where(and(eq(schema.chats.userId, userId), isNull(schema.chats.deletedAt)))
    .orderBy(desc(schema.chats.lastActiveAt))
    .limit(5);

  return {
    totalChats: Number(totals[0]?.total ?? 0),
    activeChats: Number(totals[0]?.active ?? 0),
    completedChats: Number(totals[0]?.completed ?? 0),
    totalReports: Number(reports[0]?.total ?? 0),
    recentChats: recent,
  };
}
