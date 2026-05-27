import { eq, sql } from "drizzle-orm";
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";

export async function findUserByEmail(db: DB, email: string) {
  const lower = email.toLowerCase();
  return db.query.users.findFirst({
    where: sql`lower(${schema.users.email}) = ${lower}`,
  });
}

export async function findUserById(db: DB, id: string) {
  return db.query.users.findFirst({ where: eq(schema.users.id, id) });
}

export async function createUser(db: DB, email: string, passwordHash: string): Promise<string> {
  const id = ulid();
  const now = Math.floor(Date.now() / 1000);
  await db.insert(schema.users).values({
    id,
    email,
    passwordHash,
    createdAt: now,
  } as typeof schema.users.$inferInsert);
  return id;
}

export async function touchLastLogin(db: DB, userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ lastLoginAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.users.id, userId));
}

export async function updatePasswordHash(db: DB, userId: string, hash: string): Promise<void> {
  await db.update(schema.users).set({ passwordHash: hash }).where(eq(schema.users.id, userId));
}

export async function softDeleteUser(db: DB, userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ deletedAt: Math.floor(Date.now() / 1000) })
    .where(eq(schema.users.id, userId));
}
