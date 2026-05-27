"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "vinext/shims/navigation";
import { Sidebar } from "@/components/chat/Sidebar";
import { ReportView } from "@/components/reports/ReportView";

interface Report {
  id: string;
  title: string;
  kind: string;
  version: number;
  contentMd: string;
}

function idFromPath(pathname: string): string | null {
  const segs = pathname.split("/").filter(Boolean);
  return segs[segs.length - 1] ?? null;
}

export default function ReportPage() {
  const router = useRouter();
  const pathname = usePathname();
  const id = idFromPath(pathname);
  const [r, setR] = useState<Report | null>(null);

  useEffect(() => {
    if (!id || id === "undefined" || id === "reports") {
      router.push("/reports");
      return;
    }
    let cancelled = false;
    setR(null);
    fetch(`/api/reports/${id}`).then(async (resp) => {
      if (cancelled) return;
      if (!resp.ok) {
        router.push("/reports");
        return;
      }
      setR((await resp.json()) as Report);
    });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (!r)
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </main>
      </div>
    );
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-3xl">
          <ReportView
            id={r.id}
            title={r.title}
            kind={r.kind}
            version={r.version}
            contentMd={r.contentMd}
            canRegenerate={r.kind === "progress"}
          />
        </div>
      </main>
    </div>
  );
}
