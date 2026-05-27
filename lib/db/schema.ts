import { sqliteTable, text, integer, blob, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name"),
    createdAt: integer("created_at").notNull(),
    lastLoginAt: integer("last_login_at"),
    deletedAt: integer("deleted_at"),
  },
  (t) => ({
    emailUq: uniqueIndex("idx_users_email_nocase").on(t.email),
  }),
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    lastSeenAt: integer("last_seen_at").notNull(),
    userAgent: text("user_agent"),
    ipHash: text("ip_hash"),
  },
  (t) => ({
    userIdx: index("idx_auth_sessions_user").on(t.userId),
    expiresIdx: index("idx_auth_sessions_expires").on(t.expiresAt),
  }),
);

export const chats = sqliteTable(
  "chats",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    level: text("level"),
    status: text("status").notNull().default("active"),
    title: text("title"),
    rollingSummary: text("rolling_summary"),
    startedAt: integer("started_at").notNull(),
    lastActiveAt: integer("last_active_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => ({
    userActiveIdx: index("idx_chats_user_active").on(t.userId, t.lastActiveAt),
  }),
);

export const assessments = sqliteTable(
  "assessments",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    questionsJson: text("questions_json").notNull(),
    answersJson: text("answers_json"),
    score: integer("score"),
    summary: text("summary"),
    recommendedPath: text("recommended_path"),
    completedAt: integer("completed_at"),
  },
  (t) => ({
    chatUq: uniqueIndex("idx_assessments_chat").on(t.chatId),
  }),
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    contentCiphertext: blob("content_ciphertext", { mode: "buffer" }).notNull(),
    contentIv: blob("content_iv", { mode: "buffer" }).notNull(),
    imageR2Key: text("image_r2_key"),
    isDiagram: integer("is_diagram").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    chatCreatedIdx: index("idx_messages_chat_created").on(t.chatId, t.createdAt),
  }),
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    version: integer("version").notNull().default(1),
    title: text("title").notNull(),
    contentMd: text("content_md").notNull(),
    pdfR2Key: text("pdf_r2_key"),
    createdAt: integer("created_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => ({
    userCreatedIdx: index("idx_reports_user_created").on(t.userId, t.createdAt),
    chatIdx: index("idx_reports_chat").on(t.chatId, t.createdAt),
  }),
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    event: text("event").notNull(),
    metaJson: text("meta_json"),
    createdAt: integer("created_at").notNull(),
    ipHash: text("ip_hash"),
  },
  (t) => ({
    userCreatedIdx: index("idx_audit_user_created").on(t.userId, t.createdAt),
  }),
);
