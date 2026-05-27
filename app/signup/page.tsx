import Link from "vinext/shims/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_top,var(--accent),transparent_70%),radial-gradient(50rem_25rem_at_bottom_right,var(--accent),transparent_70%)] opacity-60"
      />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <AuthForm mode="signup" endpoint="/api/auth/signup" redirectTo="/chat" />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
