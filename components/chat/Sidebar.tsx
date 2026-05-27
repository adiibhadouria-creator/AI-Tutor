"use client";
import { useEffect, useState } from "react";
import Link from "vinext/shims/link";
import { cn } from "@/lib/cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  GraduationCap,
  MessageSquare,
} from "lucide-react";

interface ChatItem {
  id: string;
  title: string | null;
  topic: string;
  lastActiveAt: number;
  level: string | null;
}

interface Me {
  email: string;
}

export function Sidebar({ activeId }: { activeId?: string }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [first, setFirst] = useState(true);
  const [me, setMe] = useState<Me | null>(null);

  const load = async (c?: string) => {
    setBusy(true);
    try {
      const url = c ? `/api/chats?cursor=${c}` : "/api/chats";
      const r = await fetch(url);
      const data = (await r.json()) as { items: ChatItem[]; nextCursor: string | null };
      setItems((prev) => (c ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor);
    } finally {
      setBusy(false);
      setFirst(false);
    }
  };
  useEffect(() => {
    load();
    fetch("/api/auth/me")
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
      .then((data) => {
        if (data) setMe(data);
      });
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { origin: window.location.origin },
    });
    window.location.href = "/login";
  };

  const initial = me?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <GraduationCap className="h-5 w-5" />
        </div>
        <span className="text-lg font-bold">ProfAI</span>
      </div>
      <Separator className="bg-sidebar-border" />

      {/* New chat */}
      <div className="p-3">
        <Link
          href="/chat"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-sidebar-primary px-4 py-2.5 text-sm font-semibold text-sidebar-primary-foreground shadow-sm transition hover:bg-sidebar-primary/90"
        >
          <Plus className="h-4 w-4" />
          New chat
        </Link>
      </div>

      {/* Chat list */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        <div className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Recent
        </div>
        {first &&
          [...Array(5)].map((_, i) => (
            <div key={i} className="px-3 py-2.5">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="mt-2 h-2 w-1/3" />
            </div>
          ))}
        {!first && items.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No chats yet. Click <strong>New chat</strong> to start.
          </div>
        )}
        {items.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className={cn(
              "group flex flex-col gap-0.5 rounded-md px-3 py-2.5 text-sm transition",
              c.id === activeId
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="truncate font-medium">{c.title ?? c.topic}</span>
            </div>
            <div className="ml-5 text-[11px] opacity-60">{relative(c.lastActiveAt)}</div>
          </Link>
        ))}
        {cursor && (
          <button
            onClick={() => load(cursor)}
            disabled={busy}
            className="w-full rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent/50"
          >
            {busy ? "Loading…" : "Load more"}
          </button>
        )}
      </nav>

      {/* Footer nav */}
      <Separator className="bg-sidebar-border" />
      <div className="space-y-0.5 p-2">
        <NavItem href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} label="Dashboard" />
        <NavItem href="/reports" icon={<FileText className="h-4 w-4" />} label="Reports" />
        <NavItem href="/settings" icon={<Settings className="h-4 w-4" />} label="Settings" />
      </div>
      <Separator className="bg-sidebar-border" />

      {/* User card */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar>
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="flex-1 truncate">
          <div className="truncate text-sm font-medium">{me?.email ?? "—"}</div>
          <button
            onClick={logout}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-3 w-3" /> Log out
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
    >
      <span className="opacity-60">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function relative(secEpoch: number): string {
  const diff = Math.floor(Date.now() / 1000) - secEpoch;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
