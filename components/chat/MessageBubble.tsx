"use client";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { Sparkles } from "lucide-react";

export interface UiMessage {
  id: string;
  role: "user" | "model";
  content: string;
  imageR2Key?: string;
  isDiagram?: boolean;
}

export function MessageBubble({ msg, streaming = false }: { msg: UiMessage; streaming?: boolean }) {
  const isUser = msg.role === "user";
  const imageSrc = msg.imageR2Key ? `/api/uploads/${encodeURI(msg.imageR2Key)}` : null;
  return (
    <div
      className={cn(
        "flex w-full animate-fade-in items-start gap-3",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[75%] sm:text-base",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm border border-border bg-card text-card-foreground",
        )}
      >
        {imageSrc && (
          <div className="mb-3 overflow-hidden rounded-md border border-border/50">
            <img src={imageSrc} alt="" className="max-h-64 w-auto object-cover" />
            {msg.isDiagram && (
              <div className="bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                ✦ AI generated diagram
              </div>
            )}
          </div>
        )}
        <MarkdownRenderer
          content={msg.content}
          className={isUser ? "text-primary-foreground" : "text-card-foreground"}
          streaming={streaming}
        />
      </div>
      {isUser && (
        <Avatar className="mt-1 h-8 w-8">
          <AvatarFallback className="bg-accent text-accent-foreground text-[11px]">
            You
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
