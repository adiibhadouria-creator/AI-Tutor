"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Loader2, ClipboardCheck, GraduationCap, BookOpen } from "lucide-react";
import { cn } from "@/lib/cn";

interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** approximate seconds we expect this step to take */
  estSec: number;
}

const STEPS: Step[] = [
  { id: "analysing", label: "Analysing your answers", icon: <ClipboardCheck className="h-5 w-5" />, estSec: 8 },
  { id: "level", label: "Determining your level", icon: <GraduationCap className="h-5 w-5" />, estSec: 4 },
  { id: "lesson", label: "Designing your lesson plan", icon: <BookOpen className="h-5 w-5" />, estSec: 18 },
];

export function CurriculumLoader() {
  const [active, setActive] = useState(0);

  // Walk the steps on a timer that roughly matches the upstream call latency.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    STEPS.forEach((s, i) => {
      if (i === 0) return;
      elapsed += STEPS[i - 1]!.estSec * 1000;
      timers.push(setTimeout(() => setActive(i), elapsed));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex w-full animate-fade-in items-start gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
      <Card className="w-full max-w-2xl rounded-bl-sm">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Designing your curriculum
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              This usually takes about half a minute. Hang tight.
            </p>
          </div>
          <ol className="space-y-3">
            {STEPS.map((s, i) => {
              const done = i < active;
              const current = i === active;
              return (
                <li
                  key={s.id}
                  className={cn(
                    "flex items-center gap-3 transition",
                    done ? "text-foreground" : current ? "text-foreground" : "text-muted-foreground/60",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition",
                      done
                        ? "bg-primary/10 text-primary"
                        : current
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground/50",
                    )}
                  >
                    {done ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : current ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      s.icon
                    )}
                  </div>
                  <span className={cn("text-sm", current && "font-medium")}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
