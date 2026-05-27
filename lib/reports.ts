import type { AppEnv } from "@/lib/env";
import { aiRun, TUTOR_MODEL } from "@/lib/ai/client";
import type { TutorTurn } from "@/lib/ai";

export async function generateProgressMarkdown(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  topic: string,
  level: string,
  history: TutorTurn[],
): Promise<{ title: string; contentMd: string }> {
  const transcript = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n")
    .slice(0, 30000);
  const res = await aiRun<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>(
    env,
    TUTOR_MODEL,
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are summarising tutoring progress.\n\nTopic: ${topic}\nStudent level: ${level}\n\nRecent conversation:\n${transcript}\n\nWrite a markdown progress report with these sections:\n- # Progress Report — ${topic}\n- ## What You've Learned (bullet list of concepts mastered)\n- ## Open Questions (bullet list of things still ambiguous)\n- ## Suggested Next Topics (bullet list, 3-5)\n`,
            },
          ],
        },
      ],
      generationConfig: { responseMimeType: "text/plain", maxOutputTokens: 1200 },
    },
  );
  const md = (res.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  return { title: `Progress — ${topic}`, contentMd: md };
}
