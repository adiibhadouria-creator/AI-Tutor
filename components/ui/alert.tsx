import * as React from "react";
import { cn } from "@/lib/cn";

export const Alert = ({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    role="alert"
    className={cn(
      "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
      className,
    )}
    {...p}
  >
    {children}
  </div>
);
