"use client";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useRouter } from "vinext/shims/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";

const SUGGESTIONS = [
  "How do neural networks learn?",
  "Explain photosynthesis",
  "Calculus fundamentals",
  "How does encryption work?",
];

export function NewChatLanding() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Tell me what you'd like to learn.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/chats", {
        method: "POST",
        headers: { "content-type": "application/json", origin: window.location.origin },
        body: JSON.stringify({ topic }),
      });
      if (!r.ok) {
        toast.error("Could not start chat. Try again in a moment.");
        return;
      }
      const data = (await r.json()) as { chat: { id: string } };
      router.push(`/chat/${data.chat.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Sparkles className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          What do you want to learn?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell me a topic and I'll start with a quick 5-question diagnostic to gauge your level.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic">Topic</Label>
            <textarea
              id="topic"
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full resize-none rounded-md border border-input bg-background px-4 py-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              placeholder="e.g., How does gravity work?"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTopic(s)}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
              >
                {s}
              </button>
            ))}
          </div>
          <Button type="submit" disabled={busy || !topic.trim()} className="w-full" size="lg">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Setting up your assessment…
              </>
            ) : (
              "Start learning"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
