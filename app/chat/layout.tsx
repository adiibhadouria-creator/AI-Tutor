"use client";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/chat/Sidebar";
import { usePathname } from "vinext/shims/navigation";

/**
 * Shared layout for /chat and /chat/[id]. The sidebar is mounted here ONCE
 * and stays put across navigations — only the main pane swaps.
 *
 * activeId is derived from the URL so the sidebar can highlight the current
 * chat without prop-threading it from each page component.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // /chat/<id>  →  segments = ["chat", "<id>"]
  const segs = pathname.split("/").filter(Boolean);
  const activeId = segs[0] === "chat" && segs[1] ? segs[1] : undefined;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar {...(activeId ? { activeId } : {})} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
