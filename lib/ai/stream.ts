export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "diagram"; r2Key: string }
  | { type: "error"; message: string }
  | { type: "done" };

export function sseFrame(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export function makeSseResponse(
  producer: (push: (e: StreamEvent) => void) => Promise<void>,
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const push = (e: StreamEvent) =>
        controller.enqueue(enc.encode(sseFrame(e.type === "done" ? "done" : "delta", e)));
      try {
        await producer(push);
        push({ type: "done" });
      } catch (e) {
        push({ type: "error", message: e instanceof Error ? e.message : "unknown" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
