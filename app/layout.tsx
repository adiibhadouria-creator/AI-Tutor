import "./globals.css";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

export const metadata = {
  title: "ProfAI — Adaptive Tutor",
  description: "Personalised AI tutoring on Cloudflare.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "rounded-xl border border-slate-200 shadow-lg",
            },
          }}
        />
      </body>
    </html>
  );
}
