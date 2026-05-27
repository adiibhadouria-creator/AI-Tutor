"use client";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { GraduationCap, Loader2 } from "lucide-react";

export interface AuthFormProps {
  mode: "signup" | "login";
  endpoint: string;
  redirectTo: string;
}

export function AuthForm({ mode, endpoint, redirectTo }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Please enter your email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("That doesn't look like a valid email.");
      return;
    }
    if (mode === "signup") {
      if (password.length < 10) {
        toast.error("Password must be at least 10 characters.");
        return;
      }
      if (password !== confirm) {
        toast.error("Passwords don't match.");
        return;
      }
    } else if (!password) {
      toast.error("Please enter your password.");
      return;
    }

    setBusy(true);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", origin: window.location.origin },
        body: JSON.stringify({ email, password, turnstile_token: "dev" }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
        toast.error(body.error?.message ?? `${mode === "signup" ? "Signup" : "Sign in"} failed`);
        return;
      }
      toast.success(mode === "signup" ? "Account created — let's go!" : "Welcome back!");
      window.location.href = redirectTo;
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <GraduationCap className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "We'll keep you signed in for 30 days. The session refreshes every time you use ProfAI."
            : "Free signup. No credit card required."}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder={mode === "signup" ? "At least 10 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                placeholder="Repeat your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}
          <Button type="submit" disabled={busy} className="w-full" size="lg">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Working…
              </>
            ) : mode === "signup" ? (
              "Create account"
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
