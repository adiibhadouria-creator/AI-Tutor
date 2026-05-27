"use client";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Mermaid } from "@/components/markdown/Mermaid";

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  /**
   * When true, Mermaid blocks are NOT rendered (they'd fail on every partial
   * token while the block is still being streamed). Show a placeholder instead;
   * once streaming finishes, the message gets committed to state and rendered
   * with `streaming={false}` which kicks the actual diagram in.
   */
  streaming?: boolean;
}

export function MarkdownRenderer({ content, className, streaming = false }: MarkdownRendererProps) {
  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: (props) => (
            <a
              {...props}
              className="text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
          // Render ```mermaid blocks as actual diagrams — but only when the
          // block is complete (i.e. not actively streaming).
          code: ({ className: codeClass, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClass ?? "");
            const lang = match?.[1];
            const text = String(children ?? "").replace(/\n$/, "");
            if (lang === "mermaid") {
              if (streaming) {
                return (
                  <div className="my-3 flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/40 px-4 py-6 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Drawing diagram…
                  </div>
                );
              }
              return <Mermaid chart={text} />;
            }
            return (
              <code className={codeClass} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
