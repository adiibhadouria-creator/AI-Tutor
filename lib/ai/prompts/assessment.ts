export interface AssessmentQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  difficulty: number;
}

export function assessmentSystem(): string {
  return "You are an expert examiner. Create precise, clear, pedagogically sound multiple-choice questions.";
}

export function assessmentPrompt(topic: string, hasImage: boolean): string {
  return [
    `The user wants to learn: "${topic}".`,
    hasImage ? "They also provided an image for context." : "",
    "Generate exactly 5 multiple-choice questions in strictly increasing difficulty:",
    "1. Very basic / fundamental",
    "2. Beginner",
    "3. Intermediate",
    "4. Advanced",
    "5. Expert / complex application",
    "Each question has 4 distinct options. Return JSON matching the schema.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const assessmentJsonSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "integer" },
      question: { type: "string" },
      options: { type: "array", items: { type: "string" } },
      correctIndex: { type: "integer" },
      difficulty: { type: "integer" },
    },
    required: ["id", "question", "options", "correctIndex", "difficulty"],
  },
};

export function analysisSystem(): string {
  return "You are an expert tutor analysing diagnostic quiz results. Be precise and encouraging.";
}

export function analysisPrompt(
  topic: string,
  results: { question: string; difficulty: number; userAnswer: string; isCorrect: boolean }[],
): string {
  return [
    `Topic: ${topic}`,
    "Quiz results:",
    JSON.stringify(results, null, 2),
    `If the user answered "I don't know", treat it as a knowledge gap.`,
    "Determine proficiency level (Novice | Beginner | Intermediate | Proficient | Advanced).",
    "Return JSON: { level, summary, recommendedPath }.",
  ].join("\n");
}

export const analysisJsonSchema = {
  type: "object",
  properties: {
    level: { type: "string" },
    summary: { type: "string" },
    recommendedPath: { type: "string" },
  },
  required: ["level", "summary", "recommendedPath"],
};
