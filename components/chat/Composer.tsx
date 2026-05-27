"use client";
import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, X, Loader2 } from "lucide-react";

export interface ComposerSubmit {
  text: string;
  imageKey?: string;
}

export function Composer({
  disabled,
  onSubmit,
  onUpload,
}: {
  disabled: boolean;
  onSubmit: (s: ComposerSubmit) => void;
  onUpload?: (file: File) => Promise<string>;
}) {
  const [text, setText] = useState("");
  const [imageKey, setImageKey] = useState<string | undefined>(undefined);
  const [busyUpload, setBusyUpload] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ta.current) {
      ta.current.style.height = "auto";
      ta.current.style.height = `${Math.min(ta.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const submit = () => {
    if (disabled) return;
    if (!text.trim() && !imageKey) return;
    const out: ComposerSubmit = { text };
    if (imageKey) out.imageKey = imageKey;
    onSubmit(out);
    setText("");
    setImageKey(undefined);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  const onFile = async (file: File) => {
    if (!onUpload) return;
    setBusyUpload(true);
    try {
      setImageKey(await onUpload(file));
    } finally {
      setBusyUpload(false);
    }
  };

  return (
    <div className="border-t border-border bg-background px-4 py-4">
      <div className="mx-auto max-w-3xl">
        {imageKey && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">
            <Paperclip className="h-3 w-3" />
            Image attached
            <button
              onClick={() => setImageKey(undefined)}
              className="ml-1 rounded-full p-0.5 opacity-70 hover:bg-accent-foreground/10 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex flex-1 items-end rounded-md border border-input bg-background transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
            <label
              className={`flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition hover:text-primary ${
                busyUpload ? "pointer-events-none opacity-50" : ""
              }`}
              title="Attach image"
            >
              {busyUpload ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={busyUpload}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
            <textarea
              ref={ta}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              placeholder="Type your message…"
              className="min-h-12 w-full resize-none border-none bg-transparent px-1 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              disabled={disabled}
              rows={1}
            />
          </div>
          <Button
            type="button"
            onClick={submit}
            disabled={disabled || (!text.trim() && !imageKey)}
            size="icon"
            className="h-12 w-12 shrink-0"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Shift
          </kbd>{" "}
          +{" "}
          <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Enter
          </kbd>{" "}
          for new line
        </p>
      </div>
    </div>
  );
}
