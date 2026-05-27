"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer";
import { Download, RefreshCw, Loader2 } from "lucide-react";

interface Props {
  id: string;
  title: string;
  kind: string;
  version: number;
  contentMd: string;
  canRegenerate: boolean;
}

export function ReportView({ id, title, kind, version, contentMd, canRegenerate }: Props) {
  const [busy, setBusy] = useState<"pdf" | "regen" | null>(null);

  const downloadPdf = async () => {
    setBusy("pdf");
    try {
      const r = await fetch(`/api/reports/${id}/pdf`, {
        method: "POST",
        headers: { origin: window.location.origin },
      });
      if (!r.ok) {
        toast.error("Could not generate PDF.");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded.");
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async () => {
    setBusy("regen");
    try {
      const r = await fetch(`/api/reports/${id}/regenerate`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: window.location.origin },
        body: JSON.stringify({ kind: "progress" }),
      });
      if (!r.ok) {
        toast.error("Regeneration failed.");
        return;
      }
      const fresh = (await r.json()) as { id: string };
      window.location.href = `/reports/${fresh.id}`;
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>{kind}</Badge>
            {version > 1 && <Badge variant="secondary">v{version}</Badge>}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          {canRegenerate && (
            <Button variant="outline" onClick={regenerate} disabled={busy !== null}>
              {busy === "regen" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate
            </Button>
          )}
          <Button onClick={downloadPdf} disabled={busy !== null}>
            {busy === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {busy === "pdf" ? "Working…" : "Download PDF"}
          </Button>
        </div>
      </header>
      <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
        <MarkdownRenderer content={contentMd} className="prose prose-slate max-w-none dark:prose-invert" />
      </div>
    </article>
  );
}
