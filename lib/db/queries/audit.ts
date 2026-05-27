import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";

export type AuditEvent =
  | "signup"
  | "login"
  | "login_failed"
  | "logout"
  | "password_change"
  | "account_delete"
  | "data_export";

export async function recordAudit(
  db: DB,
  args: { userId: string | null; event: AuditEvent; meta?: unknown; ipHash?: string },
): Promise<void> {
  await db.insert(schema.auditLog).values({
    id: ulid(),
    userId: args.userId,
    event: args.event,
    metaJson: args.meta === undefined ? null : JSON.stringify(args.meta),
    createdAt: Math.floor(Date.now() / 1000),
    ipHash: args.ipHash ?? null,
  } as typeof schema.auditLog.$inferInsert);
}
