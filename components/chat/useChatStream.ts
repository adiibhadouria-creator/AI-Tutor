"use client";
import { useCallback, useRef } from "react";

export interface StreamEventClient {
  type: "delta" | "done" | "error";
  payload: unknown;
}

export function useChatStream(chatId: string) {
  const aborter = useRef<AbortController | null>(null);

  const send = useCallback(
    async (
      text: string,
      imageKey: string | undefined,
      onEvent: (e: StreamEventClient) => void,
    ) => {
      aborter.current?.abort();
      const ac = new AbortController();
      aborter.current = ac;
      const r = await fetch(`/api/chats/${chatId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: window.location.origin },
        body: JSON.stringify({ text, image_key: imageKey }),
        signal: ac.signal,
      });
      if (!r.body) return;
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const lines = frame.split("\n");
          const event = lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "delta";
          const data = lines.find((l) => l.startsWith("data: "))?.slice(6);
          if (!data) continue;
          try {
            onEvent({
              type: event as StreamEventClient["type"],
              payload: JSON.parse(data),
            });
          } catch {
            // ignore malformed frames
          }
        }
      }
    },
    [chatId],
  );

  const cancel = useCallback(() => aborter.current?.abort(), []);
  return { send, cancel };
}
