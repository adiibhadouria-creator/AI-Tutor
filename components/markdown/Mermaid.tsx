"use client";
import { useEffect, useRef, useState } from "react";

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "neutral",
        fontFamily: "Inter, system-ui, sans-serif",
      });
      return m.default;
    });
  }
  return mermaidPromise;
}

export function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMermaid()
      .then(async (m) => {
        if (cancelled || !ref.current) return;
        try {
          const id = `mmd-${Math.random().toString(36).slice(2)}`;
          const { svg } = await m.render(id, chart);
          if (cancelled) return;
          if (ref.current) ref.current.innerHTML = svg;
          setErr(null);
        } catch (e) {
          setErr(e instanceof Error ? e.message : "render failed");
        }
      })
      .catch((e) => setErr(String(e)));
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (err) {
    return (
      <pre className="overflow-x-auto rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        {`Mermaid render error: ${err}\n\n${chart}`}
      </pre>
    );
  }
  return (
    <div
      ref={ref}
      className="my-3 flex justify-center overflow-x-auto rounded-md border border-border bg-muted/40 p-4 [&>svg]:max-w-full [&>svg]:h-auto"
    />
  );
}
