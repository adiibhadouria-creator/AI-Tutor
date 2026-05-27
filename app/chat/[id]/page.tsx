"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "vinext/shims/navigation";
import { ChatView } from "@/components/chat/ChatView";
import { Skeleton } from "@/components/ui/skeleton";
import type { UiMessage } from "@/components/chat/MessageBubble";
import type { AssessmentQuestion } from "@/lib/ai";

interface ChatDetail {
  chat: {
    id: string;
    title: string | null;
    topic: string;
    level: string | null;
  };
  messages: {
    id: string;
    role: "user" | "model";
    content: string;
    imageR2Key?: string;
    isDiagram?: boolean;
  }[];
  assessment: { questionsJson: string; answersJson: string | null; completedAt: number | null } | null;
}

function idFromPath(pathname: string): string | null {
  const segs = pathname.split("/").filter(Boolean);
  return segs[segs.length - 1] ?? null;
}

export default function ChatDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const id = idFromPath(pathname);
  const [data, setData] = useState<ChatDetail | null>(null);

  useEffect(() => {
    if (!id || id === "undefined" || id === "chat") {
      router.push("/chat");
      return;
    }
    let cancelled = false;
    setData(null); // clear stale data so the new chat shows the loader, not the previous chat
    fetch(`/api/chats/${id}`).then(async (r) => {
      if (cancelled) return;
      if (!r.ok) {
        router.push("/chat");
        return;
      }
      setData((await r.json()) as ChatDetail);
    });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (!data) {
    // In-pane loader only — the sidebar (in app/chat/layout.tsx) stays put.
    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
        <header className="border-b border-border bg-background/80 px-6 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tutoring chat
          </div>
          <Skeleton className="mt-1 h-4 w-32" />
        </header>
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
          <Skeleton className="h-24 w-3/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </main>
    );
  }

  const initialMessages: UiMessage[] = data.messages.map((m) => {
    const um: UiMessage = { id: m.id, role: m.role, content: m.content };
    if (m.imageR2Key) um.imageR2Key = m.imageR2Key;
    if (m.isDiagram) um.isDiagram = m.isDiagram;
    return um;
  });

  let initialQuestion: AssessmentQuestion | undefined;
  if (data.assessment && !data.assessment.completedAt) {
    const qs = JSON.parse(data.assessment.questionsJson) as AssessmentQuestion[];
    const answered: number[] = data.assessment.answersJson
      ? (JSON.parse(data.assessment.answersJson) as number[])
      : [];
    initialQuestion = qs[answered.length];
  }

  return (
    // key remounts ChatView when the chat id changes, so all internal state
    // (messages, current question, streaming text) resets cleanly.
    <ChatView
      key={data.chat.id}
      chatId={data.chat.id}
      initialMessages={initialMessages}
      {...(initialQuestion ? { initialQuestion } : {})}
      level={data.chat.level}
    />
  );
}
