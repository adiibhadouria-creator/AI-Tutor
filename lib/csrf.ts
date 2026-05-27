import { AppError } from "@/lib/errors";

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function assertSameOrigin(req: Request, appOrigin: string): void {
  if (!STATE_CHANGING.has(req.method.toUpperCase())) return;
  const origin = req.headers.get("origin");
  if (!origin) throw new AppError("FORBIDDEN", "missing Origin header");
  if (origin !== appOrigin) throw new AppError("FORBIDDEN", "origin mismatch");
}
