import { TUTOR_MODEL, IMAGE_MODEL, aiRun } from "@/lib/ai/client";
import {
  assessmentSystem,
  assessmentPrompt,
  analysisSystem,
  analysisPrompt,
  type AssessmentQuestion,
} from "@/lib/ai/prompts/assessment";
import { tutorSystem, rollingSummaryPrompt, lessonOpenerPrompt } from "@/lib/ai/prompts/tutor";
import { titleSystem, titlePrompt } from "@/lib/ai/prompts/title";
import { generateDiagramTool } from "@/lib/ai/tools";
import type { StreamEvent } from "@/lib/ai/stream";
import type { AppEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export type { AssessmentQuestion, StreamEvent };

// ─── OpenAI-compat shapes (Kimi K2.6 on Workers AI uses these) ──────────────

type ChatRole = "system" | "user" | "assistant" | "tool";

interface TextPart {
  type: "text";
  text: string;
}
interface ImagePart {
  type: "image_url";
  image_url: { url: string };
}
type ContentPart = TextPart | ImagePart;
type Content = string | ContentPart[];

interface ChatMessage {
  role: ChatRole;
  content: Content;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ChatRequest {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: "json_object" };
  tools?: { type: "function"; function: { name: string; description: string; parameters: unknown } }[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  stream?: boolean;
  // Kimi K2.6 reasoning controls
  reasoning_effort?: "low" | "medium" | "high";
  chat_template_kwargs?: { thinking?: boolean; clear_thinking?: boolean };
}

interface StreamDelta {
  content?: string;
  tool_calls?: { index?: number; id?: string; type?: "function"; function?: { name?: string; arguments?: string } }[];
}

interface StreamChunk {
  choices?: { delta?: StreamDelta; finish_reason?: string }[];
}

interface ChatResponse {
  choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] }; finish_reason?: string }[];
  // some Workers AI models return a flat shape — keep both for safety
  response?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const HISTORY_SIZE_THRESHOLD = 40;
const HISTORY_TOKEN_THRESHOLD = 50_000;

function imageDataUrl(base64: string, mime = "image/jpeg"): string {
  return `data:${mime};base64,${base64}`;
}

function buildUserContent(text: string, imageBase64?: string): Content {
  if (!imageBase64) return text;
  return [
    { type: "text", text },
    { type: "image_url", image_url: { url: imageDataUrl(imageBase64) } },
  ];
}

function readContent(res: ChatResponse): string {
  const c = res.choices?.[0]?.message?.content;
  if (typeof c === "string") return c;
  if (typeof res.response === "string") return res.response;
  return "";
}

function readToolCalls(res: ChatResponse): ToolCall[] {
  return res.choices?.[0]?.message?.tool_calls ?? [];
}

/** Parse a JSON object out of a model reply that may include ```json fences. */
function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  return JSON.parse(raw) as T;
}

// ─── Public surface ─────────────────────────────────────────────────────────

export async function generateAssessment(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  topic: string,
  imageBase64?: string,
): Promise<AssessmentQuestion[]> {
  // Kimi's JSON-mode requires the prompt to mention "json"; instruct it to
  // wrap the array in a top-level object so json_object mode is well-defined.
  const userContent = buildUserContent(
    assessmentPrompt(topic, !!imageBase64) +
      `\n\nReturn ONLY a JSON object with a single key "questions" whose value is an array of EXACTLY 5 items. Each item:\n` +
      `{ "id": number (1..5), "question": string, "options": [string, string, string, string], "correctIndex": integer 0..3, "difficulty": integer 1..5 }`,
    imageBase64,
  );
  const req: ChatRequest = {
    messages: [
      { role: "system", content: assessmentSystem() },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2500,
    temperature: 0.4,
    chat_template_kwargs: { thinking: false }, // pure JSON gen — no CoT needed
  };
  const res = await aiRun<ChatResponse>(env, TUTOR_MODEL, req);
  const txt = readContent(res);
  if (!txt) {
    console.warn("assessment_empty_response", { res: JSON.stringify(res).slice(0, 800) });
    throw new AppError("UPSTREAM", "AI returned empty response");
  }
  let raw: unknown;
  try {
    raw = extractJson<unknown>(txt);
  } catch (e) {
    console.warn("assessment_json_parse_failed", { text: txt.slice(0, 500), err: String(e) });
    throw new AppError("UPSTREAM", "AI returned malformed JSON");
  }
  const arr = pickQuestions(raw);
  if (!arr || arr.length === 0) {
    console.warn("assessment_no_questions", { shape: JSON.stringify(raw).slice(0, 500) });
    throw new AppError("UPSTREAM", "AI returned no questions");
  }
  return arr.map((q, i) => ({
    id: typeof q.id === "number" ? q.id : i + 1,
    question: String(q.question ?? ""),
    options: [...(q.options ?? []), "I don't know"],
    correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
    difficulty: typeof q.difficulty === "number" ? q.difficulty : i + 1,
  }));
}

function pickQuestions(raw: unknown): AssessmentQuestion[] | null {
  if (Array.isArray(raw)) return raw as AssessmentQuestion[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["questions", "items", "data", "result", "quiz"]) {
      if (Array.isArray(obj[key])) return obj[key] as AssessmentQuestion[];
    }
  }
  return null;
}

export async function analyseAssessment(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  topic: string,
  questions: AssessmentQuestion[],
  answers: number[],
): Promise<{ level: string; summary: string; recommendedPath: string }> {
  const results = questions.map((q, i) => ({
    question: q.question,
    difficulty: q.difficulty,
    userAnswer: q.options[answers[i] ?? -1] ?? "(no answer)",
    isCorrect: answers[i] === q.correctIndex,
  }));
  const req: ChatRequest = {
    messages: [
      { role: "system", content: analysisSystem() },
      {
        role: "user",
        content:
          analysisPrompt(topic, results) +
          `\n\nReturn ONLY a JSON object with keys: { "level": string, "summary": string, "recommendedPath": string }.`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1200,
    temperature: 0.5,
    chat_template_kwargs: { thinking: false }, // JSON-only task — no CoT needed
  };
  const res = await aiRun<ChatResponse>(env, TUTOR_MODEL, req);
  const txt = readContent(res);
  if (!txt) {
    console.warn("analysis_empty_response", { res: JSON.stringify(res).slice(0, 500) });
    throw new AppError("UPSTREAM", "AI returned empty response (analysis)");
  }
  try {
    return extractJson<{ level: string; summary: string; recommendedPath: string }>(txt);
  } catch (e) {
    console.warn("analysis_json_parse_failed", { text: txt.slice(0, 500), err: String(e) });
    throw new AppError("UPSTREAM", "AI returned malformed JSON (analysis)");
  }
}

export async function generateTitle(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  firstUserText: string,
): Promise<string> {
  const req: ChatRequest = {
    messages: [
      { role: "system", content: titleSystem() },
      { role: "user", content: titlePrompt(firstUserText) },
    ],
    max_tokens: 60,
    temperature: 0.4,
    chat_template_kwargs: { thinking: false }, // 6-word title — zero CoT needed
  };
  const res = await aiRun<ChatResponse>(env, TUTOR_MODEL, req);
  return (readContent(res) || "Untitled chat").trim().replace(/^["']|["']$/g, "").slice(0, 60);
}

export async function generateLessonOpener(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  topic: string,
  level: string,
  summary: string,
  recommendedPath: string,
): Promise<string> {
  const req: ChatRequest = {
    messages: [
      { role: "system", content: tutorSystem(topic, level) },
      { role: "user", content: lessonOpenerPrompt(topic, level, summary, recommendedPath) },
    ],
    max_tokens: 6000, // headroom for reasoning + plan + lesson 1
    temperature: 0.6,
    reasoning_effort: "low",
  };
  const res = await aiRun<ChatResponse>(env, TUTOR_MODEL, req);
  return readContent(res).trim();
}

/**
 * Streaming variant of the lesson opener — yields text chunks as Kimi
 * generates them so the user sees the lesson appear word-by-word instead of
 * waiting for a full ~30s non-streaming round trip.
 */
export async function streamLessonOpener(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  args: {
    topic: string;
    level: string;
    summary: string;
    recommendedPath: string;
    signal?: AbortSignal;
  },
): Promise<AsyncIterable<StreamEvent>> {
  const req: ChatRequest = {
    messages: [
      { role: "system", content: tutorSystem(args.topic, args.level) },
      {
        role: "user",
        content: lessonOpenerPrompt(args.topic, args.level, args.summary, args.recommendedPath),
      },
    ],
    max_tokens: 6000,
    temperature: 0.6,
    reasoning_effort: "low",
    stream: true,
  };
  const callOpts = args.signal ? { signal: args.signal } : {};
  return (async function* () {
    const upstream = await aiRun<ReadableStream<Uint8Array> | ChatResponse>(
      env,
      TUTOR_MODEL,
      req,
      callOpts,
    );
    if (isReadableStream(upstream)) {
      for await (const chunk of parseSseStream(upstream)) {
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) yield { type: "text", text: delta.content } as StreamEvent;
      }
    } else {
      const text = readContent(upstream);
      if (text) yield { type: "text", text } as StreamEvent;
    }
  })();
}

// ─── Streaming tutor reply ──────────────────────────────────────────────────

export interface TutorTurn {
  role: "user" | "model";
  content: string;
  imageBase64?: string;
}

export async function streamTutorReply(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY" | "R2">,
  args: {
    chatId: string;
    history: TutorTurn[];
    rollingSummary: string | null;
    newUserText: string;
    newImageBase64?: string;
    level: string;
    topic: string;
    signal?: AbortSignal;
    onDiagramKey?: (key: string) => void;
  },
): Promise<AsyncIterable<StreamEvent>> {
  const trimmed = trimHistory(args.history);
  const messages: ChatMessage[] = [
    { role: "system", content: tutorSystem(args.topic, args.level) },
  ];
  if (args.rollingSummary && trimmed.summarised) {
    messages.push({
      role: "system",
      content: `Earlier in this conversation: ${args.rollingSummary}`,
    });
  }
  for (const m of trimmed.kept) {
    const role: ChatRole = m.role === "model" ? "assistant" : "user";
    if (role === "user" && m.imageBase64) {
      messages.push({ role, content: buildUserContent(m.content, m.imageBase64) });
    } else {
      messages.push({ role, content: m.content });
    }
  }
  messages.push({
    role: "user",
    content: buildUserContent(args.newUserText, args.newImageBase64),
  });

  const req: ChatRequest = {
    messages,
    max_tokens: 6000,
    temperature: 0.6,
    reasoning_effort: "low",
    stream: true,
    tools: [
      {
        type: "function",
        function: {
          name: generateDiagramTool.function.name,
          description: generateDiagramTool.function.description,
          parameters: generateDiagramTool.function.parameters,
        },
      },
    ],
    tool_choice: "auto",
  };

  const callOpts = args.signal ? { signal: args.signal } : {};

  return (async function* () {
    const upstream = await aiRun<ReadableStream<Uint8Array> | ChatResponse>(
      env,
      TUTOR_MODEL,
      req,
      callOpts,
    );

    // Buffered tool-call assembly — deltas arrive in pieces with an `index`.
    const tools: Map<number, { name: string; args: string }> = new Map();

    if (isReadableStream(upstream)) {
      for await (const chunk of parseSseStream(upstream)) {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) yield { type: "text", text: delta.content } as StreamEvent;
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const cur = tools.get(idx) ?? { name: "", args: "" };
            if (tc.function?.name) cur.name = tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            tools.set(idx, cur);
          }
        }
      }
    } else {
      // Fallback when the binding doesn't honour stream:true.
      const text = readContent(upstream);
      if (text) yield { type: "text", text } as StreamEvent;
      for (const tc of readToolCalls(upstream)) {
        tools.set(tools.size, { name: tc.function.name, args: tc.function.arguments });
      }
    }

    // Resolve diagram tool calls (if any) once the text stream is complete.
    for (const tc of tools.values()) {
      if (tc.name !== "generateDiagram") continue;
      let parsed: { prompt?: string } = {};
      try {
        parsed = JSON.parse(tc.args) as { prompt?: string };
      } catch {
        continue;
      }
      try {
        const png = await aiRun<{ image: string }>(env, IMAGE_MODEL, {
          prompt: `Educational diagram: ${parsed.prompt ?? ""}. Clear, labelled, schematic style.`,
        });
        const bytes = Uint8Array.from(atob(png.image), (c) => c.charCodeAt(0));
        const { putDiagram } = await import("@/lib/r2");
        const r2Key = await putDiagram(env, args.chatId, bytes.buffer);
        args.onDiagramKey?.(r2Key);
        yield { type: "diagram", r2Key } as StreamEvent;
      } catch {
        // Diagram gen failed — silently continue.
      }
    }
  })();
}

// ─── SSE chunk parsing for upstream Workers AI streams ─────────────────────

function isReadableStream(v: unknown): v is ReadableStream<Uint8Array> {
  return typeof (v as { getReader?: unknown })?.getReader === "function";
}

async function* parseSseStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE frames are separated by blank lines.
      let nl: number;
      while ((nl = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            yield JSON.parse(data) as StreamChunk;
          } catch {
            // ignore malformed frames
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function summariseHistory(
  env: Pick<AppEnv, "AI" | "AI_GATEWAY_GOOGLE_API_KEY">,
  older: TutorTurn[],
): Promise<string> {
  const req: ChatRequest = {
    messages: [
      {
        role: "user",
        content: rollingSummaryPrompt(
          older.map((m) => ({ role: m.role, content: m.content })),
        ),
      },
    ],
    max_tokens: 600,
    temperature: 0.5,
    chat_template_kwargs: { thinking: false }, // mechanical summarisation
  };
  const res = await aiRun<ChatResponse>(env, TUTOR_MODEL, req);
  return readContent(res).trim();
}

// ─── History trimming ───────────────────────────────────────────────────────

function approxTokens(turns: TutorTurn[]): number {
  return turns.reduce((sum, t) => sum + Math.ceil(t.content.length / 4), 0);
}

interface TrimResult {
  kept: TutorTurn[];
  summarised: boolean;
  older: TutorTurn[];
}

export function trimHistory(history: TutorTurn[]): TrimResult {
  if (
    history.length <= HISTORY_SIZE_THRESHOLD &&
    approxTokens(history) < HISTORY_TOKEN_THRESHOLD
  ) {
    return { kept: history, summarised: false, older: [] };
  }
  const kept = history.slice(-20);
  const older = history.slice(0, -20);
  return { kept, summarised: true, older };
}
