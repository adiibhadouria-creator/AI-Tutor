import { describe, it, expect } from "vitest";
import { sseFrame } from "@/lib/ai/stream";

describe("sseFrame", () => {
  it("produces valid SSE syntax", () => {
    const f = sseFrame("delta", { type: "text", text: "hi" });
    expect(f).toBe('event: delta\ndata: {"type":"text","text":"hi"}\n\n');
  });
  it("escapes newlines in payload by JSON encoding", () => {
    const f = sseFrame("delta", { type: "text", text: "line1\nline2" });
    expect(f).toContain('"text":"line1\\nline2"');
  });
});
