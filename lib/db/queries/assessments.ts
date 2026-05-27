import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { schema, type DB } from "@/lib/db/client";
import type { AssessmentQuestion } from "@/lib/ai";

export async function createAssessment(
  db: DB,
  chatId: string,
  questions: AssessmentQuestion[],
): Promise<string> {
  const id = ulid();
  await db.insert(schema.assessments).values({
    id,
    chatId,
    questionsJson: JSON.stringify(questions),
  } as typeof schema.assessments.$inferInsert);
  return id;
}

export async function getAssessment(db: DB, chatId: string) {
  return db.query.assessments.findFirst({ where: eq(schema.assessments.chatId, chatId) });
}

export async function recordAnswer(db: DB, chatId: string, answers: number[]): Promise<void> {
  await db
    .update(schema.assessments)
    .set({ answersJson: JSON.stringify(answers) })
    .where(eq(schema.assessments.chatId, chatId));
}

export async function completeAssessment(
  db: DB,
  chatId: string,
  answers: number[],
  questions: AssessmentQuestion[],
  result: { level: string; summary: string; recommendedPath: string },
): Promise<void> {
  const score = answers.reduce(
    (s, a, i) => s + (a === questions[i]?.correctIndex ? 1 : 0),
    0,
  );
  await db
    .update(schema.assessments)
    .set({
      answersJson: JSON.stringify(answers),
      score,
      summary: result.summary,
      recommendedPath: result.recommendedPath,
      completedAt: Math.floor(Date.now() / 1000),
    })
    .where(eq(schema.assessments.chatId, chatId));
}
