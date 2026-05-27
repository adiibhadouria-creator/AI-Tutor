"use client";
import type { AssessmentQuestion } from "@/lib/ai";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { ClipboardList, Check, Loader2 } from "lucide-react";

export function AssessmentBubble({
  question,
  onSelect,
  disabled,
  selectedIndex,
}: {
  question: AssessmentQuestion;
  onSelect: (idx: number) => void;
  disabled: boolean;
  selectedIndex?: number;
}) {
  const variant =
    question.difficulty <= 2 ? "success" : question.difficulty <= 4 ? "warning" : "danger";
  const submitting = disabled && selectedIndex !== undefined;
  return (
    <div className="flex w-full animate-fade-in items-start gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
        <ClipboardList className="h-4 w-4" />
      </div>
      <div className="w-full max-w-2xl rounded-lg rounded-bl-sm border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Assessment Question
          </span>
          <Badge variant={variant}>Difficulty {question.difficulty}/5</Badge>
        </div>
        <div className="mb-5 text-base font-semibold text-card-foreground sm:text-lg">
          <MarkdownRenderer content={question.question} />
        </div>
        <div className="space-y-2">
          {question.options.map((opt, i) => {
            const sel = selectedIndex === i;
            return (
              <button
                key={i}
                onClick={() => !disabled && onSelect(i)}
                disabled={disabled}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-sm transition",
                  sel
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : disabled
                    ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
                    : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-accent",
                )}
              >
                <div
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
                    sel
                      ? "border-primary-foreground/40 bg-primary-foreground/20"
                      : disabled
                      ? "border-border"
                      : "border-border group-hover:border-primary",
                  )}
                >
                  {sel ? (
                    submitting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    )
                  ) : null}
                </div>
                <span className="flex-1">{opt}</span>
              </button>
            );
          })}
        </div>
        {submitting && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Checking your answer…
          </div>
        )}
      </div>
    </div>
  );
}
