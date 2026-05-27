export function titleSystem(): string {
  return "You write very short topic labels for a chat history sidebar.";
}

export function titlePrompt(firstUserText: string): string {
  return [
    "Summarize the following user message into a chat title.",
    "Rules: 2 to 6 words, no quotes, title case, no trailing punctuation.",
    "",
    `User message: """${firstUserText.slice(0, 800)}"""`,
  ].join("\n");
}
