"use client";
import { useEffect, useState } from "react";
import Link from "vinext/shims/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ArrowRight } from "lucide-react";

interface ReportItem {
  id: string;
  title: string;
  kind: string;
  version: number;
  createdAt: number;
}

export function ReportsList() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [first, setFirst] = useState(true);
  const load = async (c?: string) => {
    setBusy(true);
    try {
      const r = await fetch(c ? `/api/reports?cursor=${c}` : "/api/reports");
      const data = (await r.json()) as { items: ReportItem[]; nextCursor: string | null };
      setItems((p) => (c ? [...p, ...data.items] : data.items));
      setCursor(data.nextCursor);
    } finally {
      setBusy(false);
      setFirst(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  if (first) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <FileText className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            No reports yet — finish a topic or save a progress report from a chat.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <Link key={it.id} href={`/reports/${it.id}`} className="group block">
          <Card className="transition hover:border-primary/40 hover:shadow-md">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-card-foreground">{it.title}</span>
                    <Badge variant={kindVariant(it.kind)}>{it.kind}</Badge>
                    {it.version > 1 && <Badge variant="secondary">v{it.version}</Badge>}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {new Date(it.createdAt * 1000).toLocaleString()}
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </CardContent>
          </Card>
        </Link>
      ))}
      {cursor && (
        <button
          onClick={() => load(cursor)}
          disabled={busy}
          className="w-full rounded-md py-2 text-sm text-muted-foreground hover:bg-accent"
        >
          {busy ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

function kindVariant(kind: string): "default" | "secondary" | "success" {
  if (kind === "assessment") return "default";
  if (kind === "completion") return "success";
  return "secondary";
}
