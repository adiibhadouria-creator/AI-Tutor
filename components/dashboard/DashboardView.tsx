"use client";
import { useEffect, useState } from "react";
import Link from "vinext/shims/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Activity, CheckCircle2, FileText, ArrowRight } from "lucide-react";

interface Stats {
  totalChats: number;
  activeChats: number;
  completedChats: number;
  totalReports: number;
  recentChats: {
    id: string;
    title: string | null;
    topic: string;
    level: string | null;
    lastActiveAt: number;
  }[];
}

export function DashboardView() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    (async () => setS((await (await fetch("/api/dashboard")).json()) as Stats))();
  }, []);
  if (!s) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total chats" value={s.totalChats} icon={<MessageSquare className="h-5 w-5" />} />
        <Stat label="Active" value={s.activeChats} icon={<Activity className="h-5 w-5" />} />
        <Stat label="Completed" value={s.completedChats} icon={<CheckCircle2 className="h-5 w-5" />} />
        <Stat label="Reports" value={s.totalReports} icon={<FileText className="h-5 w-5" />} />
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Recent chats</h2>
        {s.recentChats.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No chats yet — start a topic to see it here.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {s.recentChats.map((c) => (
              <Link key={c.id} href={`/chat/${c.id}`} className="block group">
                <Card className="transition hover:border-primary/40 hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-card-foreground">
                          {c.title ?? c.topic}
                        </span>
                        {c.level && (
                          <Badge variant={badgeVariantForLevel(c.level)}>{c.level}</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {new Date(c.lastActiveAt * 1000).toLocaleString()}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
          {icon}
        </div>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function badgeVariantForLevel(level: string): "success" | "warning" | "danger" | "default" {
  const l = level.toLowerCase();
  if (l.includes("novice") || l.includes("beginner")) return "success";
  if (l.includes("intermediate")) return "warning";
  if (l.includes("advanced") || l.includes("expert") || l.includes("proficient")) return "danger";
  return "default";
}
