"use client";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/chat/Sidebar";
import { SettingsView } from "@/components/settings/SettingsView";

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/auth/me").then(async (r) => {
      if (!r.ok) {
        window.location.href = "/login";
        return;
      }
      const data = (await r.json()) as { email: string };
      setEmail(data.email);
    });
  }, []);
  if (!email)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-6 text-3xl font-bold text-foreground">Settings</h1>
          <SettingsView email={email} />
        </div>
      </main>
    </div>
  );
}
