"use client";
import { useState, useEffect, useRef } from "react";
import { MessageBubble, type UiMessage } from "@/components/chat/MessageBubble";
import { AssessmentBubble } from "@/components/chat/AssessmentBubble";
import { Composer } from "@/components/chat/Composer";
import { useChatStream } from "@/components/chat/useChatStream";
import { CurriculumLoader } from "@/components/chat/CurriculumLoader";
import type { AssessmentQuestion } from "@/lib/ai";

export interface ChatViewProps {
  chatId: string;
  initialMessages: UiMessage[];
  initialQuestion?: AssessmentQuestion;
  level: string | null;
}

interface ServerMessage {
  id: string;
  role: "user" | "model";
  content: string;
  imageR2Key?: string;
  isDiagram?: boolean;
}

export function ChatView({ chatId, initialMessages, initialQuestion, level: initialLevel }: ChatViewProps) {
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [question, setQuestion] = useState<AssessmentQuestion | undefined>(initialQuestion);
  const [pendingSel, setPendingSel] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [level, setLevel] = useState(initialLevel);
  // True from "user submits last assessment answer" until the persisted lesson
  // has been fetched. Drives the full-pane "Designing your curriculum…" loader.
  const [finalising, setFinalising] = useState(false);
  const stream = useChatStream(chatId);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Track whether the user has manually scrolled up — if so, don't yank them
  // back down on each token update.
  const stickyRef = useRef(true);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // "Near bottom" tolerance — within 80px we still treat as stuck-to-bottom.
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickyRef.current = distanceFromBottom < 80;
  };

  // Auto-scroll to the latest content whenever messages, streaming text,
  // the in-flight question, or the curriculum-loader state changes — but
  // only if the user hasn't scrolled away from the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickyRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingText, question, finalising, busy]);

  const onSelect = async (idx: number) => {
    if (!question) return;
    const qId = question.id;
    // Assessments are always 5 questions. The last answer triggers the heavy
    // server-side path (analysis + lesson-opener Kimi calls, ~30-50s).
    // Flip into the curriculum-loader UI BEFORE making the request so the user
    // sees something meaningful for the full wait, not just a tiny caption.
    const isFinal = qId >= 5;
    setPendingSel(idx);
    setBusy(true);
    if (isFinal) {
      setQuestion(undefined);
      setFinalising(true);
    }
    const r = await fetch(`/api/chats/${chatId}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: window.location.origin },
      body: JSON.stringify({ question_id: qId, option_index: idx }),
    });
    const data = (await r.json()) as {
      next?: AssessmentQuestion;
      done?: boolean;
      level?: string;
      intro?: string;
    };
    if (data.next) {
      // edge case: server returned next even though we thought this was final
      setQuestion(data.next);
      setPendingSel(undefined);
      setFinalising(false);
    } else if (data.done) {
      setQuestion(undefined);
      setPendingSel(undefined);
      setFinalising(true);
      // Pull the freshly-persisted level summary in.
      try {
        const fresh = await fetch(`/api/chats/${chatId}`);
        if (fresh.ok) {
          const detail = (await fresh.json()) as {
            chat: { level: string | null };
            messages: ServerMessage[];
          };
          setLevel(detail.chat.level);
          setMessages(
            detail.messages.map((m) => {
              const um: UiMessage = { id: m.id, role: m.role, content: m.content };
              if (m.imageR2Key) um.imageR2Key = m.imageR2Key;
              if (m.isDiagram) um.isDiagram = m.isDiagram;
              return um;
            }),
          );
        }
      } catch {
        // continue — kickoff will still try to stream the lesson
      }
      // Now stream lesson 1. Curriculum loader stays up until the first
      // token arrives, then hands off to the streaming bubble.
      let acc = "";
      try {
        const k = await fetch(`/api/chats/${chatId}/kickoff`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: window.location.origin },
        });
        if (k.body) {
          const reader = k.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          let firstToken = false;
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const frames = buf.split("\n\n");
            buf = frames.pop() ?? "";
            for (const frame of frames) {
              const lines = frame.split("\n");
              const event = lines.find((l) => l.startsWith("event: "))?.slice(7) ?? "delta";
              const dataLine = lines.find((l) => l.startsWith("data: "))?.slice(6);
              if (!dataLine) continue;
              try {
                const payload = JSON.parse(dataLine) as { type?: string; text?: string };
                if (event === "delta" && payload.type === "text" && payload.text) {
                  if (!firstToken) {
                    firstToken = true;
                    setFinalising(false);
                  }
                  acc += payload.text;
                  setStreamingText(acc);
                }
              } catch {
                // ignore malformed frame
              }
            }
          }
        }
      } catch {
        // streaming failed — fall through to clear the loader
      }
      if (acc.trim()) {
        setMessages((m) => [...m, { id: `lesson-${Date.now()}`, role: "model", content: acc }]);
      }
      setStreamingText("");
      setFinalising(false);
    }
    setBusy(false);
  };

  const onSend = async ({ text, imageKey }: { text: string; imageKey?: string }) => {
    setBusy(true);
    const userMsg: UiMessage = { id: `local-${Date.now()}`, role: "user", content: text };
    if (imageKey) userMsg.imageR2Key = imageKey;
    setMessages((m) => [...m, userMsg]);
    setStreamingText("");
    let acc = "";
    await stream.send(text, imageKey, (ev) => {
      if (ev.type === "delta") {
        const p = ev.payload as { type: string; text?: string; r2Key?: string };
        if (p.type === "text" && p.text) {
          acc += p.text;
          setStreamingText(acc);
        }
        if (p.type === "diagram" && p.r2Key) {
          const r2Key = p.r2Key;
          setMessages((m) => [
            ...m,
            {
              id: `diag-${Date.now()}`,
              role: "model",
              content: "(diagram)",
              imageR2Key: r2Key,
              isDiagram: true,
            },
          ]);
        }
      }
      if (ev.type === "done") {
        setMessages((m) => [...m, { id: `bot-${Date.now()}`, role: "model", content: acc }]);
        setStreamingText("");
        setBusy(false);
      }
      if (ev.type === "error") {
        setMessages((m) => [
          ...m,
          { id: `err-${Date.now()}`, role: "model", content: "I hit an error. Please retry." },
        ]);
        setStreamingText("");
        setBusy(false);
      }
    });
  };

  const upload = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/uploads", {
      method: "POST",
      headers: { origin: window.location.origin },
      body: fd,
    });
    const data = (await r.json()) as { key: string };
    return data.key;
  };

  const saveProgressReport = async () => {
    const r = await fetch(`/api/chats/${chatId}/reports`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: window.location.origin },
      body: JSON.stringify({ kind: "progress" }),
    });
    if (r.ok) {
      const data = (await r.json()) as { id: string };
      window.location.href = `/reports/${data.id}`;
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/30">
      <header className="flex items-center justify-between border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tutoring chat
          </div>
          {level && (
            <div className="text-sm font-medium text-foreground">Level: {level}</div>
          )}
        </div>
        <button
          onClick={saveProgressReport}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
        >
          Save progress report
        </button>
      </header>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
      >
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} />
          ))}
          {streamingText && (
            <MessageBubble
              msg={{ id: "streaming", role: "model", content: streamingText }}
              streaming
            />
          )}
          {question && (
            <AssessmentBubble
              question={question}
              onSelect={onSelect}
              disabled={busy || pendingSel !== undefined}
              {...(pendingSel !== undefined ? { selectedIndex: pendingSel } : {})}
            />
          )}
          {finalising && <CurriculumLoader />}
          {busy && !finalising && !streamingText && !question && (
            <div className="flex items-center gap-3 pl-11">
              <div className="flex space-x-1.5">
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-primary"
                  style={{ animationDelay: "0.15s" }}
                />
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-primary"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
              <span className="text-xs text-muted-foreground">Thinking…</span>
            </div>
          )}
        </div>
      </div>
      <Composer
        disabled={busy || !!question || !level}
        onSubmit={onSend}
        onUpload={upload}
      />
    </div>
  );
}
