import { withRoute, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require";
import { getChat, patchChat } from "@/lib/db/queries/chats";
import { getAssessment, completeAssessment, recordAnswer } from "@/lib/db/queries/assessments";
import { createReport } from "@/lib/db/queries/reports";
import { appendMessage } from "@/lib/db/queries/messages";
import { AssessmentAnswerSchema } from "@shared/validation";
import { analyseAssessment, type AssessmentQuestion } from "@/lib/ai";
import { AppError } from "@/lib/errors";

export const POST = (req: Request, ctx: { env: unknown; params: { id: string } }) =>
  withRoute(req, ctx.env, async ({ req, env, db }) => {
    const user = await requireUser(req, env, db);
    const input = await readJson(req, AssessmentAnswerSchema);
    const chat = await getChat(db, user.userId, ctx.params.id);
    if (!chat) throw new AppError("NOT_FOUND", "chat not found");
    const a = await getAssessment(db, chat.id);
    if (!a) throw new AppError("NOT_FOUND", "no assessment");
    const questions = JSON.parse(a.questionsJson) as AssessmentQuestion[];
    const answers: number[] = a.answersJson ? JSON.parse(a.answersJson) : [];
    answers.push(input.option_index);

    if (answers.length < questions.length) {
      await recordAnswer(db, chat.id, answers);
      return new Response(
        JSON.stringify({
          next: questions[answers.length],
          remaining: questions.length - answers.length,
        }),
        { headers: { "content-type": "application/json" } },
      );
    }

    const result = await analyseAssessment(env, chat.topic, questions, answers);
    await completeAssessment(db, chat.id, answers, questions, result);
    await patchChat(db, user.userId, chat.id, { level: result.level });
    const md = renderAssessmentReport(chat.topic, result, questions, answers);
    const report = await createReport(db, {
      chatId: chat.id,
      userId: user.userId,
      kind: "assessment",
      title: `Assessment: ${chat.topic}`,
      contentMd: md,
    });

    // Persist a brief level summary as the first model message. The actual
    // lesson 1 is generated separately via the streaming /kickoff endpoint so
    // the user sees tokens appearing live instead of waiting ~30s for a full
    // lesson to come back at once.
    const intro = [
      `**Level:** ${result.level}`,
      "",
      result.summary,
    ].join("\n");
    await appendMessage(db, env.CONTENT_KEY, {
      chatId: chat.id,
      role: "model",
      content: intro,
    });

    return new Response(
      JSON.stringify({
        done: true,
        level: result.level,
        summary: result.summary,
        recommendedPath: result.recommendedPath,
        reportId: report.id,
      }),
      { headers: { "content-type": "application/json" } },
    );
  });

function renderAssessmentReport(
  topic: string,
  r: { level: string; summary: string; recommendedPath: string },
  qs: AssessmentQuestion[],
  ans: number[],
): string {
  const lines: string[] = [];
  lines.push(
    `# Assessment Report — ${topic}`,
    "",
    `**Level:** ${r.level}`,
    "",
    `## Summary`,
    r.summary,
    "",
    `## Recommended Path`,
    r.recommendedPath,
    "",
    `## Question-by-Question`,
  );
  qs.forEach((q, i) => {
    const correct = ans[i] === q.correctIndex;
    lines.push(
      "",
      `### ${i + 1}. ${q.question}`,
      `- Your answer: ${q.options[ans[i] ?? -1] ?? "—"} ${correct ? "✓" : "✗"}`,
      `- Correct: ${q.options[q.correctIndex]}`,
      `- Difficulty: ${q.difficulty}/5`,
    );
  });
  return lines.join("\n");
}
