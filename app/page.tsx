"use client";
import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        window.location.href = r.ok ? "/chat" : "/login";
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, []);
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold text-primary">ProfAI</h1>
        <p className="text-slate-500">Loading…</p>
      </div>
    </main>
  );
}
