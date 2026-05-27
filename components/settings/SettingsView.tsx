"use client";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PasswordInput } from "@/components/ui/password-input";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { KeyRound, Download, Trash2, Loader2 } from "lucide-react";

export function SettingsView({ email }: { email: string }) {
  const initial = email[0]?.toUpperCase() ?? "?";
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-foreground">Account</h2>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-card-foreground">{email}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sessions are 30-day sliding. Changing your password signs you out everywhere else.
            </p>
          </div>
        </CardContent>
      </Card>
      <PasswordCard />
      <ExportCard />
      <DangerZone />
    </div>
  );
}

function PasswordCard() {
  const [cur, setCur] = useState("");
  const [nu, setNu] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!cur) {
      toast.error("Enter your current password.");
      return;
    }
    if (nu.length < 10) {
      toast.error("New password must be at least 10 characters.");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json", origin: window.location.origin },
      body: JSON.stringify({ current_password: cur, new_password: nu }),
    });
    if (r.ok) {
      toast.success("Password updated. Other sessions signed out.");
      setCur("");
      setNu("");
    } else {
      const body = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
      toast.error(body.error?.message ?? "Update failed");
    }
    setBusy(false);
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Change password</h2>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="max-w-md space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cur">Current</Label>
            <PasswordInput
              id="cur"
              autoComplete="current-password"
              value={cur}
              onChange={(e) => setCur(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu">New (min 10 characters)</Label>
            <PasswordInput
              id="nu"
              autoComplete="new-password"
              value={nu}
              onChange={(e) => setNu(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ExportCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Export your data</h2>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Download a JSON copy of your profile, chats, messages, and reports.
        </p>
        <Button variant="outline" asChild>
          <a href="/api/auth/me/export">
            <Download className="h-4 w-4" />
            Download JSON
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function DangerZone() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const del = async () => {
    if (confirm !== "delete my account") return;
    setBusy(true);
    const r = await fetch("/api/auth/me", {
      method: "DELETE",
      headers: { origin: window.location.origin },
    });
    if (r.ok) {
      toast.success("Account deleted. Goodbye 👋");
      window.location.href = "/login";
    } else {
      toast.error("Delete failed.");
    }
    setBusy(false);
  };
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Danger zone</h2>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Permanently delete your account, all chats, messages, and reports. This cannot be undone.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="h-4 w-4" />
              Delete account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This will revoke all sessions and remove your data. To confirm, type{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                  delete my account
                </code>
                .
              </DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="delete my account"
            />
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={del}
                disabled={confirm !== "delete my account" || busy}
                className="w-full sm:w-auto"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                  </>
                ) : (
                  "Yes, delete forever"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
